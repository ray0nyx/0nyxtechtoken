# Migration Strategy: Python to Rust Backend

## Overview

This document outlines the strategy for migrating from the Python FastAPI backend to the Rust Axum backend while maintaining zero downtime.

## Architecture

```
┌─────────────┐
│   Frontend  │
└──────┬──────┘
       │
       ├─────────────────┐
       │                 │
       ▼                 ▼
┌─────────────┐   ┌─────────────┐
│ Python API  │   │  Rust API   │
│  Port 8001  │   │  Port 8002  │
└──────┬──────┘   └──────┬──────┘
       │                 │
       └────────┬────────┘
                │
                ▼
         ┌──────────────┐
         │   Services   │
         │  (Redis, DB) │
         └──────────────┘
```

## Migration Phases

### Phase 1: Parallel Deployment (Week 1-2)

**Goal**: Deploy Rust backend alongside Python, route non-critical endpoints

**Actions**:
1. Deploy Rust backend on port 8002
2. Update frontend to use Rust for:
   - `/api/transaction/simulate`
   - `/api/token/:mint/safety`
   - `/api/account/:pubkey/balance`
3. Keep Python for:
   - Data ingestion (Twitter, email OTP)
   - Legacy endpoints
   - WebSocket connections (initially)

**Monitoring**:
- Compare response times
- Monitor error rates
- Track RPC connection health

### Phase 2: Critical Path Migration (Week 3-4)

**Goal**: Route all trading-critical endpoints to Rust

**Actions**:
1. Migrate execution endpoints:
   - Multi-bundle submission
   - Sniper mode
   - Direct DEX fallback
2. Migrate monitoring:
   - Yellowstone Geyser subscriber
   - Migration detector
   - Pulse categorizer
3. Update frontend to use Rust for all trading operations

**Rollback Plan**:
- Keep Python backend running
- Feature flag to switch back if issues arise

### Phase 3: Full Migration (Week 5-6)

**Goal**: Migrate all endpoints, deprecate Python

**Actions**:
1. Migrate WebSocket endpoints
2. Migrate SSE endpoints
3. Migrate remaining data ingestion (optional - can keep Python)
4. Update all frontend references

### Phase 4: Decommission (Week 7)

**Goal**: Remove Python backend

**Actions**:
1. Verify all traffic goes to Rust
2. Monitor for 1 week
3. Decommission Python backend
4. Update documentation

## Feature Parity Checklist

### Core Features
- [x] Transaction simulation
- [x] Honeypot detection
- [x] Priority fee calculation
- [x] Account balance queries
- [x] Token account queries
- [ ] Yellowstone Geyser integration (proto files needed)
- [ ] Multi-bundle execution (Jito/bloXroute/NextBlock APIs)
- [ ] WebSocket with Redis pub/sub
- [ ] SSE with Redis pub/sub

### Data Ingestion (Optional - Keep Python)
- [ ] Twitter scraping
- [ ] Email OTP
- [ ] Pump.fun API polling

## Rollback Procedures

If issues arise during migration:

1. **Immediate Rollback**: Update frontend to point back to Python
2. **Partial Rollback**: Route specific endpoints back to Python
3. **Feature Flag**: Use environment variable to toggle Rust/Python

## Performance Targets

| Metric | Python | Rust | Target |
|--------|--------|------|--------|
| RPC Latency | 50-100ms | <10ms | ✅ |
| Throughput | 1,000 req/s | 10,000+ req/s | ✅ |
| Memory | ~200MB | ~50MB | ✅ |
| CPU | High (GIL) | Low | ✅ |

## Testing Strategy

1. **Unit Tests**: All services have unit tests
2. **Integration Tests**: Test with local validator
3. **Load Tests**: Compare Python vs Rust under load
4. **E2E Tests**: Full trading flow tests

## Monitoring

Key metrics to track:
- Response times (p50, p95, p99)
- Error rates
- RPC connection health
- Memory usage
- CPU usage
- Transaction success rates
