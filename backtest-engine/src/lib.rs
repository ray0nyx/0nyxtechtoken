//! WagYu Backtest Engine
//! 
//! High-performance event-driven backtesting engine with Python bindings.
//! 
//! # Architecture
//! 
//! The engine processes events in this order:
//! MarketData → Signal → Order → Fill → Portfolio Update
//! 
//! # Modules
//! 
//! - `events`: Event types for the event loop
//! - `datafeed`: OHLCV data loading from Parquet/CSV
//! - `brokerage`: Fee, slippage, and margin simulation
//! - `portfolio`: Position tracking and equity calculation
//! - `order_manager`: Order lifecycle management
//! - `engine`: Main event loop and backtest orchestration

pub mod events;
pub mod datafeed;
pub mod brokerage;
pub mod portfolio;
pub mod order_manager;
pub mod engine;
pub mod metrics;
pub mod config;

use pyo3::prelude::*;
use pyo3::types::PyDict;

/// Python module for the backtest engine
#[pymodule]
fn backtest_engine(_py: Python, m: &PyModule) -> PyResult<()> {
    m.add_class::<PyBacktestEngine>()?;
    m.add_class::<PyBacktestConfig>()?;
    m.add_class::<PyBacktestResult>()?;
    m.add_function(wrap_pyfunction!(run_backtest, m)?)?;
    m.add_function(wrap_pyfunction!(run_optimization, m)?)?;
    Ok(())
}

/// Python-exposed backtest configuration
#[pyclass]
#[derive(Clone)]
pub struct PyBacktestConfig {
    #[pyo3(get, set)]
    pub initial_capital: f64,
    #[pyo3(get, set)]
    pub start_date: String,
    #[pyo3(get, set)]
    pub end_date: String,
    #[pyo3(get, set)]
    pub symbols: Vec<String>,
    #[pyo3(get, set)]
    pub timeframe: String,
    #[pyo3(get, set)]
    pub maker_fee: f64,
    #[pyo3(get, set)]
    pub taker_fee: f64,
    #[pyo3(get, set)]
    pub slippage_pct: f64,
}

#[pymethods]
impl PyBacktestConfig {
    #[new]
    fn new(
        initial_capital: f64,
        start_date: String,
        end_date: String,
        symbols: Vec<String>,
        timeframe: String,
    ) -> Self {
        Self {
            initial_capital,
            start_date,
            end_date,
            symbols,
            timeframe,
            maker_fee: 0.001,  // 0.1% default
            taker_fee: 0.001,
            slippage_pct: 0.0005,  // 0.05% default
        }
    }
}

/// Python-exposed backtest result
#[pyclass]
#[derive(Clone)]
pub struct PyBacktestResult {
    #[pyo3(get)]
    pub total_return: f64,
    #[pyo3(get)]
    pub annual_return: f64,
    #[pyo3(get)]
    pub volatility: f64,
    #[pyo3(get)]
    pub sharpe_ratio: f64,
    #[pyo3(get)]
    pub sortino_ratio: f64,
    #[pyo3(get)]
    pub calmar_ratio: f64,
    #[pyo3(get)]
    pub max_drawdown: f64,
    #[pyo3(get)]
    pub max_drawdown_duration: i64,
    #[pyo3(get)]
    pub win_rate: f64,
    #[pyo3(get)]
    pub profit_factor: f64,
    #[pyo3(get)]
    pub total_trades: i64,
    #[pyo3(get)]
    pub winning_trades: i64,
    #[pyo3(get)]
    pub losing_trades: i64,
    #[pyo3(get)]
    pub average_win: f64,
    #[pyo3(get)]
    pub average_loss: f64,
    #[pyo3(get)]
    pub equity_curve: Vec<f64>,
    #[pyo3(get)]
    pub timestamps: Vec<String>,
    #[pyo3(get)]
    pub trades: Vec<String>,  // JSON serialized trades
}

#[pymethods]
impl PyBacktestResult {
    fn to_dict(&self, py: Python) -> PyResult<PyObject> {
        let dict = PyDict::new(py);
        dict.set_item("total_return", self.total_return)?;
        dict.set_item("annual_return", self.annual_return)?;
        dict.set_item("volatility", self.volatility)?;
        dict.set_item("sharpe_ratio", self.sharpe_ratio)?;
        dict.set_item("sortino_ratio", self.sortino_ratio)?;
        dict.set_item("calmar_ratio", self.calmar_ratio)?;
        dict.set_item("max_drawdown", self.max_drawdown)?;
        dict.set_item("max_drawdown_duration", self.max_drawdown_duration)?;
        dict.set_item("win_rate", self.win_rate)?;
        dict.set_item("profit_factor", self.profit_factor)?;
        dict.set_item("total_trades", self.total_trades)?;
        dict.set_item("winning_trades", self.winning_trades)?;
        dict.set_item("losing_trades", self.losing_trades)?;
        dict.set_item("average_win", self.average_win)?;
        dict.set_item("average_loss", self.average_loss)?;
        dict.set_item("equity_curve", self.equity_curve.clone())?;
        dict.set_item("timestamps", self.timestamps.clone())?;
        Ok(dict.into())
    }
}

/// Python-exposed backtest engine
#[pyclass]
pub struct PyBacktestEngine {
    engine: engine::BacktestEngine,
}

#[pymethods]
impl PyBacktestEngine {
    #[new]
    fn new(config: PyBacktestConfig) -> PyResult<Self> {
        let rust_config = config::BacktestConfig {
            initial_capital: config.initial_capital,
            start_date: config.start_date,
            end_date: config.end_date,
            symbols: config.symbols,
            timeframe: config.timeframe,
            maker_fee: config.maker_fee,
            taker_fee: config.taker_fee,
            slippage_pct: config.slippage_pct,
        };
        
        Ok(Self {
            engine: engine::BacktestEngine::new(rust_config),
        })
    }

    fn load_data(&mut self, data_path: String) -> PyResult<()> {
        self.engine.load_data(&data_path)
            .map_err(|e| PyErr::new::<pyo3::exceptions::PyRuntimeError, _>(e.to_string()))
    }

    fn run(&mut self, strategy_signals: Vec<(String, i32)>) -> PyResult<PyBacktestResult> {
        let result = self.engine.run(strategy_signals)
            .map_err(|e| PyErr::new::<pyo3::exceptions::PyRuntimeError, _>(e.to_string()))?;
        
        Ok(result.into())
    }

    fn get_progress(&self) -> f64 {
        self.engine.get_progress()
    }

    fn get_current_equity(&self) -> f64 {
        self.engine.get_current_equity()
    }
}

/// Run a single backtest (convenience function)
#[pyfunction]
fn run_backtest(
    config: PyBacktestConfig,
    data_path: String,
    signals: Vec<(String, i32)>,
) -> PyResult<PyBacktestResult> {
    let mut engine = PyBacktestEngine::new(config)?;
    engine.load_data(data_path)?;
    engine.run(signals)
}

/// Run parameter optimization
#[pyfunction]
fn run_optimization(
    base_config: PyBacktestConfig,
    data_path: String,
    parameter_grid: Vec<(String, Vec<f64>)>,
    signals_generator: PyObject,
    py: Python,
) -> PyResult<Vec<(Vec<f64>, PyBacktestResult)>> {
    use rayon::prelude::*;
    
    // Generate all parameter combinations
    let combinations = generate_combinations(&parameter_grid);
    
    // Run backtests in parallel
    let results: Vec<_> = combinations
        .into_par_iter()
        .map(|params| {
            Python::with_gil(|py| {
                // Call Python signal generator with params
                let signals: Vec<(String, i32)> = signals_generator
                    .call1(py, (params.clone(),))
                    .and_then(|result| result.extract(py))
                    .unwrap_or_default();
                
                let mut engine = engine::BacktestEngine::new(config::BacktestConfig {
                    initial_capital: base_config.initial_capital,
                    start_date: base_config.start_date.clone(),
                    end_date: base_config.end_date.clone(),
                    symbols: base_config.symbols.clone(),
                    timeframe: base_config.timeframe.clone(),
                    maker_fee: base_config.maker_fee,
                    taker_fee: base_config.taker_fee,
                    slippage_pct: base_config.slippage_pct,
                });
                
                let _ = engine.load_data(&data_path);
                let result = engine.run(signals).unwrap_or_default();
                
                (params, result.into())
            })
        })
        .collect();
    
    Ok(results)
}

fn generate_combinations(grid: &[(String, Vec<f64>)]) -> Vec<Vec<f64>> {
    if grid.is_empty() {
        return vec![vec![]];
    }
    
    let (_, values) = &grid[0];
    let rest = generate_combinations(&grid[1..]);
    
    values
        .iter()
        .flat_map(|v| {
            rest.iter().map(move |r| {
                let mut combo = vec![*v];
                combo.extend(r.iter().cloned());
                combo
            })
        })
        .collect()
}

