/// Sandwich Attack Detector
/// 
/// Monitors pending transactions to detect and prevent sandwich attacks.
/// Analyzes mempool patterns and provides alerts for suspicious activity.

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::time::{Duration, Instant};
use tracing::{info, warn};

/// Pending transaction info for analysis
#[derive(Debug, Clone)]
pub struct PendingTransaction {
    pub signature: String,
    pub from: String,
    pub to: String,
    pub token_mint: String,
    pub amount: u64,
    pub is_buy: bool,
    pub timestamp: Instant,
    pub slot: u64,
}

/// Sandwich attack pattern detection result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandwichAlert {
    pub severity: SandwichSeverity,
    pub front_runner_tx: String,
    pub victim_tx: String,
    pub back_runner_tx: Option<String>,
    pub token_mint: String,
    pub estimated_profit_lamports: u64,
    pub recommendation: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub enum SandwichSeverity {
    Low,      // Suspicious pattern, might be coincidence
    Medium,   // Clear sandwich attempt with moderate profit
    High,     // Aggressive sandwich with high profit potential
    Critical, // Your transaction is likely being targeted
}

/// Sandwich Attack Detector
pub struct SandwichDetector {
    /// Recent transactions per token (for pattern detection)
    token_activity: HashMap<String, VecDeque<PendingTransaction>>,
    /// Known MEV bot addresses
    known_bots: Vec<String>,
    /// Time window for pattern analysis (default: 2 seconds)
    analysis_window: Duration,
    /// Minimum profit threshold to flag (in lamports)
    min_profit_threshold: u64,
}

impl SandwichDetector {
    /// Create a new sandwich detector
    pub fn new() -> Self {
        Self {
            token_activity: HashMap::new(),
            known_bots: Self::default_known_bots(),
            analysis_window: Duration::from_millis(2000),
            min_profit_threshold: 100_000, // 0.0001 SOL
        }
    }

    /// Default list of known MEV bot addresses
    fn default_known_bots() -> Vec<String> {
        vec![
            // Add known MEV bot addresses here
            // These are example patterns - real detection uses more sophisticated methods
        ]
    }

    /// Record a pending transaction for analysis
    pub fn record_transaction(&mut self, tx: PendingTransaction) {
        let activity = self.token_activity
            .entry(tx.token_mint.clone())
            .or_insert_with(VecDeque::new);
        
        // Keep only recent transactions
        let cutoff = Instant::now() - self.analysis_window * 10;
        while let Some(front) = activity.front() {
            if front.timestamp < cutoff {
                activity.pop_front();
            } else {
                break;
            }
        }

        activity.push_back(tx);
    }

    /// Analyze if a transaction might be sandwiched
    /// Call this BEFORE submitting your transaction to check for risk
    pub fn analyze_sandwich_risk(
        &self,
        token_mint: &str,
        your_amount: u64,
        is_buy: bool,
    ) -> Option<SandwichAlert> {
        let activity = self.token_activity.get(token_mint)?;
        
        if activity.len() < 2 {
            return None;
        }

        let now = Instant::now();
        
        // Look for recent large transactions that could be front-running
        let recent: Vec<_> = activity
            .iter()
            .filter(|tx| now.duration_since(tx.timestamp) < self.analysis_window)
            .collect();

        if recent.is_empty() {
            return None;
        }

        // Pattern 1: Large buy just before your buy
        if is_buy {
            for tx in &recent {
                if tx.is_buy && tx.amount > your_amount * 5 {
                    // Large buy in same direction = potential front-run
                    let estimated_profit = self.estimate_sandwich_profit(your_amount, tx.amount);
                    
                    if estimated_profit > self.min_profit_threshold {
                        return Some(SandwichAlert {
                            severity: self.classify_severity(estimated_profit),
                            front_runner_tx: tx.signature.clone(),
                            victim_tx: "YOUR_TX".to_string(),
                            back_runner_tx: None,
                            token_mint: token_mint.to_string(),
                            estimated_profit_lamports: estimated_profit,
                            recommendation: "Consider using MEV protection or reducing trade size".to_string(),
                        });
                    }
                }
            }
        }

        // Pattern 2: Check for known bot addresses
        for tx in &recent {
            if self.known_bots.contains(&tx.from) {
                warn!("Known MEV bot detected: {}", tx.from);
                return Some(SandwichAlert {
                    severity: SandwichSeverity::High,
                    front_runner_tx: tx.signature.clone(),
                    victim_tx: "YOUR_TX".to_string(),
                    back_runner_tx: None,
                    token_mint: token_mint.to_string(),
                    estimated_profit_lamports: 0,
                    recommendation: "MEV bot activity detected. Use Jito bundle for protection.".to_string(),
                });
            }
        }

        None
    }

    /// Detect completed sandwich attacks (post-hoc analysis)
    pub fn detect_completed_sandwich(
        &self,
        token_mint: &str,
    ) -> Vec<SandwichAlert> {
        let mut alerts = Vec::new();
        
        let activity = match self.token_activity.get(token_mint) {
            Some(a) => a,
            None => return alerts,
        };

        // Classic sandwich pattern: BUY -> (victim) -> SELL from same address
        let txs: Vec<_> = activity.iter().collect();
        
        for i in 0..txs.len().saturating_sub(2) {
            let first = &txs[i];
            let second = &txs[i + 1];
            let third = &txs.get(i + 2);

            // Check for sandwich pattern
            if first.is_buy && !second.is_buy {
                if let Some(third) = third {
                    if !third.is_buy && first.from == third.from && first.from != second.from {
                        // Found sandwich pattern!
                        let profit = self.estimate_sandwich_profit(second.amount, first.amount);
                        
                        alerts.push(SandwichAlert {
                            severity: self.classify_severity(profit),
                            front_runner_tx: first.signature.clone(),
                            victim_tx: second.signature.clone(),
                            back_runner_tx: Some(third.signature.clone()),
                            token_mint: token_mint.to_string(),
                            estimated_profit_lamports: profit,
                            recommendation: "Completed sandwich attack detected".to_string(),
                        });
                    }
                }
            }
        }

        alerts
    }

    /// Estimate potential sandwich profit
    fn estimate_sandwich_profit(&self, victim_amount: u64, front_run_amount: u64) -> u64 {
        // Simplified estimation: larger front-run relative to victim = more profit
        // Real calculation would use AMM curve math
        let ratio = front_run_amount as f64 / victim_amount as f64;
        let slippage_impact = 0.01; // 1% base slippage
        
        (victim_amount as f64 * slippage_impact * ratio.min(10.0)) as u64
    }

    /// Classify severity based on estimated profit
    fn classify_severity(&self, profit_lamports: u64) -> SandwichSeverity {
        match profit_lamports {
            0..=100_000 => SandwichSeverity::Low,
            100_001..=1_000_000 => SandwichSeverity::Medium,
            1_000_001..=10_000_000 => SandwichSeverity::High,
            _ => SandwichSeverity::Critical,
        }
    }

    /// Get protection recommendations
    pub fn get_protection_advice(severity: SandwichSeverity) -> &'static str {
        match severity {
            SandwichSeverity::Low => "Monitor, but proceed with normal submission",
            SandwichSeverity::Medium => "Consider using Jito bundles for protection",
            SandwichSeverity::High => "Strongly recommend Jito bundle with tip",
            SandwichSeverity::Critical => "DO NOT submit without MEV protection!",
        }
    }

    /// Add a known MEV bot address
    pub fn add_known_bot(&mut self, address: String) {
        if !self.known_bots.contains(&address) {
            self.known_bots.push(address);
        }
    }

    /// Clear old activity data
    pub fn cleanup(&mut self) {
        let cutoff = Instant::now() - self.analysis_window * 100;
        
        for activity in self.token_activity.values_mut() {
            while let Some(front) = activity.front() {
                if front.timestamp < cutoff {
                    activity.pop_front();
                } else {
                    break;
                }
            }
        }

        // Remove empty entries
        self.token_activity.retain(|_, v| !v.is_empty());
    }
}

impl Default for SandwichDetector {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_severity_classification() {
        let detector = SandwichDetector::new();
        
        assert_eq!(detector.classify_severity(50_000), SandwichSeverity::Low);
        assert_eq!(detector.classify_severity(500_000), SandwichSeverity::Medium);
        assert_eq!(detector.classify_severity(5_000_000), SandwichSeverity::High);
        assert_eq!(detector.classify_severity(50_000_000), SandwichSeverity::Critical);
    }
}
