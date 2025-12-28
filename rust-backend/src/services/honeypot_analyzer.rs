use crate::rpc::RpcManager;
use solana_sdk::pubkey::Pubkey;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use anyhow::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafetyScore {
    pub score: f64, // 0.0 to 1.0, higher is safer
    pub is_honeypot: bool,
    pub can_freeze: bool,
    pub can_mint: bool,
    pub can_burn: bool,
    pub has_liquidity: bool,
    pub warnings: Vec<String>,
}

pub struct HoneypotAnalyzer {
    rpc: Arc<RpcManager>,
}

impl HoneypotAnalyzer {
    pub fn new(rpc: Arc<RpcManager>) -> Self {
        HoneypotAnalyzer { rpc }
    }

    pub async fn analyze_token(&self, mint: &Pubkey) -> Result<SafetyScore> {
        let mut warnings = Vec::new();
        let mut score: f64 = 1.0;

        // Fetch token mint account
        let mint_account = self.rpc.get_account_data(mint).await?;

        // Check if account exists
        if mint_account.lamports == 0 {
            return Ok(SafetyScore {
                score: 0.0,
                is_honeypot: true,
                can_freeze: true,
                can_mint: true,
                can_burn: true,
                has_liquidity: false,
                warnings: vec!["Token account does not exist".to_string()],
            });
        }

        // Parse mint account data
        // In a real implementation, we would deserialize the SPL Token mint account
        // For now, we'll do basic checks

        let mut can_freeze = false;
        let mut can_mint = false;
        let mut can_burn = false;

        // Check mint authority (if None, minting is disabled - good)
        // If Some(pubkey), check if it's a known malicious address
        // For now, we'll assume if authority exists, it can mint
        if mint_account.data.len() >= 36 {
            // SPL Token mint account structure:
            // - Option<Pubkey> mint_authority (36 bytes)
            // - u64 supply
            // - u8 decimals
            // - bool is_initialized
            // - Option<Pubkey> freeze_authority

            // Check if mint authority exists (first 36 bytes)
            let has_mint_authority = mint_account.data[0] != 0;
            if has_mint_authority {
                can_mint = true;
                score -= 0.3;
                warnings.push("Token has active mint authority".to_string());
            }

            // Check freeze authority (around byte 73)
            if mint_account.data.len() >= 73 {
                let has_freeze_authority = mint_account.data[73] != 0;
                if has_freeze_authority {
                    can_freeze = true;
                    score -= 0.4;
                    warnings.push("Token has freeze authority - can freeze accounts".to_string());
                }
            }
        }

        // Check for liquidity (this would require querying Raydium/Orca pools)
        // For now, we'll assume liquidity exists if we can't determine otherwise
        let has_liquidity = true; // Placeholder

        if !has_liquidity {
            score -= 0.2;
            warnings.push("No liquidity detected".to_string());
        }

        // Determine if it's a honeypot
        let is_honeypot = can_freeze || (can_mint && score < 0.5);

        // Ensure score is between 0.0 and 1.0
        score = score.max(0.0).min(1.0);

        Ok(SafetyScore {
            score,
            is_honeypot,
            can_freeze,
            can_mint,
            can_burn: can_mint, // If can mint, can effectively burn by minting to burn address
            has_liquidity,
            warnings,
        })
    }
}
