import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp,
  TrendingDown,
  Zap,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  DollarSign,
  Plus,
  Upload,
  FileText,
  Settings,
  BarChart2 as BarChart3,
  Hash as HashIcon,
  User as Wallet,
  Activity as ActivityIcon,
  Target as TargetIcon,
  RefreshCw,
  Download,
  Filter,
  ChevronUp,
  ChevronDown,
  MoreVertical,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Award,
  AlertCircle,
  Percent,
  BarChart3 as BarChartIcon,
  Timer,
  Target
} from 'lucide-react';
import WalletCopyTrading from '@/components/crypto/WalletCopyTrading';
import BitcoinOnChainAnalysis from '@/components/crypto/BitcoinOnChainAnalysis';
import SolanaDexAnalytics from '@/components/crypto/SolanaDexAnalytics';
import SolanaOnChainAnalysis from '@/components/crypto/SolanaOnChainAnalysis';
import WalletManager from '@/components/crypto/WalletManager';
import WinRateGauge from '@/components/crypto/WinRateGauge';
import CryptoPnLChart from '@/components/crypto/CryptoPnLChart';
import EquityLineChart from '@/components/crypto/EquityLineChart';
import CopyTradingDashboard from '@/pages/crypto/CopyTradingDashboard';
import PerformanceChart from '@/components/crypto/PerformanceChart';
import MiniSparkline from '@/components/crypto/MiniSparkline';
import {
  LineChart,
  AreaChart,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
  Area,
  Bar,
  Cell
} from 'recharts';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { createClient } from '@/lib/supabase/client';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from '@/components/ThemeProvider';
import { fetchAggregatedCryptoData, type AggregatedCryptoStats, type AggregatedTrade, formatCurrency as formatCurrencyUtil } from '@/lib/crypto-aggregation-service';
import {
  calculateROI,
  calculateProfitFactor,
  calculateMaxDrawdown,
  calculateSharpeRatio,
  calculateAverageWinLoss,
  getBestWorstTrade,
  formatCompactNumber,
  calculateTradeFrequency,
  generateReturnsFromTrades,
  calculateVolatility,
  calculateVaR
} from '@/lib/crypto-analytics-utils';

type TabType = 'overview' | 'wallet-tracking' | 'bitcoin-analysis' | 'solana-analytics' | 'solana-onchain' | 'copy-trading';

export default function CryptoAnalytics() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const supabase = createClient();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const { subscriptionTier, canAccessCopyTrading } = useSubscription();
  const [isLoading, setIsLoading] = useState(true);
  const [cryptoStats, setCryptoStats] = useState<AggregatedCryptoStats | null>(null);
  const [animateCards, setAnimateCards] = useState(false);
  const [showWalletManager, setShowWalletManager] = useState(false);
  
  // New state for enhanced features
  const [timePeriod, setTimePeriod] = useState<'24h' | '7d' | '30d' | '90d' | '1y' | 'all'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [tradeFilters, setTradeFilters] = useState<{
    type?: 'all' | 'dex' | 'cex';
    pnlRange?: { min: number; max: number };
    dateRange?: { start: string; end: string };
  }>({ type: 'all' });
  const [showTradeFilters, setShowTradeFilters] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

  // Handle query parameters on mount and when they change
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const walletParam = searchParams.get('wallet');
    
    // Set active tab from query parameter if valid
    if (tabParam && ['overview', 'wallet-tracking', 'bitcoin-analysis', 'solana-analytics', 'solana-onchain', 'copy-trading'].includes(tabParam)) {
      setActiveTab(tabParam as TabType);
    }
    
    // Set selected wallet from query parameter
    if (walletParam) {
      setSelectedWallet(walletParam);
    }
  }, [searchParams]);

  // Fetch aggregated crypto data from all sources
  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout | null = null;

    const fetchData = async () => {
      if (!isMounted) return;
      setIsLoading(true);
      
      // Set a timeout to prevent infinite loading (30 seconds)
      timeoutId = setTimeout(() => {
        if (isMounted) {
          console.warn('Crypto data fetch timed out, using default values');
          setIsLoading(false);
          // Set default/empty stats to prevent stuck loading
          setCryptoStats({
            totalValue: 0,
            totalPnL: 0,
            winRate: 0,
            totalTrades: 0,
            avgTradeSize: 0,
            recentTrades: [],
            pnlHistory: [],
            equityCurve: []
          });
        }
      }, 30000);

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !isMounted) {
          if (timeoutId) clearTimeout(timeoutId);
          if (isMounted) setIsLoading(false);
          return;
        }

        // Fetch aggregated data from all crypto sources with timeout
        const fetchPromise = fetchAggregatedCryptoData(user.id);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Fetch timeout')), 25000)
        );

        const aggregatedData = await Promise.race([fetchPromise, timeoutPromise]) as AggregatedCryptoStats;
        
        if (timeoutId) clearTimeout(timeoutId);
        
        if (isMounted) {
          setCryptoStats(aggregatedData);
        }
      } catch (error) {
        if (timeoutId) clearTimeout(timeoutId);
        console.error('Error fetching crypto data:', error);
        // Set default/empty stats on error to prevent stuck loading
        if (isMounted) {
          setCryptoStats({
            totalValue: 0,
            totalPnL: 0,
            winRate: 0,
            totalTrades: 0,
            avgTradeSize: 0,
            recentTrades: [],
            pnlHistory: [],
            equityCurve: []
          });
        }
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        if (isMounted) {
          setIsLoading(false);
          // Trigger animations after data loads
          setTimeout(() => {
            if (isMounted) setAnimateCards(true);
          }, 100);
        }
      }
    };

    fetchData();

    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []); // Only run once on mount

  const handleWalletsUpdated = () => {
    // Refresh data when wallets are updated
    const refreshData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setIsRefreshing(true);
        const aggregatedData = await fetchAggregatedCryptoData(user.id);
        setCryptoStats(aggregatedData);
        setLastRefreshTime(new Date());
        setIsRefreshing(false);
      }
    };
    refreshData();
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      try {
        const aggregatedData = await fetchAggregatedCryptoData(user.id);
        setCryptoStats(aggregatedData);
        setLastRefreshTime(new Date());
      } catch (error) {
        console.error('Error refreshing data:', error);
      }
    }
    setIsRefreshing(false);
  };

  // Calculate all advanced metrics
  const calculatedMetrics = useMemo(() => {
    if (!cryptoStats || cryptoStats.recentTrades.length === 0) {
      return null;
    }

    const initialCapital = 10000; // Default starting capital
    const roi = calculateROI(cryptoStats.totalValue, initialCapital);
    const profitFactor = calculateProfitFactor(cryptoStats.recentTrades);
    const maxDrawdown = calculateMaxDrawdown(cryptoStats.equityCurve);
    const returns = generateReturnsFromTrades(cryptoStats.recentTrades, initialCapital);
    const sharpeRatio = calculateSharpeRatio(returns);
    const avgWinLoss = calculateAverageWinLoss(cryptoStats.recentTrades);
    const bestWorst = getBestWorstTrade(cryptoStats.recentTrades);
    const tradeFrequency = calculateTradeFrequency(cryptoStats.recentTrades);
    const volatility = calculateVolatility(returns);
    const var95 = calculateVaR(returns, 0.95);

    // Generate sparkline data for metrics (last 7 days of P&L)
    const sparklineData = cryptoStats.pnlHistory.slice(-7).map(p => p.pnl);

    return {
      roi,
      profitFactor,
      maxDrawdown,
      sharpeRatio,
      avgWinLoss,
      bestWorst,
      tradeFrequency,
      volatility,
      var95,
      sparklineData
    };
  }, [cryptoStats]);

  // Filter and sort trades
  const filteredAndSortedTrades = useMemo(() => {
    if (!cryptoStats) return [];
    
    let filtered = [...cryptoStats.recentTrades];

    // Apply filters
    if (tradeFilters.type && tradeFilters.type !== 'all') {
      filtered = filtered.filter(t => t.source === tradeFilters.type);
    }

    if (tradeFilters.pnlRange) {
      filtered = filtered.filter(t => {
        const pnl = t.pnl || 0;
        return pnl >= tradeFilters.pnlRange!.min && pnl <= tradeFilters.pnlRange!.max;
      });
    }

    if (tradeFilters.dateRange) {
      filtered = filtered.filter(t => {
        const tradeDate = new Date(t.timestamp);
        const start = new Date(tradeFilters.dateRange!.start);
        const end = new Date(tradeFilters.dateRange!.end);
        return tradeDate >= start && tradeDate <= end;
      });
    }

    // Apply sorting
    if (sortConfig) {
      filtered.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortConfig.key) {
          case 'timestamp':
            aValue = new Date(a.timestamp).getTime();
            bValue = new Date(b.timestamp).getTime();
            break;
          case 'pnl':
            aValue = a.pnl || 0;
            bValue = b.pnl || 0;
            break;
          case 'amount':
            aValue = a.amountIn;
            bValue = b.amountIn;
            break;
          case 'source':
            aValue = a.sourceName;
            bValue = b.sourceName;
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [cryptoStats, tradeFilters, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const exportToCSV = () => {
    if (!filteredAndSortedTrades.length) return;
    
    const headers = ['Date', 'Source', 'Symbol/Pair', 'Side', 'Amount In', 'Amount Out', 'P&L'];
    const rows = filteredAndSortedTrades.map(trade => [
      new Date(trade.timestamp).toLocaleString(),
      trade.sourceName,
      trade.source === 'dex' ? `${trade.tokenIn}→${trade.tokenOut}` : trade.symbol || 'N/A',
      trade.side || 'N/A',
      trade.amountIn.toFixed(4),
      trade.amountOut?.toFixed(4) || 'N/A',
      (trade.pnl || 0).toFixed(2)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crypto-trades-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3, requiresElite: false },
    { id: 'wallet-tracking', label: 'Wallet Tracking', icon: Wallet, requiresElite: true },
    { id: 'copy-trading', label: 'Copy Trading', icon: TargetIcon, requiresElite: true },
    { id: 'bitcoin-analysis', label: 'Bitcoin On-Chain', icon: HashIcon, requiresElite: true },
    { id: 'solana-analytics', label: 'Solana DEX', icon: Zap, requiresElite: true },
    { id: 'solana-onchain', label: 'Solana On-Chain', icon: ActivityIcon, requiresElite: true }
  ];

  // Empty state component
  const EmptyState = ({ title, description, actionLabel, onAction }: { 
    title: string; 
    description: string; 
    actionLabel: string;
    onAction: () => void;
  }) => (
    <Card className="bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10">
      <CardContent className="p-12 text-center">
        <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
          <FileText className="w-8 h-8 text-purple-400" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">{description}</p>
        <Button onClick={onAction} className="bg-purple-500 hover:bg-purple-600">
          <Plus className="w-4 h-4 mr-2" />
          {actionLabel}
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0f] p-4 md:p-6">
      <div className="w-full space-y-4 md:space-y-6">
        {/* Compact Header */}
        <div className="sticky top-0 z-10 bg-white/95 dark:bg-[#0a0a0f]/95 backdrop-blur-md border-b border-gray-200 dark:border-white/10 -mx-4 md:-mx-6 px-4 md:px-6 py-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-4 flex-1">
              <h1 className="text-xl md:text-2xl font-bold text-purple-500">Crypto Analytics</h1>
              {activeTab === 'overview' && cryptoStats && (
                <>
                  <div className="hidden md:flex items-center gap-1 border-l border-gray-200 dark:border-white/10 pl-4">
                    {(['24h', '7d', '30d', '90d', '1y', 'all'] as const).map(period => (
                      <button
                        key={period}
                        onClick={() => setTimePeriod(period)}
                        className={`px-2 py-1 text-xs rounded transition-colors ${
                          timePeriod === period
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'
                        }`}
                      >
                        {period.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  {/* Mobile time period selector */}
                  <div className="md:hidden flex items-center gap-1 overflow-x-auto pb-2 -mx-4 px-4">
                    {(['24h', '7d', '30d', '90d', '1y', 'all'] as const).map(period => (
                      <button
                        key={period}
                        onClick={() => setTimePeriod(period)}
                        className={`px-2 py-1 text-xs rounded transition-colors whitespace-nowrap ${
                          timePeriod === period
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'
                        }`}
                      >
                        {period.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {activeTab === 'overview' && cryptoStats && (
                <>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    {lastRefreshTime && (
                      <span>Updated {formatTime(lastRefreshTime.toISOString())}</span>
                    )}
                    <Button
                      onClick={handleRefresh}
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      disabled={isRefreshing}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </>
              )}
              <Button 
                onClick={() => setShowWalletManager(true)}
                variant="outline"
                size="sm"
                className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 text-xs"
              >
                <Settings className="w-3.5 h-3.5 mr-1.5" />
                <span className="hidden sm:inline">Manage</span>
              </Button>
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 px-2 py-0.5 text-xs">
                {subscriptionTier === 'elite' ? 'Elite' : subscriptionTier === 'pro' ? 'Pro' : 'Starter'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Wallet Manager Modal */}
        <WalletManager 
          isOpen={showWalletManager}
          onClose={() => setShowWalletManager(false)}
          onWalletsUpdated={handleWalletsUpdated}
        />

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-gray-200 dark:border-white/10 pb-4 overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
          {tabs.map(tab => {
            const isLocked = tab.requiresElite && subscriptionTier !== 'elite';
            return (
              <button
                key={tab.id}
                onClick={() => !isLocked && setActiveTab(tab.id as TabType)}
                disabled={isLocked}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : isLocked
                    ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {isLocked && (
                  <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-400 ml-1">
                    Elite
                  </Badge>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
              </div>
            ) : !cryptoStats || cryptoStats.totalTrades === 0 ? (
              <Card className="bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10">
                <CardContent className="p-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-purple-400" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Crypto Data Yet</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                    Connect wallets or exchanges to see your crypto analytics and performance metrics
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <Button onClick={() => setShowWalletManager(true)} className="bg-purple-500 hover:bg-purple-600">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Wallet
                    </Button>
                    <Button 
                      onClick={() => setActiveTab('solana-analytics')} 
                      variant="outline"
                      className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                    >
                      Import DEX Trades
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Quick Stats Bar */}
                {cryptoStats && (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2 md:gap-3">
                    <Card className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:border-emerald-500/30 transition-all p-2 md:p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 mb-0.5 truncate">Total Value</p>
                          <p className="text-sm md:text-base font-semibold text-gray-900 dark:text-white truncate">{formatCompactNumber(cryptoStats.totalValue)}</p>
                        </div>
                        {calculatedMetrics?.sparklineData && calculatedMetrics.sparklineData.length > 0 && (
                          <div className="ml-2 hidden sm:block">
                            <MiniSparkline data={calculatedMetrics.sparklineData} color="#10b981" height={20} width={40} />
                          </div>
                        )}
                      </div>
                    </Card>

                    <Card className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:border-emerald-500/30 transition-all p-2 md:p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 mb-0.5 truncate">Total P&L</p>
                          <p className={`text-sm md:text-base font-semibold truncate ${cryptoStats.totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {cryptoStats.totalPnL >= 0 ? '+' : ''}{formatCompactNumber(cryptoStats.totalPnL)}
                          </p>
                        </div>
                        {calculatedMetrics?.sparklineData && calculatedMetrics.sparklineData.length > 0 && (
                          <div className="ml-2 hidden sm:block">
                            <MiniSparkline 
                              data={calculatedMetrics.sparklineData} 
                              color={cryptoStats.totalPnL >= 0 ? '#10b981' : '#ef4444'} 
                              height={20} 
                              width={40} 
                            />
                          </div>
                        )}
                      </div>
                    </Card>

                    <Card className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:border-purple-500/30 transition-all p-2 md:p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 mb-0.5 truncate">Win Rate</p>
                          <p className="text-sm md:text-base font-semibold text-gray-900 dark:text-white truncate">{cryptoStats.winRate.toFixed(1)}%</p>
                        </div>
                      </div>
                    </Card>

                    <Card className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:border-blue-500/30 transition-all p-2 md:p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 mb-0.5 truncate">Trades</p>
                          <p className="text-sm md:text-base font-semibold text-gray-900 dark:text-white truncate">{cryptoStats.totalTrades}</p>
                        </div>
                      </div>
                    </Card>

                    {calculatedMetrics && (
                      <>
                        <Card className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:border-purple-500/30 transition-all p-2 md:p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 mb-0.5 truncate">ROI</p>
                              <p className={`text-sm md:text-base font-semibold truncate ${calculatedMetrics.roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {calculatedMetrics.roi >= 0 ? '+' : ''}{calculatedMetrics.roi.toFixed(1)}%
                              </p>
                            </div>
                          </div>
                        </Card>

                        <Card className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:border-amber-500/30 transition-all p-2 md:p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 mb-0.5 truncate">Profit Factor</p>
                              <p className="text-sm md:text-base font-semibold text-gray-900 dark:text-white truncate">
                                {calculatedMetrics.profitFactor === Infinity ? '∞' : calculatedMetrics.profitFactor.toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </Card>

                        <Card className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:border-red-500/30 transition-all p-2 md:p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 mb-0.5 truncate">Max DD</p>
                              <p className="text-sm md:text-base font-semibold text-red-400 truncate">{calculatedMetrics.maxDrawdown.toFixed(1)}%</p>
                            </div>
                          </div>
                        </Card>

                        <Card className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:border-indigo-500/30 transition-all p-2 md:p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 mb-0.5 truncate">Sharpe</p>
                              <p className="text-sm md:text-base font-semibold text-gray-900 dark:text-white truncate">{calculatedMetrics.sharpeRatio.toFixed(2)}</p>
                            </div>
                          </div>
                        </Card>
                      </>
                    )}
                  </div>
                )}

                {/* Additional Metrics Grid */}
                {calculatedMetrics && cryptoStats && (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2 md:gap-3">
                    <Card className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:border-emerald-500/30 transition-all p-2 md:p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 mb-0.5 truncate">Avg Win</p>
                          <p className="text-sm md:text-base font-semibold text-emerald-400 truncate">{formatCompactNumber(calculatedMetrics.avgWinLoss.avgWin)}</p>
                        </div>
                      </div>
                    </Card>

                    <Card className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:border-red-500/30 transition-all p-2 md:p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 mb-0.5 truncate">Avg Loss</p>
                          <p className="text-sm md:text-base font-semibold text-red-400 truncate">{formatCompactNumber(calculatedMetrics.avgWinLoss.avgLoss)}</p>
                        </div>
                      </div>
                    </Card>

                    <Card className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:border-emerald-500/30 transition-all p-2 md:p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 mb-0.5 truncate">Best Trade</p>
                          <p className="text-sm md:text-base font-semibold text-emerald-400 truncate">
                            {calculatedMetrics.bestWorst.best ? formatCompactNumber(calculatedMetrics.bestWorst.best.pnl || 0) : '—'}
                          </p>
                        </div>
                      </div>
                    </Card>

                    <Card className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:border-red-500/30 transition-all p-2 md:p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 mb-0.5 truncate">Worst Trade</p>
                          <p className="text-sm md:text-base font-semibold text-red-400 truncate">
                            {calculatedMetrics.bestWorst.worst ? formatCompactNumber(calculatedMetrics.bestWorst.worst.pnl || 0) : '—'}
                          </p>
                        </div>
                      </div>
                    </Card>

                    <Card className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:border-blue-500/30 transition-all p-2 md:p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 mb-0.5 truncate">Trades/Day</p>
                          <p className="text-sm md:text-base font-semibold text-gray-900 dark:text-white truncate">{calculatedMetrics.tradeFrequency.perDay.toFixed(1)}</p>
                        </div>
                      </div>
                    </Card>

                    <Card className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:border-purple-500/30 transition-all p-2 md:p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 mb-0.5 truncate">Volatility</p>
                          <p className="text-sm md:text-base font-semibold text-gray-900 dark:text-white truncate">{(calculatedMetrics.volatility * 100).toFixed(1)}%</p>
                        </div>
                      </div>
                    </Card>

                    <Card className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:border-orange-500/30 transition-all p-2 md:p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 mb-0.5 truncate">VaR (95%)</p>
                          <p className="text-sm md:text-base font-semibold text-orange-400 truncate">{(calculatedMetrics.var95 * 100).toFixed(2)}%</p>
                        </div>
                      </div>
                    </Card>

                    <Card className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:border-cyan-500/30 transition-all p-2 md:p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 mb-0.5 truncate">Wins/Losses</p>
                          <p className="text-sm md:text-base font-semibold text-gray-900 dark:text-white truncate">
                            {calculatedMetrics.avgWinLoss.winCount}/{calculatedMetrics.avgWinLoss.lossCount}
                          </p>
                        </div>
                      </div>
                    </Card>
                  </div>
                )}

                {/* Additional Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  {/* Trade Frequency Chart */}
                  {cryptoStats.recentTrades.length > 0 && (() => {
                    // Group trades by date
                    const tradesByDate = new Map<string, number>();
                    cryptoStats.recentTrades.forEach(trade => {
                      const date = new Date(trade.timestamp).toISOString().split('T')[0];
                      tradesByDate.set(date, (tradesByDate.get(date) || 0) + 1);
                    });
                    
                    // Generate last 30 days data
                    const tradeFrequencyData = [];
                    for (let i = 29; i >= 0; i--) {
                      const date = new Date();
                      date.setDate(date.getDate() - i);
                      const dateStr = date.toISOString().split('T')[0];
                      tradeFrequencyData.push({
                        date: dateStr,
                        trades: tradesByDate.get(dateStr) || 0,
                      });
                    }

                    return (
                      <Card className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-sm">
                        <CardHeader className="p-3 md:p-4 pb-2">
                          <CardTitle className="text-sm md:text-base text-gray-900 dark:text-white">Trade Frequency (30 Days)</CardTitle>
                          <CardDescription className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                            Number of trades per day
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-3 md:p-4 pt-0">
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={tradeFrequencyData}>
                              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#e5e7eb'} />
                              <XAxis 
                                dataKey="date" 
                                tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 10 }}
                                tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                stroke={theme === 'dark' ? '#6b7280' : '#9ca3af'}
                              />
                              <YAxis 
                                tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 10 }}
                                stroke={theme === 'dark' ? '#6b7280' : '#9ca3af'}
                              />
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)', 
                                  border: theme === 'dark' ? '1px solid rgb(51, 65, 85)' : '1px solid rgb(229, 231, 235)',
                                  borderRadius: '8px',
                                  color: theme === 'dark' ? 'rgb(255, 255, 255)' : 'rgb(17, 24, 39)'
                                }}
                                labelFormatter={(value) => new Date(value).toLocaleDateString()}
                              />
                              <Bar dataKey="trades" name="Trades" radius={[4, 4, 0, 0]}>
                                {tradeFrequencyData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill="#8b5cf6" />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    );
                  })()}

                  {/* Win/Loss Distribution Chart */}
                  {cryptoStats.recentTrades.length > 0 && (() => {
                    const wins = cryptoStats.recentTrades.filter(t => (t.pnl || 0) > 0).length;
                    const losses = cryptoStats.recentTrades.filter(t => (t.pnl || 0) < 0).length;
                    const neutral = cryptoStats.recentTrades.filter(t => (t.pnl || 0) === 0).length;

                    return (
                      <Card className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-sm">
                        <CardHeader className="p-3 md:p-4 pb-2">
                          <CardTitle className="text-sm md:text-base text-gray-900 dark:text-white">Win/Loss Distribution</CardTitle>
                          <CardDescription className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                            Breakdown of winning vs losing trades
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-3 md:p-4 pt-0">
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={[
                              { name: 'Wins', value: wins, color: '#10b981' },
                              { name: 'Losses', value: losses, color: '#ef4444' },
                              { name: 'Neutral', value: neutral, color: '#6b7280' }
                            ]}>
                              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#e5e7eb'} />
                              <XAxis 
                                dataKey="name" 
                                tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 10 }}
                                stroke={theme === 'dark' ? '#6b7280' : '#9ca3af'}
                              />
                              <YAxis 
                                tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 10 }}
                                stroke={theme === 'dark' ? '#6b7280' : '#9ca3af'}
                              />
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)', 
                                  border: theme === 'dark' ? '1px solid rgb(51, 65, 85)' : '1px solid rgb(229, 231, 235)',
                                  borderRadius: '8px',
                                  color: theme === 'dark' ? 'rgb(255, 255, 255)' : 'rgb(17, 24, 39)'
                                }}
                              />
                              <Bar dataKey="value" name="Count" radius={[4, 4, 0, 0]}>
                                {[
                                  { name: 'Wins', value: wins, color: '#10b981' },
                                  { name: 'Losses', value: losses, color: '#ef4444' },
                                  { name: 'Neutral', value: neutral, color: '#6b7280' }
                                ].map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    );
                  })()}
                </div>

                {/* Main Content Grid - Two Column Layout on Desktop */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
                  {/* Combined Performance Chart - Left Column */}
                  {cryptoStats && (cryptoStats.pnlHistory.length > 0 || cryptoStats.equityCurve.length > 0) && (
                    <Card className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-sm hover:shadow-md transition-all lg:col-span-1">
                      <CardContent className="p-3 md:p-4">
                        <PerformanceChart 
                          pnlHistory={cryptoStats.pnlHistory}
                          equityCurve={cryptoStats.equityCurve}
                          timePeriod={timePeriod}
                          onTimePeriodChange={setTimePeriod}
                        />
                      </CardContent>
                    </Card>
                  )}

                  {/* Recent Trades - Right Column */}
                  <Card className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-sm hover:shadow-md transition-all lg:col-span-1">
                    <CardHeader className="p-3 md:p-4 pb-2 md:pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base md:text-lg text-gray-900 dark:text-white flex items-center gap-2">
                            <ActivityIcon className="w-4 h-4 text-emerald-400" />
                            Recent Trades
                          </CardTitle>
                          <CardDescription className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                            {filteredAndSortedTrades.length} {filteredAndSortedTrades.length === 1 ? 'trade' : 'trades'}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            onClick={() => setShowTradeFilters(!showTradeFilters)}
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                          >
                            <Filter className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            onClick={exportToCSV}
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            disabled={filteredAndSortedTrades.length === 0}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    {showTradeFilters && (
                      <div className="px-3 md:px-4 pb-2 border-b border-gray-200 dark:border-white/10">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <select
                            value={tradeFilters.type || 'all'}
                            onChange={(e) => setTradeFilters({ ...tradeFilters, type: e.target.value as any })}
                            className="px-2 py-1 rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white"
                          >
                            <option value="all">All Sources</option>
                            <option value="dex">DEX Only</option>
                            <option value="cex">CEX Only</option>
                          </select>
                          <Button
                            onClick={() => setTradeFilters({ type: 'all' })}
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                          >
                            Clear
                          </Button>
                        </div>
                      </div>
                    )}
                    <CardContent className="p-3 md:p-4">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs md:text-sm">
                          <thead>
                            <tr className="border-b border-gray-200 dark:border-white/10">
                              <th className="text-left py-2 px-2 font-medium text-gray-600 dark:text-gray-400">
                                <button
                                  onClick={() => handleSort('timestamp')}
                                  className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white"
                                >
                                  Time
                                  {sortConfig?.key === 'timestamp' && (
                                    sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                                  )}
                                </button>
                              </th>
                              <th className="text-left py-2 px-2 font-medium text-gray-600 dark:text-gray-400">Source</th>
                              <th className="text-left py-2 px-2 font-medium text-gray-600 dark:text-gray-400">Pair/Symbol</th>
                              <th className="text-right py-2 px-2 font-medium text-gray-600 dark:text-gray-400">
                                <button
                                  onClick={() => handleSort('pnl')}
                                  className="flex items-center gap-1 ml-auto hover:text-gray-900 dark:hover:text-white"
                                >
                                  P&L
                                  {sortConfig?.key === 'pnl' && (
                                    sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                                  )}
                                </button>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredAndSortedTrades.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="text-center py-8 text-gray-500 dark:text-gray-400">
                                  No trades found
                                </td>
                              </tr>
                            ) : (
                              filteredAndSortedTrades.slice(0, 20).map((trade, index) => {
                                const isDex = trade.source === 'dex';
                                const isPositive = (trade.pnl || 0) >= 0;
                                
                                return (
                                  <tr 
                                    key={trade.id}
                                    className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                                  >
                                    <td className="py-2 px-2 text-gray-600 dark:text-gray-400">
                                      {formatTime(trade.timestamp)}
                                    </td>
                                    <td className="py-2 px-2">
                                      <Badge variant="outline" className={`text-[10px] ${
                                        isDex ? 'border-emerald-500/30 text-emerald-400' : 'border-blue-500/30 text-blue-400'
                                      }`}>
                                        {trade.sourceName}
                                      </Badge>
                                    </td>
                                    <td className="py-2 px-2">
                                      <div className="flex flex-col">
                                        {isDex ? (
                                          <span className="font-mono text-xs text-gray-900 dark:text-white">
                                            {trade.tokenIn?.slice(0, 6)}...→{trade.tokenOut?.slice(0, 6)}...
                                          </span>
                                        ) : (
                                          <>
                                            <span className="text-xs font-medium text-gray-900 dark:text-white">{trade.symbol}</span>
                                            {trade.side && (
                                              <Badge variant="outline" className={`text-[10px] w-fit mt-0.5 ${
                                                trade.side === 'buy' ? 'border-emerald-500/30 text-emerald-400' : 'border-red-500/30 text-red-400'
                                              }`}>
                                                {trade.side.toUpperCase()}
                                              </Badge>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-2 px-2 text-right">
                                      <span className={`font-semibold text-xs ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {trade.pnl !== undefined ? (
                                          `${isPositive ? '+' : ''}${formatCompactNumber(trade.pnl)}`
                                        ) : (
                                          '—'
                                        )}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}

            {/* Performance Summary Section */}
            {calculatedMetrics && cryptoStats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                <Card className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-sm">
                  <CardHeader className="p-3 md:p-4 pb-2">
                    <CardTitle className="text-sm md:text-base text-gray-900 dark:text-white">Performance Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 md:p-4 pt-0 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">Winning Trades</span>
                      <span className="font-semibold text-emerald-400">{calculatedMetrics.avgWinLoss.winCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">Losing Trades</span>
                      <span className="font-semibold text-red-400">{calculatedMetrics.avgWinLoss.lossCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">Total Volume</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{formatCompactNumber(cryptoStats.recentTrades.reduce((sum, t) => sum + t.amountIn, 0))}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">Trade Frequency</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{calculatedMetrics.tradeFrequency.perDay.toFixed(1)}/day</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-sm">
                  <CardHeader className="p-3 md:p-4 pb-2">
                    <CardTitle className="text-sm md:text-base text-gray-900 dark:text-white">Risk Metrics</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 md:p-4 pt-0 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">Max Drawdown</span>
                      <span className="font-semibold text-red-400">{calculatedMetrics.maxDrawdown.toFixed(2)}%</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">Volatility</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{(calculatedMetrics.volatility * 100).toFixed(2)}%</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">VaR (95%)</span>
                      <span className="font-semibold text-orange-400">{(calculatedMetrics.var95 * 100).toFixed(2)}%</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">Sharpe Ratio</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{calculatedMetrics.sharpeRatio.toFixed(2)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-sm">
                  <CardHeader className="p-3 md:p-4 pb-2">
                    <CardTitle className="text-sm md:text-base text-gray-900 dark:text-white">Trade Analysis</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 md:p-4 pt-0 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">Avg Win</span>
                      <span className="font-semibold text-emerald-400">{formatCompactNumber(calculatedMetrics.avgWinLoss.avgWin)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">Avg Loss</span>
                      <span className="font-semibold text-red-400">{formatCompactNumber(calculatedMetrics.avgWinLoss.avgLoss)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">Best Trade</span>
                      <span className="font-semibold text-emerald-400">
                        {calculatedMetrics.bestWorst.best ? formatCompactNumber(calculatedMetrics.bestWorst.best.pnl || 0) : '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">Worst Trade</span>
                      <span className="font-semibold text-red-400">
                        {calculatedMetrics.bestWorst.worst ? formatCompactNumber(calculatedMetrics.bestWorst.worst.pnl || 0) : '—'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Quick Access Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
              <Card 
                className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-sm hover:shadow-md hover:border-purple-500/30 cursor-pointer transition-all"
                onClick={() => subscriptionTier === 'elite' && setActiveTab('wallet-tracking')}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <Wallet className="w-5 h-5 text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate">Wallet Copy Trading</h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate">Track top Solana wallets</p>
                    </div>
                  </div>
                  {subscriptionTier !== 'elite' && (
                    <Badge variant="outline" className="mt-2 text-xs border-amber-500/30 text-amber-400">
                      Elite
                    </Badge>
                  )}
                </CardContent>
              </Card>

              <Card 
                className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-sm hover:shadow-md hover:border-amber-500/30 cursor-pointer transition-all"
                onClick={() => subscriptionTier === 'elite' && setActiveTab('bitcoin-analysis')}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                      <HashIcon className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate">Bitcoin On-Chain</h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate">Deep on-chain analysis</p>
                    </div>
                  </div>
                  {subscriptionTier !== 'elite' && (
                    <Badge variant="outline" className="mt-2 text-xs border-amber-500/30 text-amber-400">
                      Elite
                    </Badge>
                  )}
                </CardContent>
              </Card>

              <Card 
                className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-sm hover:shadow-md hover:border-emerald-500/30 cursor-pointer transition-all"
                onClick={() => subscriptionTier === 'elite' && setActiveTab('solana-analytics')}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate">Solana DEX Analytics</h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate">Jupiter, Raydium & more</p>
                    </div>
                  </div>
                  {subscriptionTier !== 'elite' && (
                    <Badge variant="outline" className="mt-2 text-xs border-amber-500/30 text-amber-400">
                      Elite
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'wallet-tracking' && <WalletCopyTrading />}
        
        {activeTab === 'copy-trading' && <CopyTradingDashboard selectedWallet={selectedWallet} />}
        
        {activeTab === 'bitcoin-analysis' && <BitcoinOnChainAnalysis />}
        
        {activeTab === 'solana-analytics' && <SolanaDexAnalytics />}
        
        {activeTab === 'solana-onchain' && <SolanaOnChainAnalysis />}
      </div>
    </div>
  );
}
