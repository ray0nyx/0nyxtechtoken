use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenInfo {
    pub mint: String,
    pub symbol: Option<String>,
    pub name: Option<String>,
    pub decimals: u8,
    pub supply: u64,
}
