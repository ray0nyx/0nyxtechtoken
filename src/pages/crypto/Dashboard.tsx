import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  User,
  Search,
  X
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MetricCard from '@/components/crypto/ui/MetricCard';
import TraderRow from '@/components/crypto/ui/TraderRow';
import CustomPriceChart from '@/components/crypto/CustomPriceChart';
import TradingPanel, { type TradingOrder } from '@/components/crypto/TradingPanel';
import TimeframeSelector, { TIMEFRAMES, type Timeframe } from '@/components/crypto/TimeframeSelector';
import { createClient } from '@/lib/supabase/client';
import { fetchAggregatedCryptoData, type AggregatedCryptoStats } from '@/lib/crypto-aggregation-service';
import { useTheme } from '@/components/ThemeProvider';
import { cn } from '@/lib/utils';
import { marketDataService } from '@/lib/services/marketDataService';
import { fetchSolanaNetworkMetrics } from '@/lib/solana-onchain';
import { fetchBitcoinOnChainMetrics } from '@/lib/bitcoin-onchain';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { searchTokens, fetchOHLCVData, type DexSearchResult } from '@/lib/dex-screener-service';
import { getRealTimePrice, subscribeToPriceUpdates } from '@/lib/realtime-price-service';
import { executeMarketOrder, createLimitOrder, createStopLossOrder, createTakeProfitOrder } from '@/lib/trading-order-service';
import { useTradingWebSocket, connectTradingWebSocket } from '@/lib/trading-websocket';
import { useTradingStore } from '@/stores/useTradingStore';
import RealtimeDataSync from '@/components/crypto/RealtimeDataSync';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface TopTrader {
  id: string;
  name: string;
  blockchain: 'SOL' | 'BTC' | 'ETH';
  performance: number;
  sparklineData: number[];
}

interface OnChainMetric {
  label: string;
  value: string;
  change?: number;
  badge?: string;
  badgeColor?: string;
}

export default function CryptoDashboard() {
  const navigate = useNavigate();
  const supabase = createClient();
  const { theme } = useTheme();
  const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const { publicKey, connected, signTransaction } = useWallet();
  const { connection } = useConnection();

  const [timePeriod, setTimePeriod] = useState<'24h' | '7d' | '30d'>('30d');
  const [isLoading, setIsLoading] = useState(true);
  const [cryptoStats, setCryptoStats] = useState<AggregatedCryptoStats | null>(null);
  const [topTraders, setTopTraders] = useState<TopTrader[]>([]);
  const [portfolioData, setPortfolioData] = useState<{ date: string; value: number }[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [chartLoading, setChartLoading] = useState<boolean>(false);
  const [solMetrics, setSolMetrics] = useState<OnChainMetric[]>([]);
  const [btcMetrics, setBtcMetrics] = useState<OnChainMetric[]>([]);
  const [transactionData, setTransactionData] = useState<{ date: string; value: number }[]>([]);

  // Search and chart state
  const [selectedCoin, setSelectedCoin] = useState<string>('SOL/USDC');
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>(TIMEFRAMES[5]); // Default to 1D
  const [realTimePrice, setRealTimePrice] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<DexSearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get real-time data from store (updated via WebSocket from backend)
  const tokenAddress = useTradingStore((state) => state.tokenAddress);
  const storeCandles = useTradingStore((state) => state.candles);
  const currentCandle = useTradingStore((state) => state.currentCandle);
  const storePrice = useTradingStore((state) => state.currentPrice);
  const storeMarketCap = useTradingStore((state) => state.marketCap);

  // Update realTimePrice from store (backend updates come through WebSocket)
  useEffect(() => {
    if (storePrice > 0) {
      setRealTimePrice(storePrice);
    }
  }, [storePrice]);


  useEffect(() => {
    // Suppress Solana wallet extension errors
    const originalError = window.console.error;
    window.console.error = (...args: any[]) => {
      if (args[0]?.includes?.('solanaActionsContentScript') ||
        args[0]?.includes?.('WalletConnectionError') ||
        args[0]?.includes?.('StandardWalletAdapter')) {
        // Silently ignore Solana wallet extension errors
        return;
      }
      originalError.apply(window.console, args);
    };

    loadData();

    return () => {
      window.console.error = originalError;
    };
  }, [timePeriod]);

  // Connect to real-time WebSocket for backend updates
  useEffect(() => {
    connectTradingWebSocket();

    return () => {
      // WebSocket connection is managed globally, don't disconnect on unmount
    };
  }, []);

  // Get WebSocket status
  const wsStatus = useTradingStore((state) => state.wsStatus);

  // Update realTimePrice from store (backend updates come through WebSocket)
  useEffect(() => {
    if (storePrice > 0) {
      setRealTimePrice(storePrice);
    }
  }, [storePrice]);

  // Real-time price updates (fallback to HTTP polling if WebSocket not available)
  useEffect(() => {
    if (!selectedCoin) return;

    // If WebSocket is connected, it will handle updates
    // Otherwise, fall back to HTTP polling
    if (wsStatus !== 'connected') {
      // Initial price fetch
      getRealTimePrice(selectedCoin).then(update => {
        if (update) {
          setRealTimePrice(update.price);
        }
      });

      // Subscribe to price updates (polling every 3 seconds)
      const cleanup = subscribeToPriceUpdates(
        [selectedCoin],
        (updates) => {
          const update = updates.get(selectedCoin);
          if (update) {
            setRealTimePrice(update.price);
          }
        }
        // Uses default 3 second interval
      );

      return cleanup;
    }
  }, [selectedCoin, wsStatus]);

  // Use WebSocket candles when available (real-time updates from backend)
  useEffect(() => {
    if (storeCandles.length > 0 && tokenAddress) {
      // Transform store candles to chart format
      const transformedData = storeCandles.map(candle => ({
        time: candle.time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume || 0,
      }));

      // Add current candle if exists (real-time update)
      if (currentCandle) {
        transformedData.push({
          time: currentCandle.time,
          open: currentCandle.open,
          high: currentCandle.high,
          low: currentCandle.low,
          close: currentCandle.close,
          volume: currentCandle.volume || 0,
        });
      }

      setChartData(transformedData);
      setChartLoading(false);
    }
  }, [storeCandles, currentCandle, tokenAddress]);

  // Load chart data when selectedCoin or timeframe changes (fallback/initial load)
  useEffect(() => {
    if (!selectedCoin) return;

    // Skip if we already have WebSocket data
    if (storeCandles.length > 0 && tokenAddress) {
      return;
    }

    const loadChartData = async (isInitial = false) => {
      if (isInitial) {
        setChartLoading(true);
      }
      try {
        const ohlcvData = await fetchOHLCVData(selectedCoin, selectedTimeframe, 100);

        if (ohlcvData && ohlcvData.length > 0) {
          // Transform to format expected by TradingViewLightweightChart
          const transformedData = ohlcvData
            .map(candle => {
              // Convert time to Unix timestamp in seconds
              let unixTimestamp: number;
              if (typeof candle.time === 'string') {
                const date = new Date(candle.time);
                unixTimestamp = Math.floor(date.getTime() / 1000);
              } else if (typeof candle.time === 'number') {
                // If already in seconds, use as is; if in ms, convert to seconds
                unixTimestamp = candle.time > 1e12 ? Math.floor(candle.time / 1000) : candle.time;
              } else {
                return null;
              }

              const open = parseFloat(candle.open?.toString() || '0') || 0;
              const high = parseFloat(candle.high?.toString() || '0') || 0;
              const low = parseFloat(candle.low?.toString() || '0') || 0;
              const close = parseFloat(candle.close?.toString() || '0') || 0;
              const volume = parseFloat(candle.volume?.toString() || '0') || 0;

              // Validate OHLC values
              const validHigh = Math.max(high, open, close, low);
              const validLow = Math.min(low, open, close, high);

              // Skip if all values are zero
              if (open === 0 && high === 0 && low === 0 && close === 0) {
                return null;
              }

              return {
                time: unixTimestamp,
                open: open,
                high: validHigh,
                low: validLow,
                close: close,
                volume: volume,
              };
            })
            .filter((candle): candle is { time: number; open: number; high: number; low: number; close: number; volume: number } => candle !== null)
            .sort((a, b) => a.time - b.time);

          setChartData(transformedData);
        } else {
          if (isInitial) {
            setChartData([]);
          }
        }
      } catch (error) {
        console.error('Error loading chart data:', error);
        if (isInitial) {
          setChartData([]);
        }
      } finally {
        if (isInitial) {
          setChartLoading(false);
        }
      }
    };

    // Initial load
    loadChartData(true);

    // Set up real-time refresh based on timeframe
    // Shorter timeframes need more frequent updates
    const getRefreshInterval = (timeframe: Timeframe) => {
      if (timeframe.unit === 'minute') {
        // For minute charts, refresh every 30 seconds for short timeframes, 1 minute for longer
        return timeframe.value <= 5 ? 30000 : 60000;
      } else if (timeframe.unit === 'hour') {
        // For hour charts, refresh every 2 minutes
        return 120000;
      } else if (timeframe.unit === 'day') {
        // For daily charts, refresh every 5 minutes
        return 300000;
      } else if (timeframe.unit === 'month') {
        // For monthly charts, refresh every 10 minutes
        return 600000;
      }
      return 60000; // Default: 1 minute
    };

    const refreshInterval = getRefreshInterval(selectedTimeframe);
    const intervalId = setInterval(() => {
      loadChartData(false); // Silent refresh
    }, refreshInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [selectedCoin, selectedTimeframe]);

  // Handle order submission
  const handleOrderSubmit = async (order: TradingOrder) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const walletAddress = publicKey?.toString();

      if (order.orderType === 'market') {
        if (!connected || !walletAddress || !signTransaction) {
          throw new Error('Wallet must be connected for on-chain orders');
        }
        await executeMarketOrder(
          order,
          user.id,
          walletAddress,
          connection
        );
      } else if (order.orderType === 'limit') {
        await createLimitOrder(order, user.id, walletAddress);
      } else if (order.orderType === 'advanced') {
        // Advanced orders include stop loss and take profit
        if (order.stopLossPercent) {
          await createStopLossOrder(order, user.id, walletAddress);
        }
        if (order.takeProfitPercent) {
          await createTakeProfitOrder(order, user.id, walletAddress);
        }
      }
    } catch (error: any) {
      throw error;
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Fetch aggregated crypto stats
      let stats: AggregatedCryptoStats | null = null;
      try {
        stats = await fetchAggregatedCryptoData(user.id);
        setCryptoStats(stats);
      } catch (error) {
        console.error('Error fetching crypto stats:', error);
        // Set default stats if fetch fails
        stats = {
          totalValue: 0,
          totalPnL: 0,
          totalTrades: 0,
          winRate: 0,
          avgTradeSize: 0,
          recentTrades: [],
          pnlHistory: [],
          equityCurve: [],
        };
        setCryptoStats(stats);
      }

      // Use real portfolio chart data from equity curve
      if (stats && stats.equityCurve && stats.equityCurve.length > 0) {
        // Filter equity curve based on time period
        const days = timePeriod === '24h' ? 1 : timePeriod === '7d' ? 7 : 30;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const filteredEquity = stats.equityCurve.filter(point => {
          const pointDate = new Date(point.date);
          return pointDate >= cutoffDate;
        });

        // If we have data, use it; otherwise generate from available data
        if (filteredEquity.length > 0) {
          setPortfolioData(filteredEquity.map(point => ({
            date: point.date,
            value: point.equity
          })));
        } else {
          // Use all available equity curve data
          setPortfolioData(stats.equityCurve.map(point => ({
            date: point.date,
            value: point.equity
          })));
        }
      } else {
        // No equity curve data, create empty array
        setPortfolioData([]);
      }

      // Fetch top traders from leaderboard
      try {
        const { data: traders, error } = await supabase
          .from('copy_trading_leaderboard')
          .select('*')
          .order('roi', { ascending: false })
          .limit(3);

        if (error) {
          console.error('Error fetching traders:', error);
        } else if (traders && traders.length > 0) {
          // Fetch performance history for sparklines
          const tradersWithSparklines = await Promise.all(
            traders.map(async (t) => {
              // Try to get performance history from pnl_30d, pnl_7d, pnl_24h if available
              // Otherwise generate from ROI trend
              let sparklineData: number[] = [];

              // If we have historical performance data, use it
              if (t.pnl_30d !== undefined && t.pnl_7d !== undefined && t.pnl_24h !== undefined) {
                // Create a simple trend from available data points
                const baseRoi = t.roi || 0;
                sparklineData = [
                  baseRoi * 0.7, // 30 days ago
                  baseRoi * 0.85, // 15 days ago
                  baseRoi * 0.92, // 7 days ago
                  baseRoi * 0.96, // 3 days ago
                  baseRoi // current
                ];
              } else {
                // Generate a simple trend based on ROI
                const baseRoi = t.roi || 0;
                sparklineData = Array.from({ length: 10 }, (_, i) =>
                  baseRoi * (0.6 + (i / 10) * 0.4) // Gradual increase trend
                );
              }

              return {
                id: t.id,
                name: t.wallet_address ? `${t.wallet_address.slice(0, 4)}...${t.wallet_address.slice(-4)}` : `Trader${t.id?.slice(-4) || 'Alpha'}`,
                blockchain: (t.wallet_address?.startsWith('0x') ? 'ETH' : 'SOL') as 'SOL' | 'BTC' | 'ETH',
                performance: t.roi || 0,
                sparklineData,
              };
            })
          );
          setTopTraders(tradersWithSparklines);
        } else {
          setTopTraders([]);
        }
      } catch (error) {
        console.error('Error loading traders:', error);
      }

      // Removed DexScreener chart functionality - keeping only SOL on-chain metrics

      // Fetch real transaction data from dex_trades and trades tables
      try {
        const days = 30;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        // Fetch DEX trades
        const { data: dexTrades } = await supabase
          .from('dex_trades')
          .select('timestamp, amount_in')
          .eq('user_id', user.id)
          .gte('timestamp', cutoffDate.toISOString())
          .order('timestamp', { ascending: true });

        // Fetch CEX trades
        const { data: cexTrades } = await supabase
          .from('trades')
          .select('created_at, quantity, entry_price')
          .eq('user_id', user.id)
          .gte('created_at', cutoffDate.toISOString())
          .order('created_at', { ascending: true });

        // Group transactions by date
        const txByDate = new Map<string, number>();

        // Process DEX trades
        (dexTrades || []).forEach((trade: any) => {
          const date = new Date(trade.timestamp).toISOString().split('T')[0];
          const value = parseFloat(trade.amount_in || 0);
          txByDate.set(date, (txByDate.get(date) || 0) + value);
        });

        // Process CEX trades
        (cexTrades || []).forEach((trade: any) => {
          const date = new Date(trade.created_at).toISOString().split('T')[0];
          const value = parseFloat(trade.quantity || 0) * parseFloat(trade.entry_price || 0);
          txByDate.set(date, (txByDate.get(date) || 0) + value);
        });

        // Generate array for last 30 days
        const txData = [];
        for (let i = days; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          txData.push({
            date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            value: txByDate.get(dateStr) || 0,
          });
        }
        setTransactionData(txData);
      } catch (error) {
        console.error('Error fetching transaction data:', error);
        setTransactionData([]);
      }

      // Fetch real Solana on-chain metrics
      try {
        const solData = await fetchSolanaNetworkMetrics();
        // Calculate TPS change (compare current to 24h average)
        const tpsChange = solData.tps24h ? ((solData.tps - solData.tps24h) / solData.tps24h) * 100 : 0;

        setSolMetrics([
          {
            label: 'Network TPS',
            value: solData.tps?.toLocaleString() || '0',
            change: tpsChange,
            badge: 'Realtime',
            badgeColor: 'green'
          },
          {
            label: 'Active Validators',
            value: solData.activeValidators?.toLocaleString() || '0',
            change: 0,
            badge: 'Network',
            badgeColor: 'blue'
          },
        ]);
      } catch (error) {
        console.error('Error fetching Solana metrics:', error);
        setSolMetrics([]);
      }

      // Fetch real Bitcoin on-chain metrics
      try {
        const btcData = await fetchBitcoinOnChainMetrics();
        // Find specific metrics from the metrics array
        const hashRateMetric = btcData.metrics?.find(m => m.name?.toLowerCase().includes('hash'));
        const mempoolMetric = btcData.metrics?.find(m => m.name?.toLowerCase().includes('mempool'));
        const activeAddressesMetric = btcData.metrics?.find(m => m.name?.toLowerCase().includes('active'));
        const transactionMetric = btcData.metrics?.find(m => m.name?.toLowerCase().includes('transaction'));

        const metrics: OnChainMetric[] = [];

        if (hashRateMetric) {
          metrics.push({
            label: 'Hash Rate',
            value: typeof hashRateMetric.value === 'string' ? hashRateMetric.value : `${hashRateMetric.value}`,
            change: hashRateMetric.change24h,
            badge: 'Bitcoin',
            badgeColor: 'orange'
          });
        }

        if (mempoolMetric) {
          metrics.push({
            label: 'Mempool Size',
            value: typeof mempoolMetric.value === 'string' ? mempoolMetric.value : `${mempoolMetric.value}`,
            badge: 'Basepool',
            badgeColor: 'blue'
          });
        }

        if (activeAddressesMetric) {
          metrics.push({
            label: 'Active Addresses',
            value: typeof activeAddressesMetric.value === 'string' ? activeAddressesMetric.value : activeAddressesMetric.value.toLocaleString(),
            change: activeAddressesMetric.change24h,
            badge: 'Mainnet',
            badgeColor: 'green'
          });
        }

        if (transactionMetric) {
          metrics.push({
            label: 'Transaction Volume',
            value: typeof transactionMetric.value === 'string' ? transactionMetric.value : `$${transactionMetric.value}`,
            change: transactionMetric.change24h,
            badge: '24h',
            badgeColor: transactionMetric.change24h && transactionMetric.change24h >= 0 ? 'green' : 'red'
          });
        }

        // If no metrics found, use network hash rate directly
        if (metrics.length === 0 && btcData.networkHashRate) {
          metrics.push({
            label: 'Hash Rate',
            value: `${(btcData.networkHashRate / 1e18).toFixed(2)} EH/s`,
            badge: 'Bitcoin',
            badgeColor: 'orange'
          });
        }

        setBtcMetrics(metrics);
      } catch (error) {
        console.error('Error fetching Bitcoin metrics:', error);
        setBtcMetrics([]);
      }

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      // Set default values on error to prevent blank page
      if (!cryptoStats) {
        setCryptoStats({
          totalValue: 0,
          totalPnL: 0,
          totalTrades: 0,
          winRate: 0,
          avgTradeSize: 0,
          recentTrades: [],
          pnlHistory: [],
          equityCurve: [],
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const handleCopyTrader = (traderId: string) => {
    navigate(`/crypto/copy-trading?trader=${traderId}`);
  };

  // Search handlers
  const handleSearch = async (query: string) => {
    if (!query || query.trim().length === 0) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchTokens(query);
      setSearchResults(results);
      setShowSearchResults(true);
    } catch (error) {
      console.error('Error searching tokens:', error);
      setSearchResults([]);
      setShowSearchResults(false);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchInputChange = (value: string) => {
    setSearchQuery(value);

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce search (500ms)
    if (value.trim().length > 0) {
      searchTimeoutRef.current = setTimeout(() => {
        handleSearch(value);
      }, 500);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };

  const handleSelectCoin = (result: DexSearchResult) => {
    setSelectedCoin(result.symbol);
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
  };

  // Close search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.search-container')) {
        setShowSearchResults(false);
      }
    };

    if (showSearchResults) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showSearchResults]);

  // Cleanup search timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  if (isLoading && !cryptoStats) {
    return (
      <div className="p-6">
        <div className={cn(
          "text-xl font-semibold mb-4",
          isDark ? "text-white" : "text-gray-900"
        )}>Crypto Dashboard</div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={cn(
              "rounded-xl border p-6 h-64 animate-pulse",
              isDark ? "bg-[#0a0a0a] border-[#1f2937]" : "bg-white border-gray-200"
            )}>
              <div className={cn(
                "h-4 w-32 rounded mb-4",
                isDark ? "bg-[#374151]" : "bg-gray-200"
              )}></div>
              <div className={cn(
                "h-8 w-24 rounded",
                isDark ? "bg-[#374151]" : "bg-gray-200"
              )}></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Real-time Data Sync Component - Ensures backend changes reflect in UI */}
      <RealtimeDataSync
        tokenAddress={tokenAddress}
        timeframes={['1m', '5m', '15m', '1h']}
      />

      {/* Top Row - Portfolio & Copy Trading */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Portfolio Value Card */}
        <div className={cn(
          "rounded-xl border p-5",
          isDark ? "bg-[#0a0a0a] border-[#1f2937]" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={cn(
              "text-lg font-semibold",
              isDark ? "text-white" : "text-gray-900"
            )}>Portfolio Value</h3>
            <Select value={timePeriod} onValueChange={(v: any) => setTimePeriod(v)}>
              <SelectTrigger className={cn(
                "w-[140px]",
                isDark ? "bg-[#0f1419] border-[#374151] text-[#9ca3af]" : "bg-gray-50 border-gray-300 text-gray-700"
              )}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={cn(
                isDark ? "bg-[#0a0a0a] border-[#374151]" : "bg-white border-gray-200"
              )}>
                <SelectItem value="24h">24h balance</SelectItem>
                <SelectItem value="7d">7 day balance</SelectItem>
                <SelectItem value="30d">30 day balance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mb-4">
            <div className={cn(
              "text-3xl font-bold",
              isDark ? "text-white" : "text-gray-900"
            )}>
              {formatCurrency(cryptoStats?.totalValue || 0)}
              <span className={cn(
                "text-lg ml-1",
                isDark ? "text-[#6b7280]" : "text-gray-500"
              )}>USD</span>
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#8b5cf6]" />
                <span className={isDark ? "text-[#9ca3af]" : "text-gray-600"}>
                  SOL Wallet: {formatCurrency((cryptoStats?.totalValue || 0) * 0.6)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#f59e0b]" />
                <span className={isDark ? "text-[#9ca3af]" : "text-gray-600"}>
                  BTC Wallet: {formatCurrency((cryptoStats?.totalValue || 0) * 0.4)}
                </span>
              </div>
            </div>
          </div>

          {/* Portfolio Chart */}
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={portfolioData}>
                <defs>
                  <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  tickFormatter={(v) => {
                    const d = new Date(v);
                    return `${d.getDate()}d`;
                  }}
                />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#1a1f2e' : '#ffffff',
                    border: isDark ? '1px solid #374151' : '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
                  labelStyle={{ color: isDark ? '#9ca3af' : '#6b7280' }}
                  formatter={(value: number) => [formatCurrency(value), 'Value']}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#10b981"
                  fill="url(#portfolioGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Copy Trading Card */}
        <div className={cn(
          "rounded-xl border p-5",
          isDark ? "bg-[#0a0a0a] border-[#1f2937]" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={cn(
              "text-lg font-semibold",
              isDark ? "text-white" : "text-gray-900"
            )}>Copy Trading</h3>
            <Select defaultValue="30d">
              <SelectTrigger className={cn(
                "w-[130px]",
                isDark ? "bg-[#0f1419] border-[#374151] text-[#9ca3af]" : "bg-gray-50 border-gray-300 text-gray-700"
              )}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={cn(
                isDark ? "bg-[#0a0a0a] border-[#374151]" : "bg-white border-gray-200"
              )}>
                <SelectItem value="24h">24h price</SelectItem>
                <SelectItem value="7d">7 day price</SelectItem>
                <SelectItem value="30d">30 day price</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 text-sm text-[#6b7280] mb-3 px-2">
            <span>Top trader</span>
            <span className="text-right">Change</span>
          </div>

          <div className="space-y-2">
            {topTraders.length > 0 ? (
              topTraders.map((trader) => (
                <TraderRow
                  key={trader.id}
                  name={trader.name}
                  blockchain={trader.blockchain}
                  performance={trader.performance}
                  sparklineData={trader.sparklineData}
                  onCopy={() => handleCopyTrader(trader.id)}
                  compact
                />
              ))
            ) : (
              <div className={cn(
                "text-center py-8",
                isDark ? "text-[#6b7280]" : "text-gray-500"
              )}>
                <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No traders available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row - SOL On-Chain & BTC On-Chain */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SOL On-Chain Analysis */}
        <div className={cn(
          "rounded-xl border p-5",
          isDark ? "bg-[#0a0a0a] border-[#1f2937]" : "bg-white border-gray-200"
        )}>
          <div className={cn(
            "p-4 border-b",
            isDark ? "border-[#1f2937]" : "border-gray-200"
          )}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-[#8b5cf6]">
                SOL On-Chain & Coins
              </h3>
            </div>

            {/* Search Input */}
            <div className="relative search-container">
              <div className="relative">
                <Search className={cn(
                  "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4",
                  isDark ? "text-[#6b7280]" : "text-gray-400"
                )} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchInputChange(e.target.value)}
                  onFocus={() => {
                    if (searchResults.length > 0) {
                      setShowSearchResults(true);
                    }
                  }}
                  placeholder="Search coins (e.g., SOL, BONK, USDC)"
                  className={cn(
                    "w-full pl-10 pr-8 py-2 rounded-lg text-sm",
                    isDark
                      ? "bg-[#0f1419] border-[#374151] text-white placeholder:text-[#6b7280]"
                      : "bg-gray-50 border-gray-300 text-gray-900 placeholder:text-gray-500"
                  )}
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                      setShowSearchResults(false);
                    }}
                    className={cn(
                      "absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4",
                      isDark ? "text-[#6b7280] hover:text-white" : "text-gray-400 hover:text-gray-600"
                    )}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Search Results Dropdown */}
              {showSearchResults && (
                <div className={cn(
                  "absolute top-full left-0 right-0 mt-1 rounded-lg border shadow-lg z-50 max-h-64 overflow-y-auto",
                  isDark
                    ? "bg-[#0a0a0a] border-[#374151]"
                    : "bg-white border-gray-200"
                )}>
                  {isSearching ? (
                    <div className={cn(
                      "p-4 text-center text-sm",
                      isDark ? "text-[#9ca3af]" : "text-gray-600"
                    )}>
                      Searching...
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className={cn(
                      "p-4 text-center text-sm",
                      isDark ? "text-[#9ca3af]" : "text-gray-600"
                    )}>
                      No results found
                    </div>
                  ) : (
                    searchResults.map((result, index) => (
                      <button
                        key={index}
                        onClick={() => handleSelectCoin(result)}
                        className={cn(
                          "w-full px-4 py-3 text-left hover:bg-opacity-50 transition-colors border-b last:border-b-0",
                          isDark
                            ? "hover:bg-[#0f1419] border-[#1f2937]"
                            : "hover:bg-gray-50 border-gray-200"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className={cn(
                              "font-semibold text-sm",
                              isDark ? "text-white" : "text-gray-900"
                            )}>
                              {result.symbol}
                            </div>
                            <div className={cn(
                              "text-xs mt-1",
                              isDark ? "text-[#9ca3af]" : "text-gray-600"
                            )}>
                              {result.baseToken.name} / {result.quoteToken.name}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={cn(
                              "text-sm font-medium",
                              isDark ? "text-white" : "text-gray-900"
                            )}>
                              ${result.priceUsd > 0 ? result.priceUsd.toFixed(6) : 'N/A'}
                            </div>
                            <div className={cn(
                              "text-xs mt-1",
                              result.change24h >= 0 ? "text-[#10b981]" : "text-[#ef4444]"
                            )}>
                              {result.change24h >= 0 ? '+' : ''}{result.change24h.toFixed(2)}%
                            </div>
                            <div className={cn(
                              "text-xs mt-1",
                              isDark ? "text-[#6b7280]" : "text-gray-500"
                            )}>
                              Vol: {formatNumber(result.volume24h)}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Chart */}
          <div className="p-4 relative" style={{ minHeight: '250px' }}>
            {/* Timeframe Selector */}
            <div className="mb-3 flex items-center justify-between">
              <TimeframeSelector
                selectedTimeframe={selectedTimeframe}
                onTimeframeChange={setSelectedTimeframe}
                variant="buttons"
              />
            </div>

            {chartLoading ? (
              <div className={cn(
                "h-[250px] flex items-center justify-center rounded-lg",
                isDark ? "bg-[#0f1419]" : "bg-gray-50"
              )}>
                <div className={cn(
                  "text-sm",
                  isDark ? "text-[#9ca3af]" : "text-gray-600"
                )}>
                  Loading chart data...
                </div>
              </div>
            ) : chartData.length === 0 ? (
              <div className={cn(
                "h-[250px] flex items-center justify-center rounded-lg",
                isDark ? "bg-[#0f1419]" : "bg-gray-50"
              )}>
                <div className={cn(
                  "text-sm text-center",
                  isDark ? "text-[#9ca3af]" : "text-gray-600"
                )}>
                  <div>No chart data available for {selectedCoin}</div>
                  <div className="text-xs mt-2 opacity-75">Try searching for a different coin</div>
                </div>
              </div>
            ) : (
              <div className="w-full" style={{ height: '250px', minHeight: '250px', position: 'relative' }}>
                <CustomPriceChart
                  key={selectedCoin} // Force re-render when symbol changes
                  data={chartData}
                  symbol={selectedCoin}
                  height={250}
                  showVolume={true}
                  theme={isDark ? 'dark' : 'light'}
                  realTimePrice={realTimePrice || storePrice || undefined}
                />
              </div>
            )}
          </div>

          {/* Trading Panel */}
          <div className="mt-4">
            <TradingPanel
              pair={selectedCoin}
              currentPrice={realTimePrice || undefined}
              onOrderSubmit={handleOrderSubmit}
            />
          </div>

          {/* SOL Network Stats */}
          <div className={cn(
            "grid grid-cols-2 gap-4 p-4 border-t",
            isDark ? "border-[#1f2937]" : "border-gray-200"
          )}>
            {solMetrics.map((metric, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-sm",
                    isDark ? "text-[#9ca3af]" : "text-gray-600"
                  )}>{metric.label}</span>
                  {metric.badge && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${metric.badgeColor === 'green' ? 'bg-[#10b981]/20 text-[#10b981]' :
                        metric.badgeColor === 'red' ? 'bg-[#ef4444]/20 text-[#ef4444]' :
                          'bg-[#3b82f6]/20 text-[#3b82f6]'
                      }`}>
                      {metric.badge}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-xl font-bold",
                    isDark ? "text-white" : "text-gray-900"
                  )}>{metric.value}</span>
                  {metric.change !== undefined && (
                    <span className={`text-sm ${metric.change >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                      {metric.change >= 0 ? '+' : ''}{metric.change.toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Daily Transactions Chart */}
          <div className={cn(
            "p-4 border-t",
            isDark ? "border-[#1f2937]" : "border-gray-200"
          )}>
            <div className={cn(
              "text-sm mb-2",
              isDark ? "text-[#9ca3af]" : "text-gray-600"
            )}>Daily Transactions</div>
            <div className="h-[100px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={transactionData}>
                  <defs>
                    <linearGradient id="txGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6b7280', fontSize: 9 }}
                  />
                  <YAxis hide />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#3b82f6"
                    fill="url(#txGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* BTC On-Chain Analysis */}
        <div className={cn(
          "rounded-xl border p-5",
          isDark ? "bg-[#0a0a0a] border-[#1f2937]" : "bg-white border-gray-200"
        )}>
          <h3 className={cn(
            "text-lg font-semibold mb-4",
            isDark ? "text-white" : "text-gray-900"
          )}>
            <span className="text-[#f59e0b]">BTC</span> On-Chain Analysis
          </h3>

          <div className="space-y-4">
            {btcMetrics.map((metric, i) => (
              <div key={i} className={cn(
                "flex items-center justify-between p-3 rounded-lg",
                isDark ? "bg-[#0f1419]" : "bg-gray-50"
              )}>
                <div>
                  <div className={cn(
                    "text-sm",
                    isDark ? "text-[#9ca3af]" : "text-gray-600"
                  )}>{metric.label}</div>
                  <div className={cn(
                    "text-lg font-bold",
                    isDark ? "text-white" : "text-gray-900"
                  )}>{metric.value}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {metric.badge && (
                    <span className={`text-xs px-2 py-0.5 rounded ${metric.badgeColor === 'green' ? 'bg-[#10b981]/20 text-[#10b981]' :
                        metric.badgeColor === 'red' ? 'bg-[#ef4444]/20 text-[#ef4444]' :
                          metric.badgeColor === 'orange' ? 'bg-[#f59e0b]/20 text-[#f59e0b]' :
                            'bg-[#3b82f6]/20 text-[#3b82f6]'
                      }`}>
                      {metric.badge}
                    </span>
                  )}
                  {metric.change !== undefined && (
                    <span className={`text-sm font-medium ${metric.change >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                      {metric.change >= 0 ? '+' : ''}{metric.change.toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

