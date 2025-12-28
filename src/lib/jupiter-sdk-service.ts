/**
 * Jupiter SDK Service
 * 
 * Service layer for interacting with Jupiter DEX aggregator using the official SDK.
 * Provides quote fetching, swap transaction building, and execution capabilities.
 */

import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import {
  createJupiterApiClient,
  type SwapApi,
  type QuoteResponse,
  type SwapResponse,
  type QuoteGetRequest,
  type SwapPostRequest,
  type SwapRequest,
} from '@jup-ag/api';
import type {
  QuoteOptions,
  SwapExecutionOptions,
  SwapExecutionResult,
  EnhancedQuoteResponse,
} from '@/types/jupiter';

// Singleton Jupiter API client instance
let jupiterClient: SwapApi | null = null;

/**
 * Get or create Jupiter API client instance
 */
function getJupiterClient(): SwapApi {
  if (!jupiterClient) {
    jupiterClient = createJupiterApiClient({
      basePath: 'https://quote-api.jup.ag',
    });
  }
  return jupiterClient;
}

/**
 * Get a quote from Jupiter for a token swap
 */
export async function getQuote(
  options: QuoteOptions
): Promise<QuoteResponse | null> {
  try {
    const client = getJupiterClient();
    
    const request: QuoteGetRequest = {
      inputMint: options.inputMint,
      outputMint: options.outputMint,
      amount: options.amount.toString(),
      slippageBps: options.slippageBps ?? 50,
      onlyDirectRoutes: options.onlyDirectRoutes ?? false,
      asLegacyTransaction: options.asLegacyTransaction ?? false,
      dexes: options.dexes,
      excludeDexes: options.excludeDexes,
      restrictIntermediateTokens: options.restrictIntermediateTokens,
      platformFeeBps: options.platformFeeBps,
      maxAccounts: options.maxAccounts,
      dynamicSlippage: options.dynamicSlippage,
    };

    const quote = await client.quoteGet(request);
    return quote;
  } catch (error) {
    console.error('Error getting Jupiter quote:', error);
    return null;
  }
}

/**
 * Get multiple quotes with different parameters for comparison
 */
export async function getQuotes(
  baseOptions: QuoteOptions,
  variations: Partial<QuoteOptions>[]
): Promise<QuoteResponse[]> {
  const quotePromises = variations.map(variation => 
    getQuote({ ...baseOptions, ...variation })
  );
  
  const quotes = await Promise.all(quotePromises);
  return quotes.filter((quote): quote is QuoteResponse => quote !== null);
}

/**
 * Get swap transaction from Jupiter
 */
export async function getSwapTransaction(
  options: SwapExecutionOptions
): Promise<SwapResponse | null> {
  try {
    const client = getJupiterClient();
    
    const swapRequest: SwapRequest = {
      userPublicKey: options.userPublicKey,
      wrapAndUnwrapSol: options.wrapAndUnwrapSol ?? true,
      useSharedAccounts: options.useSharedAccounts ?? true,
      asLegacyTransaction: options.asLegacyTransaction ?? false,
      quoteResponse: options.quote,
      feeAccount: options.feeAccount,
      trackingAccount: options.trackingAccount,
    };

    // Handle prioritization fee
    if (options.prioritizationFeeLamports !== undefined) {
      if (options.prioritizationFeeLamports === 'auto') {
        // Use priorityLevelWithMaxLamports with 'medium' level for auto
        swapRequest.prioritizationFeeLamports = {
          priorityLevel: 'medium' as any,
          maxLamports: 1000000, // 0.001 SOL max
        };
      } else if (typeof options.prioritizationFeeLamports === 'number') {
        swapRequest.prioritizationFeeLamports = options.prioritizationFeeLamports;
      } else {
        swapRequest.prioritizationFeeLamports = options.prioritizationFeeLamports;
      }
    }

    const request: SwapPostRequest = {
      swapRequest,
    };

    const swapResponse = await client.swapPost(request);
    return swapResponse;
  } catch (error) {
    console.error('Error getting Jupiter swap transaction:', error);
    return null;
  }
}

/**
 * Execute a swap transaction
 */
export async function executeSwap(
  connection: Connection,
  swapResponse: SwapResponse,
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>
): Promise<string | null> {
  try {
    // Deserialize the transaction
    const transactionBuf = Buffer.from(swapResponse.swapTransaction, 'base64');
    let transaction = VersionedTransaction.deserialize(transactionBuf);

    // Sign the transaction
    transaction = await signTransaction(transaction);

    // Serialize and send the transaction
    const rawTransaction = transaction.serialize();
    const txid = await connection.sendRawTransaction(rawTransaction, {
      skipPreflight: true,
      maxRetries: 2,
    });

    // Confirm the transaction
    await connection.confirmTransaction(txid, 'confirmed');

    return txid;
  } catch (error) {
    console.error('Error executing Jupiter swap:', error);
    return null;
  }
}

/**
 * Get quote and execute swap in one call
 */
export async function quoteAndSwap(
  connection: Connection,
  quoteOptions: QuoteOptions,
  swapOptions: Omit<SwapExecutionOptions, 'quote'>,
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>
): Promise<SwapExecutionResult> {
  const startTime = Date.now();
  
  try {
    // Get quote
    const quote = await getQuote(quoteOptions);
    if (!quote) {
      return {
        success: false,
        error: 'Failed to get quote from Jupiter',
      };
    }

    // Check price impact if available
    const priceImpact = calculatePriceImpact(quote);
    if (priceImpact > 10) {
      console.warn(`High price impact: ${priceImpact}%`);
    }

    // Get swap transaction
    const swapResponse = await getSwapTransaction({
      ...swapOptions,
      quote,
    });

    if (!swapResponse) {
      return {
        success: false,
        error: 'Failed to get swap transaction from Jupiter',
      };
    }

    // Execute the swap
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
      executionTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTime: Date.now() - startTime,
    };
  }
}

/**
 * Enhance quote with additional computed fields
 */
export function enhanceQuote(quote: QuoteResponse): EnhancedQuoteResponse {
  const inAmount = parseFloat(quote.inAmount);
  const outAmount = parseFloat(quote.outAmount);
  const effectivePrice = inAmount > 0 ? outAmount / inAmount : 0;
  
  // Parse price impact from string (SDK returns it as string)
  const priceImpactPct = quote.priceImpactPct ? parseFloat(quote.priceImpactPct) : 0;
  
  // Calculate route complexity
  const routeComplexity = quote.routePlan?.length || 0;

  return {
    ...quote,
    priceImpactPct,
    effectivePrice,
    routeComplexity,
  } as EnhancedQuoteResponse;
}

/**
 * Calculate price impact percentage
 * Note: This is a simplified calculation. For accurate price impact,
 * you would need the current market price from an oracle or DEX.
 */
function calculatePriceImpact(quote: QuoteResponse): number {
  // This is a placeholder - actual implementation would compare
  // quote price to market price
  // For now, return 0 or use quote.priceImpactPct if available
  return (quote as any).priceImpactPct || 0;
}

/**
 * Reset the Jupiter client (useful for testing or reconfiguration)
 */
export function resetJupiterClient(): void {
  jupiterClient = null;
}
