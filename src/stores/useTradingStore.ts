/**
 * Trading Store - Zustand state management for real-time trading
 * 
 * Manages:
 * - Current token selection and metadata
 * - Real-time price and market cap updates
 * - OHLCV candle data
 * - Recent trades/swaps
 * - Jupiter quote caching
 * - WebSocket connection status
 * - Pending orders and positions
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// ============ Types ============

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  supply: number;
  logoUrl?: string;
  price: number;
  priceChange24h: number;
  marketCap: number;
  liquidity: number;
  volume24h: number;
  holders?: number;
  createdAt?: string;
}

export interface OHLCVCandle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trades?: number;
  isClosed?: boolean;
}

export interface Trade {
  signature: string;
  timestamp: number;
  side: 'buy' | 'sell';
  amountToken: number;
  amountSol: number;
  priceUsd: number;
  marketCapUsd: number;
  trader: string;
  source: 'jupiter' | 'raydium' | 'pump_fun' | 'unknown';
}

export interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  priceImpactPct: number;
  routePlan: any[];
  slippageBps: number;
}

export interface PendingOrder {
  id: string;
  type: 'market' | 'limit' | 'stop_loss' | 'take_profit';
  side: 'buy' | 'sell';
  amount: number;
  price?: number;
  status: 'pending' | 'submitted' | 'filled' | 'cancelled' | 'failed';
  createdAt: number;
  txSignature?: string;
  error?: string;
}

export interface Position {
  tokenAddress: string;
  amount: number;
  avgEntryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
}

export type WSStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// ============ Store State ============

interface TradingState {
  // Current token
  tokenAddress: string | null;
  tokenInfo: TokenInfo | null;
  
  // Real-time data
  currentPrice: number;
  marketCap: number;
  priceChange24h: number;
  
  // Chart data
  candles: OHLCVCandle[];
  currentCandle: OHLCVCandle | null;
  selectedTimeframe: string;
  
  // Trades
  recentTrades: Trade[];
  
  // WebSocket status
  wsStatus: WSStatus;
  lastWsMessage: number;
  
  // Quote cache
  cachedQuote: JupiterQuote | null;
  quoteExpiry: number;
  quoteFetchTime: number;
  
  // Orders
  pendingOrders: PendingOrder[];
  
  // Positions
  positions: Position[];
  
  // Optimistic balance updates
  optimisticBalanceChange: number;
  
  // Actions
  setToken: (address: string | null) => void;
  setTokenInfo: (info: TokenInfo | null) => void;
  updatePrice: (price: number, marketCap?: number) => void;
  
  // Candle actions
  setCandles: (candles: OHLCVCandle[]) => void;
  updateCandle: (candle: OHLCVCandle) => void;
  addCompletedCandle: (candle: OHLCVCandle) => void;
  setTimeframe: (timeframe: string) => void;
  
  // Trade actions
  addTrade: (trade: Trade) => void;
  setRecentTrades: (trades: Trade[]) => void;
  
  // WebSocket actions
  setWsStatus: (status: WSStatus) => void;
  updateWsHeartbeat: () => void;
  
  // Quote actions
  setCachedQuote: (quote: JupiterQuote | null) => void;
  isQuoteValid: () => boolean;
  
  // Order actions
  addPendingOrder: (order: PendingOrder) => void;
  updateOrderStatus: (orderId: string, status: PendingOrder['status'], txSignature?: string, error?: string) => void;
  removePendingOrder: (orderId: string) => void;
  clearPendingOrders: () => void;
  
  // Position actions
  updatePosition: (position: Position) => void;
  removePosition: (tokenAddress: string) => void;
  
  // Optimistic updates
  applyOptimisticBalance: (change: number) => void;
  rollbackOptimisticBalance: () => void;
  
  // Reset
  reset: () => void;
  resetForNewToken: () => void;
}

// ============ Initial State ============

const initialState = {
  tokenAddress: null,
  tokenInfo: null,
  currentPrice: 0,
  marketCap: 0,
  priceChange24h: 0,
  candles: [],
  currentCandle: null,
  selectedTimeframe: '1m',
  recentTrades: [],
  wsStatus: 'disconnected' as WSStatus,
  lastWsMessage: 0,
  cachedQuote: null,
  quoteExpiry: 0,
  quoteFetchTime: 0,
  pendingOrders: [],
  positions: [],
  optimisticBalanceChange: 0,
};

// ============ Store ============

export const useTradingStore = create<TradingState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,
    
    // ============ Token Actions ============
    
    setToken: (address) => {
      const current = get().tokenAddress;
      if (current !== address) {
        // Reset token-specific data when changing tokens
        set({
          tokenAddress: address,
          tokenInfo: null,
          currentPrice: 0,
          marketCap: 0,
          priceChange24h: 0,
          candles: [],
          currentCandle: null,
          recentTrades: [],
          cachedQuote: null,
          quoteExpiry: 0,
        });
      }
    },
    
    setTokenInfo: (info) => set({ 
      tokenInfo: info,
      currentPrice: info?.price || get().currentPrice,
      marketCap: info?.marketCap || get().marketCap,
      priceChange24h: info?.priceChange24h || get().priceChange24h,
    }),
    
    updatePrice: (price, marketCap) => set((state) => ({
      currentPrice: price,
      marketCap: marketCap ?? state.marketCap,
    })),
    
    // ============ Candle Actions ============
    
    setCandles: (candles) => set({ candles }),
    
    updateCandle: (candle) => set((state) => {
      // Update or add current candle
      const candles = [...state.candles];
      const lastIndex = candles.length - 1;
      
      if (lastIndex >= 0 && candles[lastIndex].time === candle.time) {
        // Update existing candle
        candles[lastIndex] = candle;
      } else if (lastIndex < 0 || candle.time > candles[lastIndex].time) {
        // Add new candle
        candles.push(candle);
        
        // Keep only last 500 candles
        if (candles.length > 500) {
          candles.shift();
        }
      }
      
      return {
        candles,
        currentCandle: candle.isClosed ? null : candle,
        currentPrice: candle.close,
        marketCap: candle.close, // In market-cap mode, close IS the market cap
      };
    }),
    
    addCompletedCandle: (candle) => set((state) => {
      const candles = [...state.candles];
      
      // Only add if newer than last candle
      const lastCandle = candles[candles.length - 1];
      if (!lastCandle || candle.time > lastCandle.time) {
        candles.push({ ...candle, isClosed: true });
        
        // Keep only last 500 candles
        if (candles.length > 500) {
          candles.shift();
        }
      }
      
      return { candles };
    }),
    
    setTimeframe: (timeframe) => set({ 
      selectedTimeframe: timeframe,
      candles: [], // Clear candles when changing timeframe
      currentCandle: null,
    }),
    
    // ============ Trade Actions ============
    
    addTrade: (trade) => set((state) => {
      const trades = [trade, ...state.recentTrades].slice(0, 100);
      return { recentTrades: trades };
    }),
    
    setRecentTrades: (trades) => set({ recentTrades: trades }),
    
    // ============ WebSocket Actions ============
    
    setWsStatus: (status) => set({ wsStatus: status }),
    
    updateWsHeartbeat: () => set({ lastWsMessage: Date.now() }),
    
    // ============ Quote Actions ============
    
    setCachedQuote: (quote) => set({
      cachedQuote: quote,
      quoteExpiry: quote ? Date.now() + 1000 : 0, // 1 second validity
      quoteFetchTime: Date.now(),
    }),
    
    isQuoteValid: () => {
      const { cachedQuote, quoteExpiry } = get();
      return cachedQuote !== null && Date.now() < quoteExpiry;
    },
    
    // ============ Order Actions ============
    
    addPendingOrder: (order) => set((state) => ({
      pendingOrders: [...state.pendingOrders, order],
    })),
    
    updateOrderStatus: (orderId, status, txSignature, error) => set((state) => ({
      pendingOrders: state.pendingOrders.map((order) =>
        order.id === orderId
          ? { ...order, status, txSignature, error }
          : order
      ),
    })),
    
    removePendingOrder: (orderId) => set((state) => ({
      pendingOrders: state.pendingOrders.filter((o) => o.id !== orderId),
    })),
    
    clearPendingOrders: () => set({ pendingOrders: [] }),
    
    // ============ Position Actions ============
    
    updatePosition: (position) => set((state) => {
      const positions = state.positions.filter(
        (p) => p.tokenAddress !== position.tokenAddress
      );
      return { positions: [...positions, position] };
    }),
    
    removePosition: (tokenAddress) => set((state) => ({
      positions: state.positions.filter((p) => p.tokenAddress !== tokenAddress),
    })),
    
    // ============ Optimistic Updates ============
    
    applyOptimisticBalance: (change) => set((state) => ({
      optimisticBalanceChange: state.optimisticBalanceChange + change,
    })),
    
    rollbackOptimisticBalance: () => set({ optimisticBalanceChange: 0 }),
    
    // ============ Reset ============
    
    reset: () => set(initialState),
    
    resetForNewToken: () => set({
      candles: [],
      currentCandle: null,
      recentTrades: [],
      cachedQuote: null,
      quoteExpiry: 0,
    }),
  }))
);

// ============ Selectors ============

export const selectTokenAddress = (state: TradingState) => state.tokenAddress;
export const selectTokenInfo = (state: TradingState) => state.tokenInfo;
export const selectCurrentPrice = (state: TradingState) => state.currentPrice;
export const selectMarketCap = (state: TradingState) => state.marketCap;
export const selectCandles = (state: TradingState) => state.candles;
export const selectCurrentCandle = (state: TradingState) => state.currentCandle;
export const selectRecentTrades = (state: TradingState) => state.recentTrades;
export const selectWsStatus = (state: TradingState) => state.wsStatus;
export const selectCachedQuote = (state: TradingState) => state.cachedQuote;
export const selectPendingOrders = (state: TradingState) => state.pendingOrders;
export const selectPositions = (state: TradingState) => state.positions;

// ============ Derived Selectors ============

export const selectLatestCandle = (state: TradingState) => {
  if (state.currentCandle) return state.currentCandle;
  const candles = state.candles;
  return candles.length > 0 ? candles[candles.length - 1] : null;
};

export const selectPnL = (state: TradingState) => {
  const candles = state.candles;
  if (candles.length < 2) return { value: 0, percent: 0 };
  
  const first = candles[0].open;
  const last = candles[candles.length - 1].close;
  const value = last - first;
  const percent = first > 0 ? (value / first) * 100 : 0;
  
  return { value, percent };
};

export const selectIsConnected = (state: TradingState) => state.wsStatus === 'connected';

export const selectHasPendingOrders = (state: TradingState) => 
  state.pendingOrders.some((o) => o.status === 'pending' || o.status === 'submitted');





