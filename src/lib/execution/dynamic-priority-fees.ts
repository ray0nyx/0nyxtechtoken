/**
 * Dynamic Priority Fee Service
 * 
 * Calculates priority fees based on real-time network congestion
 */

import { Connection } from '@solana/web3.js';

export interface NetworkCongestion {
  level: 'low' | 'medium' | 'high' | 'very_high';
  recentFees: number[]; // Recent priority fees in lamports
  averageFee: number;
  percentile95: number;
  percentile99: number;
}

export interface DynamicFeeConfig {
  baseFee: number; // Base fee in lamports
  congestionMultiplier: {
    low: number;
    medium: number;
    high: number;
    very_high: number;
  };
  minFee: number;
  maxFee: number;
}

const DEFAULT_CONFIG: DynamicFeeConfig = {
  baseFee: 10000, // 0.00001 SOL
  congestionMultiplier: {
    low: 1.0,
    medium: 2.0,
    high: 5.0,
    very_high: 10.0,
  },
  minFee: 5000, // 0.000005 SOL
  maxFee: 10000000, // 0.01 SOL
};

/**
 * Analyze network congestion from recent blocks
 */
export async function analyzeNetworkCongestion(
  connection: Connection
): Promise<NetworkCongestion> {
  try {
    // Get recent block data to analyze fees
    const recentBlocks = await connection.getRecentPrioritizationFees();
    
    if (!recentBlocks || recentBlocks.length === 0) {
      return {
        level: 'medium',
        recentFees: [],
        averageFee: DEFAULT_CONFIG.baseFee,
        percentile95: DEFAULT_CONFIG.baseFee * 2,
        percentile99: DEFAULT_CONFIG.baseFee * 5,
      };
    }
    
    // Extract fees
    const fees = recentBlocks
      .map(block => block.prioritizationFee)
      .filter(fee => fee > 0)
      .sort((a, b) => a - b);
    
    if (fees.length === 0) {
      return {
        level: 'medium',
        recentFees: [],
        averageFee: DEFAULT_CONFIG.baseFee,
        percentile95: DEFAULT_CONFIG.baseFee * 2,
        percentile99: DEFAULT_CONFIG.baseFee * 5,
      };
    }
    
    // Calculate statistics
    const averageFee = fees.reduce((a, b) => a + b, 0) / fees.length;
    const percentile95 = fees[Math.floor(fees.length * 0.95)] || averageFee;
    const percentile99 = fees[Math.floor(fees.length * 0.99)] || averageFee;
    
    // Determine congestion level
    let level: NetworkCongestion['level'] = 'low';
    if (percentile95 > DEFAULT_CONFIG.baseFee * 10) {
      level = 'very_high';
    } else if (percentile95 > DEFAULT_CONFIG.baseFee * 5) {
      level = 'high';
    } else if (percentile95 > DEFAULT_CONFIG.baseFee * 2) {
      level = 'medium';
    }
    
    return {
      level,
      recentFees: fees,
      averageFee,
      percentile95,
      percentile99,
    };
  } catch (error) {
    console.error('Error analyzing network congestion:', error);
    // Return default medium congestion
    return {
      level: 'medium',
      recentFees: [],
      averageFee: DEFAULT_CONFIG.baseFee,
      percentile95: DEFAULT_CONFIG.baseFee * 2,
      percentile99: DEFAULT_CONFIG.baseFee * 5,
    };
  }
}

/**
 * Calculate dynamic priority fee based on congestion
 */
export async function calculateDynamicPriorityFee(
  connection: Connection,
  config: DynamicFeeConfig = DEFAULT_CONFIG
): Promise<number> {
  const congestion = await analyzeNetworkCongestion(connection);
  
  // Calculate fee based on congestion level
  const multiplier = config.congestionMultiplier[congestion.level];
  let fee = config.baseFee * multiplier;
  
  // Use percentile95 as baseline for medium+ congestion
  if (congestion.level !== 'low' && congestion.percentile95 > 0) {
    fee = Math.max(fee, congestion.percentile95 * 1.1); // 10% above p95
  }
  
  // Clamp to min/max
  fee = Math.max(config.minFee, Math.min(config.maxFee, fee));
  
  return Math.floor(fee);
}

/**
 * Get priority fee with automatic congestion adjustment
 */
export async function getOptimalPriorityFee(
  connection: Connection,
  urgency: 'low' | 'medium' | 'high' = 'medium'
): Promise<number> {
  const congestion = await analyzeNetworkCongestion(connection);
  
  // Adjust based on urgency
  let targetPercentile = 50; // Default to median
  
  if (urgency === 'high') {
    targetPercentile = 99; // Use p99 for high urgency
  } else if (urgency === 'medium') {
    targetPercentile = 95; // Use p95 for medium urgency
  }
  
  // Calculate fee from target percentile
  const fees = congestion.recentFees;
  if (fees.length > 0) {
    const index = Math.floor(fees.length * (targetPercentile / 100));
    const targetFee = fees[index] || congestion.averageFee;
    
    // Add 10% buffer
    return Math.floor(targetFee * 1.1);
  }
  
  // Fallback to dynamic calculation
  return calculateDynamicPriorityFee(connection);
}
