use crate::config::RpcConfig;
use solana_client::rpc_client::RpcClient;
use solana_sdk::commitment_config::CommitmentConfig;
use std::sync::Arc;
use tokio::sync::Semaphore;

pub struct RpcConnectionPool {
    semaphore: Arc<Semaphore>,
    config: RpcConfig,
}

impl RpcConnectionPool {
    pub async fn new(pool_size: usize, config: RpcConfig) -> anyhow::Result<Self> {
        Ok(RpcConnectionPool {
            semaphore: Arc::new(Semaphore::new(pool_size)),
            config,
        })
    }

    pub async fn acquire(&self) -> tokio::sync::SemaphorePermit<'_> {
        self.semaphore.acquire().await.unwrap()
    }

    pub fn create_client(&self, url: String) -> RpcClient {
        RpcClient::new_with_commitment(url, CommitmentConfig::confirmed())
    }
}
