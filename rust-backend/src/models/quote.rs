use serde::{Deserialize, Serialize};

// Jupiter quote types (simplified)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuoteResponse {
    pub input_mint: String,
    pub output_mint: String,
    pub in_amount: String,
    pub out_amount: String,
    pub price_impact_pct: f64,
}
