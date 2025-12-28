/**
 * Birdeye WebSocket Service
 * Professional-grade real-time data streaming for Solana tokens
 * 
 * Features:
 * - WebSocket connection with auto-reconnection
 * - Real-time price and trade updates
 * - OHLCV data fetching via REST API
 * - Exponential backoff for reconnection
 */

export interface BirdeyePriceData {
  address: string;
  value: number;
  updateUnixTime: number;
  updateHumanTime: string;
  priceChange24h: number;
}

export interface BirdeyeTradeData {
  address: string;
  txHash: string;
  blockUnixTime: number;
  source: string;
  side: 'buy' | 'sell';
  price: number;
  priceUsd: number;
  volume: number;
  volumeUsd: number;
  owner: string;
}

export interface BirdeyeOHLCV {
  unixTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  type: string;
}

export interface BirdeyeTokenOverview {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  liquidity: number;
  supply: number;
  logoURI?: string;
}

type PriceCallback = (data: BirdeyePriceData) => void;
type TradeCallback = (data: BirdeyeTradeData) => void;
type OHLCVCallback = (data: BirdeyeOHLCV) => void;
type StatusCallback = (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;

const BIRDEYE_WS_URL = 'wss://public-api.birdeye.so/socket/solana';
const BIRDEYE_API_BASE = 'https://public-api.birdeye.so'; // Defined constant
const API_URL = import.meta.env.VITE_WAGYU_API_URL || 'http://localhost:8001';

/**
 * Get Birdeye API key from environment
 */
function getApiKey(): string {
  return import.meta.env.VITE_BIRDEYE_API_KEY || '';
}

/**
 * Fetch token overview from Birdeye
 */
export async function fetchTokenOverview(tokenAddress: string): Promise<BirdeyeTokenOverview | null> {
  // Use backend proxy if available to avoid CORS/Header issues
  const useProxy = true; // Always use proxy for stability

  if (!useProxy && !getApiKey()) {
    console.warn('No Birdeye API key configured');
    return null;
  }

  try {
    const url = useProxy
      ? `${API_URL}/api/birdeye/token_overview?address=${tokenAddress}`
      : `${BIRDEYE_API_BASE}/defi/token_overview?address=${tokenAddress}`;

    const headers: HeadersInit = {
      'Accept': 'application/json',
    };

    if (!useProxy) {
      headers['X-API-KEY'] = getApiKey();
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Birdeye API error: ${response.status}`);
    }

    const data = await response.json();
    if (data.success && data.data) {
      return {
        address: tokenAddress,
        symbol: data.data.symbol || '',
        name: data.data.name || '',
        decimals: data.data.decimals || 9,
        price: data.data.price || 0,
        priceChange24h: data.data.priceChange24hPercent || 0,
        volume24h: data.data.v24hUSD || 0,
        marketCap: data.data.mc || 0,
        liquidity: data.data.liquidity || 0,
        supply: data.data.supply || 0,
        logoURI: data.data.logoURI,
      };
    }
    return null;
  } catch (error) {
    console.error('Failed to fetch token overview:', error);
    return null;
  }
}

/**
 * Fetch current price from Birdeye
 */
export async function fetchCurrentPrice(tokenAddress: string): Promise<BirdeyePriceData | null> {
  const useProxy = true;

  try {
    const url = useProxy
      ? `${API_URL}/api/birdeye/price?address=${tokenAddress}`
      : `${BIRDEYE_API_BASE}/defi/price?address=${tokenAddress}`;

    const headers: HeadersInit = {
      'Accept': 'application/json',
    };

    if (!useProxy) {
      headers['X-API-KEY'] = getApiKey();
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Birdeye API error: ${response.status}`);
    }

    const data = await response.json();
    if (data.success && data.data) {
      return {
        address: tokenAddress,
        value: data.data.value || 0,
        updateUnixTime: data.data.updateUnixTime || Date.now() / 1000,
        updateHumanTime: data.data.updateHumanTime || new Date().toISOString(),
        priceChange24h: data.data.priceChange24h || 0,
      };
    }
    return null;
  } catch (error) {
    console.error('Failed to fetch current price:', error);
    return null;
  }
}

/**
 * Fetch OHLCV data from Birdeye
 * @param tokenAddress - Token mint address
 * @param timeframe - '1m', '3m', '5m', '15m', '30m', '1H', '2H', '4H', '6H', '8H', '12H', '1D', '3D', '1W', '1M'
 * @param timeFrom - Start timestamp (unix seconds)
 * @param timeTo - End timestamp (unix seconds)
 */
export async function fetchOHLCVData(
  tokenAddress: string,
  timeframe: string = '1m',
  timeFrom?: number,
  timeTo?: number
): Promise<BirdeyeOHLCV[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('No Birdeye API key configured');
    return [];
  }
  const useProxy = true;

  try {
    // Default to last 24 hours if not specified
    const now = Math.floor(Date.now() / 1000);
    const from = timeFrom || now - 24 * 60 * 60;
    const to = timeTo || now;

    const url = useProxy
      ? `${API_URL}/api/birdeye/ohlcv?address=${tokenAddress}&type=${timeframe}&time_from=${from}&time_to=${to}`
      : `${BIRDEYE_API_BASE}/defi/ohlcv?address=${tokenAddress}&type=${timeframe}&time_from=${from}&time_to=${to}`;

    const headers: HeadersInit = {
      'Accept': 'application/json',
    };

    if (!useProxy) {
      headers['X-API-KEY'] = getApiKey();
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Birdeye API error: ${response.status}`);
    }

    const data = await response.json();
    if (data.success && data.data?.items) {
      return data.data.items.map((item: any) => ({
        unixTime: item.unixTime,
        open: item.o || 0,
        high: item.h || 0,
        low: item.l || 0,
        close: item.c || 0,
        volume: item.v || 0,
        type: timeframe,
      }));
    }
    return [];
  } catch (error) {
    console.error('Failed to fetch OHLCV data:', error);
    return [];
  }
}

/**
 * Fetch recent trades from Birdeye
 */
export async function fetchRecentTrades(
  tokenAddress: string,
  limit: number = 50
): Promise<BirdeyeTradeData[]> {
  /*
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('No Birdeye API key configured');
    return [];
  }
  */
  const useProxy = true;

  try {
    const url = useProxy
      ? `${API_URL}/api/birdeye/txs/token?address=${tokenAddress}&limit=${limit}&tx_type=swap`
      : `${BIRDEYE_API_BASE}/defi/txs/token?address=${tokenAddress}&limit=${limit}&tx_type=swap`;

    const headers: HeadersInit = {
      'Accept': 'application/json',
    };

    if (!useProxy) {
      headers['X-API-KEY'] = getApiKey();
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Birdeye API error: ${response.status}`);
    }

    const data = await response.json();
    if (data.success && data.data?.items) {
      return data.data.items.map((item: any) => ({
        address: tokenAddress,
        txHash: item.txHash || '',
        blockUnixTime: item.blockUnixTime || 0,
        source: item.source || '',
        side: item.side || 'buy',
        price: item.price || 0,
        priceUsd: item.priceUsd || 0,
        volume: item.volume || 0,
        volumeUsd: item.volumeUsd || 0,
        owner: item.owner || '',
      }));
    }
    return [];
  } catch (error) {
    console.error('Failed to fetch recent trades:', error);
    return [];
  }
}

/**
 * Create a real-time WebSocket connection for price and trade updates
 */
export function createBirdeyeWebSocket(tokenAddress: string) {
  const apiKey = getApiKey();

  let ws: WebSocket | null = null;
  let reconnectAttempts = 0;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  let pingInterval: ReturnType<typeof setInterval> | null = null;
  let isActive = true;

  const priceCallbacks: PriceCallback[] = [];
  const tradeCallbacks: TradeCallback[] = [];
  const statusCallbacks: StatusCallback[] = [];

  const MAX_RECONNECT_ATTEMPTS = 10;
  const BASE_RECONNECT_DELAY = 1000;

  const notifyStatus = (status: 'connecting' | 'connected' | 'disconnected' | 'error') => {
    statusCallbacks.forEach(cb => cb(status));
  };

  const notifyPrice = (data: BirdeyePriceData) => {
    priceCallbacks.forEach(cb => cb(data));
  };

  const notifyTrade = (data: BirdeyeTradeData) => {
    tradeCallbacks.forEach(cb => cb(data));
  };

  const connect = () => {
    if (!isActive) return;

    // If no API key or in browser environment where we can't set headers/origin easily, 
    // fall back to polling immediately to act as a "proxy-only" client.
    if (!apiKey || true) { // FORCE POLLING TO AVOID BROWSER WS ERRORS
      // console.warn('Using REST polling fallback for Birdeye data');
      startPollingFallback();
      return;
    }

    notifyStatus('connecting');

    try {
      // Connect to Birdeye WebSocket (note: browser WebSocket can't set custom headers)
      ws = new WebSocket(`${BIRDEYE_WS_URL}?x-api-key=${apiKey}`);

      ws.onopen = () => {
        console.log('[Birdeye WS] Connected to:', tokenAddress);
        reconnectAttempts = 0;
        notifyStatus('connected');

        // Subscribe to price updates - using official format from docs
        const priceSubscription = {
          type: 'SUBSCRIBE_PRICE',
          data: {
            chartType: '1m',  // 1 minute candles
            currency: 'pair', // Get price for the pair
            address: tokenAddress,
          },
        };
        console.log('[Birdeye WS] Sending price subscription:', priceSubscription);
        ws?.send(JSON.stringify(priceSubscription));

        // Subscribe to transaction updates
        const txSubscription = {
          type: 'SUBSCRIBE_TXS',
          data: {
            address: tokenAddress,
          },
        };
        console.log('[Birdeye WS] Sending tx subscription:', txSubscription);
        ws?.send(JSON.stringify(txSubscription));

        // Start ping interval to keep connection alive
        pingInterval = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'PING' }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('[Birdeye WS] Received message type:', message.type, message.data ? 'with data' : 'no data');

          if (message.type === 'PRICE_DATA') {
            const priceData = message.data;
            // Try multiple fields for the price value (Birdeye format varies)
            const price = priceData.value || priceData.c || priceData.close || priceData.price || priceData.o || 0;
            console.log('[Birdeye WS] Price update:', price, 'raw data:', priceData);

            if (price > 0) {
              notifyPrice({
                address: tokenAddress,
                value: price,
                updateUnixTime: priceData.unixTime || priceData.unixtime || Date.now() / 1000,
                updateHumanTime: new Date().toISOString(),
                priceChange24h: priceData.priceChange24h || priceData.change24h || 0,
              });
            }
          } else if (message.type === 'TXS_DATA') {
            const txData = message.data;
            console.log('[Birdeye WS] Transaction update:', txData?.length || 0, 'transactions');
            if (txData && Array.isArray(txData)) {
              txData.forEach((tx: any) => {
                notifyTrade({
                  address: tokenAddress,
                  txHash: tx.txHash || '',
                  blockUnixTime: tx.blockUnixTime || 0,
                  source: tx.source || '',
                  side: tx.side || 'buy',
                  price: tx.price || 0,
                  priceUsd: tx.priceUsd || 0,
                  volume: tx.volume || 0,
                  volumeUsd: tx.volumeUsd || 0,
                  owner: tx.owner || '',
                });
              });
            }
          } else if (message.type === 'PONG' || message.type === 'pong') {
            // Heartbeat response - connection is alive
            console.log('[Birdeye WS] Heartbeat OK');
          } else if (message.type === 'WELCOME') {
            // Connection established - server acknowledged
            console.log('[Birdeye WS] Server welcomed connection');
          } else if (message.type === 'ERROR' || message.type === 'error') {
            const errorMsg = message.data || message.message || 'Unknown error';
            console.error('[Birdeye WS] Server error:', errorMsg);

            // If origin/api-key error, browser WebSocket can't set required headers
            // Fall back to REST polling instead
            if (errorMsg.includes('origin') || errorMsg.includes('api-key')) {
              console.log('[Birdeye WS] Browser cannot set required headers, falling back to REST polling');
              if (ws) {
                ws.close();
                ws = null;
              }
              startPollingFallback();
            }
          } else {
            // Log unknown message types for debugging
            console.log('[Birdeye WS] Unknown message type:', message.type);
          }
        } catch (e) {
          console.warn('[Birdeye WS] Parse error:', e);
        }
      };

      ws.onerror = (error) => {
        console.error('[Birdeye WS] Error:', error);
        notifyStatus('error');
      };

      ws.onclose = () => {
        console.log('[Birdeye WS] Closed');
        notifyStatus('disconnected');

        if (pingInterval) {
          clearInterval(pingInterval);
          pingInterval = null;
        }

        // Attempt reconnection with exponential backoff
        if (isActive && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          const delay = BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts);
          reconnectAttempts++;
          console.log(`[Birdeye WS] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
          reconnectTimeout = setTimeout(connect, delay);
        } else if (isActive) {
          console.warn('[Birdeye WS] Max reconnect attempts reached, falling back to polling');
          startPollingFallback();
        }
      };
    } catch (error) {
      console.error('[Birdeye WS] Failed to create connection:', error);
      startPollingFallback();
    }
  };

  // Polling fallback when WebSocket is unavailable
  let pollingInterval: ReturnType<typeof setInterval> | null = null;

  const startPollingFallback = () => {
    if (pollingInterval || !isActive) return;

    console.log('[Birdeye] Starting REST polling fallback for:', tokenAddress);
    notifyStatus('connected');

    const poll = async () => {
      if (!isActive) return;

      try {
        // Fetch current price
        const priceData = await fetchCurrentPrice(tokenAddress);
        if (priceData && priceData.value > 0) {
          console.log('[Birdeye] Price update:', priceData.value);
          notifyPrice(priceData);
        }

        // Fetch recent trades
        const trades = await fetchRecentTrades(tokenAddress, 10);
        trades.forEach(trade => notifyTrade(trade));
      } catch (error) {
        console.warn('[Birdeye] Polling error:', error);
      }
    };

    // Poll immediately, then every 1 second for near real-time updates
    poll();
    pollingInterval = setInterval(poll, 1000);
  };

  const disconnect = () => {
    isActive = false;

    if (ws) {
      ws.close();
      ws = null;
    }

    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }

    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }

    notifyStatus('disconnected');
  };

  // Start connection
  setTimeout(connect, 0);

  return {
    onPrice: (callback: PriceCallback) => {
      priceCallbacks.push(callback);
    },
    onTrade: (callback: TradeCallback) => {
      tradeCallbacks.push(callback);
    },
    onStatus: (callback: StatusCallback) => {
      statusCallbacks.push(callback);
    },
    disconnect,
    reconnect: () => {
      if (ws) ws.close();
      reconnectAttempts = 0;
      isActive = true;
      connect();
    },
  };
}

/**
 * Convert Birdeye timeframe to milliseconds
 */
export function getTimeframeMs(timeframe: string): number {
  const match = timeframe.match(/^(\d+)([mHDWM])$/i);
  if (!match) return 60000; // Default 1 minute

  const value = parseInt(match[1]);
  const unit = match[2].toUpperCase();

  switch (unit) {
    case 'M': return value * 60 * 1000; // Minutes (lowercase in Birdeye)
    case 'H': return value * 60 * 60 * 1000;
    case 'D': return value * 24 * 60 * 60 * 1000;
    case 'W': return value * 7 * 24 * 60 * 60 * 1000;
    default: return 60000;
  }
}

/**
 * Format Birdeye OHLCV to chart format
 */
export function formatOHLCVForChart(data: BirdeyeOHLCV[]): {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}[] {
  return data.map(candle => ({
    time: new Date(candle.unixTime * 1000).toISOString(),
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
  }));
}
