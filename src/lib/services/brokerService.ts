import { supabase } from '@/lib/supabase';
import { Trade } from '@/types/trade';

interface BrokerToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export class BrokerService {
  private static instance: BrokerService;
  private tokens: Record<string, BrokerToken> = {};
  private userId: string | null = null;

  private constructor() {
    // Initialize user ID
    supabase.auth.getUser().then(({ data: { user } }) => {
      this.userId = user?.id ?? null;
    });
  }

  static getInstance(): BrokerService {
    if (!BrokerService.instance) {
      BrokerService.instance = new BrokerService();
    }
    return BrokerService.instance;
  }

  async handleOAuthCallback(code: string, state: string): Promise<void> {
    // Verify state matches the one we stored
    const storedState = localStorage.getItem('oauthState');
    if (state !== storedState) {
      throw new Error('Invalid state parameter');
    }

    const broker = localStorage.getItem('selectedBroker');
    if (!broker) {
      throw new Error('No broker selected');
    }

    // Exchange the code for tokens
    const tokens = await this.exchangeCodeForTokens(code, broker);
    this.tokens[broker] = tokens;

    // Store the tokens in Supabase
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('broker_connections')
      .upsert({
        user_id: user.id,
        broker: broker,
        api_key: tokens.access_token,
        secret_key: tokens.refresh_token,
        sandbox: false,
      });

    if (error) throw error;

    // Clean up localStorage
    localStorage.removeItem('oauthState');
    localStorage.removeItem('selectedBroker');
  }

  private async exchangeCodeForTokens(code: string, broker: string): Promise<BrokerToken> {
    const tokenEndpoint = this.getBrokerTokenEndpoint(broker);
    const clientId = process.env.VITE_CLIENT_ID;
    const clientSecret = process.env.VITE_CLIENT_SECRET;

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId || '',
        client_secret: clientSecret || '',
        redirect_uri: `${window.location.origin}/auth/callback`,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for tokens');
    }

    return response.json();
  }

  private getBrokerTokenEndpoint(broker: string): string {
    const endpoints: Record<string, string> = {
      'Tradovate': 'https://live.tradovate.com/oauth/token',
      'TD Ameritrade': 'https://api.tdameritrade.com/v1/oauth2/token',
      'Interactive Brokers': 'https://api.interactivebrokers.com/v1/oauth/token',
      'TradeStation': 'https://api.tradestation.com/v2/security/authorize',
    };

    return endpoints[broker] || '';
  }

  async syncTrades(broker: string): Promise<Trade[]> {
    if (!this.userId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      this.userId = user.id;
    }

    // Check if user has Pro membership
    const isProMember = await this.checkProMembership();
    
    if (!isProMember) {
      throw new Error('This feature requires a Pro membership');
    }

    const token = this.tokens[broker];
    if (!token) {
      throw new Error('Not authenticated with broker');
    }

    try {
      const trades = await this.fetchTradesFromBroker(broker, token.access_token);
      
      // Convert Date objects to ISO strings and add user_id
      const processedTrades = trades.map(trade => ({
        ...trade,
        user_id: this.userId!,
        date: trade.date.toISOString(),
        entry_date: trade.entry_date.toISOString(),
        exit_date: trade.exit_date.toISOString(),
      }));

      // Insert trades into Supabase
      const { error } = await supabase
        .from('trades')
        .upsert(processedTrades, {
          onConflict: 'broker_trade_id',
        });

      if (error) throw error;

      return trades;
    } catch (error: any) {
      if (error.message === 'Token expired') {
        await this.refreshToken(broker);
        return this.syncTrades(broker);
      }
      throw error;
    }
  }

  private async fetchTradesFromBroker(broker: string, token: string): Promise<Trade[]> {
    const endpoint = this.getBrokerTradesEndpoint(broker);
    const response = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Token expired');
      }
      throw new Error('Failed to fetch trades from broker');
    }

    const data = await response.json();
    return this.transformBrokerTrades(broker, data);
  }

  private getBrokerTradesEndpoint(broker: string): string {
    const endpoints: Record<string, string> = {
      'Tradovate': 'https://live.tradovate.com/v1/trades',
      'TD Ameritrade': 'https://api.tdameritrade.com/v1/accounts/transactions',
      'Interactive Brokers': 'https://api.interactivebrokers.com/v1/trades',
      'TradeStation': 'https://api.tradestation.com/v2/accounts/trades',
    };

    return endpoints[broker] || '';
  }

  private transformBrokerTrades(broker: string, data: any[]): Trade[] {
    switch (broker) {
      case 'Tradovate':
        return this.transformTradovateTrades(data);
      case 'TD Ameritrade':
        return this.transformTDAmeritradeTrades(data);
      case 'Interactive Brokers':
        return this.transformIBTrades(data);
      case 'TradeStation':
        return this.transformTradeStationTrades(data);
      default:
        throw new Error(`Unsupported broker: ${broker}`);
    }
  }

  private transformTradovateTrades(data: any[]): Trade[] {
    return data.map(trade => ({
      id: crypto.randomUUID(),
      user_id: this.userId!,
      symbol: trade.symbol,
      position: trade.side.toLowerCase(),
      date: new Date(trade.timestamp),
      entry_date: new Date(trade.entry_time),
      exit_date: new Date(trade.exit_time),
      entry_price: trade.entry_price,
      exit_price: trade.exit_price,
      quantity: trade.quantity,
      pnl: trade.realized_pnl,
      strategy: 'API Import',
      broker: 'Tradovate',
      notes: '',
      tags: [],
      fees: trade.commission || 0,
      commission: trade.commission || 0,
    }));
  }

  private transformTDAmeritradeTrades(data: any[]): Trade[] {
    return data
      .filter(transaction => transaction.type === 'TRADE')
      .map(trade => ({
        id: crypto.randomUUID(),
        user_id: this.userId!,
        symbol: trade.symbol,
        position: trade.instruction.toLowerCase(),
        date: new Date(trade.transactionDate),
        entry_date: new Date(trade.transactionDate),
        exit_date: new Date(trade.transactionDate),
        entry_price: trade.price,
        exit_price: trade.price,
        quantity: Math.abs(trade.quantity),
        pnl: trade.netAmount,
        strategy: 'API Import',
        broker: 'TD Ameritrade',
        notes: '',
        tags: [],
        fees: trade.fees || 0,
        commission: trade.commission || 0,
      }));
  }

  private transformIBTrades(data: any[]): Trade[] {
    return data.map(trade => ({
      id: crypto.randomUUID(),
      user_id: this.userId!,
      symbol: trade.symbol,
      position: trade.side.toLowerCase(),
      date: new Date(trade.trade_time),
      entry_date: new Date(trade.trade_time),
      exit_date: new Date(trade.trade_time),
      entry_price: trade.price,
      exit_price: trade.price,
      quantity: trade.quantity,
      pnl: trade.realized_pnl || 0,
      strategy: 'API Import',
      broker: 'Interactive Brokers',
      notes: '',
      tags: [],
      fees: trade.fees || 0,
      commission: trade.commission || 0,
    }));
  }

  private transformTradeStationTrades(data: any[]): Trade[] {
    return data.map(trade => ({
      id: crypto.randomUUID(),
      user_id: this.userId!,
      symbol: trade.Symbol,
      position: trade.OrderSide.toLowerCase(),
      date: new Date(trade.ExecutionTime),
      entry_date: new Date(trade.ExecutionTime),
      exit_date: new Date(trade.ExecutionTime),
      entry_price: trade.ExecutionPrice,
      exit_price: trade.ExecutionPrice,
      quantity: trade.Quantity,
      pnl: trade.ProfitLoss || 0,
      strategy: 'API Import',
      broker: 'TradeStation',
      notes: '',
      tags: [],
      fees: trade.Fees || 0,
      commission: trade.Commission || 0,
    }));
  }

  private async refreshToken(broker: string): Promise<void> {
    const token = this.tokens[broker];
    if (!token?.refresh_token) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(this.getBrokerTokenEndpoint(broker), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token.refresh_token,
        client_id: process.env.VITE_CLIENT_ID || '',
        client_secret: process.env.VITE_CLIENT_SECRET || '',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    const newToken = await response.json();
    this.tokens[broker] = newToken;

    // Update token in Supabase
    if (!this.userId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      this.userId = user.id;
    }

    const { error } = await supabase
      .from('broker_connections')
      .upsert({
        user_id: this.userId,
        broker: broker,
        api_key: newToken.access_token,
        secret_key: newToken.refresh_token,
        sandbox: false,
      });

    if (error) throw error;
  }

  // Check if user has Pro membership
  async checkProMembership(): Promise<boolean> {
    // Implement actual subscription check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    
    // Developer ID should always have access
    const DEVELOPER_ID = "856950ff-d638-419d-bcf1-b7dac51d1c7f";
    if (user.id === DEVELOPER_ID) {
      return true;
    }
    
    // Check in subscriptions table
    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();
      
    if (error) {
      console.error('Error checking subscription:', error);
      return false;
    }
    
    return !!subscriptions;
  }
  
  async getBrokerConnections(): Promise<any[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    
    const { data, error } = await supabase
      .from('broker_connections')
      .select('*')
      .eq('user_id', user.id);
      
    if (error) {
      console.error('Error fetching broker connections:', error);
      return [];
    }
    
    return data || [];
  }
  
  async hasTradovateConnection(): Promise<boolean> {
    const connections = await this.getBrokerConnections();
    return connections.some(conn => conn.broker === 'Tradovate');
  }
  
  async unlinkTradovateConnection(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const { error } = await supabase
      .from('broker_connections')
      .delete()
      .eq('user_id', user.id)
      .eq('broker', 'Tradovate');
    
    if (error) {
      console.error('Error unlinking Tradovate connection:', error);
      throw error;
    }
    
    // Clear any stored tokens
    if (this.tokens['Tradovate']) {
      delete this.tokens['Tradovate'];
    }
  }
} 