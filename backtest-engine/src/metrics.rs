//! Performance metrics calculation
//! 
//! Calculates standard quant metrics:
//! - Sharpe Ratio
//! - Sortino Ratio
//! - Calmar Ratio
//! - Max Drawdown
//! - Alpha/Beta
//! - VaR/CVaR

use crate::portfolio::{EquityPoint, TradeStats};

/// Complete backtest result with all metrics
#[derive(Debug, Clone)]
pub struct BacktestMetrics {
    // Return metrics
    pub total_return: f64,
    pub annual_return: f64,
    pub monthly_return: f64,
    
    // Risk metrics
    pub volatility: f64,
    pub downside_volatility: f64,
    pub max_drawdown: f64,
    pub max_drawdown_duration: i64,  // in days
    
    // Risk-adjusted metrics
    pub sharpe_ratio: f64,
    pub sortino_ratio: f64,
    pub calmar_ratio: f64,
    
    // Market metrics
    pub alpha: f64,
    pub beta: f64,
    pub information_ratio: f64,
    pub treynor_ratio: f64,
    
    // Risk measures
    pub var_95: f64,
    pub cvar_95: f64,
    
    // Trade statistics
    pub trade_stats: TradeStats,
    
    // Equity curve
    pub equity_curve: Vec<f64>,
    pub timestamps: Vec<String>,
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
            trade_stats: TradeStats::default(),
            equity_curve: Vec::new(),
            timestamps: Vec::new(),
        }
    }
}

/// Calculator for backtest metrics
pub struct MetricsCalculator {
    /// Risk-free rate (annualized)
    risk_free_rate: f64,
    
    /// Periods per year (252 for daily, 365*24 for hourly)
    periods_per_year: f64,
}

impl MetricsCalculator {
    pub fn new(risk_free_rate: f64, timeframe: &str) -> Self {
        let periods_per_year = match timeframe {
            "1m" => 365.0 * 24.0 * 60.0,
            "5m" => 365.0 * 24.0 * 12.0,
            "15m" => 365.0 * 24.0 * 4.0,
            "1h" => 365.0 * 24.0,
            "4h" => 365.0 * 6.0,
            "1d" => 365.0,
            "1w" => 52.0,
            _ => 365.0,
        };
        
        Self {
            risk_free_rate,
            periods_per_year,
        }
    }

    /// Calculate all metrics from equity curve
    pub fn calculate(&self, equity_curve: &[EquityPoint], trade_stats: TradeStats) -> BacktestMetrics {
        if equity_curve.len() < 2 {
            return BacktestMetrics::default();
        }
        
        let equities: Vec<f64> = equity_curve.iter().map(|e| e.equity).collect();
        let returns = self.calculate_returns(&equities);
        
        let initial = equities.first().copied().unwrap_or(1.0);
        let final_equity = equities.last().copied().unwrap_or(1.0);
        
        // Total return
        let total_return = (final_equity / initial - 1.0) * 100.0;
        
        // Annualized return
        let n_periods = equities.len() as f64;
        let annual_return = self.annualize_return(total_return / 100.0, n_periods);
        
        // Monthly return
        let monthly_return = annual_return / 12.0;
        
        // Volatility
        let volatility = self.calculate_volatility(&returns);
        
        // Downside volatility
        let downside_vol = self.calculate_downside_volatility(&returns);
        
        // Max drawdown
        let (max_dd, max_dd_duration) = self.calculate_max_drawdown(&equities, equity_curve);
        
        // Sharpe ratio
        let sharpe = self.calculate_sharpe(&returns, volatility);
        
        // Sortino ratio
        let sortino = self.calculate_sortino(&returns, downside_vol);
        
        // Calmar ratio
        let calmar = if max_dd > 0.0 {
            annual_return / max_dd
        } else {
            0.0
        };
        
        // VaR and CVaR
        let (var_95, cvar_95) = self.calculate_var(&returns);
        
        // Equity curve for export
        let timestamps: Vec<String> = equity_curve
            .iter()
            .map(|e| e.timestamp.to_rfc3339())
            .collect();
        
        BacktestMetrics {
            total_return,
            annual_return: annual_return * 100.0,
            monthly_return: monthly_return * 100.0,
            volatility: volatility * 100.0,
            downside_volatility: downside_vol * 100.0,
            max_drawdown: max_dd * 100.0,
            max_drawdown_duration: max_dd_duration,
            sharpe_ratio: sharpe,
            sortino_ratio: sortino,
            calmar_ratio: calmar,
            alpha: 0.0,  // Requires benchmark
            beta: 0.0,   // Requires benchmark
            information_ratio: 0.0,
            treynor_ratio: 0.0,
            var_95: var_95 * 100.0,
            cvar_95: cvar_95 * 100.0,
            trade_stats,
            equity_curve: equities,
            timestamps,
        }
    }

    /// Calculate period returns from equity curve
    fn calculate_returns(&self, equities: &[f64]) -> Vec<f64> {
        if equities.len() < 2 {
            return Vec::new();
        }
        
        equities.windows(2)
            .map(|w| (w[1] / w[0]) - 1.0)
            .collect()
    }

    /// Annualize a return
    fn annualize_return(&self, total_return: f64, n_periods: f64) -> f64 {
        let periods_fraction = n_periods / self.periods_per_year;
        if periods_fraction > 0.0 {
            (1.0 + total_return).powf(1.0 / periods_fraction) - 1.0
        } else {
            0.0
        }
    }

    /// Calculate volatility (standard deviation of returns)
    fn calculate_volatility(&self, returns: &[f64]) -> f64 {
        if returns.is_empty() {
            return 0.0;
        }
        
        let mean = returns.iter().sum::<f64>() / returns.len() as f64;
        let variance = returns.iter()
            .map(|r| (r - mean).powi(2))
            .sum::<f64>() / returns.len() as f64;
        
        // Annualize
        variance.sqrt() * self.periods_per_year.sqrt()
    }

    /// Calculate downside volatility (only negative returns)
    fn calculate_downside_volatility(&self, returns: &[f64]) -> f64 {
        let negative_returns: Vec<f64> = returns.iter()
            .filter(|&&r| r < 0.0)
            .copied()
            .collect();
        
        if negative_returns.is_empty() {
            return 0.0;
        }
        
        let variance = negative_returns.iter()
            .map(|r| r.powi(2))
            .sum::<f64>() / negative_returns.len() as f64;
        
        variance.sqrt() * self.periods_per_year.sqrt()
    }

    /// Calculate max drawdown and duration
    fn calculate_max_drawdown(&self, equities: &[f64], curve: &[EquityPoint]) -> (f64, i64) {
        if equities.is_empty() {
            return (0.0, 0);
        }
        
        let mut peak = equities[0];
        let mut max_dd = 0.0;
        let mut max_dd_duration = 0i64;
        let mut current_dd_start = 0usize;
        let mut in_drawdown = false;
        
        for (i, &equity) in equities.iter().enumerate() {
            if equity > peak {
                peak = equity;
                in_drawdown = false;
            } else {
                let dd = (peak - equity) / peak;
                if dd > max_dd {
                    max_dd = dd;
                }
                
                if !in_drawdown {
                    current_dd_start = i;
                    in_drawdown = true;
                }
                
                // Calculate duration in days
                if i > current_dd_start && i < curve.len() && current_dd_start < curve.len() {
                    let duration = curve[i].timestamp
                        .signed_duration_since(curve[current_dd_start].timestamp);
                    let days = duration.num_days();
                    if days > max_dd_duration {
                        max_dd_duration = days;
                    }
                }
            }
        }
        
        (max_dd, max_dd_duration)
    }

    /// Calculate Sharpe ratio
    fn calculate_sharpe(&self, returns: &[f64], volatility: f64) -> f64 {
        if returns.is_empty() || volatility == 0.0 {
            return 0.0;
        }
        
        let mean_return = returns.iter().sum::<f64>() / returns.len() as f64;
        let annualized_return = mean_return * self.periods_per_year;
        
        (annualized_return - self.risk_free_rate) / volatility
    }

    /// Calculate Sortino ratio
    fn calculate_sortino(&self, returns: &[f64], downside_vol: f64) -> f64 {
        if returns.is_empty() || downside_vol == 0.0 {
            return 0.0;
        }
        
        let mean_return = returns.iter().sum::<f64>() / returns.len() as f64;
        let annualized_return = mean_return * self.periods_per_year;
        
        (annualized_return - self.risk_free_rate) / downside_vol
    }

    /// Calculate VaR and CVaR at 95% confidence
    fn calculate_var(&self, returns: &[f64]) -> (f64, f64) {
        if returns.is_empty() {
            return (0.0, 0.0);
        }
        
        let mut sorted: Vec<f64> = returns.to_vec();
        sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        
        // 5th percentile for 95% VaR
        let var_index = (sorted.len() as f64 * 0.05).floor() as usize;
        let var_95 = sorted.get(var_index).copied().unwrap_or(0.0);
        
        // CVaR is the average of returns below VaR
        let tail: Vec<f64> = sorted.iter()
            .take(var_index + 1)
            .copied()
            .collect();
        
        let cvar_95 = if !tail.is_empty() {
            tail.iter().sum::<f64>() / tail.len() as f64
        } else {
            var_95
        };
        
        (var_95.abs(), cvar_95.abs())
    }

    /// Calculate metrics with benchmark comparison
    pub fn calculate_with_benchmark(
        &self,
        equity_curve: &[EquityPoint],
        benchmark_returns: &[f64],
        trade_stats: TradeStats,
    ) -> BacktestMetrics {
        let mut metrics = self.calculate(equity_curve, trade_stats);
        
        let equities: Vec<f64> = equity_curve.iter().map(|e| e.equity).collect();
        let strategy_returns = self.calculate_returns(&equities);
        
        if strategy_returns.len() != benchmark_returns.len() {
            return metrics;
        }
        
        // Calculate beta
        let beta = self.calculate_beta(&strategy_returns, benchmark_returns);
        metrics.beta = beta;
        
        // Calculate alpha
        let mean_strategy = strategy_returns.iter().sum::<f64>() / strategy_returns.len() as f64;
        let mean_benchmark = benchmark_returns.iter().sum::<f64>() / benchmark_returns.len() as f64;
        let annualized_strategy = mean_strategy * self.periods_per_year;
        let annualized_benchmark = mean_benchmark * self.periods_per_year;
        
        metrics.alpha = annualized_strategy - (self.risk_free_rate + beta * (annualized_benchmark - self.risk_free_rate));
        
        // Information ratio
        let tracking_returns: Vec<f64> = strategy_returns.iter()
            .zip(benchmark_returns.iter())
            .map(|(s, b)| s - b)
            .collect();
        
        let tracking_mean = tracking_returns.iter().sum::<f64>() / tracking_returns.len() as f64;
        let tracking_vol = {
            let variance = tracking_returns.iter()
                .map(|r| (r - tracking_mean).powi(2))
                .sum::<f64>() / tracking_returns.len() as f64;
            variance.sqrt() * self.periods_per_year.sqrt()
        };
        
        metrics.information_ratio = if tracking_vol > 0.0 {
            (tracking_mean * self.periods_per_year) / tracking_vol
        } else {
            0.0
        };
        
        // Treynor ratio
        metrics.treynor_ratio = if beta.abs() > 0.001 {
            (annualized_strategy - self.risk_free_rate) / beta
        } else {
            0.0
        };
        
        metrics
    }

    /// Calculate beta relative to benchmark
    fn calculate_beta(&self, strategy_returns: &[f64], benchmark_returns: &[f64]) -> f64 {
        if strategy_returns.len() != benchmark_returns.len() || strategy_returns.is_empty() {
            return 1.0;
        }
        
        let mean_s = strategy_returns.iter().sum::<f64>() / strategy_returns.len() as f64;
        let mean_b = benchmark_returns.iter().sum::<f64>() / benchmark_returns.len() as f64;
        
        let covariance: f64 = strategy_returns.iter()
            .zip(benchmark_returns.iter())
            .map(|(s, b)| (s - mean_s) * (b - mean_b))
            .sum::<f64>() / strategy_returns.len() as f64;
        
        let variance_b: f64 = benchmark_returns.iter()
            .map(|b| (b - mean_b).powi(2))
            .sum::<f64>() / benchmark_returns.len() as f64;
        
        if variance_b > 0.0 {
            covariance / variance_b
        } else {
            1.0
        }
    }
}

impl Default for MetricsCalculator {
    fn default() -> Self {
        Self::new(0.02, "1h")  // 2% risk-free rate, hourly data
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn create_equity_curve(values: Vec<f64>) -> Vec<EquityPoint> {
        values.iter().enumerate().map(|(i, &v)| {
            EquityPoint {
                timestamp: Utc::now(),
                equity: v,
                cash: v,
                positions_value: 0.0,
                drawdown: 0.0,
                drawdown_pct: 0.0,
            }
        }).collect()
    }

    #[test]
    fn test_total_return() {
        let calc = MetricsCalculator::new(0.02, "1d");
        let curve = create_equity_curve(vec![100.0, 110.0, 120.0]);
        
        let metrics = calc.calculate(&curve, TradeStats::default());
        
        assert!((metrics.total_return - 20.0).abs() < 0.1);
    }

    #[test]
    fn test_max_drawdown() {
        let calc = MetricsCalculator::new(0.02, "1d");
        let curve = create_equity_curve(vec![100.0, 110.0, 90.0, 95.0]);
        
        let metrics = calc.calculate(&curve, TradeStats::default());
        
        // Max DD should be (110 - 90) / 110 = 18.18%
        assert!((metrics.max_drawdown - 18.18).abs() < 1.0);
    }

    #[test]
    fn test_volatility() {
        let calc = MetricsCalculator::new(0.02, "1d");
        let curve = create_equity_curve(vec![100.0, 101.0, 99.0, 102.0, 98.0]);
        
        let metrics = calc.calculate(&curve, TradeStats::default());
        
        assert!(metrics.volatility > 0.0);
    }
}

