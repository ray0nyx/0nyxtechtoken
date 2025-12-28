/// Jupiter API Routes
/// 
/// Endpoints for Jupiter V6 swap operations.

use axum::{
    routing::{get, post},
    Router,
    Json,
    extract::State,
};
use serde::{Deserialize, Serialize};
use tracing::info;

use crate::AppState;
use crate::jupiter::{JupiterClient, tokens};

/// Create Jupiter API routes
pub fn create_routes() -> Router<AppState> {
    Router::new()
        .route("/jupiter/quote", get(get_quote))
        .route("/jupiter/swap", post(prepare_swap))
}

/// Quote request from frontend
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuoteParams {
    pub input_mint: String,
    pub output_mint: String,
    pub amount: String,
    #[serde(default = "default_slippage")]
    pub slippage_bps: u16,
}

fn default_slippage() -> u16 { 50 } // 0.5%

/// Quote response to frontend
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuoteResult {
    pub success: bool,
    pub in_amount: String,
    pub out_amount: String,
    pub min_out_amount: String,
    pub price_impact_pct: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub route_info: Option<String>,
}

/// Swap request from frontend
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SwapParams {
    pub user_public_key: String,
    pub input_mint: String,
    pub output_mint: String,
    pub amount: String,
    #[serde(default = "default_slippage")]
    pub slippage_bps: u16,
    #[serde(default)]
    pub priority_fee_lamports: Option<u64>,
}

/// Swap response to frontend
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SwapResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transaction: Option<String>, // Base64 encoded transaction for signing
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub in_amount: String,
    pub out_amount: String,
    pub price_impact_pct: String,
}

/// GET /jupiter/quote
async fn get_quote(
    State(_state): State<AppState>,
    axum::extract::Query(params): axum::extract::Query<QuoteParams>,
) -> Json<QuoteResult> {
    info!(
        "Jupiter quote request: {} {} -> {}",
        params.amount, params.input_mint, params.output_mint
    );

    let client = JupiterClient::new();
    
    // Parse amount
    let amount: u64 = match params.amount.parse() {
        Ok(a) => a,
        Err(_) => {
            return Json(QuoteResult {
                success: false,
                in_amount: params.amount,
                out_amount: "0".to_string(),
                min_out_amount: "0".to_string(),
                price_impact_pct: "0".to_string(),
                error: Some("Invalid amount".to_string()),
                route_info: None,
            });
        }
    };

    match client.get_quote(
        &params.input_mint,
        &params.output_mint,
        amount,
        params.slippage_bps,
    ).await {
        Ok(quote) => {
            let route_label = quote.route_plan
                .first()
                .and_then(|r| r.swap_info.label.clone())
                .unwrap_or_else(|| "Direct".to_string());

            Json(QuoteResult {
                success: true,
                in_amount: quote.in_amount,
                out_amount: quote.out_amount.clone(),
                min_out_amount: quote.other_amount_threshold,
                price_impact_pct: quote.price_impact_pct,
                error: None,
                route_info: Some(route_label),
            })
        }
        Err(e) => {
            Json(QuoteResult {
                success: false,
                in_amount: params.amount,
                out_amount: "0".to_string(),
                min_out_amount: "0".to_string(),
                price_impact_pct: "0".to_string(),
                error: Some(e.to_string()),
                route_info: None,
            })
        }
    }
}

/// POST /jupiter/swap
async fn prepare_swap(
    State(_state): State<AppState>,
    Json(params): Json<SwapParams>,
) -> Json<SwapResult> {
    info!(
        "Jupiter swap request: {} {} -> {} (user: {})",
        params.amount, params.input_mint, params.output_mint, params.user_public_key
    );

    let client = JupiterClient::new();

    // Parse amount
    let amount: u64 = match params.amount.parse() {
        Ok(a) => a,
        Err(_) => {
            return Json(SwapResult {
                success: false,
                transaction: None,
                error: Some("Invalid amount".to_string()),
                in_amount: params.amount,
                out_amount: "0".to_string(),
                price_impact_pct: "0".to_string(),
            });
        }
    };

    // 1. Get quote
    let quote = match client.get_quote(
        &params.input_mint,
        &params.output_mint,
        amount,
        params.slippage_bps,
    ).await {
        Ok(q) => q,
        Err(e) => {
            return Json(SwapResult {
                success: false,
                transaction: None,
                error: Some(format!("Quote failed: {}", e)),
                in_amount: params.amount,
                out_amount: "0".to_string(),
                price_impact_pct: "0".to_string(),
            });
        }
    };

    // Check price impact
    let impact: f64 = quote.price_impact_pct.parse().unwrap_or(0.0);
    if impact > 10.0 {
        return Json(SwapResult {
            success: false,
            transaction: None,
            error: Some(format!("Price impact too high: {}%", impact)),
            in_amount: quote.in_amount,
            out_amount: quote.out_amount,
            price_impact_pct: quote.price_impact_pct,
        });
    }

    // 2. Get swap transaction
    let swap_response = match client.get_swap_transaction(
        &params.user_public_key,
        &quote,
        params.priority_fee_lamports,
    ).await {
        Ok(s) => s,
        Err(e) => {
            return Json(SwapResult {
                success: false,
                transaction: None,
                error: Some(format!("Swap build failed: {}", e)),
                in_amount: quote.in_amount,
                out_amount: quote.out_amount,
                price_impact_pct: quote.price_impact_pct,
            });
        }
    };

    Json(SwapResult {
        success: true,
        transaction: Some(swap_response.swap_transaction),
        error: None,
        in_amount: quote.in_amount,
        out_amount: quote.out_amount,
        price_impact_pct: quote.price_impact_pct,
    })
}
