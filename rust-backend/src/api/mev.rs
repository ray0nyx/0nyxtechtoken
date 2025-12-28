/// MEV Protection API Routes
/// 
/// Endpoints for MEV protection services including Jito bundles,
/// bloXroute submission, and sandwich attack analysis.

use axum::{
    routing::{get, post},
    Router,
    Json,
    extract::State,
};
use serde::{Deserialize, Serialize};
use tracing::info;

use crate::AppState;
use crate::services::jito_bundle::JitoBundleClient;
use crate::services::sandwich_detector::{SandwichDetector, SandwichSeverity};

/// Create MEV protection API routes
pub fn create_routes() -> Router<AppState> {
    Router::new()
        .route("/mev/analyze", post(analyze_sandwich_risk))
        .route("/mev/tip-accounts", get(get_tip_accounts))
        .route("/mev/protection-advice", get(get_protection_advice))
}

/// Sandwich risk analysis request
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyzeRequest {
    pub token_mint: String,
    pub amount_lamports: u64,
    pub is_buy: bool,
}

/// Sandwich risk analysis response
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyzeResponse {
    pub risk_level: String,
    pub is_safe: bool,
    pub recommendation: String,
    pub use_jito_bundle: bool,
    pub use_bloxroute: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
}

/// Tip accounts response
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TipAccountsResponse {
    pub accounts: Vec<String>,
    pub recommended: String,
}

/// Protection advice response
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProtectionAdvice {
    pub severity: String,
    pub advice: String,
    pub recommended_tip_lamports: u64,
}

/// POST /mev/analyze
/// Analyze sandwich attack risk for a planned transaction
async fn analyze_sandwich_risk(
    State(_state): State<AppState>,
    Json(params): Json<AnalyzeRequest>,
) -> Json<AnalyzeResponse> {
    info!(
        "Analyzing MEV risk: {} {} ({} lamports)",
        if params.is_buy { "BUY" } else { "SELL" },
        params.token_mint,
        params.amount_lamports
    );

    // Create a new detector for this analysis
    // In production, this would use a shared detector with historical data
    let detector = SandwichDetector::new();
    
    // Analyze risk
    let alert = detector.analyze_sandwich_risk(
        &params.token_mint,
        params.amount_lamports,
        params.is_buy,
    );

    match alert {
        Some(alert) => {
            let risk_level = match alert.severity {
                SandwichSeverity::Low => "low",
                SandwichSeverity::Medium => "medium",
                SandwichSeverity::High => "high",
                SandwichSeverity::Critical => "critical",
            };

            Json(AnalyzeResponse {
                risk_level: risk_level.to_string(),
                is_safe: alert.severity == SandwichSeverity::Low,
                recommendation: alert.recommendation,
                use_jito_bundle: alert.severity >= SandwichSeverity::Medium,
                use_bloxroute: alert.severity >= SandwichSeverity::High,
                details: Some(format!(
                    "Estimated attacker profit: {} lamports",
                    alert.estimated_profit_lamports
                )),
            })
        }
        None => {
            // No immediate risk detected, but still recommend protection for large trades
            let is_large_trade = params.amount_lamports > 1_000_000_000; // > 1 SOL
            
            Json(AnalyzeResponse {
                risk_level: "low".to_string(),
                is_safe: true,
                recommendation: if is_large_trade {
                    "Large trade detected. Consider using MEV protection.".to_string()
                } else {
                    "No immediate sandwich risk detected.".to_string()
                },
                use_jito_bundle: is_large_trade,
                use_bloxroute: false,
                details: None,
            })
        }
    }
}

/// GET /mev/tip-accounts
/// Get Jito tip accounts for bundle submission
async fn get_tip_accounts(
    State(_state): State<AppState>,
) -> Json<TipAccountsResponse> {
    let mut client = JitoBundleClient::new();
    let recommended = client.get_tip_account().to_string();

    Json(TipAccountsResponse {
        accounts: crate::services::jito_bundle::JITO_TIP_ACCOUNTS
            .iter()
            .map(|s| s.to_string())
            .collect(),
        recommended,
    })
}

/// GET /mev/protection-advice
/// Get general MEV protection advice
async fn get_protection_advice(
    State(_state): State<AppState>,
) -> Json<Vec<ProtectionAdvice>> {
    Json(vec![
        ProtectionAdvice {
            severity: "low".to_string(),
            advice: "Monitor, but proceed with normal submission".to_string(),
            recommended_tip_lamports: 1_000, // 0.000001 SOL
        },
        ProtectionAdvice {
            severity: "medium".to_string(),
            advice: "Use Jito bundle for protection".to_string(),
            recommended_tip_lamports: 10_000, // 0.00001 SOL
        },
        ProtectionAdvice {
            severity: "high".to_string(),
            advice: "Strongly recommend Jito bundle with tip".to_string(),
            recommended_tip_lamports: 100_000, // 0.0001 SOL
        },
        ProtectionAdvice {
            severity: "critical".to_string(),
            advice: "DO NOT submit without MEV protection!".to_string(),
            recommended_tip_lamports: 1_000_000, // 0.001 SOL
        },
    ])
}
