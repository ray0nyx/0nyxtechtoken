mod config;
mod rpc;
mod services;
mod api;
mod execution;
mod jupiter;
mod models;

use axum::{
    routing::get,
    Router,
};
use std::sync::Arc;
use tower_http::cors::{CorsLayer, Any};
use tracing::info;

use config::Config;
use rpc::RpcManager;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    info!("Starting WagYu Rust Backend...");

    // Load configuration
    let config = Config::load().await?;
    info!("Configuration loaded");

    // Initialize RPC manager
    let rpc_manager = Arc::new(RpcManager::new(&config.rpc).await?);
    info!("RPC manager initialized");

    // Clone config for later use (before moving into Arc)
    let server_host = config.server.host.clone();
    let server_port = config.server.port;

    // CORS layer for frontend access
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Build application
    let app = Router::new()
        .route("/", get(health_check))
        .route("/api/health", get(health_check))
        .nest("/api", api::create_router())
        .layer(cors)
        .with_state(AppState {
            rpc: rpc_manager,
            config: Arc::new(config),
        });

    // Start server
    let addr = format!("{}:{}", server_host, server_port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    info!("Server listening on http://{}", addr);
    
    axum::serve(listener, app).await?;

    Ok(())
}

async fn health_check() -> &'static str {
    "OK"
}

#[derive(Clone)]
pub struct AppState {
    pub rpc: Arc<RpcManager>,
    pub config: Arc<Config>,
}
