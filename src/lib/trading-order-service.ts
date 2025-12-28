import { createClient } from './supabase/client';
import { performSwap } from './jupiter-swap-service';
import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { TradingOrder, OrderType, OrderSide, ExecutionMethod } from '@/components/crypto/TradingPanel';

export interface OrderStatus {
  id: string;
  status: 'pending' | 'submitted' | 'filled' | 'cancelled' | 'rejected';
  filledPrice?: number;
  filledQuantity?: number;
  transactionHash?: string;
  error?: string;
}

/**
 * Create a trading order and store it in the database
 */
export async function createOrder(
  order: TradingOrder,
  userId: string,
  walletAddress?: string
): Promise<string> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('trading_orders')
    .insert({
      user_id: userId,
      pair: order.pair,
      side: order.side,
      order_type: order.orderType,
      amount: order.amount,
      price: order.price,
      stop_price: order.stopPrice,
      take_profit_price: order.takeProfitPrice,
      execution_method: order.executionMethod,
      exchange_name: order.exchangeName,
      wallet_address: walletAddress,
      slippage_bps: order.slippageBps,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create order: ${error.message}`);
  }

  return data.id;
}

/**
 * Execute a market order immediately
 */
export async function executeMarketOrder(
  order: TradingOrder,
  userId: string,
  walletAddress?: string,
  connection?: Connection
): Promise<OrderStatus> {
  const orderId = await createOrder(order, userId, walletAddress);
  
  try {
    if (order.executionMethod === 'onchain') {
      if (!walletAddress || !connection) {
        throw new Error('Wallet address and connection required for on-chain orders');
      }

      // Execute via Jupiter
      const [baseToken, quoteToken = 'USDC'] = order.pair.split('/');
      const result = await executeJupiterSwap(
        quoteToken,
        baseToken,
        order.amount,
        order.slippageBps,
        connection,
        new PublicKey(walletAddress)
      );

      // Update order status
      await updateOrderStatus(orderId, 'filled', {
        transactionHash: result.transactionSignature,
        filledPrice: result.price,
        filledQuantity: order.amount,
      });

      return {
        id: orderId,
        status: 'filled',
        filledPrice: result.price,
        filledQuantity: order.amount,
        transactionHash: result.transactionSignature,
      };
    } else {
      // Exchange API execution
      // This would call the exchange service
      // For now, mark as submitted (would need exchange connection)
      await updateOrderStatus(orderId, 'submitted');
      return {
        id: orderId,
        status: 'submitted',
      };
    }
  } catch (error: any) {
    await updateOrderStatus(orderId, 'rejected', {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Create a limit order (stored, not executed immediately)
 */
export async function createLimitOrder(
  order: TradingOrder,
  userId: string,
  walletAddress?: string
): Promise<string> {
  if (order.orderType !== 'limit') {
    throw new Error('Order type must be limit');
  }

  return await createOrder(order, userId, walletAddress);
}

/**
 * Create a stop-loss order
 */
export async function createStopLossOrder(
  order: TradingOrder,
  userId: string,
  walletAddress?: string
): Promise<string> {
  if (order.orderType !== 'stop_loss') {
    throw new Error('Order type must be stop_loss');
  }

  return await createOrder(order, userId, walletAddress);
}

/**
 * Create a take-profit order
 */
export async function createTakeProfitOrder(
  order: TradingOrder,
  userId: string,
  walletAddress?: string
): Promise<string> {
  if (order.orderType !== 'take_profit') {
    throw new Error('Order type must be take_profit');
  }

  return await createOrder(order, userId, walletAddress);
}

/**
 * Update order status
 */
export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus['status'],
  updates?: {
    filledPrice?: number;
    filledQuantity?: number;
    transactionHash?: string;
    error?: string;
  }
): Promise<void> {
  const supabase = createClient();

  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === 'filled') {
    updateData.filled_at = new Date().toISOString();
    if (updates?.filledPrice) updateData.filled_price = updates.filledPrice;
    if (updates?.filledQuantity) updateData.filled_quantity = updates.filledQuantity;
  }

  if (updates?.transactionHash) {
    updateData.transaction_hash = updates.transactionHash;
  }

  if (updates?.error) {
    updateData.error_message = updates.error;
  }

  const { error } = await supabase
    .from('trading_orders')
    .update(updateData)
    .eq('id', orderId);

  if (error) {
    throw new Error(`Failed to update order status: ${error.message}`);
  }
}

/**
 * Cancel an order
 */
export async function cancelOrder(orderId: string, userId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('trading_orders')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to cancel order: ${error.message}`);
  }
}

/**
 * Get user's orders
 */
export async function getUserOrders(
  userId: string,
  status?: OrderStatus['status']
): Promise<any[]> {
  const supabase = createClient();

  let query = supabase
    .from('trading_orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch orders: ${error.message}`);
  }

  return data || [];
}

// Order monitoring types
export interface MonitoredOrder {
  orderId: string;
  type: 'limit' | 'stopLoss' | 'takeProfit';
  targetPrice: number;
  side: 'buy' | 'sell';
  amount: number;
  condition: 'above' | 'below'; // Trigger when price goes above or below target
}

type OrderMonitorCallback = (orderId: string, triggeredPrice: number) => void;

// Active order monitors
const activeMonitors = new Map<string, { 
  interval: ReturnType<typeof setInterval>;
  order: MonitoredOrder;
}>();

/**
 * Start monitoring an order for trigger conditions
 * @param order - The order to monitor
 * @param getCurrentPrice - Function to get current price
 * @param onTrigger - Callback when order triggers
 * @returns Cleanup function to stop monitoring
 */
export function startOrderMonitor(
  order: MonitoredOrder,
  getCurrentPrice: () => number | null,
  onTrigger: OrderMonitorCallback
): () => void {
  // Don't create duplicate monitors
  if (activeMonitors.has(order.orderId)) {
    console.warn('Monitor already exists for order:', order.orderId);
    return () => stopOrderMonitor(order.orderId);
  }

  // Determine trigger condition based on order type and side
  // - Limit buy: trigger when price goes BELOW target
  // - Limit sell: trigger when price goes ABOVE target
  // - Stop loss (sell): trigger when price goes BELOW target
  // - Take profit (sell): trigger when price goes ABOVE target
  const getCondition = (): 'above' | 'below' => {
    if (order.type === 'limit') {
      return order.side === 'buy' ? 'below' : 'above';
    } else if (order.type === 'stopLoss') {
      return 'below';
    } else { // takeProfit
      return 'above';
    }
  };

  const condition = order.condition || getCondition();

  // Check price every 2 seconds
  const interval = setInterval(() => {
    const currentPrice = getCurrentPrice();
    if (currentPrice === null) return;

    let triggered = false;
    if (condition === 'above' && currentPrice >= order.targetPrice) {
      triggered = true;
    } else if (condition === 'below' && currentPrice <= order.targetPrice) {
      triggered = true;
    }

    if (triggered) {
      console.log(`Order ${order.orderId} triggered at price ${currentPrice}`);
      stopOrderMonitor(order.orderId);
      onTrigger(order.orderId, currentPrice);
    }
  }, 2000);

  activeMonitors.set(order.orderId, { interval, order });
  console.log(`Started monitoring order ${order.orderId}, target: ${order.targetPrice}, condition: ${condition}`);

  return () => stopOrderMonitor(order.orderId);
}

/**
 * Stop monitoring an order
 */
export function stopOrderMonitor(orderId: string): void {
  const monitor = activeMonitors.get(orderId);
  if (monitor) {
    clearInterval(monitor.interval);
    activeMonitors.delete(orderId);
    console.log(`Stopped monitoring order ${orderId}`);
  }
}

/**
 * Stop all order monitors
 */
export function stopAllOrderMonitors(): void {
  activeMonitors.forEach((monitor, orderId) => {
    clearInterval(monitor.interval);
  });
  activeMonitors.clear();
  console.log('Stopped all order monitors');
}

/**
 * Get all active order monitors
 */
export function getActiveMonitors(): MonitoredOrder[] {
  return Array.from(activeMonitors.values()).map(m => m.order);
}

/**
 * Update a monitored order's target price
 */
export function updateOrderMonitor(
  orderId: string,
  newTargetPrice: number,
  getCurrentPrice: () => number | null,
  onTrigger: OrderMonitorCallback
): void {
  const monitor = activeMonitors.get(orderId);
  if (!monitor) {
    console.warn('No monitor found for order:', orderId);
    return;
  }

  // Stop existing monitor and restart with new price
  stopOrderMonitor(orderId);
  startOrderMonitor(
    { ...monitor.order, targetPrice: newTargetPrice },
    getCurrentPrice,
    onTrigger
  );
}

