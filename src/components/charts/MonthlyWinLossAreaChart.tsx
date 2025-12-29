import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, ChevronUp, ChevronDown } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

interface MonthlyWinLossAreaChartProps {
  trades: any[];
  showCard?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0a0a0a] backdrop-blur-sm border border-neutral-800 rounded-xl shadow-2xl p-4">
        <p className="text-sm font-medium text-white mb-2">{label}</p>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-neutral-300">
            Winning Days: {payload[0].value}
          </p>
          <p className="text-sm font-semibold text-neutral-500">
            Losing Days: {Math.abs(payload[1].value)}
          </p>
          <p className="text-sm font-semibold text-neutral-400">
            Break-even Days: {payload[2].value}
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export function MonthlyWinLossAreaChart({ trades, showCard = true }: MonthlyWinLossAreaChartProps) {
  const data = React.useMemo(() => {
    if (!trades?.length) return [];

    interface MonthlyData {
      month: string;
      winningDays: number;
      losingDays: number;
      breakEvenDays: number;
    }

    const monthlyData = trades.reduce((acc: Record<string, MonthlyData>, trade: any) => {
      const date = parseISO(trade.entry_date);
      const monthKey = format(date, 'MMM yyyy');

      if (!acc[monthKey]) {
        acc[monthKey] = {
          month: monthKey,
          winningDays: 0,
          losingDays: 0,
          breakEvenDays: 0,
        };
      }

      const pnl = trade.exit_price - trade.entry_price;
      if (pnl > 0) {
        acc[monthKey].winningDays += 1;
      } else if (pnl < 0) {
        acc[monthKey].losingDays -= 1; // Negative for stacking
      } else {
        acc[monthKey].breakEvenDays += 1;
      }

      return acc;
    }, {} as Record<string, MonthlyData>);

    return Object.values(monthlyData);
  }, [trades]);

  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Calculate current metrics for display
  const currentMonth = data[data.length - 1];
  const previousMonth = data[data.length - 2];
  const currentWinningDays = currentMonth?.winningDays || 0;
  const currentLosingDays = currentMonth?.losingDays || 0;
  const currentBreakEvenDays = currentMonth?.breakEvenDays || 0;

  const getPercentageChange = (current: number, previous: number) => {
    if (!previous || previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  const winningDaysChange = getPercentageChange(currentWinningDays, previousMonth?.winningDays || 0);
  const losingDaysChange = getPercentageChange(currentLosingDays, previousMonth?.losingDays || 0);

  // Theme-aware colors
  const textColor = isDark ? '#e2e8f0' : '#1e293b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  const axisColor = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';

  const chartContent = (
    <div className="w-full h-full bg-[#0a0a0a] rounded-xl border border-neutral-800">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}>
            Monthly Win/Loss Days
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}>
                Winning Days Change:
              </span>
              <span
                className="text-sm font-bold"
                style={{
                  color: winningDaysChange >= 0
                    ? theme === 'dark' ? 'rgb(107 114 128)' : 'rgb(107 114 128)'
                    : theme === 'dark' ? 'rgb(209 213 219)' : 'rgb(209 213 219)'
                }}
              >
                {winningDaysChange >= 0 ? '+' : ''}{winningDaysChange.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}>
                Losing Days Change:
              </span>
              <span
                className="text-sm font-bold"
                style={{
                  color: losingDaysChange >= 0
                    ? theme === 'dark' ? 'rgb(209 213 219)' : 'rgb(209 213 219)'
                    : theme === 'dark' ? 'rgb(107 114 128)' : 'rgb(107 114 128)'
                }}
              >
                {losingDaysChange >= 0 ? '+' : ''}{losingDaysChange.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="px-4 pb-4" style={{ height: 'calc(100% - 80px)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <defs>
              <linearGradient id="winningGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d4d4d4" stopOpacity={0.8} />
                <stop offset="50%" stopColor="#a3a3a3" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#737373" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="losingGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#737373" stopOpacity={0.8} />
                <stop offset="50%" stopColor="#525252" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#404040" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="breakEvenGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#404040" stopOpacity={0.8} />
                <stop offset="50%" stopColor="#262626" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#171717" stopOpacity={0.1} />
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
                fill: '#a3a3a3',
                fontSize: 12
              }}
              tickLine={{ stroke: '#525252' }}
              axisLine={{ stroke: '#525252' }}
            />
            <YAxis
              tick={{
                fill: '#a3a3a3',
                fontSize: 12
              }}
              tickLine={{ stroke: '#525252' }}
              axisLine={{ stroke: '#525252' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{
                color: textColor,
                fontSize: '12px'
              }}
            />
            <Area
              type="monotone"
              dataKey="winningDays"
              name="Winning Days"
              stroke="#a3a3a3"
              fill="url(#winningGradient)"
              stackId="1"
            />
            <Area
              type="monotone"
              dataKey="losingDays"
              name="Losing Days"
              stroke="#525252"
              fill="url(#losingGradient)"
              stackId="1"
            />
            <Area
              type="monotone"
              dataKey="breakEvenDays"
              name="Break-even Days"
              stroke="#404040"
              fill="url(#breakEvenGradient)"
              stackId="1"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  if (!showCard) {
    return chartContent;
  }

  return (
    <Card className="border-slate-700/50 dark:border-slate-700/50 border-slate-200/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:shadow-gray-500/10 overflow-hidden bg-slate-900 dark:bg-slate-900">
      <CardHeader className="bg-gray-500/10 dark:bg-gray-500/20 pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-medium text-white dark:text-slate-900 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gray-500/20 dark:bg-gray-500/30">
              <TrendingUp className="h-4 w-4 text-gray-500" />
            </div>
            Monthly Win/Loss Area Chart
          </CardTitle>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-slate-400 dark:text-slate-600">Winning Days</div>
              <div className="text-lg font-bold text-gray-500">{currentWinningDays}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-400 dark:text-slate-600">Losing Days</div>
              <div className="text-lg font-bold text-gray-300">{currentLosingDays}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-400 dark:text-slate-600">Break Even</div>
              <div className="text-lg font-bold text-gray-400">{currentBreakEvenDays}</div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {chartContent}
      </CardContent>
    </Card>
  );
} 