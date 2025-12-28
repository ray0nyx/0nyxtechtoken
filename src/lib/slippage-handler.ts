/**
 * Slippage Handling Service
 * 
 * Calculates dynamic slippage, price impact warnings, and slippage protection.
 * 
 * Features:
 * - Dynamic slippage calculation based on liquidity
 * - Price impact estimation
 * - Slippage protection (reject if exceeds threshold)
 * - Real-time warnings
 */

import { JupiterQuote } from './jupiter-swap-service';

// ============ Configuration ============

const DEFAULT_SLIPPAGE_BPS = 50; // 0.5%
const MAX_SLIPPAGE_BPS = 500; // 5% max
const HIGH_IMPACT_THRESHOLD = 3.0; // 3% price impact = high
const CRITICAL_IMPACT_THRESHOLD = 5.0; // 5% price impact = critical

// ============ Types ============

export interface SlippageAnalysis {
  slippageBps: number;
  priceImpactPct: number;
  isHighImpact: boolean;
  isCriticalImpact: boolean;
  recommendedSlippageBps: number;
  minOutputAmount: number;
  estimatedOutput: number;
  warning?: string;
}

export interface LiquidityInfo {
  totalLiquidityUsd: number;
  tokenReserves: number;
  solReserves: number;
  priceImpact1k: number; // Price impact for $1K swap
}

// ============ Slippage Calculator ============

export class SlippageHandler {
  /**
   * Calculate dynamic slippage based on liquidity and swap size
   */
  static calculateDynamicSlippage(
    swapAmountUsd: number,
    liquidityInfo?: LiquidityInfo
  ): number {
    if (!liquidityInfo || liquidityInfo.totalLiquidityUsd === 0) {
      // No liquidity info - use conservative default
      return 100; // 1%
    }
    
    // Calculate price impact for this swap
    const liquidityRatio = swapAmountUsd / liquidityInfo.totalLiquidityUsd;
    
    // Higher liquidity ratio = higher slippage needed
    if (liquidityRatio > 0.1) {
      // Swap is > 10% of liquidity - high slippage
      return 300; // 3%
    } else if (liquidityRatio > 0.05) {
      // Swap is 5-10% of liquidity
      return 150; // 1.5%
    } else if (liquidityRatio > 0.01) {
      // Swap is 1-5% of liquidity
      return 100; // 1%
    } else {
      // Small swap relative to liquidity
      return 50; // 0.5%
    }
  }
  
  /**
   * Analyze slippage and price impact from Jupiter quote
   */
  static analyzeSlippage(
    quote: JupiterQuote,
    swapAmountUsd: number,
    liquidityInfo?: LiquidityInfo
  ): SlippageAnalysis {
    const priceImpactPct = quote.priceImpactPct || 0;
    const slippageBps = quote.slippageBps || DEFAULT_SLIPPAGE_BPS;
    
    // Calculate estimated output
    const inAmount = parseFloat(quote.inAmount);
    const outAmount = parseFloat(quote.outAmount);
    const estimatedOutput = outAmount;
    
    // Calculate minimum output with slippage
    const slippageMultiplier = 1 - (slippageBps / 10000);
    const minOutputAmount = estimatedOutput * slippageMultiplier;
    
    // Determine if high/critical impact
    const isHighImpact = priceImpactPct >= HIGH_IMPACT_THRESHOLD;
    const isCriticalImpact = priceImpactPct >= CRITICAL_IMPACT_THRESHOLD;
    
    // Calculate recommended slippage
    const recommendedSlippageBps = this.calculateDynamicSlippage(
      swapAmountUsd,
      liquidityInfo
    );
    
    // Generate warning if needed
    let warning: string | undefined;
    if (isCriticalImpact) {
      warning = `Critical price impact: ${priceImpactPct.toFixed(2)}%. This swap will significantly move the price.`;
    } else if (isHighImpact) {
      warning = `High price impact: ${priceImpactPct.toFixed(2)}%. Consider splitting into smaller swaps.`;
    } else if (slippageBps < recommendedSlippageBps) {
      warning = `Recommended slippage: ${(recommendedSlippageBps / 100).toFixed(2)}% (current: ${(slippageBps / 100).toFixed(2)}%)`;
    }
    
    return {
      slippageBps,
      priceImpactPct,
      isHighImpact,
      isCriticalImpact,
      recommendedSlippageBps,
      minOutputAmount,
      estimatedOutput,
      warning,
    };
  }
  
  /**
   * Check if swap should be rejected due to slippage
   */
  static shouldRejectSwap(
    analysis: SlippageAnalysis,
    maxSlippageBps: number = MAX_SLIPPAGE_BPS
  ): { reject: boolean; reason?: string } {
    // Reject if slippage exceeds max
    if (analysis.slippageBps > maxSlippageBps) {
      return {
        reject: true,
        reason: `Slippage ${(analysis.slippageBps / 100).toFixed(2)}% exceeds maximum ${(maxSlippageBps / 100).toFixed(2)}%`,
      };
    }
    
    // Reject if critical price impact
    if (analysis.isCriticalImpact) {
      return {
        reject: true,
        reason: `Critical price impact: ${analysis.priceImpactPct.toFixed(2)}%. Transaction rejected for protection.`,
      };
    }
    
    return { reject: false };
  }
  
  /**
   * Calculate price impact for a given swap size
   */
  static estimatePriceImpact(
    swapAmountUsd: number,
    liquidityInfo: LiquidityInfo
  ): number {
    if (liquidityInfo.totalLiquidityUsd === 0) {
      return 100; // 100% impact if no liquidity
    }
    
    // Simplified: impact = (swap_amount / liquidity) * 100
    // More accurate would use constant product formula
    const impact = (swapAmountUsd / liquidityInfo.totalLiquidityUsd) * 100;
    return Math.min(impact, 100); // Cap at 100%
  }
  
  /**
   * Get slippage protection recommendation
   */
  static getSlippageProtection(
    analysis: SlippageAnalysis
  ): {
    shouldProtect: boolean;
    recommendedAction: string;
  } {
    if (analysis.isCriticalImpact) {
      return {
        shouldProtect: true,
        recommendedAction: 'Reject swap - critical price impact',
      };
    }
    
    if (analysis.isHighImpact) {
      return {
        shouldProtect: true,
        recommendedAction: 'Consider reducing swap size or splitting into multiple swaps',
      };
    }
    
    if (analysis.slippageBps < analysis.recommendedSlippageBps) {
      return {
        shouldProtect: true,
        recommendedAction: `Increase slippage tolerance to ${(analysis.recommendedSlippageBps / 100).toFixed(2)}%`,
      };
    }
    
    return {
      shouldProtect: false,
      recommendedAction: 'Swap parameters are acceptable',
    };
  }
}

// ============ Helper Functions ============

export function percentToSlippageBps(percent: number): number {
  return Math.floor(percent * 100);
}

export function slippageBpsToPercent(bps: number): number {
  return bps / 100;
}

export function calculateMinOutput(
  expectedOutput: number,
  slippageBps: number
): number {
  const slippageMultiplier = 1 - (slippageBps / 10000);
  return expectedOutput * slippageMultiplier;
}
