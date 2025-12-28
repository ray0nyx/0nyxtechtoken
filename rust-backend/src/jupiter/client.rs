/// Jupiter V6 API Client
/// 
/// HTTP client for interacting with Jupiter's quote and swap APIs.

use anyhow::{anyhow, Result};
use reqwest::Client;
use tracing::{info, warn};

use super::types::{QuoteRequest, QuoteResponse, SwapRequest, SwapResponse};

/// Jupiter API base URL
const JUPITER_API_BASE: &str = "https://quote-api.jup.ag/v6";

/// Jupiter API Client
#[derive(Clone)]
pub struct JupiterClient {
    http: Client,
    base_url: String,
}

impl JupiterClient {
    /// Create a new Jupiter client with default settings
    pub fn new() -> Self {
        Self {
            http: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("Failed to create HTTP client"),
            base_url: JUPITER_API_BASE.to_string(),
        }
    }

    /// Create with custom base URL (for testing)
    pub fn with_base_url(base_url: &str) -> Self {
        Self {
            http: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("Failed to create HTTP client"),
            base_url: base_url.to_string(),
        }
    }

    /// Get quote for token swap
    /// 
    /// # Arguments
    /// * `input_mint` - Input token mint address
    /// * `output_mint` - Output token mint address
    /// * `amount` - Amount in smallest units (e.g., lamports for SOL)
    /// * `slippage_bps` - Slippage tolerance in basis points (100 = 1%)
    pub async fn get_quote(
        &self,
        input_mint: &str,
        output_mint: &str,
        amount: u64,
        slippage_bps: u16,
    ) -> Result<QuoteResponse> {
        let url = format!("{}/quote", self.base_url);
        
        info!(
            "Getting Jupiter quote: {} -> {} (amount: {}, slippage: {}bps)",
            input_mint, output_mint, amount, slippage_bps
        );

        let response = self.http
            .get(&url)
            .query(&[
                ("inputMint", input_mint),
                ("outputMint", output_mint),
                ("amount", &amount.to_string()),
                ("slippageBps", &slippage_bps.to_string()),
            ])
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            warn!("Jupiter quote failed: {} - {}", status, text);
            return Err(anyhow!("Jupiter quote failed: {} - {}", status, text));
        }

        let quote: QuoteResponse = response.json().await?;
        
        info!(
            "Quote received: {} {} -> {} {} (impact: {}%)",
            quote.in_amount, input_mint,
            quote.out_amount, output_mint,
            quote.price_impact_pct
        );

        Ok(quote)
    }

    /// Get swap transaction from quote
    /// 
    /// # Arguments
    /// * `user_pubkey` - User's wallet public key
    /// * `quote` - Quote response from get_quote
    /// * `priority_fee_lamports` - Priority fee for faster confirmation
    pub async fn get_swap_transaction(
        &self,
        user_pubkey: &str,
        quote: &QuoteResponse,
        priority_fee_lamports: Option<u64>,
    ) -> Result<SwapResponse> {
        let url = format!("{}/swap", self.base_url);

        let request = SwapRequest {
            user_public_key: user_pubkey.to_string(),
            quote_response: serde_json::to_value(quote)?,
            wrap_and_unwrap_sol: Some(true),
            use_shared_accounts: Some(true),
            fee_account: None,
            compute_unit_price_micro_lamports: None,
            prioritization_fee_lamports: priority_fee_lamports,
            as_legacy_transaction: Some(false), // Use versioned transactions
            use_token_ledger: None,
            destination_token_account: None,
            dynamic_compute_unit_limit: Some(true),
            skip_user_accounts_rpc_calls: Some(false),
        };

        info!("Building swap transaction for user: {}", user_pubkey);

        let response = self.http
            .post(&url)
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            warn!("Jupiter swap failed: {} - {}", status, text);
            return Err(anyhow!("Jupiter swap failed: {} - {}", status, text));
        }

        let swap: SwapResponse = response.json().await?;
        
        info!(
            "Swap transaction built (block height: {:?}, priority fee: {:?})",
            swap.last_valid_block_height,
            swap.prioritization_fee_lamports
        );

        Ok(swap)
    }

    /// Get quote with advanced options
    pub async fn get_quote_advanced(&self, request: QuoteRequest) -> Result<QuoteResponse> {
        let url = format!("{}/quote", self.base_url);

        let mut query_params: Vec<(&str, String)> = vec![
            ("inputMint", request.input_mint.clone()),
            ("outputMint", request.output_mint.clone()),
            ("amount", request.amount.to_string()),
        ];

        if let Some(slippage) = request.slippage_bps {
            query_params.push(("slippageBps", slippage.to_string()));
        }

        if let Some(direct) = request.only_direct_routes {
            query_params.push(("onlyDirectRoutes", direct.to_string()));
        }

        if let Some(legacy) = request.as_legacy_transaction {
            query_params.push(("asLegacyTransaction", legacy.to_string()));
        }

        if let Some(max_acc) = request.max_accounts {
            query_params.push(("maxAccounts", max_acc.to_string()));
        }

        let response = self.http
            .get(&url)
            .query(&query_params)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(anyhow!("Jupiter quote failed: {} - {}", status, text));
        }

        Ok(response.json().await?)
    }
}

impl Default for JupiterClient {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio;

    #[tokio::test]
    async fn test_quote_sol_to_usdc() {
        let client = JupiterClient::new();
        
        // Get quote for 0.1 SOL -> USDC
        let result = client.get_quote(
            "So11111111111111111111111111111111111111112", // SOL
            "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
            100_000_000, // 0.1 SOL in lamports
            50, // 0.5% slippage
        ).await;

        match result {
            Ok(quote) => {
                println!("Quote: {:?}", quote);
                assert!(!quote.out_amount.is_empty());
            }
            Err(e) => {
                println!("Quote error (may be network): {}", e);
            }
        }
    }
}
