import React from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { formatCurrency } from '@/lib/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, ChevronUp, ChevronDown } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

interface TradeDurationPnLChartProps {
  trades?: any[];
  showCard?: boolean;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#0a0a0a] border border-neutral-800 rounded-lg shadow-lg p-3 backdrop-blur-sm">
        <p className="font-medium text-white mb-1">
          Duration: {data.duration}m
        </p>
        <p className="text-sm text-neutral-300">
          P&L: {formatCurrency(data.pnl)}
        </p>
      </div>
    );
  }
  return null;
};

export function TradeDurationPnLChart({ trades = [], showCard = true }: TradeDurationPnLChartProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  // Process trades data
  const chartData = trades.map(trade => {
    const entryTime = new Date(trade.entry_date);
    const exitTime = new Date(trade.exit_date);
    const duration = Math.round((exitTime.getTime() - entryTime.getTime()) / (1000 * 60)); // minutes

    return {
      duration,
      pnl: trade.pnl,
      entry_date: trade.entry_date,
      exit_date: trade.exit_date
    };
  });

  // Calculate average duration
  const averageDuration = chartData.length > 0
    ? chartData.reduce((sum, trade) => sum + trade.duration, 0) / chartData.length
    : 0;

  // Theme-aware colors
  const textColor = isDark ? '#e2e8f0' : '#1e293b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  const axisColor = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';

  if (chartData.length === 0) {
    return (
      <div className="w-full h-full bg-[#0a0a0a] rounded-xl border border-neutral-800 flex items-center justify-center">
        <div className="text-neutral-500">No trade data available</div>
      </div>
    );
  }

  const chartContent = (
    <div className="w-full h-full bg-[#0a0a0a] rounded-xl border border-neutral-800">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart
          margin={{ top: 20, right: 30, left: 45, bottom: 20 }}
        >
          <defs>
            <linearGradient id="profitGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#d4d4d4" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#a3a3a3" stopOpacity="0.6" />
            </linearGradient>
            <linearGradient id="lossGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#737373" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#525252" stopOpacity="0.6" />
            </linearGradient>
            <filter id="glowText" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis
            type="number"
            dataKey="duration"
            name="Duration (minutes)"
            unit="min"
            tick={{
              fontSize: 12,
              fill: '#a3a3a3'
            }}
            stroke="#525252"
            tickFormatter={(value) => formatDuration(value)}
          />
          <YAxis
            type="number"
            dataKey="pnl"
            name="P&L"
            unit="$"
            tick={{
              fontSize: 12,
              fill: '#a3a3a3'
            }}
            stroke="#525252"
            tickFormatter={(value) => formatCurrency(value)}
          />
          <Tooltip content={<CustomTooltip />} />
          <Scatter data={chartData} fill="#8884d8">
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.pnl >= 0 ? "url(#profitGradient)" : "url(#lossGradient)"}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );

  if (!showCard) return chartContent;

  return (
    <Card className="shadow-lg hover:shadow-xl transition-all duration-300 hover:shadow-blue-500/10 overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-900 dark:to-slate-800 from-slate-50 to-slate-100">
      <CardHeader className="bg-blue-500/10 dark:bg-blue-500/20">
        <CardTitle className="text-white dark:text-slate-900 flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-500/20 dark:bg-blue-500/30">
            <Clock className="h-4 w-4 text-blue-400 dark:text-blue-600" />
          </div>
          Trade Duration vs P&L
          <div className="ml-auto flex items-center gap-2">
            <span className="text-lg font-bold text-blue-400 dark:text-blue-600">
              {averageDuration.toFixed(0)}m
            </span>
            <div className="flex items-center gap-1 text-sm text-blue-400 dark:text-blue-600">
              <ChevronUp className="h-4 w-4" />
              <span>Avg Duration</span>
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {chartContent}
      </CardContent>
    </Card>
  );
}
