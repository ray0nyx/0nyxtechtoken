import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MetricCard from '@/components/crypto/ui/MetricCard';
import { useTheme } from '@/components/ThemeProvider';
import { cn } from '@/lib/utils';
import { fetchBitcoinOnChainMetrics, type BitcoinOnChainData } from '@/lib/bitcoin-onchain';
import { fetchSolanaNetworkMetrics, type SolanaNetworkMetrics } from '@/lib/solana-onchain';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
  timePeriod?: string;
  onTimePeriodChange?: (period: string) => void;
}

function ChartCard({ title, children, timePeriod = '30d', onTimePeriodChange }: ChartCardProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <div className={cn(
      "rounded-xl border overflow-hidden",
      isDark ? "bg-black border-white/10" : "bg-white border-gray-200"
    )}>
      <div className={cn(
        "flex items-center justify-between px-4 py-3 border-b",
        isDark ? "border-white/10" : "border-gray-200"
      )}>
        <h3 className={cn(
          "font-semibold",
          isDark ? "text-white" : "text-gray-900"
        )}>{title}</h3>
        <Select value={timePeriod} onValueChange={onTimePeriodChange}>
          <SelectTrigger className={cn(
            "w-[140px] h-8 text-xs",
            isDark ? "bg-[#0f1419] border-[#374151] text-[#9ca3af]" : "bg-gray-50 border-gray-300 text-gray-700"
          )}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={cn(
            isDark ? "bg-[#1a1f2e] border-[#374151]" : "bg-white border-gray-200"
          )}>
            <SelectItem value="24h">24h</SelectItem>
            <SelectItem value="7d">7 days</SelectItem>
            <SelectItem value="30d">30 day balance</SelectItem>
            <SelectItem value="90d">90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

export default function OnChainAnalysisPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [loading, setLoading] = useState(true);

  // Bitcoin data
  const [btcData, setBtcData] = useState<BitcoinOnChainData | null>(null);
  const [hashRateData, setHashRateData] = useState<{ date: string; value: number }[]>([]);
  const [activeAddressesData, setActiveAddressesData] = useState<{ date: string; value: number }[]>([]);
  const [transactionVolumeData, setTransactionVolumeData] = useState<{ date: string; btc: number; eth: number; other: number }[]>([]);

  // Solana data
  const [solData, setSolData] = useState<SolanaNetworkMetrics | null>(null);
  const [tpsData, setTpsData] = useState<{ date: string; value: number }[]>([]);
  const [tvlData, setTvlData] = useState<{ date: string; value: number }[]>([]);
  const [activeWalletsData, setActiveWalletsData] = useState<{ date: string; value: number }[]>([]);

  // Time period states for each chart
  const [hashRatePeriod, setHashRatePeriod] = useState<string>('30d');
  const [activeAddressesPeriod, setActiveAddressesPeriod] = useState<string>('30d');
  const [transactionVolumePeriod, setTransactionVolumePeriod] = useState<string>('30d');
  const [tpsPeriod, setTpsPeriod] = useState<string>('30d');
  const [tvlPeriod, setTvlPeriod] = useState<string>('30d');
  const [activeWalletsPeriod, setActiveWalletsPeriod] = useState<string>('30d');

  const formatDate = (date: Date, period: string): string => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];
    const day = date.getDate();

    if (period === '24h') {
      // For 24h, show hours
      return `${date.getHours()}:00`;
    } else if (period === '7d') {
      // For 7d, show day and month
      return `${month} ${day}`;
    } else {
      // For 30d and 90d, show day and month
      return `${month} ${day}`;
    }
  };

  const getDaysFromPeriod = (period: string): number => {
    switch (period) {
      case '24h': return 1;
      case '7d': return 7;
      case '30d': return 30;
      case '90d': return 90;
      default: return 30;
    }
  };

  const generateHashRateData = (period: string) => {
    if (!btcData) return;

    const days = getDaysFromPeriod(period);
    const now = new Date();
    const currentHashRate = btcData.networkHashRate || 200000000000000;
    const hashRate = [];
    let baseHash = currentHashRate * 0.9;

    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      if (period === '24h') {
        date.setHours(date.getHours() - i);
      } else {
        date.setDate(date.getDate() - i);
      }
      const progress = (days - i) / days;
      baseHash = currentHashRate * (0.9 + progress * 0.1) + (Math.random() - 0.5) * currentHashRate * 0.05;
      hashRate.push({
        date: formatDate(date, period),
        value: Math.max(baseHash, currentHashRate * 0.85),
      });
    }
    setHashRateData(hashRate);
  };

  const generateActiveAddressesData = (period: string) => {
    if (!btcData) return;

    const days = getDaysFromPeriod(period);
    const now = new Date();
    const activeAddressesMetric = btcData.metrics?.find(m =>
      m.name?.toLowerCase().includes('active') || m.name?.toLowerCase().includes('address')
    );
    const baseAddresses = typeof activeAddressesMetric?.value === 'number'
      ? activeAddressesMetric.value
      : 1000000000;

    const addresses = [];
    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      if (period === '24h') {
        date.setHours(date.getHours() - i);
      } else {
        date.setDate(date.getDate() - i);
      }
      addresses.push({
        date: formatDate(date, period),
        value: baseAddresses * (0.95 + Math.random() * 0.1),
      });
    }
    setActiveAddressesData(addresses);
  };

  const generateTransactionVolumeData = (period: string) => {
    if (!btcData) return;

    const days = getDaysFromPeriod(period);
    const now = new Date();
    const txVolume = [];

    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      if (period === '24h') {
        date.setHours(date.getHours() - i);
      } else {
        date.setDate(date.getDate() - i);
      }
      txVolume.push({
        date: formatDate(date, period),
        btc: 500000 + Math.random() * 500000,
        eth: 400000 + Math.random() * 400000,
        other: 1000000 + Math.random() * 1000000,
      });
    }
    setTransactionVolumeData(txVolume);
  };

  const generateTpsData = (period: string) => {
    if (!solData) return;

    const days = getDaysFromPeriod(period);
    const now = new Date();
    const currentTps = solData.tps || 3000;
    const tps = [];

    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      if (period === '24h') {
        date.setHours(date.getHours() - i);
      } else {
        date.setDate(date.getDate() - i);
      }
      tps.push({
        date: formatDate(date, period),
        value: currentTps * (0.8 + Math.random() * 0.4),
      });
    }
    setTpsData(tps);
  };

  const generateTvlData = (period: string) => {
    if (!solData) return;

    const days = getDaysFromPeriod(period);
    const now = new Date();
    const tvl = [];
    let baseTvl = 50000000;

    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      if (period === '24h') {
        date.setHours(date.getHours() - i);
      } else {
        date.setDate(date.getDate() - i);
      }
      baseTvl += (Math.random() - 0.4) * 5000000;
      tvl.push({
        date: formatDate(date, period),
        value: Math.max(baseTvl, 30000000),
      });
    }
    setTvlData(tvl);
  };

  const generateActiveWalletsData = (period: string) => {
    if (!solData) return;

    const days = getDaysFromPeriod(period);
    const now = new Date();
    const baseWallets = solData.activeValidators ? solData.activeValidators * 1000 : 30000;
    const wallets = [];

    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      if (period === '24h') {
        date.setHours(date.getHours() - i);
      } else {
        date.setDate(date.getDate() - i);
      }
      wallets.push({
        date: formatDate(date, period),
        value: baseWallets * (0.9 + Math.random() * 0.2),
      });
    }
    setActiveWalletsData(wallets);
  };

  useEffect(() => {
    loadOnChainData();
  }, []);

  // Regenerate chart data when time periods change
  useEffect(() => {
    if (btcData) {
      generateHashRateData(hashRatePeriod);
    }
  }, [hashRatePeriod, btcData]);

  useEffect(() => {
    if (btcData) {
      generateActiveAddressesData(activeAddressesPeriod);
    }
  }, [activeAddressesPeriod, btcData]);

  useEffect(() => {
    if (btcData) {
      generateTransactionVolumeData(transactionVolumePeriod);
    }
  }, [transactionVolumePeriod, btcData]);

  useEffect(() => {
    if (solData) {
      generateTpsData(tpsPeriod);
    }
  }, [tpsPeriod, solData]);

  useEffect(() => {
    if (solData) {
      generateTvlData(tvlPeriod);
    }
  }, [tvlPeriod, solData]);

  useEffect(() => {
    if (solData) {
      generateActiveWalletsData(activeWalletsPeriod);
    }
  }, [activeWalletsPeriod, solData]);

  const loadOnChainData = async () => {
    setLoading(true);
    try {
      // Fetch real Bitcoin on-chain metrics
      const btcMetrics = await fetchBitcoinOnChainMetrics();
      setBtcData(btcMetrics);

      // Fetch real Solana network metrics
      const solMetrics = await fetchSolanaNetworkMetrics();
      setSolData(solMetrics);

      // Generate initial chart data (will be regenerated by useEffect when periods change)
      generateHashRateData(hashRatePeriod);
      generateActiveAddressesData(activeAddressesPeriod);
      generateTransactionVolumeData(transactionVolumePeriod);
      generateTpsData(tpsPeriod);
      generateTvlData(tvlPeriod);
      generateActiveWalletsData(activeWalletsPeriod);

    } catch (error) {
      console.error('Error loading on-chain data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(0)}B`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(0)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toFixed(0);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={cn(
            "rounded-xl border h-[300px] animate-pulse",
            isDark ? "bg-black border-white/10" : "bg-white border-gray-200"
          )} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Metrics Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {btcData && (
          <>
            {btcData.metrics?.slice(0, 4).map((metric, i) => (
              <MetricCard
                key={i}
                label={metric.name}
                value={typeof metric.value === 'string' ? metric.value : metric.value.toLocaleString()}
                change={metric.change24h}
                className="bg-black border-white/10"
              />
            ))}
          </>
        )}
        {solData && (
          <>
            <MetricCard
              label="Network TPS"
              value={solData.tps?.toLocaleString() || '0'}
              change={solData.tps24h ? ((solData.tps - solData.tps24h) / solData.tps24h) * 100 : 0}
              className="bg-black border-white/10"
            />
            <MetricCard
              label="Active Validators"
              value={solData.activeValidators?.toLocaleString() || '0'}
              className="bg-black border-white/10"
            />
            <MetricCard
              label="Block Height"
              value={solData.blockHeight?.toLocaleString() || '0'}
              className="bg-black border-white/10"
            />
            <MetricCard
              label="Network Health"
              value={solData.networkHealth || 'healthy'}
              className="bg-black border-white/10"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bitcoin Column */}
        <div className="space-y-6">
          <h2 className={cn(
            "text-xl font-bold",
            isDark ? "text-white" : "text-gray-900"
          )}>Bitcoin (BTC)</h2>

          {/* Network Hash Rate */}
          <ChartCard
            title="Network Hash Rate"
            timePeriod={hashRatePeriod}
            onTimePeriodChange={setHashRatePeriod}
          >
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hashRateData}>
                  <defs>
                    <linearGradient id="hashRateGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                    tickFormatter={formatNumber}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#1a1f2e' : '#ffffff',
                      border: isDark ? '1px solid #374151' : '1px solid #e5e7eb',
                      borderRadius: '8px'
                    }}
                    labelStyle={{ color: isDark ? '#9ca3af' : '#6b7280' }}
                    formatter={(value: number) => [formatNumber(value), 'Hash Rate']}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#10b981"
                    fill="url(#hashRateGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          {/* Active Addresses */}
          <ChartCard
            title="Active Addresses"
            timePeriod={activeAddressesPeriod}
            onTimePeriodChange={setActiveAddressesPeriod}
          >
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activeAddressesData}>
                  <defs>
                    <linearGradient id="addressGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                    tickFormatter={formatNumber}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#1a1f2e' : '#ffffff',
                      border: isDark ? '1px solid #374151' : '1px solid #e5e7eb',
                      borderRadius: '8px'
                    }}
                    labelStyle={{ color: isDark ? '#9ca3af' : '#6b7280' }}
                    formatter={(value: number) => [formatNumber(value), 'Addresses']}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#3b82f6"
                    fill="url(#addressGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          {/* Transaction Volume */}
          <ChartCard
            title="Transaction Volume"
            timePeriod={transactionVolumePeriod}
            onTimePeriodChange={setTransactionVolumePeriod}
          >
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={transactionVolumeData}>
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                    tickFormatter={formatNumber}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#1a1f2e' : '#ffffff',
                      border: isDark ? '1px solid #374151' : '1px solid #e5e7eb',
                      borderRadius: '8px'
                    }}
                    labelStyle={{ color: isDark ? '#9ca3af' : '#6b7280' }}
                    formatter={(value: number) => [formatNumber(value), '']}
                  />
                  <Bar dataKey="btc" stackId="a" fill="#f59e0b" />
                  <Bar dataKey="eth" stackId="a" fill="#10b981" />
                  <Bar dataKey="other" stackId="a" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        {/* Solana Column */}
        <div className="space-y-6">
          <h2 className={cn(
            "text-xl font-bold",
            isDark ? "text-white" : "text-gray-900"
          )}>Solana (SOL)</h2>

          {/* TPS */}
          <ChartCard
            title="TPS (Transactions Per Second)"
            timePeriod={tpsPeriod}
            onTimePeriodChange={setTpsPeriod}
          >
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={tpsData}>
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                    tickFormatter={formatNumber}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1f2e', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#9ca3af' }}
                    formatter={(value: number) => [formatNumber(value), 'TPS']}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          {/* TVL */}
          <ChartCard
            title="Total Value Locked (TVL)"
            timePeriod={tvlPeriod}
            onTimePeriodChange={setTvlPeriod}
          >
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={tvlData}>
                  <defs>
                    <linearGradient id="tvlGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                    tickFormatter={formatNumber}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#1a1f2e' : '#ffffff',
                      border: isDark ? '1px solid #374151' : '1px solid #e5e7eb',
                      borderRadius: '8px'
                    }}
                    labelStyle={{ color: isDark ? '#9ca3af' : '#6b7280' }}
                    formatter={(value: number) => [`$${formatNumber(value)}`, 'TVL']}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#f59e0b"
                    fill="url(#tvlGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          {/* Daily Active Wallets */}
          <ChartCard
            title="Daily Active Wallets"
            timePeriod={activeWalletsPeriod}
            onTimePeriodChange={setActiveWalletsPeriod}
          >
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activeWalletsData}>
                  <defs>
                    <linearGradient id="walletsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                    tickFormatter={formatNumber}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#1a1f2e' : '#ffffff',
                      border: isDark ? '1px solid #374151' : '1px solid #e5e7eb',
                      borderRadius: '8px'
                    }}
                    labelStyle={{ color: isDark ? '#9ca3af' : '#6b7280' }}
                    formatter={(value: number) => [formatNumber(value), 'Wallets']}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#3b82f6"
                    fill="url(#walletsGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
      </div>
    </div>
  );
}

