# WagYu Event-Driven Backtesting Engine

A professional-grade backtesting system with a Rust core, Python orchestration, real-time WebSocket streaming, and a QuantConnect-style UI.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend                           │
│  QuantTesting.tsx (Recharts + WebSocket client)            │
│  - Multi-strategy equity curves                             │
│  - Parameter optimization scatter plots                     │
│  - Real-time progress streaming                             │
└────────────────────────┬────────────────────────────────────┘
                         │ WebSocket
┌────────────────────────▼────────────────────────────────────┐
│              Python Orchestrator (FastAPI)                  │
│  - Strategy validation & execution                          │
│  - Job queue management                                     │
│  - WebSocket server for UI streaming                        │
│  - Empyrical metrics calculation                            │
└────────────────────────┬────────────────────────────────────┘
                         │ PyO3 FFI
┌────────────────────────▼────────────────────────────────────┐
│              Rust Backtesting Core                          │
│  - Event loop (DataFeed → Strategy → Broker → Portfolio)   │
│  - Order lifecycle simulation (Market, Limit, Stop)         │
│  - Parallel parameter optimization with Rayon               │
└─────────────────────────────────────────────────────────────┘
```

## Features

### 1. Rust Event-Driven Engine (`backtest-engine/`)

- **Event Loop**: Processes events in order: MarketData → Signal → Order → Fill → Portfolio
- **DataFeed**: Load OHLCV from CSV, Parquet, or JSON
- **Brokerage Model**: Simulates fees (maker/taker), slippage, margin
- **Portfolio Manager**: Tracks cash, positions, equity curve, P&L
- **Order Manager**: Full order lifecycle (Submitted → Pending → Filled/Cancelled)
- **Parallel Optimization**: Grid search with Rayon for multi-threaded execution

### 2. Python Orchestration (`python-backend/engine/`)

- **BacktestRunner**: Orchestrates backtests with real-time callbacks
- **StrategyExecutor**: Safely executes user Python strategies in a sandbox
- **DataLoader**: Loads data from CSV/Parquet/CCXT with caching
- **Metrics**: Full Empyrical integration for Sharpe, Sortino, Alpha, Beta, VaR, etc.

### 3. WebSocket Streaming (`python-backend/ws_server.py`)

- Real-time progress updates
- Live equity curve streaming
- Trade execution notifications
- Parameter optimization progress

### 4. QuantConnect-Style UI (`src/pages/QuantTesting.tsx`)

- Multiple strategy equity curves overlaid
- Parameter optimization scatter plots (Sharpe, Drawdown, CAGR)
- Status panel (Completed/Failed/Running/Queue)
- Parameter min/max configuration
- Server statistics

## Quick Start

### Prerequisites

- Rust 1.70+ (for backtest engine)
- Python 3.10+ (for orchestration)
- Node.js 18+ (for frontend)

### Install Dependencies

```bash
# Python dependencies
cd python-backend
pip install -r requirements.txt

# Rust engine (optional - for maximum performance)
cd backtest-engine
cargo build --release

# Frontend
npm install
```

### Run Development Server

```bash
# Start Python backend
cd python-backend
python main.py

# Start frontend (in another terminal)
npm run dev
```

### Access the Platform

Navigate to `http://localhost:8080/app/quant-testing`

## Usage

### 1. Write a Strategy

```python
class MyStrategy:
    def __init__(self):
        self.rsi_period = 14
        self.rsi_oversold = 30
        self.rsi_overbought = 70
    
    def Initialize(self):
        pass
    
    def OnData(self, data):
        if len(data) < self.rsi_period + 1:
            return 0
        
        # Your strategy logic here
        rsi = self.calculate_rsi(data['close']).iloc[-1]
        
        if rsi < self.rsi_oversold:
            return 1  # Buy signal
        elif rsi > self.rsi_overbought:
            return -1  # Sell signal
        return 0  # Hold
```

### 2. Run a Backtest

1. Open the QuantTesting page
2. Select or write a strategy
3. Configure parameters (symbol, dates, capital)
4. Click "Backtest" to run a single test
5. Click "Optimize" to run parameter optimization

### 3. View Results

- **Equity Curve**: Shows portfolio value over time
- **Scatter Plots**: Visualize parameter sensitivity
- **Metrics**: Sharpe, Sortino, Max Drawdown, Win Rate, etc.

## API Reference

### REST Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/strategy/compile` | POST | Validate strategy code |
| `/api/strategy/execute` | POST | Run a backtest |
| `/api/backtest/start` | POST | Start async backtest job |
| `/api/backtest/{id}/status` | GET | Get job status |
| `/api/optimization/start` | POST | Start parameter optimization |

### WebSocket Endpoints

| Endpoint | Description |
|----------|-------------|
| `/ws/backtest/{job_id}` | Subscribe to specific job updates |
| `/ws/backtests` | Subscribe to all job updates |

### WebSocket Message Types

```typescript
interface WSMessage {
  type: 'progress' | 'complete' | 'error' | 'optimization_progress';
  job_id: string;
  data: {
    progress?: number;
    equity?: number;
    result?: BacktestResult;
    error?: string;
  };
}
```

## Performance Metrics

The engine calculates all standard quantitative metrics:

| Metric | Description |
|--------|-------------|
| Total Return | Cumulative return over the period |
| Annual Return | Annualized return (CAGR) |
| Sharpe Ratio | Risk-adjusted return (vs risk-free rate) |
| Sortino Ratio | Downside risk-adjusted return |
| Calmar Ratio | Return / Max Drawdown |
| Max Drawdown | Largest peak-to-trough decline |
| Volatility | Annualized standard deviation |
| Win Rate | Percentage of winning trades |
| Profit Factor | Gross profits / Gross losses |
| VaR (95%) | Value at Risk at 95% confidence |
| CVaR (95%) | Conditional VaR (Expected Shortfall) |

## Data Sources

### Supported Exchanges (via CCXT)

- Binance
- Coinbase
- Kraken
- KuCoin
- Bybit
- OKX

### Supported File Formats

- CSV (timestamp, open, high, low, close, volume)
- Parquet (for large datasets)
- JSON (array of OHLCV objects)

## Caching

OHLCV data is automatically cached to Parquet files:

```
data/cache/
├── binance/
│   ├── BTC_USDT_1h.parquet
│   ├── ETH_USDT_1h.parquet
│   └── ...
└── coinbase/
    └── ...
```

## Files Created

```
backtest-engine/
├── Cargo.toml
├── README.md
├── src/
│   ├── lib.rs          # PyO3 bindings
│   ├── events.rs       # Event types
│   ├── config.rs       # Configuration
│   ├── datafeed.rs     # Data loading
│   ├── brokerage.rs    # Fee/slippage simulation
│   ├── portfolio.rs    # Position tracking
│   ├── order_manager.rs
│   ├── metrics.rs      # Performance metrics
│   └── engine.rs       # Main event loop
└── benches/
    └── engine_benchmark.rs

python-backend/
├── engine/
│   ├── __init__.py
│   ├── backtest_runner.py  # Main orchestration
│   ├── metrics.py          # Empyrical integration
│   ├── strategy_executor.py # Safe strategy execution
│   └── data_loader.py      # Data loading + caching
├── ws_server.py            # WebSocket server
└── requirements.txt        # Updated with new deps

src/pages/
└── QuantTesting.tsx        # QuantConnect-style UI
```

## License

MIT

