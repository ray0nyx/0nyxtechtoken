mod routes;
mod turnkey;
mod sse;
mod websocket;
pub mod pump_fun;
mod tokens;
mod jupiter;
mod mev;
mod rpc;
mod presets;

use axum::Router;
use crate::AppState;

pub fn create_router() -> Router<AppState> {
    Router::new()
        .merge(routes::create_routes())
        .merge(turnkey::create_routes())
        .merge(sse::create_routes())
        .merge(websocket::create_routes())
        .merge(pump_fun::create_routes())
        .merge(tokens::create_routes())
        .merge(jupiter::create_routes())
        .merge(mev::create_routes())
        .merge(rpc::create_routes())
        .merge(presets::create_routes())
}

