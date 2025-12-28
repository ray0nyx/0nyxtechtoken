# 🚀 0nyx Market Data Service

A powerful Python backend service that provides real-time and historical market data using CCXT and free APIs for the 0nyx quant testing platform.

## ✨ Features

- **Multiple Data Sources**: CCXT exchanges, Yahoo Finance, Alpha Vantage
- **Real-time Data**: Live price feeds with WebSocket support
- **Historical Data**: OHLCV data with multiple timeframes
- **Technical Indicators**: Built-in calculation of 20+ technical indicators
- **Backtest Data**: Comprehensive data aggregation for backtesting
- **Rate Limiting**: Built-in rate limiting and caching
- **Fallback Support**: Graceful degradation when services are unavailable

## 🛠️ Installation

### Prerequisites

- Python 3.8 or higher
- pip (Python package manager)

### Quick Setup

1. **Clone and navigate to the backend directory:**
   ```bash
   cd python-backend
   ```

2. **Run the setup script:**
   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```

3. **Activate the virtual environment:**
   ```bash
   source venv/bin/activate
   ```

4. **Configure your API keys (optional but recommended):**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

5. **Start the service:**
   ```bash
   python start.py
   ```

The API will be available at `http://localhost:8001`

## 🔑 Free API Keys

### Alpha Vantage (Recommended)
- **Sign up**: https://www.alphavantage.co/support/#api-key
- **Free tier**: 5 calls per minute, 500 calls per day
- **Best for**: US stocks, forex, crypto

### Polygon.io
- **Sign up**: https://polygon.io/pricing
- **Free tier**: 5 calls per minute
- **Best for**: US stocks, options, forex

### Finnhub
- **Sign up**: https://finnhub.io/register
- **Free tier**: 60 calls per minute
- **Best for**: Global stocks, news, sentiment

## 📊 Supported Exchanges

### CCXT Exchanges (No API key required)
- **Binance**: Crypto spot and futures
- **Coinbase**: Crypto spot
- **Kraken**: Crypto spot and futures
- **Bitfinex**: Crypto spot and margin
- **Huobi**: Crypto spot and futures
- **OKX**: Crypto spot and futures
- **Bybit**: Crypto futures
- **KuCoin**: Crypto spot

### Free Data Sources
- **Yahoo Finance**: Global stocks, ETFs, indices
- **Alpha Vantage**: US stocks, forex, crypto
- **Polygon.io**: US stocks, options, forex

## 🚀 API Endpoints

### Health Check
```http
GET /
```

### Get Available Symbols
```http
GET /api/symbols?exchange=binance&market_type=spot
```

### Get OHLCV Data
```http
GET /api/ohlcv/BTC/USDT?timeframe=1h&limit=100&exchange=binance
```

### Get Backtest Data
```http
POST /api/backtest-data
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
GET /api/real-time/BTC/USDT?exchange=binance
```

### Get Supported Exchanges
```http
GET /api/exchanges
```

## 📈 Technical Indicators

The service automatically calculates these indicators:

- **Trend**: SMA, EMA, MACD
- **Momentum**: RSI, Stochastic Oscillator
- **Volatility**: Bollinger Bands, ATR
- **Volume**: Volume SMA, OBV

## 🔧 Configuration

### Environment Variables

```bash
# API Keys
ALPHA_VANTAGE_API_KEY=your_key_here
POLYGON_API_KEY=your_key_here
FINNHUB_API_KEY=your_key_here

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

## 🐳 Docker Support

```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8001

CMD ["python", "start.py"]
```

## 📊 Usage Examples

### Python Client
```python
import requests

# Get real-time data
response = requests.get('http://localhost:8001/api/real-time/BTC/USDT')
data = response.json()

# Get historical data
response = requests.get('http://localhost:8001/api/ohlcv/BTC/USDT?timeframe=1h&limit=100')
ohlcv = response.json()
```

### JavaScript/TypeScript Client
```typescript
// Using the provided marketDataService
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

## 🔍 Monitoring

### Health Check
```bash
curl http://localhost:8001/
```

### API Documentation
Visit `http://localhost:8001/docs` for interactive API documentation.

## 🚨 Troubleshooting

### Common Issues

1. **"Python backend not available"**
   - Ensure the Python service is running on port 8001
   - Check firewall settings
   - Verify the service started without errors

2. **Rate limiting errors**
   - Reduce the number of concurrent requests
   - Add API keys for higher limits
   - Check the rate limiting configuration

3. **Data source failures**
   - The service automatically falls back to other sources
   - Check your internet connection
   - Verify API keys are correct

### Logs
```bash
# View logs
tail -f logs/market_data.log

# Debug mode
DEBUG=True python start.py
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Check the documentation at `/docs`
- Review the troubleshooting section

---

**Happy Trading! 📈**
