# Copy Trading Development Setup Guide

This guide helps you set up the copy trading system for development with proper API endpoints.

## 🚀 **Quick Start (Mock Data Mode)**

The copy trading system is now configured to work with mock data when API endpoints are not available. This means you can:

1. **Start the frontend immediately** - No backend setup required
2. **See realistic data** - Mock data simulates real trading scenarios
3. **Test all features** - Full UI functionality without API dependencies

## 🔧 **Current Status**

✅ **Frontend Ready**: Copy trading UI with mock data
✅ **Error Handling**: Graceful fallback to mock data
✅ **All Features Working**: Broker selection, authentication, verification
❌ **Backend APIs**: Need to be implemented for production

## 📊 **Mock Data Features**

The system includes comprehensive mock data for:

- **Master Traders**: 2 sample traders with different strategies
- **Follower Relationships**: Active and paused relationships
- **Trade Signals**: Recent BTC and ETH trades
- **Execution Results**: Success and failure scenarios
- **Copy Trading Sessions**: Completed and failed sessions
- **Performance Metrics**: Realistic trading performance data
- **Risk Limits**: Sample risk management settings

## 🛠️ **Setting Up Real APIs**

When you're ready to connect to real APIs, follow these steps:

### 1. **Backend API Setup**

Create the following API endpoints in your backend:

```python
# Example FastAPI endpoints
from fastapi import FastAPI, HTTPException
from typing import List, Dict, Any

app = FastAPI()

@app.get("/api/copy-trading/master-traders")
async def get_master_traders():
    # Return list of master traders
    return []

@app.get("/api/copy-trading/follower-relationships")
async def get_follower_relationships():
    # Return follower relationships
    return []

@app.get("/api/copy-trading/trade-signals")
async def get_trade_signals():
    # Return trade signals
    return []

@app.get("/api/copy-trading/execution-results")
async def get_execution_results():
    # Return execution results
    return []

@app.get("/api/copy-trading/sessions")
async def get_copy_trading_sessions():
    # Return copy trading sessions
    return []

@app.get("/api/copy-trading/performance-metrics")
async def get_performance_metrics():
    # Return performance metrics
    return {}

@app.get("/api/copy-trading/risk-limits")
async def get_risk_limits():
    # Return risk limits
    return {}

@app.get("/api/copy-trading/platform-connections")
async def get_platform_connections():
    # Return platform connections
    return []
```

### 2. **Environment Configuration**

Create a `.env` file in your project root:

```env
# API Configuration
VITE_API_BASE_URL=http://localhost:8000
VITE_USE_MOCK_DATA=false

# Database
DATABASE_URL=postgresql://user:password@localhost/wagyu

# Security
JWT_SECRET=your_jwt_secret_here
ENCRYPTION_KEY=your_encryption_key_here

# Trading Platforms
BINANCE_API_KEY=your_binance_key
BINANCE_SECRET_KEY=your_binance_secret
COINBASE_API_KEY=your_coinbase_key
COINBASE_SECRET_KEY=your_coinbase_secret
```

### 3. **Frontend Configuration**

Update the API calls in `CopyTrader.tsx` to use environment variables:

```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true';

const loadMasterTraders = async (): Promise<MasterTraderProfile[]> => {
  if (USE_MOCK_DATA) {
    return generateMockMasterTraders();
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/copy-trading/master-traders`);
    if (!response.ok) throw new Error('Failed to load master traders');
    return await response.json();
  } catch (error) {
    console.error('Error loading master traders:', error);
    return generateMockMasterTraders();
  }
};
```

## 🧪 **Testing the System**

### 1. **Mock Data Testing**

With the current setup, you can test:

- ✅ Broker selection and authentication flows
- ✅ Master trader discovery and following
- ✅ Performance analytics and metrics
- ✅ Risk management settings
- ✅ Copy trading dashboard
- ✅ Verification system

### 2. **API Integration Testing**

When you implement the APIs, test:

- ✅ Data loading from real endpoints
- ✅ Error handling and fallbacks
- ✅ Real-time updates
- ✅ Authentication flows
- ✅ Trade execution

## 🔍 **Debugging**

### Console Messages

The system provides helpful console messages:

```
✅ API returned JSON response, using real data
⚠️ API returned non-JSON response, using mock data for trade signals
ℹ️ Using mock data for master traders
❌ Error loading execution results: Network error
```

### Common Issues

1. **HTML Response Instead of JSON**
   - **Cause**: API endpoint returns 404 or error page
   - **Solution**: Implement the API endpoint or check URL

2. **CORS Errors**
   - **Cause**: Frontend and backend on different ports
   - **Solution**: Configure CORS in backend or use proxy

3. **Network Errors**
   - **Cause**: Backend not running or wrong URL
   - **Solution**: Start backend server or check API_BASE_URL

## 📈 **Production Deployment**

### 1. **Backend Deployment**

Deploy your FastAPI backend with:

```bash
# Using Docker
docker build -t copy-trading-api .
docker run -p 8000:8000 copy-trading-api

# Using Gunicorn
gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app
```

### 2. **Frontend Deployment**

Deploy your React frontend:

```bash
# Build for production
npm run build

# Serve with nginx or similar
nginx -s reload
```

### 3. **Environment Variables**

Set production environment variables:

```bash
export VITE_API_BASE_URL=https://api.yourdomain.com
export VITE_USE_MOCK_DATA=false
```

## 🎯 **Next Steps**

1. **Start Development**: The system works with mock data immediately
2. **Implement APIs**: Add real backend endpoints when ready
3. **Test Integration**: Switch to real APIs and test thoroughly
4. **Deploy Production**: Deploy both frontend and backend

## 📚 **Additional Resources**

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Development Guide](https://react.dev/learn)
- [Copy Trading System Architecture](./COPY_TRADING_SYSTEM_README.md)
- [Testing and Verification Guide](./COPY_TRADING_TESTING_GUIDE.md)

The copy trading system is now ready for development with comprehensive mock data and graceful error handling!




