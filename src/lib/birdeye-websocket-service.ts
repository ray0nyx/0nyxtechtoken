/**
 * Birdeye WebSocket Service
 * Professional-grade real-time data streaming for Solana tokens
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

const BIRDEYE_WS_URL = 'wss://public-api.birdeye.so/socket/solana';
const BIRDEYE_API_BASE = 'https://public-api.birdeye.so';
const API_URL = import.meta.env.VITE_WAGYU_API_URL || 'http://localhost:8001';

function getApiKey(): string {
  return import.meta.env.VITE_BIRDEYE_API_KEY || '';
}

type PriceCallback = (data: BirdeyePriceData) => void;
type TradeCallback = (data: BirdeyeTradeData) => void;
type OHLCVCallback = (data: BirdeyeOHLCV) => void;
type StatusCallback = (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;

// Global queue for Birdeye requests to avoid ERR_INSUFFICIENT_RESOURCES
const metaQueue: { address: string; resolve: (val: any) => void }[] = [];
let activeRequests = 0;
const MAX_CONCURRENT_META = 4;

function processMetaQueue() {
  if (activeRequests >= MAX_CONCURRENT_META || metaQueue.length === 0) return;

  const item = metaQueue.shift();
  if (!item) return;

  const { address, resolve } = item;
  activeRequests++;

  const runFetch = async () => {
    try {
      const url = `${API_URL}/api/birdeye/token_overview?address=${address}`;
      const response = await fetch(url, { headers: { 'Accept': 'application/json' } });

      if (!response.ok) throw new Error(`Birdeye API error: ${response.status}`);

      const data = await response.json();
      if (data.success && data.data) {
        resolve({
          address,
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
        });
      } else {
        resolve(null);
      }
    } catch (error) {
      console.error(`Failed to fetch metadata for ${address}:`, error);
      resolve(null);
    } finally {
      activeRequests--;
      processMetaQueue();
    }
  };

  runFetch();
}

/**
 * Fetch token overview from Birdeye
 */
export async function fetchTokenOverview(tokenAddress: string): Promise<BirdeyeTokenOverview | null> {
  return new Promise((resolve) => {
    metaQueue.push({ address: tokenAddress, resolve });
    processMetaQueue();
  });
}

/**
 * Fetch current price from Birdeye
 */
export async function fetchCurrentPrice(tokenAddress: string): Promise<BirdeyePriceData | null> {
  try {
    const url = `${API_URL}/api/birdeye/price?address=${tokenAddress}`;
    const response = await fetch(url, { headers: { 'Accept': 'application/json' } });

    if (!response.ok) throw new Error(`Birdeye API error: ${response.status}`);

    const data = await response.json();
    if (data.success && data.data) {
      return {
        address: tokenAddress,
        value: data.data.value || 0,
        updateUnixTime: Math.floor(Date.now() / 1000),
        updateHumanTime: new Date().toISOString(),
        priceChange24h: data.data.priceChange24hPercent || 0,
      };
    }
    return null;
  } catch (error) {
    console.error('Failed to fetch token price:', error);
    return null;
  }
}

/**
 * Fetch OHLCV data from Birdeye
 */
export async function fetchOHLCV(
  tokenAddress: string,
  timeframe: string = '1h',
  limit: number = 100
): Promise<BirdeyeOHLCV[]> {
  try {
    const type = timeframe === '1m' ? '1m' : timeframe === '5m' ? '5m' : timeframe === '15m' ? '15m' : timeframe === '1h' ? '1H' : '1D';
    const url = `${API_URL}/api/birdeye/ohlcv?address=${tokenAddress}&type=${type}&limit=${limit}`;
    const response = await fetch(url, { headers: { 'Accept': 'application/json' } });

    if (!response.ok) throw new Error(`Birdeye API error: ${response.status}`);

    const data = await response.json();
    if (data.success && data.data && data.data.items) {
      return data.data.items.map((item: any) => ({
        unixTime: item.unixTime,
        open: item.o,
        high: item.h,
        low: item.l,
        close: item.c,
        volume: item.v,
        type: timeframe
      }));
    }
    return [];
  } catch (error) {
    console.error('Failed to fetch OHLCV:', error);
    return [];
  }
}

export { fetchOHLCV as fetchOHLCVData };

export class BirdeyeWebSocketService {
  private ws: WebSocket | null = null;
  private subscribers: Map<string, {
    price?: PriceCallback[];
    trades?: TradeCallback[];
    ohlcv?: OHLCVCallback[];
  }> = new Map();
  private statusCallbacks: StatusCallback[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor() { }

  onStatusChange(callback: StatusCallback) {
    this.statusCallbacks.push(callback);
  }

  private updateStatus(status: 'connecting' | 'connected' | 'disconnected' | 'error') {
    this.statusCallbacks.forEach(cb => cb(status));
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.updateStatus('connecting');
    this.ws = new WebSocket(BIRDEYE_WS_URL);

    this.ws.onopen = () => {
      console.log('Birdeye WebSocket connected');
      this.updateStatus('connected');
      this.reconnectAttempts = 0;
      this.resubscribeAll();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (e) {
        console.error('Error parsing Birdeye message:', e);
      }
    };

    this.ws.onclose = () => {
      this.updateStatus('disconnected');
      this.handleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('Birdeye WebSocket error:', error);
      this.updateStatus('error');
    };
  }

  private handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    setTimeout(() => this.connect(), delay);
  }

  private resubscribeAll() {
    this.subscribers.forEach((_, address) => {
      this.send('subscribe', address);
    });
  }

  private send(action: string, address: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action, address }));
    }
  }

  subscribePrice(address: string, callback: PriceCallback) {
    const sub = this.subscribers.get(address) || {};
    sub.price = [...(sub.price || []), callback];
    this.subscribers.set(address, sub);
    this.send('subscribe', address);
    return () => this.unsubscribePrice(address, callback);
  }

  private unsubscribePrice(address: string, callback: PriceCallback) {
    const sub = this.subscribers.get(address);
    if (sub?.price) {
      sub.price = sub.price.filter(cb => cb !== callback);
      if (sub.price.length === 0 && !sub.trades && !sub.ohlcv) {
        this.subscribers.delete(address);
        this.send('unsubscribe', address);
      } else {
        this.subscribers.set(address, sub);
      }
    }
  }

  subscribeTrade(address: string, callback: TradeCallback) {
    const sub = this.subscribers.get(address) || {};
    sub.trades = [...(sub.trades || []), callback];
    this.subscribers.set(address, sub);
    this.send('subscribe', address);
    return () => this.unsubscribeTrade(address, callback);
  }

  private unsubscribeTrade(address: string, callback: TradeCallback) {
    const sub = this.subscribers.get(address);
    if (sub?.trades) {
      sub.trades = sub.trades.filter(cb => cb !== callback);
      if (sub.trades.length === 0 && !sub.price && !sub.ohlcv) {
        this.subscribers.delete(address);
        this.send('unsubscribe', address);
      } else {
        this.subscribers.set(address, sub);
      }
    }
  }

  private handleMessage(data: any) {
    // Basic implementation to avoid errors
    if (data.type === 'price' && data.data) {
      const sub = this.subscribers.get(data.data.address);
      if (sub?.price) {
        sub.price.forEach(cb => cb({
          address: data.data.address,
          value: data.data.value,
          updateUnixTime: data.data.updateUnixTime,
          updateHumanTime: data.data.updateHumanTime,
          priceChange24h: data.data.priceChange24hPercent || 0
        }));
      }
    } else if (data.type === 'trade' && data.data) {
      const sub = this.subscribers.get(data.data.address);
      if (sub?.trades) {
        sub.trades.forEach(cb => cb({
          address: data.data.address,
          txHash: data.data.txHash,
          blockUnixTime: data.data.blockUnixTime,
          source: data.data.source,
          side: data.data.side,
          price: data.data.price,
          priceUsd: data.data.priceUsd,
          volume: data.data.volume,
          volumeUsd: data.data.volumeUsd,
          owner: data.data.owner
        }));
      }
    }
  }
}

export const birdeyeWS = new BirdeyeWebSocketService();

export function createBirdeyeWebSocket(address: string) {
  birdeyeWS.connect();

  const cleanups: (() => void)[] = [];

  return {
    onPrice: (callback: PriceCallback) => {
      cleanups.push(birdeyeWS.subscribePrice(address, callback));
    },
    onTrade: (callback: TradeCallback) => {
      cleanups.push(birdeyeWS.subscribeTrade(address, callback));
    },
    onStatus: (callback: StatusCallback) => {
      birdeyeWS.onStatusChange(callback);
    },
    disconnect: () => {
      cleanups.forEach(cleanup => cleanup());
    }
  };
}

export function formatOHLCVForChart(data: BirdeyeOHLCV[]) {
  return data.map(item => ({
    time: item.unixTime,
    open: item.open,
    high: item.high,
    low: item.low,
    close: item.close,
    volume: item.volume
  }));
}
