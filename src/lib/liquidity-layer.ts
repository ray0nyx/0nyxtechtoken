/**
 * Liquidity Layer
 * 
 * Abstraction layer over Jupiter SDK providing unified interface for swap operations,
 * route optimization, and best path selection across all DEXes.
 */

import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import {
  getQuote,
  getQuotes,
  getSwapTransaction,
  executeSwap,
  quoteAndSwap,
  enhanceQuote,
} from './jupiter-sdk-service';
import {
  compareQuotes,
  selectBestQuote,
  validateQuote,
  getRouteAnalysis,
} from './jupiter-route-comparator';
import type {
  QuoteOptions,
  SwapExecutionOptions,
  SwapExecutionResult,
  EnhancedQuoteResponse,
  RouteSelectionStrategy,
  QuoteComparison,
  RouteAnalysis,
} from '@/types/jupiter';
import type { QuoteResponse } from '@jup-ag/api';

/**
 * Liquidity Layer Service
 * 
 * Provides high-level interface for DEX aggregation and swap execution
 */
export class LiquidityLayer {
  /**
   * Get the best quote for a swap
   */
  async getBestQuote(
    options: QuoteOptions,
    strategy: RouteSelectionStrategy = 'balanced'
  ): Promise<EnhancedQuoteResponse | null> {
    const quote = await getQuote(options);
    if (!quote) {
      return null;
    }
    return enhanceQuote(quote);
  }

  /**
   * Get multiple quotes and compare them
   */
  async compareRoutes(
    baseOptions: QuoteOptions,
    variations: Partial<QuoteOptions>[],
    strategy: RouteSelectionStrategy = 'balanced'
  ): Promise<QuoteComparison[]> {
    const quotes = await getQuotes(baseOptions, variations);
    if (quotes.length === 0) {
      return [];
    }
    return compareQuotes(quotes, strategy);
  }

  /**
   * Get best route with automatic comparison
   */
  async getBestRoute(
    options: QuoteOptions,
    strategy: RouteSelectionStrategy = 'balanced',
    compareVariations: boolean = true
  ): Promise<QuoteComparison | null> {
    // Get base quote
    const baseQuote = await getQuote(options);
    if (!baseQuote) {
      return null;
    }

    // If comparison is enabled, get variations
    if (compareVariations) {
      const variations: Partial<QuoteOptions>[] = [
        { onlyDirectRoutes: true },
        { onlyDirectRoutes: false },
        { dynamicSlippage: true },
      ];

      const quotes = await getQuotes(options, variations);
      quotes.push(baseQuote); // Include base quote

      return selectBestQuote(quotes, strategy);
    }

    // Otherwise, just return the base quote
    const enhanced = enhanceQuote(baseQuote);
    const comparisons = compareQuotes([baseQuote], strategy);
    return comparisons[0] || null;
  }

  /**
   * Execute a swap with best route selection
   */
  async executeSwapWithBestRoute(
    connection: Connection,
    quoteOptions: QuoteOptions,
    swapOptions: Omit<SwapExecutionOptions, 'quote'>,
    signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>,
    strategy: RouteSelectionStrategy = 'balanced'
  ): Promise<SwapExecutionResult> {
    // Get best route
    const bestRoute = await this.getBestRoute(quoteOptions, strategy);
    
    if (!bestRoute) {
      return {
        success: false,
        error: 'Failed to find a valid route',
      };
    }

    // Validate quote
    const validation = validateQuote(bestRoute.quote);
    if (!validation.valid) {
      return {
        success: false,
        error: `Invalid quote: ${validation.errors.join(', ')}`,
      };
    }

    // Log warnings if any
    if (validation.warnings.length > 0) {
      console.warn('Quote warnings:', validation.warnings);
    }

    // Get swap transaction
    const swapResponse = await getSwapTransaction({
      ...swapOptions,
      quote: bestRoute.quote,
    });

    if (!swapResponse) {
      return {
        success: false,
        error: 'Failed to get swap transaction',
      };
    }

    // Execute swap
    const txSignature = await executeSwap(connection, swapResponse, signTransaction);
    
    if (!txSignature) {
      return {
        success: false,
        error: 'Failed to execute swap transaction',
      };
    }

    return {
      success: true,
      txSignature,
      swapResponse,
    };
  }

  /**
   * Analyze a route before execution
   */
  analyzeRoute(quote: QuoteResponse): RouteAnalysis {
    const enhanced = enhanceQuote(quote);
    return getRouteAnalysis(enhanced);
  }

  /**
   * Get quote with fallback options
   */
  async getQuoteWithFallback(
    options: QuoteOptions,
    fallbackOptions: Partial<QuoteOptions>[] = []
  ): Promise<EnhancedQuoteResponse | null> {
    // Try primary options
    let quote = await getQuote(options);
    if (quote) {
      return enhanceQuote(quote);
    }

    // Try fallback options
    for (const fallback of fallbackOptions) {
      quote = await getQuote({ ...options, ...fallback });
      if (quote) {
        return enhanceQuote(quote);
      }
    }

    return null;
  }

  /**
   * Quick swap - get quote and execute in one call
   */
  async quickSwap(
    connection: Connection,
    quoteOptions: QuoteOptions,
    swapOptions: Omit<SwapExecutionOptions, 'quote'>,
    signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>
  ): Promise<SwapExecutionResult> {
    return quoteAndSwap(connection, quoteOptions, swapOptions, signTransaction);
  }
}

// Singleton instance
let liquidityLayerInstance: LiquidityLayer | null = null;

/**
 * Get the liquidity layer instance
 */
export function getLiquidityLayer(): LiquidityLayer {
  if (!liquidityLayerInstance) {
    liquidityLayerInstance = new LiquidityLayer();
  }
  return liquidityLayerInstance;
}

/**
 * Convenience functions
 */

/**
 * Get best quote for a swap
 */
export async function getBestQuote(
  options: QuoteOptions,
  strategy: RouteSelectionStrategy = 'balanced'
): Promise<EnhancedQuoteResponse | null> {
  return getLiquidityLayer().getBestQuote(options, strategy);
}

/**
 * Get best route with automatic comparison
 */
export async function getBestRoute(
  options: QuoteOptions,
  strategy: RouteSelectionStrategy = 'balanced',
  compareVariations: boolean = true
): Promise<QuoteComparison | null> {
  return getLiquidityLayer().getBestRoute(options, strategy, compareVariations);
}

/**
 * Execute swap with best route
 */
export async function executeSwapWithBestRoute(
  connection: Connection,
  quoteOptions: QuoteOptions,
  swapOptions: Omit<SwapExecutionOptions, 'quote'>,
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>,
  strategy: RouteSelectionStrategy = 'balanced'
): Promise<SwapExecutionResult> {
  return getLiquidityLayer().executeSwapWithBestRoute(
    connection,
    quoteOptions,
    swapOptions,
    signTransaction,
    strategy
  );
}

/**
 * Quick swap (quote + execute)
 */
export async function quickSwap(
  connection: Connection,
  quoteOptions: QuoteOptions,
  swapOptions: Omit<SwapExecutionOptions, 'quote'>,
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>
): Promise<SwapExecutionResult> {
  return getLiquidityLayer().quickSwap(
    connection,
    quoteOptions,
    swapOptions,
    signTransaction
  );
}
