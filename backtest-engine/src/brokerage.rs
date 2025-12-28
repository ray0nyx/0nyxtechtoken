//! Brokerage model for simulating order execution
//! 
//! Handles:
//! - Fees (maker/taker)
//! - Slippage (fixed and percentage-based)
//! - Margin requirements
//! - Order fill simulation

use crate::config::BrokerageConfig;
use crate::events::{Bar, FillEvent, OrderEvent, OrderStatus, OrderType, Side, EventId};
use chrono::{DateTime, Utc};
use rand::Rng;
use std::collections::HashMap;

/// Brokerage model that simulates realistic order execution
pub struct Brokerage {
    config: BrokerageConfig,
    
    /// Pending orders waiting to be filled
    pending_orders: HashMap<EventId, OrderEvent>,
    
    /// Event ID counter
    event_id: EventId,
}

impl Brokerage {
    pub fn new(config: BrokerageConfig) -> Self {
        Self {
            config,
            pending_orders: HashMap::new(),
            event_id: 0,
        }
    }

    /// Create with default configuration
    pub fn default_config() -> Self {
        Self::new(BrokerageConfig::default())
    }

    /// Submit an order for execution
    pub fn submit_order(&mut self, mut order: OrderEvent) -> OrderEvent {
        order.status = OrderStatus::Submitted;
        
        match order.order_type {
            OrderType::Market => {
                // Market orders go straight to pending
                order.status = OrderStatus::Pending;
            }
            OrderType::Limit | OrderType::Stop | OrderType::StopLimit => {
                // Limit/stop orders wait for price trigger
                order.status = OrderStatus::Pending;
                self.pending_orders.insert(order.id, order.clone());
            }
        }
        
        order
    }

    /// Process a market data bar and return any fills
    pub fn process_bar(&mut self, bar: &Bar, symbol: &str) -> Vec<FillEvent> {
        let mut fills = Vec::new();
        let mut orders_to_remove = Vec::new();
        
        for (order_id, order) in &self.pending_orders {
            if order.symbol != symbol {
                continue;
            }
            
            if let Some(fill) = self.try_fill_order(order, bar) {
                fills.push(fill);
                orders_to_remove.push(*order_id);
            }
        }
        
        for order_id in orders_to_remove {
            self.pending_orders.remove(&order_id);
        }
        
        fills
    }

    /// Try to execute a market order immediately
    pub fn execute_market_order(&mut self, order: &OrderEvent, bar: &Bar) -> Option<FillEvent> {
        if order.order_type != OrderType::Market {
            return None;
        }
        
        self.create_fill(order, bar, bar.close)
    }

    fn try_fill_order(&mut self, order: &OrderEvent, bar: &Bar) -> Option<FillEvent> {
        match order.order_type {
            OrderType::Market => {
                self.create_fill(order, bar, bar.close)
            }
            OrderType::Limit => {
                let limit_price = order.limit_price?;
                let can_fill = match order.side {
                    Side::Buy => bar.low <= limit_price,
                    Side::Sell => bar.high >= limit_price,
                };
                
                if can_fill {
                    self.create_fill(order, bar, limit_price)
                } else {
                    None
                }
            }
            OrderType::Stop => {
                let stop_price = order.stop_price?;
                let triggered = match order.side {
                    Side::Buy => bar.high >= stop_price,
                    Side::Sell => bar.low <= stop_price,
                };
                
                if triggered {
                    // Stop becomes market order, fill at market
                    self.create_fill(order, bar, bar.close)
                } else {
                    None
                }
            }
            OrderType::StopLimit => {
                let stop_price = order.stop_price?;
                let limit_price = order.limit_price?;
                
                let triggered = match order.side {
                    Side::Buy => bar.high >= stop_price,
                    Side::Sell => bar.low <= stop_price,
                };
                
                if triggered {
                    // Check if limit price is achievable
                    let can_fill = match order.side {
                        Side::Buy => bar.low <= limit_price,
                        Side::Sell => bar.high >= limit_price,
                    };
                    
                    if can_fill {
                        self.create_fill(order, bar, limit_price)
                    } else {
                        None
                    }
                } else {
                    None
                }
            }
        }
    }

    fn create_fill(&mut self, order: &OrderEvent, bar: &Bar, base_price: f64) -> Option<FillEvent> {
        self.event_id += 1;
        
        // Calculate slippage
        let slippage = self.calculate_slippage(order, bar, base_price);
        
        // Calculate fill price with slippage
        let fill_price = match order.side {
            Side::Buy => base_price + slippage,
            Side::Sell => base_price - slippage,
        };
        
        // Calculate commission
        let commission = self.calculate_commission(order, fill_price);
        
        Some(FillEvent {
            id: self.event_id,
            order_id: order.id,
            timestamp: bar.timestamp,
            symbol: order.symbol.clone(),
            side: order.side,
            quantity: order.quantity,
            fill_price,
            commission,
            slippage,
        })
    }

    fn calculate_slippage(&self, order: &OrderEvent, bar: &Bar, base_price: f64) -> f64 {
        if !self.config.realistic_fills {
            return 0.0;
        }
        
        // Fixed slippage
        let fixed = self.config.slippage_fixed;
        
        // Percentage slippage
        let pct = base_price * self.config.slippage_pct;
        
        // Random component (simulate market impact)
        let mut rng = rand::thread_rng();
        let random_factor: f64 = rng.gen_range(0.5..1.5);
        
        // Volume-based impact (larger orders have more slippage)
        let volume_impact = if bar.volume > 0.0 {
            let order_pct = order.quantity / bar.volume;
            order_pct * base_price * 0.001  // 0.1% per 100% of volume
        } else {
            0.0
        };
        
        (fixed + pct + volume_impact) * random_factor
    }

    fn calculate_commission(&self, order: &OrderEvent, fill_price: f64) -> f64 {
        let trade_value = order.quantity * fill_price;
        
        // Use taker fee for market orders, maker fee for limit orders
        let fee_rate = match order.order_type {
            OrderType::Market => self.config.taker_fee,
            OrderType::Limit => self.config.maker_fee,
            _ => self.config.taker_fee,
        };
        
        trade_value * fee_rate
    }

    /// Cancel a pending order
    pub fn cancel_order(&mut self, order_id: EventId) -> Option<OrderEvent> {
        self.pending_orders.remove(&order_id).map(|mut order| {
            order.status = OrderStatus::Cancelled;
            order
        })
    }

    /// Get all pending orders
    pub fn pending_orders(&self) -> &HashMap<EventId, OrderEvent> {
        &self.pending_orders
    }

    /// Check margin requirement for an order
    pub fn check_margin(&self, order: &OrderEvent, current_price: f64, available_cash: f64) -> bool {
        let required = order.quantity * current_price * self.config.margin_requirement;
        available_cash >= required
    }

    /// Calculate margin required for a position
    pub fn margin_required(&self, quantity: f64, price: f64) -> f64 {
        quantity * price * self.config.margin_requirement
    }
}

impl Default for Brokerage {
    fn default() -> Self {
        Self::default_config()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_bar() -> Bar {
        Bar::new(Utc::now(), 100.0, 105.0, 95.0, 102.0, 10000.0)
    }

    #[test]
    fn test_market_order_execution() {
        let mut brokerage = Brokerage::default_config();
        let bar = create_test_bar();
        
        let order = OrderEvent::market(1, Utc::now(), "BTC/USD".to_string(), Side::Buy, 1.0);
        
        let fill = brokerage.execute_market_order(&order, &bar);
        assert!(fill.is_some());
        
        let fill = fill.unwrap();
        assert_eq!(fill.symbol, "BTC/USD");
        assert_eq!(fill.side, Side::Buy);
        assert!(fill.commission > 0.0);
    }

    #[test]
    fn test_limit_order_fill() {
        let mut brokerage = Brokerage::default_config();
        
        // Create a limit buy order below current price
        let order = OrderEvent::limit(1, Utc::now(), "BTC/USD".to_string(), Side::Buy, 1.0, 96.0);
        brokerage.submit_order(order);
        
        // Bar that hits our limit price
        let bar = Bar::new(Utc::now(), 100.0, 102.0, 95.0, 98.0, 10000.0);
        
        let fills = brokerage.process_bar(&bar, "BTC/USD");
        assert_eq!(fills.len(), 1);
        assert!((fills[0].fill_price - 96.0).abs() < 1.0);  // Allow for slippage
    }

    #[test]
    fn test_stop_order_trigger() {
        let mut brokerage = Brokerage::default_config();
        
        // Create a stop sell order below current price
        let order = OrderEvent::stop(1, Utc::now(), "BTC/USD".to_string(), Side::Sell, 1.0, 95.0);
        brokerage.submit_order(order);
        
        // Bar that triggers our stop
        let bar = Bar::new(Utc::now(), 100.0, 101.0, 94.0, 95.0, 10000.0);
        
        let fills = brokerage.process_bar(&bar, "BTC/USD");
        assert_eq!(fills.len(), 1);
        assert_eq!(fills[0].side, Side::Sell);
    }

    #[test]
    fn test_commission_calculation() {
        let config = BrokerageConfig {
            maker_fee: 0.001,
            taker_fee: 0.002,
            ..Default::default()
        };
        let brokerage = Brokerage::new(config);
        
        let market_order = OrderEvent::market(1, Utc::now(), "BTC/USD".to_string(), Side::Buy, 1.0);
        let commission = brokerage.calculate_commission(&market_order, 50000.0);
        
        // Taker fee: 0.002 * 50000 = 100
        assert!((commission - 100.0).abs() < 0.1);
    }
}

