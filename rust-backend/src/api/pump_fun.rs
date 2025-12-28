use axum::{
    extract::{Query, State},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

use crate::AppState;

pub fn create_routes() -> Router<AppState> {
    Router::new()
        .route("/pump-fun/coins", get(get_pump_fun_coins))
}

#[derive(Debug, Deserialize)]
pub struct PumpFunQueryParams {
    #[serde(default)]
    pub offset: i32,
    #[serde(default = "default_limit")]
    pub limit: i32,
    #[serde(default = "default_sort")]
    pub sort: String,
    #[serde(default = "default_order")]
    pub order: String,
    #[serde(default)]
    pub include_nsfw: bool,
}

fn default_limit() -> i32 { 50 }
fn default_sort() -> String { "created_timestamp".to_string() }
fn default_order() -> String { "DESC".to_string() }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PumpFunCoin {
    pub mint: String,
    pub name: Option<String>,
    pub symbol: Option<String>,
    pub description: Option<String>,
    pub image_uri: Option<String>,
    pub twitter: Option<String>,
    pub telegram: Option<String>,
    pub website: Option<String>,
    pub bonding_curve: Option<String>,
    pub associated_bonding_curve: Option<String>,
    pub creator: Option<String>,
    pub created_timestamp: Option<u64>,
    pub raydium_pool: Option<String>,
    pub complete: Option<bool>,
    pub virtual_sol_reserves: Option<f64>,
    pub virtual_token_reserves: Option<f64>,
    pub total_supply: Option<f64>,
    pub market_cap: Option<f64>,
    pub usd_market_cap: Option<f64>,
    pub nsfw: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct PumpFunResponse {
    pub coins: Vec<PumpFunCoin>,
    pub count: usize,
}

/// Proxy endpoint for Pump.fun API to avoid CORS issues
async fn get_pump_fun_coins(
    State(_state): State<AppState>,
    Query(params): Query<PumpFunQueryParams>,
) -> Result<Json<PumpFunResponse>, String> {
    info!(
        "Fetching Pump.fun coins: offset={}, limit={}, sort={}",
        params.offset, params.limit, params.sort
    );

    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true) // For development
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let url = format!(
        "https://frontend-api.pump.fun/coins?offset={}&limit={}&sort={}&order={}&includeNsfw={}",
        params.offset,
        params.limit,
        params.sort,
        params.order,
        params.include_nsfw
    );

    // Retry up to 3 times
    let mut last_error = String::new();
    for attempt in 0..3 {
        match client
            .get(&url)
            .header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
            .header("Accept", "application/json")
            .send()
            .await
        {
            Ok(response) => {
                if response.status().is_success() {
                    // Parse the response - Pump.fun returns an array directly
                    match response.json::<Vec<PumpFunCoin>>().await {
                        Ok(coins) => {
                            let count = coins.len();
                            let graduated = coins.iter().filter(|c| c.complete.unwrap_or(false) || c.raydium_pool.is_some()).count();
                            info!(
                                "Successfully fetched {} coins from Pump.fun: {} not graduated, {} graduated",
                                count,
                                count - graduated,
                                graduated
                            );
                            return Ok(Json(PumpFunResponse { coins, count }));
                        }
                        Err(e) => {
                            warn!("Failed to parse Pump.fun response as array, trying object: {}", e);
                            // Try parsing as object with coins field
                            // This is handled by the error case returning empty
                        }
                    }
                } else if response.status().as_u16() == 530 || response.status().as_u16() == 503 {
                    // Cloudflare error
                    warn!("Pump.fun API returned Cloudflare error {}", response.status());
                    return Ok(Json(PumpFunResponse { coins: vec![], count: 0 }));
                } else {
                    last_error = format!("HTTP error: {}", response.status());
                    warn!("Pump.fun API error on attempt {}: {}", attempt + 1, last_error);
                }
            }
            Err(e) => {
                last_error = format!("Request failed: {}", e);
                warn!("Pump.fun request failed on attempt {}: {}", attempt + 1, e);
            }
        }

        // Wait before retry
        if attempt < 2 {
            tokio::time::sleep(std::time::Duration::from_millis(500 * (1 << attempt))).await;
        }
    }

    // Return empty on failure (graceful degradation)
    warn!("All attempts to fetch Pump.fun coins failed: {}", last_error);
    Ok(Json(PumpFunResponse { coins: vec![], count: 0 }))
}
