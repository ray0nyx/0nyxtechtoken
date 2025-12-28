import { createClient } from './supabase/client';
import { getRealTimePrice } from './realtime-price-service';
import { executeMarketOrder, updateOrderStatus as updateOrderStatusInDb } from './trading-order-service';
import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import type { TradingOrder } from '@/components/crypto/TradingPanel';

interface MonitoredOrder {
  id: string;
  pair: string;
  orderType: 'stop_loss' | 'take_profit';
  side: 'buy' | 'sell';
  stopPrice?: number;
  takeProfitPrice?: number;
  amount: number;
  executionMethod: 'onchain' | 'exchange';
  userId: string;
  walletAddress?: string;
}

/**
 * Monitor orders and execute when price conditions are met
 */
export class OrderMonitorService {
  private monitoringInterval: ReturnType<typeof setInterval> | null = null;
  private isMonitoring = false;
  private monitoredOrders: Map<string, MonitoredOrder> = new Map();

  /**
   * Start monitoring orders
   */
  startMonitoring(
    connection?: Connection,
    signTransaction?: (tx: VersionedTransaction) => Promise<VersionedTransaction>
  ): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    
    // Poll every 5 seconds to check order conditions
    this.monitoringInterval = setInterval(async () => {
      await this.checkOrders(connection, signTransaction);
    }, 5000);

    // Initial check
    this.checkOrders(connection, signTransaction);
  }

  /**
   * Stop monitoring orders
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
  }

  /**
   * Add order to monitoring
   */
  addOrder(order: MonitoredOrder): void {
    this.monitoredOrders.set(order.id, order);
  }

  /**
   * Remove order from monitoring
   */
  removeOrder(orderId: string): void {
    this.monitoredOrders.delete(orderId);
  }

  /**
   * Check all monitored orders and execute if conditions are met
   */
  private async checkOrders(
    connection?: Connection,
    signTransaction?: (tx: VersionedTransaction) => Promise<VersionedTransaction>
  ): Promise<void> {
    if (this.monitoredOrders.size === 0) {
      return;
    }

    const supabase = createClient();

    for (const [orderId, order] of this.monitoredOrders.entries()) {
      try {
        // Get current price
        const priceUpdate = await getRealTimePrice(order.pair, true);
        if (!priceUpdate || priceUpdate.price <= 0) {
          continue;
        }

        const currentPrice = priceUpdate.price;
        let shouldExecute = false;

        // Check stop-loss condition
        if (order.orderType === 'stop_loss' && order.stopPrice) {
          if (order.side === 'sell') {
            // Sell stop-loss: execute if price drops below stop price
            shouldExecute = currentPrice <= order.stopPrice;
          } else {
            // Buy stop-loss: execute if price rises above stop price
            shouldExecute = currentPrice >= order.stopPrice;
          }
        }

        // Check take-profit condition
        if (order.orderType === 'take_profit' && order.takeProfitPrice) {
          if (order.side === 'sell') {
            // Sell take-profit: execute if price rises above take-profit price
            shouldExecute = currentPrice >= order.takeProfitPrice;
          } else {
            // Buy take-profit: execute if price drops below take-profit price
            shouldExecute = currentPrice <= order.takeProfitPrice;
          }
        }

        if (shouldExecute) {
          // Execute the order as a market order
          const marketOrder: TradingOrder = {
            pair: order.pair,
            side: order.side,
            orderType: 'market',
            amount: order.amount,
            executionMethod: order.executionMethod,
            slippageBps: 50, // Default slippage
          };

          try {
            if (order.executionMethod === 'onchain' && connection && signTransaction) {
              await executeMarketOrder(
                marketOrder,
                order.userId,
                order.walletAddress,
                connection,
                signTransaction
              );
            } else {
              // For exchange orders, mark as submitted (would need exchange service)
              await updateOrderStatusInDb(orderId, 'submitted');
            }

            // Remove from monitoring
            this.removeOrder(orderId);
          } catch (error: any) {
            console.error(`Error executing monitored order ${orderId}:`, error);
            // Update order status to rejected
            await updateOrderStatusInDb(orderId, 'rejected', {
              error: error.message,
            });
            this.removeOrder(orderId);
          }
        }
      } catch (error) {
        console.error(`Error checking order ${orderId}:`, error);
      }
    }
  }

  /**
   * Load pending orders from database and start monitoring
   */
  async loadPendingOrders(
    userId: string,
    connection?: Connection,
    signTransaction?: (tx: VersionedTransaction) => Promise<VersionedTransaction>
  ): Promise<void> {
    const supabase = createClient();

    const { data: orders, error } = await supabase
      .from('trading_orders')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .in('order_type', ['stop_loss', 'take_profit']);

    if (error) {
      console.error('Error loading pending orders:', error);
      return;
    }

    if (!orders || orders.length === 0) {
      return;
    }

    // Add orders to monitoring
    for (const order of orders) {
      this.addOrder({
        id: order.id,
        pair: order.pair,
        orderType: order.order_type,
        side: order.side,
        stopPrice: order.stop_price,
        takeProfitPrice: order.take_profit_price,
        amount: parseFloat(order.amount),
        executionMethod: order.execution_method,
        userId: order.user_id,
        walletAddress: order.wallet_address,
      });
    }

    // Start monitoring if not already started
    if (!this.isMonitoring) {
      this.startMonitoring(connection, signTransaction);
    }
  }
}

// Singleton instance
export const orderMonitorService = new OrderMonitorService();


