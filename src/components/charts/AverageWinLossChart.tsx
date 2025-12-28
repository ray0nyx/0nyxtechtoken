import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format, parseISO, startOfWeek } from 'date-fns';
import { formatCurrency } from '@/lib/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, ChevronUp, ChevronDown } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

interface AverageWinLossChartProps {
  trades?: any[];
  showCard?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0a0a0a] border border-neutral-800 rounded-lg shadow-lg p-3 backdrop-blur-sm">
        <p className="font-medium text-white mb-1">{label}</p>
        <p className="text-sm text-neutral-300">
          Avg Win: {formatCurrency(payload[0]?.value || 0)}
        </p>
        <p className="text-sm text-neutral-500">
          Avg Loss: {formatCurrency(payload[1]?.value || 0)}
        </p>
      </div>
    );
  }
  return null;
};

export function AverageWinLossChart({ trades = [], showCard = true }: AverageWinLossChartProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const data = React.useMemo(() => {
    if (!trades?.length) return [];

    // Group trades by week
    const weeklyData = trades.reduce((acc, trade) => {
      const date = new Date(trade.entry_date);
      const weekStart = startOfWeek(date, { weekStartsOn: 1 }); // Monday
      const weekKey = format(weekStart, 'yyyy-MM-dd');

      if (!acc[weekKey]) {
        acc[weekKey] = { wins: [], losses: [] };
      }

      if (trade.pnl > 0) {
        acc[weekKey].wins.push(trade.pnl);
      } else if (trade.pnl < 0) {
        acc[weekKey].losses.push(Math.abs(trade.pnl));
      }

      return acc;
    }, {} as Record<string, { wins: number[]; losses: number[] }>);

    // Convert to chart data
    return Object.entries(weeklyData).map(([week, data]) => ({
      date: week,
      period: format(parseISO(week), 'MMM dd'),
      avgWin: data.wins.length > 0 ? data.wins.reduce((a, b) => a + b, 0) / data.wins.length : 0,
      avgLoss: data.losses.length > 0 ? data.losses.reduce((a, b) => a + b, 0) / data.losses.length : 0,
      winCount: data.wins.length,
      lossCount: data.losses.length
    }));
  }, [trades]);

  // Calculate current averages and percentage changes
  const currentAvgWin = data.length > 0 ? data[data.length - 1].avgWin : 0;
  const previousAvgWin = data.length > 1 ? data[data.length - 2].avgWin : 0;
  const winChange = previousAvgWin !== 0 ? ((currentAvgWin - previousAvgWin) / previousAvgWin) * 100 : 0;

  const currentAvgLoss = data.length > 0 ? data[data.length - 1].avgLoss : 0;
  const previousAvgLoss = data.length > 1 ? data[data.length - 2].avgLoss : 0;
  const lossChange = previousAvgLoss !== 0 ? ((currentAvgLoss - previousAvgLoss) / previousAvgLoss) * 100 : 0;

  // Theme-aware colors
  const textColor = isDark ? '#e2e8f0' : '#1e293b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  const axisColor = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';

  const chartContent = (
    <div className="w-full h-full bg-[#0a0a0a] rounded-xl border border-neutral-800">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}>
            Average Win/Loss Over Time
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}>
                Avg Win Change:
              </span>
              <span
                className="text-sm font-bold"
                style={{
                  color: winChange >= 0
                    ? theme === 'dark' ? 'rgb(34 197 94)' : 'rgb(34 197 94)'
                    : theme === 'dark' ? 'rgb(239 68 68)' : 'rgb(239 68 68)'
                }}
              >
                {winChange >= 0 ? '+' : ''}{winChange.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}>
                Avg Loss Change:
              </span>
              <span
                className="text-sm font-bold"
                style={{
                  color: lossChange >= 0
                    ? theme === 'dark' ? 'rgb(34 197 94)' : 'rgb(34 197 94)'
                    : theme === 'dark' ? 'rgb(239 68 68)' : 'rgb(239 68 68)'
                }}
              >
                {lossChange >= 0 ? '+' : ''}{lossChange.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="px-4 pb-4" style={{ height: 'calc(100% - 80px)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="avgWinGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#d4d4d4" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#a3a3a3" stopOpacity="0.2" />
              </linearGradient>
              <linearGradient id="avgLossGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#737373" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#525252" stopOpacity="0.2" />
              </linearGradient>
              <filter id="glowLine" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="glowText" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
            <XAxis
              dataKey="period"
              tick={{
                fontSize: 12,
                fill: '#a3a3a3'
              }}
              stroke="#525252"
            />
            <YAxis
              tick={{
                fontSize: 12,
                fill: '#a3a3a3'
              }}
              stroke="#525252"
              tickFormatter={(value) => formatCurrency(value)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line
              type="monotone"
              dataKey="avgWin"
              stroke="#a3a3a3"
              strokeWidth={2}
              dot={{ fill: '#d4d4d4', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#d4d4d4', strokeWidth: 2 }}
              name="Average Win"
            />
            <Line
              type="monotone"
              dataKey="avgLoss"
              stroke="#525252"
              strokeWidth={2}
              dot={{ fill: '#737373', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#737373', strokeWidth: 2 }}
              name="Average Loss"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  if (!showCard) return chartContent;

  return (
    <Card className="shadow-lg hover:shadow-xl transition-all duration-300 hover:shadow-orange-500/10 overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-900 dark:to-slate-800 from-slate-50 to-slate-100">
      <CardHeader className="bg-orange-500/10 dark:bg-orange-500/20">
        <CardTitle className="text-white dark:text-slate-900 flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-orange-500/20 dark:bg-orange-500/30">
            <TrendingUp className="h-4 w-4 text-orange-400 dark:text-orange-600" />
          </div>
          Average Win/Loss Over Time
          <div className="ml-auto flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-blue-400 dark:text-blue-600">Avg Win:</span>
              <span className="text-lg font-bold text-blue-400 dark:text-blue-600">
                {formatCurrency(currentAvgWin)}
              </span>
              {winChange !== 0 && (
                <div className={`flex items-center gap-1 text-xs ${winChange > 0 ? 'text-emerald-400 dark:text-emerald-600' : 'text-red-400 dark:text-red-600'}`}>
                  {winChange > 0 ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  <span>{Math.abs(winChange).toFixed(1)}%</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-purple-400 dark:text-purple-600">Avg Loss:</span>
              <span className="text-lg font-bold text-purple-400 dark:text-purple-600">
                {formatCurrency(currentAvgLoss)}
              </span>
              {lossChange !== 0 && (
                <div className={`flex items-center gap-1 text-xs ${lossChange > 0 ? 'text-emerald-400 dark:text-emerald-600' : 'text-red-400 dark:text-red-600'}`}>
                  {lossChange > 0 ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  <span>{Math.abs(lossChange).toFixed(1)}%</span>
                </div>
              )}
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
