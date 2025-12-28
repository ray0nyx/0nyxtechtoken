mod pool;
mod private_rpc;
pub mod staked_nodes;
pub mod router;

pub use pool::RpcConnectionPool;
pub use staked_nodes::{RpcProvider, StakedRpcEndpoint, build_staked_endpoints};
pub use router::RpcRouter;
use crate::config::RpcConfig;
use solana_client::rpc_client::RpcClient as SolanaRpcClient;
use solana_client::rpc_response::RpcKeyedAccount;
use solana_sdk::{
    commitment_config::CommitmentConfig,
    pubkey::Pubkey,
    signature::Signature,
    transaction::Transaction,
};
use solana_account_decoder::UiAccountEncoding;
use std::sync::Arc;
use anyhow::Result;

pub struct RpcManager {
    primary: Arc<SolanaRpcClient>,
    private_rpc: Option<Arc<SolanaRpcClient>>,
    fallbacks: Vec<Arc<SolanaRpcClient>>,
    pool: Arc<RpcConnectionPool>,
}

impl RpcManager {
    pub async fn new(config: &RpcConfig) -> Result<Self> {
        // Initialize primary RPC
        let primary = Arc::new(SolanaRpcClient::new_with_commitment(
            config.primary.clone(),
            CommitmentConfig::confirmed(),
        ));

        // Initialize private RPC if configured
        let private_rpc = config.private.as_ref().map(|url| {
            Arc::new(SolanaRpcClient::new_with_commitment(
                url.clone(),
                CommitmentConfig::confirmed(),
            ))
        });

        // Initialize fallback RPCs
        let fallbacks: Vec<Arc<SolanaRpcClient>> = config
            .fallbacks
            .iter()
            .map(|url| {
                Arc::new(SolanaRpcClient::new_with_commitment(
                    url.clone(),
                    CommitmentConfig::confirmed(),
                ))
            })
            .collect();

        // Initialize connection pool
        let pool = Arc::new(RpcConnectionPool::new(config.pool_size, config.clone()).await?);

        Ok(RpcManager {
            primary,
            private_rpc,
            fallbacks,
            pool,
        })
    }

    pub async fn simulate_transaction(
        &self,
        tx: &Transaction,
    ) -> Result<solana_client::rpc_response::RpcSimulateTransactionResult> {
        // Try primary RPC first
        let primary = self.primary.clone();
        let tx_clone = tx.clone();
        match tokio::task::spawn_blocking(move || primary.simulate_transaction(&tx_clone)).await {
            Ok(Ok(result)) => Ok(result.value),
            Ok(Err(_)) | Err(_) => {
                // Try fallbacks
                for fallback in &self.fallbacks {
                    let fallback_clone = fallback.clone();
                    let tx_clone = tx.clone();
                    match tokio::task::spawn_blocking(move || fallback_clone.simulate_transaction(&tx_clone)).await {
                        Ok(Ok(result)) => return Ok(result.value),
                        _ => continue,
                    }
                }
                anyhow::bail!("All RPC endpoints failed for simulation")
            }
        }
    }

    pub async fn get_account_data(&self, pubkey: &Pubkey) -> Result<solana_sdk::account::Account> {
        let primary = self.primary.clone();
        let pubkey_clone = *pubkey;
        match tokio::task::spawn_blocking(move || primary.get_account(&pubkey_clone)).await {
            Ok(Ok(account)) => Ok(account),
            _ => {
                for fallback in &self.fallbacks {
                    let fallback_clone = fallback.clone();
                    let pubkey_clone = *pubkey;
                    match tokio::task::spawn_blocking(move || fallback_clone.get_account(&pubkey_clone)).await {
                        Ok(Ok(account)) => return Ok(account),
                        _ => continue,
                    }
                }
                anyhow::bail!("All RPC endpoints failed for get_account")
            }
        }
    }

    pub async fn get_balance(&self, pubkey: &Pubkey) -> Result<u64> {
        let primary = self.primary.clone();
        let pubkey_clone = *pubkey;
        match tokio::task::spawn_blocking(move || primary.get_balance(&pubkey_clone)).await {
            Ok(Ok(balance)) => Ok(balance),
            _ => {
                for fallback in &self.fallbacks {
                    let fallback_clone = fallback.clone();
                    let pubkey_clone = *pubkey;
                    match tokio::task::spawn_blocking(move || fallback_clone.get_balance(&pubkey_clone)).await {
                        Ok(Ok(balance)) => return Ok(balance),
                        _ => continue,
                    }
                }
                anyhow::bail!("All RPC endpoints failed for get_balance")
            }
        }
    }

    pub async fn get_token_accounts(
        &self,
        owner: &Pubkey,
    ) -> Result<Vec<RpcKeyedAccount>> {
        use solana_client::rpc_request::TokenAccountsFilter;

        let filter = TokenAccountsFilter::ProgramId(spl_token::id());

        let primary = self.primary.clone();
        let owner_clone = *owner;
        match tokio::task::spawn_blocking(move || primary.get_token_accounts_by_owner(&owner_clone, filter)).await {
            Ok(Ok(accounts)) => Ok(accounts),
            _ => {
                for fallback in &self.fallbacks {
                    let fallback_clone = fallback.clone();
                    let owner_clone = *owner;
                    let filter = TokenAccountsFilter::ProgramId(spl_token::id());
                    match tokio::task::spawn_blocking(move || fallback_clone.get_token_accounts_by_owner(&owner_clone, filter)).await {
                        Ok(Ok(accounts)) => return Ok(accounts),
                        _ => continue,
                    }
                }
                anyhow::bail!("All RPC endpoints failed for get_token_accounts")
            }
        }
    }

    pub async fn send_transaction(
        &self,
        tx: &Transaction,
        use_private: bool,
    ) -> Result<Signature> {
        use solana_client::rpc_config::RpcSendTransactionConfig;

        let config = RpcSendTransactionConfig {
            skip_preflight: false,
            preflight_commitment: Some(solana_sdk::commitment_config::CommitmentLevel::Confirmed),
            max_retries: Some(3),
            ..Default::default()
        };

        // Use private RPC if requested and available
        if use_private {
            if let Some(private) = &self.private_rpc {
                let private_clone = private.clone();
                let tx_clone = tx.clone();
                let config_clone = config.clone();
                return tokio::task::spawn_blocking(move || private_clone.send_transaction_with_config(&tx_clone, config_clone))
                    .await
                    .map_err(|e| anyhow::anyhow!("Task join error: {}", e))?
                    .map_err(|e| anyhow::anyhow!("Private RPC send failed: {}", e));
            }
        }

        // Try primary RPC
        let primary = self.primary.clone();
        let tx_clone = tx.clone();
        let config_clone = config.clone();
        match tokio::task::spawn_blocking(move || primary.send_transaction_with_config(&tx_clone, config_clone)).await {
            Ok(Ok(sig)) => Ok(sig),
            _ => {
                // Try fallbacks
                for fallback in &self.fallbacks {
                    let fallback_clone = fallback.clone();
                    let tx_clone = tx.clone();
                    let config_clone = config.clone();
                    match tokio::task::spawn_blocking(move || fallback_clone.send_transaction_with_config(&tx_clone, config_clone)).await {
                        Ok(Ok(sig)) => return Ok(sig),
                        _ => continue,
                    }
                }
                anyhow::bail!("All RPC endpoints failed for send_transaction")
            }
        }
    }

    pub async fn get_recent_prioritization_fees(&self) -> Result<Vec<u64>> {
        // Query recent prioritization fees from RPC
        // This is a placeholder - actual implementation would use getRecentPrioritizationFees RPC method
        // For now, return a default fee
        Ok(vec![5000]) // 5000 lamports default
    }
}
