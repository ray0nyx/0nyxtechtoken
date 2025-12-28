//! Configuration for the backtest engine

use serde::{Deserialize, Serialize};

/// Main configuration for a backtest run
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BacktestConfig {
    /// Starting capital in base currency (USD)
    pub initial_capital: f64,
    
    /// Backtest start date (ISO 8601 format)
    pub start_date: String,
    
    /// Backtest end date (ISO 8601 format)
    pub end_date: String,
    
    /// List of symbols to trade
    pub symbols: Vec<String>,
    
    /// Timeframe for OHLCV data (1m, 5m, 15m, 1h, 4h, 1d)
    pub timeframe: String,
    
    /// Maker fee as decimal (0.001 = 0.1%)
    pub maker_fee: f64,
    
    /// Taker fee as decimal (0.001 = 0.1%)
    pub taker_fee: f64,
    
    /// Slippage percentage as decimal (0.0005 = 0.05%)
    pub slippage_pct: f64,
}

impl Default for BacktestConfig {
    fn default() -> Self {
        Self {
            initial_capital: 100_000.0,
            start_date: "2023-01-01".to_string(),
            end_date: "2024-01-01".to_string(),
            symbols: vec!["BTC/USDT".to_string()],
            timeframe: "1h".to_string(),
            maker_fee: 0.001,
            taker_fee: 0.001,
            slippage_pct: 0.0005,
        }
    }
}

/// Brokerage model configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrokerageConfig {
    /// Maker fee (limit orders that add liquidity)
    pub maker_fee: f64,
    
    /// Taker fee (market orders that remove liquidity)
    pub taker_fee: f64,
    
    /// Fixed slippage per trade (in base currency)
    pub slippage_fixed: f64,
    
    /// Variable slippage as percentage of trade value
    pub slippage_pct: f64,
    
    /// Whether to use realistic fill simulation
    pub realistic_fills: bool,
    
    /// Margin requirement (1.0 = no margin, 0.5 = 2x leverage)
    pub margin_requirement: f64,
    
    /// Maximum leverage allowed
    pub max_leverage: f64,
}

impl Default for BrokerageConfig {
    fn default() -> Self {
        Self {
            maker_fee: 0.001,
            taker_fee: 0.001,
            slippage_fixed: 0.0,
            slippage_pct: 0.0005,
            realistic_fills: true,
            margin_requirement: 1.0,
            max_leverage: 1.0,
        }
    }
}

/// Parameter optimization configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationConfig {
    /// Parameter name to value ranges
    pub parameter_ranges: Vec<ParameterRange>,
    
    /// Optimization strategy
    pub strategy: OptimizationStrategy,
    
    /// Number of parallel workers
    pub n_workers: usize,
    
    /// Maximum number of iterations
    pub max_iterations: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParameterRange {
    pub name: String,
    pub min: f64,
    pub max: f64,
    pub step: f64,
}

impl ParameterRange {
    pub fn values(&self) -> Vec<f64> {
        let mut values = Vec::new();
        let mut current = self.min;
        while current <= self.max {
            values.push(current);
            current += self.step;
        }
        values
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OptimizationStrategy {
    /// Grid search: test all parameter combinations
    GridSearch,
    
    /// Random search: sample randomly from parameter space
    RandomSearch { n_samples: usize },
    
    /// Walk-forward: optimize on training set, validate on test set
    WalkForward { train_pct: f64, test_pct: f64 },
}

impl Default for OptimizationConfig {
    fn default() -> Self {
        Self {
            parameter_ranges: Vec::new(),
            strategy: OptimizationStrategy::GridSearch,
            n_workers: num_cpus::get().max(1),
            max_iterations: 1000,
        }
    }
}

// Helper to get CPU count without external dependency
mod num_cpus {
    pub fn get() -> usize {
        std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(4)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parameter_range_values() {
        let range = ParameterRange {
            name: "rsi_period".to_string(),
            min: 10.0,
            max: 20.0,
            step: 5.0,
        };
        let values = range.values();
        assert_eq!(values, vec![10.0, 15.0, 20.0]);
    }

    #[test]
    fn test_default_config() {
        let config = BacktestConfig::default();
        assert_eq!(config.initial_capital, 100_000.0);
        assert_eq!(config.maker_fee, 0.001);
    }
}

