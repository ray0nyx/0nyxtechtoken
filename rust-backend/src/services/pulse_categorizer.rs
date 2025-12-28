use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TokenCategory {
    NewPair,
    FinalStretch,
    Migrated,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategorizedToken {
    pub mint: String,
    pub category: TokenCategory,
    pub bonding_curve_progress: Option<f64>, // 0.0 to 1.0
    pub migrated_at: Option<chrono::DateTime<chrono::Utc>>,
}

pub struct PulseCategorizer;

impl PulseCategorizer {
    pub fn new() -> Self {
        PulseCategorizer
    }

    pub fn categorize(&self, token: &str, bonding_curve: Option<f64>, migrated: bool) -> TokenCategory {
        if migrated {
            TokenCategory::Migrated
        } else if let Some(progress) = bonding_curve {
            if progress > 0.9 {
                TokenCategory::FinalStretch
            } else {
                TokenCategory::NewPair
            }
        } else {
            TokenCategory::NewPair
        }
    }
}
