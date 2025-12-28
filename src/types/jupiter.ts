/**
 * Jupiter SDK Type Definitions
 * 
 * Re-exports and extends types from @jup-ag/api for use throughout the application
 */

import type {
  QuoteResponse,
  SwapResponse,
  QuoteGetRequest,
  SwapPostRequest,
  SwapRequest,
  RoutePlanStep,
  SwapMode,
  PlatformFee,
} from '@jup-ag/api';

// Re-export SDK types
export type {
  QuoteResponse,
  SwapResponse,
  QuoteGetRequest,
  SwapPostRequest,
  SwapRequest,
  RoutePlanStep,
  SwapMode,
  PlatformFee,
};

/**
 * Extended quote response with additional computed fields
 */
export interface EnhancedQuoteResponse extends Omit<QuoteResponse, 'priceImpactPct'> {
  // Price impact percentage (computed, override as number for convenience)
  priceImpactPct: number;
  // Effective price (output/input)
  effectivePrice: number;
  // Route complexity (number of hops)
  routeComplexity: number;
  // Estimated execution time in ms
  estimatedExecutionTime?: number;
}

/**
 * Quote comparison result
 */
export interface QuoteComparison {
  quote: EnhancedQuoteResponse;
  score: number;
  ranking: number;
  advantages: string[];
  disadvantages: string[];
}

/**
 * Route selection strategy
 */
export type RouteSelectionStrategy = 
  | 'best-output'      // Highest output amount
  | 'lowest-impact'    // Lowest price impact
  | 'best-liquidity'   // Best liquidity depth
  | 'lowest-fees'      // Lowest fees
  | 'fastest'          // Fastest execution
  | 'balanced';        // Balanced across all factors

/**
 * Quote request options
 */
export interface QuoteOptions {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps?: number;
  onlyDirectRoutes?: boolean;
  asLegacyTransaction?: boolean;
  dexes?: string[];
  excludeDexes?: string[];
  restrictIntermediateTokens?: boolean;
  platformFeeBps?: number;
  maxAccounts?: number;
  dynamicSlippage?: boolean;
}

/**
 * Swap execution options
 */
export interface SwapExecutionOptions {
  quote: QuoteResponse;
  userPublicKey: string;
  wrapAndUnwrapSol?: boolean;
  useSharedAccounts?: boolean;
  prioritizationFeeLamports?: number | 'auto';
  asLegacyTransaction?: boolean;
  feeAccount?: string;
  trackingAccount?: string;
}

/**
 * Swap execution result
 */
export interface SwapExecutionResult {
  success: boolean;
  txSignature?: string;
  swapResponse?: SwapResponse;
  error?: string;
  executionTime?: number;
}

/**
 * Route analysis
 */
export interface RouteAnalysis {
  quote: EnhancedQuoteResponse;
  routeSteps: RoutePlanStep[];
  totalHops: number;
  dexesUsed: string[];
  estimatedGas: number;
  priceImpact: number;
  liquidityScore: number;
}
