use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulateRequest {
    pub transaction: String, // Base64 encoded transaction
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountBalance {
    pub sol: u64,
    pub tokens: Vec<TokenBalance>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenBalance {
    pub mint: String,
    pub amount: u64,
    pub decimals: u8,
}
