# Universal Copy Trading System

A comprehensive copy trading platform that allows users to automatically replicate trades from master traders across multiple platforms including crypto exchanges, NinjaTrader, Rithmic, and other supported brokers.

## 🚀 Features

### Core Functionality
- **Multi-Platform Execution Engine**: Unified API supporting crypto exchanges (Binance, Coinbase, Kraken, KuCoin, Bybit, OKX) and futures platforms (NinjaTrader, Rithmic, Interactive Brokers)
- **Real-Time Trade Replication**: Sub-100ms latency for crypto, sub-500ms for traditional platforms
- **Master-Trader Discovery**: Performance-based ranking, risk metric analysis, strategy categorization
- **Risk Management Framework**: Per-follower position sizing, max drawdown/daily loss limits, correlation risk, circuit breakers
- **Performance Analytics**: Comprehensive reporting and monitoring

### Security & Compliance
- **Encrypted Credential Storage**: Secure storage of platform credentials using Fernet encryption
- **Comprehensive Audit Trail**: Full logging of all user actions and system events
- **Regulatory Compliance**: KYC validation, trade reporting, compliance monitoring
- **Security Monitoring**: Anomaly detection, risk limit monitoring, threat assessment

### Error Recovery & Reconciliation
- **Intelligent Retry Logic**: Configurable retry strategies based on error types
- **Trade Reconciliation**: Automated comparison of master and follower trades
- **Error Recovery**: Background processing of failed trades with exponential backoff
- **Manual Intervention**: Tools for handling complex error scenarios

## 📁 Project Structure

```
WagYu/
├── lean-service/
│   ├── services/
│   │   ├── copy_trading_engine.py          # Main copy trading orchestration
│   │   ├── universal_platform_adapters.py  # Platform-specific adapters
│   │   ├── real_time_replication_engine.py # Trade replication engine
│   │   ├── risk_management_system.py       # Risk management framework
│   │   ├── master_trader_discovery.py      # Trader discovery and ranking
│   │   ├── security_compliance.py          # Security and compliance
│   │   └── error_recovery.py               # Error recovery and reconciliation
│   ├── api/
│   │   ├── copy_trading.py                 # Copy trading API endpoints
│   │   └── error_recovery.py               # Error recovery API endpoints
│   └── database/
│       └── create_copy_trading_schema.sql  # Database schema
├── src/
│   ├── pages/
│   │   └── CopyTrader.tsx                  # Main copy trading page
│   └── components/
│       └── copy-trading/
│           ├── MasterTraderDiscovery.tsx   # Trader discovery component
│           ├── FollowerManagement.tsx      # Follower management
│           ├── PerformanceAnalytics.tsx    # Performance analytics
│           ├── CopyTradingDashboard.tsx    # Real-time dashboard
│           ├── RiskManagement.tsx          # Risk management interface
│           └── RealTimeMetrics.tsx         # Live metrics display
└── create_copy_trading_schema.sql          # Database schema
```

## 🗄️ Database Schema

The system uses a comprehensive database schema with the following key tables:

### Core Tables
- `copy_trading_profiles`: Master trader profiles and follower relationships
- `follower_relationships`: Active copy trading relationships
- `copy_trading_sessions`: Individual copy trading sessions
- `master_trades`: Trades from master traders
- `follower_trades`: Replicated trades for followers
- `risk_limits`: User-specific risk management settings

### Security Tables
- `security_audit_log`: Comprehensive audit trail
- `encrypted_credentials`: Encrypted platform credentials
- `user_verification`: KYC and compliance data

### Error Recovery Tables
- `error_events`: Error tracking and retry management
- `reconciliation_results`: Trade reconciliation results

## 🔧 Installation & Setup

### Prerequisites
- Python 3.8+
- Node.js 16+
- PostgreSQL 12+
- Redis (for caching)

### Backend Setup
```bash
cd lean-service
pip install -r requirements.txt

# Set environment variables
export DATABASE_URL="postgresql://user:password@localhost/wagyu"
export REDIS_URL="redis://localhost:6379"
export MASTER_KEY="your_encryption_master_key"

# Run database migrations
python -m alembic upgrade head

# Start the service
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

### Frontend Setup
```bash
cd src
npm install
npm run dev
```

### Database Setup
```bash
# Create database
createdb wagyu

# Run schema creation
psql -d wagyu -f create_copy_trading_schema.sql
```

## 🚀 Usage

### 1. Master Trader Setup
```python
# Create master trader profile
from lean_service.services.master_trader_discovery import MasterTraderDiscovery

discovery = MasterTraderDiscovery(db_engine)
profile = discovery.create_master_profile(
    user_id="user123",
    profile_name="Crypto Scalper",
    strategy_type="scalping",
    risk_level="aggressive",
    bio="Professional crypto scalper with 5+ years experience"
)
```

### 2. Follower Setup
```python
# Follow a master trader
from lean_service.services.copy_trading_engine import CopyTradingEngine

engine = CopyTradingEngine(db_engine)
relationship = engine.follow_trader(
    follower_id="follower123",
    master_trader_id="master456",
    allocated_capital=10000,
    position_sizing="proportional"
)
```

### 3. Risk Management
```python
# Set risk limits
from lean_service.services.risk_management_system import RiskManagementSystem

risk_manager = RiskManagementSystem(db_engine)
risk_manager.set_risk_limits(
    user_id="follower123",
    max_daily_loss=1000,
    max_drawdown=0.15,
    max_position_size=5000
)
```

### 4. Platform Integration
```python
# Connect to trading platform
from lean_service.services.universal_platform_adapters import CryptoCopyAdapter

adapter = CryptoCopyAdapter()
adapter.connect(
    platform="binance",
    api_key="your_api_key",
    secret_key="your_secret_key"
)
```

## 📊 API Endpoints

### Copy Trading
- `POST /api/copy-trading/start` - Start copy trading
- `POST /api/copy-trading/stop` - Stop copy trading
- `GET /api/copy-trading/status/{config_id}` - Get status
- `POST /api/copy-trading/pause` - Pause copy trading
- `POST /api/copy-trading/resume` - Resume copy trading

### Error Recovery
- `POST /api/error-recovery/log-error` - Log error event
- `GET /api/error-recovery/pending-retries` - Get pending retries
- `POST /api/error-recovery/process-retry` - Process retry
- `POST /api/error-recovery/reconcile-trade` - Reconcile trade

### Master Trader Discovery
- `GET /api/master-traders` - List master traders
- `GET /api/master-traders/{trader_id}` - Get trader details
- `POST /api/master-traders/follow` - Follow trader
- `POST /api/master-traders/unfollow` - Unfollow trader

## 🔒 Security Features

### Encryption
- All sensitive data encrypted using Fernet encryption
- Master key derived using PBKDF2 with 100,000 iterations
- Platform credentials stored encrypted in database

### Audit Trail
- Comprehensive logging of all user actions
- Security event tracking
- Compliance reporting capabilities

### Risk Monitoring
- Real-time anomaly detection
- Risk limit enforcement
- Circuit breaker functionality

## 📈 Performance Metrics

### Key Success Metrics
- **Zero unapproved risk exposure**: All trades validated against risk limits
- **<1% failed trade replications**: High success rate with intelligent retry
- **Sub-200ms average replication latency**: Fast execution across platforms
- **99.9% system availability**: Robust error handling and recovery

### Monitoring
- Real-time performance dashboards
- Comprehensive analytics and reporting
- Platform-specific performance tracking
- Risk exposure monitoring

## 🛠️ Configuration

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost/wagyu
REDIS_URL=redis://localhost:6379

# Security
MASTER_KEY=your_encryption_master_key
JWT_SECRET=your_jwt_secret

# Trading Platforms
BINANCE_API_KEY=your_binance_key
BINANCE_SECRET_KEY=your_binance_secret
COINBASE_API_KEY=your_coinbase_key
COINBASE_SECRET_KEY=your_coinbase_secret

# Risk Management
MAX_DAILY_LOSS=1000
MAX_DRAWDOWN=0.15
CIRCUIT_BREAKER_ENABLED=true
```

### Risk Limits Configuration
```python
# Default risk limits
DEFAULT_RISK_LIMITS = {
    "max_daily_loss": 1000,
    "max_drawdown": 0.15,
    "max_position_size": 5000,
    "max_leverage": 10,
    "stop_loss_enabled": True,
    "take_profit_enabled": True,
    "correlation_limit": 0.8,
    "volatility_limit": 0.3,
    "circuit_breaker_enabled": True,
    "emergency_stop_loss": 0.05,
    "max_slippage": 0.01,
    "max_latency": 100
}
```

## 🔄 Error Recovery

### Retry Logic
- **Network Errors**: 1s, 5s, 15s, 1m, 5m delays
- **Rate Limit**: 1m, 5m, 15m, 1h delays
- **Timeout Errors**: 5s, 15s, 1m, 5m delays
- **Platform Errors**: 30s, 2m, 10m, 1h delays

### Reconciliation
- Automated trade comparison
- Discrepancy detection
- Resolution tracking
- Manual intervention tools

## 📋 Compliance

### Regulatory Requirements
- KYC validation before copy trading
- Trade reporting for regulatory compliance
- Audit trail maintenance
- Risk disclosure requirements

### Data Protection
- GDPR compliance
- Data encryption at rest and in transit
- Secure credential storage
- User consent management

## 🚀 Deployment

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d

# Scale services
docker-compose up -d --scale copy-trading-engine=3
```

### Production Considerations
- Use environment-specific configuration
- Implement proper logging and monitoring
- Set up database backups
- Configure load balancing
- Implement rate limiting
- Set up alerting for critical events

## 📚 Documentation

### API Documentation
- Swagger UI available at `/docs`
- OpenAPI specification at `/openapi.json`
- Postman collection available

### User Guides
- Master Trader Setup Guide
- Follower Management Guide
- Risk Management Guide
- Platform Integration Guide

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
- Contact the development team
- Check the documentation
- Review the troubleshooting guide

## 🔮 Roadmap

### Upcoming Features
- Mobile app for copy trading
- Advanced analytics and reporting
- Social trading features
- AI-powered risk management
- Additional platform integrations
- Institutional features

### Performance Improvements
- Microservices architecture
- Event-driven processing
- Advanced caching strategies
- Database optimization
- Network optimization

---

**Note**: This is a comprehensive copy trading system designed for production use. Ensure proper testing and security review before deploying to production environments.




