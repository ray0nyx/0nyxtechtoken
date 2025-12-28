/// Latency-Based RPC Router
/// 
/// Intelligent RPC routing based on measured latency, availability, and load.
/// Automatically routes requests to the fastest available endpoint.

use anyhow::Result;
use solana_client::rpc_client::RpcClient as SolanaRpcClient;
use solana_sdk::{
    commitment_config::CommitmentConfig,
    signature::Signature,
    transaction::Transaction,
};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

use super::staked_nodes::{RpcProvider, StakedRpcEndpoint};

/// Endpoint health and latency statistics
#[derive(Debug, Clone)]
pub struct EndpointStats {
    pub url: String,
    pub provider: RpcProvider,
    pub staked: bool,
    /// Last measured latency in milliseconds
    pub last_latency_ms: u64,
    /// Rolling average latency
    pub avg_latency_ms: u64,
    /// Success rate (0-100)
    pub success_rate: u8,
    /// Number of requests made
    pub total_requests: u64,
    /// Number of failed requests
    pub failed_requests: u64,
    /// Last check time
    pub last_check: Instant,
    /// Is currently available
    pub is_available: bool,
    /// Weight for load balancing
    pub weight: u32,
}

impl EndpointStats {
    fn new(endpoint: &StakedRpcEndpoint) -> Self {
        Self {
            url: endpoint.url.clone(),
            provider: endpoint.provider,
            staked: endpoint.staked,
            last_latency_ms: 100, // Assume 100ms default
            avg_latency_ms: 100,
            success_rate: 100,
            total_requests: 0,
            failed_requests: 0,
            last_check: Instant::now(),
            is_available: true,
            weight: endpoint.weight,
        }
    }

    fn record_success(&mut self, latency_ms: u64) {
        self.total_requests += 1;
        self.last_latency_ms = latency_ms;
        // Exponential moving average
        self.avg_latency_ms = (self.avg_latency_ms * 9 + latency_ms) / 10;
        self.update_success_rate();
        self.last_check = Instant::now();
        self.is_available = true;
    }

    fn record_failure(&mut self) {
        self.total_requests += 1;
        self.failed_requests += 1;
        self.update_success_rate();
        self.last_check = Instant::now();
        
        // Mark as unavailable if too many failures
        if self.success_rate < 50 {
            self.is_available = false;
        }
    }

    fn update_success_rate(&mut self) {
        if self.total_requests > 0 {
            let success = self.total_requests - self.failed_requests;
            self.success_rate = ((success * 100) / self.total_requests) as u8;
        }
    }

    /// Calculate priority score (lower is better)
    fn priority_score(&self) -> u64 {
        if !self.is_available {
            return u64::MAX;
        }

        // Combine latency and success rate for scoring
        // Staked nodes get a bonus (multiply by 0.8)
        let staked_bonus = if self.staked { 80 } else { 100 };
        let latency_score = self.avg_latency_ms * staked_bonus / 100;
        
        // Weight affects priority inversely
        let weight_factor = 100 / self.weight.max(1) as u64;
        
        latency_score * weight_factor
    }
}

/// Latency-aware RPC router
pub struct RpcRouter {
    /// Endpoint statistics and clients
    endpoints: RwLock<Vec<(StakedRpcEndpoint, EndpointStats, Arc<SolanaRpcClient>)>>,
    /// Health check interval
    health_check_interval: Duration,
}

impl RpcRouter {
    /// Create a new RPC router from endpoints
    pub async fn new(endpoints: Vec<StakedRpcEndpoint>) -> Result<Self> {
        let mut endpoint_data = Vec::new();

        for endpoint in endpoints {
            let client = Arc::new(SolanaRpcClient::new_with_commitment(
                endpoint.url.clone(),
                CommitmentConfig::confirmed(),
            ));
            let stats = EndpointStats::new(&endpoint);
            endpoint_data.push((endpoint, stats, client));
        }

        info!("Initialized RPC router with {} endpoints", endpoint_data.len());

        Ok(Self {
            endpoints: RwLock::new(endpoint_data),
            health_check_interval: Duration::from_secs(30),
        })
    }

    /// Get the best endpoint based on latency and availability
    pub async fn get_best_endpoint(&self) -> Option<Arc<SolanaRpcClient>> {
        let endpoints = self.endpoints.read().await;
        
        endpoints
            .iter()
            .filter(|(_, stats, _)| stats.is_available)
            .min_by_key(|(_, stats, _)| stats.priority_score())
            .map(|(_, _, client)| client.clone())
    }

    /// Get the best staked endpoint (for transaction sending)
    pub async fn get_best_staked_endpoint(&self) -> Option<Arc<SolanaRpcClient>> {
        let endpoints = self.endpoints.read().await;
        
        endpoints
            .iter()
            .filter(|(ep, stats, _)| stats.is_available && ep.staked && ep.send_transactions)
            .min_by_key(|(_, stats, _)| stats.priority_score())
            .map(|(_, _, client)| client.clone())
    }

    /// Get all available endpoints sorted by priority
    pub async fn get_sorted_endpoints(&self) -> Vec<Arc<SolanaRpcClient>> {
        let endpoints = self.endpoints.read().await;
        
        let mut available: Vec<_> = endpoints
            .iter()
            .filter(|(_, stats, _)| stats.is_available)
            .collect();
        
        available.sort_by_key(|(_, stats, _)| stats.priority_score());
        
        available.iter().map(|(_, _, client)| client.clone()).collect()
    }

    /// Send transaction using the best available endpoint with failover
    pub async fn send_transaction(&self, tx: &Transaction) -> Result<Signature> {
        let endpoints = self.get_sorted_endpoints().await;
        
        if endpoints.is_empty() {
            anyhow::bail!("No available RPC endpoints");
        }

        // Try staked endpoints first
        if let Some(staked) = self.get_best_staked_endpoint().await {
            let start = Instant::now();
            let tx_clone = tx.clone();
            let staked_clone = staked.clone();
            
            match tokio::task::spawn_blocking(move || staked_clone.send_transaction(&tx_clone)).await {
                Ok(Ok(sig)) => {
                    self.record_success(&staked, start.elapsed().as_millis() as u64).await;
                    return Ok(sig);
                }
                Ok(Err(e)) => {
                    warn!("Staked endpoint failed: {}", e);
                    self.record_failure(&staked).await;
                }
                Err(e) => {
                    warn!("Staked endpoint task error: {}", e);
                    self.record_failure(&staked).await;
                }
            }
        }

        // Fallback through other endpoints
        for client in endpoints.iter() {
            let start = Instant::now();
            let tx_clone = tx.clone();
            let client_clone = client.clone();
            
            match tokio::task::spawn_blocking(move || client_clone.send_transaction(&tx_clone)).await {
                Ok(Ok(sig)) => {
                    self.record_success(client, start.elapsed().as_millis() as u64).await;
                    return Ok(sig);
                }
                Ok(Err(e)) => {
                    debug!("Endpoint failed: {}", e);
                    self.record_failure(client).await;
                }
                Err(_) => {
                    self.record_failure(client).await;
                }
            }
        }

        anyhow::bail!("All RPC endpoints failed for send_transaction")
    }

    /// Record a successful request
    async fn record_success(&self, client: &Arc<SolanaRpcClient>, latency_ms: u64) {
        let mut endpoints = self.endpoints.write().await;
        for (_, stats, c) in endpoints.iter_mut() {
            if Arc::ptr_eq(c, client) {
                stats.record_success(latency_ms);
                break;
            }
        }
    }

    /// Record a failed request
    async fn record_failure(&self, client: &Arc<SolanaRpcClient>) {
        let mut endpoints = self.endpoints.write().await;
        for (_, stats, c) in endpoints.iter_mut() {
            if Arc::ptr_eq(c, client) {
                stats.record_failure();
                break;
            }
        }
    }

    /// Run health checks on all endpoints
    pub async fn health_check(&self) {
        // Collect client clones and provider names first (release read lock)
        let checks: Vec<(Arc<SolanaRpcClient>, String)> = {
            let endpoints = self.endpoints.read().await;
            endpoints.iter()
                .map(|(ep, _, client)| (client.clone(), ep.provider.name().to_string()))
                .collect()
        };
        
        for (client, provider_name) in checks {
            let start = Instant::now();
            let client_clone = client.clone();
            
            let result = tokio::task::spawn_blocking(move || client_clone.get_slot())
                .await;
            
            let latency = start.elapsed().as_millis() as u64;
            
            match result {
                Ok(Ok(_)) => {
                    self.record_success(&client, latency).await;
                    debug!("{} health check OK ({}ms)", provider_name, latency);
                }
                _ => {
                    self.record_failure(&client).await;
                    warn!("{} health check FAILED", provider_name);
                }
            }
        }
    }

    /// Get statistics for all endpoints
    pub async fn get_stats(&self) -> Vec<EndpointStats> {
        let endpoints = self.endpoints.read().await;
        endpoints.iter().map(|(_, stats, _)| stats.clone()).collect()
    }
}
