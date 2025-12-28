use solana_client::rpc_client::RpcClient;
use solana_sdk::commitment_config::CommitmentConfig;
use std::sync::Arc;

pub struct PrivateRpcManager {
    client: Option<Arc<RpcClient>>,
}

impl PrivateRpcManager {
    pub fn new(url: Option<String>) -> Self {
        let client = url.map(|url| {
            Arc::new(RpcClient::new_with_commitment(
                url,
                CommitmentConfig::confirmed(),
            ))
        });

        PrivateRpcManager { client }
    }

    pub fn get_client(&self) -> Option<Arc<RpcClient>> {
        self.client.clone()
    }
}
