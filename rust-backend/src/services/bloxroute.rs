/// bloXroute MEV Protection
/// 
/// Submits transactions through bloXroute for MEV protection.
/// bloXroute provides private transaction submission and bundle services.

use anyhow::{anyhow, Result};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use reqwest::{Client, header};
use serde::{Deserialize, Serialize};
use solana_sdk::transaction::Transaction;
use tracing::{info, warn};

/// bloXroute Solana endpoints
pub const BLOXROUTE_SOLANA_ENDPOINT: &str = "https://solana.gateway.blxrbdn.com";

/// bloXroute transaction submission request
#[derive(Debug, Serialize)]
pub struct BloxrouteSubmitRequest {
    pub transaction: String, // Base64 encoded
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skip_preflight: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub front_running_protection: Option<bool>,
}

/// bloXroute response
#[derive(Debug, Deserialize)]
pub struct BloxrouteResponse {
    #[serde(default)]
    pub signature: Option<String>,
    #[serde(default)]
    pub error: Option<BloxrouteError>,
}

#[derive(Debug, Deserialize)]
pub struct BloxrouteError {
    pub code: i64,
    pub message: String,
}

/// bloXroute bundle request
#[derive(Debug, Serialize)]
pub struct BloxrouteBundleRequest {
    pub transactions: Vec<String>, // Base64 encoded transactions
    #[serde(skip_serializing_if = "Option::is_none")]
    pub use_bundle: Option<bool>,
}

/// bloXroute Client for MEV protection
#[derive(Clone)]
pub struct BloxrouteClient {
    http: Client,
    endpoint: String,
    api_key: Option<String>,
}

impl BloxrouteClient {
    /// Create a new bloXroute client
    pub fn new(api_key: Option<String>) -> Self {
        Self {
            http: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("Failed to create HTTP client"),
            endpoint: BLOXROUTE_SOLANA_ENDPOINT.to_string(),
            api_key,
        }
    }

    /// Create with custom endpoint
    pub fn with_endpoint(endpoint: &str, api_key: Option<String>) -> Self {
        Self {
            http: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("Failed to create HTTP client"),
            endpoint: endpoint.to_string(),
            api_key,
        }
    }

    /// Check if client is configured with API key
    pub fn is_configured(&self) -> bool {
        self.api_key.is_some() && !self.api_key.as_ref().unwrap().is_empty()
    }

    /// Submit a single transaction with MEV protection
    pub async fn submit_transaction(
        &self,
        transaction: &Transaction,
        front_running_protection: bool,
    ) -> Result<String> {
        if !self.is_configured() {
            return Err(anyhow!("bloXroute API key not configured"));
        }

        let serialized = bincode::serialize(transaction)?;
        let encoded = BASE64.encode(&serialized);

        let request = BloxrouteSubmitRequest {
            transaction: encoded,
            skip_preflight: Some(true),
            front_running_protection: Some(front_running_protection),
        };

        info!("Submitting transaction to bloXroute with MEV protection: {}", front_running_protection);

        let mut headers = header::HeaderMap::new();
        headers.insert(
            "Authorization",
            header::HeaderValue::from_str(&self.api_key.as_ref().unwrap())?,
        );
        headers.insert(
            header::CONTENT_TYPE,
            header::HeaderValue::from_static("application/json"),
        );

        let response = self.http
            .post(format!("{}/api/v1/transaction", self.endpoint))
            .headers(headers)
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            warn!("bloXroute submission failed: {} - {}", status, text);
            return Err(anyhow!("bloXroute failed: {} - {}", status, text));
        }

        let blox_response: BloxrouteResponse = response.json().await?;

        if let Some(error) = blox_response.error {
            warn!("bloXroute error: {} - {}", error.code, error.message);
            return Err(anyhow!("bloXroute error: {}", error.message));
        }

        match blox_response.signature {
            Some(sig) => {
                info!("Transaction submitted via bloXroute: {}", sig);
                Ok(sig)
            }
            None => Err(anyhow!("No signature returned from bloXroute")),
        }
    }

    /// Submit a bundle of transactions
    pub async fn submit_bundle(&self, transactions: Vec<Transaction>) -> Result<String> {
        if !self.is_configured() {
            return Err(anyhow!("bloXroute API key not configured"));
        }

        if transactions.is_empty() {
            return Err(anyhow!("Cannot submit empty bundle"));
        }

        let encoded_txs: Vec<String> = transactions
            .iter()
            .map(|tx| {
                let serialized = bincode::serialize(tx)
                    .expect("Failed to serialize transaction");
                BASE64.encode(&serialized)
            })
            .collect();

        let request = BloxrouteBundleRequest {
            transactions: encoded_txs,
            use_bundle: Some(true),
        };

        info!("Submitting bundle with {} transactions to bloXroute", transactions.len());

        let mut headers = header::HeaderMap::new();
        headers.insert(
            "Authorization",
            header::HeaderValue::from_str(&self.api_key.as_ref().unwrap())?,
        );

        let response = self.http
            .post(format!("{}/api/v1/bundle", self.endpoint))
            .headers(headers)
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(anyhow!("bloXroute bundle failed: {} - {}", status, text));
        }

        let blox_response: BloxrouteResponse = response.json().await?;

        match blox_response.signature {
            Some(sig) => {
                info!("Bundle submitted to bloXroute: {}", sig);
                Ok(sig)
            }
            None => Err(anyhow!("No bundle ID returned from bloXroute")),
        }
    }
}

impl Default for BloxrouteClient {
    fn default() -> Self {
        Self::new(None)
    }
}
