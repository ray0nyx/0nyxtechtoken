/// Jupiter Quote Helpers
/// 
/// Convenience functions for common quote operations.

use anyhow::Result;
use super::client::JupiterClient;
use super::types::{QuoteResponse, tokens};

/// Get a quick quote for buying a token with SOL
pub async fn get_sol_buy_quote(
    client: &JupiterClient,
    token_mint: &str,
    sol_amount_lamports: u64,
    slippage_bps: u16,
) -> Result<QuoteResponse> {
    client.get_quote(
        tokens::WSOL,
        token_mint,
        sol_amount_lamports,
        slippage_bps,
    ).await
}

/// Get a quick quote for selling a token for SOL
pub async fn get_sol_sell_quote(
    client: &JupiterClient,
    token_mint: &str,
    token_amount: u64,
    slippage_bps: u16,
) -> Result<QuoteResponse> {
    client.get_quote(
        token_mint,
        tokens::WSOL,
        token_amount,
        slippage_bps,
    ).await
}

/// Get quote for selling a token for USDC
pub async fn get_usdc_sell_quote(
    client: &JupiterClient,
    token_mint: &str,
    token_amount: u64,
    slippage_bps: u16,
) -> Result<QuoteResponse> {
    client.get_quote(
        token_mint,
        tokens::USDC,
        token_amount,
        slippage_bps,
    ).await
}

/// Generic quote function (re-export for convenience)
pub async fn get_quote(
    client: &JupiterClient,
    input_mint: &str,
    output_mint: &str,
    amount: u64,
    slippage_bps: u16,
) -> Result<QuoteResponse> {
    client.get_quote(input_mint, output_mint, amount, slippage_bps).await
}

/// Calculate minimum output amount from quote
pub fn calculate_min_output(quote: &QuoteResponse) -> u64 {
    // other_amount_threshold is the minimum we accept
    quote.other_amount_threshold.parse::<u64>().unwrap_or(0)
}

/// Check if price impact is acceptable (< 5%)
pub fn is_price_impact_acceptable(quote: &QuoteResponse, max_impact_pct: f64) -> bool {
    let impact: f64 = quote.price_impact_pct.parse().unwrap_or(100.0);
    impact < max_impact_pct
}
