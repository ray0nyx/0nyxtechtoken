# Multi-User Backtesting Platform with LEAN Engine

A comprehensive QuantConnect-style backtesting platform supporting hundreds of concurrent users with real-time progress updates, strategy marketplace, and advanced analytics.

## 🎯 Overview

This platform provides a complete solution for institutional-grade backtesting with:

- **Multi-tenant Architecture**: Support for hundreds of concurrent users
- **LEAN Engine Integration**: Full QuantConnect LEAN integration with Docker
- **Real-time Updates**: WebSocket-based progress monitoring
- **Strategy Marketplace**: Buy/sell strategies with performance scoring
- **Advanced Analytics**: Comprehensive performance metrics and visualization
- **Auto-scaling Infrastructure**: Dynamic worker scaling based on demand
- **Data Integration**: CCXT, yfinance, and custom data sources

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React Frontend │    │  LEAN Microservice │    │   TimescaleDB   │
│  (Next.js/TS)   │◄──►│   (Python/FastAPI)│◄──►│  (Market Data)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│    Supabase     │    │  Redis Queue     │    │   WebSocket     │
│ (Auth + Metadata)│    │  (Job Orchestration)│    │  (Real-time)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Data Service   │    │  Auto-scaler     │    │   Monitoring    │
│ (CCXT/yfinance) │    │  (Docker Swarm)  │    │ (Prometheus)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+
- Supabase account
- Exchange API keys (optional)

### 1. Clone and Setup

```bash
git clone <repository-url>
cd WagYu
cp .env.example .env
```

### 2. Environment Configuration

```bash
# Database
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
TIMESCALE_PASSWORD=secure_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Exchange APIs (optional)
POLYGON_API_KEY=your_polygon_key
BINANCE_API_KEY=your_binance_key
BINANCE_SECRET=your_binance_secret
COINBASE_API_KEY=your_coinbase_key
COINBASE_SECRET=your_coinbase_secret

# WebSocket
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:8002

# Monitoring
GRAFANA_PASSWORD=admin
```

### 3. Database Setup

```bash
# Run Supabase migrations
supabase db push

# Setup TimescaleDB
docker-compose up timescaledb -d
psql -h localhost -U wagyu_user -d wagyu_market_data -f scripts/setup-timescaledb.sql
```

### 4. Start Services

```bash
# Start all services
docker-compose up -d

# Or start specific services
docker-compose up -d redis timescaledb lean_service data_service websocket_service
```

### 5. Access the Platform

- **Frontend**: http://localhost:3000
- **LEAN Service**: http://localhost:8000
- **Data Service**: http://localhost:8001
- **WebSocket**: ws://localhost:8002
- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090

## 📊 Features

### 1. Strategy Editor

- **Monaco Editor**: Full-featured code editor with IntelliSense
- **Multi-language Support**: Python and C# strategies
- **Template Library**: Pre-built strategy templates
- **Real-time Validation**: Syntax and logic validation
- **Version Control**: Strategy versioning and history

### 2. Backtesting Engine

- **LEAN Integration**: Full QuantConnect LEAN engine
- **Docker-based**: Isolated execution environments
- **Auto-scaling**: Dynamic worker scaling
- **Resource Management**: CPU and memory limits
- **Progress Tracking**: Real-time progress updates

### 3. Results Dashboard

- **QuantConnect-style UI**: Familiar interface
- **Interactive Charts**: Equity curves, drawdowns, returns
- **Performance Metrics**: 20+ risk and return metrics
- **Trade Analysis**: Detailed trade history
- **Export Options**: PDF, CSV, JSON export

### 4. Strategy Marketplace

- **Strategy Sharing**: Public/private strategy sharing
- **Performance Scoring**: Automated strategy evaluation
- **Payment Integration**: Stripe-powered marketplace
- **Reviews & Ratings**: Community feedback system
- **Royalty Tracking**: Revenue sharing for creators

### 5. Data Management

- **Multiple Sources**: CCXT, yfinance, Polygon, custom
- **Real-time Data**: Live market data streaming
- **Data Caching**: Redis-based caching layer
- **User Uploads**: Custom data file support
- **Data Validation**: Quality checks and validation

## 🔧 Configuration

### Database Schema

The platform uses a comprehensive database schema with:

- **User Management**: Profiles, API keys, quotas
- **Strategy Management**: Code, versions, metadata
- **Backtesting**: Jobs, results, metrics, trades
- **Marketplace**: Listings, purchases, reviews
- **Monitoring**: System metrics, logs, alerts

### Job Queue System

Redis-based job queue with:

- **Priority Queuing**: High-priority jobs first
- **Rate Limiting**: Per-user and per-exchange limits
- **Retry Logic**: Exponential backoff for failures
- **Dead Letter Queue**: Failed job handling
- **Monitoring**: Queue depth and processing times

### Auto-scaling

Dynamic worker scaling based on:

- **Queue Depth**: Scale up when queue is full
- **CPU Usage**: Scale based on worker utilization
- **Memory Usage**: Scale based on memory consumption
- **Time-based**: Scale down during off-peak hours
- **Cost Optimization**: Balance performance and cost

## 📈 Monitoring

### Prometheus Metrics

- **Backtest Metrics**: Request count, duration, success rate
- **System Metrics**: CPU, memory, disk usage
- **Queue Metrics**: Queue depth, processing time
- **Custom Metrics**: Business-specific metrics

### Grafana Dashboards

- **System Overview**: High-level system health
- **Backtest Performance**: Success rates, durations
- **Resource Utilization**: CPU, memory, storage
- **User Activity**: Active users, API usage
- **Error Tracking**: Error rates and types

### Alerting

- **System Alerts**: High CPU, memory, disk usage
- **Queue Alerts**: Queue depth, processing delays
- **Error Alerts**: High error rates, failures
- **Business Alerts**: User quota exceeded, payment issues

## 🚀 Deployment

### Production Deployment

1. **Infrastructure Setup**
   ```bash
   # Create production environment
   cp .env.example .env.production
   
   # Configure production settings
   NODE_ENV=production
   REDIS_HOST=your_redis_host
   TIMESCALE_PASSWORD=secure_production_password
   ```

2. **Database Migration**
   ```bash
   # Run migrations
   supabase db push
   
   # Setup TimescaleDB
   docker-compose -f docker-compose.prod.yml up timescaledb -d
   ```

3. **Service Deployment**
   ```bash
   # Deploy with production config
   docker-compose -f docker-compose.prod.yml up -d
   ```

4. **Load Balancer Setup**
   ```bash
   # Configure Nginx
   cp nginx/nginx.prod.conf nginx/nginx.conf
   docker-compose restart nginx
   ```

### Scaling

- **Horizontal Scaling**: Add more worker nodes
- **Database Scaling**: Read replicas, connection pooling
- **Cache Scaling**: Redis cluster, cache warming
- **CDN**: Static asset delivery
- **Load Balancing**: Multiple frontend instances

## 🔒 Security

### Authentication & Authorization

- **Supabase Auth**: JWT-based authentication
- **Role-based Access**: User, premium, admin roles
- **API Keys**: Per-user API key management
- **Rate Limiting**: Per-user and per-endpoint limits

### Data Security

- **Encryption**: Data encryption at rest and in transit
- **API Security**: Input validation, SQL injection prevention
- **Container Security**: Isolated execution environments
- **Audit Logging**: Comprehensive audit trails

### Compliance

- **GDPR**: Data privacy and user rights
- **SOC 2**: Security and availability controls
- **Financial Regulations**: Compliance with trading regulations

## 📚 API Documentation

### REST API Endpoints

#### Strategies
- `GET /api/strategies` - List user strategies
- `POST /api/strategies` - Create new strategy
- `PUT /api/strategies/:id` - Update strategy
- `DELETE /api/strategies/:id` - Delete strategy

#### Backtests
- `POST /api/backtest-jobs` - Start new backtest
- `GET /api/backtest-jobs/:id` - Get backtest status
- `GET /api/backtest-jobs/:id/results` - Get backtest results
- `DELETE /api/backtest-jobs/:id` - Cancel backtest

#### Data
- `POST /api/market-data` - Fetch market data
- `GET /api/symbols` - Get available symbols
- `POST /api/data-upload` - Upload custom data

### WebSocket Events

#### Client to Server
- `authenticate` - Authenticate user
- `subscribe_backtest` - Subscribe to backtest updates
- `subscribe_notifications` - Subscribe to notifications

#### Server to Client
- `backtest_progress` - Backtest progress update
- `backtest_completed` - Backtest completion
- `backtest_failed` - Backtest failure
- `notification` - User notification

## 🧪 Testing

### Unit Tests
```bash
npm run test
```

### Integration Tests
```bash
npm run test:integration
```

### Load Tests
```bash
npm run test:load
```

### End-to-End Tests
```bash
npm run test:e2e
```

## 📝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- **Documentation**: [docs.wagyu.com](https://docs.wagyu.com)
- **Community**: [Discord](https://discord.gg/wagyu)
- **Issues**: [GitHub Issues](https://github.com/wagyu/issues)
- **Email**: support@wagyu.com

## 🗺️ Roadmap

### Phase 1: Core Platform (Completed)
- ✅ User authentication and management
- ✅ Strategy editor and validation
- ✅ LEAN engine integration
- ✅ Basic backtesting functionality
- ✅ Results dashboard

### Phase 2: Advanced Features (In Progress)
- 🔄 Real-time data streaming
- 🔄 Strategy marketplace
- 🔄 Advanced analytics
- 🔄 Mobile app
- 🔄 API for third-party integrations

### Phase 3: Enterprise Features (Planned)
- 📋 White-label solutions
- 📋 Custom data sources
- 📋 Advanced risk management
- 📋 Compliance tools
- 📋 Multi-region deployment

---

**Built with ❤️ by the WagYu Team**
