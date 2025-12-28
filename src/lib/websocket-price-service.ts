/**
 * WebSocket service for real-time price and trade updates
 * Connects to Birdeye WebSocket for Solana token data
 */

export interface PriceUpdate {
  tokenAddress: string;
  price: number;
  priceUsd: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  timestamp: number;
}

export interface TradeUpdate {
  id: string;
  tokenAddress: string;
  type: 'buy' | 'sell';
  price: number;
  amount: number;
  totalUsd: number;
  maker: string;
  timestamp: number;
  txHash?: string;
}

export interface WebSocketConfig {
  reconnectAttempts?: number;
  reconnectDelay?: number;
  pingInterval?: number;
}

type PriceCallback = (update: PriceUpdate) => void;
type TradeCallback = (trade: TradeUpdate) => void;
type StatusCallback = (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;

const DEFAULT_CONFIG: Required<WebSocketConfig> = {
  reconnectAttempts: 5,
  reconnectDelay: 3000,
  pingInterval: 30000,
};

/**
 * Creates a WebSocket connection for real-time price updates
 */
export function createPriceWebSocket(
  tokenAddress: string,
  config: WebSocketConfig = {}
) {
  const settings = { ...DEFAULT_CONFIG, ...config };

  let ws: WebSocket | null = null;
  let reconnectCount = 0;
  let pingIntervalId: ReturnType<typeof setInterval> | null = null;
  let isActive = true;

  const priceCallbacks: PriceCallback[] = [];
  const tradeCallbacks: TradeCallback[] = [];
  const statusCallbacks: StatusCallback[] = [];

  // Birdeye WebSocket endpoint (requires API key in production)
  // Note: Birdeye requires /solana suffix for Solana chain
  const wsUrl = import.meta.env.VITE_BIRDEYE_WS_URL || 'wss://public-api.birdeye.so/socket/solana';
  const apiKey = import.meta.env.VITE_BIRDEYE_API_KEY || '';

  const notifyStatus = (status: 'connecting' | 'connected' | 'disconnected' | 'error') => {
    statusCallbacks.forEach(cb => cb(status));
  };

  const notifyPrice = (update: PriceUpdate) => {
    priceCallbacks.forEach(cb => cb(update));
  };

  const notifyTrade = (trade: TradeUpdate) => {
    tradeCallbacks.forEach(cb => cb(trade));
  };

  const connect = () => {
    if (!isActive) return;

    try {
      notifyStatus('connecting');

      // If no WebSocket available, fall back to polling immediately
      if (!apiKey) {
        console.warn('[WebSocket] No Birdeye API key, using polling fallback');
        startPollingFallback();
        return;
      }

      const fullUrl = `${wsUrl}?x-api-key=${apiKey}`;
      console.log('[WebSocket] Attempting connection to Birdeye...');

      ws = new WebSocket(fullUrl);

      // Set a connection timeout
      const connectionTimeout = setTimeout(() => {
        if (ws && ws.readyState !== WebSocket.OPEN) {
          console.warn('[WebSocket] Connection timeout, falling back to polling');
          ws.close();
          startPollingFallback();
        }
      }, 5000); // 5 second timeout

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('[WebSocket] Connected to Birdeye');
        reconnectCount = 0;
        notifyStatus('connected');

        // Subscribe to token price updates
        ws?.send(JSON.stringify({
          type: 'subscribe',
          data: {
            type: 'PRICE',
            address: tokenAddress,
            currency: 'usd',
          },
        }));

        // Subscribe to trades
        ws?.send(JSON.stringify({
          type: 'subscribe',
          data: {
            type: 'TRADE',
            address: tokenAddress,
          },
        }));

        // Start ping interval
        pingIntervalId = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, settings.pingInterval);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'PRICE_UPDATE') {
            notifyPrice({
              tokenAddress: data.address || tokenAddress,
              price: parseFloat(data.price) || 0,
              priceUsd: parseFloat(data.priceUsd || data.price) || 0,
              change24h: parseFloat(data.priceChange24h) || 0,
              volume24h: parseFloat(data.volume24h) || 0,
              marketCap: parseFloat(data.mc || data.marketCap) || 0,
              timestamp: data.timestamp || Date.now(),
            });
          } else if (data.type === 'TRADE') {
            notifyTrade({
              id: data.txHash || `trade_${Date.now()}`,
              tokenAddress: data.address || tokenAddress,
              type: data.side?.toLowerCase() === 'sell' ? 'sell' : 'buy',
              price: parseFloat(data.price) || 0,
              amount: parseFloat(data.amount) || 0,
              totalUsd: parseFloat(data.volumeUsd) || 0,
              maker: data.maker || data.owner || 'Unknown',
              timestamp: data.timestamp || Date.now(),
              txHash: data.txHash,
            });
          }
        } catch (e) {
          console.warn('[WebSocket] Failed to parse message:', e);
        }
      };

      ws.onerror = (error) => {
        clearTimeout(connectionTimeout);
        console.warn('[WebSocket] Connection error, falling back to polling:', error);
        notifyStatus('error');
        // Immediately fall back to polling on error
        if (ws) {
          ws.close();
          ws = null;
        }
        startPollingFallback();
      };

      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        console.log('[WebSocket] Connection closed', event.code, event.reason);
        notifyStatus('disconnected');

        if (pingIntervalId) {
          clearInterval(pingIntervalId);
          pingIntervalId = null;
        }

        // If closed unexpectedly (not a clean close), fall back immediately
        if (event.code !== 1000 && isActive) {
          console.warn('[WebSocket] Unexpected close, falling back to polling');
          startPollingFallback();
          return;
        }

        // Attempt reconnection only if it was a clean close
        if (isActive && reconnectCount < settings.reconnectAttempts && event.code === 1000) {
          reconnectCount++;
          console.log(`[WebSocket] Reconnecting in ${settings.reconnectDelay}ms (attempt ${reconnectCount}/${settings.reconnectAttempts})`);
          setTimeout(connect, settings.reconnectDelay);
        } else if (isActive) {
          console.warn('[WebSocket] Max reconnect attempts reached, using polling fallback');
          startPollingFallback();
        }
      };
    } catch (error) {
      console.error('[WebSocket] Failed to create WebSocket:', error);
      startPollingFallback();
    }
  };

  // Polling fallback using DexScreener and Jupiter APIs directly
  let pollingIntervalId: ReturnType<typeof setInterval> | null = null;
  let isPolling = false;

  const startPollingFallback = () => {
    if (isPolling || !isActive) return;

    // Close WebSocket if it exists
    if (ws) {
      ws.close();
      ws = null;
    }

    isPolling = true;
    console.log('[RealTime] Starting polling fallback for token:', tokenAddress);
    notifyStatus('connected');

    const poll = async () => {
      if (!isActive) return;

      try {
        // Try DexScreener first (most reliable for meme coins)
        const dexResponse = await fetch(
          `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`,
          {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(5000) // 5 second timeout
          }
        );

        if (dexResponse.ok) {
          const dexData = await dexResponse.json();
          const pair = dexData.pairs?.[0];

          if (pair) {
            const priceUpdate = {
              tokenAddress,
              price: parseFloat(pair.priceNative) || 0,
              priceUsd: parseFloat(pair.priceUsd) || 0,
              change24h: parseFloat(pair.priceChange?.h24) || 0,
              volume24h: parseFloat(pair.volume?.h24) || 0,
              marketCap: parseFloat(pair.marketCap || pair.fdv) || 0,
              timestamp: Date.now(),
            };
            notifyPrice(priceUpdate);
            return;
          }
        }

        // Fallback to Jupiter price API
        const jupResponse = await fetch(
          `https://price.jup.ag/v4/price?ids=${tokenAddress}`,
          {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(5000) // 5 second timeout
          }
        );

        if (jupResponse.ok) {
          const jupData = await jupResponse.json();
          const priceData = jupData.data?.[tokenAddress];

          if (priceData) {
            notifyPrice({
              tokenAddress,
              price: priceData.price || 0,
              priceUsd: priceData.price || 0,
              change24h: 0,
              volume24h: 0,
              marketCap: 0,
              timestamp: Date.now(),
            });
          }
        }
      } catch (error) {
        console.warn('Polling error:', error);
      }
    };

    // Poll immediately, then every 3 seconds
    poll();
    pollingIntervalId = setInterval(poll, 3000);
  };

  const disconnect = () => {
    isActive = false;
    isPolling = false;

    if (ws) {
      ws.close();
      ws = null;
    }

    if (pingIntervalId) {
      clearInterval(pingIntervalId);
      pingIntervalId = null;
    }

    if (pollingIntervalId) {
      clearInterval(pollingIntervalId);
      pollingIntervalId = null;
    }

    notifyStatus('disconnected');
  };

  // Don't start connection immediately - wait for callbacks to be registered
  // Use setTimeout to defer the connection start
  setTimeout(() => {
    if (isActive) {
      connect();
    }
  }, 0);

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
      if (ws) {
        ws.close();
      }
      reconnectCount = 0;
      isActive = true;
      connect();
    },
  };
}

/**
 * Subscribe to multiple tokens at once
 */
export function createMultiTokenWebSocket(
  tokenAddresses: string[],
  config: WebSocketConfig = {}
) {
  const connections = tokenAddresses.map(address =>
    createPriceWebSocket(address, config)
  );

  return {
    onPrice: (callback: PriceCallback) => {
      connections.forEach(conn => conn.onPrice(callback));
    },
    onTrade: (callback: TradeCallback) => {
      connections.forEach(conn => conn.onTrade(callback));
    },
    onStatus: (callback: StatusCallback) => {
      connections.forEach(conn => conn.onStatus(callback));
    },
    disconnect: () => {
      connections.forEach(conn => conn.disconnect());
    },
  };
}
