/// Jupiter SDK Type Definitions
/// 
/// Common types for Jupiter V6 API requests and responses.

use serde::{Deserialize, Serialize};

/// Jupiter Quote Request
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuoteRequest {
    pub input_mint: String,
    pub output_mint: String,
    pub amount: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub slippage_bps: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub only_direct_routes: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub as_legacy_transaction: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_accounts: Option<u8>,
}

/// Jupiter Quote Response
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuoteResponse {
    pub input_mint: String,
    pub in_amount: String,
    pub output_mint: String,
    pub out_amount: String,
    pub other_amount_threshold: String,
    pub swap_mode: String,
    pub slippage_bps: u16,
    pub price_impact_pct: String,
    pub route_plan: Vec<RoutePlan>,
    #[serde(default)]
    pub context_slot: Option<u64>,
    #[serde(default)]
    pub time_taken: Option<f64>,
}

/// Route Plan Entry
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoutePlan {
    pub swap_info: SwapInfo,
    pub percent: u8,
}

/// Swap Info
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SwapInfo {
    pub amm_key: String,
    pub label: Option<String>,
    pub input_mint: String,
    pub output_mint: String,
    pub in_amount: String,
    pub out_amount: String,
    pub fee_amount: String,
    pub fee_mint: String,
}

/// Swap Request
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SwapRequest {
    pub user_public_key: String,
    pub quote_response: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wrap_and_unwrap_sol: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub use_shared_accounts: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fee_account: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub compute_unit_price_micro_lamports: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prioritization_fee_lamports: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub as_legacy_transaction: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub use_token_ledger: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub destination_token_account: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dynamic_compute_unit_limit: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skip_user_accounts_rpc_calls: Option<bool>,
}

/// Swap Response
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SwapResponse {
    pub swap_transaction: String,
    #[serde(default)]
    pub last_valid_block_height: Option<u64>,
    #[serde(default)]
    pub prioritization_fee_lamports: Option<u64>,
}

/// Token Info for display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenInfo {
    pub address: String,
    pub symbol: String,
    pub name: String,
    pub decimals: u8,
    #[serde(default)]
    pub logo_uri: Option<String>,
}

/// Swap Result for frontend
#[derive(Debug, Clone, Serialize)]
pub struct SwapResult {
    pub success: bool,
    pub signature: Option<String>,
    pub error: Option<String>,
    pub in_amount: String,
    pub out_amount: String,
    pub price_impact_pct: String,
}

/// Common Solana Token Addresses
pub mod tokens {
    /// Native SOL (Wrapped)
    pub const WSOL: &str = "So11111111111111111111111111111111111111112";
    /// USDC (Circle)
    pub const USDC: &str = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    /// USDT (Tether)
    pub const USDT: &str = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
}
