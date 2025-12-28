/**
 * Jupiter Quote Prefetching Service
 * 
 * Continuously prefetches Jupiter quotes at 300-500ms intervals
 * to ensure instant swap execution without waiting for quote fetch.
 * 
 * Features:
 * - Configurable prefetch interval (300-500ms)
 * - Automatic retry on failure
 * - Quote caching with expiry
 * - Amount-specific quote caching
 * - Integration with Zustand store
 */

import { useTradingStore, type JupiterQuote } from '@/stores/useTradingStore';
import { getQuote } from './jupiter-sdk-service';
import type { QuoteResponse } from '@jup-ag/api';
import { enhanceQuote } from './jupiter-sdk-service';

// ============ Configuration ============

const DEFAULT_PREFETCH_INTERVAL = 400; // 400ms
const MIN_PREFETCH_INTERVAL = 300;
const MAX_PREFETCH_INTERVAL = 1000;
const QUOTE_VALIDITY_MS = 1000; // Quotes valid for 1 second
const DEFAULT_SLIPPAGE_BPS = 50; // 0.5% default slippage

// Common SOL mint
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// Preset amounts in lamports (for SOL)
const PRESET_AMOUNTS = [
  0.01 * 1e9,  // 0.01 SOL
  0.1 * 1e9,   // 0.1 SOL
  0.5 * 1e9,   // 0.5 SOL
  1 * 1e9,     // 1 SOL
];

// ============ Types ============

interface PrefetchConfig {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps?: number;
}

interface CachedQuote {
  quote: JupiterQuote;
  fetchedAt: number;
  expiresAt: number;
  amount: number;
}

/**
 * Convert QuoteResponse to JupiterQuote format for backward compatibility
 */
function convertToJupiterQuote(quote: QuoteResponse): JupiterQuote {
  const enhanced = enhanceQuote(quote);
  return {
    ...quote,
    priceImpactPct: enhanced.priceImpactPct,
  } as JupiterQuote;
}

// ============ Jupiter Prefetcher Class ============

class JupiterPrefetcher {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private currentConfig: PrefetchConfig | null = null;
  private quoteCache: Map<string, CachedQuote> = new Map();
  private isRunning = false;
  private prefetchInterval: number = DEFAULT_PREFETCH_INTERVAL;
  private lastFetchError: string | null = null;
  private consecutiveErrors = 0;
  private maxConsecutiveErrors = 5;
  
  // ============ Configuration ============
  
  /**
   * Start prefetching quotes for a specific token pair
   */
  start(config: PrefetchConfig): void {
    this.stop();
    
    this.currentConfig = {
      ...config,
      slippageBps: config.slippageBps ?? DEFAULT_SLIPPAGE_BPS,
    };
    
    this.isRunning = true;
    this.consecutiveErrors = 0;
    this.lastFetchError = null;
    
    // Fetch immediately
    this.fetchQuote();
    
    // Start interval
    this.intervalId = setInterval(() => {
      this.fetchQuote();
    }, this.prefetchInterval);
    
    console.log(`[JupiterPrefetch] Started prefetching for ${config.outputMint} at ${this.prefetchInterval}ms interval`);
  }
  
  /**
   * Stop prefetching
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.isRunning = false;
    this.currentConfig = null;
    
    console.log('[JupiterPrefetch] Stopped');
  }
  
  /**
   * Update the amount to prefetch quotes for
   */
  setAmount(amount: number): void {
    if (this.currentConfig) {
      this.currentConfig.amount = amount;
      // Fetch immediately with new amount
      this.fetchQuote();
    }
  }
  
  /**
   * Set the prefetch interval
   */
  setInterval(intervalMs: number): void {
    this.prefetchInterval = Math.max(
      MIN_PREFETCH_INTERVAL,
      Math.min(MAX_PREFETCH_INTERVAL, intervalMs)
    );
    
    // Restart with new interval if running
    if (this.isRunning && this.currentConfig) {
      const config = this.currentConfig;
      this.stop();
      this.start(config);
    }
  }
  
  // ============ Quote Fetching ============
  
  private async fetchQuote(): Promise<void> {
    if (!this.currentConfig || !this.isRunning) return;
    
    const { inputMint, outputMint, amount, slippageBps } = this.currentConfig;
    
    try {
      // Use SDK service to get quote
      const quoteResponse = await getQuote({
        inputMint,
        outputMint,
        amount,
        slippageBps,
      });
      
      if (quoteResponse) {
        // Convert to JupiterQuote format for backward compatibility
        const quote = convertToJupiterQuote(quoteResponse);
        
        const now = Date.now();
        const cached: CachedQuote = {
          quote,
          fetchedAt: now,
          expiresAt: now + QUOTE_VALIDITY_MS,
          amount,
        };
        
        // Cache with amount-specific key
        const cacheKey = this.getCacheKey(inputMint, outputMint, amount);
        this.quoteCache.set(cacheKey, cached);
        
        // Also cache with generic key (for getCachedQuote without amount)
        const genericKey = this.getCacheKey(inputMint, outputMint);
        this.quoteCache.set(genericKey, cached);
        
        // Update store
        useTradingStore.getState().setCachedQuote(quote);
        
        // Reset error tracking
        this.consecutiveErrors = 0;
        this.lastFetchError = null;
        
      } else {
        this.handleFetchError('No quote returned');
      }
      
    } catch (error) {
      this.handleFetchError(error instanceof Error ? error.message : 'Unknown error');
    }
  }
  
  private handleFetchError(error: string): void {
    this.consecutiveErrors++;
    this.lastFetchError = error;
    
    console.warn(`[JupiterPrefetch] Quote fetch error (${this.consecutiveErrors}/${this.maxConsecutiveErrors}): ${error}`);
    
    // Slow down if too many errors
    if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
      console.warn('[JupiterPrefetch] Too many errors, slowing down interval');
      this.setInterval(this.prefetchInterval * 2);
    }
  }
  
  // ============ Cache Access ============
  
  /**
   * Get a cached quote if still valid
   */
  getCachedQuote(
    inputMint?: string,
    outputMint?: string,
    amount?: number
  ): JupiterQuote | null {
    const config = this.currentConfig;
    
    const input = inputMint ?? config?.inputMint ?? SOL_MINT;
    const output = outputMint ?? config?.outputMint;
    
    if (!output) return null;
    
    // Try amount-specific cache first
    if (amount) {
      const cacheKey = this.getCacheKey(input, output, amount);
      const cached = this.quoteCache.get(cacheKey);
      
      if (cached && Date.now() < cached.expiresAt) {
        return cached.quote;
      }
    }
    
    // Fall back to generic cache
    const genericKey = this.getCacheKey(input, output);
    const cached = this.quoteCache.get(genericKey);
    
    if (cached && Date.now() < cached.expiresAt) {
      return cached.quote;
    }
    
    return null;
  }
  
  /**
   * Check if we have a valid cached quote
   */
  hasValidQuote(inputMint?: string, outputMint?: string, amount?: number): boolean {
    return this.getCachedQuote(inputMint, outputMint, amount) !== null;
  }
  
  /**
   * Get quote age in milliseconds (how old the current cached quote is)
   */
  getQuoteAge(): number {
    const config = this.currentConfig;
    if (!config) return Infinity;
    
    const cacheKey = this.getCacheKey(config.inputMint, config.outputMint);
    const cached = this.quoteCache.get(cacheKey);
    
    if (!cached) return Infinity;
    
    return Date.now() - cached.fetchedAt;
  }
  
  private getCacheKey(inputMint: string, outputMint: string, amount?: number): string {
    if (amount !== undefined) {
      return `${inputMint}:${outputMint}:${amount}`;
    }
    return `${inputMint}:${outputMint}`;
  }
  
  // ============ Status ============
  
  isActive(): boolean {
    return this.isRunning;
  }
  
  getCurrentConfig(): PrefetchConfig | null {
    return this.currentConfig ? { ...this.currentConfig } : null;
  }
  
  getLastError(): string | null {
    return this.lastFetchError;
  }
  
  getStats(): {
    isRunning: boolean;
    interval: number;
    cacheSize: number;
    consecutiveErrors: number;
    lastError: string | null;
  } {
    return {
      isRunning: this.isRunning,
      interval: this.prefetchInterval,
      cacheSize: this.quoteCache.size,
      consecutiveErrors: this.consecutiveErrors,
      lastError: this.lastFetchError,
    };
  }
  
  // ============ Preset Amount Prefetching ============
  
  /**
   * Start prefetching for multiple preset amounts
   * Useful for pre-caching quotes for quick buy buttons
   */
  prefetchPresetAmounts(outputMint: string, slippageBps?: number): void {
    // Prefetch quotes for all preset amounts in parallel
    PRESET_AMOUNTS.forEach(amount => {
      this.prefetchAmount(outputMint, amount, slippageBps);
    });
  }
  
  private async prefetchAmount(
    outputMint: string,
    amount: number,
    slippageBps?: number
  ): Promise<void> {
    try {
      // Use SDK service to get quote
      const quoteResponse = await getQuote({
        inputMint: SOL_MINT,
        outputMint,
        amount,
        slippageBps: slippageBps ?? DEFAULT_SLIPPAGE_BPS,
      });
      
      if (quoteResponse) {
        // Convert to JupiterQuote format
        const quote = convertToJupiterQuote(quoteResponse);
        
        const now = Date.now();
        const cacheKey = this.getCacheKey(SOL_MINT, outputMint, amount);
        
        this.quoteCache.set(cacheKey, {
          quote,
          fetchedAt: now,
          expiresAt: now + QUOTE_VALIDITY_MS,
          amount,
        });
      }
    } catch (error) {
      // Silently fail for preset prefetching
      console.debug(`[JupiterPrefetch] Failed to prefetch amount ${amount}:`, error);
    }
  }
  
  // ============ Cache Management ============
  
  /**
   * Clear all cached quotes
   */
  clearCache(): void {
    this.quoteCache.clear();
    useTradingStore.getState().setCachedQuote(null);
  }
  
  /**
   * Remove expired quotes from cache
   */
  cleanExpiredQuotes(): void {
    const now = Date.now();
    
    for (const [key, cached] of this.quoteCache.entries()) {
      if (now >= cached.expiresAt) {
        this.quoteCache.delete(key);
      }
    }
  }
}

// ============ Singleton Instance ============

let prefetcherInstance: JupiterPrefetcher | null = null;

export function getJupiterPrefetcher(): JupiterPrefetcher {
  if (!prefetcherInstance) {
    prefetcherInstance = new JupiterPrefetcher();
  }
  return prefetcherInstance;
}

// ============ Convenience Functions ============

/**
 * Start prefetching quotes for buying a token with SOL
 */
export function startPrefetchingForBuy(
  tokenMint: string,
  amountLamports: number,
  slippageBps?: number
): void {
  getJupiterPrefetcher().start({
    inputMint: SOL_MINT,
    outputMint: tokenMint,
    amount: amountLamports,
    slippageBps,
  });
}

/**
 * Start prefetching quotes for selling a token for SOL
 */
export function startPrefetchingForSell(
  tokenMint: string,
  amountTokens: number,
  slippageBps?: number
): void {
  getJupiterPrefetcher().start({
    inputMint: tokenMint,
    outputMint: SOL_MINT,
    amount: amountTokens,
    slippageBps,
  });
}

/**
 * Stop prefetching
 */
export function stopPrefetching(): void {
  getJupiterPrefetcher().stop();
}

/**
 * Get cached quote or null
 */
export function getCachedJupiterQuote(
  inputMint?: string,
  outputMint?: string,
  amount?: number
): JupiterQuote | null {
  return getJupiterPrefetcher().getCachedQuote(inputMint, outputMint, amount);
}

// ============ React Hook ============

import { useEffect, useCallback, useState } from 'react';

export function useJupiterPrefetch(
  tokenMint: string | null,
  amountLamports: number = 0.1 * 1e9, // Default 0.1 SOL
  slippageBps: number = DEFAULT_SLIPPAGE_BPS
) {
  const prefetcher = getJupiterPrefetcher();
  const [quote, setQuote] = useState<JupiterQuote | null>(null);
  const cachedQuote = useTradingStore((state) => state.cachedQuote);
  
  // Start prefetching when token changes
  useEffect(() => {
    if (tokenMint) {
      startPrefetchingForBuy(tokenMint, amountLamports, slippageBps);
      
      // Also prefetch for preset amounts
      prefetcher.prefetchPresetAmounts(tokenMint, slippageBps);
      
      return () => {
        // Don't stop - let it continue for potential follow-up trades
      };
    }
  }, [tokenMint, amountLamports, slippageBps]);
  
  // Update local quote state when cache updates
  useEffect(() => {
    setQuote(cachedQuote);
  }, [cachedQuote]);
  
  const updateAmount = useCallback((newAmount: number) => {
    prefetcher.setAmount(newAmount);
  }, []);
  
  const getQuote = useCallback((amount?: number) => {
    return prefetcher.getCachedQuote(undefined, tokenMint || undefined, amount);
  }, [tokenMint]);
  
  const isQuoteValid = useCallback(() => {
    return prefetcher.hasValidQuote(undefined, tokenMint || undefined);
  }, [tokenMint]);
  
  return {
    quote,
    isActive: prefetcher.isActive(),
    updateAmount,
    getQuote,
    isQuoteValid,
    quoteAge: prefetcher.getQuoteAge(),
    stats: prefetcher.getStats(),
  };
}

export default JupiterPrefetcher;





