use axum::{
    extract::{Query, State},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

use crate::AppState;
use crate::api::pump_fun::PumpFunCoin;

pub fn create_routes() -> Router<AppState> {
    Router::new()
        .route("/tokens/migrating", get(get_migrating_tokens))
}

#[derive(Debug, Deserialize)]
pub struct MigratingQueryParams {
    #[serde(default = "default_limit")]
    pub limit: usize,
}

fn default_limit() -> usize { 20 }

#[derive(Debug, Clone, Serialize)]
pub struct MigratingToken {
    pub token_address: String,
    pub token_symbol: String,
    pub token_name: String,
    pub market_cap_usd: f64,
    pub graduation_status: String, // "approaching", "graduating", "graduated"
    pub raydium_pool_address: Option<String>,
    pub graduation_timestamp: Option<u64>,
    pub liquidity_usd: Option<f64>,
    pub logo_url: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct MigratingTokensResponse {
    pub tokens: Vec<MigratingToken>,
    pub count: usize,
    pub limit: usize,
}

const GRADUATION_THRESHOLD_USD: f64 = 69_000.0;

/// Get tokens migrating from Pump.fun to Raydium
async fn get_migrating_tokens(
    State(_state): State<AppState>,
    Query(params): Query<MigratingQueryParams>,
) -> Result<Json<MigratingTokensResponse>, String> {
    info!("Fetching migrating tokens with limit: {}", params.limit);

    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // Fetch high market cap coins that might be graduating
    let url = "https://frontend-api.pump.fun/coins?offset=0&limit=50&sort=market_cap&order=DESC&includeNsfw=false";

    let mut migrating_tokens: Vec<MigratingToken> = Vec::new();

    match client
        .get(url)
        .header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
        .header("Accept", "application/json")
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() {
                if let Ok(coins) = response.json::<Vec<PumpFunCoin>>().await {
                    let now_ms = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis() as u64;

                    for coin in coins {
                        let market_cap = coin.usd_market_cap.or(coin.market_cap).unwrap_or(0.0);
                        let is_complete = coin.complete.unwrap_or(false);
                        let has_raydium = coin.raydium_pool.is_some();

                        // Tokens approaching graduation (market cap between $50K and $75K, not yet graduated)
                        if market_cap >= 50_000.0 && market_cap <= 75_000.0 && !is_complete && !has_raydium {
                            migrating_tokens.push(MigratingToken {
                                token_address: coin.mint.clone(),
                                token_symbol: coin.symbol.unwrap_or_default(),
                                token_name: coin.name.unwrap_or_default(),
                                market_cap_usd: market_cap,
                                graduation_status: "approaching".to_string(),
                                raydium_pool_address: None,
                                graduation_timestamp: None,
                                liquidity_usd: None,
                                logo_url: coin.image_uri,
                            });
                        }
                        // Recently graduated tokens (within last 24 hours)
                        else if is_complete && has_raydium {
                            let created_ts = coin.created_timestamp.unwrap_or(0);
                            // Estimate graduation time (created + 1 hour as estimate)
                            let graduation_ts = if created_ts > 0 {
                                created_ts + 3600000 // Add 1 hour in ms
                            } else {
                                0
                            };

                            // Check if graduated within last 24 hours
                            let time_since_graduation = now_ms.saturating_sub(graduation_ts);
                            if time_since_graduation < 24 * 60 * 60 * 1000 {
                                migrating_tokens.push(MigratingToken {
                                    token_address: coin.mint.clone(),
                                    token_symbol: coin.symbol.unwrap_or_default(),
                                    token_name: coin.name.unwrap_or_default(),
                                    market_cap_usd: market_cap,
                                    graduation_status: "graduated".to_string(),
                                    raydium_pool_address: coin.raydium_pool,
                                    graduation_timestamp: Some(graduation_ts),
                                    liquidity_usd: None,
                                    logo_url: coin.image_uri,
                                });
                            }
                        }

                        if migrating_tokens.len() >= params.limit {
                            break;
                        }
                    }
                }
            } else if response.status().as_u16() == 530 || response.status().as_u16() == 503 {
                warn!("Pump.fun API returned Cloudflare error for migrating tokens");
            } else {
                warn!("Pump.fun API error: {}", response.status());
            }
        }
        Err(e) => {
            warn!("Failed to fetch migrating tokens: {}", e);
        }
    }

    // Sort by graduation status (graduated first) then by market cap
    migrating_tokens.sort_by(|a, b| {
        if a.graduation_status != b.graduation_status {
            if a.graduation_status == "graduated" { std::cmp::Ordering::Less }
            else if b.graduation_status == "graduated" { std::cmp::Ordering::Greater }
            else { std::cmp::Ordering::Equal }
        } else {
            b.market_cap_usd.partial_cmp(&a.market_cap_usd).unwrap_or(std::cmp::Ordering::Equal)
        }
    });

    let count = migrating_tokens.len();
    let limit = params.limit;

    info!("Found {} migrating tokens", count);

    Ok(Json(MigratingTokensResponse {
        tokens: migrating_tokens,
        count,
        limit,
    }))
}
