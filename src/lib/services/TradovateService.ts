import { supabase } from '@/lib/supabase';
import { BrokerService } from './brokerService';

interface TradovateCredentials {
  accessToken: string;
  mdAccessToken: string;
  expirationTime: number;
  userId: string;
}

interface TradovateAccount {
  id: string;
  name: string;
  accountId: string;
  accountType: string;
  active: boolean;
  balance: number;
  currency: string;
}

interface TradovatePosition {
  id: string;
  accountId: string;
  contractId: string;
  symbol: string;
  netPos: number;
  netPrice: number;
  timestamp: string;
  unrealizedPnl: number;
}

interface TradovateOrder {
  id: string;
  accountId: string;
  ordStatus: string;
  symbol: string;
  orderQty: number;
  filledQty: number;
  limitPrice: number | null;
  stopPrice: number | null;
  orderType: string;
  timeInForce: string;
  timestamp: string;
}

interface TradovateChartData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TradovateTrade {
  id: string;
  accountId: string;
  entryTime: string;
  exitTime: string | null;
  symbol: string;
  orderQty: number;
  entryPrice: number;
  exitPrice: number | null;
  realizedPnl: number;
  side: 'Buy' | 'Sell';
  status: 'Open' | 'Closed';
}

export class TradovateService {
  private static instance: TradovateService;
  private credentials: TradovateCredentials | null = null;
  private brokerService: BrokerService;
  private websocket: WebSocket | null = null;
  private positionSubscriptions: Map<string, number> = new Map();
  private chartSubscriptions: Map<string, number> = new Map();
  private chartDataCallbacks: Map<string, (data: TradovateChartData) => void> = new Map();
  
  private constructor() {
    this.brokerService = BrokerService.getInstance();
  }
  
  static getInstance(): TradovateService {
    if (!TradovateService.instance) {
      TradovateService.instance = new TradovateService();
    }
    return TradovateService.instance;
  }
  
  /**
   * Authenticate with Tradovate API
   */
  async authenticate(apiKey: string, secretKey: string): Promise<void> {
    try {
      // Check if user has Pro membership
      const isProMember = await this.brokerService.checkProMembership();
      
      if (!isProMember) {
        throw new Error('This feature requires a Pro membership');
      }
      
      const response = await fetch('https://live.tradovate.com/v1/auth/accessTokenRequest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'user',
          password: 'password',
          appId: apiKey,
          appVersion: '1.0',
          cid: secretKey,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to authenticate with Tradovate');
      }
      
      const data = await response.json();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      this.credentials = {
        accessToken: data.accessToken,
        mdAccessToken: data.mdAccessToken,
        expirationTime: Date.now() + (data.expiresIn * 1000),
        userId: user.id,
      };
      
      // Store in browser for session persistence
      sessionStorage.setItem('tradovate_credentials', JSON.stringify(this.credentials));
      
      // Connect websocket
      this.connectWebsocket();
    } catch (error) {
      console.error('Authentication error:', error);
      throw error;
    }
  }
  
  /**
   * Connect to Tradovate websocket for real-time data
   */
  private connectWebsocket(): void {
    if (!this.credentials) {
      throw new Error('Not authenticated');
    }
    
    // Close existing connection if any
    if (this.websocket) {
      this.websocket.close();
    }
    
    this.websocket = new WebSocket('wss://md.tradovate.com/v1/websocket');
    
    this.websocket.onopen = () => {
      console.log('WebSocket connected');
      this.authorizeWebsocket();
    };
    
    this.websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleWebsocketMessage(data);
    };
    
    this.websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    this.websocket.onclose = () => {
      console.log('WebSocket closed');
      // Attempt to reconnect after delay
      setTimeout(() => this.connectWebsocket(), 5000);
    };
  }
  
  /**
   * Authorize the websocket connection
   */
  private authorizeWebsocket(): void {
    if (!this.websocket || !this.credentials) return;
    
    const authMessage = {
      command: 'authorize',
      payload: {
        token: this.credentials.mdAccessToken,
      },
    };
    
    this.websocket.send(JSON.stringify(authMessage));
    
    // Resubscribe to active subscriptions
    this.resubscribeToAll();
  }
  
  /**
   * Resubscribe to all active subscriptions after reconnect
   */
  private resubscribeToAll(): void {
    // Resubscribe to positions
    this.positionSubscriptions.forEach((id, symbol) => {
      this.subscribeToPositionUpdates(symbol);
    });
    
    // Resubscribe to charts
    this.chartSubscriptions.forEach((id, symbol) => {
      // Get the callback for this symbol
      const callback = this.chartDataCallbacks.get(symbol);
      if (callback) {
        this.subscribeToChartData(symbol, '1m', callback);
      }
    });
  }
  
  /**
   * Handle websocket messages
   */
  private handleWebsocketMessage(data: any): void {
    if (data.e === 'md') {
      // Market data message
      if (data.d && data.d.symbol) {
        const symbolKey = data.d.symbol;
        const callback = this.chartDataCallbacks.get(symbolKey);
        
        if (callback && data.d.chart) {
          const chartData: TradovateChartData = {
            timestamp: data.d.chart.timestamp,
            open: data.d.chart.open,
            high: data.d.chart.high,
            low: data.d.chart.low,
            close: data.d.chart.close,
            volume: data.d.chart.volume || 0,
          };
          
          callback(chartData);
        }
      }
    } else if (data.e === 'position') {
      // Position update
      // Handle position updates and store in state
      this.handlePositionUpdate(data.d);
    }
  }
  
  /**
   * Handle position updates
   */
  private async handlePositionUpdate(position: any): Promise<void> {
    try {
      // Store position update in database for tracking
      const { error } = await supabase
        .from('positions')
        .upsert({
          user_id: this.credentials?.userId,
          broker: 'Tradovate',
          account_id: position.accountId,
          symbol: position.symbol,
          quantity: position.netPos,
          entry_price: position.netPrice,
          unrealized_pnl: position.unrealizedPnl,
          timestamp: new Date().toISOString(),
        });
      
      if (error) {
        console.error('Error storing position update:', error);
      }
    } catch (error) {
      console.error('Error handling position update:', error);
    }
  }
  
  /**
   * Get user accounts
   */
  async getAccounts(): Promise<TradovateAccount[]> {
    if (!this.credentials) {
      throw new Error('Not authenticated');
    }
    
    try {
      const response = await fetch('https://live.tradovate.com/v1/account/list', {
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch accounts');
      }
      
      const data = await response.json();
      
      return data.map((account: any) => ({
        id: account.id.toString(),
        name: account.name,
        accountId: account.accountId,
        accountType: account.accountType,
        active: account.active,
        balance: account.balance,
        currency: account.currency || 'USD',
      }));
    } catch (error) {
      console.error('Error fetching accounts:', error);
      throw error;
    }
  }
  
  /**
   * Get positions
   */
  async getPositions(accountId: string): Promise<TradovatePosition[]> {
    if (!this.credentials) {
      throw new Error('Not authenticated');
    }
    
    try {
      const response = await fetch(`https://live.tradovate.com/v1/position/list?accountId=${accountId}`, {
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch positions');
      }
      
      const data = await response.json();
      
      return data.map((position: any) => ({
        id: position.id.toString(),
        accountId: position.accountId.toString(),
        contractId: position.contractId.toString(),
        symbol: position.symbol,
        netPos: position.netPos,
        netPrice: position.netPrice,
        timestamp: position.timestamp,
        unrealizedPnl: position.unrealizedPnl,
      }));
    } catch (error) {
      console.error('Error fetching positions:', error);
      throw error;
    }
  }
  
  /**
   * Get orders
   */
  async getOrders(accountId: string): Promise<TradovateOrder[]> {
    if (!this.credentials) {
      throw new Error('Not authenticated');
    }
    
    try {
      const response = await fetch(`https://live.tradovate.com/v1/order/list?accountId=${accountId}`, {
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }
      
      const data = await response.json();
      
      return data.map((order: any) => ({
        id: order.id.toString(),
        accountId: order.accountId.toString(),
        ordStatus: order.ordStatus,
        symbol: order.symbol,
        orderQty: order.orderQty,
        filledQty: order.filledQty || 0,
        limitPrice: order.limitPrice,
        stopPrice: order.stopPrice,
        orderType: order.orderType,
        timeInForce: order.timeInForce,
        timestamp: order.timestamp,
      }));
    } catch (error) {
      console.error('Error fetching orders:', error);
      throw error;
    }
  }
  
  /**
   * Place a new order
   */
  async placeOrder(accountId: string, symbol: string, orderQty: number, orderType: string, 
                  side: 'Buy' | 'Sell', limitPrice?: number, stopPrice?: number): Promise<any> {
    if (!this.credentials) {
      throw new Error('Not authenticated');
    }
    
    try {
      // Check if user has Pro membership for live trading
      const isProMember = await this.brokerService.checkProMembership();
      
      if (!isProMember) {
        throw new Error('Live trading requires a Pro membership');
      }
      
      const orderData: any = {
        accountId,
        symbol,
        orderQty,
        orderType,
        side,
        timeInForce: 'Day',
      };
      
      if (limitPrice !== undefined) {
        orderData.limitPrice = limitPrice;
      }
      
      if (stopPrice !== undefined) {
        orderData.stopPrice = stopPrice;
      }
      
      const response = await fetch('https://live.tradovate.com/v1/order/placeOrder', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to place order');
      }
      
      return response.json();
    } catch (error) {
      console.error('Error placing order:', error);
      throw error;
    }
  }
  
  /**
   * Subscribe to position updates for a symbol
   */
  subscribeToPositionUpdates(symbol: string): void {
    if (!this.websocket || !this.credentials) {
      throw new Error('Not connected');
    }
    
    const subscriptionMessage = {
      command: 'subscribe',
      payload: {
        symbol,
        fields: ['position'],
      },
    };
    
    this.websocket.send(JSON.stringify(subscriptionMessage));
    
    // Store subscription ID
    const subId = Date.now();
    this.positionSubscriptions.set(symbol, subId);
  }
  
  /**
   * Subscribe to chart data for a symbol
   */
  subscribeToChartData(symbol: string, timeframe: string, 
                      callback: (data: TradovateChartData) => void): void {
    if (!this.websocket || !this.credentials) {
      throw new Error('Not connected');
    }
    
    const subscriptionMessage = {
      command: 'subscribe',
      payload: {
        symbol,
        timeframe,
        fields: ['chart'],
      },
    };
    
    this.websocket.send(JSON.stringify(subscriptionMessage));
    
    // Store subscription ID and callback
    const subId = Date.now();
    this.chartSubscriptions.set(symbol, subId);
    this.chartDataCallbacks.set(symbol, callback);
  }
  
  /**
   * Unsubscribe from chart data
   */
  unsubscribeFromChartData(symbol: string): void {
    if (!this.websocket || !this.credentials) return;
    
    const subId = this.chartSubscriptions.get(symbol);
    if (!subId) return;
    
    const unsubscribeMessage = {
      command: 'unsubscribe',
      payload: {
        symbol,
        fields: ['chart'],
      },
    };
    
    this.websocket.send(JSON.stringify(unsubscribeMessage));
    
    // Remove subscriptions
    this.chartSubscriptions.delete(symbol);
    this.chartDataCallbacks.delete(symbol);
  }
  
  /**
   * Get historical chart data
   */
  async getHistoricalData(symbol: string, timeframe: string, 
                         startDate: Date, endDate: Date): Promise<TradovateChartData[]> {
    if (!this.credentials) {
      throw new Error('Not authenticated');
    }
    
    try {
      const response = await fetch(`https://live.tradovate.com/v1/md/chart?symbol=${symbol}&timeframe=${timeframe}&start=${startDate.toISOString()}&end=${endDate.toISOString()}`, {
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch historical data');
      }
      
      const data = await response.json();
      
      return data.map((bar: any) => ({
        timestamp: new Date(bar.timestamp).getTime(),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume || 0,
      }));
    } catch (error) {
      console.error('Error fetching historical data:', error);
      throw error;
    }
  }
  
  /**
   * Get recent trades
   */
  async getTrades(accountId: string): Promise<TradovateTrade[]> {
    if (!this.credentials) {
      throw new Error('Not authenticated');
    }
    
    try {
      const response = await fetch(`https://live.tradovate.com/v1/fill/list?accountId=${accountId}`, {
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch trades');
      }
      
      const data = await response.json();
      
      // Transform the data into our format with matching entry/exit pairs
      const trades: TradovateTrade[] = [];
      const openTrades: Record<string, any> = {};
      
      data.forEach((fill: any) => {
        // Check if this is an exit for an existing open trade
        const key = `${fill.symbol}-${fill.side === 'Buy' ? 'Sell' : 'Buy'}`;
        
        if (openTrades[key] && openTrades[key].orderQty === fill.fillQty) {
          // This is an exit for an open trade
          const entry = openTrades[key];
          
          trades.push({
            id: `${entry.id}-${fill.id}`,
            accountId: entry.accountId.toString(),
            entryTime: entry.timestamp,
            exitTime: fill.timestamp,
            symbol: entry.symbol,
            orderQty: entry.fillQty,
            entryPrice: entry.avgPrice,
            exitPrice: fill.avgPrice,
            realizedPnl: fill.side === 'Sell' 
              ? (fill.avgPrice - entry.avgPrice) * fill.fillQty
              : (entry.avgPrice - fill.avgPrice) * fill.fillQty,
            side: entry.side,
            status: 'Closed',
          });
          
          delete openTrades[key];
        } else {
          // This is a new entry
          const newKey = `${fill.symbol}-${fill.side}`;
          
          openTrades[newKey] = {
            id: fill.id,
            accountId: fill.accountId,
            timestamp: fill.timestamp,
            symbol: fill.symbol,
            fillQty: fill.fillQty,
            avgPrice: fill.avgPrice,
            side: fill.side,
          };
          
          // Also add to trades as an open position
          trades.push({
            id: fill.id.toString(),
            accountId: fill.accountId.toString(),
            entryTime: fill.timestamp,
            exitTime: null,
            symbol: fill.symbol,
            orderQty: fill.fillQty,
            entryPrice: fill.avgPrice,
            exitPrice: null,
            realizedPnl: 0,
            side: fill.side,
            status: 'Open',
          });
        }
      });
      
      return trades;
    } catch (error) {
      console.error('Error fetching trades:', error);
      throw error;
    }
  }
  
  /**
   * Check if the service is authenticated
   */
  isAuthenticated(): boolean {
    if (!this.credentials) {
      // Try to load from session storage
      const storedCredentials = sessionStorage.getItem('tradovate_credentials');
      if (storedCredentials) {
        this.credentials = JSON.parse(storedCredentials);
      }
    }
    
    return !!this.credentials && this.credentials.expirationTime > Date.now();
  }
  
  /**
   * Place a stop loss order for an existing position
   */
  async placeStopLoss(accountId: string, symbol: string, positionQty: number, 
                     stopPrice: number): Promise<any> {
    const side = positionQty > 0 ? 'Sell' : 'Buy';
    const qty = Math.abs(positionQty);
    
    return this.placeOrder(accountId, symbol, qty, 'Stop', side, undefined, stopPrice);
  }
  
  /**
   * Place a take profit order for an existing position
   */
  async placeTakeProfit(accountId: string, symbol: string, positionQty: number, 
                       limitPrice: number): Promise<any> {
    const side = positionQty > 0 ? 'Sell' : 'Buy';
    const qty = Math.abs(positionQty);
    
    return this.placeOrder(accountId, symbol, qty, 'Limit', side, limitPrice);
  }
  
  /**
   * Close an open position
   */
  async closePosition(accountId: string, symbol: string, positionQty: number): Promise<any> {
    const side = positionQty > 0 ? 'Sell' : 'Buy';
    const qty = Math.abs(positionQty);
    
    return this.placeOrder(accountId, symbol, qty, 'Market', side);
  }
  
  /**
   * Cancel an open order
   */
  async cancelOrder(orderId: string): Promise<any> {
    if (!this.credentials) {
      throw new Error('Not authenticated');
    }
    
    try {
      const response = await fetch('https://live.tradovate.com/v1/order/cancelOrder', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to cancel order');
      }
      
      return response.json();
    } catch (error) {
      console.error('Error canceling order:', error);
      throw error;
    }
  }
  
  /**
   * Sync trades from Tradovate to 0nyx database
   */
  async syncTrades(): Promise<void> {
    if (!this.credentials) {
      throw new Error('Not authenticated');
    }
    
    try {
      // Check if user has Pro membership
      const isProMember = await this.brokerService.checkProMembership();
      
      if (!isProMember) {
        throw new Error('This feature requires a Pro membership');
      }
      
      // Get all accounts
      const accounts = await this.getAccounts();
      
      // Get trades from all accounts
      for (const account of accounts) {
        const trades = await this.getTrades(account.id);
        
        // Process closed trades only
        const closedTrades = trades.filter(trade => trade.status === 'Closed');
        
        // Format trades for our database
        const processedTrades = closedTrades.map(trade => ({
          user_id: this.credentials?.userId,
          broker: 'Tradovate',
          account_id: trade.accountId,
          symbol: trade.symbol,
          position: trade.side === 'Buy' ? 'long' : 'short',
          side: trade.side === 'Buy' ? 'buy' : 'sell',
          quantity: trade.orderQty,
          entry_price: trade.entryPrice,
          exit_price: trade.exitPrice,
          pnl: trade.realizedPnl,
          date: new Date(trade.entryTime).toISOString().split('T')[0],
          entry_date: new Date(trade.entryTime).toISOString(),
          exit_date: trade.exitTime ? new Date(trade.exitTime).toISOString() : null,
          broker_trade_id: trade.id,
          fees: 0, // Tradovate doesn't provide fees in API
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));
        
        // Insert into database
        if (processedTrades.length > 0) {
          const { error } = await supabase
            .from('trades')
            .upsert(processedTrades, {
              onConflict: 'broker_trade_id',
            });
          
          if (error) {
            console.error('Error syncing trades:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error syncing trades:', error);
      throw error;
    }
  }
} 