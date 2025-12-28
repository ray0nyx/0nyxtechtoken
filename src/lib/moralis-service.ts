/**
 * Moralis API Service for Real-Time Crypto Market Data
 * Documentation: https://docs.moralis.io/web3-data-api
 * 
 * For Solana: https://docs.moralis.io/web3-data-api/solana
 */

const MORALIS_API_KEY = import.meta.env.VITE_MORALIS_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6ImZmYzdiZGE4LWRiOWEtNDM1NS1iMmQ1LTBlM2EzNGEwMGZmYSIsIm9yZ0lkIjoiNDg0NzY4IiwidXNlcklkIjoiNDk4NzQwIiwidHlwZUlkIjoiMjdjOGQwYjMtOTc5YS00MWQ0LTljOGMtY2EzZWY2MWRmYTc2IiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NjQ5NTkyNjYsImV4cCI6NDkyMDcxOTI2Nn0.U3gyIHv_FFeB8TUr9IU0mROb7qTBsOv72fz2bfCbJzo';
const MORALIS_BASE_URL = 'https://deep-index.moralis.io/api/v2.2';
const MORALIS_SOLANA_BASE_URL = 'https://solana-gateway.moralis.io';

// Common Solana token addresses
const SOLANA_TOKEN_ADDRESSES: Record<string, string> = {
  'SOL': 'So11111111111111111111111111111111111111112',
  'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  'BONK': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  'RAY': '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  'ORCA': 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
};

export interface MoralisTokenPrice {
  tokenName: string;
  tokenSymbol: string;
  tokenLogo: string;
  tokenDecimals: string;
  nativePrice: {
    value: string;
    decimals: number;
    name: string;
    symbol: string;
  };
  usdPrice: number;
  usdPriceFormatted: string;
  exchangeAddress?: string;
  exchangeName?: string;
  tokenAddress: string;
  priceLastChangedAtBlock?: string;
}

export interface MoralisOHLCV {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MoralisPairData {
  symbol: string;
  price: number;
  priceUsd: number;
  change24h: number;
  volume24h: number;
  liquidity?: number;
  marketCap?: number;
  pairAddress?: string;
}

/**
 * Get token price from Moralis (Solana)
 */
export async function getMoralisTokenPrice(
  tokenSymbol: string,
  chain: string = 'solana'
): Promise<{ price: number; priceUsd: number } | null> {
  try {
    // Get token address from symbol
    const tokenAddress = SOLANA_TOKEN_ADDRESSES[tokenSymbol.toUpperCase()];
    if (!tokenAddress) {
      // If not in our mapping and it's not a valid address format, skip Moralis
      // Moralis only works with token addresses, not symbols
      // Check if it looks like an address (long hex string or base58)
      const looksLikeAddress = tokenSymbol.length >= 32 || /^[A-Za-z0-9]{32,}$/.test(tokenSymbol);
      if (!looksLikeAddress) {
        // It's a symbol, not an address - skip Moralis
        return null;
      }
      // Try to use the symbol as address (for custom tokens with address-like symbols)
      return await getMoralisSolanaTokenPrice(tokenSymbol);
    }

    if (chain.toLowerCase() === 'solana') {
      return await getMoralisSolanaTokenPrice(tokenAddress);
    }

    // For EVM chains, use the standard endpoint
    const chainMap: Record<string, string> = {
      'ethereum': 'eth',
      'bsc': 'bsc',
      'polygon': 'polygon',
      'avalanche': 'avalanche',
    };

    const moralisChain = chainMap[chain.toLowerCase()] || 'eth';

    const response = await fetch(
      `${MORALIS_BASE_URL}/erc20/${tokenAddress}/price?chain=${moralisChain}`,
      {
        method: 'GET',
        headers: {
          'X-API-Key': MORALIS_API_KEY,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return {
      price: parseFloat(data.usdPrice || '0'),
      priceUsd: parseFloat(data.usdPrice || '0'),
    };
  } catch (error) {
    console.error('Error fetching Moralis token price:', error);
    return null;
  }
}

/**
 * Get Solana token price from Moralis
 */
async function getMoralisSolanaTokenPrice(
  tokenAddress: string
): Promise<{ price: number; priceUsd: number } | null> {
  // Skip Moralis for native SOL - Moralis doesn't support native SOL token price queries
  // The native SOL address is So11111111111111111111111111111111111111112
  if (tokenAddress === 'So11111111111111111111111111111111111111112' || 
      tokenAddress.toUpperCase() === 'SOL') {
    return null;
  }
  
  // Skip Moralis for token symbols (not addresses) - they will always 404
  // Moralis only works with token addresses, not symbols like "MEME"
  if (!tokenAddress.startsWith('0x') && tokenAddress.length < 32) {
    return null;
  }
  
  // Known tokens that Moralis doesn't support - skip to avoid 404 spam
  const unsupportedTokens = [
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
  ];
  if (unsupportedTokens.includes(tokenAddress)) {
    return null;
  }

  try {
    // Suppress console errors for this fetch
    const originalError = console.error;
    const originalWarn = console.warn;
    console.error = () => {}; // Suppress errors
    console.warn = () => {}; // Suppress warnings

    let response: Response;
    try {
      response = await fetch(
      `${MORALIS_SOLANA_BASE_URL}/token/${tokenAddress}/price`,
      {
        method: 'GET',
        headers: {
          'X-API-Key': MORALIS_API_KEY,
          'Accept': 'application/json',
        },
      }
    );
    } finally {
      // Restore console functions
      console.error = originalError;
      console.warn = originalWarn;
    }

    if (!response.ok) {
      // Silently fail - 404s are expected for tokens not in Moralis
      // Don't log 404s to avoid console spam
      if (response.status !== 404) {
        // Only log non-404 errors
        console.warn(`Moralis API error for token ${tokenAddress}: ${response.status}`);
      }
      return null;
    }

    const data = await response.json();
    return {
      price: parseFloat(data.usdPrice || '0'),
      priceUsd: parseFloat(data.usdPrice || '0'),
    };
  } catch (error: any) {
    // Silently fail for 404s and network errors - these are expected
    // Only log unexpected errors
    const is404 = error?.status === 404 || 
                  error?.statusCode === 404 ||
                  error?.response?.status === 404 ||
                  error?.message?.includes('404') ||
                  error?.message?.includes('Not Found');
    const isNetworkError = error instanceof TypeError && error.message.includes('fetch');
    
    if (!is404 && !isNetworkError) {
      // Only log non-404, non-network errors
      console.warn('Error fetching Moralis token price:', error);
    }
    return null;
  }
}

/**
 * Search for tokens using Moralis
 * Note: Moralis doesn't have a direct search endpoint, so we'll use token metadata
 */
export async function searchMoralisTokens(query: string): Promise<any[]> {
  // Moralis doesn't have a search endpoint, so we'll return empty and fallback to DexScreener
  // This is a placeholder for future Moralis search functionality
  return [];
}

/**
 * Get OHLCV data from Moralis
 * Note: Moralis doesn't have direct OHLCV endpoints, so we'll use price history
 */
export async function getMoralisOHLCV(
  tokenAddress: string,
  chain: string = 'solana',
  timeframe: string = '1h',
  limit: number = 100
): Promise<MoralisOHLCV[]> {
  try {
    // Moralis doesn't have direct OHLCV endpoints
    // We'll need to use price history and aggregate it
    // For now, return empty array and fallback to other sources
    return [];
  } catch (error) {
    console.error('Error fetching Moralis OHLCV:', error);
    return [];
  }
}

/**
 * Get real-time pair data from Moralis
 * This combines token price data to create pair information
 */
export async function getMoralisPairData(
  baseToken: string,
  quoteToken: string = 'USDC',
  chain: string = 'solana'
): Promise<MoralisPairData | null> {
  try {
    // Skip Moralis for native SOL - it doesn't support native SOL token price queries
    if (baseToken.toUpperCase() === 'SOL' || 
        baseToken === 'So11111111111111111111111111111111111111112') {
      return null;
    }
    
    // Skip Moralis for known unsupported tokens (like BONK) to avoid 404 spam
    const unsupportedTokens = [
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
      'BONK',
    ];
    if (unsupportedTokens.includes(baseToken) || unsupportedTokens.includes(baseToken.toUpperCase())) {
      return null;
    }
    
    // Get prices for both tokens
    const basePriceData = await getMoralisTokenPrice(baseToken, chain);
    const quotePriceData = await getMoralisTokenPrice(quoteToken, chain);
    
    if (!basePriceData) {
      return null;
    }

    // Calculate pair price (base token price in quote token terms)
    let pairPrice = basePriceData.priceUsd;
    if (quotePriceData && quotePriceData.priceUsd > 0) {
      pairPrice = basePriceData.priceUsd / quotePriceData.priceUsd;
    }

    return {
      symbol: `${baseToken}/${quoteToken}`,
      price: pairPrice,
      priceUsd: basePriceData.priceUsd,
      change24h: 0, // Moralis doesn't provide 24h change directly - would need historical data
      volume24h: 0, // Moralis doesn't provide volume directly
      liquidity: 0,
      marketCap: 0,
    };
  } catch (error) {
    // Silently fail - Moralis is optional, fallback to other sources
    return null;
  }
}

/**
 * Get token metadata from Moralis
 */
export async function getMoralisTokenMetadata(
  tokenAddress: string,
  chain: string = 'solana'
): Promise<any | null> {
  try {
    const chainMap: Record<string, string> = {
      'solana': 'solana',
      'ethereum': 'eth',
      'bsc': 'bsc',
      'polygon': 'polygon',
      'avalanche': 'avalanche',
    };

    const moralisChain = chainMap[chain.toLowerCase()] || chain.toLowerCase();

    const response = await fetch(
      `${MORALIS_BASE_URL}/erc20/metadata?chain=${moralisChain}&addresses=${tokenAddress}`,
      {
        method: 'GET',
        headers: {
          'X-API-Key': MORALIS_API_KEY,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data[0] || null;
  } catch (error) {
    console.error('Error fetching Moralis token metadata:', error);
    return null;
  }
}

