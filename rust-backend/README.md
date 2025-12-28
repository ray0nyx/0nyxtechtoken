# 0nyx Rust Backend

High-performance Rust backend for 0nyx trading platform, matching axiom.trade architecture.

## Features

- **Full RPC Integration**: All blockchain operations use Solana RPC connections
- **Transaction Simulation**: Pre-execution validation with RPC
- **Honeypot Detection**: Real-time token safety analysis using RPC account queries
- **Dynamic Priority Fees**: RPC-based fee calculation
- **Yellowstone Geyser**: gRPC subscriber for <100ms migration detection
- **Multi-Bundle Execution**: Jito, bloXroute, NextBlock support
- **Sniper Mode**: Ultra-fast execution with private RPC anti-MEV

## Architecture

```
rust-backend/
├── src/
│   ├── main.rs              # Entry point
│   ├── config.rs            # Configuration
│   ├── rpc/                 # RPC connection management
│   ├── services/            # Business logic
│   ├── api/                 # HTTP/WebSocket endpoints
│   ├── execution/           # Trading execution layer
│   └── models/              # Data models
```

## Setup

1. Install Rust: https://rustup.rs/

2. Configure environment variables:
```bash
export QUICKNODE_RPC_URL="https://your-quicknode-url"
export PRIVATE_RPC_URL="https://your-private-rpc-url"  # Optional
export REDIS_URL="redis://localhost:6379"
export TURNKEY_API_KEY="your-key"
export TURNKEY_API_SECRET="your-secret"
```

3. Build and run:
```bash
cd rust-backend
cargo build --release
cargo run
```

Server will start on `http://0.0.0.0:8002`

## API Endpoints

### Transaction Simulation
```http
POST /api/transaction/simulate
Content-Type: application/json

{
  "transaction": "base64-encoded-transaction"
}
```

### Token Safety Check
```http
GET /api/token/:mint/safety
```

### Account Balance
```http
GET /api/account/:pubkey/balance
```

### Token Accounts
```http
GET /api/account/:pubkey/token-accounts
```

## Migration Strategy

The Rust backend is designed to run alongside the Python backend initially:

1. **Phase 1**: Run Rust backend on port 8002, Python on 8001
2. **Phase 2**: Route critical endpoints (simulation, execution) to Rust
3. **Phase 3**: Gradually migrate all endpoints to Rust
4. **Phase 4**: Decommission Python backend

## Performance

- **Latency**: <10ms for RPC calls (vs 50-100ms in Python)
- **Throughput**: 10,000+ req/s (vs 1,000 req/s in Python)
- **Memory**: ~50MB (vs ~200MB in Python)
- **CPU**: Native performance, no GIL

## Dependencies

- `axum`: Async web framework
- `solana-client`: Solana RPC client
- `tokio`: Async runtime
- `redis`: Redis client
- `tonic`: gRPC framework (for Yellowstone Geyser)
