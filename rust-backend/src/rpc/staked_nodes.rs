/// Staked RPC Node Configuration
/// 
/// Pre-configured staked RPC endpoints for ultra-low latency transaction submission.
/// Staked nodes have higher priority in the Solana network for faster confirmation.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// RPC provider type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum RpcProvider {
    /// Triton staked node network
    Triton,
    /// Helius staked nodes
    Helius,
    /// QuickNode (general purpose)
    QuickNode,
    /// Alchemy
    Alchemy,
    /// Public RPC (fallback)
    Public,
    /// Custom/private endpoint
    Custom,
}

impl RpcProvider {
    /// Get display name for the provider
    pub fn name(&self) -> &'static str {
        match self {
            RpcProvider::Triton => "Triton",
            RpcProvider::Helius => "Helius",
            RpcProvider::QuickNode => "QuickNode",
            RpcProvider::Alchemy => "Alchemy",
            RpcProvider::Public => "Public RPC",
            RpcProvider::Custom => "Custom",
        }
    }

    /// Get the expected latency tier (lower = faster)
    pub fn latency_tier(&self) -> u8 {
        match self {
            RpcProvider::Triton => 1,   // Fastest (staked, colocated)
            RpcProvider::Helius => 1,   // Fastest (staked, colocated)
            RpcProvider::QuickNode => 2,
            RpcProvider::Alchemy => 2,
            RpcProvider::Custom => 2,
            RpcProvider::Public => 3,   // Slowest
        }
    }

    /// Check if this is a staked node provider
    pub fn is_staked(&self) -> bool {
        matches!(self, RpcProvider::Triton | RpcProvider::Helius)
    }
}

/// Staked RPC endpoint configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StakedRpcEndpoint {
    pub provider: RpcProvider,
    pub url: String,
    pub staked: bool,
    pub send_transactions: bool, // Some endpoints are read-only
    pub websocket_url: Option<String>,
    /// Weight for load balancing (higher = more traffic)
    pub weight: u32,
}

impl StakedRpcEndpoint {
    /// Create a new Triton staked endpoint
    pub fn triton(api_key: &str) -> Self {
        Self {
            provider: RpcProvider::Triton,
            url: format!("https://api.mainnet.triton.one/{}/v1", api_key),
            staked: true,
            send_transactions: true,
            websocket_url: Some(format!("wss://api.mainnet.triton.one/{}/ws", api_key)),
            weight: 100,
        }
    }

    /// Create a new Helius staked endpoint
    pub fn helius(api_key: &str) -> Self {
        Self {
            provider: RpcProvider::Helius,
            url: format!("https://mainnet.helius-rpc.com/?api-key={}", api_key),
            staked: true,
            send_transactions: true,
            websocket_url: Some(format!("wss://mainnet.helius-rpc.com/?api-key={}", api_key)),
            weight: 100,
        }
    }

    /// Create a new Helius staked send-priority endpoint
    pub fn helius_staked(api_key: &str) -> Self {
        Self {
            provider: RpcProvider::Helius,
            url: format!("https://staked.helius-rpc.com?api-key={}", api_key),
            staked: true,
            send_transactions: true,
            websocket_url: None,
            weight: 150, // Higher priority for staked
        }
    }

    /// Create a QuickNode endpoint
    pub fn quicknode(endpoint: &str) -> Self {
        Self {
            provider: RpcProvider::QuickNode,
            url: endpoint.to_string(),
            staked: false,
            send_transactions: true,
            websocket_url: Some(endpoint.replace("https://", "wss://")),
            weight: 50,
        }
    }

    /// Create an Alchemy endpoint
    pub fn alchemy(api_key: &str) -> Self {
        Self {
            provider: RpcProvider::Alchemy,
            url: format!("https://solana-mainnet.g.alchemy.com/v2/{}", api_key),
            staked: false,
            send_transactions: true,
            websocket_url: Some(format!("wss://solana-mainnet.g.alchemy.com/v2/{}", api_key)),
            weight: 50,
        }
    }

    /// Create a public mainnet endpoint (fallback)
    pub fn public() -> Self {
        Self {
            provider: RpcProvider::Public,
            url: "https://api.mainnet-beta.solana.com".to_string(),
            staked: false,
            send_transactions: true,
            websocket_url: Some("wss://api.mainnet-beta.solana.com".to_string()),
            weight: 10, // Lowest priority
        }
    }

    /// Alternative public endpoints
    pub fn public_alternatives() -> Vec<Self> {
        vec![
            Self {
                provider: RpcProvider::Public,
                url: "https://rpc.ankr.com/solana".to_string(),
                staked: false,
                send_transactions: true,
                websocket_url: None,
                weight: 8,
            },
            Self {
                provider: RpcProvider::Public,
                url: "https://solana-mainnet.rpc.extrnode.com".to_string(),
                staked: false,
                send_transactions: true,
                websocket_url: None,
                weight: 5,
            },
        ]
    }
}

/// Build list of staked endpoints from environment variables
pub fn build_staked_endpoints() -> Vec<StakedRpcEndpoint> {
    let mut endpoints = Vec::new();

    // Triton (highest priority)
    if let Ok(key) = std::env::var("TRITON_API_KEY") {
        endpoints.push(StakedRpcEndpoint::triton(&key));
    }

    // Helius Staked (highest priority)
    if let Ok(key) = std::env::var("HELIUS_API_KEY") {
        endpoints.push(StakedRpcEndpoint::helius_staked(&key));
        endpoints.push(StakedRpcEndpoint::helius(&key));
    }

    // QuickNode
    if let Ok(url) = std::env::var("QUICKNODE_RPC_URL") {
        endpoints.push(StakedRpcEndpoint::quicknode(&url));
    }

    // Alchemy
    if let Ok(key) = std::env::var("ALCHEMY_API_KEY") {
        endpoints.push(StakedRpcEndpoint::alchemy(&key));
    }

    // Public fallback (always included)
    endpoints.push(StakedRpcEndpoint::public());
    endpoints.extend(StakedRpcEndpoint::public_alternatives());

    endpoints
}
