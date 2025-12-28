/// Jupiter Swap Transaction Builder
/// 
/// Functions for building and executing swap transactions.

use anyhow::{anyhow, Result};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use tracing::{info, warn};

use super::client::JupiterClient;
use super::types::{QuoteResponse, SwapResult};

/// Build swap transaction from quote
pub async fn build_swap_transaction(
    client: &JupiterClient,
    user_pubkey: &str,
    quote: &QuoteResponse,
    priority_fee_lamports: Option<u64>,
) -> Result<Vec<u8>> {
    let swap_response = client.get_swap_transaction(
        user_pubkey,
        quote,
        priority_fee_lamports,
    ).await?;

    // Decode the base64 transaction
    let tx_bytes = BASE64.decode(&swap_response.swap_transaction)
        .map_err(|e| anyhow!("Failed to decode swap transaction: {}", e))?;

    info!(
        "Built swap transaction: {} bytes, valid until block {}",
        tx_bytes.len(),
        swap_response.last_valid_block_height.unwrap_or(0)
    );

    Ok(tx_bytes)
}

/// Execute a complete swap flow (quote + build + sign + send)
/// Returns the transaction signature on success
pub async fn execute_swap(
    client: &JupiterClient,
    user_pubkey: &str,
    input_mint: &str,
    output_mint: &str,
    amount: u64,
    slippage_bps: u16,
    priority_fee_lamports: Option<u64>,
    // sign_callback: impl FnOnce(&[u8]) -> Result<Vec<u8>>,
    // send_callback: impl FnOnce(Vec<u8>) -> Result<String>,
) -> Result<SwapResult> {
    // 1. Get quote
    let quote = client.get_quote(
        input_mint,
        output_mint,
        amount,
        slippage_bps,
    ).await?;

    // Check price impact
    let impact: f64 = quote.price_impact_pct.parse().unwrap_or(0.0);
    if impact > 10.0 {
        warn!("High price impact detected: {}%", impact);
        return Ok(SwapResult {
            success: false,
            signature: None,
            error: Some(format!("Price impact too high: {}%", impact)),
            in_amount: quote.in_amount.clone(),
            out_amount: quote.out_amount.clone(),
            price_impact_pct: quote.price_impact_pct.clone(),
        });
    }

    // 2. Build transaction
    let tx_bytes = build_swap_transaction(
        client,
        user_pubkey,
        &quote,
        priority_fee_lamports,
    ).await?;

    // TODO: 3. Sign transaction (via Turnkey or local wallet)
    // let signed_tx = sign_callback(&tx_bytes)?;

    // TODO: 4. Send transaction (via Jito bundle or direct RPC)
    // let signature = send_callback(signed_tx)?;

    // For now, return success with the unsigned transaction
    // The frontend will handle signing via Turnkey
    Ok(SwapResult {
        success: true,
        signature: None, // Will be populated after signing
        error: None,
        in_amount: quote.in_amount,
        out_amount: quote.out_amount,
        price_impact_pct: quote.price_impact_pct,
    })
}

/// Prepare swap for signing (returns base64 transaction)
pub async fn prepare_swap_for_signing(
    client: &JupiterClient,
    user_pubkey: &str,
    input_mint: &str,
    output_mint: &str,
    amount: u64,
    slippage_bps: u16,
    priority_fee_lamports: Option<u64>,
) -> Result<(String, QuoteResponse)> {
    // 1. Get quote
    let quote = client.get_quote(
        input_mint,
        output_mint,
        amount,
        slippage_bps,
    ).await?;

    // 2. Get swap transaction
    let swap_response = client.get_swap_transaction(
        user_pubkey,
        &quote,
        priority_fee_lamports,
    ).await?;

    // Return the base64 transaction for frontend to sign via Turnkey
    Ok((swap_response.swap_transaction, quote))
}
