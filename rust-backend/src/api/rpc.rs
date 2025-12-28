/// RPC Infrastructure API Routes
/// 
/// Endpoints for monitoring RPC status, latency, and health.

use axum::{
    routing::get,
    Router,
    Json,
    extract::State,
};
use serde::Serialize;
use tracing::info;

use crate::AppState;
use crate::rpc::{RpcProvider, build_staked_endpoints};

/// Create RPC API routes
pub fn create_routes() -> Router<AppState> {
    Router::new()
        .route("/rpc/status", get(get_rpc_status))
        .route("/rpc/endpoints", get(get_endpoints))
}

/// RPC endpoint status
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RpcEndpointStatus {
    pub provider: String,
    pub url_preview: String, // Masked URL for security
    pub staked: bool,
    pub latency_tier: u8,
    pub is_available: bool,
    pub weight: u32,
}

/// RPC status response
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RpcStatusResponse {
    pub total_endpoints: usize,
    pub staked_endpoints: usize,
    pub available_endpoints: usize,
    pub endpoints: Vec<RpcEndpointStatus>,
    pub recommended_for_trading: String,
}

/// GET /rpc/status
/// Get overall RPC infrastructure status
async fn get_rpc_status(
    State(_state): State<AppState>,
) -> Json<RpcStatusResponse> {
    let endpoints = build_staked_endpoints();
    
    let staked_count = endpoints.iter().filter(|e| e.staked).count();
    
    // Build status for each endpoint
    let endpoint_statuses: Vec<RpcEndpointStatus> = endpoints
        .iter()
        .map(|e| RpcEndpointStatus {
            provider: e.provider.name().to_string(),
            url_preview: mask_url(&e.url),
            staked: e.staked,
            latency_tier: e.provider.latency_tier(),
            is_available: true, // Would come from router stats in production
            weight: e.weight,
        })
        .collect();

    let recommended = if staked_count > 0 {
        "Staked endpoints available - optimal for trading"
    } else {
        "Using public endpoints - consider adding staked nodes"
    };

    Json(RpcStatusResponse {
        total_endpoints: endpoints.len(),
        staked_endpoints: staked_count,
        available_endpoints: endpoints.len(), // Would filter by availability
        endpoints: endpoint_statuses,
        recommended_for_trading: recommended.to_string(),
    })
}

/// GET /rpc/endpoints
/// Get list of configured endpoints
async fn get_endpoints(
    State(_state): State<AppState>,
) -> Json<Vec<RpcEndpointStatus>> {
    let endpoints = build_staked_endpoints();
    
    Json(endpoints
        .iter()
        .map(|e| RpcEndpointStatus {
            provider: e.provider.name().to_string(),
            url_preview: mask_url(&e.url),
            staked: e.staked,
            latency_tier: e.provider.latency_tier(),
            is_available: true,
            weight: e.weight,
        })
        .collect())
}

/// Mask sensitive parts of URL for display
fn mask_url(url: &str) -> String {
    // Show provider domain but mask API keys
    if let Some(domain_end) = url.find('?') {
        format!("{}?***", &url[..domain_end])
    } else if url.contains("api-key=") || url.contains("apikey=") {
        let parts: Vec<&str> = url.split('/').collect();
        if parts.len() > 3 {
            format!("{}//{}/.../***", parts[0], parts[2])
        } else {
            "***masked***".to_string()
        }
    } else {
        // Public URLs can be shown
        url.to_string()
    }
}
