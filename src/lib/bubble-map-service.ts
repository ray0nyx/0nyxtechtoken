import { Connection, PublicKey } from '@solana/web3.js';
import { fetchDexPairData, searchTokens, type DexSearchResult } from './dex-screener-service';

export interface HolderData {
  address: string;
  balance: number;
  usdValue: number;
  percentage: number;
}

export interface BubbleMapDataPoint {
  x: number;
  y: number;
  z: number; // bubble size
  label?: string;
  color?: string;
  metadata?: any;
}

export interface TokenBubbleData {
  symbol: string;
  price: number;
  volume24h: number;
  marketCap: number;
  liquidity: number;
  change24h: number;
}

/**
 * Fetch holder distribution for a token
 * Attempts to use Birdeye API first, falls back to Solana RPC
 */
export async function fetchHolderDistribution(
  tokenMint: string,
  limit: number = 100
): Promise<HolderData[]> {
  try {
    // Try Birdeye API first (if available)
    const birdeyeApiKey = import.meta.env.VITE_BIRDEYE_API_KEY;
    if (birdeyeApiKey) {
      try {
        const response = await fetch(
          `https://public-api.birdeye.so/v1/token/holders?address=${tokenMint}&limit=${limit}`,
          {
            headers: {
              'X-API-KEY': birdeyeApiKey,
            },
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.data?.items) {
            return data.data.items.map((item: any) => ({
              address: item.address,
              balance: parseFloat(item.balance || '0'),
              usdValue: parseFloat(item.value || '0'),
              percentage: parseFloat(item.percent || '0'),
            }));
          }
        }
      } catch (error) {
        console.warn('Birdeye API failed, trying Solana RPC:', error);
      }
    }

    // Fallback: Use Solana RPC to get token accounts
    // Note: This is limited - Solana RPC doesn't provide holder list directly
    // We'd need to scan all token accounts which is expensive
    // For now, return sample data structure
    return [];
  } catch (error) {
    console.error('Error fetching holder distribution:', error);
    return [];
  }
}

/**
 * Generate holder distribution bubble map data
 */
export function generateHolderDistributionBubbles(
  holders: HolderData[]
): BubbleMapDataPoint[] {
  if (holders.length === 0) return [];

  // Group holders by balance ranges (log scale)
  const balanceRanges: Record<string, { count: number; totalValue: number }> = {};
  
  holders.forEach(holder => {
    // Use log scale for balance ranges
    const logBalance = Math.log10(Math.max(holder.balance, 1));
    const range = Math.floor(logBalance);
    const rangeKey = `${range}`;
    
    if (!balanceRanges[rangeKey]) {
      balanceRanges[rangeKey] = { count: 0, totalValue: 0 };
    }
    
    balanceRanges[rangeKey].count += 1;
    balanceRanges[rangeKey].totalValue += holder.usdValue;
  });

  // Convert to bubble map data points
  return Object.entries(balanceRanges).map(([range, data]) => {
    const balanceRange = Math.pow(10, parseInt(range));
    const concentrationRisk = data.count < 10 ? 1 : Math.min(data.count / 100, 1); // Higher = more distributed
    
    return {
      x: balanceRange, // Wallet balance (log scale)
      y: data.count, // Number of holders
      z: data.totalValue, // Total value held (bubble size)
      color: concentrationRisk > 0.5 ? '#10b981' : concentrationRisk > 0.2 ? '#f59e0b' : '#ef4444',
      metadata: {
        range: balanceRange,
        holderCount: data.count,
        totalValue: data.totalValue,
        concentrationRisk,
      },
    };
  });
}

/**
 * Fetch token data for price/volume bubble map
 */
export async function fetchTokensForBubbleMap(
  limit: number = 50
): Promise<TokenBubbleData[]> {
  try {
    // Use DexScreener search to get trending tokens
    // Search for common meme coin symbols
    const searchTerms = ['BONK', 'WIF', 'POPCAT', 'MYRO', 'SAMO', 'COPE'];
    const allTokens: TokenBubbleData[] = [];

    for (const term of searchTerms) {
      try {
        const results = await searchTokens(term);
        results.forEach(result => {
          allTokens.push({
            symbol: result.symbol,
            price: result.priceUsd || result.price,
            volume24h: result.volume24h,
            marketCap: result.marketCap || 0,
            liquidity: result.liquidity,
            change24h: result.change24h,
          });
        });
      } catch (error) {
        // Continue with other search terms
      }
    }

    // Remove duplicates and limit
    const uniqueTokens = Array.from(
      new Map(allTokens.map(token => [token.symbol, token])).values()
    ).slice(0, limit);

    return uniqueTokens;
  } catch (error) {
    console.error('Error fetching tokens for bubble map:', error);
    return [];
  }
}

/**
 * Generate price vs volume bubble map data
 */
export function generatePriceVolumeBubbles(
  tokens: TokenBubbleData[]
): BubbleMapDataPoint[] {
  return tokens.map(token => ({
    x: token.volume24h, // 24h Volume (USD)
    y: token.price, // Current Price
    z: token.marketCap, // Market Cap (bubble size)
    color: token.change24h >= 0 ? '#10b981' : '#ef4444',
    label: token.symbol,
    metadata: {
      symbol: token.symbol,
      price: token.price,
      volume24h: token.volume24h,
      marketCap: token.marketCap,
      change24h: token.change24h,
    },
  }));
}

/**
 * Generate market cap vs liquidity bubble map data
 */
export function generateMarketCapLiquidityBubbles(
  tokens: TokenBubbleData[]
): BubbleMapDataPoint[] {
  return tokens.map(token => {
    const liquidityRatio = token.marketCap > 0 
      ? token.liquidity / token.marketCap 
      : 0;
    
    // Color based on liquidity health
    let color = '#ef4444'; // Red = low liquidity
    if (liquidityRatio > 0.1) {
      color = '#10b981'; // Green = healthy
    } else if (liquidityRatio > 0.05) {
      color = '#f59e0b'; // Yellow = moderate
    }

    return {
      x: token.liquidity, // Liquidity (USD)
      y: token.marketCap, // Market Cap (USD)
      z: token.volume24h, // 24h Volume (bubble size)
      color,
      label: token.symbol,
      metadata: {
        symbol: token.symbol,
        liquidity: token.liquidity,
        marketCap: token.marketCap,
        liquidityRatio,
        volume24h: token.volume24h,
      },
    };
  });
}
