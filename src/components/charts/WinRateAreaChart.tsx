import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, ChevronUp, ChevronDown } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

interface WinRateAreaChartProps {
  trades: any[];
  showCard?: boolean;
}

export function WinRateAreaChart({ trades = [], showCard = true }: WinRateAreaChartProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Process trades to calculate win rate over time
  const data = React.useMemo(() => {
    if (trades.length === 0) return [];

    // Sort trades by date
    const sortedTrades = [...trades].sort((a, b) =>
      new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()
    );

    // Group trades by month
    const monthlyData = sortedTrades.reduce((acc, trade) => {
      const date = new Date(trade.entry_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!acc[monthKey]) {
        acc[monthKey] = { wins: 0, total: 0 };
      }

      acc[monthKey].total++;
      if (trade.pnl > 0) {
        acc[monthKey].wins++;
      }

      return acc;
    }, {} as Record<string, { wins: number; total: number }>);

    // Convert to chart data
    return Object.entries(monthlyData).map(([month, data]) => ({
      date: month + '-01',
      winRate: data.total > 0 ? (data.wins / data.total) * 100 : 0,
      wins: data.wins,
      total: data.total
    }));
  }, [trades]);

  // Calculate current win rate and percentage change
  const currentWinRate = data.length > 0 ? data[data.length - 1].winRate : 0;
  const previousWinRate = data.length > 1 ? data[data.length - 2].winRate : 0;
  const percentageChange = previousWinRate !== 0 ? ((currentWinRate - previousWinRate) / previousWinRate) * 100 : 0;

  // Theme-aware colors
  const textColor = isDark ? '#e2e8f0' : '#1e293b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  const axisColor = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';

  const chartContent = (
    <div className="w-full h-full bg-[#0a0a0a] rounded-xl border border-neutral-800">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}>
            Win Rate Area Chart
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-sm" style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}>
              Win Rate Change:
            </span>
            <span
              className="text-sm font-bold"
              style={{
                color: percentageChange >= 0
                  ? theme === 'dark' ? 'rgb(107 114 128)' : 'rgb(107 114 128)'
                  : theme === 'dark' ? 'rgb(209 213 219)' : 'rgb(209 213 219)'
              }}
            >
              {percentageChange >= 0 ? '+' : ''}{percentageChange.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
      <div style={{ height: 'calc(100% - 80px)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
          >
            <defs>
              <linearGradient id="winRateGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a3a3a3" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#a3a3a3" stopOpacity={0.1} />
              </linearGradient>
              <filter id="glowText" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.3} />
            <XAxis
              dataKey="date"
              tick={{
                fill: '#a3a3a3',
                fontSize: 12
              }}
              tickLine={{ stroke: '#525252' }}
              axisLine={{ stroke: '#525252' }}
              tickFormatter={(value) => format(parseISO(value), 'MMM yyyy')}
            />
            <YAxis
              tick={{
                fill: '#a3a3a3',
                fontSize: 12
              }}
              tickLine={{ stroke: '#525252' }}
              axisLine={{ stroke: '#525252' }}
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-[#0a0a0a] border border-neutral-800 rounded-lg shadow-lg p-3 backdrop-blur-sm">
                      <p className="font-medium text-white mb-1">
                        {format(parseISO(label), 'MMM yyyy')}
                      </p>
                      <p className="text-sm text-neutral-300">
                        Win Rate: {payload[0].value.toFixed(1)}%
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="winRate"
              stroke="#a3a3a3"
              strokeWidth={2}
              fill="url(#winRateGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  if (!showCard) return chartContent;

  return (
    <Card className="shadow-lg hover:shadow-xl transition-all duration-300 hover:shadow-purple-500/10 overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-900 dark:to-slate-800 from-slate-50 to-slate-100">
      <CardHeader className="bg-purple-500/10 dark:bg-purple-500/20">
        <CardTitle className="text-white dark:text-slate-900 flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-500/20 dark:bg-purple-500/30">
            <TrendingUp className="h-4 w-4 text-purple-400 dark:text-purple-600" />
          </div>
          Win Rate Area Chart
          <div className="ml-auto flex items-center gap-2">
            <span className="text-lg font-bold text-purple-400 dark:text-purple-600">
              {currentWinRate.toFixed(1)}%
            </span>
            {percentageChange !== 0 && (
              <div className={`flex items-center gap-1 text-sm ${percentageChange > 0 ? 'text-gray-500' : 'text-gray-300'}`}>
                {percentageChange > 0 ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                <span>{Math.abs(percentageChange).toFixed(1)}%</span>
              </div>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {chartContent}
      </CardContent>
    </Card>
  );
}
