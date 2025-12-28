//! Portfolio management module
//! 
//! Tracks:
//! - Cash balance
//! - Open positions
//! - Equity curve
//! - Realized and unrealized P&L

use crate::events::{FillEvent, Side, PortfolioUpdateEvent, EventId};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// A single position in a symbol
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub symbol: String,
    pub quantity: f64,
    pub average_price: f64,
    pub market_value: f64,
    pub unrealized_pnl: f64,
    pub realized_pnl: f64,
    pub cost_basis: f64,
}

impl Position {
    pub fn new(symbol: &str) -> Self {
        Self {
            symbol: symbol.to_string(),
            quantity: 0.0,
            average_price: 0.0,
            market_value: 0.0,
            unrealized_pnl: 0.0,
            realized_pnl: 0.0,
            cost_basis: 0.0,
        }
    }

    /// Update position with a new fill
    pub fn update_with_fill(&mut self, fill: &FillEvent) {
        match fill.side {
            Side::Buy => {
                // Calculate new average price
                let total_cost = self.quantity * self.average_price + fill.quantity * fill.fill_price;
                let new_quantity = self.quantity + fill.quantity;
                
                if new_quantity > 0.0 {
                    self.average_price = total_cost / new_quantity;
                }
                self.quantity = new_quantity;
                self.cost_basis += fill.quantity * fill.fill_price + fill.commission;
            }
            Side::Sell => {
                // Calculate realized P&L
                let sold_cost = fill.quantity * self.average_price;
                let sold_value = fill.quantity * fill.fill_price - fill.commission;
                self.realized_pnl += sold_value - sold_cost;
                
                self.quantity -= fill.quantity;
                self.cost_basis -= fill.quantity * self.average_price;
                
                // Reset if position closed
                if self.quantity.abs() < 1e-10 {
                    self.quantity = 0.0;
                    self.average_price = 0.0;
                    self.cost_basis = 0.0;
                }
            }
        }
    }

    /// Update market value and unrealized P&L with current price
    pub fn update_market_value(&mut self, current_price: f64) {
        self.market_value = self.quantity * current_price;
        self.unrealized_pnl = self.market_value - self.cost_basis;
    }

    /// Check if position is flat (no holdings)
    pub fn is_flat(&self) -> bool {
        self.quantity.abs() < 1e-10
    }
}

/// Equity curve data point
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EquityPoint {
    pub timestamp: DateTime<Utc>,
    pub equity: f64,
    pub cash: f64,
    pub positions_value: f64,
    pub drawdown: f64,
    pub drawdown_pct: f64,
}

/// Portfolio manager that tracks all positions and cash
pub struct Portfolio {
    /// Available cash
    cash: f64,
    
    /// Initial capital
    initial_capital: f64,
    
    /// Open positions by symbol
    positions: HashMap<String, Position>,
    
    /// Equity curve history
    equity_curve: Vec<EquityPoint>,
    
    /// Peak equity for drawdown calculation
    peak_equity: f64,
    
    /// Current drawdown
    current_drawdown: f64,
    
    /// Maximum drawdown seen
    max_drawdown: f64,
    
    /// Total realized P&L
    total_realized_pnl: f64,
    
    /// Trade history
    trades: Vec<TradeRecord>,
    
    /// Event ID counter
    event_id: EventId,
}

/// Record of a completed trade
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradeRecord {
    pub id: u64,
    pub symbol: String,
    pub side: String,
    pub quantity: f64,
    pub entry_price: f64,
    pub exit_price: Option<f64>,
    pub entry_time: DateTime<Utc>,
    pub exit_time: Option<DateTime<Utc>>,
    pub pnl: f64,
    pub commission: f64,
    pub status: String,  // "open" or "closed"
}

impl Portfolio {
    pub fn new(initial_capital: f64) -> Self {
        Self {
            cash: initial_capital,
            initial_capital,
            positions: HashMap::new(),
            equity_curve: Vec::new(),
            peak_equity: initial_capital,
            current_drawdown: 0.0,
            max_drawdown: 0.0,
            total_realized_pnl: 0.0,
            trades: Vec::new(),
            event_id: 0,
        }
    }

    /// Process a fill event and update positions
    pub fn process_fill(&mut self, fill: &FillEvent) {
        // Update cash
        match fill.side {
            Side::Buy => {
                self.cash -= fill.quantity * fill.fill_price + fill.commission + fill.slippage;
            }
            Side::Sell => {
                self.cash += fill.quantity * fill.fill_price - fill.commission - fill.slippage;
            }
        }

        // Get or create position
        let position = self.positions
            .entry(fill.symbol.clone())
            .or_insert_with(|| Position::new(&fill.symbol));

        // Track realized P&L before update
        let prev_realized = position.realized_pnl;
        
        // Update position
        position.update_with_fill(fill);
        
        // Track trade
        self.record_trade(fill);
        
        // Update total realized P&L
        self.total_realized_pnl += position.realized_pnl - prev_realized;
    }

    fn record_trade(&mut self, fill: &FillEvent) {
        // Find open trade for this symbol or create new
        let open_trade = self.trades.iter_mut()
            .find(|t| t.symbol == fill.symbol && t.status == "open");
        
        match fill.side {
            Side::Buy => {
                if let Some(trade) = open_trade {
                    // Adding to existing position
                    let total_qty = trade.quantity + fill.quantity;
                    trade.entry_price = (trade.entry_price * trade.quantity + fill.fill_price * fill.quantity) / total_qty;
                    trade.quantity = total_qty;
                    trade.commission += fill.commission;
                } else {
                    // New trade
                    self.trades.push(TradeRecord {
                        id: self.trades.len() as u64 + 1,
                        symbol: fill.symbol.clone(),
                        side: "long".to_string(),
                        quantity: fill.quantity,
                        entry_price: fill.fill_price,
                        exit_price: None,
                        entry_time: fill.timestamp,
                        exit_time: None,
                        pnl: 0.0,
                        commission: fill.commission,
                        status: "open".to_string(),
                    });
                }
            }
            Side::Sell => {
                if let Some(trade) = open_trade {
                    // Closing position
                    trade.exit_price = Some(fill.fill_price);
                    trade.exit_time = Some(fill.timestamp);
                    trade.pnl = (fill.fill_price - trade.entry_price) * fill.quantity - trade.commission - fill.commission;
                    trade.commission += fill.commission;
                    trade.status = "closed".to_string();
                } else {
                    // Short trade (new position)
                    self.trades.push(TradeRecord {
                        id: self.trades.len() as u64 + 1,
                        symbol: fill.symbol.clone(),
                        side: "short".to_string(),
                        quantity: fill.quantity,
                        entry_price: fill.fill_price,
                        exit_price: None,
                        entry_time: fill.timestamp,
                        exit_time: None,
                        pnl: 0.0,
                        commission: fill.commission,
                        status: "open".to_string(),
                    });
                }
            }
        }
    }

    /// Update all positions with current market prices
    pub fn update_market_values(&mut self, prices: &HashMap<String, f64>) {
        for (symbol, position) in &mut self.positions {
            if let Some(price) = prices.get(symbol) {
                position.update_market_value(*price);
            }
        }
    }

    /// Record current equity state
    pub fn record_equity(&mut self, timestamp: DateTime<Utc>) {
        let equity = self.total_equity();
        let positions_value = self.positions_value();
        
        // Update peak and drawdown
        if equity > self.peak_equity {
            self.peak_equity = equity;
        }
        
        self.current_drawdown = self.peak_equity - equity;
        let drawdown_pct = if self.peak_equity > 0.0 {
            (self.current_drawdown / self.peak_equity) * 100.0
        } else {
            0.0
        };
        
        if self.current_drawdown > self.max_drawdown {
            self.max_drawdown = self.current_drawdown;
        }
        
        self.equity_curve.push(EquityPoint {
            timestamp,
            equity,
            cash: self.cash,
            positions_value,
            drawdown: self.current_drawdown,
            drawdown_pct,
        });
    }

    /// Get total equity (cash + positions value)
    pub fn total_equity(&self) -> f64 {
        self.cash + self.positions_value()
    }

    /// Get total value of all positions
    pub fn positions_value(&self) -> f64 {
        self.positions.values().map(|p| p.market_value).sum()
    }

    /// Get unrealized P&L
    pub fn unrealized_pnl(&self) -> f64 {
        self.positions.values().map(|p| p.unrealized_pnl).sum()
    }

    /// Get realized P&L
    pub fn realized_pnl(&self) -> f64 {
        self.total_realized_pnl
    }

    /// Get total P&L
    pub fn total_pnl(&self) -> f64 {
        self.total_equity() - self.initial_capital
    }

    /// Get return percentage
    pub fn total_return_pct(&self) -> f64 {
        if self.initial_capital > 0.0 {
            ((self.total_equity() / self.initial_capital) - 1.0) * 100.0
        } else {
            0.0
        }
    }

    /// Get max drawdown percentage
    pub fn max_drawdown_pct(&self) -> f64 {
        if self.peak_equity > 0.0 {
            (self.max_drawdown / self.peak_equity) * 100.0
        } else {
            0.0
        }
    }

    /// Get position for a symbol
    pub fn get_position(&self, symbol: &str) -> Option<&Position> {
        self.positions.get(symbol)
    }

    /// Get all positions
    pub fn positions(&self) -> &HashMap<String, Position> {
        &self.positions
    }

    /// Get equity curve
    pub fn equity_curve(&self) -> &[EquityPoint] {
        &self.equity_curve
    }

    /// Get trade history
    pub fn trades(&self) -> &[TradeRecord] {
        &self.trades
    }

    /// Get current cash
    pub fn cash(&self) -> f64 {
        self.cash
    }

    /// Generate portfolio update event
    pub fn generate_update_event(&mut self, timestamp: DateTime<Utc>) -> PortfolioUpdateEvent {
        self.event_id += 1;
        
        let positions: Vec<(String, f64, f64)> = self.positions
            .values()
            .map(|p| (p.symbol.clone(), p.quantity, p.average_price))
            .collect();
        
        PortfolioUpdateEvent {
            id: self.event_id,
            timestamp,
            cash: self.cash,
            equity: self.total_equity(),
            positions,
            realized_pnl: self.total_realized_pnl,
            unrealized_pnl: self.unrealized_pnl(),
        }
    }

    /// Get trade statistics
    pub fn trade_stats(&self) -> TradeStats {
        let closed_trades: Vec<_> = self.trades.iter()
            .filter(|t| t.status == "closed")
            .collect();
        
        let winning_trades: Vec<_> = closed_trades.iter()
            .filter(|t| t.pnl > 0.0)
            .collect();
        
        let losing_trades: Vec<_> = closed_trades.iter()
            .filter(|t| t.pnl < 0.0)
            .collect();
        
        let total_trades = closed_trades.len();
        let winning_count = winning_trades.len();
        let losing_count = losing_trades.len();
        
        let win_rate = if total_trades > 0 {
            (winning_count as f64 / total_trades as f64) * 100.0
        } else {
            0.0
        };
        
        let avg_win = if winning_count > 0 {
            winning_trades.iter().map(|t| t.pnl).sum::<f64>() / winning_count as f64
        } else {
            0.0
        };
        
        let avg_loss = if losing_count > 0 {
            losing_trades.iter().map(|t| t.pnl.abs()).sum::<f64>() / losing_count as f64
        } else {
            0.0
        };
        
        let total_wins: f64 = winning_trades.iter().map(|t| t.pnl).sum();
        let total_losses: f64 = losing_trades.iter().map(|t| t.pnl.abs()).sum();
        
        let profit_factor = if total_losses > 0.0 {
            total_wins / total_losses
        } else if total_wins > 0.0 {
            f64::INFINITY
        } else {
            0.0
        };
        
        let largest_win = winning_trades.iter()
            .map(|t| t.pnl)
            .fold(0.0, f64::max);
        
        let largest_loss = losing_trades.iter()
            .map(|t| t.pnl.abs())
            .fold(0.0, f64::max);
        
        TradeStats {
            total_trades,
            winning_trades: winning_count,
            losing_trades: losing_count,
            win_rate,
            average_win: avg_win,
            average_loss: avg_loss,
            profit_factor,
            largest_win,
            largest_loss,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradeStats {
    pub total_trades: usize,
    pub winning_trades: usize,
    pub losing_trades: usize,
    pub win_rate: f64,
    pub average_win: f64,
    pub average_loss: f64,
    pub profit_factor: f64,
    pub largest_win: f64,
    pub largest_loss: f64,
}

impl Default for TradeStats {
    fn default() -> Self {
        Self {
            total_trades: 0,
            winning_trades: 0,
            losing_trades: 0,
            win_rate: 0.0,
            average_win: 0.0,
            average_loss: 0.0,
            profit_factor: 0.0,
            largest_win: 0.0,
            largest_loss: 0.0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_buy_fill() -> FillEvent {
        FillEvent {
            id: 1,
            order_id: 0,
            timestamp: Utc::now(),
            symbol: "BTC/USD".to_string(),
            side: Side::Buy,
            quantity: 1.0,
            fill_price: 50000.0,
            commission: 50.0,
            slippage: 25.0,
        }
    }

    fn create_sell_fill() -> FillEvent {
        FillEvent {
            id: 2,
            order_id: 1,
            timestamp: Utc::now(),
            symbol: "BTC/USD".to_string(),
            side: Side::Sell,
            quantity: 1.0,
            fill_price: 52000.0,
            commission: 52.0,
            slippage: 26.0,
        }
    }

    #[test]
    fn test_process_buy_fill() {
        let mut portfolio = Portfolio::new(100000.0);
        let fill = create_buy_fill();
        
        portfolio.process_fill(&fill);
        
        assert!(portfolio.cash < 100000.0);
        assert!(portfolio.get_position("BTC/USD").is_some());
        
        let position = portfolio.get_position("BTC/USD").unwrap();
        assert_eq!(position.quantity, 1.0);
        assert_eq!(position.average_price, 50000.0);
    }

    #[test]
    fn test_round_trip_trade() {
        let mut portfolio = Portfolio::new(100000.0);
        
        // Buy
        let buy = create_buy_fill();
        portfolio.process_fill(&buy);
        
        // Sell at higher price
        let sell = create_sell_fill();
        portfolio.process_fill(&sell);
        
        // Position should be flat
        let position = portfolio.get_position("BTC/USD").unwrap();
        assert!(position.is_flat());
        
        // Should have positive realized P&L (minus fees)
        assert!(portfolio.realized_pnl() > 0.0);
    }

    #[test]
    fn test_equity_tracking() {
        let mut portfolio = Portfolio::new(100000.0);
        
        // Initial equity
        assert_eq!(portfolio.total_equity(), 100000.0);
        
        // After buy, equity should be slightly less due to fees
        let fill = create_buy_fill();
        portfolio.process_fill(&fill);
        
        // Update market value
        let mut prices = HashMap::new();
        prices.insert("BTC/USD".to_string(), 50000.0);
        portfolio.update_market_values(&prices);
        
        // Equity should be ~100000 minus fees
        assert!(portfolio.total_equity() < 100000.0);
    }
}

