//! Order manager for tracking order lifecycle
//! 
//! Order lifecycle: Submitted → Pending → Filled/Cancelled/Rejected

use crate::events::{EventId, OrderEvent, OrderStatus, OrderType, Side};
use chrono::{DateTime, Utc};
use std::collections::HashMap;

/// Order manager that tracks all orders
pub struct OrderManager {
    /// All orders by ID
    orders: HashMap<EventId, OrderEvent>,
    
    /// Open orders (not yet filled or cancelled)
    open_orders: Vec<EventId>,
    
    /// Filled orders
    filled_orders: Vec<EventId>,
    
    /// Cancelled orders
    cancelled_orders: Vec<EventId>,
    
    /// Next order ID
    next_id: EventId,
}

impl OrderManager {
    pub fn new() -> Self {
        Self {
            orders: HashMap::new(),
            open_orders: Vec::new(),
            filled_orders: Vec::new(),
            cancelled_orders: Vec::new(),
            next_id: 1,
        }
    }

    /// Create a new market order
    pub fn create_market_order(
        &mut self,
        timestamp: DateTime<Utc>,
        symbol: &str,
        side: Side,
        quantity: f64,
    ) -> OrderEvent {
        let order = OrderEvent::market(
            self.next_id,
            timestamp,
            symbol.to_string(),
            side,
            quantity,
        );
        self.submit_order(order.clone());
        order
    }

    /// Create a new limit order
    pub fn create_limit_order(
        &mut self,
        timestamp: DateTime<Utc>,
        symbol: &str,
        side: Side,
        quantity: f64,
        limit_price: f64,
    ) -> OrderEvent {
        let order = OrderEvent::limit(
            self.next_id,
            timestamp,
            symbol.to_string(),
            side,
            quantity,
            limit_price,
        );
        self.submit_order(order.clone());
        order
    }

    /// Create a new stop order
    pub fn create_stop_order(
        &mut self,
        timestamp: DateTime<Utc>,
        symbol: &str,
        side: Side,
        quantity: f64,
        stop_price: f64,
    ) -> OrderEvent {
        let order = OrderEvent::stop(
            self.next_id,
            timestamp,
            symbol.to_string(),
            side,
            quantity,
            stop_price,
        );
        self.submit_order(order.clone());
        order
    }

    /// Submit an order to the manager
    fn submit_order(&mut self, order: OrderEvent) {
        let id = order.id;
        self.orders.insert(id, order);
        self.open_orders.push(id);
        self.next_id += 1;
    }

    /// Mark an order as pending
    pub fn mark_pending(&mut self, order_id: EventId) {
        if let Some(order) = self.orders.get_mut(&order_id) {
            order.status = OrderStatus::Pending;
        }
    }

    /// Mark an order as filled
    pub fn mark_filled(&mut self, order_id: EventId) {
        if let Some(order) = self.orders.get_mut(&order_id) {
            order.status = OrderStatus::Filled;
            
            // Move from open to filled
            self.open_orders.retain(|&id| id != order_id);
            self.filled_orders.push(order_id);
        }
    }

    /// Mark an order as cancelled
    pub fn mark_cancelled(&mut self, order_id: EventId) {
        if let Some(order) = self.orders.get_mut(&order_id) {
            order.status = OrderStatus::Cancelled;
            
            // Move from open to cancelled
            self.open_orders.retain(|&id| id != order_id);
            self.cancelled_orders.push(order_id);
        }
    }

    /// Mark an order as rejected
    pub fn mark_rejected(&mut self, order_id: EventId) {
        if let Some(order) = self.orders.get_mut(&order_id) {
            order.status = OrderStatus::Rejected;
            self.open_orders.retain(|&id| id != order_id);
        }
    }

    /// Get an order by ID
    pub fn get_order(&self, order_id: EventId) -> Option<&OrderEvent> {
        self.orders.get(&order_id)
    }

    /// Get all open orders
    pub fn open_orders(&self) -> Vec<&OrderEvent> {
        self.open_orders
            .iter()
            .filter_map(|id| self.orders.get(id))
            .collect()
    }

    /// Get open orders for a symbol
    pub fn open_orders_for_symbol(&self, symbol: &str) -> Vec<&OrderEvent> {
        self.open_orders()
            .into_iter()
            .filter(|o| o.symbol == symbol)
            .collect()
    }

    /// Get all filled orders
    pub fn filled_orders(&self) -> Vec<&OrderEvent> {
        self.filled_orders
            .iter()
            .filter_map(|id| self.orders.get(id))
            .collect()
    }

    /// Get total number of orders
    pub fn total_orders(&self) -> usize {
        self.orders.len()
    }

    /// Get number of open orders
    pub fn open_count(&self) -> usize {
        self.open_orders.len()
    }

    /// Get number of filled orders
    pub fn filled_count(&self) -> usize {
        self.filled_orders.len()
    }

    /// Cancel all open orders
    pub fn cancel_all(&mut self) {
        let open_ids: Vec<EventId> = self.open_orders.clone();
        for id in open_ids {
            self.mark_cancelled(id);
        }
    }

    /// Cancel all open orders for a symbol
    pub fn cancel_orders_for_symbol(&mut self, symbol: &str) {
        let to_cancel: Vec<EventId> = self.open_orders
            .iter()
            .filter_map(|id| self.orders.get(id))
            .filter(|o| o.symbol == symbol)
            .map(|o| o.id)
            .collect();
        
        for id in to_cancel {
            self.mark_cancelled(id);
        }
    }

    /// Reset the order manager
    pub fn reset(&mut self) {
        self.orders.clear();
        self.open_orders.clear();
        self.filled_orders.clear();
        self.cancelled_orders.clear();
        self.next_id = 1;
    }
}

impl Default for OrderManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_market_order() {
        let mut manager = OrderManager::new();
        
        let order = manager.create_market_order(
            Utc::now(),
            "BTC/USD",
            Side::Buy,
            1.0,
        );
        
        assert_eq!(order.order_type, OrderType::Market);
        assert_eq!(order.side, Side::Buy);
        assert_eq!(manager.open_count(), 1);
    }

    #[test]
    fn test_order_lifecycle() {
        let mut manager = OrderManager::new();
        
        let order = manager.create_limit_order(
            Utc::now(),
            "BTC/USD",
            Side::Buy,
            1.0,
            50000.0,
        );
        
        // Start as submitted
        assert_eq!(order.status, OrderStatus::Submitted);
        
        // Mark pending
        manager.mark_pending(order.id);
        assert_eq!(manager.get_order(order.id).unwrap().status, OrderStatus::Pending);
        
        // Mark filled
        manager.mark_filled(order.id);
        assert_eq!(manager.get_order(order.id).unwrap().status, OrderStatus::Filled);
        assert_eq!(manager.open_count(), 0);
        assert_eq!(manager.filled_count(), 1);
    }

    #[test]
    fn test_cancel_orders() {
        let mut manager = OrderManager::new();
        
        manager.create_limit_order(Utc::now(), "BTC/USD", Side::Buy, 1.0, 50000.0);
        manager.create_limit_order(Utc::now(), "ETH/USD", Side::Buy, 10.0, 3000.0);
        
        assert_eq!(manager.open_count(), 2);
        
        manager.cancel_orders_for_symbol("BTC/USD");
        
        assert_eq!(manager.open_count(), 1);
        assert_eq!(manager.open_orders_for_symbol("ETH/USD").len(), 1);
    }
}

