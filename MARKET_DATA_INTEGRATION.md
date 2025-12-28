# 📈 Market Data Integration Guide

This guide explains how to integrate CCXT and Python libraries with free APIs to get market data for the quant testing backtester.

## 🚀 Quick Start

### 1. Start the Market Data Service

```bash
# From the WagYu root directory
./start-market-data.sh
```

This will:
- Set up a Python virtual environment
- Install all required dependencies
- Start the market data service on port 8001

### 2. Access the Quant Testing Page

1. Navigate to `/app/quanttesting` in your WagYu application
2. Click on the "Market Data" tab
3. Select symbols and configure your backtest parameters
4. Load real-time and historical data

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Python Backend │    │   Data Sources  │
│   (React/Vite)  │◄──►│   (FastAPI)      │◄──►│                 │
│                 │    │                  │    │ • CCXT Exchanges│
│ • QuantTesting  │    │ • Market Data    │    │ • Yahoo Finance │
│ • Market Data   │    │   Service        │    │ • Alpha Vantage │
│   Tab           │    │ • Data Aggregator│    │ • Polygon.io    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 📊 Features

### Real-time Data
- Live price feeds from multiple exchanges
- Automatic fallback between data sources
- 5-second update intervals
- Support for crypto, stocks, forex, and commodities

### Historical Data
- OHLCV data with multiple timeframes (1m, 5m, 15m, 1h, 4h, 1d)
- Date range selection
- Bulk data loading for backtesting
- Data validation and cleaning

### Technical Indicators
- **Trend**: SMA, EMA, MACD
- **Momentum**: RSI, Stochastic Oscillator
- **Volatility**: Bollinger Bands, ATR
- **Volume**: Volume SMA, OBV

### Data Sources
- **CCXT Exchanges**: Binance, Coinbase, Kraken, Bitfinex, Huobi, OKX, Bybit, KuCoin
- **Yahoo Finance**: Global stocks, ETFs, indices
- **Alpha Vantage**: US stocks, forex, crypto (requires free API key)
- **Polygon.io**: US stocks, options, forex (requires free API key)

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the `python-backend` directory:

```bash
# API Keys (optional but recommended for higher rate limits)
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key_here
POLYGON_API_KEY=your_polygon_key_here
FINNHUB_API_KEY=your_finnhub_key_here

# Server Configuration
HOST=0.0.0.0
PORT=8001
DEBUG=True

# Rate Limiting
RATE_LIMIT_PER_MINUTE=60
MAX_CONCURRENT_REQUESTS=10

# Data Sources Priority
PREFERRED_DATA_SOURCE=alpha_vantage
FALLBACK_DATA_SOURCES=yfinance,ccxt
```

### Free API Keys

#### Alpha Vantage (Recommended)
- **Sign up**: https://www.alphavantage.co/support/#api-key
- **Free tier**: 5 calls per minute, 500 calls per day
- **Best for**: US stocks, forex, crypto

#### Polygon.io
- **Sign up**: https://polygon.io/pricing
- **Free tier**: 5 calls per minute
- **Best for**: US stocks, options, forex

#### Finnhub
- **Sign up**: https://finnhub.io/register
- **Free tier**: 60 calls per minute
- **Best for**: Global stocks, news, sentiment

## 📱 Frontend Integration

### Market Data Service

The frontend uses the `marketDataService` to communicate with the Python backend:

```typescript
import { marketDataService } from '@/lib/services/marketDataService';

// Get available symbols
const symbols = await marketDataService.getAvailableSymbols();

// Get real-time data
const realTimeData = await marketDataService.getRealTimeData('BTC/USDT');

// Get backtest data
const backtestData = await marketDataService.getBacktestData({
  symbols: ['BTC/USDT', 'ETH/USDT'],
  timeframe: '1h',
  start_date: '2024-01-01T00:00:00Z',
  end_date: '2024-01-31T23:59:59Z',
  include_indicators: true
});
```

### Quant Testing Page

The Quant Testing page now includes a "Market Data" tab with:

- **Symbol Selection**: Choose from available trading symbols
- **Real-time Prices**: Live price feeds with 24h change
- **Backtest Configuration**: Set timeframe and date range
- **Data Loading**: Load historical data for backtesting
- **Results Display**: View statistics and performance metrics

## 🔄 Data Flow

1. **Symbol Discovery**: Frontend requests available symbols from Python backend
2. **Real-time Updates**: Backend fetches live prices from multiple sources
3. **Historical Data**: Backend aggregates OHLCV data for selected timeframes
4. **Technical Analysis**: Backend calculates technical indicators
5. **Backtest Preparation**: Data is formatted for backtesting algorithms

## 🚨 Troubleshooting

### Common Issues

1. **"Python backend not available"**
   - Ensure the Python service is running: `./start-market-data.sh`
   - Check if port 8001 is available
   - Verify the service started without errors

2. **Rate limiting errors**
   - Add API keys for higher rate limits
   - Reduce concurrent requests in configuration
   - Check rate limiting settings

3. **Data source failures**
   - The service automatically falls back to other sources
   - Check your internet connection
   - Verify API keys are correct

### Debug Mode

```bash
cd python-backend
source venv/bin/activate
DEBUG=True python start.py
```

## 📊 API Endpoints

### Health Check
```http
GET http://localhost:8001/
```

### Get Available Symbols
```http
GET http://localhost:8001/api/symbols?exchange=binance&market_type=spot
```

### Get OHLCV Data
```http
GET http://localhost:8001/api/ohlcv/BTC/USDT?timeframe=1h&limit=100
```

### Get Backtest Data
```http
POST http://localhost:8001/api/backtest-data
Content-Type: application/json

{
  "symbols": ["BTC/USDT", "ETH/USDT"],
  "timeframe": "1h",
  "start_date": "2024-01-01T00:00:00Z",
  "end_date": "2024-01-31T23:59:59Z",
  "include_indicators": true,
  "indicators": ["sma_20", "rsi_14", "macd"]
}
```

### Get Real-time Data
```http
GET http://localhost:8001/api/real-time/BTC/USDT
```

## 🔧 Development

### Adding New Data Sources

1. Create a new method in `MarketDataService`
2. Add the source to the fallback chain
3. Update the configuration options
4. Test with the new source

### Adding New Technical Indicators

1. Add the indicator to `DataAggregator`
2. Update the indicator list in the frontend
3. Test the calculation accuracy

### Customizing Rate Limits

Edit the configuration in `python-backend/config.py`:

```python
# Rate Limiting
rate_limit_per_minute: int = 60
max_concurrent_requests: int = 10
```

## 📈 Performance

### Optimization Tips

1. **Use API Keys**: Sign up for free API keys to get higher rate limits
2. **Cache Data**: The service includes Redis caching for frequently requested data
3. **Batch Requests**: Load multiple symbols in a single request
4. **Selective Indicators**: Only calculate needed technical indicators

### Monitoring

- Check service health: `curl http://localhost:8001/`
- View API docs: `http://localhost:8001/docs`
- Monitor logs in the terminal output

## 🎯 Next Steps

1. **Start the service**: Run `./start-market-data.sh`
2. **Get API keys**: Sign up for free API keys (optional)
3. **Test the integration**: Visit the Market Data tab in Quant Testing
4. **Configure your symbols**: Select the assets you want to trade
5. **Load historical data**: Set up your backtest parameters
6. **Run backtests**: Use the loaded data for strategy testing

---

**Happy Trading! 📈**
