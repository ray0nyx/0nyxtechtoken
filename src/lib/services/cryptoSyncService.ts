import { createClient } from '@/lib/supabase/client';
import { credentialService } from './credentialService';
import { tradeNormalizationService } from './tradeNormalizationService';
import { 
  NormalizedTrade, 
  ExchangeConnection, 
  SyncSession, 
  AccountInfo, 
  ValidationResult,
  CryptoSyncConfig 
} from '@/types/tradeSync';

// Import CCXT dynamically to avoid SSR issues
let ccxt: any = null;

const loadCCXT = async () => {
  if (!ccxt) {
    ccxt = await import('ccxt');
  }
  return ccxt;
};

export class CryptoSyncService {
  private static instance: CryptoSyncService;
  private supabase = createClient();
  private exchangeInstances: Map<string, any> = new Map();
  private wsConnections: Map<string, WebSocket> = new Map();
  private syncSessions: Map<string, SyncSession> = new Map();

  static getInstance(): CryptoSyncService {
    if (!CryptoSyncService.instance) {
      CryptoSyncService.instance = new CryptoSyncService();
    }
    return CryptoSyncService.instance;
  }

  /**
   * Connect to a crypto exchange
   */
  async connectExchange(connectionId: string): Promise<boolean> {
    try {
      // Get connection details
      const { data: connection, error } = await this.supabase
        .from('user_exchange_connections')
        .select('*')
        .eq('id', connectionId)
        .single();

      if (error || !connection) {
        throw new Error('Connection not found');
      }

      // Get decrypted credentials
      const credentials = await credentialService.getCredentials(connectionId);
      
      // Load CCXT
      const ccxtModule = await loadCCXT();
      
      // Create exchange instance
      const exchangeClass = ccxtModule[connection.exchange_name];
      if (!exchangeClass) {
        throw new Error(`Exchange ${connection.exchange_name} not supported`);
      }

      const exchangeInstance = new exchangeClass({
        apiKey: credentials.apiKey,
        secret: credentials.secret,
        passphrase: credentials.passphrase,
        sandbox: credentials.sandbox || false,
        enableRateLimit: true,
        timeout: 30000,
      });

      // Test connection
      await exchangeInstance.loadMarkets();
      
      // Store instance
      this.exchangeInstances.set(connectionId, exchangeInstance);
      
      // Update connection status
      await credentialService.updateConnectionStatus(connectionId, 'connected');
      
      return true;
    } catch (error) {
      console.error('Error connecting to exchange:', error);
      await credentialService.updateConnectionStatus(
        connectionId, 
        'error', 
        error instanceof Error ? error.message : 'Unknown error'
      );
      return false;
    }
  }

  /**
   * Disconnect from exchange
   */
  async disconnectExchange(connectionId: string): Promise<void> {
    try {
      // Close WebSocket connection
      const ws = this.wsConnections.get(connectionId);
      if (ws) {
        ws.close();
        this.wsConnections.delete(connectionId);
      }

      // Remove exchange instance
      this.exchangeInstances.delete(connectionId);

      // Update connection status
      await credentialService.updateConnectionStatus(connectionId, 'disconnected');
    } catch (error) {
      console.error('Error disconnecting from exchange:', error);
    }
  }

  /**
   * Validate exchange credentials
   */
  async validateCredentials(connectionId: string): Promise<ValidationResult> {
    try {
      const exchange = this.exchangeInstances.get(connectionId);
      if (!exchange) {
        return { isValid: false, error: 'Exchange not connected' };
      }

      // Test API access
      await exchange.fetchBalance();
      
      return { isValid: true };
    } catch (error) {
      return { 
        isValid: false, 
        error: error instanceof Error ? error.message : 'Validation failed' 
      };
    }
  }

  /**
   * Get account information
   */
  async getAccountInfo(connectionId: string): Promise<AccountInfo> {
    try {
      const exchange = this.exchangeInstances.get(connectionId);
      if (!exchange) {
        throw new Error('Exchange not connected');
      }

      const balance = await exchange.fetchBalance();
      
      return {
        id: balance.info?.accountId || 'default',
        balances: Object.entries(balance)
          .filter(([key]) => !['info', 'free', 'used', 'total'].includes(key))
          .map(([currency, amounts]: [string, any]) => ({
            currency,
            free: amounts.free || 0,
            used: amounts.used || 0,
            total: amounts.total || 0,
          })),
        permissions: balance.info?.permissions || [],
        limits: balance.info?.limits || {}
      };
    } catch (error) {
      console.error('Error getting account info:', error);
      throw error;
    }
  }

  /**
   * Sync historical trades
   */
  async syncHistoricalTrades(
    connectionId: string, 
    startDate: Date, 
    endDate: Date,
    symbols?: string[]
  ): Promise<SyncSession> {
    try {
      // Create sync session
      const { data: session, error: sessionError } = await this.supabase
        .from('trade_sync_sessions')
        .insert({
          connection_id: connectionId,
          sync_type: 'historical',
          status: 'running'
        })
        .select()
        .single();

      if (sessionError) {
        throw sessionError;
      }

      this.syncSessions.set(session.id, session);

      // Get connection details
      const { data: connection } = await this.supabase
        .from('user_exchange_connections')
        .select('*')
        .eq('id', connectionId)
        .single();

      if (!connection) {
        throw new Error('Connection not found');
      }

      // Update connection status
      await credentialService.updateConnectionStatus(connectionId, 'syncing');

      const exchange = this.exchangeInstances.get(connectionId);
      if (!exchange) {
        throw new Error('Exchange not connected');
      }

      // Get available symbols
      const markets = await exchange.loadMarkets();
      const availableSymbols = symbols || Object.keys(markets).slice(0, 10); // Limit to 10 symbols for initial sync

      let totalTrades = 0;
      let totalUpdated = 0;

      // Sync trades for each symbol
      for (const symbol of availableSymbols) {
        try {
          const trades = await exchange.fetchMyTrades(symbol, startDate.getTime(), undefined, 1000);
          
          for (const trade of trades) {
            try {
              // Normalize trade
              const normalizedTrade = tradeNormalizationService.normalizeTrade(
                connection.exchange_name,
                trade,
                connection.user_id,
                connectionId
              );

              // Validate trade
              if (!tradeNormalizationService.validateNormalizedTrade(normalizedTrade)) {
                console.warn('Invalid trade data, skipping:', normalizedTrade);
                continue;
              }

              // Check if trade already exists
              const { data: existingTrade } = await this.supabase
                .from('trades')
                .select('id')
                .eq('exchange_trade_id', normalizedTrade.exchangeTradeId)
                .eq('connection_id', connectionId)
                .single();

              if (existingTrade) {
                // Update existing trade
                const dbFormat = tradeNormalizationService.toDatabaseFormat(normalizedTrade);
                await this.supabase
                  .from('trades')
                  .update(dbFormat)
                  .eq('id', existingTrade.id);
                totalUpdated++;
              } else {
                // Insert new trade
                const dbFormat = tradeNormalizationService.toDatabaseFormat(normalizedTrade);
                await this.supabase
                  .from('trades')
                  .insert(dbFormat);
                totalTrades++;
              }
            } catch (tradeError) {
              console.error('Error processing trade:', tradeError);
            }
          }
        } catch (symbolError) {
          console.error(`Error syncing symbol ${symbol}:`, symbolError);
        }
      }

      // Update sync session
      const completedAt = new Date();
      const duration = completedAt.getTime() - new Date(session.started_at).getTime();

      await this.supabase
        .from('trade_sync_sessions')
        .update({
          completed_at: completedAt.toISOString(),
          trades_synced: totalTrades,
          trades_updated: totalUpdated,
          sync_duration: `${duration}ms`,
          status: 'completed'
        })
        .eq('id', session.id);

      // Update connection status
      await credentialService.updateConnectionStatus(connectionId, 'connected');

      return {
        ...session,
        completedAt,
        tradesSynced: totalTrades,
        tradesUpdated: totalUpdated,
        syncDuration: duration,
        status: 'completed'
      };
    } catch (error) {
      console.error('Error syncing historical trades:', error);
      
      // Update sync session with error
      if (this.syncSessions.has(session.id)) {
        await this.supabase
          .from('trade_sync_sessions')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString()
          })
          .eq('id', session.id);
      }

      // Update connection status
      await credentialService.updateConnectionStatus(
        connectionId, 
        'error', 
        error instanceof Error ? error.message : 'Sync failed'
      );

      throw error;
    }
  }

  /**
   * Start real-time trade streaming
   */
  async startRealtimeSync(connectionId: string, symbols: string[]): Promise<void> {
    try {
      // Get connection details
      const { data: connection } = await this.supabase
        .from('user_exchange_connections')
        .select('*')
        .eq('id', connectionId)
        .single();

      if (!connection) {
        throw new Error('Connection not found');
      }

      const exchange = this.exchangeInstances.get(connectionId);
      if (!exchange) {
        throw new Error('Exchange not connected');
      }

      // Create WebSocket connection
      const wsUrl = this.getWebSocketUrl(connection.exchange_name);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log(`WebSocket connected for ${connection.exchange_name}`);
        this.authenticateWebSocket(ws, connection.exchange_name, connectionId);
      };

      ws.onmessage = (event) => {
        this.handleWebSocketMessage(connectionId, connection.user_id, JSON.parse(event.data));
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.handleWebSocketError(connectionId, error);
      };

      ws.onclose = () => {
        console.log(`WebSocket closed for ${connection.exchange_name}`);
        this.wsConnections.delete(connectionId);
      };

      this.wsConnections.set(connectionId, ws);
      
      // Update connection status
      await credentialService.updateConnectionStatus(connectionId, 'syncing');
    } catch (error) {
      console.error('Error starting real-time sync:', error);
      await credentialService.updateConnectionStatus(
        connectionId, 
        'error', 
        error instanceof Error ? error.message : 'Real-time sync failed'
      );
    }
  }

  /**
   * Stop real-time trade streaming
   */
  async stopRealtimeSync(connectionId: string): Promise<void> {
    const ws = this.wsConnections.get(connectionId);
    if (ws) {
      ws.close();
      this.wsConnections.delete(connectionId);
    }
    
    await credentialService.updateConnectionStatus(connectionId, 'connected');
  }

  /**
   * Get WebSocket URL for exchange
   */
  private getWebSocketUrl(exchangeName: string): string {
    const urls = {
      'binance': 'wss://stream.binance.com:9443/ws/',
      'coinbase': 'wss://ws-feed.exchange.coinbase.com',
      'kraken': 'wss://ws.kraken.com',
      'kucoin': 'wss://ws-api.kucoin.com/endpoint',
      'bybit': 'wss://stream.bybit.com/v5/public/spot',
      'okx': 'wss://ws.okx.com:8443/ws/v5/public',
      'bitget': 'wss://ws.bitget.com/spot/v1/stream',
      'huobi': 'wss://api.huobi.pro/ws',
      'gateio': 'wss://api.gateio.ws/ws/v4/',
      'mexc': 'wss://wbs.mexc.com/ws'
    };

    return urls[exchangeName as keyof typeof urls] || '';
  }

  /**
   * Authenticate WebSocket connection
   */
  private async authenticateWebSocket(ws: WebSocket, exchangeName: string, connectionId: string): Promise<void> {
    try {
      const credentials = await credentialService.getCredentials(connectionId);
      
      // Exchange-specific authentication
      switch (exchangeName) {
        case 'binance':
          // Binance uses API key in URL params
          break;
        case 'coinbase':
          // Coinbase uses signed messages
          break;
        case 'kraken':
          // Kraken uses token-based auth
          break;
        default:
          console.warn(`WebSocket authentication not implemented for ${exchangeName}`);
      }
    } catch (error) {
      console.error('WebSocket authentication error:', error);
    }
  }

  /**
   * Handle WebSocket messages
   */
  private async handleWebSocketMessage(connectionId: string, userId: string, data: any): Promise<void> {
    try {
      // Exchange-specific message handling
      const { data: connection } = await this.supabase
        .from('user_exchange_connections')
        .select('exchange_name')
        .eq('id', connectionId)
        .single();

      if (!connection) return;

      // Parse trade data based on exchange
      const trades = this.parseWebSocketTrades(connection.exchange_name, data);
      
      for (const trade of trades) {
        try {
          // Normalize trade
          const normalizedTrade = tradeNormalizationService.normalizeTrade(
            connection.exchange_name,
            trade,
            userId,
            connectionId
          );

          // Validate trade
          if (!tradeNormalizationService.validateNormalizedTrade(normalizedTrade)) {
            continue;
          }

          // Store trade
          const dbFormat = tradeNormalizationService.toDatabaseFormat(normalizedTrade);
          await this.supabase
            .from('trades')
            .insert(dbFormat);

          // Emit real-time update
          this.emitTradeUpdate(normalizedTrade);
        } catch (tradeError) {
          console.error('Error processing WebSocket trade:', tradeError);
        }
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  /**
   * Parse WebSocket trades based on exchange
   */
  private parseWebSocketTrades(exchangeName: string, data: any): any[] {
    // This would contain exchange-specific parsing logic
    // For now, return empty array as placeholder
    return [];
  }

  /**
   * Emit trade update for real-time UI updates
   */
  private emitTradeUpdate(trade: NormalizedTrade): void {
    // This would emit to Supabase Realtime or custom WebSocket
    // For now, just log
    console.log('New trade:', trade);
  }

  /**
   * Handle WebSocket errors
   */
  private async handleWebSocketError(connectionId: string, error: any): Promise<void> {
    console.error('WebSocket error for connection:', connectionId, error);
    await credentialService.updateConnectionStatus(connectionId, 'error', 'WebSocket connection error');
  }

  /**
   * Get sync status for all connections
   */
  async getSyncStatus(): Promise<any[]> {
    try {
      const { data: connections } = await this.supabase
        .from('user_exchange_connections')
        .select('*')
        .order('created_at', { ascending: false });

      return connections || [];
    } catch (error) {
      console.error('Error getting sync status:', error);
      return [];
    }
  }
}

export const cryptoSyncService = CryptoSyncService.getInstance();
