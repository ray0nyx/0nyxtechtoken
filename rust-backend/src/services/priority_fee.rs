use crate::rpc::RpcManager;
use std::sync::Arc;
use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriorityFeeEstimate {
    pub recommended_fee_lamports: u64,
    pub min_fee_lamports: u64,
    pub max_fee_lamports: u64,
    pub network_congestion: f64, // 0.0 to 1.0
}

pub struct PriorityFeeService {
    rpc: Arc<RpcManager>,
}

impl PriorityFeeService {
    pub fn new(rpc: Arc<RpcManager>) -> Self {
        PriorityFeeService { rpc }
    }

    pub async fn get_dynamic_fee(&self) -> Result<PriorityFeeEstimate> {
        // Get recent prioritization fees from RPC
        let recent_fees = self.rpc.get_recent_prioritization_fees().await?;

        // Calculate statistics
        let min_fee = recent_fees.iter().min().copied().unwrap_or(5000);
        let max_fee = recent_fees.iter().max().copied().unwrap_or(50000);
        let avg_fee: u64 = if !recent_fees.is_empty() {
            recent_fees.iter().sum::<u64>() / recent_fees.len() as u64
        } else {
            5000
        };

        // Calculate network congestion (0.0 = low, 1.0 = high)
        // Higher fees indicate higher congestion
        let congestion = if max_fee > 0 {
            ((avg_fee as f64 / max_fee as f64) * 100.0).min(100.0) / 100.0
        } else {
            0.5
        };

        // Recommended fee: average + 20% buffer for faster confirmation
        let recommended_fee = (avg_fee as f64 * 1.2) as u64;

        Ok(PriorityFeeEstimate {
            recommended_fee_lamports: recommended_fee,
            min_fee_lamports: min_fee,
            max_fee_lamports: max_fee,
            network_congestion: congestion,
        })
    }

    pub async fn get_fee_for_amount(&self, amount_usd: f64) -> Result<u64> {
        let base_estimate = self.get_dynamic_fee().await?;

        // For larger trades (>$500), use higher priority
        if amount_usd > 500.0 {
            Ok((base_estimate.recommended_fee_lamports as f64 * 1.5) as u64)
        } else {
            Ok(base_estimate.recommended_fee_lamports)
        }
    }
}
