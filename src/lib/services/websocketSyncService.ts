import { createClient } from '@/lib/supabase/client';
import { tradeNormalizationService } from './tradeNormalizationService';
import { credentialService } from './credentialService';
import { NormalizedTrade, ExchangeConnection } from '@/types/tradeSync';

export class WebSocketSyncService {
  private static instance: WebSocketSyncService;
  private supabase = createClient();
  private wsConnections: Map<string, WebSocket> = new Map();
  private reconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000; // 5 seconds

  static getInstance(): WebSocketSyncService {
    if (!WebSocketSyncService.instance) {
      WebSocketSyncService.instance = new WebSocketSyncService();
    }
    return WebSocketSyncService.instance;
  }

  /**
   * Start WebSocket connection for an exchange
   */
  async startWebSocketConnection(connectionId: string): Promise<void> {
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

      // Close existing connection if any
      this.stopWebSocketConnection(connectionId);

      // Get WebSocket URL for exchange
      const wsUrl = this.getWebSocketUrl(connection.exchange_name);
      if (!wsUrl) {
        throw new Error(`WebSocket not supported for ${connection.exchange_name}`);
      }

      // Create WebSocket connection
      const ws = new WebSocket(wsUrl);
      this.wsConnections.set(connectionId, ws);

      // Set up event handlers
      ws.onopen = () => {
        console.log(`WebSocket connected for ${connection.exchange_name}`);
        this.authenticateWebSocket(ws, connection);
        this.startHeartbeat(connectionId);
      };

      ws.onmessage = (event) => {
        this.handleWebSocketMessage(connectionId, connection, event.data);
      };

      ws.onerror = (error) => {
        console.error(`WebSocket error for ${connection.exchange_name}:`, error);
        this.handleWebSocketError(connectionId, connection);
      };

      ws.onclose = (event) => {
        console.log(`WebSocket closed for ${connection.exchange_name}:`, event.code, event.reason);
        this.handleWebSocketClose(connectionId, connection);
      };

    } catch (error) {
      console.error('Error starting WebSocket connection:', error);
      await credentialService.updateConnectionStatus(connectionId, 'error', error.message);
    }
  }

  /**
   * Stop WebSocket connection
   */
  stopWebSocketConnection(connectionId: string): void {
    const ws = this.wsConnections.get(connectionId);
    if (ws) {
      ws.close();
      this.wsConnections.delete(connectionId);
    }

    // Clear timeouts and intervals
    const reconnectTimeout = this.reconnectTimeouts.get(connectionId);
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      this.reconnectTimeouts.delete(connectionId);
    }

    const heartbeatInterval = this.heartbeatIntervals.get(connectionId);
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      this.heartbeatIntervals.delete(connectionId);
    }
  }

  /**
   * Get WebSocket URL for exchange
   */
  private getWebSocketUrl(exchangeName: string): string | null {
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

    return urls[exchangeName as keyof typeof urls] || null;
  }

  /**
   * Authenticate WebSocket connection
   */
  private async authenticateWebSocket(ws: WebSocket, connection: any): Promise<void> {
    try {
      const credentials = await credentialService.getCredentials(connection.id);
      
      switch (connection.exchange_name) {
        case 'binance':
          await this.authenticateBinance(ws, credentials);
          break;
        case 'coinbase':
          await this.authenticateCoinbase(ws, credentials);
          break;
        case 'kraken':
          await this.authenticateKraken(ws, credentials);
          break;
        case 'kucoin':
          await this.authenticateKuCoin(ws, credentials);
          break;
        case 'bybit':
          await this.authenticateBybit(ws, credentials);
          break;
        case 'okx':
          await this.authenticateOKX(ws, credentials);
          break;
        default:
          console.warn(`WebSocket authentication not implemented for ${connection.exchange_name}`);
      }
    } catch (error) {
      console.error('WebSocket authentication error:', error);
    }
  }

  /**
   * Binance WebSocket authentication
   */
  private async authenticateBinance(ws: WebSocket, credentials: any): Promise<void> {
    // Binance uses API key in URL params for authenticated streams
    // For now, we'll use public streams
    const subscribeMessage = {
      method: 'SUBSCRIBE',
      params: ['btcusdt@trade', 'ethusdt@trade'],
      id: 1
    };
    
    ws.send(JSON.stringify(subscribeMessage));
  }

  /**
   * Coinbase WebSocket authentication
   */
  private async authenticateCoinbase(ws: WebSocket, credentials: any): Promise<void> {
    const subscribeMessage = {
      type: 'subscribe',
      product_ids: ['BTC-USD', 'ETH-USD'],
      channels: ['matches']
    };
    
    ws.send(JSON.stringify(subscribeMessage));
  }

  /**
   * Kraken WebSocket authentication
   */
  private async authenticateKraken(ws: WebSocket, credentials: any): Promise<void> {
    const subscribeMessage = {
      event: 'subscribe',
      pair: ['XBT/USD', 'ETH/USD'],
      subscription: { name: 'trade' }
    };
    
    ws.send(JSON.stringify(subscribeMessage));
  }

  /**
   * KuCoin WebSocket authentication
   */
  private async authenticateKuCoin(ws: WebSocket, credentials: any): Promise<void> {
    // KuCoin requires token-based authentication
    // For now, we'll use public streams
    const subscribeMessage = {
      id: 1,
      type: 'subscribe',
      topic: '/market/ticker:all',
      response: true
    };
    
    ws.send(JSON.stringify(subscribeMessage));
  }

  /**
   * Bybit WebSocket authentication
   */
  private async authenticateBybit(ws: WebSocket, credentials: any): Promise<void> {
    const subscribeMessage = {
      op: 'subscribe',
      args: ['publicTrade.BTCUSDT', 'publicTrade.ETHUSDT']
    };
    
    ws.send(JSON.stringify(subscribeMessage));
  }

  /**
   * OKX WebSocket authentication
   */
  private async authenticateOKX(ws: WebSocket, credentials: any): Promise<void> {
    const subscribeMessage = {
      op: 'subscribe',
      args: [
        { channel: 'trades', instId: 'BTC-USDT' },
        { channel: 'trades', instId: 'ETH-USDT' }
      ]
    };
    
    ws.send(JSON.stringify(subscribeMessage));
  }

  /**
   * Handle WebSocket messages
   */
  private async handleWebSocketMessage(connectionId: string, connection: any, data: string): Promise<void> {
    try {
      const message = JSON.parse(data);
      
      // Parse trades based on exchange
      const trades = this.parseWebSocketTrades(connection.exchange_name, message);
      
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

          // Store trade in database
          await this.storeTrade(normalizedTrade);

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
  private parseWebSocketTrades(exchangeName: string, message: any): any[] {
    switch (exchangeName) {
      case 'binance':
        return this.parseBinanceTrades(message);
      case 'coinbase':
        return this.parseCoinbaseTrades(message);
      case 'kraken':
        return this.parseKrakenTrades(message);
      case 'kucoin':
        return this.parseKuCoinTrades(message);
      case 'bybit':
        return this.parseBybitTrades(message);
      case 'okx':
        return this.parseOKXTrades(message);
      default:
        return [];
    }
  }

  /**
   * Parse Binance WebSocket trades
   */
  private parseBinanceTrades(message: any): any[] {
    if (message.e === 'trade') {
      return [{
        id: message.t,
        symbol: message.s,
        side: message.m ? 'sell' : 'buy',
        amount: parseFloat(message.q),
        price: parseFloat(message.p),
        timestamp: message.T,
        orderId: message.t
      }];
    }
    return [];
  }

  /**
   * Parse Coinbase WebSocket trades
   */
  private parseCoinbaseTrades(message: any): any[] {
    if (message.type === 'match') {
      return [{
        id: message.trade_id,
        symbol: message.product_id,
        side: message.side,
        amount: parseFloat(message.size),
        price: parseFloat(message.price),
        timestamp: new Date(message.time).getTime(),
        orderId: message.trade_id
      }];
    }
    return [];
  }

  /**
   * Parse Kraken WebSocket trades
   */
  private parseKrakenTrades(message: any): any[] {
    if (Array.isArray(message) && message[2] === 'trade') {
      const trades = message[1];
      return trades.map((trade: any) => ({
        id: `${trade[2]}-${trade[3]}`,
        symbol: message[3],
        side: trade[3] === 'b' ? 'buy' : 'sell',
        amount: parseFloat(trade[1]),
        price: parseFloat(trade[0]),
        timestamp: parseFloat(trade[2]) * 1000,
        orderId: trade[2]
      }));
    }
    return [];
  }

  /**
   * Parse KuCoin WebSocket trades
   */
  private parseKuCoinTrades(message: any): any[] {
    if (message.type === 'message' && message.topic?.includes('trade')) {
      const data = message.data;
      return data.map((trade: any) => ({
        id: trade.tradeId,
        symbol: trade.symbol,
        side: trade.side,
        amount: parseFloat(trade.size),
        price: parseFloat(trade.price),
        timestamp: trade.time,
        orderId: trade.tradeId
      }));
    }
    return [];
  }

  /**
   * Parse Bybit WebSocket trades
   */
  private parseBybitTrades(message: any): any[] {
    if (message.topic?.includes('publicTrade')) {
      const trades = message.data;
      return trades.map((trade: any) => ({
        id: trade.tradeId,
        symbol: trade.symbol,
        side: trade.side,
        amount: parseFloat(trade.size),
        price: parseFloat(trade.price),
        timestamp: trade.timestamp,
        orderId: trade.tradeId
      }));
    }
    return [];
  }

  /**
   * Parse OKX WebSocket trades
   */
  private parseOKXTrades(message: any): any[] {
    if (message.arg?.channel === 'trades' && message.data) {
      const trades = message.data;
      return trades.map((trade: any) => ({
        id: trade.tradeId,
        symbol: trade.instId,
        side: trade.side,
        amount: parseFloat(trade.sz),
        price: parseFloat(trade.px),
        timestamp: parseInt(trade.ts),
        orderId: trade.tradeId
      }));
    }
    return [];
  }

  /**
   * Store trade in database
   */
  private async storeTrade(trade: NormalizedTrade): Promise<void> {
    try {
      const dbFormat = tradeNormalizationService.toDatabaseFormat(trade);
      
      const { error } = await this.supabase
        .from('trades')
        .insert(dbFormat);

      if (error) {
        console.error('Error storing trade:', error);
      }
    } catch (error) {
      console.error('Error storing trade:', error);
    }
  }

  /**
   * Emit trade update for real-time UI updates
   */
  private emitTradeUpdate(trade: NormalizedTrade): void {
    // This would emit to Supabase Realtime or custom WebSocket
    // For now, we'll use Supabase Realtime
    this.supabase
      .channel('trades')
      .send({
        type: 'broadcast',
        event: 'trade_update',
        payload: trade
      });
  }

  /**
   * Handle WebSocket errors
   */
  private async handleWebSocketError(connectionId: string, connection: any): Promise<void> {
    console.error('WebSocket error for connection:', connectionId);
    await credentialService.updateConnectionStatus(connectionId, 'error', 'WebSocket connection error');
  }

  /**
   * Handle WebSocket close
   */
  private handleWebSocketClose(connectionId: string, connection: any): void {
    // Clear heartbeat
    const heartbeatInterval = this.heartbeatIntervals.get(connectionId);
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      this.heartbeatIntervals.delete(connectionId);
    }

    // Attempt reconnection
    this.scheduleReconnect(connectionId, connection);
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(connectionId: string, connection: any): void {
    const reconnectTimeout = this.reconnectTimeouts.get(connectionId);
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
    }

    const timeout = setTimeout(() => {
      console.log(`Attempting to reconnect ${connection.exchange_name}...`);
      this.startWebSocketConnection(connectionId);
    }, this.reconnectDelay);

    this.reconnectTimeouts.set(connectionId, timeout);
  }

  /**
   * Start heartbeat for connection
   */
  private startHeartbeat(connectionId: string): void {
    const heartbeatInterval = setInterval(() => {
      const ws = this.wsConnections.get(connectionId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        // Send ping message (exchange-specific)
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // 30 seconds

    this.heartbeatIntervals.set(connectionId, heartbeatInterval);
  }

  /**
   * Get connection status
   */
  getConnectionStatus(connectionId: string): 'connected' | 'disconnected' | 'error' {
    const ws = this.wsConnections.get(connectionId);
    if (!ws) return 'disconnected';
    
    switch (ws.readyState) {
      case WebSocket.CONNECTING:
        return 'disconnected';
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CLOSING:
      case WebSocket.CLOSED:
        return 'disconnected';
      default:
        return 'error';
    }
  }

  /**
   * Get all active connections
   */
  getActiveConnections(): string[] {
    return Array.from(this.wsConnections.keys());
  }

  /**
   * Stop all connections
   */
  stopAllConnections(): void {
    for (const connectionId of this.wsConnections.keys()) {
      this.stopWebSocketConnection(connectionId);
    }
  }
}

export const websocketSyncService = WebSocketSyncService.getInstance();
