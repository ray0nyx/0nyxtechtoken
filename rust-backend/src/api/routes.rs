use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};
use base64::{engine::general_purpose, Engine as _};
use solana_sdk::{
    pubkey::Pubkey,
    transaction::Transaction,
};
use std::str::FromStr;

use crate::{
    AppState,
    models::transaction::{SimulateRequest, AccountBalance, TokenBalance},
    services::{tx_simulator::TransactionSimulator, honeypot_analyzer::HoneypotAnalyzer},
};

pub fn create_routes() -> Router<AppState> {
    Router::new()
        .route("/transaction/simulate", post(simulate_transaction))
        .route("/token/:mint/safety", get(check_token_safety))
        .route("/account/:pubkey/balance", get(get_account_balance))
        .route("/account/:pubkey/token-accounts", get(get_token_accounts))
}

async fn simulate_transaction(
    State(state): State<AppState>,
    Json(req): Json<SimulateRequest>,
) -> Result<Json<crate::services::tx_simulator::SimulationReport>, String> {
    // Decode base64 transaction
    let tx_bytes = general_purpose::STANDARD
        .decode(&req.transaction)
        .map_err(|e| format!("Invalid base64 transaction: {}", e))?;

    // Deserialize transaction using bincode
    let tx: Transaction = bincode::deserialize(&tx_bytes)
        .map_err(|e| format!("Failed to deserialize transaction: {}", e))?;

    // Simulate transaction
    let simulator = TransactionSimulator::new(state.rpc.clone());
    let report = simulator
        .simulate(&tx)
        .await
        .map_err(|e| format!("Simulation failed: {}", e))?;

    Ok(Json(report))
}

async fn check_token_safety(
    State(state): State<AppState>,
    Path(mint): Path<String>,
) -> Result<Json<crate::services::honeypot_analyzer::SafetyScore>, String> {
    let pubkey = Pubkey::from_str(&mint)
        .map_err(|e| format!("Invalid pubkey: {}", e))?;

    let analyzer = HoneypotAnalyzer::new(state.rpc.clone());
    let score = analyzer
        .analyze_token(&pubkey)
        .await
        .map_err(|e| format!("Analysis failed: {}", e))?;

    Ok(Json(score))
}

async fn get_account_balance(
    State(state): State<AppState>,
    Path(pubkey): Path<String>,
) -> Result<Json<AccountBalance>, String> {
    let pubkey = Pubkey::from_str(&pubkey)
        .map_err(|e| format!("Invalid pubkey: {}", e))?;

    // Get SOL balance
    let sol_balance = state
        .rpc
        .get_balance(&pubkey)
        .await
        .map_err(|e| format!("Failed to get balance: {}", e))?;

    // Get token accounts
    let token_accounts_raw = state
        .rpc
        .get_token_accounts(&pubkey)
        .await
        .map_err(|e| format!("Failed to get token accounts: {}", e))?;

    // Parse token accounts (simplified - would need proper deserialization)
    let tokens: Vec<TokenBalance> = token_accounts_raw
        .iter()
        .filter_map(|account| {
            // Extract pubkey from the account's pubkey field
            Some(TokenBalance {
                mint: account.pubkey.clone(),
                amount: 0,
                decimals: 9,
            })
        })
        .collect();

    Ok(Json(AccountBalance {
        sol: sol_balance,
        tokens,
    }))
}

async fn get_token_accounts(
    State(state): State<AppState>,
    Path(pubkey): Path<String>,
) -> Result<Json<Vec<TokenBalance>>, String> {
    let pubkey = Pubkey::from_str(&pubkey)
        .map_err(|e| format!("Invalid pubkey: {}", e))?;

    let token_accounts_raw = state
        .rpc
        .get_token_accounts(&pubkey)
        .await
        .map_err(|e| format!("Failed to get token accounts: {}", e))?;

    let tokens: Vec<TokenBalance> = token_accounts_raw
        .iter()
        .filter_map(|account| {
            Some(TokenBalance {
                mint: account.pubkey.clone(),
                amount: 0,
                decimals: 9,
            })
        })
        .collect();

    Ok(Json(tokens))
}
