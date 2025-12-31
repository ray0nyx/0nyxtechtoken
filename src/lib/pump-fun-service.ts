/**
 * Pump.fun API Service
 * Fetches real-time data about newly created Solana meme coins
 */
import { proxyImageUrl } from './ipfs-utils';

export interface PumpFunCoin {
  mint: string;
  name: string;
  symbol: string;
  description?: string;
  image_uri: string;
  video_uri?: string;
  metadata_uri?: string;
  twitter?: string;
  telegram?: string;
  bonding_curve?: string;
  associated_bonding_curve?: string;
  creator: string;
  created_timestamp: number;
  raydium_pool?: string;
  complete: boolean;
  virtual_sol_reserves?: number;
  virtual_token_reserves?: number;
  total_supply?: number;
  website?: string;
  show_name: boolean;
  king_of_the_hill_timestamp?: number;
  market_cap: number;
  reply_count?: number;
  last_reply?: number;
  nsfw: boolean;
  market_id?: string;
  inverted?: boolean;
  usd_market_cap: number;
  // DexScreener additional fields
  volume_24h?: number;
  liquidity?: number;
  price_change_24h?: number;
  source?: string;
}

export interface PumpFunResponse {
  coins?: PumpFunCoin[];
  [key: string]: any;
}

const PUMP_FUN_API = 'https://frontend-api.pump.fun';

/**
 * Fetch newly created coins from Pump.fun
 * Uses backend proxy to avoid CORS issues
 */
export async function fetchNewPumpFunCoins(limit: number = 50): Promise<PumpFunCoin[]> {
  try {
    // Use backend proxy endpoint to avoid CORS
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001';

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    try {
      const response = await fetch(
        `${apiUrl}/api/pump-fun/coins?offset=0&limit=${limit}&sort=created_timestamp&order=DESC&include_nsfw=false&_t=${Date.now()}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
          cache: 'no-store',
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn('Pump.fun API proxy error:', response.status, response.statusText);
        return [];
      }

      const data = await response.json();

      // Backend returns { coins: [...], count: ... }
      if (data.coins && Array.isArray(data.coins)) {
        console.log(`Successfully fetched ${data.coins.length} coins from backend`);

        // Debug: Log sample of what we got
        if (data.coins.length > 0) {
          const sample = data.coins.slice(0, 2);
          console.log('Sample coins from backend:', sample.map((c: any) => ({
            symbol: c.symbol,
            complete: c.complete,
            raydium_pool: c.raydium_pool,
            market_cap: c.usd_market_cap || c.market_cap,
            mint: c.mint?.substring(0, 8) + '...'
          })));
        }

        return data.coins.map((coin: PumpFunCoin) => ({
          ...coin,
          image_uri: proxyImageUrl(coin.image_uri)
        }));
      }

      console.warn('Backend returned unexpected format:', data);
      return [];
    } catch (fetchError: any) {
      clearTimeout(timeoutId);

      if (fetchError.name === 'AbortError') {
        console.warn('Request to backend timed out after 8 seconds');
      } else {
        console.warn('Failed to fetch from backend:', fetchError);
      }

      // Don't try direct API fallback - it will fail due to CORS
      return [];
    }
  } catch (error) {
    console.warn('Failed to fetch from Pump.fun:', error);
    return [];
  }
}

/**
 * Fetch "King of the Hill" - top performing coins
 */
export async function fetchKingOfTheHill(): Promise<PumpFunCoin[]> {
  try {
    const response = await fetch(
      `${PUMP_FUN_API}/coins/king-of-the-hill?includeNsfw=false`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.warn('Pump.fun King of the Hill API error:', response.status);
      return [];
    }

    const data = await response.json();

    if (Array.isArray(data)) {
      return data;
    }

    if (data.coins && Array.isArray(data.coins)) {
      return data.coins.map((coin: PumpFunCoin) => ({
        ...coin,
        image_uri: proxyImageUrl(coin.image_uri)
      }));
    }

    // Single coin response
    if (data.mint) {
      return [{
        ...data,
        image_uri: proxyImageUrl(data.image_uri)
      }];
    }

    return [];
  } catch (error) {
    console.warn('Failed to fetch King of the Hill:', error);
    return [];
  }
}

/**
 * Fetch coin details by mint address
 */
export async function fetchPumpFunCoinDetails(mint: string): Promise<PumpFunCoin | null> {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001';

    // 1. Try Pump.fun Backend Proxy
    try {
      const response = await fetch(`${apiUrl}/api/pump-fun/coins/${mint}`);
      if (response.ok) {
        const coin = await response.json();
        return {
          ...coin,
          image_uri: proxyImageUrl(coin.image_uri)
        };
      }
    } catch (e) {
      // Ignore and try fallback
    }

    // 2. Fallback to Birdeye (via Backend Proxy) for established tokens
    try {
      const response = await fetch(`${apiUrl}/api/birdeye/token_overview?address=${mint}`);
      if (response.ok) {
        const data = await response.json();
        // Map Birdeye data to PumpFunCoin format
        if (data && (data.data || data.success)) {
          const info = data.data || data;
          return {
            mint: info.address || mint,
            name: info.name || 'Unknown',
            symbol: info.symbol || 'UNKNOWN',
            description: 'Fetched via Birdeye',
            image_uri: info.logoURI || info.logo_uri || '',
            creator: '',
            created_timestamp: Date.now(),
            complete: true,
            market_cap: info.mc || info.marketCap || 0,
            usd_market_cap: info.mc || info.marketCap || 0,
            show_name: true,
            nsfw: false
          } as PumpFunCoin;
        }
      }
    } catch (e) {
      console.warn('Fallback fetch failed:', e);
    }

    return null;
  } catch (error) {
    console.warn('Failed to fetch coin details:', error);
    return null;
  }
}

/**
 * Fetch trending/featured coins
 */
/**
 * Fetch trending/featured coins
 */
export async function fetchTrendingPumpFunCoins(limit: number = 50): Promise<PumpFunCoin[]> {
  try {
    // Use backend proxy endpoint to avoid CORS
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001';

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    try {
      const response = await fetch(
        `${apiUrl}/api/pump-fun/coins?offset=0&limit=${limit}&sort=usd_market_cap&order=DESC&include_nsfw=false&_t=${Date.now()}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
          cache: 'no-store',
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn('Pump.fun API proxy error (Trending):', response.status);
        return [];
      }

      const data = await response.json();

      // Backend returns { coins: [...], count: ... }
      if (data.coins && Array.isArray(data.coins)) {
        return data.coins.map((coin: PumpFunCoin) => ({
          ...coin,
          image_uri: proxyImageUrl(coin.image_uri)
        }));
      }

      return [];
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      console.warn('Failed to fetch trending from backend:', fetchError);
      return [];
    }
  } catch (error) {
    console.warn('Failed to fetch trending coins:', error);
    return [];
  }
}

/**
 * Calculate time since creation
 */
export function getTimeSinceCreation(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return `${diffSeconds}s`;
  if (diffMinutes < 60) return `${diffMinutes}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays}d`;
}

/**
 * Format market cap for display
 */
export function formatPumpFunMarketCap(marketCap: number): string {
  if (marketCap >= 1_000_000_000) {
    return `$${(marketCap / 1_000_000_000).toFixed(2)}B`;
  }
  if (marketCap >= 1_000_000) {
    return `$${(marketCap / 1_000_000).toFixed(2)}M`;
  }
  if (marketCap >= 1_000) {
    return `$${(marketCap / 1_000).toFixed(2)}K`;
  }
  return `$${marketCap.toFixed(2)}`;
}
