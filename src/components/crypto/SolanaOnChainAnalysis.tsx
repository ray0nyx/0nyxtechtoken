import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Zap,
  TrendingUp,
  TrendingDown,
  Activity as ActivityIcon,
  User,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  BarChart2,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  Hash as HashIcon,
  Database as DatabaseIcon,
  Globe as GlobeIcon,
  Eye as EyeIcon,
  Target as TargetIcon,
  Clock
} from 'lucide-react';
import { 
  fetchSolanaNetworkMetrics,
  fetchSolanaTokenMetrics,
  fetchSolanaTransactionAnalysis,
  fetchSolanaSupplyMetrics,
  SolanaNetworkMetrics,
  SolanaTokenMetric,
  SolanaTransactionAnalysis,
  SolanaSupplyMetrics
} from '@/lib/solana-onchain';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface NetworkMetricDisplay {
  name: string;
  value: string | number;
  change?: number;
  changeType: 'positive' | 'negative' | 'neutral';
  description: string;
  icon: React.ElementType;
}

export default function SolanaOnChainAnalysis() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'network' | 'tokens' | 'transactions' | 'supply'>('network');
  const [networkMetrics, setNetworkMetrics] = useState<SolanaNetworkMetrics | null>(null);
  const [tokenMetrics, setTokenMetrics] = useState<SolanaTokenMetric[]>([]);
  const [transactionAnalysis, setTransactionAnalysis] = useState<SolanaTransactionAnalysis | null>(null);
  const [supplyMetrics, setSupplyMetrics] = useState<SolanaSupplyMetrics | null>(null);
  const [solPrice, setSolPrice] = useState<number>(0);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch SOL price
      try {
        const priceResponse = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true'
        );
        const priceData = await priceResponse.json();
        setSolPrice(priceData.solana?.usd || 0);
        setPriceChange(priceData.solana?.usd_24h_change || 0);
      } catch (e) {
        console.warn('Failed to fetch SOL price:', e);
      }

      // Fetch all metrics in parallel
      const [network, tokens, transactions, supply] = await Promise.all([
        fetchSolanaNetworkMetrics(),
        fetchSolanaTokenMetrics(),
        fetchSolanaTransactionAnalysis(),
        fetchSolanaSupplyMetrics()
      ]);

      setNetworkMetrics(network);
      setTokenMetrics(tokens);
      setTransactionAnalysis(transactions);
      setSupplyMetrics(supply);
    } catch (err: any) {
      // Check if it's an RPC 403 error (expected with public endpoints)
      const isRpcError = err?.message?.includes('403') || 
                        err?.message?.includes('Access forbidden') ||
                        err?.message?.includes('All Solana RPC endpoints failed');
      
      if (isRpcError) {
        // Suppress RPC errors - show user-friendly message instead
        setError('Solana RPC endpoints are rate-limited. Some data may be unavailable. Please configure a custom RPC endpoint (VITE_SOLANA_RPC_URL) for full functionality.');
      } else {
        setError(err.message || 'Failed to fetch Solana on-chain data');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatSOL = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(value) + ' SOL';
  };

  const formatNumber = (value: number) => {
    if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
    return value.toFixed(2);
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'degraded': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'down': return 'text-red-400 bg-red-500/10 border-red-500/30';
      default: return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
    }
  };

  if (loading && !networkMetrics) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
        </div>
      </div>
    );
  }

  if (error && !networkMetrics && !tokenMetrics.length && !transactionAnalysis && !supplyMetrics) {
    return (
      <div className="space-y-6">
        <Card className="bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400" />
              <div>
                <h3 className="text-red-600 dark:text-red-400 font-semibold">Error Loading Data</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {error.includes('403') || error.includes('Access forbidden')
                    ? 'Solana RPC endpoint is rate-limited. Please configure a custom RPC endpoint in your environment variables (VITE_SOLANA_RPC_URL) or try again later.'
                    : error}
                </p>
                <p className="text-gray-500 dark:text-gray-500 text-xs mt-2">
                  Some data may still be available below. The app will continue to work with partial data.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const networkDisplayMetrics: NetworkMetricDisplay[] = networkMetrics ? [
    {
      name: 'TPS (Current)',
      value: networkMetrics.tps.toLocaleString(),
      changeType: 'positive',
      description: 'Transactions per second (current)',
      icon: ActivityIcon
    },
    {
      name: 'TPS (24h Avg)',
      value: networkMetrics.tps24h.toLocaleString(),
      changeType: 'positive',
      description: 'Average transactions per second over 24 hours',
      icon: BarChart2
    },
    {
      name: 'Block Time',
      value: `${(networkMetrics.blockTime * 1000).toFixed(0)}ms`,
      changeType: 'neutral',
      description: 'Current block time',
      icon: Clock
    },
    {
      name: 'Active Validators',
      value: networkMetrics.activeValidators.toLocaleString(),
      changeType: 'positive',
      description: 'Number of active validators securing the network',
      icon: User
    },
    {
      name: 'Total Staked',
      value: formatSOL(networkMetrics.totalStake),
      changeType: 'positive',
      description: 'Total SOL staked by validators',
      icon: DatabaseIcon
    },
    {
      name: 'Current Epoch',
      value: networkMetrics.currentEpoch.toLocaleString(),
      changeType: 'neutral',
      description: 'Current epoch number',
      icon: HashIcon
    },
    {
      name: 'Epoch Progress',
      value: `${(networkMetrics.epochProgress * 100).toFixed(1)}%`,
      changeType: 'neutral',
      description: 'Progress through current epoch',
      icon: PieChartIcon
    },
    {
      name: 'Slot Height',
      value: networkMetrics.slotHeight.toLocaleString(),
      changeType: 'positive',
      description: 'Current slot height',
      icon: TargetIcon
    }
  ] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <Zap className="w-6 h-6 text-purple-400" />
            </div>
            Solana On-Chain Analysis
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Deep dive into Solana network metrics and on-chain activity</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white dark:bg-gradient-to-br dark:from-purple-500/10 dark:to-purple-500/5 border-gray-200 dark:border-purple-500/20 shadow-md dark:shadow-lg dark:shadow-purple-500/5 hover:shadow-lg dark:hover:shadow-purple-500/20 hover:border-purple-500/30 backdrop-blur-sm transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-400/70 text-sm">SOL Price</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  ${solPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
                <p className={`text-sm flex items-center gap-1 ${priceChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {priceChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                </p>
              </div>
              <Zap className="w-10 h-10 text-purple-400/50" />
            </div>
          </CardContent>
        </Card>

        {/* Always show network metrics cards, even with default values */}
        <Card className="bg-white dark:bg-gradient-to-br dark:from-blue-500/10 dark:to-blue-500/5 border-gray-200 dark:border-blue-500/20 shadow-md dark:shadow-lg dark:shadow-blue-500/5 hover:shadow-lg dark:hover:shadow-blue-500/20 hover:border-blue-500/30 backdrop-blur-sm transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">TPS (24h Avg)</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {networkMetrics ? networkMetrics.tps24h.toLocaleString() : '2,800'}
                </p>
                <p className="text-blue-400 text-sm">Network Throughput</p>
              </div>
              <ActivityIcon className="w-10 h-10 text-blue-400/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gradient-to-br dark:from-emerald-500/10 dark:to-emerald-500/5 border-gray-200 dark:border-emerald-500/20 shadow-md dark:shadow-lg dark:shadow-emerald-500/5 hover:shadow-lg dark:hover:shadow-emerald-500/20 hover:border-emerald-500/30 backdrop-blur-sm transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Total Staked</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {networkMetrics ? formatSOL(networkMetrics.totalStake) : formatSOL(400000000)}
                </p>
                <p className="text-emerald-400 text-sm">Network Security</p>
              </div>
              <DatabaseIcon className="w-10 h-10 text-emerald-400/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gradient-to-br dark:from-amber-500/10 dark:to-amber-500/5 border-gray-200 dark:border-amber-500/20 shadow-md dark:shadow-lg dark:shadow-amber-500/5 hover:shadow-lg dark:hover:shadow-amber-500/20 hover:border-amber-500/30 backdrop-blur-sm transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Network Health</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white capitalize">
                  {networkMetrics ? networkMetrics.networkHealth : 'healthy'}
                </p>
                <Badge variant="outline" className={getHealthColor(networkMetrics?.networkHealth || 'healthy')}>
                  {networkMetrics?.networkHealth || 'healthy'}
                </Badge>
              </div>
              <GlobeIcon className="w-10 h-10 text-amber-400/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-white/10 pb-4 overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        {[
          { id: 'network', label: 'Network Metrics', icon: ActivityIcon },
          { id: 'tokens', label: 'Token Analysis', icon: BarChart2 },
          { id: 'transactions', label: 'Transaction Analysis', icon: EyeIcon },
          { id: 'supply', label: 'Supply', icon: PieChartIcon }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'network' && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {networkDisplayMetrics.map((metric, index) => (
            <Card key={index} className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:border-purple-500/30 shadow-md dark:shadow-lg backdrop-blur-sm hover:shadow-xl dark:hover:shadow-2xl dark:hover:shadow-purple-500/10 transition-all duration-300 group">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/10 group-hover:bg-purple-500/20 flex items-center justify-center transition-colors duration-300">
                    <metric.icon className="w-6 h-6 text-purple-400" />
                  </div>
                </div>
                <h3 className="text-gray-600 dark:text-gray-400 text-sm mb-1">{metric.name}</h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{metric.value}</p>
                <p className="text-gray-500 dark:text-gray-500 text-xs">{metric.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'tokens' && (
        <div className="space-y-4">
          <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 shadow-md dark:shadow-lg backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <BarChart2 className="w-4 h-4 text-purple-400" />
                </div>
                Top Tokens by Volume
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Leading Solana tokens by 24h trading volume
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tokenMetrics.length === 0 ? (
                <div className="text-center py-8">
                  <BarChart2 className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                  <p className="text-gray-600 dark:text-gray-400">No token data available</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tokenMetrics.map((token) => (
                    <div 
                      key={token.mint}
                      className="flex items-center justify-between p-4 rounded-xl bg-white/5 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-white/10 dark:hover:bg-slate-700 transition-all duration-300"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                          <Zap className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900 dark:text-white">{token.symbol}</span>
                            <span className="text-gray-500 dark:text-gray-500 text-sm">{token.name}</span>
                          </div>
                          <p className="text-gray-500 dark:text-gray-500 text-sm">
                            Volume: ${formatNumber(token.volume24h)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900 dark:text-white">${token.price.toLocaleString()}</p>
                        <p className={`text-sm flex items-center justify-end gap-1 ${token.priceChange24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {token.priceChange24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {token.priceChange24h >= 0 ? '+' : ''}{token.priceChange24h.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'transactions' && transactionAnalysis && (
        <div className="space-y-4">
          <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 shadow-md dark:shadow-lg backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <EyeIcon className="w-4 h-4 text-purple-400" />
                </div>
                Transaction Analysis
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Network transaction activity and analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white/5 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">24h Transactions</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {transactionAnalysis.transactionCount24h.toLocaleString()}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">DEX Volume (24h)</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    ${formatNumber(transactionAnalysis.totalVolume24h)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'supply' && supplyMetrics && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
              <CardContent className="p-6">
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">Total Supply</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatSOL(supplyMetrics.totalSupply)}</p>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
              <CardContent className="p-6">
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">Circulating Supply</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatSOL(supplyMetrics.circulatingSupply)}</p>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
              <CardContent className="p-6">
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">Staking Ratio</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{supplyMetrics.stakingRatio.toFixed(1)}%</p>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
              <CardContent className="p-6">
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">Inflation Rate</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{supplyMetrics.inflationRate.toFixed(2)}%</p>
              </CardContent>
            </Card>
          </div>

          {supplyMetrics.supplyGrowth.length > 0 && (
            <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 shadow-md dark:shadow-lg backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">Supply Growth (30 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={supplyMetrics.supplyGrowth}>
                    <defs>
                      <linearGradient id="supplyGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      dataKey="date"
                      stroke="#94a3b8"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      style={{ fontSize: '12px' }}
                      tickFormatter={(value) => formatSOL(value)}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #475569',
                        borderRadius: '8px'
                      }}
                      labelStyle={{ color: '#cbd5e1' }}
                      formatter={(value: number) => formatSOL(value)}
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="#a855f7"
                      strokeWidth={2}
                      fill="url(#supplyGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

