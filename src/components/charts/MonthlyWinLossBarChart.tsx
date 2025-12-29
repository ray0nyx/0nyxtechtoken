import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format, parseISO, startOfMonth } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, ChevronUp, ChevronDown } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

interface MonthlyWinLossBarChartProps {
  trades?: any[];
  showCard?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0a0a0a] border border-neutral-800 rounded-lg shadow-lg p-3 backdrop-blur-sm">
        <p className="font-medium text-white mb-1">{label}</p>
        <p className="text-sm text-neutral-300">
          Winning Days: {payload[0]?.value || 0}
        </p>
        <p className="text-sm text-neutral-500">
          Losing Days: {payload[1]?.value || 0}
        </p>
        <p className="text-sm text-neutral-400">
          Break Even Days: {payload[2]?.value || 0}
        </p>
      </div>
    );
  }
  return null;
};

export function MonthlyWinLossBarChart({ trades = [], showCard = true }: MonthlyWinLossBarChartProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const data = React.useMemo(() => {
    if (!trades?.length) return [];

    interface MonthlyData {
      winningDays: number;
      losingDays: number;
      breakEvenDays: number;
    }

    // Group trades by month
    const monthlyData = trades.reduce((acc, trade) => {
      const date = new Date(trade.entry_date);
      const monthStart = startOfMonth(date);
      const monthKey = format(monthStart, 'yyyy-MM-dd');

      if (!acc[monthKey]) {
        acc[monthKey] = { winningDays: 0, losingDays: 0, breakEvenDays: 0 };
      }

      // Check if this is a winning, losing, or break-even day
      if (trade.pnl > 0) {
        acc[monthKey].winningDays++;
      } else if (trade.pnl < 0) {
        acc[monthKey].losingDays++;
      } else {
        acc[monthKey].breakEvenDays++;
      }

      return acc;
    }, {} as Record<string, MonthlyData>);

    // Convert to chart data
    return Object.entries(monthlyData).map(([month, data]) => ({
      month: format(parseISO(month), 'MMM yyyy'),
      winningDays: data.winningDays,
      losingDays: data.losingDays,
      breakEvenDays: data.breakEvenDays,
      totalDays: data.winningDays + data.losingDays + data.breakEvenDays
    }));
  }, [trades]);

  // Calculate current metrics
  const currentWinningDays = data.length > 0 ? data[data.length - 1].winningDays : 0;
  const currentLosingDays = data.length > 0 ? data[data.length - 1].losingDays : 0;
  const currentBreakEvenDays = data.length > 0 ? data[data.length - 1].breakEvenDays : 0;

  // Theme-aware colors
  const textColor = isDark ? '#e2e8f0' : '#1e293b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  const axisColor = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';

  const chartContent = (
    <div className="w-full h-full bg-[#0a0a0a] rounded-xl border border-neutral-800">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}>
            Monthly Win/Loss Distribution
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}>
                Winning Days:
              </span>
              <span
                className="text-sm font-bold"
                style={{ color: theme === 'dark' ? 'rgb(107 114 128)' : 'rgb(107 114 128)' }}
              >
                {currentWinningDays}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}>
                Losing Days:
              </span>
              <span
                className="text-sm font-bold"
                style={{ color: theme === 'dark' ? 'rgb(209 213 219)' : 'rgb(209 213 219)' }}
              >
                {currentLosingDays}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="px-4 pb-4" style={{ height: 'calc(100% - 80px)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="winningDaysGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#d4d4d4" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#a3a3a3" stopOpacity="0.4" />
              </linearGradient>
              <linearGradient id="losingDaysGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#737373" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#525252" stopOpacity="0.4" />
              </linearGradient>
              <linearGradient id="breakEvenDaysGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#404040" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#262626" stopOpacity="0.4" />
              </linearGradient>
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
              dataKey="month"
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
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar
              dataKey="winningDays"
              fill="url(#winningDaysGradient)"
              radius={[4, 4, 0, 0]}
              name="Winning Days"
            />
            <Bar
              dataKey="losingDays"
              fill="url(#losingDaysGradient)"
              radius={[4, 4, 0, 0]}
              name="Losing Days"
            />
            <Bar
              dataKey="breakEvenDays"
              fill="url(#breakEvenDaysGradient)"
              radius={[4, 4, 0, 0]}
              name="Break Even Days"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  if (!showCard) return chartContent;

  return (
    <Card className="shadow-lg hover:shadow-xl transition-all duration-300 hover:shadow-gray-500/10 overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-900 dark:to-slate-800 from-slate-50 to-slate-100">
      <CardHeader className="bg-gray-500/10 dark:bg-gray-500/20">
        <CardTitle className="text-white dark:text-slate-900 flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gray-500/20 dark:bg-gray-500/30">
            <Calendar className="h-4 w-4 text-gray-500" />
          </div>
          Monthly Win/Loss Days
          <div className="ml-auto flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Winning:</span>
              <span className="text-lg font-bold text-gray-500">
                {currentWinningDays} days
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-300">Losing:</span>
              <span className="text-lg font-bold text-gray-300">
                {currentLosingDays} days
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Break Even:</span>
              <span className="text-lg font-bold text-gray-400">
                {currentBreakEvenDays} days
              </span>
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
