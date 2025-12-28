---
name: Rust Backend Rewrite with RPC Integration
overview: Rewrite the Python backend in Rust with full Solana RPC integration, matching axiom.trade's high-performance architecture. All critical trading paths (execution, simulation, monitoring) will use Rust for safety and speed, with proper RPC connections throughout.
todos:
  - id: rust_setup
    content: Create rust-backend/ directory structure and Cargo.toml with all dependencies (axum, solana-client, tokio, redis, tonic)
    status: completed
  - id: rpc_manager
    content: Implement RpcManager with connection pooling, fallback support, and private RPC integration
    status: completed
  - id: tx_simulator_rust
    content: Migrate TransactionSimulator from Python to Rust with full RPC integration
    status: completed
  - id: honeypot_rust
    content: Migrate HoneypotAnalyzer to Rust, using RPC for account data queries
    status: completed
  - id: priority_fee_rust
    content: Migrate PriorityFeeService to Rust with real-time RPC-based fee calculation
    status: completed
  - id: api_routes_rust
    content: "Create Axum/Actix API routes with RPC-backed endpoints: /api/transaction/simulate, /api/token/:mint/safety, /api/account/:pubkey/balance"
    status: completed
  - id: yellowstone_rust
    content: Implement Yellowstone Geyser gRPC subscriber in Rust for <100ms migration detection
    status: completed
  - id: execution_layer_rust
    content: Migrate execution layer (multi-bundle, sniper mode, direct DEX) to Rust with RPC simulation
    status: completed
  - id: websocket_sse_rust
    content: Migrate WebSocket and SSE endpoints to Rust, maintaining Redis pub/sub integration
    status: completed
  - id: migration_strategy
    content: "Create migration plan: run Rust alongside Python initially, then gradually replace critical paths"
    status: completed
---

# Rust Backend Rewrite with Full RPC Integration

## Architecture Overview

The backend will be rewritten in Rust using:

- **Axum** (async web framework) or **Actix-Web** for HTTP/WebSocket server
- **solana-client** for RPC connections
- **tokio** for async runtime
- **serde** for JSON serialization
- **redis** crate for Redis integration
- **tonic** for gRPC (Yellowstone Geyser)

## Project Structure

```javascript
rust-backend/
├── Cargo.toml
├── src/
│   ├── main.rs                    # Entry point, server setup
│   ├── config.rs                  # Configuration management
│   ├── rpc/
│   │   ├── mod.rs                 # RPC connection manager
│   │   ├── client.rs              # Solana RPC client wrapper
│   │   ├── pool.rs                # RPC connection pool
│   │   └── private_rpc.rs         # Private RPC endpoint manager
│   ├── services/
│   │   ├── mod.rs
│   │   ├── tx_simulator.rs        # Transaction simulation (RPC)
│   │   ├── honeypot_analyzer.rs   # Honeypot detection (RPC)
│   │   ├── priority_fee.rs         # Dynamic priority fees (RPC)
│   │   ├── migration_detector.rs  # Pump.fun migration detection
│   │   ├── yellowstone_geyser.rs  # Yellowstone gRPC subscriber
│   │   ├── swap_stream.rs          # Real-time swap monitoring
│   │   ├── copy_trade.rs           # Copy trading engine
│   │   └── pulse_categorizer.rs    # Token categorization
│   ├── api/
│   │   ├── mod.rs
│   │   ├── routes.rs               # Main API routes
│   │   ├── turnkey.rs              # Turnkey wallet routes
│   │   ├── sse.rs                  # Server-Sent Events
│   │   └── websocket.rs            # WebSocket handler
│   ├── execution/
│   │   ├── mod.rs
│   │   ├── multi_bundle.rs         # Jito/bloXroute/NextBlock
│   │   ├── sniper_mode.rs          # Ultra-fast execution
│   │   └── direct_dex_fallback.rs  # Raydium/Orca direct swaps
│   └── models/
│       ├── mod.rs
│       ├── transaction.rs          # Transaction types
│       ├── quote.rs                # Jupiter quote types
│       └── token.rs                # Token metadata
└── proto/                          # Yellowstone Geyser proto files
```



## Core RPC Integration

### 1. RPC Connection Manager (`src/rpc/mod.rs`)

```rust
use solana_client::rpc_client::RpcClient;
use solana_client::rpc_config::RpcSendTransactionConfig;
use solana_sdk::commitment_config::CommitmentConfig;
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct RpcManager {
    primary: Arc<RpcClient>,
    private_rpc: Option<Arc<RpcClient>>,
    fallbacks: Vec<Arc<RpcClient>>,
    pool: RpcConnectionPool,
}

impl RpcManager {
    pub async fn new() -> Self {
        // Initialize primary RPC (QuickNode/Alchemy)
        // Initialize private RPC for anti-MEV
        // Initialize fallback RPCs
    }
    
    pub async fn simulate_transaction(&self, tx: &Transaction) -> Result<SimulationResult>;
    pub async fn get_account_data(&self, pubkey: &Pubkey) -> Result<Account>;
    pub async fn get_token_accounts(&self, owner: &Pubkey) -> Result<Vec<TokenAccount>>;
    pub async fn send_transaction(&self, tx: &Transaction, use_private: bool) -> Result<Signature>;
}
```



### 2. Transaction Simulator (`src/services/tx_simulator.rs`)

**Current Python**: Uses `AsyncClient.simulate_transaction()` but not integrated in API**Rust Implementation**:

```rust
use solana_client::rpc_client::RpcClient;
use solana_sdk::transaction::Transaction;

pub struct TransactionSimulator {
    rpc: Arc<RpcManager>,
}

impl TransactionSimulator {
    pub async fn simulate(
        &self,
        tx: &Transaction,
    ) -> Result<SimulationReport> {
        // Use RPC manager to simulate transaction
        let result = self.rpc.simulate_transaction(tx).await?;
        
        // Parse logs for errors
        // Check compute units
        // Validate slippage
        // Return detailed report
    }
}
```



### 3. Honeypot Analyzer (`src/services/honeypot_analyzer.rs`)

**Current Python**: Has RPC URL but doesn't use it in API endpoints**Rust Implementation**:

```rust
impl HoneypotAnalyzer {
    pub async fn analyze_token(&self, mint: &Pubkey) -> Result<SafetyScore> {
        // Use RPC to fetch:
        // 1. Token metadata account
        // 2. Mint authority
        // 3. Freeze authority
        // 4. Token program (SPL vs custom)
        // 5. Liquidity pool state
        
        let account = self.rpc.get_account_data(mint).await?;
        // Analyze account data for honeypot indicators
    }
}
```



### 4. Priority Fee Service (`src/services/priority_fee.rs`)

**Current Python**: Doesn't use RPC for real-time fee calculation**Rust Implementation**:

```rust
impl PriorityFeeService {
    pub async fn get_dynamic_fee(&self) -> Result<u64> {
        // Use RPC to:
        // 1. Get recent prioritization fees
        // 2. Query compute budget program
        // 3. Calculate based on network congestion
        let recent_fees = self.rpc.get_recent_prioritization_fees().await?;
        // Calculate optimal fee
    }
}
```



## API Endpoints with RPC Integration

### 1. Transaction Simulation Endpoint

**Current**: Not exposed in Python API**Rust Implementation** (`src/api/routes.rs`):

```rust
#[derive(Deserialize)]
struct SimulateRequest {
    transaction: String, // Base64 encoded
}

#[axum::post("/api/transaction/simulate")]
async fn simulate_transaction(
    Json(req): Json<SimulateRequest>,
    rpc: State<Arc<RpcManager>>,
) -> Result<Json<SimulationReport>> {
    let tx = Transaction::deserialize(&base64::decode(req.transaction)?)?;
    let simulator = TransactionSimulator::new(rpc.clone());
    let report = simulator.simulate(&tx).await?;
    Ok(Json(report))
}
```



### 2. Token Safety Check Endpoint

**Current**: Python has endpoint but doesn't use RPC**Rust Implementation**:

```rust
#[axum::get("/api/token/:mint/safety")]
async fn check_token_safety(
    Path(mint): Path<String>,
    rpc: State<Arc<RpcManager>>,
) -> Result<Json<SafetyScore>> {
    let pubkey = Pubkey::from_str(&mint)?;
    let analyzer = HoneypotAnalyzer::new(rpc.clone());
    let score = analyzer.analyze_token(&pubkey).await?;
    Ok(Json(score))
}
```



### 3. Account Balance Endpoint

**Current**: Frontend-only, no backend endpoint**Rust Implementation**:

```rust
#[axum::get("/api/account/:pubkey/balance")]
async fn get_account_balance(
    Path(pubkey): Path<String>,
    rpc: State<Arc<RpcManager>>,
) -> Result<Json<AccountBalance>> {
    let pubkey = Pubkey::from_str(&pubkey)?;
    let balance = rpc.get_balance(&pubkey).await?;
    let token_accounts = rpc.get_token_accounts(&pubkey).await?;
    Ok(Json(AccountBalance { sol: balance, tokens: token_accounts }))
}
```



### 4. Real-time Block Streaming

**Current**: Yellowstone Geyser placeholder in Python**Rust Implementation** (`src/services/yellowstone_geyser.rs`):

```rust
use tonic::transport::Channel;
use yellowstone_grpc_proto::geyser::geyser_client::GeyserClient;

pub struct YellowstoneSubscriber {
    client: GeyserClient<Channel>,
    rpc: Arc<RpcManager>,
}

impl YellowstoneSubscriber {
    pub async fn subscribe_to_transactions(&mut self) -> Result<()> {
        // Subscribe to Pump.fun program
        // Subscribe to Raydium program
        // Process transactions in <100ms
        // Publish to Redis
    }
}
```



## Migration Strategy

### Phase 1: Core RPC Infrastructure

1. Create `rust-backend/` directory structure
2. Set up `Cargo.toml` with dependencies:

- `axum` or `actix-web`
- `solana-client`
- `tokio`
- `redis`
- `tonic` (gRPC)

3. Implement `RpcManager` with connection pooling
4. Add configuration for RPC endpoints (QuickNode, Alchemy, private RPCs)

### Phase 2: Critical Services Migration

1. **Transaction Simulator**: Migrate from Python, add RPC integration
2. **Honeypot Analyzer**: Use RPC for account queries
3. **Priority Fee Service**: Use RPC for real-time fee calculation
4. **Migration Detector**: Integrate with Yellowstone Geyser

### Phase 3: API Endpoints

1. Migrate all FastAPI routes to Axum/Actix
2. Add RPC-backed endpoints:

- `/api/transaction/simulate`
- `/api/token/:mint/safety`
- `/api/account/:pubkey/balance`
- `/api/account/:pubkey/token-accounts`

3. Maintain WebSocket and SSE endpoints

### Phase 4: Execution Layer

1. Multi-bundle executor (Jito, bloXroute, NextBlock)
2. Sniper mode with private RPC
3. Direct DEX fallback with RPC simulation

### Phase 5: Data Ingestion (Keep Python or Migrate)

- **Option A**: Keep Python for Twitter scraping, email OTP (non-critical)
- **Option B**: Migrate to Rust using `reqwest` and `playwright-rs`

## Key Differences from Python Backend

1. **RPC Everywhere**: All blockchain operations use RPC, not just optional monitoring
2. **Type Safety**: Rust's type system prevents runtime errors
3. **Performance**: Zero-cost abstractions, no GIL, native async
4. **Memory Safety**: No session closure bugs, proper resource management
5. **Concurrency**: True parallelism with tokio

## Configuration

```rust
// src/config.rs
pub struct Config {
    pub rpc: RpcConfig,
    pub redis: RedisConfig,
    pub turnkey: TurnkeyConfig,
}

pub struct RpcConfig {
    pub primary: String,        // QuickNode/Alchemy
    pub private: Option<String>, // Private RPC for anti-MEV
    pub fallbacks: Vec<String>,  // Public RPCs
    pub pool_size: usize,        // Connection pool size
}
```



## Testing Strategy

1. Unit tests for RPC wrappers
2. Integration tests with local validator
3. Mock RPC responses for simulation
4. Load testing for concurrent requests

## Deployment

- Build Rust binary: `cargo build --release`