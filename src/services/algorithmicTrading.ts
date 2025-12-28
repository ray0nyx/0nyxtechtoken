import { supabase } from '@/lib/supabase';

export interface Order {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  orderType: 'market' | 'limit' | 'stop' | 'stop_limit';
  price?: number;
  stopPrice?: number;
  timeInForce: 'GTC' | 'IOC' | 'FOK' | 'DAY';
  strategy: string;
  status: 'pending' | 'submitted' | 'filled' | 'cancelled' | 'rejected';
  createdAt: string;
  updatedAt: string;
  filledAt?: string;
  filledPrice?: number;
  filledQuantity?: number;
  remainingQuantity?: number;
  fees?: number;
  metadata?: Record<string, any>;
}

export interface AlgorithmicStrategy {
  id: string;
  name: string;
  type: 'TWAP' | 'VWAP' | 'Iceberg' | 'POV' | 'Implementation_Shortfall' | 'Custom';
  description: string;
  parameters: Record<string, any>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SmartOrderRouting {
  id: string;
  orderId: string;
  venue: string;
  priority: number;
  allocation: number;
  status: 'pending' | 'routed' | 'filled' | 'cancelled';
  executionPrice?: number;
  executionTime?: string;
  latency?: number;
  slippage?: number;
  venueFees?: number;
}

export interface MarketData {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume: number;
  timestamp: string;
  source: string;
  marketCap?: number;
  volatility?: number;
  spread?: number;
}

export interface AlternativeData {
  id: string;
  type: 'sentiment' | 'news' | 'satellite' | 'social' | 'economic' | 'weather';
  symbol: string;
  value: number;
  confidence: number;
  timestamp: string;
  source: string;
  metadata?: Record<string, any>;
}

export class AlgorithmicTradingService {
  // TWAP (Time-Weighted Average Price) Strategy
  static async executeTWAP(
    symbol: string,
    quantity: number,
    duration: number, // in minutes
    interval: number, // in minutes
    userId: string
  ): Promise<Order[]> {
    const orders: Order[] = [];
    const totalIntervals = Math.floor(duration / interval);
    const quantityPerInterval = Math.floor(quantity / totalIntervals);
    
    for (let i = 0; i < totalIntervals; i++) {
      const order: Order = {
        id: `twap_${Date.now()}_${i}`,
        symbol,
        side: quantity > 0 ? 'buy' : 'sell',
        quantity: Math.abs(quantityPerInterval),
        orderType: 'market',
        timeInForce: 'GTC',
        strategy: 'TWAP',
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          twapDuration: duration,
          twapInterval: interval,
          twapSegment: i + 1,
          twapTotalSegments: totalIntervals
        }
      };
      
      orders.push(order);
    }
    
    // Store orders in database
    await this.storeOrders(orders, userId);
    
    return orders;
  }

  // VWAP (Volume-Weighted Average Price) Strategy
  static async executeVWAP(
    symbol: string,
    quantity: number,
    startTime: string,
    endTime: string,
    userId: string
  ): Promise<Order[]> {
    // Get historical volume data for VWAP calculation
    const { data: historicalData } = await supabase
      .from('trades')
      .select('price, quantity, created_at')
      .eq('symbol', symbol)
      .gte('created_at', startTime)
      .lte('created_at', endTime)
      .order('created_at', { ascending: true });

    if (!historicalData || historicalData.length === 0) {
      throw new Error('No historical data available for VWAP calculation');
    }

    // Calculate VWAP
    const totalVolume = historicalData.reduce((sum, trade) => sum + Number(trade.quantity), 0);
    const totalValue = historicalData.reduce((sum, trade) => sum + (Number(trade.price) * Number(trade.quantity)), 0);
    const vwap = totalValue / totalVolume;

    // Create VWAP orders
    const orders: Order[] = [];
    const intervals = 10; // Split into 10 intervals
    const quantityPerInterval = Math.floor(quantity / intervals);
    
    for (let i = 0; i < intervals; i++) {
      const order: Order = {
        id: `vwap_${Date.now()}_${i}`,
        symbol,
        side: quantity > 0 ? 'buy' : 'sell',
        quantity: Math.abs(quantityPerInterval),
        orderType: 'limit',
        price: vwap,
        timeInForce: 'GTC',
        strategy: 'VWAP',
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          vwapPrice: vwap,
          vwapStartTime: startTime,
          vwapEndTime: endTime,
          vwapSegment: i + 1,
          vwapTotalSegments: intervals
        }
      };
      
      orders.push(order);
    }
    
    await this.storeOrders(orders, userId);
    return orders;
  }

  // Iceberg Order Strategy
  static async executeIceberg(
    symbol: string,
    totalQuantity: number,
    visibleQuantity: number,
    price: number,
    userId: string
  ): Promise<Order[]> {
    const orders: Order[] = [];
    const totalOrders = Math.ceil(totalQuantity / visibleQuantity);
    
    for (let i = 0; i < totalOrders; i++) {
      const remainingQuantity = totalQuantity - (i * visibleQuantity);
      const currentQuantity = Math.min(visibleQuantity, remainingQuantity);
      
      const order: Order = {
        id: `iceberg_${Date.now()}_${i}`,
        symbol,
        side: totalQuantity > 0 ? 'buy' : 'sell',
        quantity: Math.abs(currentQuantity),
        orderType: 'limit',
        price,
        timeInForce: 'GTC',
        strategy: 'Iceberg',
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          icebergTotalQuantity: totalQuantity,
          icebergVisibleQuantity: visibleQuantity,
          icebergSegment: i + 1,
          icebergTotalSegments: totalOrders
        }
      };
      
      orders.push(order);
    }
    
    await this.storeOrders(orders, userId);
    return orders;
  }

  // Smart Order Routing
  static async routeOrder(order: Order, venues: string[]): Promise<SmartOrderRouting[]> {
    const routings: SmartOrderRouting[] = [];
    
    // Simple routing logic - can be enhanced with more sophisticated algorithms
    const allocationPerVenue = 1 / venues.length;
    
    for (let i = 0; i < venues.length; i++) {
      const routing: SmartOrderRouting = {
        id: `routing_${order.id}_${i}`,
        orderId: order.id,
        venue: venues[i],
        priority: i + 1,
        allocation: allocationPerVenue,
        status: 'pending'
      };
      
      routings.push(routing);
    }
    
    return routings;
  }

  // Pre-trade Risk Checks
  static async preTradeRiskCheck(order: Order, userId: string): Promise<{
    passed: boolean;
    warnings: string[];
    errors: string[];
  }> {
    const warnings: string[] = [];
    const errors: string[] = [];
    
    try {
      // Check position limits
      const { data: positions } = await supabase
        .from('trades')
        .select('symbol, quantity, side')
        .eq('user_id', userId)
        .eq('symbol', order.symbol);
      
      if (positions) {
        const currentPosition = positions.reduce((sum, trade) => {
          const qty = Number(trade.quantity);
          return sum + (trade.side === 'buy' ? qty : -qty);
        }, 0);
        
        const newPosition = currentPosition + (order.side === 'buy' ? order.quantity : -order.quantity);
        
        // Check position size limits (example: max 10% of portfolio)
        if (Math.abs(newPosition) > 1000) { // Example limit
          warnings.push(`Position size will exceed limit: ${Math.abs(newPosition)}`);
        }
      }
      
      // Check daily trading limits
      const today = new Date().toISOString().split('T')[0];
      const { data: todayTrades } = await supabase
        .from('trades')
        .select('quantity, price')
        .eq('user_id', userId)
        .gte('created_at', `${today}T00:00:00Z`)
        .lte('created_at', `${today}T23:59:59Z`);
      
      if (todayTrades) {
        const todayVolume = todayTrades.reduce((sum, trade) => 
          sum + (Number(trade.quantity) * Number(trade.price)), 0);
        
        if (todayVolume > 100000) { // Example daily limit
          warnings.push('Daily trading volume limit approaching');
        }
      }
      
      // Check market hours (simplified)
      const now = new Date();
      const hour = now.getHours();
      if (hour < 9 || hour > 16) {
        warnings.push('Trading outside market hours');
      }
      
      return {
        passed: errors.length === 0,
        warnings,
        errors
      };
      
    } catch (error) {
      return {
        passed: false,
        warnings: [],
        errors: ['Risk check failed: ' + error]
      };
    }
  }

  // Post-trade Analysis (TCA)
  static async postTradeAnalysis(order: Order): Promise<{
    slippage: number;
    marketImpact: number;
    implementationShortfall: number;
    venuePerformance: number;
  }> {
    // Simplified TCA calculation
    const slippage = order.filledPrice ? 
      Math.abs(order.filledPrice - (order.price || 0)) / (order.price || 1) : 0;
    
    const marketImpact = order.filledQuantity ? 
      (order.filledQuantity / 10000) * 0.001 : 0; // Simplified calculation
    
    const implementationShortfall = slippage + marketImpact;
    
    const venuePerformance = Math.random() * 100; // Placeholder
    
    return {
      slippage,
      marketImpact,
      implementationShortfall,
      venuePerformance
    };
  }

  // Store orders in database
  static async storeOrders(orders: Order[], userId: string): Promise<void> {
    const orderData = orders.map(order => ({
      id: order.id,
      user_id: userId,
      symbol: order.symbol,
      side: order.side,
      quantity: order.quantity,
      order_type: order.orderType,
      price: order.price,
      stop_price: order.stopPrice,
      time_in_force: order.timeInForce,
      strategy: order.strategy,
      status: order.status,
      created_at: order.createdAt,
      updated_at: order.updatedAt,
      metadata: order.metadata
    }));
    
    const { error } = await supabase
      .from('algorithmic_orders')
      .insert(orderData);
    
    if (error) {
      console.error('Error storing orders:', error);
      throw error;
    }
  }

  // Get user's algorithmic strategies
  static async getUserStrategies(userId: string): Promise<AlgorithmicStrategy[]> {
    const { data, error } = await supabase
      .from('algorithmic_strategies')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching strategies:', error);
      return [];
    }
    
    return data || [];
  }

  // Create new algorithmic strategy
  static async createStrategy(
    userId: string,
    strategy: Omit<AlgorithmicStrategy, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<AlgorithmicStrategy> {
    const newStrategy: AlgorithmicStrategy = {
      ...strategy,
      id: `strategy_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const { error } = await supabase
      .from('algorithmic_strategies')
      .insert({
        id: newStrategy.id,
        user_id: userId,
        name: newStrategy.name,
        type: newStrategy.type,
        description: newStrategy.description,
        parameters: newStrategy.parameters,
        is_active: newStrategy.isActive,
        created_at: newStrategy.createdAt,
        updated_at: newStrategy.updatedAt
      });
    
    if (error) {
      console.error('Error creating strategy:', error);
      throw error;
    }
    
    return newStrategy;
  }

  // Get order execution statistics
  static async getExecutionStats(userId: string, timeRange: string = '7d'): Promise<{
    totalOrders: number;
    filledOrders: number;
    cancelledOrders: number;
    averageSlippage: number;
    averageLatency: number;
    fillRate: number;
  }> {
    const { data: orders } = await supabase
      .from('algorithmic_orders')
      .select('*')
      .eq('user_id', userId);
    
    if (!orders) {
      return {
        totalOrders: 0,
        filledOrders: 0,
        cancelledOrders: 0,
        averageSlippage: 0,
        averageLatency: 0,
        fillRate: 0
      };
    }
    
    const filledOrders = orders.filter(o => o.status === 'filled');
    const cancelledOrders = orders.filter(o => o.status === 'cancelled');
    
    const averageSlippage = filledOrders.length > 0 ? 
      filledOrders.reduce((sum, order) => sum + (order.metadata?.slippage || 0), 0) / filledOrders.length : 0;
    
    const averageLatency = filledOrders.length > 0 ?
      filledOrders.reduce((sum, order) => sum + (order.metadata?.latency || 0), 0) / filledOrders.length : 0;
    
    return {
      totalOrders: orders.length,
      filledOrders: filledOrders.length,
      cancelledOrders: cancelledOrders.length,
      averageSlippage,
      averageLatency,
      fillRate: orders.length > 0 ? filledOrders.length / orders.length : 0
    };
  }
}
