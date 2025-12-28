use crate::rpc::RpcManager;
use solana_sdk::transaction::Transaction;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use anyhow::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SimulationResult {
    Success,
    Failure,
    InsufficientFunds,
    SlippageExceeded,
    InvalidToken,
    UnknownError,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationReport {
    pub result: SimulationResult,
    pub error: Option<String>,
    pub estimated_compute_units: Option<u64>,
    pub estimated_fee_lamports: Option<u64>,
    pub logs: Vec<String>,
    pub will_succeed: bool,
}

pub struct TransactionSimulator {
    rpc: Arc<RpcManager>,
}

impl TransactionSimulator {
    pub fn new(rpc: Arc<RpcManager>) -> Self {
        TransactionSimulator { rpc }
    }

    pub async fn simulate(&self, tx: &Transaction) -> Result<SimulationReport> {
        // Use RPC manager to simulate transaction
        let sim_result = self.rpc.simulate_transaction(tx).await?;

        // Parse the simulation result (RpcSimulateTransactionResult has fields directly)
        let will_succeed = sim_result.err.is_none();
        
        // Extract logs
        let logs: Vec<String> = sim_result
            .logs
            .unwrap_or_default();

        // Determine result type based on error
        let (result, error) = if will_succeed {
            (SimulationResult::Success, None)
        } else {
            let err_str = sim_result
                .err
                .map(|e| format!("{:?}", e))
                .unwrap_or_else(|| "Unknown error".to_string());

            let sim_res = if err_str.contains("insufficient") || err_str.contains("funds") {
                SimulationResult::InsufficientFunds
            } else if err_str.contains("slippage") {
                SimulationResult::SlippageExceeded
            } else if err_str.contains("invalid") || err_str.contains("token") {
                SimulationResult::InvalidToken
            } else {
                SimulationResult::Failure
            };

            (sim_res, Some(err_str))
        };

        // Extract compute units from simulation
        let estimated_compute_units = sim_result.units_consumed.or_else(|| {
            // Try to extract from logs
            logs.iter()
                .find_map(|log| {
                    if log.contains("compute") {
                        log.split_whitespace()
                            .find_map(|s| s.parse::<u64>().ok())
                    } else {
                        None
                    }
                })
        });

        // Estimate fee (base fee + priority fee)
        let estimated_fee_lamports = estimated_compute_units
            .map(|units| {
                // Base fee: 5000 lamports
                // Priority fee: varies, estimate 5000
                5000 + (units / 1000) * 1000
            });

        Ok(SimulationReport {
            result,
            error,
            estimated_compute_units,
            estimated_fee_lamports,
            logs,
            will_succeed,
        })
    }
}
