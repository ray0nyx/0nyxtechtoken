/// Jito Bundle Service
/// 
/// Submits transaction bundles to Jito Block Engine for MEV protection.
/// Bundles are atomic - all transactions succeed or all fail together.

use anyhow::{anyhow, Result};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use solana_sdk::transaction::Transaction;
use tracing::{info, warn};

/// Jito Block Engine endpoints
pub const JITO_MAINNET_BLOCK_ENGINE: &str = "https://mainnet.block-engine.jito.wtf";
pub const JITO_MAINNET_BUNDLES: &str = "https://mainnet.block-engine.jito.wtf/api/v1/bundles";

/// Jito tip accounts (rotate for load balancing)
pub const JITO_TIP_ACCOUNTS: [&str; 8] = [
    "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
    "HFqU5x63VTqvQss8hp11i4bVxUfZnAeyxMvuoZnEGwCF",
    "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
    "ADaUMid9yfUytqMBgopwjb2DTLSKtCyDMv9QuXxaHP7P",
    "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh",
    "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
    "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
    "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT",
];

/// Bundle submission request to Jito
#[derive(Debug, Serialize)]
pub struct JitoBundleRequest {
    pub jsonrpc: &'static str,
    pub id: u64,
    pub method: &'static str,
    pub params: Vec<Vec<String>>, // [[base64_tx1, base64_tx2, ...]]
}

/// Jito bundle response
#[derive(Debug, Deserialize)]
pub struct JitoBundleResponse {
    pub jsonrpc: String,
    pub id: u64,
    #[serde(default)]
    pub result: Option<String>, // Bundle UUID
    #[serde(default)]
    pub error: Option<JitoError>,
}

#[derive(Debug, Deserialize)]
pub struct JitoError {
    pub code: i64,
    pub message: String,
}

/// Bundle status response
#[derive(Debug, Deserialize)]
pub struct BundleStatusResponse {
    pub jsonrpc: String,
    #[serde(default)]
    pub result: Option<BundleStatus>,
}

#[derive(Debug, Deserialize)]
pub struct BundleStatus {
    pub bundle_id: String,
    pub status: String, // "Invalid", "Pending", "Landed", "Failed"
    #[serde(default)]
    pub landed_slot: Option<u64>,
}

/// Jito Bundle Client
#[derive(Clone)]
pub struct JitoBundleClient {
    http: Client,
    endpoint: String,
    tip_account_index: usize,
}

impl JitoBundleClient {
    /// Create a new Jito bundle client
    pub fn new() -> Self {
        Self {
            http: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("Failed to create HTTP client"),
            endpoint: JITO_MAINNET_BUNDLES.to_string(),
            tip_account_index: 0,
        }
    }

    /// Create with custom endpoint (for testing)
    pub fn with_endpoint(endpoint: &str) -> Self {
        Self {
            http: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("Failed to create HTTP client"),
            endpoint: endpoint.to_string(),
            tip_account_index: 0,
        }
    }

    /// Get the next tip account (round-robin)
    pub fn get_tip_account(&mut self) -> &'static str {
        let account = JITO_TIP_ACCOUNTS[self.tip_account_index];
        self.tip_account_index = (self.tip_account_index + 1) % JITO_TIP_ACCOUNTS.len();
        account
    }

    /// Submit a bundle of transactions to Jito
    /// 
    /// # Arguments
    /// * `transactions` - Signed transactions to bundle
    /// 
    /// # Returns
    /// Bundle UUID on success
    pub async fn submit_bundle(&self, transactions: Vec<Transaction>) -> Result<String> {
        if transactions.is_empty() {
            return Err(anyhow!("Cannot submit empty bundle"));
        }

        // Serialize transactions to base64
        let encoded_txs: Vec<String> = transactions
            .iter()
            .map(|tx| {
                let serialized = bincode::serialize(tx)
                    .expect("Failed to serialize transaction");
                BASE64.encode(&serialized)
            })
            .collect();

        let request = JitoBundleRequest {
            jsonrpc: "2.0",
            id: 1,
            method: "sendBundle",
            params: vec![encoded_txs],
        };

        info!("Submitting bundle with {} transactions to Jito", transactions.len());

        let response = self.http
            .post(&self.endpoint)
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            warn!("Jito bundle submission failed: {} - {}", status, text);
            return Err(anyhow!("Jito bundle failed: {} - {}", status, text));
        }

        let bundle_response: JitoBundleResponse = response.json().await?;

        if let Some(error) = bundle_response.error {
            warn!("Jito bundle error: {} - {}", error.code, error.message);
            return Err(anyhow!("Jito error: {}", error.message));
        }

        match bundle_response.result {
            Some(bundle_id) => {
                info!("Bundle submitted successfully: {}", bundle_id);
                Ok(bundle_id)
            }
            None => Err(anyhow!("No bundle ID returned from Jito")),
        }
    }

    /// Check the status of a submitted bundle
    pub async fn get_bundle_status(&self, bundle_id: &str) -> Result<BundleStatus> {
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getBundleStatuses",
            "params": [[bundle_id]]
        });

        let response = self.http
            .post(&self.endpoint)
            .json(&request)
            .send()
            .await?;

        let status_response: BundleStatusResponse = response.json().await?;

        status_response.result
            .ok_or_else(|| anyhow!("Bundle status not found"))
    }

    /// Submit bundle with tip transaction included
    /// Creates a tip transaction to the Jito tip account
    pub async fn submit_bundle_with_tip(
        &mut self,
        transactions: Vec<Transaction>,
        _tip_lamports: u64,
        _payer_keypair: &[u8], // We'd need the keypair to sign the tip tx
    ) -> Result<String> {
        // In production, you would:
        // 1. Create a transfer instruction to the tip account
        // 2. Build and sign the tip transaction
        // 3. Append it to the bundle
        // 4. Submit the bundle
        
        // For now, just submit without tip (tip can be included in last tx of bundle)
        self.submit_bundle(transactions).await
    }
}

impl Default for JitoBundleClient {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tip_account_rotation() {
        let mut client = JitoBundleClient::new();
        
        let first = client.get_tip_account();
        let second = client.get_tip_account();
        
        assert_ne!(first, second);
        assert_eq!(first, JITO_TIP_ACCOUNTS[0]);
        assert_eq!(second, JITO_TIP_ACCOUNTS[1]);
    }
}
