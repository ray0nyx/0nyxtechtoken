import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '@/lib/crypto-aggregation-service';

interface PnLDataPoint {
  date: string;
  pnl: number;
  cumulativePnl: number;
}

interface CryptoPnLChartProps {
  data: PnLDataPoint[];
}

export default function CryptoPnLChart({ data }: CryptoPnLChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] text-slate-400">
        <TrendingUp className="w-12 h-12 mb-3 text-slate-600" />
        <p>No P&L data available yet</p>
        <p className="text-sm text-slate-500 mt-1">Start trading to see your performance</p>
      </div>
    );
  }

  // Determine if overall P&L is positive or negative
  const latestPnL = data[data.length - 1]?.cumulativePnl || 0;
  const isPositive = latestPnL >= 0;

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl">
          <p className="text-slate-400 text-xs mb-2">
            {new Date(data.date).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              year: 'numeric' 
            })}
          </p>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-slate-500">Daily P&L:</span>
              <span className={`text-sm font-semibold ${data.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {data.pnl >= 0 ? '+' : ''}{formatCurrency(data.pnl)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-slate-500">Cumulative:</span>
              <span className={`text-sm font-semibold ${data.cumulativePnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {data.cumulativePnl >= 0 ? '+' : ''}{formatCurrency(data.cumulativePnl)}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Format date for x-axis
  const formatXAxis = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Format y-axis
  const formatYAxis = (value: number) => {
    if (Math.abs(value) >= 1000) {
      return `$${(value / 1000).toFixed(0)}k`;
    }
    return `$${value.toFixed(0)}`;
  };

  return (
    <div className="w-full">
      {/* Summary Stats */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div>
          <p className="text-xs text-slate-400 mb-1">Total P&L</p>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? '+' : ''}{formatCurrency(latestPnL)}
            </span>
            {isPositive ? (
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-400" />
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400 mb-1">Total Trades</p>
          <p className="text-xl font-semibold text-white">{data.length}</p>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart
          data={data}
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
          </defs>
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="#334155" 
            vertical={false}
          />
          <XAxis 
            dataKey="date" 
            tickFormatter={formatXAxis}
            stroke="#64748b"
            style={{ fontSize: '12px' }}
            tickLine={false}
          />
          <YAxis 
            tickFormatter={formatYAxis}
            stroke="#64748b"
            style={{ fontSize: '12px' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="cumulativePnl"
            stroke={isPositive ? '#10b981' : '#ef4444'}
            strokeWidth={3}
            fill="url(#colorPnL)"
            animationDuration={1500}
            animationBegin={0}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-emerald-500"></div>
          <span>Positive P&L</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-red-500"></div>
          <span>Negative P&L</span>
        </div>
      </div>
    </div>
  );
}

