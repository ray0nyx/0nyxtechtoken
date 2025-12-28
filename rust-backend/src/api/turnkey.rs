use axum::{
    extract::State,
    routing::get,
    Router,
    Json,
};
use serde::{Deserialize, Serialize};

use crate::AppState;

pub fn create_routes() -> Router<AppState> {
    Router::new()
        .route("/turnkey/health", get(turnkey_health))
}

#[derive(Debug, Serialize, Deserialize)]
struct TurnkeyHealthResponse {
    available: bool,
    status: String,
}

async fn turnkey_health(
    State(state): State<AppState>,
) -> Json<TurnkeyHealthResponse> {
    let available = state.config.turnkey.api_key.is_some()
        && state.config.turnkey.api_secret.is_some();

    Json(TurnkeyHealthResponse {
        available,
        status: if available { "ok".to_string() } else { "not_configured".to_string() },
    })
}
