use crate::rpc::RpcManager;
use crate::services::tx_simulator::TransactionSimulator;
use solana_sdk::transaction::Transaction;
use std::sync::Arc;
use anyhow::Result;

pub struct SniperMode {
    rpc: Arc<RpcManager>,
    simulator: TransactionSimulator,
}

impl SniperMode {
    pub fn new(rpc: Arc<RpcManager>) -> Self {
        let simulator = TransactionSimulator::new(rpc.clone());
        SniperMode { rpc, simulator }
    }

    pub async fn execute(&self, tx: Transaction, use_private_rpc: bool) -> Result<String> {
        // 1. Simulate transaction first
        let report = self.simulator.simulate(&tx).await?;
        
        if !report.will_succeed {
            anyhow::bail!("Transaction simulation failed: {:?}", report.error);
        }

        // 2. Send via private RPC if requested (anti-MEV)
        let signature = self.rpc.send_transaction(&tx, use_private_rpc).await?;

        Ok(signature.to_string())
    }
}
