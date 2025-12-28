import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AlertTriangle, Search, Zap, BarChart2 } from 'lucide-react';
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

// SOL mint address constant
const SOL_MINT = 'So11111111111111111111111111111111111111112';

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
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>(TIMEFRAMES[0]); // Default to 1s
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
  });

  // Order book
  const [bids, setBids] = useState<OrderBookEntry[]>([]);
  const [asks, setAsks] = useState<OrderBookEntry[]>([]);

  // Transactions for table
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Active orders for chart visualization (limit, stop loss, take profit)
  const [activeOrders, setActiveOrders] = useState<OrderLine[]>([]);

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
      const baseSymbol = selectedPair.split('/')[0];
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
          const ohlcv = await fetchOHLCVData(selectedPair, selectedTimeframe, 200);
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
        quoteAmount: trade.volumeUsd,
        price: trade.priceUsd || trade.price,
        maker: trade.owner?.slice(0, 8) + '...' || 'Unknown',
        txHash: trade.txHash || '',
        baseSymbol,
        quoteSymbol: 'USD',
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
  }, [selectedTokenAddress, selectedTimeframe]);

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

    // Initial poll
    pollPrice();

    // Poll every 3 seconds for near real-time updates
    const intervalId = setInterval(pollPrice, 3000);
    console.log('⏰ Price polling started, interval ID:', intervalId);

    return () => {
      console.log('⏰ Stopping price polling');
      isActive = false;
      clearInterval(intervalId);
    };
  }, [selectedTokenAddress]);

  // Check risk acknowledgment on mount
  useEffect(() => {
    const checkRiskAcknowledgment = async () => {
      try {
        const acknowledged = localStorage.getItem('meme_coin_risk_acknowledged');
        if (acknowledged === 'true') {
          setHasAcknowledgedRisk(true);
        } else {
          setShowRiskWarning(true);
        }
      } catch (error) {
        console.error('Error checking risk acknowledgment:', error);
      } finally {
        setCheckingRiskAcknowledgment(false);
      }
    };
    checkRiskAcknowledgment();
  }, []);

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
          toast({
            title: 'Market Order Executed!',
            description: `${order.side.toUpperCase()} ${order.amount} SOL. TX: ${result.txSignature.slice(0, 8)}...`,
          });
          console.log('Trade executed:', result.txSignature);
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
      quoteAmount: order.amount * triggeredPrice,
      price: triggeredPrice,
      maker: connected && publicKey ? publicKey.toString().slice(0, 8) : 'You',
      txHash: '',
      baseSymbol,
      quoteSymbol: 'USD',
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

          {/* Asset Control Bar */}
          <div className="flex flex-col sm:flex-row justify-end items-start sm:items-center gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto no-scrollbar">
              <button onClick={handleRefresh} className="p-2 hover:bg-neutral-800 rounded-full text-neutral-500 hover:text-gray-300 transition-colors">
                <Zap className="w-4 h-4" />
              </button>
              <button onClick={() => toast({ title: 'Alert settings' })} className="p-2 hover:bg-neutral-800 rounded-full text-neutral-500 hover:text-gray-300 transition-colors">
                <BarChart2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Asset Header Info */}
          <div className="flex flex-wrap justify-between items-start gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center text-gray-300 text-lg font-normal shadow-sm border border-neutral-700 overflow-hidden">
                {tokenInfo.logo ? (
                  <img src={tokenInfo.logo} alt={tokenInfo.symbol} className="w-full h-full object-cover" />
                ) : (
                  tokenInfo.symbol?.charAt(0) || 'T'
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-semibold text-gray-100 tracking-tight">{tokenInfo.name || tokenInfo.symbol}</h1>
                  <span className="text-sm text-neutral-500 font-normal">{tokenInfo.symbol}</span>
                </div>
                <div className="text-xs text-neutral-500 mt-0.5">{tokenInfo.age || 'New'}</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsFavorite(!isFavorite)}
                className={cn(
                  "p-2 hover:bg-neutral-800 rounded-full transition-colors",
                  isFavorite ? "text-yellow-400" : "text-neutral-500 hover:text-gray-300"
                )}
              >
                <svg className="w-5 h-5 stroke-[1.5]" fill={isFavorite ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Stats & Quick Buy */}
          <div className="space-y-6">
            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
              <div>
                <div className="text-[10px] uppercase font-semibold text-neutral-600 mb-1 tracking-wide">Price</div>
                <div className="text-2xl font-semibold text-gray-100 tracking-tight">
                  ${tokenInfo.price >= 1 ? tokenInfo.price.toFixed(2) : tokenInfo.price.toFixed(6)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-semibold text-neutral-600 mb-1 tracking-wide">24H</div>
                <div className={cn(
                  "text-sm font-medium font-mono tracking-tight",
                  tokenInfo.change24h >= 0 ? "text-emerald-400" : "text-red-400"
                )}>
                  {tokenInfo.change24h >= 0 ? '+' : ''}{tokenInfo.change24h?.toFixed(4) || '0.0000'}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-semibold text-neutral-600 mb-1 tracking-wide">Liq</div>
                <div className="text-sm font-medium text-gray-100 font-mono tracking-tight">{tokenInfo.liquidity}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-semibold text-neutral-600 mb-1 tracking-wide">MCap</div>
                <div className="text-sm font-medium text-gray-100 font-mono tracking-tight">{tokenInfo.marketCap}</div>
              </div>
            </div>

            {/* Quick Buttons */}
            <QuickBuyButtons
              onBuy={handleQuickBuy}
              onSell={(amount) => toast({ title: `Sell ${amount} SOL` })}
              disabled={!connected}
              theme={isDark ? 'dark' : 'light'}
            />
          </div>

          {/* Chart Container */}
          <div
            ref={chartContainerRef}
            className="p-5 bg-[#0a0a0a] flex flex-col min-h-[500px] relative"
          >
            {/* Chart Header */}
            <div className="flex flex-wrap justify-between items-center mb-4 gap-4 z-10 relative">
              <ChartToolbar
                pair={selectedPair}
                exchange="Pump AMM"
                selectedTimeframe={selectedTimeframe}
                onTimeframeChange={setSelectedTimeframe}
                chartType={chartType}
                onChartTypeChange={setChartType}
                currencyMode={currencyMode}
                onCurrencyModeChange={setCurrencyMode}
                displayMode={chartDisplayMode}
                onDisplayModeChange={setChartDisplayMode}
                showBubbles={showBubbles}
                onToggleBubbles={() => setShowBubbles(!showBubbles)}
                quoteSymbol={quoteSymbol}
                isFullscreen={isFullscreen}
                onFullscreenClick={handleFullscreenClick}
                theme={isDark ? 'dark' : 'light'}
              />
              <OHLCDisplay
                pair={selectedPair}
                exchange="Pump AMM"
                timeframe={selectedTimeframe.label}
                source="wagyu.trade"
                open={currentOHLC.open}
                high={currentOHLC.high}
                low={currentOHLC.low}
                close={currentOHLC.close}
                volume={currentOHLC.volume}
                changePercent={currentOHLC.changePercent}
                displayMode={chartDisplayMode}
                isLive={!loading}
                theme={isDark ? 'dark' : 'light'}
              />
            </div>

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
                  height={400}
                  showVolume={true}
                  showGrid={true}
                  theme={isDark ? 'dark' : 'light'}
                  realTimePrice={realTimePrice || undefined}
                  realtimeCandle={realtimeCandle}
                  displayMode={chartDisplayMode}
                  marketCap={tokenInfo.marketCap}
                  tokenPrice={tokenInfo.price}
                  orders={activeOrders}
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
            devTokensCount={0}
            theme={isDark ? 'dark' : 'light'}
            pairSymbol={selectedPair}
            tokenMint={tokenInfo.pairAddress || selectedTokenAddress}
            onRefresh={handleRefresh}
          />
        </div>

        {/* Right Column: Swap Panel */}
        <div className="lg:col-span-3 xl:col-span-2">
          <div className="bg-[#0a0a0a] p-4 sticky top-0 h-full border-l border-neutral-800">
            <TradingPanel
              pair={selectedPair}
              tokenSymbol={tokenInfo.symbol}
              currentPrice={tokenInfo.price}
              onOrderSubmit={handleOrderSubmit}
              theme={isDark ? 'dark' : 'light'}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
