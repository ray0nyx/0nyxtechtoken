import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { getQuote, getSwapTransaction, enhanceQuote } from './jupiter-sdk-service';
import type { QuoteResponse, SwapResponse } from '@jup-ag/api';
import type { EnhancedQuoteResponse } from '@/types/jupiter';

// Re-export types for backward compatibility
export type JupiterQuote = QuoteResponse & {
  priceImpactPct?: number;
};

export interface JupiterSwapResult {
  swapTransaction: string; // Base64 encoded transaction
  lastValidBlockHeight: number;
  prioritizationFeeLamports?: number;
}

/**
 * Get a quote from Jupiter for a token swap
 * 
 * @deprecated Use getQuote from jupiter-sdk-service instead
 * This function is kept for backward compatibility
 */
export async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = 50 // 0.5% default
): Promise<JupiterQuote | null> {
  try {
    const quote = await getQuote({
      inputMint,
      outputMint,
      amount,
      slippageBps,
    });

    if (!quote) {
      return null;
    }

    // Enhance quote to include priceImpactPct
    const enhanced = enhanceQuote(quote);
    
    // Return in old format for backward compatibility
    return {
      ...quote,
      priceImpactPct: enhanced.priceImpactPct,
    } as JupiterQuote;
  } catch (error) {
    console.error('Error getting Jupiter quote:', error);
    return null;
  }
}

/**
 * Get swap transaction from Jupiter
 * 
 * @deprecated Use getSwapTransaction from jupiter-sdk-service instead
 * This function is kept for backward compatibility
 */
export async function getJupiterSwapTransaction(
  quote: JupiterQuote,
  userPublicKey: PublicKey,
  priorityFeeLamports?: number
): Promise<JupiterSwapResult | null> {
  try {
    const swapResponse = await getSwapTransaction({
      quote: quote as QuoteResponse,
      userPublicKey: userPublicKey.toString(),
      wrapAndUnwrapSol: true,
      prioritizationFeeLamports: priorityFeeLamports,
    });

    if (!swapResponse) {
      return null;
    }

    // Convert to old format for backward compatibility
    return {
      swapTransaction: swapResponse.swapTransaction,
      lastValidBlockHeight: swapResponse.lastValidBlockHeight || 0,
      prioritizationFeeLamports: priorityFeeLamports,
    };
  } catch (error) {
    console.error('Error getting Jupiter swap transaction:', error);
    return null;
  }
}

/**
 * Execute a Jupiter swap
 * 
 * Now uses Jupiter SDK internally for transaction execution
 */
export async function executeJupiterSwap(
  connection: Connection,
  swapTransaction: string,
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>
): Promise<string | null> {
  try {
    // Import executeSwap from SDK service
    const { executeSwap } = await import('./jupiter-sdk-service');

    // Create a mock SwapResponse for execution
    // The executeSwap function only needs the swapTransaction string
    const mockSwapResponse = {
      swapTransaction,
      lastValidBlockHeight: 0,
    } as SwapResponse;

    // Execute using SDK service
    const txid = await executeSwap(connection, mockSwapResponse, signTransaction);
    return txid;
  } catch (error) {
    console.error('Error executing Jupiter swap:', error);
    return null;
  }
}

/**
 * Get the best swap route and execute in one go
 * 
 * Now uses Jupiter SDK internally
 */
export async function performSwap(
  connection: Connection,
  inputMint: string,
  outputMint: string,
  amount: number,
  userPublicKey: PublicKey,
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>,
  slippageBps: number = 50,
  priorityFeeLamports?: number
): Promise<{ txid: string; quote: JupiterQuote } | null> {
  try {
    // Use SDK service for quote
    const quote = await getJupiterQuote(inputMint, outputMint, amount, slippageBps);
    if (!quote) {
      throw new Error('Failed to get quote from Jupiter');
    }

    // Check price impact
    const priceImpact = quote.priceImpactPct || 0;
    if (priceImpact > 5) {
      console.warn(`High price impact: ${priceImpact}%`);
    }

    // Get swap transaction using SDK
    const swapResult = await getJupiterSwapTransaction(quote, userPublicKey, priorityFeeLamports);
    if (!swapResult) {
      throw new Error('Failed to get swap transaction from Jupiter');
    }

    // Execute the swap
    const txid = await executeJupiterSwap(connection, swapResult.swapTransaction, signTransaction);
    if (!txid) {
      throw new Error('Failed to execute swap transaction');
    }

    return { txid, quote };
  } catch (error) {
    console.error('Error performing swap:', error);
    return null;
  }
}

/**
 * Calculate expected output amount with slippage
 */
export function calculateMinOutput(
  expectedOutput: number,
  slippageBps: number
): number {
  const slippageMultiplier = 1 - (slippageBps / 10000);
  return expectedOutput * slippageMultiplier;
}

/**
 * Convert slippage percentage to basis points
 */
export function percentToSlippageBps(percentage: number): number {
  return Math.floor(percentage * 100);
}

/**
 * Get token decimals (you might want to cache this)
 */
export async function getTokenDecimals(
  connection: Connection,
  mintAddress: string
): Promise<number> {
  try {
    const mint = new PublicKey(mintAddress);
    const info = await connection.getParsedAccountInfo(mint);
    
    if (!info.value || !('parsed' in info.value.data)) {
      return 9; // Default to 9 decimals
    }

    return info.value.data.parsed.info.decimals;
  } catch (error) {
    console.error('Error getting token decimals:', error);
    return 9; // Default to 9 decimals
  }
}


