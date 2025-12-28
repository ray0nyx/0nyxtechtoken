# WagYu Backtest Engine

High-performance event-driven backtesting engine written in Rust with Python bindings.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Engine                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐│
│  │ DataFeed │→ │ Brokerage│→ │ Portfolio│→ │ Metrics  ││
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘│
│       ↓             ↓             ↓                     │
│  ┌──────────────────────────────────────────────────┐  │
│  │                   Event Queue                     │  │
│  │  MarketData → Signal → Order → Fill → Update     │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Modules

### Events (`events.rs`)
- `MarketDataEvent` - OHLCV bar data
- `SignalEvent` - Trading signals (-1, 0, 1)
- `OrderEvent` - Order submission (Market, Limit, Stop)
- `FillEvent` - Order execution with fees/slippage
- `PortfolioUpdateEvent` - Position and equity updates

### DataFeed (`datafeed.rs`)
- Load OHLCV data from CSV, Parquet, or JSON
- Stream bars in chronological order
- Multi-symbol support with timestamp alignment

### Brokerage (`brokerage.rs`)
- Simulate realistic order execution
- Maker/taker fees
- Slippage (fixed + percentage + volume impact)
- Margin requirements
- Limit/Stop order fill simulation

### Portfolio (`portfolio.rs`)
- Cash and position tracking
- Equity curve generation
- Realized/unrealized P&L
- Trade history

### Metrics (`metrics.rs`)
- Sharpe Ratio
- Sortino Ratio
- Calmar Ratio
- Max Drawdown (value and duration)
- Alpha/Beta (with benchmark)
- VaR/CVaR at 95%
- Win rate, profit factor, etc.

### Order Manager (`order_manager.rs`)
- Order lifecycle management
- Open/filled/cancelled order tracking

### Engine (`engine.rs`)
- Main event loop orchestration
- Signal execution
- Position sizing

## Building

```bash
# Build the library
cargo build --release

# Run tests
cargo test

# Run benchmarks
cargo bench

# Build Python wheel
maturin build --release
```

## Python Usage

```python
from backtest_engine import PyBacktestConfig, PyBacktestEngine, run_backtest

# Create configuration
config = PyBacktestConfig(
    initial_capital=100000.0,
    start_date="2023-01-01",
    end_date="2024-01-01",
    symbols=["BTC/USDT"],
    timeframe="1h"
)

# Create engine
engine = PyBacktestEngine(config)

# Load data
engine.load_data("path/to/data.csv")

# Run with signals (timestamp, signal)
signals = [
    ("2023-01-01T00:00:00Z", 1),   # Buy
    ("2023-01-02T00:00:00Z", 0),   # Hold
    ("2023-01-03T00:00:00Z", -1),  # Sell
]

result = engine.run(signals)

print(f"Total Return: {result.total_return:.2f}%")
print(f"Sharpe Ratio: {result.sharpe_ratio:.2f}")
print(f"Max Drawdown: {result.max_drawdown:.2f}%")
```

## Parameter Optimization

```python
from backtest_engine import run_optimization

def generate_signals(params):
    rsi_period, rsi_threshold = params
    # Generate signals based on parameters
    return signals

parameter_grid = [
    ("rsi_period", [10.0, 14.0, 20.0, 30.0]),
    ("rsi_threshold", [25.0, 30.0, 35.0]),
]

results = run_optimization(config, data_path, parameter_grid, generate_signals)

for params, result in results:
    print(f"Params: {params}, Sharpe: {result.sharpe_ratio:.2f}")
```

## Performance

The engine is optimized for speed:
- Zero-copy data loading with memory mapping
- Parallel parameter optimization with Rayon
- Efficient event queue with binary heap
- Minimal allocations in hot path

Typical performance on M1 MacBook:
- 1M bars: ~500ms
- 10k parameter combinations: ~5s (parallelized)

## Data Format

### CSV
```csv
timestamp,open,high,low,close,volume
2023-01-01 00:00:00,50000.0,50100.0,49900.0,50050.0,1000.0
```

### JSON
```json
[
  {"symbol": "BTC/USDT", "timestamp": "2023-01-01T00:00:00Z", "open": 50000.0, "high": 50100.0, "low": 49900.0, "close": 50050.0, "volume": 1000.0}
]
```

## License

MIT

