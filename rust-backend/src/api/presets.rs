/// Trading Presets API
/// 
/// One-click trading presets for quick buy/sell operations.
/// Supports configurable SOL amounts and slippage settings.

use axum::{
    routing::{get, post},
    Router,
    Json,
    extract::State,
};
use serde::{Deserialize, Serialize};
use tracing::info;

use crate::AppState;

/// Create trading presets routes
pub fn create_routes() -> Router<AppState> {
    Router::new()
        .route("/presets", get(get_presets))
        .route("/presets/default", get(get_default_presets))
        .route("/presets/execute", post(execute_preset))
}

/// Trading preset configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TradingPreset {
    pub id: String,
    pub name: String,
    pub sol_amount: f64,
    pub slippage_bps: u32,
    pub priority_fee_lamports: u64,
    pub use_mev_protection: bool,
    pub is_default: bool,
}

/// Preset execution request
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutePresetRequest {
    pub preset_id: String,
    pub token_mint: String,
    pub action: TradeAction,
    pub user_public_key: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TradeAction {
    Buy,
    Sell,
}

/// Preset execution response
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutePresetResponse {
    pub success: bool,
    pub transaction_base64: Option<String>,
    pub estimated_output: Option<f64>,
    pub price_impact_percent: Option<f64>,
    pub mev_protected: bool,
    pub error: Option<String>,
}

/// Presets list response
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PresetsResponse {
    pub presets: Vec<TradingPreset>,
    pub quick_amounts: Vec<QuickAmount>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickAmount {
    pub label: String,
    pub sol_amount: f64,
    pub display: String,
}

/// GET /presets
/// Get all configured trading presets
async fn get_presets(
    State(_state): State<AppState>,
) -> Json<PresetsResponse> {
    let presets = get_builtin_presets();
    let quick_amounts = get_quick_amounts();

    Json(PresetsResponse {
        presets,
        quick_amounts,
    })
}

/// GET /presets/default
/// Get the default trading presets
async fn get_default_presets(
    State(_state): State<AppState>,
) -> Json<Vec<TradingPreset>> {
    Json(get_builtin_presets())
}

/// POST /presets/execute
/// Execute a trading preset and return the unsigned transaction
async fn execute_preset(
    State(_state): State<AppState>,
    Json(request): Json<ExecutePresetRequest>,
) -> Json<ExecutePresetResponse> {
    info!(
        "Executing preset {} for {} on token {}",
        request.preset_id,
        if request.action == TradeAction::Buy { "BUY" } else { "SELL" },
        request.token_mint
    );

    // Find the preset
    let presets = get_builtin_presets();
    let preset = presets.iter().find(|p| p.id == request.preset_id);

    let preset = match preset {
        Some(p) => p,
        None => {
            return Json(ExecutePresetResponse {
                success: false,
                transaction_base64: None,
                estimated_output: None,
                price_impact_percent: None,
                mev_protected: false,
                error: Some("Preset not found".to_string()),
            });
        }
    };

    // In production, this would:
    // 1. Get a quote from Jupiter
    // 2. Build the swap transaction
    // 3. Add priority fee
    // 4. Optionally wrap in Jito bundle for MEV protection
    // 5. Return the unsigned transaction for frontend signing

    // For now, return a placeholder response
    Json(ExecutePresetResponse {
        success: true,
        transaction_base64: Some("PLACEHOLDER_TRANSACTION".to_string()),
        estimated_output: Some(preset.sol_amount * 0.99), // Simulated 1% fee
        price_impact_percent: Some(0.5),
        mev_protected: preset.use_mev_protection,
        error: None,
    })
}

/// Get built-in trading presets
fn get_builtin_presets() -> Vec<TradingPreset> {
    vec![
        // Quick buy presets
        TradingPreset {
            id: "quick_0.1".to_string(),
            name: "Quick 0.1 SOL".to_string(),
            sol_amount: 0.1,
            slippage_bps: 100,
            priority_fee_lamports: 5_000,
            use_mev_protection: false,
            is_default: true,
        },
        TradingPreset {
            id: "quick_0.25".to_string(),
            name: "Quick 0.25 SOL".to_string(),
            sol_amount: 0.25,
            slippage_bps: 100,
            priority_fee_lamports: 10_000,
            use_mev_protection: false,
            is_default: false,
        },
        TradingPreset {
            id: "quick_0.5".to_string(),
            name: "Quick 0.5 SOL".to_string(),
            sol_amount: 0.5,
            slippage_bps: 150,
            priority_fee_lamports: 20_000,
            use_mev_protection: true,
            is_default: false,
        },
        TradingPreset {
            id: "quick_1".to_string(),
            name: "Quick 1 SOL".to_string(),
            sol_amount: 1.0,
            slippage_bps: 150,
            priority_fee_lamports: 50_000,
            use_mev_protection: true,
            is_default: false,
        },
        TradingPreset {
            id: "quick_2".to_string(),
            name: "Quick 2 SOL".to_string(),
            sol_amount: 2.0,
            slippage_bps: 200,
            priority_fee_lamports: 100_000,
            use_mev_protection: true,
            is_default: false,
        },
        TradingPreset {
            id: "quick_5".to_string(),
            name: "Quick 5 SOL".to_string(),
            sol_amount: 5.0,
            slippage_bps: 250,
            priority_fee_lamports: 200_000,
            use_mev_protection: true,
            is_default: false,
        },
        // Protected presets (always use MEV protection)
        TradingPreset {
            id: "protected_1".to_string(),
            name: "Protected 1 SOL".to_string(),
            sol_amount: 1.0,
            slippage_bps: 100,
            priority_fee_lamports: 100_000,
            use_mev_protection: true,
            is_default: false,
        },
        TradingPreset {
            id: "snipe_0.5".to_string(),
            name: "Snipe 0.5 SOL".to_string(),
            sol_amount: 0.5,
            slippage_bps: 500, // High slippage for new tokens
            priority_fee_lamports: 500_000,
            use_mev_protection: true,
            is_default: false,
        },
    ]
}

/// Get quick amount buttons
fn get_quick_amounts() -> Vec<QuickAmount> {
    vec![
        QuickAmount {
            label: "0.1".to_string(),
            sol_amount: 0.1,
            display: "0.1 SOL".to_string(),
        },
        QuickAmount {
            label: "0.25".to_string(),
            sol_amount: 0.25,
            display: "0.25 SOL".to_string(),
        },
        QuickAmount {
            label: "0.5".to_string(),
            sol_amount: 0.5,
            display: "0.5 SOL".to_string(),
        },
        QuickAmount {
            label: "1".to_string(),
            sol_amount: 1.0,
            display: "1 SOL".to_string(),
        },
        QuickAmount {
            label: "2".to_string(),
            sol_amount: 2.0,
            display: "2 SOL".to_string(),
        },
        QuickAmount {
            label: "5".to_string(),
            sol_amount: 5.0,
            display: "5 SOL".to_string(),
        },
    ]
}
