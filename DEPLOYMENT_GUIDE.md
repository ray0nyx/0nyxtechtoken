# 🚀 Institutional Backtester Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the institutional backtester system with QuantConnect Lean integration, Pro plan gating, and advanced features.

## 🏗️ Architecture Components

- **Frontend**: React/Next.js with celeste-themed UI
- **Backend**: Supabase (PostgreSQL + Auth)
- **Time-Series DB**: TimescaleDB for market data
- **Lean Service**: Python FastAPI microservice
- **Exchange APIs**: Binance, Coinbase, Kraken integration
- **Security**: Encryption, audit trails, rate limiting

## 📋 Prerequisites

### Required Services
- [ ] Supabase account and project
- [ ] TimescaleDB instance (or PostgreSQL with TimescaleDB extension)
- [ ] Docker and Docker Compose
- [ ] Exchange API keys (Binance, Coinbase, Kraken)
- [ ] Polygon API key for market data

### Required Environment Variables
```bash
# Database
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
TIMESCALE_URL=postgresql://user:password@host:port/database

# Security
JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=your_32_byte_encryption_key

# Exchange APIs
POLYGON_API_KEY=your_polygon_key
BINANCE_API_KEY=your_binance_key
BINANCE_SECRET=your_binance_secret
COINBASE_API_KEY=your_coinbase_key
COINBASE_SECRET=your_coinbase_secret
KRAKEN_API_KEY=your_kraken_key
KRAKEN_SECRET=your_kraken_secret

# Lean Service
LEAN_SERVICE_URL=http://localhost:8000
LEAN_SERVICE_TOKEN=your_lean_service_token
```

## 🚀 Deployment Steps

### Step 1: Database Setup

1. **Set up TimescaleDB**:
   ```bash
   # Run the TimescaleDB setup script
   psql -h your_timescale_host -U your_user -d your_database -f scripts/setup-timescaledb.sql
   ```

2. **Run Supabase migrations**:
   ```bash
   # Apply the institutional backtester schema
   supabase db push
   ```

3. **Verify database setup**:
   ```sql
   -- Check if tables exist
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('institutional_backtests', 'linked_exchanges', 'copy_trades');
   
   -- Check TimescaleDB extension
   SELECT * FROM pg_extension WHERE extname = 'timescaledb';
   ```

### Step 2: Lean Service Deployment

1. **Build and start the Lean service**:
   ```bash
   cd lean-service
   docker-compose up -d
   ```

2. **Verify Lean service health**:
   ```bash
   curl http://localhost:8000/health
   ```

3. **Test backtest submission**:
   ```bash
   curl -X POST http://localhost:8000/backtest \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test Strategy",
       "strategy_code": "print(\"Hello World\")",
       "start_date": "2023-01-01",
       "end_date": "2023-12-31",
       "initial_capital": 100000,
       "symbols": ["BTC/USDT"]
     }'
   ```

### Step 3: Frontend Deployment

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

3. **Build and start the application**:
   ```bash
   npm run build
   npm start
   ```

4. **Verify frontend deployment**:
   - Navigate to `http://localhost:3000`
   - Check that the QuantTesting page is visible in the sidebar (for developers)
   - Verify Pro plan gating works correctly

### Step 4: Pro Plan Configuration

1. **Update subscription plan**:
   ```sql
   -- Set Pro plan price to $39.99
   UPDATE subscription_plans 
   SET price_monthly = 39.99 
   WHERE name = 'Pro';
   ```

2. **Test Pro plan gating**:
   - Create a test user with Pro plan subscription
   - Verify access to institutional features
   - Test that non-Pro users are blocked

### Step 5: Exchange Integration Testing

1. **Test exchange linking**:
   ```bash
   # Test Binance connection
   curl -X POST http://localhost:3000/api/institutional/exchanges \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -d '{
       "exchange_name": "binance",
       "exchange_type": "crypto",
       "api_key": "your_binance_api_key",
       "api_secret": "your_binance_secret"
     }'
   ```

2. **Verify exchange connections**:
   - Check that exchanges appear in the UI
   - Test connection status
   - Verify encrypted credential storage

### Step 6: Copy Trading Setup

1. **Enable copy trading**:
   ```bash
   curl -X POST http://localhost:3000/api/institutional/copy-trading \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -d '{
       "source_backtest_id": "your_backtest_id",
       "target_exchange_ids": ["exchange_id_1", "exchange_id_2"],
       "risk_limits": {
         "max_position_size": 0.1,
         "max_daily_loss": 0.05
       }
     }'
   ```

2. **Test copy trading flow**:
   - Create a completed backtest
   - Link target exchanges
   - Enable copy trading
   - Verify trade replication

## 🔧 Configuration

### Environment Variables

Create a `.env.local` file with the following variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Database Configuration
TIMESCALE_URL=postgresql://user:password@host:port/database

# Security Configuration
JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=your_32_byte_encryption_key

# Exchange API Keys
POLYGON_API_KEY=your_polygon_key
BINANCE_API_KEY=your_binance_key
BINANCE_SECRET=your_binance_secret
COINBASE_API_KEY=your_coinbase_key
COINBASE_SECRET=your_coinbase_secret
KRAKEN_API_KEY=your_kraken_key
KRAKEN_SECRET=your_kraken_secret

# Lean Service Configuration
LEAN_SERVICE_URL=http://localhost:8000
LEAN_SERVICE_TOKEN=your_lean_service_token

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=production
```

### Docker Compose Configuration

The `lean-service/docker-compose.yml` file configures:

- **Lean Service**: FastAPI application with QuantConnect Lean
- **PostgreSQL**: Database for Lean service (separate from TimescaleDB)
- **Redis**: Caching and job queue
- **Grafana**: Monitoring dashboard
- **Prometheus**: Metrics collection

### Security Configuration

1. **Encryption Key Generation**:
   ```bash
   # Generate a secure encryption key
   openssl rand -base64 32
   ```

2. **JWT Secret Generation**:
   ```bash
   # Generate a secure JWT secret
   openssl rand -base64 64
   ```

3. **API Key Security**:
   - Store all API keys encrypted in the database
   - Use environment variables for service-to-service communication
   - Implement rate limiting on all endpoints

## 📊 Monitoring and Logging

### Prometheus Metrics

The Lean service exposes metrics at `/metrics`:

- `lean_backtest_requests_total`: Total backtest requests
- `lean_backtest_duration_seconds`: Backtest execution time
- `lean_active_backtests`: Currently running backtests

### Grafana Dashboard

Access Grafana at `http://localhost:3001`:

- **Username**: admin
- **Password**: admin (change in production)

### Log Monitoring

1. **Application Logs**:
   ```bash
   # View Lean service logs
   docker-compose -f lean-service/docker-compose.yml logs -f lean-service
   
   # View frontend logs
   npm run dev 2>&1 | tee logs/frontend.log
   ```

2. **Database Logs**:
   ```sql
   -- Check audit logs
   SELECT * FROM audit_logs 
   ORDER BY created_at DESC 
   LIMIT 100;
   ```

## 🧪 Testing

### Unit Tests

```bash
# Test Lean service
cd lean-service
python -m pytest tests/

# Test frontend
npm test
```

### Integration Tests

```bash
# Test complete backtest flow
npm run test:integration

# Test exchange connectivity
npm run test:exchanges
```

### End-to-End Tests

```bash
# Test full user journey
npm run test:e2e
```

## 🚨 Troubleshooting

### Common Issues

1. **Lean Service Not Starting**:
   ```bash
   # Check Docker logs
   docker-compose logs lean-service
   
   # Verify environment variables
   docker-compose exec lean-service env | grep LEAN
   ```

2. **Database Connection Issues**:
   ```bash
   # Test TimescaleDB connection
   psql $TIMESCALE_URL -c "SELECT 1"
   
   # Test Supabase connection
   curl -H "apikey: $SUPABASE_ANON_KEY" $SUPABASE_URL/rest/v1/
   ```

3. **Exchange API Errors**:
   ```bash
   # Test exchange connectivity
   curl -X POST http://localhost:3000/api/institutional/exchanges/test \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{"exchange_id": "your_exchange_id"}'
   ```

### Performance Optimization

1. **Database Optimization**:
   ```sql
   -- Create indexes for better performance
   CREATE INDEX idx_market_data_symbol_time ON market_data (symbol, time DESC);
   CREATE INDEX idx_institutional_backtests_user_status ON institutional_backtests (user_id, status);
   ```

2. **Caching Strategy**:
   - Use Redis for frequently accessed data
   - Implement query result caching
   - Cache exchange connection status

3. **Rate Limiting**:
   - Implement per-user rate limits
   - Add exchange-specific rate limits
   - Monitor and alert on rate limit violations

## 🔒 Security Checklist

- [ ] All API keys encrypted in database
- [ ] JWT tokens properly signed and validated
- [ ] Rate limiting implemented on all endpoints
- [ ] Audit logging enabled for all actions
- [ ] Input validation and sanitization
- [ ] CORS properly configured
- [ ] HTTPS enabled in production
- [ ] Database connections secured
- [ ] Environment variables properly managed
- [ ] Regular security updates applied

## 📈 Scaling Considerations

### Horizontal Scaling

1. **Load Balancer**: Use nginx or AWS ALB
2. **Multiple Lean Instances**: Scale Lean service horizontally
3. **Database Sharding**: Partition data by user or time
4. **CDN**: Use CloudFlare or AWS CloudFront

### Vertical Scaling

1. **Database Resources**: Increase CPU, memory, and storage
2. **Lean Service Resources**: Scale Docker containers
3. **Caching**: Increase Redis memory allocation
4. **Monitoring**: Scale Prometheus and Grafana

## 🎯 Production Deployment

### Pre-Production Checklist

- [ ] All tests passing
- [ ] Security audit completed
- [ ] Performance testing done
- [ ] Monitoring configured
- [ ] Backup strategy implemented
- [ ] Disaster recovery plan ready
- [ ] Documentation updated
- [ ] Team training completed

### Production Deployment

1. **Use production Docker Compose**:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

2. **Set production environment variables**:
   ```bash
   export NODE_ENV=production
   export ALLOWED_ORIGINS=https://your-domain.com
   ```

3. **Enable SSL/TLS**:
   ```bash
   # Add SSL certificates
   cp ssl/cert.pem lean-service/ssl/
   cp ssl/key.pem lean-service/ssl/
   ```

4. **Configure monitoring**:
   - Set up alerting rules
   - Configure log aggregation
   - Set up uptime monitoring

## 🎉 Success!

Your institutional backtester is now deployed and ready for production use! 

**Next Steps:**
1. Monitor system performance
2. Train users on new features
3. Gather feedback and iterate
4. Plan feature enhancements
5. Scale as needed

For support and questions, refer to the main README or contact the development team.
