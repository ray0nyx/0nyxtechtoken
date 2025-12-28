/**
 * Trading WebSocket Client
 * 
 * Real-time WebSocket connection to backend for:
 * - Market cap OHLCV candle streaming
 * - Trade/swap event notifications
 * - Token metadata updates
 * 
 * Features:
 * - Auto-reconnection with exponential backoff
 * - Message queueing during reconnection
 * - Heartbeat/ping-pong
 * - Subscription management
 */

import { useTradingStore, type OHLCVCandle, type Trade, type TokenInfo } from '@/stores/useTradingStore';

// ============ Types ============

export type WSMessageType = 
  | 'subscribe'
  | 'unsubscribe' 
  | 'get_candles'
  | 'get_token_info'
  | 'ping'
  | 'candle'
  | 'trade'
  | 'token_info'
  | 'candles'
  | 'quote'
  | 'status'
  | 'error'
  | 'pong';

export interface WSMessage {
  type: WSMessageType;
  data: Record<string, any>;
  timestamp: number;
}

export interface CandleMessage {
  type: 'candle';
  data: {
    token: string;
    timeframe: string;
    candle: {
      time: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
      trades?: number;
      is_closed: boolean;
    };
  };
}

export interface TradeMessage {
  type: 'trade';
  data: {
    token: string;
    signature: string;
    side: 'buy' | 'sell';
    amount_token: number;
    amount_sol: number;
    price_usd: number;
    market_cap_usd: number;
    trader: string;
    source: string;
    timestamp: number;
  };
}

export interface CandlesMessage {
  type: 'candles';
  data: {
    token: string;
    timeframe: string;
    candles: Array<{
      time: number;
      time_ms?: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
      trades?: number;
      is_closed?: boolean;
    }>;
  };
}

export interface TokenInfoMessage {
  type: 'token_info';
  data: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    supply: number;
    price_usd: number;
    market_cap: number;
    logo_url?: string;
  };
}

type MessageCallback = (message: WSMessage) => void;
type StatusCallback = (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;

// ============ Configuration ============

const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8001/ws/trading';
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;
const PING_INTERVAL = 30000;
const PONG_TIMEOUT = 5000;

// ============ WebSocket Client Class ============

class TradingWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private pongTimeout: ReturnType<typeof setTimeout> | null = null;
  private isActive = false;
  private messageQueue: WSMessage[] = [];
  
  private subscriptions: Map<string, Set<string>> = new Map(); // token -> timeframes
  private messageCallbacks: MessageCallback[] = [];
  private statusCallbacks: StatusCallback[] = [];
  
  constructor() {
    // Subscribe to store changes to auto-sync subscriptions
    useTradingStore.subscribe(
      (state) => state.tokenAddress,
      (tokenAddress, previousTokenAddress) => {
        if (previousTokenAddress && previousTokenAddress !== tokenAddress) {
          this.unsubscribe(previousTokenAddress);
        }
      }
    );
  }
  
  // ============ Connection Management ============
  
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[TradingWS] Already connected');
      return;
    }
    
    this.isActive = true;
    this.notifyStatus('connecting');
    useTradingStore.getState().setWsStatus('connecting');
    
    try {
      console.log('[TradingWS] Connecting to', WS_BASE_URL);
      this.ws = new WebSocket(WS_BASE_URL);
      
      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      
    } catch (error) {
      console.error('[TradingWS] Connection error:', error);
      this.scheduleReconnect();
    }
  }
  
  disconnect(): void {
    this.isActive = false;
    this.cleanup();
    this.stopPollingFallback();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.notifyStatus('disconnected');
    useTradingStore.getState().setWsStatus('disconnected');
    console.log('[TradingWS] Disconnected');
  }
  
  private cleanup(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }
  
  // ============ Event Handlers ============
  
  private handleOpen(): void {
    console.log('[TradingWS] Connected');
    this.reconnectAttempts = 0;
    
    // Stop polling fallback if active
    this.stopPollingFallback();
    
    this.notifyStatus('connected');
    useTradingStore.getState().setWsStatus('connected');
    
    // Start ping interval
    this.startPing();
    
    // Resubscribe to all tokens
    this.resubscribeAll();
    
    // Send queued messages
    this.flushMessageQueue();
  }
  
  private handleMessage(event: MessageEvent): void {
    try {
      const message: WSMessage = JSON.parse(event.data);
      useTradingStore.getState().updateWsHeartbeat();
      
      // Handle specific message types
      switch (message.type) {
        case 'candle':
          this.handleCandleMessage(message as CandleMessage);
          break;
          
        case 'trade':
          this.handleTradeMessage(message as TradeMessage);
          break;
          
        case 'candles':
          this.handleCandlesMessage(message as CandlesMessage);
          break;
          
        case 'token_info':
          this.handleTokenInfoMessage(message as TokenInfoMessage);
          break;
          
        case 'indicator':
          this.handleIndicatorMessage(message);
          break;
          
        case 'graduation':
          this.handleGraduationMessage(message);
          break;
          
        case 'supply_change':
          this.handleSupplyChangeMessage(message);
          break;
          
        case 'pong':
          this.handlePong();
          break;
          
        case 'status':
          console.log('[TradingWS] Status:', message.data);
          break;
          
        case 'error':
          console.error('[TradingWS] Error:', message.data);
          break;
      }
      
      // Notify all message callbacks
      this.messageCallbacks.forEach(cb => cb(message));
      
    } catch (error) {
      console.error('[TradingWS] Failed to parse message:', error);
    }
  }
  
  private handleIndicatorMessage(message: WSMessage): void {
    const { token, timeframe, type, data } = message.data;
    const store = useTradingStore.getState();
    
    // Only update if this is the current token
    if (store.tokenAddress !== token) return;
    
    // Store indicator values (could be used for chart overlays)
    // For now, just log - indicator display would be implemented in chart component
    console.log(`[TradingWS] Indicator update: ${type} for ${token}:${timeframe}`, data);
  }
  
  private handleGraduationMessage(message: WSMessage): void {
    const { token, raydium_pool } = message.data;
    const store = useTradingStore.getState();
    
    // Only update if this is the current token
    if (store.tokenAddress !== token) return;
    
    // Update token info to reflect graduation
    const tokenInfo = store.tokenInfo;
    if (tokenInfo) {
      // Mark as graduated (could add a field to TokenInfo)
      console.log(`[TradingWS] Token graduated: ${token} -> Raydium pool: ${raydium_pool}`);
      
      // Trigger UI update (could show a notification or badge)
      // This would be handled by the component using the store
    }
  }
  
  private handleSupplyChangeMessage(message: WSMessage): void {
    const { token, old_supply, new_supply, new_market_cap } = message.data;
    const store = useTradingStore.getState();
    
    // Only update if this is the current token
    if (store.tokenAddress !== token) return;
    
    // Update market cap immediately
    store.updatePrice(store.currentPrice, new_market_cap);
    
    console.log(`[TradingWS] Supply change: ${token}, ${old_supply} -> ${new_supply}, MC: ${new_market_cap}`);
  }
  
  private handleError(event: Event): void {
    console.error('[TradingWS] WebSocket error:', event);
    this.notifyStatus('error');
    useTradingStore.getState().setWsStatus('error');
  }
  
  private handleClose(): void {
    console.log('[TradingWS] Connection closed');
    this.cleanup();
    
    this.notifyStatus('disconnected');
    useTradingStore.getState().setWsStatus('disconnected');
    
    if (this.isActive) {
      this.scheduleReconnect();
    }
  }
  
  // ============ Message Handlers ============
  
  private handleCandleMessage(message: CandleMessage): void {
    const { token, timeframe, candle } = message.data;
    const store = useTradingStore.getState();
    
    // Only update if this is the current token and timeframe
    if (store.tokenAddress !== token) return;
    if (store.selectedTimeframe !== timeframe) return;
    
    const ohlcvCandle: OHLCVCandle = {
      time: candle.time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      trades: candle.trades,
      isClosed: candle.is_closed,
    };
    
    // Update candle (incremental update - no full refetch)
    store.updateCandle(ohlcvCandle);
    
    // Update price and market cap immediately from candle close
    // This ensures UI reflects backend changes instantly
    if (candle.is_closed) {
      // Closed candle: update market cap from close value
      store.updatePrice(candle.close, candle.close); // In market-cap mode, close IS market cap
    } else {
      // Open candle: update with current close
      store.updatePrice(candle.close, candle.close);
    }
  }
  
  private handleTradeMessage(message: TradeMessage): void {
    const { data } = message;
    const store = useTradingStore.getState();
    
    // Only add if this is the current token
    if (store.tokenAddress !== data.token) return;
    
    const trade: Trade = {
      signature: data.signature,
      timestamp: data.timestamp,
      side: data.side,
      amountToken: data.amount_token,
      amountSol: data.amount_sol,
      priceUsd: data.price_usd,
      marketCapUsd: data.market_cap_usd,
      trader: data.trader,
      source: data.source as Trade['source'],
    };
    
    store.addTrade(trade);
    store.updatePrice(data.price_usd, data.market_cap_usd);
  }
  
  private handleCandlesMessage(message: CandlesMessage): void {
    const { token, timeframe, candles } = message.data;
    const store = useTradingStore.getState();
    
    // Only update if this is the current token and timeframe
    if (store.tokenAddress !== token) return;
    if (store.selectedTimeframe !== timeframe) return;
    
    const ohlcvCandles: OHLCVCandle[] = candles.map(c => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      trades: c.trades,
      isClosed: c.is_closed ?? true,
    }));
    
    store.setCandles(ohlcvCandles);
  }
  
  private handleTokenInfoMessage(message: TokenInfoMessage): void {
    const { data } = message;
    const store = useTradingStore.getState();
    
    if (store.tokenAddress !== data.address) return;
    
    const tokenInfo: TokenInfo = {
      address: data.address,
      symbol: data.symbol,
      name: data.name,
      decimals: data.decimals,
      supply: data.supply,
      price: data.price_usd,
      priceChange24h: 0,
      marketCap: data.market_cap,
      liquidity: 0,
      volume24h: 0,
      logoUrl: data.logo_url,
    };
    
    store.setTokenInfo(tokenInfo);
  }
  
  // ============ Subscription Management ============
  
  subscribe(tokenAddress: string, timeframes: string[] = ['1m']): void {
    // Track subscription
    if (!this.subscriptions.has(tokenAddress)) {
      this.subscriptions.set(tokenAddress, new Set());
    }
    timeframes.forEach(tf => this.subscriptions.get(tokenAddress)!.add(tf));
    
    // Send subscription message
    this.send({
      type: 'subscribe',
      data: {
        token: tokenAddress,
        timeframes,
      },
      timestamp: Date.now(),
    });
    
    // Also request initial candles
    this.requestCandles(tokenAddress, timeframes[0], 200);
    
    // Update store
    useTradingStore.getState().setToken(tokenAddress);
    
    console.log(`[TradingWS] Subscribed to ${tokenAddress} with timeframes ${timeframes}`);
  }
  
  unsubscribe(tokenAddress: string): void {
    this.subscriptions.delete(tokenAddress);
    
    this.send({
      type: 'unsubscribe',
      data: { token: tokenAddress },
      timestamp: Date.now(),
    });
    
    console.log(`[TradingWS] Unsubscribed from ${tokenAddress}`);
  }
  
  private resubscribeAll(): void {
    this.subscriptions.forEach((timeframes, tokenAddress) => {
      this.send({
        type: 'subscribe',
        data: {
          token: tokenAddress,
          timeframes: Array.from(timeframes),
        },
        timestamp: Date.now(),
      });
    });
  }
  
  // ============ Data Requests ============
  
  requestCandles(tokenAddress: string, timeframe: string, limit: number = 100): void {
    this.send({
      type: 'get_candles',
      data: {
        token: tokenAddress,
        timeframe,
        limit,
      },
      timestamp: Date.now(),
    });
  }
  
  requestTokenInfo(tokenAddress: string): void {
    this.send({
      type: 'get_token_info',
      data: { token: tokenAddress },
      timestamp: Date.now(),
    });
  }
  
  // ============ Message Sending ============
  
  private send(message: WSMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue message for later
      this.messageQueue.push(message);
    }
  }
  
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift()!;
      this.ws.send(JSON.stringify(message));
    }
  }
  
  // ============ Ping/Pong ============
  
  private startPing(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({
          type: 'ping',
          data: {},
          timestamp: Date.now(),
        });
        
        // Set timeout for pong response
        this.pongTimeout = setTimeout(() => {
          console.warn('[TradingWS] Pong timeout, reconnecting...');
          this.ws?.close();
        }, PONG_TIMEOUT);
      }
    }, PING_INTERVAL);
  }
  
  private handlePong(): void {
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }
  
  // ============ Reconnection ============
  
  private scheduleReconnect(): void {
    if (!this.isActive) return;
    
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('[TradingWS] Max reconnection attempts reached, falling back to HTTP polling');
      this.notifyStatus('error');
      // Start HTTP polling fallback
      this.startPollingFallback();
      return;
    }
    
    const delay = Math.min(
      BASE_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts),
      MAX_RECONNECT_DELAY
    );
    
    this.reconnectAttempts++;
    console.log(`[TradingWS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }
  
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private isPollingFallback = false;
  
  private startPollingFallback(): void {
    if (this.isPollingFallback) return;
    
    this.isPollingFallback = true;
    console.log('[TradingWS] Starting HTTP polling fallback');
    
    // Poll for updates every 2 seconds
    this.pollingInterval = setInterval(async () => {
      const store = useTradingStore.getState();
      const tokenAddress = store.tokenAddress;
      const timeframe = store.selectedTimeframe;
      
      if (!tokenAddress) return;
      
      try {
        // Fetch latest candles
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001';
        const response = await fetch(
          `${apiUrl}/api/trading/candles?token=${tokenAddress}&timeframe=${timeframe}&limit=1`
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.candles && data.candles.length > 0) {
            const latestCandle = data.candles[data.candles.length - 1];
            store.updateCandle({
              time: latestCandle.time,
              open: latestCandle.open,
              high: latestCandle.high,
              low: latestCandle.low,
              close: latestCandle.close,
              volume: latestCandle.volume,
              isClosed: latestCandle.is_closed,
            });
          }
        }
      } catch (error) {
        console.warn('[TradingWS] Polling error:', error);
      }
    }, 2000);
  }
  
  private stopPollingFallback(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPollingFallback = false;
  }
  
  // ============ Callbacks ============
  
  onMessage(callback: MessageCallback): () => void {
    this.messageCallbacks.push(callback);
    return () => {
      const index = this.messageCallbacks.indexOf(callback);
      if (index > -1) this.messageCallbacks.splice(index, 1);
    };
  }
  
  onStatus(callback: StatusCallback): () => void {
    this.statusCallbacks.push(callback);
    return () => {
      const index = this.statusCallbacks.indexOf(callback);
      if (index > -1) this.statusCallbacks.splice(index, 1);
    };
  }
  
  private notifyStatus(status: 'connecting' | 'connected' | 'disconnected' | 'error'): void {
    this.statusCallbacks.forEach(cb => cb(status));
  }
  
  // ============ Status ============
  
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
  
  getStatus(): 'connecting' | 'connected' | 'disconnected' | 'error' {
    if (!this.ws) return 'disconnected';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      default:
        return 'disconnected';
    }
  }
}

// ============ Singleton Instance ============

let tradingWsInstance: TradingWebSocket | null = null;

export function getTradingWebSocket(): TradingWebSocket {
  if (!tradingWsInstance) {
    tradingWsInstance = new TradingWebSocket();
  }
  return tradingWsInstance;
}

export function connectTradingWebSocket(): void {
  getTradingWebSocket().connect();
}

export function disconnectTradingWebSocket(): void {
  getTradingWebSocket().disconnect();
}

// ============ React Hook ============

import { useEffect, useCallback } from 'react';

export function useTradingWebSocket(tokenAddress?: string, timeframes: string[] = ['1m']) {
  const ws = getTradingWebSocket();
  
  // Connect on mount
  useEffect(() => {
    if (!ws.isConnected()) {
      ws.connect();
    }
    
    return () => {
      // Don't disconnect on unmount - keep connection alive
    };
  }, []);
  
  // Subscribe to token when provided
  useEffect(() => {
    if (tokenAddress) {
      ws.subscribe(tokenAddress, timeframes);
      
      return () => {
        // Don't unsubscribe immediately - let the store handle it
      };
    }
  }, [tokenAddress, timeframes.join(',')]);
  
  const subscribe = useCallback((address: string, tfs?: string[]) => {
    ws.subscribe(address, tfs || timeframes);
  }, [timeframes]);
  
  const unsubscribe = useCallback((address: string) => {
    ws.unsubscribe(address);
  }, []);
  
  const requestCandles = useCallback((address: string, tf: string, limit?: number) => {
    ws.requestCandles(address, tf, limit);
  }, []);
  
  return {
    isConnected: ws.isConnected(),
    subscribe,
    unsubscribe,
    requestCandles,
    ws,
  };
}

export default TradingWebSocket;





