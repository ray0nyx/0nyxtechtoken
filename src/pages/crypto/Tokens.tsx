import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AlertTriangle, Search, Zap, BarChart2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import TradingViewLightweightChart, { type OrderLine } from '@/components/crypto/TradingViewLightweightChart';
import ChartToolbar from '@/components/crypto/ui/ChartToolbar';
import TokenHeaderBar from '@/components/crypto/ui/TokenHeaderBar';
import QuickBuyButtons from '@/components/crypto/ui/QuickBuyButtons';
import OHLCDisplay from '@/components/crypto/ui/OHLCDisplay';
import DrawingToolsSidebar from '@/components/crypto/chart/DrawingToolsSidebar';
import TradingPanel, { type TradingOrder } from '@/components/crypto/TradingPanel';
import BottomTabs from '@/components/crypto/ui/BottomTabs';
import CryptoNavTabs from '@/components/crypto/ui/CryptoNavTabs';
import { type Transaction } from '@/components/crypto/ui/TransactionsTable';
import { useToast } from '@/components/ui/use-toast';
import { useTheme } from '@/components/ThemeProvider';
import { cn } from '@/lib/utils';
import {
  fetchDexPairData,
  fetchOrderBook,
  fetchRecentTrades,
  fetchTransactions,
  fetchOHLCVData,
  searchTokens,
  type DexPairData,
  type DexTrade,
  type OrderBookEntry,
  type DexSearchResult
} from '@/lib/dex-screener-service';
import { TIMEFRAMES, type Timeframe } from '@/components/crypto/TimeframeSelector';
import { subscribeToPriceUpdates, getRealTimePrice, getConnectionStatus, type PriceUpdate, type ConnectionStatus } from '@/lib/realtime-price-service';
import { createPriceWebSocket, type PriceUpdate as WsPriceUpdate, type TradeUpdate } from '@/lib/websocket-price-service';
import {
  createBirdeyeWebSocket,
  fetchOHLCVData as fetchBirdeyeOHLCV,
  fetchTokenOverview,
  type BirdeyePriceData,
  type BirdeyeTradeData,
  formatOHLCVForChart
} from '@/lib/birdeye-websocket-service';
import { createOHLCVAggregator, timeframeToMs, type OHLCVCandle } from '@/lib/ohlcv-aggregator';
import type { RealtimeCandleUpdate } from '@/components/crypto/TradingViewLightweightChart';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import {
  executeMarketOrder,
  createLimitOrder,
  createStopLossOrder,
  createTakeProfitOrder,
  startOrderMonitor,
  stopOrderMonitor,
  stopAllOrderMonitors,
  type MonitoredOrder
} from '@/lib/trading-order-service';
import { createClient } from '@/lib/supabase/client';
import MemeCoinRiskWarning from '@/components/crypto/MemeCoinRiskWarning';
import TradingAgreementModal from '@/components/crypto/TradingAgreementModal';
import { useTurnkeyWallet } from '@/lib/wallet-abstraction/TurnkeyWalletContext';
import { quoteAndSwap } from '@/lib/jupiter-sdk-service';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import TokenAlertModal from '@/components/crypto/ui/TokenAlertModal';
import DiscordWebhookModal from '@/components/crypto/ui/DiscordWebhookModal';
import { getSolPrice, fetchWalletTrades } from '@/lib/helius-service';
import type { TradingStats } from '@/components/crypto/TradingPanel';
import { useAlertMonitor } from '@/hooks/useAlertMonitor';

// SOL mint address constant
const SOL_MINT = 'So11111111111111111111111111111111111111112';

interface UserTokenStats {
  boughtSol: number;
  soldSol: number;
  boughtTokens: number;
  soldTokens: number;
}

interface TokenInfo {
  name: string;
  symbol: string;
  logo?: string;
  liquidity: string;
  marketCap: string;
  marketCapRaw: number; // Raw number for calculations
  pairAddress: string;
  price: number;
  change24h: number;
  supply?: string;
  age?: string;
  holders?: number;
  globalFeesPaid?: string;
  bondingCurveProgress?: number; // 0-100 percentage
}

// Helper function to format market cap
const formatMarketCap = (value: number): string => {
  if (!value || value <= 0) return '$0';
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(0)}`;
};

// Helper function to format liquidity
const formatLiquidity = (value: number): string => {
  if (!value || value <= 0) return '$0';
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
};

// Helper to parse market cap string back to number
const parseMarketCap = (mcStr: string): number => {
  if (!mcStr) return 0;
  const cleaned = mcStr.replace(/[$,]/g, '');
  const match = cleaned.match(/([0-9.]+)\s*([KMBT])?/i);
  if (!match) return 0;
  const num = parseFloat(match[1]) || 0;
  const suffix = (match[2] || '').toUpperCase();
  const multipliers: Record<string, number> = { 'K': 1000, 'M': 1000000, 'B': 1000000000, 'T': 1000000000000 };
  return num * (multipliers[suffix] || 1);
};

export default function CoinsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme } = useTheme();
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const { publicKey, connected, signTransaction } = useWallet();
  const { connection } = useConnection();
  const supabase = createClient();

  // Get URL parameters for pair and address
  const urlPair = searchParams.get('pair');
  const urlAddress = searchParams.get('address');

  const [selectedPair, setSelectedPair] = useState(urlPair || 'BONK/USD');
  // BONK token address on Solana (default)
  const [selectedTokenAddress, setSelectedTokenAddress] = useState<string | undefined>(
    urlAddress || 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'
  );
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>(TIMEFRAMES[1]); // Default to 1m
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Risk warning state
  const [showRiskWarning, setShowRiskWarning] = useState(false);
  const [hasAcknowledgedRisk, setHasAcknowledgedRisk] = useState(false);
  const [checkingRiskAcknowledgment, setCheckingRiskAcknowledgment] = useState(true);

  // Trading agreement state
  const [showTradingAgreement, setShowTradingAgreement] = useState(false);
  const [hasAgreedToTrading, setHasAgreedToTrading] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<TradingOrder | null>(null);

  // Alert modals state
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [showDiscordModal, setShowDiscordModal] = useState(false);

  // Real-time price state
  const [realTimePrice, setRealTimePrice] = useState<number | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);

  // Real-time candle from OHLCV aggregator
  const [realtimeCandle, setRealtimeCandle] = useState<RealtimeCandleUpdate | null>(null);
  const aggregatorRef = useRef<ReturnType<typeof createOHLCVAggregator> | null>(null);
  const birdeyeWsRef = useRef<ReturnType<typeof createBirdeyeWebSocket> | null>(null);

  // Currency display mode
  type CurrencyMode = 'usd' | 'sol';
  const [currencyMode, setCurrencyMode] = useState<CurrencyMode>('usd');

  // Chart display mode (price vs market cap)
  type ChartDisplayMode = 'price' | 'marketCap';
  const [chartDisplayMode, setChartDisplayMode] = useState<ChartDisplayMode>('marketCap');

  // UI state
  const [showBubbles, setShowBubbles] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [chartType, setChartType] = useState<'line' | 'candlestick'>('candlestick');
  const [isFavorite, setIsFavorite] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<DexSearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chart data - raw price data from API
  const [chartData, setChartData] = useState<any[]>([]);

  // Token info
  const [tokenInfo, setTokenInfo] = useState<TokenInfo>({
    name: '',
    symbol: 'BONK',
    logo: undefined,
    liquidity: '$0',
    marketCap: '$0',
    marketCapRaw: 0,
    pairAddress: '',
    price: 0,
    change24h: 0,
    supply: '0',
    age: '',
    holders: 0,
    globalFeesPaid: '$0',
    bondingCurveProgress: 0,
  });

  // Order book
  const [bids, setBids] = useState<OrderBookEntry[]>([]);
  const [asks, setAsks] = useState<OrderBookEntry[]>([]);

  // Transactions for table
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Active orders for chart visualization (limit, stop loss, take profit)
  const [activeOrders, setActiveOrders] = useState<OrderLine[]>([]);
  const [previewOrderLine, setPreviewOrderLine] = useState<OrderLine | null>(null);

  // Real-time user stats for the selected token
  const [userTokenStats, setUserTokenStats] = useState<UserTokenStats>({
    boughtSol: 0,
    soldSol: 0,
    boughtTokens: 0,
    soldTokens: 0
  });
  const [solPrice, setSolPrice] = useState<number>(200); // Default fallback sol price

  // Alert monitoring with Discord notifications
  useAlertMonitor({
    tokenMint: selectedTokenAddress || '',
    tokenSymbol: tokenInfo.symbol,
    currentMarketCap: tokenInfo.marketCapRaw,
    isMigrating: false, // TODO: Detect migration from token data
  });

  // Calculate current OHLC from chart data - scaled to market cap if in that mode
  const currentOHLC = useMemo(() => {
    if (chartData.length === 0) {
      return { open: 0, high: 0, low: 0, close: 0, volume: 0, changePercent: 0 };
    }

    const latest = chartData[chartData.length - 1];
    const mcValue = tokenInfo.marketCapRaw || parseMarketCap(tokenInfo.marketCap);
    const latestClose = latest.close || 1;

    // Calculate scale factor: what multiplier turns price into market cap?
    const scaleFactor = mcValue > 0 && latestClose > 0 ? mcValue / latestClose : 1;

    if (chartDisplayMode === 'marketCap' && scaleFactor > 1) {
      return {
        open: latest.open * scaleFactor,
        high: latest.high * scaleFactor,
        low: latest.low * scaleFactor,
        close: latest.close * scaleFactor,
        volume: latest.volume || 0,
        changePercent: tokenInfo.change24h || 0,
      };
    }

    return {
      open: latest.open,
      high: latest.high,
      low: latest.low,
      close: latest.close,
      volume: latest.volume || 0,
      changePercent: tokenInfo.change24h || 0,
    };
  }, [chartData, tokenInfo.marketCap, tokenInfo.marketCapRaw, tokenInfo.change24h, chartDisplayMode]);

  // Load token data from APIs
  const loadTokenData = useCallback(async () => {
    if (!selectedPair) return;

    setLoading(true);
    setError(null);

    try {
      let baseSymbol = selectedPair.split('/')[0]?.trim();
      if (!baseSymbol) baseSymbol = 'UNKNOWN';
      console.log('📊 Loading data for:', selectedPair, 'token:', selectedTokenAddress);

      // Fetch pair data (includes logo, price, marketCap, liquidity)
      const pairData = await fetchDexPairData(baseSymbol, selectedTokenAddress);
      console.log('📈 Pair data received:', pairData);
      console.log('💰 Market cap from API:', pairData?.marketCap);

      if (pairData) {
        const mcRaw = pairData.marketCap || 0;
        console.log('💵 Setting marketCapRaw to:', mcRaw, '-> formatted:', formatMarketCap(mcRaw));

        setTokenInfo({
          name: (pairData as any).baseToken?.name || baseSymbol,
          symbol: (pairData as any).baseToken?.symbol || baseSymbol,
          logo: (pairData as any).baseToken?.logoURI || (pairData as any).logo,
          price: pairData.priceUsd || pairData.price || 0,
          marketCap: formatMarketCap(mcRaw),
          marketCapRaw: mcRaw,
          liquidity: formatLiquidity(pairData.liquidity || 0),
          pairAddress: pairData.pairAddress || '',
          change24h: pairData.change24h || 0,
          supply: (pairData as any).totalSupply || '1B',
          age: (pairData as any).pairCreatedAt
            ? getTokenAge((pairData as any).pairCreatedAt)
            : '',
          holders: (pairData as any).holders || 0,
        });

        // Update real-time price
        if (pairData.priceUsd || pairData.price) {
          setRealTimePrice(pairData.priceUsd || pairData.price);
        }
      }

      // Fetch OHLCV chart data - prioritize Birdeye with token address for accurate data
      let chartCandles: any[] = [];

      // Convert timeframe to Birdeye format (e.g., '1m', '5m', '1H', '1D')
      const birdeyeTimeframe = (() => {
        const tf = selectedTimeframe;
        if (tf.unit === 'second') return null; // Birdeye doesn't support seconds
        if (tf.unit === 'minute') return `${tf.value}m`;
        if (tf.unit === 'hour') return `${tf.value}H`;
        if (tf.unit === 'day') return `${tf.value}D`;
        return '1H';
      })();

      // Try Birdeye OHLCV first (if supported timeframe)
      if (selectedTokenAddress && birdeyeTimeframe && chartCandles.length === 0) {
        try {
          console.log('📈 Fetching Birdeye OHLCV for:', selectedTokenAddress, 'timeframe:', birdeyeTimeframe);
          const birdeyeData = await fetchBirdeyeOHLCV(selectedTokenAddress, birdeyeTimeframe);

          if (birdeyeData && birdeyeData.length > 0) {
            console.log('📊 Birdeye OHLCV received:', birdeyeData.length, 'candles');
            chartCandles = birdeyeData.map(candle => ({
              time: candle.unixTime,
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close,
              volume: candle.volume || 0,
            }));
          }
        } catch (birdeyeError) {
          console.warn('📉 Birdeye OHLCV failed:', birdeyeError);
        }
      }

      // Fallback 1: Try dex-screener service (backend)
      if (chartCandles.length === 0) {
        try {
          console.log('📉 Birdeye returned no data, trying dex-screener backend...');
          const ohlcv = await fetchOHLCVData(selectedTokenAddress || selectedPair, selectedTimeframe as any, 1000);
          console.log('📉 DexScreener backend returned:', ohlcv?.length || 0, 'candles');

          if (ohlcv && ohlcv.length > 0) {
            console.log('📉 DexScreener OHLCV data received:', ohlcv.length, 'candles');
            chartCandles = ohlcv.map(candle => ({
              time: typeof candle.time === 'string'
                ? Math.floor(new Date(candle.time).getTime() / 1000)
                : candle.time,
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close,
              volume: candle.volume || 0,
            }));
          } else {
            console.log('📉 DexScreener backend returned empty, continuing to direct API...');
          }
        } catch (dexError) {
          console.warn('📉 DexScreener backend failed:', dexError);
        }
      }

      console.log('📊 After fallback 1, chartCandles.length:', chartCandles.length);

      // Fallback 2: Try direct DexScreener API (skip if 1s timeframe to avoid bad scaling)
      if (chartCandles.length === 0 && selectedTokenAddress && selectedTimeframe.unit !== 'second') {
        console.log('📊 Fallback 2: Trying direct DexScreener API for:', selectedTokenAddress);
        try {
          const dexResponse = await fetch(
            `https://api.dexscreener.com/latest/dex/tokens/${selectedTokenAddress}`,
            { headers: { 'Accept': 'application/json' } }
          );

          console.log('📊 DexScreener direct API response status:', dexResponse.status);

          if (dexResponse.ok) {
            const dexData = await dexResponse.json();
            const pair = dexData.pairs?.[0];
            console.log('📊 DexScreener direct API found pair:', pair?.pairAddress, 'price:', pair?.priceUsd);

            if (pair && pair.priceUsd) {
              const price = parseFloat(pair.priceUsd);
              const now = Math.floor(Date.now() / 1000);

              console.log('📊 DexScreener direct: generating 24 candles from price:', price);
              // Generate 24 hours of synthetic candles based on 24h price change
              const change24h = parseFloat(pair.priceChange?.h24 || '0') / 100;
              const priceYesterday = price / (1 + change24h);

              for (let i = 0; i < 24; i++) {
                const hourAgo = now - (23 - i) * 3600;
                const progress = i / 23;
                const interpolatedPrice = priceYesterday + (price - priceYesterday) * progress;
                // Add some variance
                const variance = interpolatedPrice * 0.02 * (Math.random() - 0.5);

                chartCandles.push({
                  time: hourAgo,
                  open: interpolatedPrice - variance,
                  high: interpolatedPrice + Math.abs(variance),
                  low: interpolatedPrice - Math.abs(variance),
                  close: i === 23 ? price : interpolatedPrice + variance,
                  volume: parseFloat(pair.volume?.h24 || '0') / 24,
                });
              }
              console.log('📊 Generated', chartCandles.length, 'synthetic candles');
            }
          }
        } catch (directError) {
          console.warn('📊 Direct DexScreener API failed:', directError);
        }
      }

      // Fallback 3: Create single candle from current price (Always do this for 1s to start fresh)
      if (chartCandles.length === 0 && (realTimePrice && realTimePrice > 0 || selectedTimeframe.unit === 'second')) {
        const price = realTimePrice || tokenInfo.price || 0;
        if (price > 0) {
          console.log('📊 Using current price for initial candle:', price);
          const now = Math.floor(Date.now() / 1000);
          chartCandles = [{
            time: now,
            open: price,
            high: price,
            low: price,
            close: price,
            volume: 0,
          }];
        }
      }

      if (chartCandles.length > 0) {
        console.log('📊 Chart data ready:', chartCandles.length, 'candles');
        console.log('📊 First candle:', chartCandles[0]);
        console.log('📊 Last candle:', chartCandles[chartCandles.length - 1]);
        setChartData(chartCandles);
      } else {
        console.warn('⚠️ No OHLCV data from any source');
      }

      // Fetch transactions
      try {
        const txns = await fetchTransactions(selectedPair, 50);
        console.log('💱 Transactions received:', txns?.length);
        if (txns && txns.length > 0) {
          setTransactions(txns);
        }
      } catch (txError) {
        console.warn('Failed to fetch transactions:', txError);
      }

    } catch (err: any) {
      console.error('❌ Failed to load token data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [selectedPair, selectedTokenAddress, selectedTimeframe]);

  // Helper to calculate token age
  const getTokenAge = (timestamp: number): string => {
    const now = Date.now();
    const created = timestamp > 1e12 ? timestamp : timestamp * 1000;
    const diff = now - created;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days > 30) return `${Math.floor(days / 30)}mo`;
    if (days > 0) return `${days}d`;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours > 0) return `${hours}h`;
    const mins = Math.floor(diff / (1000 * 60));
    return `${mins}m`;
  };

  // Load data on mount and when pair/timeframe changes
  useEffect(() => {
    loadTokenData();
  }, [loadTokenData]);

  // Handle URL parameter changes (when navigating from Surge page)
  useEffect(() => {
    const pairParam = searchParams.get('pair');
    const addressParam = searchParams.get('address');

    console.log('🔗 URL params changed - pair:', pairParam, 'address:', addressParam);

    // Update pair if different
    if (pairParam && pairParam !== selectedPair) {
      console.log('🔗 Updating pair from', selectedPair, 'to', pairParam);
      // Clear existing data for new token
      setChartData([]);
      setTransactions([]);
      setRealTimePrice(null);
      setRealtimeCandle(null);
      setActiveOrders([]);
      setSelectedPair(pairParam);
    }

    // Update address if different - this triggers price polling restart
    if (addressParam && addressParam !== selectedTokenAddress) {
      console.log('🔗 Updating token address from', selectedTokenAddress, 'to', addressParam);
      setSelectedTokenAddress(addressParam);
    }
  }, [searchParams, selectedPair, selectedTokenAddress]);

  // Set up real-time data with Birdeye WebSocket and OHLCV aggregator
  useEffect(() => {
    if (!selectedTokenAddress) return;

    // Create OHLCV aggregator for current timeframe
    const timeframeMs = timeframeToMs(selectedTimeframe.label);
    const aggregator = createOHLCVAggregator(timeframeMs);
    aggregatorRef.current = aggregator;

    // Subscribe to candle updates from aggregator
    const unsubscribe = aggregator.onCandleUpdate((candle: OHLCVCandle) => {
      setRealtimeCandle({
        time: candle.time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
      });
    });

    // Try Birdeye WebSocket first (if API key is available)
    const birdeyeWs = createBirdeyeWebSocket(selectedTokenAddress);
    birdeyeWsRef.current = birdeyeWs;

    birdeyeWs.onPrice((data: BirdeyePriceData) => {
      const price = data.value;
      if (price > 0) {
        console.log('🐦 Birdeye price update:', price, 'updating chart...');
        setRealTimePrice(price);
        // Feed price to aggregator for candle formation
        aggregator.processPriceUpdate(price, data.updateUnixTime * 1000);

        // Update token info
        setTokenInfo(prev => ({
          ...prev,
          price: price,
          change24h: data.priceChange24h || prev.change24h,
        }));
      }
    });

    birdeyeWs.onTrade((trade: BirdeyeTradeData) => {
      // Feed trade to aggregator for proper OHLCV
      aggregator.processTrade({
        price: trade.priceUsd || trade.price,
        volume: trade.volumeUsd || trade.volume,
        timestamp: trade.blockUnixTime * 1000,
        side: trade.side,
      });

      // Add to transactions list
      const baseSymbol = selectedPair.split('/')[0] || 'TOKEN';
      const newTransaction: Transaction = {
        id: trade.txHash || `tx-${Date.now()}`,
        date: new Date(trade.blockUnixTime * 1000).toISOString(),
        type: trade.side,
        usd: trade.volumeUsd,
        baseAmount: trade.volume,
        price: trade.priceUsd || trade.price,
        maker: trade.owner?.slice(0, 8) + '...' || 'Unknown',
        baseSymbol,
      };
      setTransactions(prev => [newTransaction, ...prev].slice(0, 100));
    });

    birdeyeWs.onStatus((status) => {
      setConnectionStatus({
        connected: status === 'connected',
        lastUpdate: Date.now(),
        errorCount: status === 'error' ? 1 : 0,
        retryDelay: 3000,
      });
    });

    // Also try the fallback WebSocket
    const ws = createPriceWebSocket(selectedTokenAddress);

    // Fetch SOL price and historical trades for stats
    const hydrateStats = async () => {
      try {
        const price = await getSolPrice();
        setSolPrice(price);

        if (publicKey) {
          const trades = await fetchWalletTrades(publicKey.toString(), 100);
          const relevantTrades = trades.filter(t => t.tokenAddress.toLowerCase() === selectedTokenAddress.toLowerCase());

          let boughtSol = 0;
          let soldSol = 0;
          let boughtTokens = 0;
          let soldTokens = 0;

          relevantTrades.forEach(t => {
            if (t.type === 'buy') {
              boughtSol += t.solAmount;
              boughtTokens += t.tokenAmount;
            } else {
              soldSol += t.solAmount;
              soldTokens += t.tokenAmount;
            }
          });

          // Also check localStorage for any session-only trades not yet on-chain
          try {
            const saved = localStorage.getItem(`onyx_user_stats_${selectedTokenAddress}`);
            if (saved) {
              const localStats = JSON.parse(saved);
              // Simple merging strategy: max of Helius or Local for bought/sold
              // This is a bit naive but handles both on-chain and locally tracked
              boughtSol = Math.max(boughtSol, localStats.boughtSol);
              soldSol = Math.max(soldSol, localStats.soldSol);
              boughtTokens = Math.max(boughtTokens, localStats.boughtTokens);
              soldTokens = Math.max(soldTokens, localStats.soldTokens);
            }
          } catch (e) { }

          setUserTokenStats({ boughtSol, soldSol, boughtTokens, soldTokens });
        }
      } catch (e) {
        console.error('Failed to hydrate trading stats:', e);
      }
    };

    hydrateStats();

    ws.onPrice((update: WsPriceUpdate) => {
      const price = update.priceUsd || update.price;
      if (price > 0) {
        // Always update price from fallback if we get valid data
        setRealTimePrice(price);
        aggregator.processPriceUpdate(price);

        setTokenInfo(prev => ({
          ...prev,
          price: price,
          change24h: update.change24h || prev.change24h,
          marketCapRaw: update.marketCap || prev.marketCapRaw,
          marketCap: update.marketCap ? formatMarketCap(update.marketCap) : prev.marketCap,
        }));
      }
    });

    return () => {
      unsubscribe();
      birdeyeWs.disconnect();
      ws.disconnect();
      aggregatorRef.current = null;
      birdeyeWsRef.current = null;
    };
  }, [selectedTokenAddress, selectedTimeframe, publicKey, solPrice]);

  // Derived real-time trading stats
  const tradingStats = useMemo<TradingStats>(() => {
    const holdingTokens = Math.max(0, userTokenStats.boughtTokens - userTokenStats.soldTokens);
    const holdingSolValue = solPrice > 0 ? (holdingTokens * (realTimePrice || tokenInfo.price)) / solPrice : 0;

    // Total SOL value if we sold everything now + SOL we already received from selling
    const totalValueNow = userTokenStats.soldSol + holdingSolValue;
    const pnlSol = totalValueNow - userTokenStats.boughtSol;
    const pnlPercent = userTokenStats.boughtSol > 0 ? (pnlSol / userTokenStats.boughtSol) * 100 : 0;

    return {
      bought: userTokenStats.boughtSol,
      sold: userTokenStats.soldSol,
      holding: holdingSolValue,
      pnl: pnlSol,
      pnlPercent: pnlPercent
    };
  }, [userTokenStats, realTimePrice, tokenInfo.price, solPrice]);

  // Dedicated price polling interval for continuous chart updates
  useEffect(() => {
    if (!selectedTokenAddress) return;

    console.log('⏰ Starting price polling for:', selectedTokenAddress);
    let isActive = true;

    const pollPrice = async () => {
      if (!isActive) return;

      try {
        // Use DexScreener for reliable price data
        const response = await fetch(
          `https://api.dexscreener.com/latest/dex/tokens/${selectedTokenAddress}`,
          {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(5000)
          }
        );

        if (response.ok && isActive) {
          const data = await response.json();
          const pair = data.pairs?.[0];

          if (pair && pair.priceUsd) {
            const price = parseFloat(pair.priceUsd);
            if (price > 0) {
              console.log('🔄 Price poll update:', price);
              setRealTimePrice(price);

              // Feed to aggregator for candle updates
              if (aggregatorRef.current) {
                aggregatorRef.current.processPriceUpdate(price);
              }

              // Update token info with latest data
              setTokenInfo(prev => ({
                ...prev,
                price: price,
                marketCapRaw: parseFloat(pair.marketCap || '0') || prev.marketCapRaw,
                marketCap: pair.marketCap ? formatMarketCap(parseFloat(pair.marketCap)) : prev.marketCap,
                change24h: parseFloat(pair.priceChange?.h24 || '0') || prev.change24h,
              }));
            }
          } else {
            console.log('🔄 Price poll: No pair data found');
          }
        } else if (!response.ok) {
          console.log('🔄 Price poll failed with status:', response.status);
        }
      } catch (error) {
        console.warn('🔄 Price poll failed:', error);
      }
    };

    // Poll every 3 seconds for near real-time price updates
    const intervalId = setInterval(pollPrice, 3000);

    // Also poll for token overview (holders, etc.) every 10 seconds
    const pollTokenOverview = async () => {
      if (!isActive || !selectedTokenAddress) return;
      try {
        const data = await fetchTokenOverview(selectedTokenAddress);
        if (data && isActive) {
          setTokenInfo(prev => ({
            ...prev,
            holders: (data as any).holder || (data as any).holders || (data as any).uniqueWallet24h || prev.holders,
            supply: data.supply ? data.supply.toLocaleString() : prev.supply,
          }));
        }
      } catch (e) {
        console.warn('Overview poll failed:', e);
      }
    };

    pollTokenOverview();
    const overviewIntervalId = setInterval(pollTokenOverview, 10000);

    return () => {
      console.log('⏰ Stopping polling');
      isActive = false;
      clearInterval(intervalId);
      clearInterval(overviewIntervalId);
    };
  }, [selectedTokenAddress]);

  // Check risk acknowledgment on mount
  useEffect(() => {
    const checkRiskAcknowledgment = async () => {
      try {
        // 1. Fast path: Check localStorage
        const localAcknowledged = localStorage.getItem('meme_coin_risk_acknowledged');
        if (localAcknowledged === 'true') {
          setHasAcknowledgedRisk(true);
          setCheckingRiskAcknowledgment(false);
          return;
        }

        // 2. Auth path: Check database if logged in
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data, error } = await supabase
            .from('user_risk_acknowledgments')
            .select('id')
            .eq('user_id', user.id)
            .eq('acknowledgment_type', 'meme_coin_risk')
            .limit(1);

          if (data && data.length > 0) {
            setHasAcknowledgedRisk(true);
            localStorage.setItem('meme_coin_risk_acknowledged', 'true');
            setCheckingRiskAcknowledgment(false);
            return;
          }
        }

        // 3. Fallback: Show warning
        setShowRiskWarning(true);
      } catch (error) {
        console.error('Error checking risk acknowledgment:', error);
        // Fallback to showing warning if check fails
        setShowRiskWarning(true);
      } finally {
        setCheckingRiskAcknowledgment(false);
      }
    };
    checkRiskAcknowledgment();
  }, [supabase]);

  // Handle risk acknowledgment
  const handleRiskAcknowledged = () => {
    localStorage.setItem('meme_coin_risk_acknowledged', 'true');
    setHasAcknowledgedRisk(true);
    setShowRiskWarning(false);
  };

  // Handle trading agreement
  const handleTradingAgreementAccepted = () => {
    setHasAgreedToTrading(true);
    setShowTradingAgreement(false);
    if (pendingOrder) {
      handleOrderSubmit(pendingOrder);
      setPendingOrder(null);
    }
  };

  // Handle search input
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setShowSearchResults(query.length > 0);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim().length === 0) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchTokens(query);
        const filteredResults = results.map(result => {
          const baseSymbol = result.baseToken?.symbol || result.symbol.split('/')[0];
          return { ...result, symbol: `${baseSymbol}/USD` };
        });
        const uniqueResults = filteredResults.filter((result, index, self) =>
          index === self.findIndex(r => r.baseToken?.address === result.baseToken?.address)
        );
        setSearchResults(uniqueResults);
      } catch (error) {
        console.error('Error searching tokens:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);
  };

  // Handle coin selection from search
  const handleSelectCoin = (result: DexSearchResult) => {
    const baseSymbol = result.baseToken?.symbol || result.symbol.split('/')[0];

    // Clear all existing data immediately to prevent stale data mixing
    setChartData([]);
    setTransactions([]);
    setRealTimePrice(null);
    setActiveOrders([]);

    // Reset token info to prevent old data showing
    setTokenInfo({
      name: '',
      symbol: baseSymbol,
      logo: undefined,
      liquidity: '$0',
      marketCap: '$0',
      marketCapRaw: 0,
      pairAddress: '',
      price: 0,
      change24h: 0,
      supply: '0',
      age: '',
      holders: 0,
    });

    // Set new token - this will trigger loadTokenData
    setSelectedPair(`${baseSymbol}/USD`);
    setSelectedTokenAddress(result.baseToken?.address);

    // Update token info with search result data including logo
    const mcRaw = result.marketCap || result.fdv || 0;
    setTokenInfo({
      name: result.baseToken?.name || baseSymbol,
      symbol: baseSymbol,
      logo: result.baseToken?.logoURI,
      price: result.priceUsd || result.price || 0,
      marketCap: formatMarketCap(mcRaw),
      marketCapRaw: mcRaw,
      liquidity: formatLiquidity(result.liquidity || 0),
      pairAddress: result.pairAddress || '',
      change24h: result.change24h || 0,
      supply: result.totalSupply || '1B',
      age: result.pairCreatedAt ? getTokenAge(result.pairCreatedAt) : '',
      holders: result.holders || 0,
    });

    setSearchQuery('');
    setShowSearchResults(false);
    setSearchResults([]);
  };

  // Handle quick buy
  const handleQuickBuy = async (amount: number) => {
    // Check for wallet connection (either native or Turnkey)
    const turnkeyWallet = (window as any).__turnkeyWallet;
    const hasWallet = connected || turnkeyWallet?.connected;

    if (!hasWallet) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to trade.',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedTokenAddress) {
      toast({
        title: 'No Token Selected',
        description: 'Please select a token to buy.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Executing Buy Order...',
      description: `Buying ${amount} SOL of ${tokenInfo.symbol}`,
    });

    try {
      // Get the sign function from either Turnkey or native wallet
      const signFunc = turnkeyWallet?.signTransaction || signTransaction;
      const userPubKey = turnkeyWallet?.publicKey || publicKey;

      if (!signFunc || !userPubKey) {
        throw new Error('No signing function available');
      }

      // Execute swap via Jupiter SDK
      const result = await quoteAndSwap(
        connection,
        {
          inputMint: SOL_MINT,
          outputMint: selectedTokenAddress,
          amount: Math.floor(amount * LAMPORTS_PER_SOL), // Convert SOL to lamports
          slippageBps: 100, // 1% slippage
        },
        {
          userPublicKey: userPubKey.toString(),
          wrapAndUnwrapSol: true,
          prioritizationFeeLamports: 'auto',
        },
        signFunc
      );

      if (result.success && result.txSignature) {
        toast({
          title: 'Buy Order Executed!',
          description: `Bought ${amount} SOL of ${tokenInfo.symbol}. TX: ${result.txSignature.slice(0, 8)}...`,
        });
        console.log('Trade executed:', result.txSignature);
      } else {
        throw new Error(result.error || 'Failed to execute swap');
      }
    } catch (error: any) {
      console.error('Quick buy error:', error);
      toast({
        title: 'Order Failed',
        description: error.message || 'Failed to execute buy order',
        variant: 'destructive',
      });
    }
  };

  // Handle order submit
  const handleOrderSubmit = async (order: TradingOrder) => {
    if (!hasAgreedToTrading) {
      setPendingOrder(order);
      setShowTradingAgreement(true);
      return;
    }

    try {
      // Generate unique order ID
      const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // For limit orders, stop loss, and take profit - add visual line to chart
      if (order.orderType === 'limit' && order.price) {
        const newOrderLine: OrderLine = {
          id: orderId,
          type: 'limit',
          price: order.price,
          side: order.side,
          amount: order.amount,
          draggable: true,
        };
        setActiveOrders(prev => [...prev, newOrderLine]);

        toast({
          title: 'Limit Order Created',
          description: `${order.side.toUpperCase()} ${order.amount} SOL at $${order.price.toFixed(8)}`,
        });
      } else if (order.stopLossPrice || order.stopLossPercent) {
        // Stop loss order
        const slPrice = order.stopLossPrice || (realTimePrice ? realTimePrice * (1 - (order.stopLossPercent || 10) / 100) : 0);
        const slOrderLine: OrderLine = {
          id: `${orderId}_sl`,
          type: 'stopLoss',
          price: slPrice,
          side: order.side === 'buy' ? 'sell' : 'buy', // Stop loss is opposite
          amount: order.amount,
          draggable: true,
        };
        setActiveOrders(prev => [...prev, slOrderLine]);

        toast({
          title: 'Stop Loss Created',
          description: `Stop loss at $${slPrice.toFixed(8)}`,
        });
      } else if (order.takeProfitPrice) {
        // Take profit order
        const tpOrderLine: OrderLine = {
          id: `${orderId}_tp`,
          type: 'takeProfit',
          price: order.takeProfitPrice,
          side: order.side === 'buy' ? 'sell' : 'buy', // Take profit is opposite
          amount: order.amount,
          draggable: true,
        };
        setActiveOrders(prev => [...prev, tpOrderLine]);

        toast({
          title: 'Take Profit Created',
          description: `Take profit at $${order.takeProfitPrice.toFixed(8)}`,
        });
      } else {
        // Market order - execute immediately via Jupiter
        if (!selectedTokenAddress) {
          throw new Error('No token selected');
        }

        toast({
          title: 'Executing Market Order...',
          description: `${order.side.toUpperCase()} ${order.amount} SOL`,
        });

        // Get the sign function from either Turnkey or native wallet
        const turnkeyWallet = (window as any).__turnkeyWallet;
        const signFunc = turnkeyWallet?.signTransaction || signTransaction;
        const userPubKey = turnkeyWallet?.publicKey || publicKey;

        if (!signFunc || !userPubKey) {
          throw new Error('No signing function available. Please connect a wallet.');
        }

        // Determine input/output based on buy/sell
        const isBuy = order.side === 'buy';
        const inputMint = isBuy ? SOL_MINT : selectedTokenAddress;
        const outputMint = isBuy ? selectedTokenAddress : SOL_MINT;

        // Execute swap via Jupiter SDK
        const result = await quoteAndSwap(
          connection,
          {
            inputMint,
            outputMint,
            amount: Math.floor(order.amount * LAMPORTS_PER_SOL), // Convert SOL to lamports
            slippageBps: order.slippageBps || 100, // Use order slippage or default to 1%
          },
          {
            userPublicKey: userPubKey.toString(),
            wrapAndUnwrapSol: true,
            prioritizationFeeLamports: 'auto',
          },
          signFunc
        );

        if (result.success && result.txSignature) {
          // Update user token stats
          const solAmount = typeof order.amount === 'string' ? parseFloat(order.amount) : order.amount;

          if (order.side === 'buy') {
            // Approximate tokens bought from quote
            let estimatedTokens = 0;
            const quoteResponse = (result.swapResponse as any)?.quoteResponse;
            if (quoteResponse) {
              estimatedTokens = parseFloat(quoteResponse.outAmount) / 1e9; // Simplified
            } else if (realTimePrice > 0) {
              estimatedTokens = (solAmount * solPrice) / realTimePrice;
            }

            setUserTokenStats(prev => {
              const updated = {
                ...prev,
                boughtSol: prev.boughtSol + solAmount,
                boughtTokens: prev.boughtTokens + estimatedTokens
              };
              // Persist locally
              localStorage.setItem(`onyx_user_stats_${selectedTokenAddress}`, JSON.stringify(updated));
              return updated;
            });
          } else {
            // Simplified sell tracking
            const currentHoldingSol = tradingStats.holding || 0;
            const sellRatio = solAmount / (currentHoldingSol || 1);
            const tokensSold = userTokenStats.boughtTokens * Math.min(1, sellRatio);

            setUserTokenStats(prev => {
              const updated = {
                ...prev,
                soldSol: prev.soldSol + solAmount,
                soldTokens: prev.soldTokens + tokensSold
              };
              // Persist locally
              localStorage.setItem(`onyx_user_stats_${selectedTokenAddress}`, JSON.stringify(updated));
              return updated;
            });
          }

          toast({
            title: 'Market Order Executed!',
            description: `${order.side.toUpperCase()} ${order.amount} SOL. TX: ${result.txSignature.slice(0, 8)}...`,
          });
          console.log('Trade executed:', result.txSignature);
        } else if (order.advancedStrategy) {
          // Handle Advanced Strategy (Multiple TP/SL)

          // 1. Calculate Entry Price
          let entryPrice = realTimePrice || 0;
          if (order.orderType === 'limit' && order.price) {
            // If it's a Limit order, order.price is now the "Market Cap" input
            // Convert Market Cap to Price: Price = TargetMC / Supply
            // Supply = CurrentMC / CurrentPrice
            const currentMc = tokenInfo.marketCapRaw || 0;
            const currentPrice = realTimePrice || 1;
            const supply = currentMc > 0 ? currentMc / currentPrice : 0;

            if (supply > 0) {
              entryPrice = order.price / supply;

              // Add Limit Order Line (Entry)
              const newOrderLine: OrderLine = {
                id: orderId,
                type: 'limit',
                price: entryPrice,
                side: order.side,
                amount: order.amount,
                draggable: true,
              };
              setActiveOrders(prev => [...prev, newOrderLine]);

              toast({
                title: 'Limit Order Created',
                description: `${order.side.toUpperCase()} at $${entryPrice.toFixed(8)} (MC: $${formatMarketCap(order.price)})`,
              });
            } else {
              // Fallback if supply calc fails (unlikely if data loaded)
              entryPrice = order.price; // Assume raw price if calc fails
            }
          }

          // 2. Add Take Profit Lines
          if (order.tpOrders) {
            const newTpLines: OrderLine[] = order.tpOrders.map((tp, index) => {
              // Long: Entry + % | Short: Entry - %
              const priceChange = entryPrice * (tp.percent / 100);
              const targetPrice = order.side === 'buy'
                ? entryPrice + priceChange
                : entryPrice - priceChange;

              return {
                id: `${orderId}_tp_${index}`,
                type: 'takeProfit',
                price: targetPrice,
                side: order.side === 'buy' ? 'sell' : 'buy',
                amount: tp.amount, // This is % of position usually, but OrderLine expects amount. converting logic might be needed or display as is.
                draggable: true,
              };
            });
            setActiveOrders(prev => [...prev, ...newTpLines]);
          }

          // 3. Add Stop Loss Lines
          if (order.slOrders) {
            const newSlLines: OrderLine[] = order.slOrders.map((sl, index) => {
              // Long: Entry - % | Short: Entry + %
              const priceChange = entryPrice * (sl.percent / 100);
              const targetPrice = order.side === 'buy'
                ? entryPrice - priceChange
                : entryPrice + priceChange;

              return {
                id: `${orderId}_sl_${index}`,
                type: 'stopLoss',
                price: targetPrice,
                side: order.side === 'buy' ? 'sell' : 'buy',
                amount: sl.amount,
                draggable: true,
              };
            });
            setActiveOrders(prev => [...prev, ...newSlLines]);
          }

          toast({
            title: 'Advanced Strategy Active',
            description: `Monitoring ${order.tpOrders?.length || 0} TPs and ${order.slOrders?.length || 0} SLs`,
          });

        } else {
          throw new Error(result.error || 'Failed to execute swap');
        }
      }
    } catch (error: any) {
      toast({
        title: 'Order Failed',
        description: error.message || 'Failed to submit order',
        variant: 'destructive',
      });
    }
  };

  // Handle limit order preview (Market Cap input)
  const handleLimitOrderPreview = useCallback((mc: string | undefined) => {
    if (!mc || isNaN(parseFloat(mc)) || parseFloat(mc) <= 0) {
      setPreviewOrderLine(null);
      return;
    }

    const targetMc = parseFloat(mc);
    const currentMc = tokenInfo.marketCapRaw || 0;
    const currentPrice = realTimePrice || 0;
    const supply = currentMc > 0 ? currentMc / currentPrice : 0;

    if (supply > 0) {
      const targetPrice = targetMc / supply;
      setPreviewOrderLine({
        id: 'preview_limit',
        type: 'limit',
        price: targetPrice,
        side: 'buy', // Default to buy for preview, or sync with side if needed
        amount: 0,
        draggable: false,
        isPreview: true,
      });
    } else {
      setPreviewOrderLine(null);
    }
  }, [tokenInfo.marketCapRaw, realTimePrice]);

  // Handle order drag (update price)
  const handleOrderDrag = useCallback((orderId: string, newPrice: number) => {
    setActiveOrders(prev => prev.map(order =>
      order.id === orderId ? { ...order, price: newPrice } : order
    ));
    toast({
      title: 'Order Updated',
      description: `Order price updated to $${newPrice.toFixed(8)}`,
    });
  }, [toast]);

  // Handle order cancel
  const handleOrderCancel = useCallback((orderId: string) => {
    stopOrderMonitor(orderId);
    setActiveOrders(prev => prev.filter(order => order.id !== orderId));
    toast({
      title: 'Order Cancelled',
      description: 'Order has been removed',
    });
  }, [toast]);

  // Get current price for order monitoring
  const getCurrentPriceRef = useRef<() => number | null>(() => realTimePrice);
  getCurrentPriceRef.current = () => realTimePrice;

  // Handle order triggered (executed when price hits target)
  const handleOrderTriggered = useCallback((orderId: string, triggeredPrice: number) => {
    const order = activeOrders.find(o => o.id === orderId);
    if (!order) return;

    // Remove order from active orders
    setActiveOrders(prev => prev.filter(o => o.id !== orderId));

    // Show notification
    const typeNames = {
      limit: order.side === 'buy' ? 'Limit Buy' : 'Limit Sell',
      stopLoss: 'Stop Loss',
      takeProfit: 'Take Profit',
    };

    toast({
      title: `${typeNames[order.type]} Triggered!`,
      description: `Order executed at $${triggeredPrice.toFixed(8)}`,
    });

    // Add to transactions (visual feedback)
    const baseSymbol = selectedPair.split('/')[0] || 'TOKEN';
    const newTransaction: Transaction = {
      id: `tx_${Date.now()}`,
      date: new Date().toISOString(),
      type: order.side,
      usd: order.amount * triggeredPrice,
      baseAmount: order.amount,
      price: triggeredPrice,
      maker: connected && publicKey ? publicKey.toString().slice(0, 8) : 'You',
      baseSymbol,
    };
    setTransactions(prev => [newTransaction, ...prev].slice(0, 100));

    // TODO: Execute actual swap via Jupiter when wallet is connected
    // if (connected && publicKey) {
    //   executeMarketOrder(...)
    // }
  }, [activeOrders, toast, connected, publicKey]);

  // Start monitoring when orders are added
  useEffect(() => {
    activeOrders.forEach(order => {
      const monitoredOrder: MonitoredOrder = {
        orderId: order.id,
        type: order.type,
        targetPrice: order.price,
        side: order.side,
        amount: order.amount,
        condition: order.type === 'limit'
          ? (order.side === 'buy' ? 'below' : 'above')
          : (order.type === 'stopLoss' ? 'below' : 'above'),
      };

      startOrderMonitor(
        monitoredOrder,
        getCurrentPriceRef.current,
        handleOrderTriggered
      );
    });

    // Cleanup all monitors when component unmounts or orders change
    return () => {
      stopAllOrderMonitors();
    };
  }, [activeOrders, handleOrderTriggered]);

  // Handle fullscreen
  const handleFullscreenClick = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Handle refresh
  const handleRefresh = useCallback(() => {
    toast({ title: 'Refreshing data...' });
    loadTokenData();
  }, [loadTokenData, toast]);

  // Extract symbols
  const quoteSymbol = currencyMode === 'usd' ? 'USD' : 'SOL';
  const baseSymbol = selectedPair.split('/')[0];

  // Show loading state
  if (checkingRiskAcknowledgment) {
    return (
      <div className={cn(
        "flex items-center justify-center h-screen",
        isDark ? "bg-[#0a0e17]" : "bg-gray-50"
      )}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p className={cn(isDark ? "text-gray-400" : "text-gray-600")}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex flex-col min-h-screen",
      isDark ? "bg-[#0a0a0a] text-gray-400" : "bg-gray-50 text-gray-600"
    )}>
      {/* Top Navigation Tabs */}
      <CryptoNavTabs />

      {/* Risk Warning Modal */}
      <MemeCoinRiskWarning
        isOpen={showRiskWarning && !hasAcknowledgedRisk}
        onAcknowledge={handleRiskAcknowledged}
        onClose={() => { window.location.href = '/'; }}
      />

      {/* Trading Agreement Modal */}
      <TradingAgreementModal
        isOpen={showTradingAgreement}
        onAgree={handleTradingAgreementAccepted}
        onCancel={() => {
          setShowTradingAgreement(false);
          setPendingOrder(null);
        }}
      />

      {/* Main Content */}
      <main className="flex-1 px-0 py-0 max-w-[1800px] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-0">

        {/* Left Column: Chart & Asset Info */}
        <div className="lg:col-span-9 xl:col-span-10 flex flex-col gap-0">



          {/* Asset Header Info */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pl-6">
            <div className="flex items-center gap-6">
              {/* Logo & Name */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-gray-300 text-sm font-normal shadow-sm border border-neutral-700 overflow-hidden">
                  {tokenInfo.logo ? (
                    <img src={tokenInfo.logo} alt={tokenInfo.symbol} className="w-full h-full object-cover" />
                  ) : (
                    tokenInfo.symbol?.charAt(0) || 'T'
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h1 className="text-sm font-semibold text-gray-100 tracking-tight">{tokenInfo.name || tokenInfo.symbol}</h1>
                    <span className="text-xs text-neutral-500 font-normal">{tokenInfo.symbol}</span>
                    {/* Copy Token Address Button */}
                    <button
                      onClick={() => {
                        if (selectedPair) {
                          navigator.clipboard.writeText(selectedPair);
                          toast({
                            title: "Copied!",
                            description: "Token address copied to clipboard",
                          });
                        }
                      }}
                      className="p-0.5 hover:bg-neutral-700 rounded transition-colors group"
                      title="Copy token address"
                    >
                      <svg className="w-3.5 h-3.5 text-neutral-500 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Market Cap Display - Smaller */}
              <div className="hidden sm:block">
                <div className="text-sm font-bold text-gray-100 tracking-tight">{tokenInfo.marketCap}</div>
              </div>
            </div>

            {/* Stats Row */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-8">
                <div>
                  <div className="text-[10px] uppercase font-semibold text-neutral-600 mb-0.5 tracking-wide">Price</div>
                  <div className="text-xs font-semibold text-gray-100 tracking-tight">
                    ${tokenInfo.price >= 1 ? tokenInfo.price.toFixed(2) : tokenInfo.price.toFixed(6)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-semibold text-neutral-600 mb-0.5 tracking-wide">Liquidity</div>
                  <div className="text-xs font-medium text-gray-100 font-mono tracking-tight">{tokenInfo.liquidity}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-semibold text-neutral-600 mb-0.5 tracking-wide">Supply</div>
                  <div className="text-xs font-medium text-gray-100 font-mono tracking-tight">
                    {tokenInfo.supply || '0'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-semibold text-neutral-600 mb-0.5 tracking-wide">Fees Paid</div>
                  <div className="text-xs font-medium text-gray-100 font-mono tracking-tight">
                    {tokenInfo.globalFeesPaid || '$0'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-semibold text-neutral-600 mb-0.5 tracking-wide">B.Curve</div>
                  <div className="text-xs font-medium text-emerald-400 font-mono tracking-tight">
                    {tokenInfo.bondingCurveProgress || 0}%
                  </div>
                </div>
              </div>

              {/* Alarm Icon */}
              <button
                onClick={() => setShowAlertModal(true)}
                className="p-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg transition-colors relative group"
                title="Set Alerts"
              >
                <svg className="w-4 h-4 text-neutral-400 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <Plus className="absolute -top-1 -right-1 w-2.5 h-2.5 text-emerald-400 bg-neutral-900 rounded-full" />
              </button>
            </div>
          </div>

          {/* Chart Container */}
          <div
            ref={chartContainerRef}
            className="p-5 bg-[#0a0a0a] flex flex-col min-h-[700px] relative"
          >
            {/* Chart Header - Removed ChartToolbar and OHLCDisplay per user request */}

            {/* Chart Visualization */}
            <div className="relative flex-1 w-full h-full">
              {loading && chartData.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-sm text-neutral-500">Loading {selectedPair} data...</p>
                  </div>
                </div>
              ) : error && chartData.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                    <p className="text-sm mb-4 text-neutral-500">{error}</p>
                    <Button onClick={handleRefresh} variant="outline" size="sm" className="border-neutral-800 hover:bg-neutral-800">
                      Retry
                    </Button>
                  </div>
                </div>
              ) : chartData.length > 0 ? (
                <TradingViewLightweightChart
                  key={`${selectedPair}-${selectedTimeframe.label}-${chartDisplayMode}`}
                  data={chartData}
                  symbol={selectedPair}
                  height={640}
                  showVolume={true}
                  showGrid={true}
                  theme={isDark ? 'dark' : 'light'}
                  realTimePrice={realTimePrice || undefined}
                  realtimeCandle={realtimeCandle}
                  displayMode={chartDisplayMode}
                  marketCap={tokenInfo.marketCap}
                  tokenPrice={tokenInfo.price}
                  orders={previewOrderLine ? [...activeOrders, previewOrderLine] : activeOrders}
                  onOrderDrag={handleOrderDrag}
                  onOrderCancel={handleOrderCancel}
                  onPriceUpdate={(price) => {
                    if (price && price !== realTimePrice) {
                      setRealTimePrice(price);
                    }
                  }}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <span className="text-neutral-500">Search for a token to view chart</span>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Tabs - Transactions */}
          <BottomTabs
            transactions={transactions}
            holdersCount={tokenInfo.holders || 0}
            theme={isDark ? 'dark' : 'light'}
            pairSymbol={selectedPair}
            tokenMint={tokenInfo.pairAddress || selectedTokenAddress}
            onRefresh={handleRefresh}
            orders={activeOrders.filter(o => !o.isPreview)}
            onCancelOrder={handleOrderCancel}
            tokenSymbol={tokenInfo.symbol}
            tokenLogo={tokenInfo.logo}
            currentMC={tokenInfo.marketCapRaw}
          />
        </div>

        {/* Right Column: Swap Panel */}
        <div className="lg:col-span-3 xl:col-span-2">
          <div className="bg-[#0a0a0a] p-4 sticky top-0 h-full border-l border-neutral-800">
            <TradingPanel
              pair={selectedPair}
              tokenSymbol={tokenInfo.symbol}
              tokenAddress={selectedTokenAddress}
              currentPrice={tokenInfo.price}
              tradingStats={tradingStats}
              onOrderSubmit={handleOrderSubmit}
              onLimitOrderChange={handleLimitOrderPreview}
              theme={isDark ? 'dark' : 'light'}
            />
          </div>
        </div>
      </main>

      {/* Token Alert Modal */}
      <TokenAlertModal
        isOpen={showAlertModal}
        onClose={() => setShowAlertModal(false)}
        tokenSymbol={tokenInfo.symbol}
        tokenMint={selectedPair}
        onOpenDiscord={() => {
          setShowAlertModal(false);
          setShowDiscordModal(true);
        }}
      />

      {/* Discord Webhook Modal */}
      <DiscordWebhookModal
        isOpen={showDiscordModal}
        onClose={() => setShowDiscordModal(false)}
      />
    </div>
  );
}
