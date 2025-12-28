//! Main backtest engine - the event loop orchestrator
//! 
//! Processes events in order:
//! MarketData → Signal → Order → Fill → Portfolio Update

use crate::brokerage::Brokerage;
use crate::config::{BacktestConfig, BrokerageConfig};
use crate::datafeed::DataFeed;
use crate::events::{Bar, Event, FillEvent, MarketDataEvent, OrderEvent, Side, EventId};
use crate::metrics::{BacktestMetrics, MetricsCalculator};
use crate::order_manager::OrderManager;
use crate::portfolio::Portfolio;
use chrono::{DateTime, NaiveDateTime, Utc};
use std::collections::{BinaryHeap, HashMap};
use std::cmp::Reverse;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum EngineError {
    #[error("Data error: {0}")]
    Data(String),
    
    #[error("Execution error: {0}")]
    Execution(String),
    
    #[error("Configuration error: {0}")]
    Config(String),
}

/// Main backtest engine
pub struct BacktestEngine {
    config: BacktestConfig,
    data_feed: DataFeed,
    portfolio: Portfolio,
    brokerage: Brokerage,
    order_manager: OrderManager,
    
    /// Current prices for each symbol
    current_prices: HashMap<String, f64>,
    
    /// Event queue (min-heap by timestamp)
    event_queue: BinaryHeap<Reverse<Event>>,
    
    /// Current timestamp
    current_time: Option<DateTime<Utc>>,
    
    /// Total bars processed
    bars_processed: usize,
    
    /// Total bars to process
    total_bars: usize,
    
    /// Engine state
    running: bool,
}

impl BacktestEngine {
    pub fn new(config: BacktestConfig) -> Self {
        let brokerage_config = BrokerageConfig {
            maker_fee: config.maker_fee,
            taker_fee: config.taker_fee,
            slippage_pct: config.slippage_pct,
            ..Default::default()
        };
        
        Self {
            portfolio: Portfolio::new(config.initial_capital),
            brokerage: Brokerage::new(brokerage_config),
            data_feed: DataFeed::new(),
            order_manager: OrderManager::new(),
            current_prices: HashMap::new(),
            event_queue: BinaryHeap::new(),
            current_time: None,
            bars_processed: 0,
            total_bars: 0,
            running: false,
            config,
        }
    }

    /// Load data from file
    pub fn load_data(&mut self, path: &str) -> Result<(), EngineError> {
        // Determine file type and load accordingly
        if path.ends_with(".parquet") {
            for symbol in &self.config.symbols.clone() {
                self.data_feed.load_parquet(path, symbol)
                    .map_err(|e| EngineError::Data(e.to_string()))?;
            }
        } else if path.ends_with(".csv") {
            for symbol in &self.config.symbols.clone() {
                self.data_feed.load_csv(path, symbol)
                    .map_err(|e| EngineError::Data(e.to_string()))?;
            }
        } else {
            // Try to load as JSON data
            self.load_json_data(path)?;
        }
        
        // Calculate total bars
        self.total_bars = self.config.symbols.iter()
            .map(|s| self.data_feed.len(s))
            .sum();
        
        Ok(())
    }

    /// Load data from JSON string
    fn load_json_data(&mut self, data: &str) -> Result<(), EngineError> {
        // Parse as array of OHLCV data
        let parsed: Vec<OhlcvRow> = serde_json::from_str(data)
            .map_err(|e| EngineError::Data(format!("JSON parse error: {}", e)))?;
        
        // Group by symbol
        let mut by_symbol: HashMap<String, Vec<Bar>> = HashMap::new();
        
        for row in parsed {
            let timestamp = self.parse_timestamp(&row.timestamp)?;
            let bar = Bar::new(timestamp, row.open, row.high, row.low, row.close, row.volume);
            
            by_symbol
                .entry(row.symbol.clone())
                .or_default()
                .push(bar);
        }
        
        // Load into data feed
        for (symbol, bars) in by_symbol {
            self.data_feed.load_bars(&symbol, bars);
        }
        
        Ok(())
    }

    fn parse_timestamp(&self, s: &str) -> Result<DateTime<Utc>, EngineError> {
        // Try Unix timestamp
        if let Ok(ts) = s.parse::<i64>() {
            let secs = if ts > 10_000_000_000 { ts / 1000 } else { ts };
            return DateTime::from_timestamp(secs, 0)
                .ok_or_else(|| EngineError::Data("Invalid timestamp".to_string()));
        }
        
        // Try ISO 8601
        if let Ok(dt) = DateTime::parse_from_rfc3339(s) {
            return Ok(dt.with_timezone(&Utc));
        }
        
        // Try common formats
        if let Ok(dt) = NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S") {
            return Ok(dt.and_utc());
        }
        
        Err(EngineError::Data(format!("Cannot parse timestamp: {}", s)))
    }

    /// Run backtest with pre-computed signals
    /// signals: Vec of (timestamp, signal) where signal is -1, 0, or 1
    pub fn run(&mut self, signals: Vec<(String, i32)>) -> Result<BacktestMetrics, EngineError> {
        self.running = true;
        self.bars_processed = 0;
        
        // Convert signals to a map
        let signal_map: HashMap<String, i32> = signals.into_iter().collect();
        
        // Get all bars aligned by timestamp
        let market_events = self.data_feed.get_aligned_bars();
        
        // Process each bar
        for event in market_events {
            self.process_market_data(&event, &signal_map)?;
            self.bars_processed += 1;
        }
        
        // Close any remaining positions
        self.close_all_positions()?;
        
        self.running = false;
        
        // Calculate metrics
        let calculator = MetricsCalculator::new(0.02, &self.config.timeframe);
        let trade_stats = self.portfolio.trade_stats();
        let metrics = calculator.calculate(self.portfolio.equity_curve(), trade_stats);
        
        Ok(metrics)
    }

    /// Process a single market data event
    fn process_market_data(
        &mut self,
        event: &MarketDataEvent,
        signals: &HashMap<String, i32>,
    ) -> Result<(), EngineError> {
        let symbol = &event.symbol;
        let bar = &event.bar;
        
        // Update current price
        self.current_prices.insert(symbol.clone(), bar.close);
        self.current_time = Some(bar.timestamp);
        
        // Process pending orders
        let fills = self.brokerage.process_bar(bar, symbol);
        for fill in fills {
            self.process_fill(fill)?;
        }
        
        // Get signal for this timestamp
        let timestamp_key = bar.timestamp.to_rfc3339();
        if let Some(&signal) = signals.get(&timestamp_key) {
            self.execute_signal(symbol, signal, bar)?;
        }
        
        // Update portfolio market values
        self.portfolio.update_market_values(&self.current_prices);
        
        // Record equity point
        self.portfolio.record_equity(bar.timestamp);
        
        Ok(())
    }

    /// Execute a trading signal
    fn execute_signal(&mut self, symbol: &str, signal: i32, bar: &Bar) -> Result<(), EngineError> {
        let position = self.portfolio.get_position(symbol);
        let current_qty = position.map(|p| p.quantity).unwrap_or(0.0);
        
        match signal {
            1 => {
                // Buy signal
                if current_qty <= 0.0 {
                    // Close short or open long
                    let order_qty = self.calculate_order_size(symbol, bar.close);
                    if order_qty > 0.0 {
                        let order = self.order_manager.create_market_order(
                            bar.timestamp,
                            symbol,
                            Side::Buy,
                            order_qty,
                        );
                        
                        // Execute immediately for market order
                        if let Some(fill) = self.brokerage.execute_market_order(&order, bar) {
                            self.process_fill(fill)?;
                            self.order_manager.mark_filled(order.id);
                        }
                    }
                }
            }
            -1 => {
                // Sell signal
                if current_qty > 0.0 {
                    // Close long position
                    let order = self.order_manager.create_market_order(
                        bar.timestamp,
                        symbol,
                        Side::Sell,
                        current_qty,
                    );
                    
                    if let Some(fill) = self.brokerage.execute_market_order(&order, bar) {
                        self.process_fill(fill)?;
                        self.order_manager.mark_filled(order.id);
                    }
                }
            }
            _ => {
                // Hold - do nothing
            }
        }
        
        Ok(())
    }

    /// Calculate order size based on available capital
    fn calculate_order_size(&self, symbol: &str, price: f64) -> f64 {
        let available = self.portfolio.cash();
        let position_size = available * 0.95;  // Use 95% of available cash
        
        // Account for fees
        let fee_adjusted = position_size / (1.0 + self.config.taker_fee + self.config.slippage_pct);
        
        fee_adjusted / price
    }

    /// Process a fill event
    fn process_fill(&mut self, fill: FillEvent) -> Result<(), EngineError> {
        self.portfolio.process_fill(&fill);
        Ok(())
    }

    /// Close all open positions
    fn close_all_positions(&mut self) -> Result<(), EngineError> {
        let positions: Vec<(String, f64)> = self.portfolio.positions()
            .iter()
            .filter(|(_, p)| !p.is_flat())
            .map(|(s, p)| (s.clone(), p.quantity))
            .collect();
        
        for (symbol, qty) in positions {
            if qty > 0.0 {
                if let Some(&price) = self.current_prices.get(&symbol) {
                    let timestamp = self.current_time.unwrap_or_else(Utc::now);
                    let bar = Bar::new(timestamp, price, price, price, price, 0.0);
                    
                    let order = self.order_manager.create_market_order(
                        timestamp,
                        &symbol,
                        Side::Sell,
                        qty,
                    );
                    
                    if let Some(fill) = self.brokerage.execute_market_order(&order, &bar) {
                        self.process_fill(fill)?;
                    }
                }
            }
        }
        
        Ok(())
    }

    /// Get current progress (0.0 to 100.0)
    pub fn get_progress(&self) -> f64 {
        if self.total_bars == 0 {
            return 100.0;
        }
        (self.bars_processed as f64 / self.total_bars as f64) * 100.0
    }

    /// Get current equity
    pub fn get_current_equity(&self) -> f64 {
        self.portfolio.total_equity()
    }

    /// Check if engine is running
    pub fn is_running(&self) -> bool {
        self.running
    }

    /// Get equity curve
    pub fn equity_curve(&self) -> Vec<f64> {
        self.portfolio.equity_curve()
            .iter()
            .map(|e| e.equity)
            .collect()
    }

    /// Get trade history as JSON
    pub fn trades_json(&self) -> String {
        serde_json::to_string(self.portfolio.trades()).unwrap_or_default()
    }

    /// Reset the engine for a new run
    pub fn reset(&mut self) {
        self.portfolio = Portfolio::new(self.config.initial_capital);
        self.brokerage = Brokerage::default();
        self.order_manager.reset();
        self.data_feed.reset();
        self.current_prices.clear();
        self.event_queue.clear();
        self.current_time = None;
        self.bars_processed = 0;
        self.running = false;
    }
}

/// Helper struct for JSON data parsing
#[derive(serde::Deserialize)]
struct OhlcvRow {
    symbol: String,
    timestamp: String,
    open: f64,
    high: f64,
    low: f64,
    close: f64,
    volume: f64,
}

// Conversion from BacktestMetrics to PyBacktestResult
impl From<BacktestMetrics> for crate::PyBacktestResult {
    fn from(metrics: BacktestMetrics) -> Self {
        Self {
            total_return: metrics.total_return,
            annual_return: metrics.annual_return,
            volatility: metrics.volatility,
            sharpe_ratio: metrics.sharpe_ratio,
            sortino_ratio: metrics.sortino_ratio,
            calmar_ratio: metrics.calmar_ratio,
            max_drawdown: metrics.max_drawdown,
            max_drawdown_duration: metrics.max_drawdown_duration,
            win_rate: metrics.trade_stats.win_rate,
            profit_factor: metrics.trade_stats.profit_factor,
            total_trades: metrics.trade_stats.total_trades as i64,
            winning_trades: metrics.trade_stats.winning_trades as i64,
            losing_trades: metrics.trade_stats.losing_trades as i64,
            average_win: metrics.trade_stats.average_win,
            average_loss: metrics.trade_stats.average_loss,
            equity_curve: metrics.equity_curve,
            timestamps: metrics.timestamps,
            trades: Vec::new(),
        }
    }
}

impl Default for BacktestMetrics {
    fn default() -> Self {
        Self {
            total_return: 0.0,
            annual_return: 0.0,
            monthly_return: 0.0,
            volatility: 0.0,
            downside_volatility: 0.0,
            max_drawdown: 0.0,
            max_drawdown_duration: 0,
            sharpe_ratio: 0.0,
            sortino_ratio: 0.0,
            calmar_ratio: 0.0,
            alpha: 0.0,
            beta: 0.0,
            information_ratio: 0.0,
            treynor_ratio: 0.0,
            var_95: 0.0,
            cvar_95: 0.0,
            trade_stats: crate::portfolio::TradeStats::default(),
            equity_curve: Vec::new(),
            timestamps: Vec::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_engine_creation() {
        let config = BacktestConfig::default();
        let engine = BacktestEngine::new(config);
        
        assert_eq!(engine.get_current_equity(), 100_000.0);
        assert!(!engine.is_running());
    }

    #[test]
    fn test_progress() {
        let config = BacktestConfig::default();
        let engine = BacktestEngine::new(config);
        
        // No data loaded, progress should be 100%
        assert_eq!(engine.get_progress(), 100.0);
    }
}

