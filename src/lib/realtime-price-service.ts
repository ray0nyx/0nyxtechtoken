import { getMoralisPairData } from './moralis-service';
import { searchTokens, fetchDexPairData, isPumpFunToken, fetchBirdeyeTokenPrice } from './dex-screener-service';

export interface PriceUpdate {
  price: number;
  timestamp: number;
  source: 'moralis' | 'dexscreener' | 'jupiter' | 'birdeye' | 'fallback';
}

export interface ConnectionStatus {
  connected: boolean;
  lastUpdate: number | null;
  errorCount: number;
  retryDelay: number;
}

// Cache to avoid excessive API calls
const priceCache = new Map<string, { price: number; timestamp: number }>();
const CACHE_DURATION = 2000; // 2 seconds cache

// Connection status tracking
const connectionStatus = new Map<string, ConnectionStatus>();
const MAX_ERROR_COUNT = 5;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 30000; // 30 seconds

/**
 * Get real-time price for a trading pair
 * Priority for Pump.fun tokens: Birdeye → DexScreener → Moralis → Cache
 * Priority for others: Moralis → DexScreener → Cache
 */
export async function getRealTimePrice(
  pair: string,
  useCache: boolean = true,
  tokenAddress?: string
): Promise<PriceUpdate | null> {
  const cacheKey = pair.toUpperCase();
  
  // Check cache first if enabled
  if (useCache) {
    const cached = priceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return {
        price: cached.price,
        timestamp: cached.timestamp,
        source: 'fallback',
      };
    }
  }

  try {
    const [baseToken, quoteToken = 'USDC'] = pair.split('/');
    
    // First, try to get DexScreener data to check if it's a Pump.fun token
    let searchResults: any[] = [];
    let isPumpFun = false;
    let resolvedTokenAddress = tokenAddress;
    
    try {
      searchResults = await searchTokens(baseToken);
      if (searchResults.length > 0) {
        isPumpFun = isPumpFunToken(searchResults[0]);
        if (!resolvedTokenAddress && searchResults[0].baseToken?.address) {
          resolvedTokenAddress = searchResults[0].baseToken.address;
        }
      }
    } catch (e) {
      // Ignore search errors
    }
    
    // For Pump.fun tokens, prioritize Birdeye
    if (isPumpFun && resolvedTokenAddress) {
      try {
        const birdeyeData = await fetchBirdeyeTokenPrice(resolvedTokenAddress);
        if (birdeyeData && birdeyeData.price > 0) {
          const update: PriceUpdate = {
            price: birdeyeData.price,
            timestamp: Date.now(),
            source: 'birdeye',
          };
          priceCache.set(cacheKey, { price: birdeyeData.price, timestamp: update.timestamp });
          console.log('✅ Birdeye price fetched for Pump.fun token:', birdeyeData.price, 'for', pair);
          return update;
        }
      } catch (birdeyeError) {
        console.warn('Birdeye price fetch failed for Pump.fun token:', birdeyeError);
      }
    }
    
    // Try Moralis (primary source for regular tokens)
    try {
      const moralisData = await getMoralisPairData(baseToken, quoteToken, 'solana');
      if (moralisData && (moralisData.priceUsd || moralisData.price) > 0) {
        const price = moralisData.priceUsd || moralisData.price;
        const update: PriceUpdate = {
          price,
          timestamp: Date.now(),
          source: 'moralis',
        };
        
        // Update cache
        priceCache.set(cacheKey, { price, timestamp: update.timestamp });
        return update;
      }
    } catch (moralisError: any) {
      // Silently fail for Moralis errors - they're expected for unsupported tokens
      // Only log unexpected errors
      const is404 = moralisError?.status === 404 || 
                    moralisError?.statusCode === 404 ||
                    moralisError?.message?.includes('404') ||
                    moralisError?.message?.includes('Not Found');
      if (!is404) {
      console.warn('Moralis price fetch failed:', moralisError);
      }
    }
    
    // Fallback to DexScreener
    try {
      const pairData = await fetchDexPairData(pair, resolvedTokenAddress);
      if (pairData && (pairData.price || pairData.priceUsd) > 0) {
        const price = pairData.price || pairData.priceUsd;
        const update: PriceUpdate = {
          price,
          timestamp: Date.now(),
          source: 'dexscreener',
        };
        
        console.log('✅ DexScreener price fetched:', price, 'for', pair);
        
        // Update cache
        priceCache.set(cacheKey, { price, timestamp: update.timestamp });
        return update;
      } else {
        console.warn('⚠️ DexScreener returned no price for', pair);
      }
    } catch (dexError: any) {
      // Silently fail for network errors
      const isNetworkError = dexError instanceof TypeError && dexError.message.includes('fetch');
      if (!isNetworkError) {
      console.warn('DexScreener price fetch failed:', dexError);
      }
    }
    
    // Return cached value if available (even if expired)
    if (useCache) {
      const cached = priceCache.get(cacheKey);
      if (cached) {
        return {
          price: cached.price,
          timestamp: cached.timestamp,
          source: 'fallback',
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching real-time price:', error);
    return null;
  }
}

/**
 * Get connection status for a pair
 */
export function getConnectionStatus(pair: string): ConnectionStatus {
  return connectionStatus.get(pair.toUpperCase()) || {
    connected: false,
    lastUpdate: null,
    errorCount: 0,
    retryDelay: INITIAL_RETRY_DELAY,
  };
}

/**
 * Update connection status
 */
function updateConnectionStatus(pair: string, success: boolean): void {
  const key = pair.toUpperCase();
  const current = connectionStatus.get(key) || {
    connected: false,
    lastUpdate: null,
    errorCount: 0,
    retryDelay: INITIAL_RETRY_DELAY,
  };
  
  if (success) {
    connectionStatus.set(key, {
      connected: true,
      lastUpdate: Date.now(),
      errorCount: 0,
      retryDelay: INITIAL_RETRY_DELAY,
    });
  } else {
    const newErrorCount = current.errorCount + 1;
    const newRetryDelay = Math.min(
      INITIAL_RETRY_DELAY * Math.pow(2, newErrorCount - 1),
      MAX_RETRY_DELAY
    );
    
    connectionStatus.set(key, {
      connected: newErrorCount < MAX_ERROR_COUNT,
      lastUpdate: current.lastUpdate,
      errorCount: newErrorCount,
      retryDelay: newRetryDelay,
    });
  }
}

/**
 * Subscribe to real-time price updates for multiple pairs
 * Returns a cleanup function to stop polling
 * Implements exponential backoff on errors
 */
export function subscribeToPriceUpdates(
  pairs: string[],
  callback: (updates: Map<string, PriceUpdate>) => void,
  onStatusChange?: (status: Map<string, ConnectionStatus>) => void,
  interval: number = 3000 // 3 seconds default
): () => void {
  let isActive = true;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  const poll = async () => {
    if (!isActive) return;
    
    const updates = new Map<string, PriceUpdate>();
    const promises = pairs.map(async (pair) => {
      try {
        const update = await getRealTimePrice(pair, true);
        if (update) {
          updates.set(pair, update);
          updateConnectionStatus(pair, true);
        } else {
          updateConnectionStatus(pair, false);
        }
      } catch (error) {
        console.warn(`Error fetching price for ${pair}:`, error);
        updateConnectionStatus(pair, false);
      }
    });
    
    await Promise.all(promises);
    
    // Notify status change
    if (onStatusChange) {
      const statusMap = new Map<string, ConnectionStatus>();
      pairs.forEach(pair => {
        statusMap.set(pair, getConnectionStatus(pair));
      });
      onStatusChange(statusMap);
    }
    
    if (updates.size > 0 && isActive) {
      callback(updates);
    }
    
    // Calculate next poll delay based on connection status
    const maxRetryDelay = Math.max(
      ...pairs.map(pair => getConnectionStatus(pair).retryDelay)
    );
    const nextInterval = Math.max(interval, maxRetryDelay);
    
    // Schedule next poll
    if (isActive) {
      timeoutId = setTimeout(poll, nextInterval);
    }
  };
  
  // Initial poll
  poll();
  
  // Return cleanup function
  return () => {
    isActive = false;
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    // Clear connection status for these pairs
    pairs.forEach(pair => {
      connectionStatus.delete(pair.toUpperCase());
    });
  };
}

/**
 * Clear price cache for a specific pair or all pairs
 */
export function clearPriceCache(pair?: string): void {
  if (pair) {
    priceCache.delete(pair.toUpperCase());
  } else {
    priceCache.clear();
  }
}

