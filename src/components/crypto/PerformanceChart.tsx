import React, { useState } from 'react';
import { 
  ComposedChart, 
  Line, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '@/lib/crypto-aggregation-service';
import type { PnLHistoryPoint, EquityPoint } from '@/lib/crypto-aggregation-service';

interface PerformanceChartProps {
  pnlHistory: PnLHistoryPoint[];
  equityCurve: EquityPoint[];
  timePeriod?: '24h' | '7d' | '30d' | '90d' | '1y' | 'all';
  onTimePeriodChange?: (period: '24h' | '7d' | '30d' | '90d' | '1y' | 'all') => void;
}

export default function PerformanceChart({ 
  pnlHistory, 
  equityCurve,
  timePeriod = 'all',
  onTimePeriodChange
}: PerformanceChartProps) {
  const [activeMetric, setActiveMetric] = useState<'pnl' | 'equity' | 'both'>('both');

  // Filter data based on time period
  const filterDataByPeriod = <T extends { date: string }>(data: T[]): T[] => {
    if (timePeriod === 'all' || data.length === 0) return data;
    
    const now = new Date();
    const cutoffDate = new Date();
    
    switch (timePeriod) {
      case '24h':
        cutoffDate.setHours(now.getHours() - 24);
        break;
      case '7d':
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        cutoffDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        cutoffDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        cutoffDate.setFullYear(now.getFullYear() - 1);
        break;
    }
    
    return data.filter(point => new Date(point.date) >= cutoffDate);
  };

  const filteredPnL = filterDataByPeriod(pnlHistory);
  const filteredEquity = filterDataByPeriod(equityCurve);

  // Combine data for chart
  const chartData = React.useMemo(() => {
    const combined: Array<{
      date: string;
      cumulativePnl: number;
      equity: number;
      pnl: number;
    }> = [];

    // Create a map of dates to combine both datasets
    const dateMap = new Map<string, { pnl?: number; cumulativePnl?: number; equity?: number }>();

    filteredPnL.forEach(point => {
      const existing = dateMap.get(point.date) || {};
      dateMap.set(point.date, {
        ...existing,
        pnl: point.pnl,
        cumulativePnl: point.cumulativePnl
      });
    });

    filteredEquity.forEach(point => {
      const existing = dateMap.get(point.date) || {};
      dateMap.set(point.date, {
        ...existing,
        equity: point.equity
      });
    });

    // Convert to array and sort by date
    Array.from(dateMap.entries())
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .forEach(([date, data]) => {
        combined.push({
          date,
          cumulativePnl: data.cumulativePnl || 0,
          equity: data.equity || 0,
          pnl: data.pnl || 0
        });
      });

    return combined;
  }, [filteredPnL, filteredEquity]);

  const latestPnL = filteredPnL.length > 0 ? filteredPnL[filteredPnL.length - 1].cumulativePnl : 0;
  const latestEquity = filteredEquity.length > 0 ? filteredEquity[filteredEquity.length - 1].equity : 0;
  const isPositive = latestPnL >= 0;

  const timePeriods: Array<'24h' | '7d' | '30d' | '90d' | '1y' | 'all'> = ['24h', '7d', '30d', '90d', '1y', 'all'];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg p-3 shadow-xl">
          <p className="text-gray-600 dark:text-slate-400 text-xs mb-2">
            {new Date(data.date).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              year: 'numeric' 
            })}
          </p>
          <div className="space-y-1">
            {activeMetric !== 'equity' && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-gray-500 dark:text-slate-500">Cumulative P&L:</span>
                <span className={`text-sm font-semibold ${data.cumulativePnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {data.cumulativePnl >= 0 ? '+' : ''}{formatCurrency(data.cumulativePnl)}
                </span>
              </div>
            )}
            {activeMetric !== 'pnl' && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-gray-500 dark:text-slate-500">Equity:</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(data.equity)}
                </span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const formatXAxis = (dateStr: string) => {
    const date = new Date(dateStr);
    if (timePeriod === '24h') {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
        <TrendingUp className="w-12 h-12 mb-3 text-gray-400" />
        <p>No performance data available</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Controls */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveMetric('pnl')}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              activeMetric === 'pnl'
                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'
            }`}
          >
            P&L
          </button>
          <button
            onClick={() => setActiveMetric('equity')}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              activeMetric === 'equity'
                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'
            }`}
          >
            Equity
          </button>
          <button
            onClick={() => setActiveMetric('both')}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              activeMetric === 'both'
                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'
            }`}
          >
            Both
          </button>
        </div>

        {/* Time Period Selector */}
        <div className="flex items-center gap-1">
          {timePeriods.map(period => (
            <button
              key={period}
              onClick={() => onTimePeriodChange?.(period)}
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
      </div>

      {/* Summary Stats */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div>
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Total P&L</p>
          <div className="flex items-center gap-2">
            <span className={`text-xl font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? '+' : ''}{formatCurrency(latestPnL)}
            </span>
            {isPositive ? (
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-400" />
            )}
          </div>
        </div>
        {activeMetric !== 'pnl' && (
          <div className="text-right">
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Equity</p>
            <p className="text-xl font-semibold text-gray-900 dark:text-white">{formatCurrency(latestEquity)}</p>
          </div>
        )}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorPnL" x1="0" y1="0" x2="0" y2="1">
              <stop 
                offset="5%" 
                stopColor={isPositive ? '#10b981' : '#ef4444'} 
                stopOpacity={0.3}
              />
              <stop 
                offset="95%" 
                stopColor={isPositive ? '#10b981' : '#ef4444'} 
                stopOpacity={0}
              />
            </linearGradient>
            <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="#e5e7eb" 
            className="dark:stroke-gray-700"
            vertical={false}
          />
          <XAxis 
            dataKey="date" 
            tickFormatter={formatXAxis}
            stroke="#9ca3af"
            className="dark:stroke-gray-500"
            style={{ fontSize: '11px' }}
            tickLine={false}
          />
          <YAxis 
            yAxisId="left"
            tickFormatter={(value) => formatCurrency(value)}
            stroke="#9ca3af"
            className="dark:stroke-gray-500"
            style={{ fontSize: '11px' }}
            tickLine={false}
            axisLine={false}
          />
          {activeMetric === 'both' && (
            <YAxis 
              yAxisId="right"
              orientation="right"
              tickFormatter={(value) => formatCurrency(value)}
              stroke="#9ca3af"
              className="dark:stroke-gray-500"
              style={{ fontSize: '11px' }}
              tickLine={false}
              axisLine={false}
            />
          )}
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
            iconType="line"
          />
          {activeMetric !== 'equity' && (
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="cumulativePnl"
              stroke={isPositive ? '#10b981' : '#ef4444'}
              strokeWidth={2}
              fill="url(#colorPnL)"
              name="Cumulative P&L"
            />
          )}
          {activeMetric !== 'pnl' && (
            <Line
              yAxisId={activeMetric === 'both' ? 'right' : 'left'}
              type="monotone"
              dataKey="equity"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={false}
              name="Equity"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

