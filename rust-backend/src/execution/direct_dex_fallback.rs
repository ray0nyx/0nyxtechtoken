use crate::rpc::RpcManager;
use crate::services::tx_simulator::TransactionSimulator;
use solana_sdk::transaction::Transaction;
use std::sync::Arc;
use anyhow::Result;

pub struct DirectDexFallback {
    rpc: Arc<RpcManager>,
    simulator: TransactionSimulator,
}

impl DirectDexFallback {
    pub fn new(rpc: Arc<RpcManager>) -> Self {
        let simulator = TransactionSimulator::new(rpc.clone());
        DirectDexFallback { rpc, simulator }
    }

    pub async fn compare_and_execute(
        &self,
        jupiter_tx: Transaction,
        raydium_tx: Option<Transaction>,
        orca_tx: Option<Transaction>,
    ) -> Result<String> {
        // Simulate all transactions
        let jupiter_sim = self.simulator.simulate(&jupiter_tx).await?;
        
        // Compare and execute fastest/best route
        // For now, just execute Jupiter
        if jupiter_sim.will_succeed {
            let sig = self.rpc.send_transaction(&jupiter_tx, false).await?;
            Ok(sig.to_string())
        } else {
            anyhow::bail!("Jupiter transaction simulation failed")
        }
    }
}
