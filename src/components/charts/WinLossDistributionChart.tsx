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
import { formatCurrency } from '@/lib/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, ChevronUp, ChevronDown } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

interface WinLossDistributionChartProps {
  trades?: any[];
  showCard?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0a0a0a] backdrop-blur-sm border border-neutral-800 rounded-xl shadow-2xl p-4">
        <p className="text-sm font-medium text-white mb-2">Week of {label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className={`text-sm font-semibold ${entry.dataKey === 'wins' ? 'text-neutral-300' : 'text-neutral-500'}`}>
            {entry.name}: {formatCurrency(Math.abs(entry.value))}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const CustomYAxisTick = ({ x, y, payload }: any) => {
  const value = payload.value;
  const isPositive = value >= 0;
  const color = isPositive ? '#a3a3a3' : '#525252';

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={4}
        textAnchor="end"
        fill={color}
        fontSize={12}
        filter="url(#glowText)"
      >
        {formatCurrency(Math.abs(value))}
      </text>
    </g>
  );
};

// Helper function to get week start date
const getWeekStartDate = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is sunday
  return new Date(d.setDate(diff));
};

// Helper function to format date as "MMM DD"
const formatDateKey = (date: Date) => {
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
};

export function WinLossDistributionChart({ trades = [], showCard = true }: WinLossDistributionChartProps) {
  const { theme } = useTheme();

  const data = React.useMemo(() => {
    if (!trades?.length) return [];

    // Group trades by week
    const weeklyData = trades.reduce((acc: any, trade: any) => {
      const date = new Date(trade.entry_date);
      const weekStart = getWeekStartDate(date);
      const weekKey = formatDateKey(weekStart);

      if (!acc[weekKey]) {
        acc[weekKey] = { wins: 0, losses: 0, timestamp: weekStart.getTime() };
      }

      if (trade.pnl > 0) {
        acc[weekKey].wins += trade.pnl;
      } else {
        acc[weekKey].losses += trade.pnl; // Keep negative for visual comparison
      }

      return acc;
    }, {});

    // Convert to array and sort by date
    return Object.entries(weeklyData)
      .map(([week, values]: [string, any]) => ({
        week,
        wins: values.wins,
        losses: values.losses,
        timestamp: values.timestamp,
      }))
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-12); // Show only last 12 weeks
  }, [trades]);

  // Calculate percentage change for trend indicator
  const getPercentageChange = () => {
    if (!data || data.length < 2) return 0;
    const firstValue = data[0]?.wins || 0;
    const lastValue = data[data.length - 1]?.wins || 0;
    if (firstValue === 0) return 0;
    return ((lastValue - firstValue) / Math.abs(firstValue)) * 100;
  };

  // Get current total wins
  const getCurrentWins = () => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return 0;
    }
    return data[data.length - 1]?.wins || 0;
  };

  const percentageChange = getPercentageChange();
  const isPositive = percentageChange >= 0;
  const currentWins = getCurrentWins();

  const chartContent = (
    <div className="w-full h-full bg-[#0a0a0a] rounded-xl border border-neutral-800">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}>
            Win/Loss Distribution by Month
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}>
                Current Wins:
              </span>
              <span
                className="text-sm font-bold"
                style={{ color: theme === 'dark' ? 'rgb(34 197 94)' : 'rgb(34 197 94)' }}
              >
                ${currentWins.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}>
                Change:
              </span>
              <span
                className="text-sm font-bold"
                style={{
                  color: isPositive
                    ? theme === 'dark' ? 'rgb(34 197 94)' : 'rgb(34 197 94)'
                    : theme === 'dark' ? 'rgb(239 68 68)' : 'rgb(239 68 68)'
                }}
              >
                {isPositive ? '+' : ''}{percentageChange.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="px-4 pb-4" style={{ height: 'calc(100% - 80px)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 20,
            }}
          >
            <defs>
              <linearGradient id="winsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d4d4d4" stopOpacity={0.9} />
                <stop offset="50%" stopColor="#a3a3a3" stopOpacity={0.6} />
                <stop offset="100%" stopColor="#737373" stopOpacity={0.3} />
              </linearGradient>
              <linearGradient id="lossesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#737373" stopOpacity={0.9} />
                <stop offset="50%" stopColor="#525252" stopOpacity={0.6} />
                <stop offset="100%" stopColor="#404040" stopOpacity={0.3} />
              </linearGradient>
              <filter id="glowBarWinLoss" x="-50%" y="-50%" width="200%" height="200%">
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
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" opacity={0.3} />
            <XAxis
              dataKey="week"
              tick={{ fill: '#a3a3a3', fontSize: 12 }}
              stroke="#525252"
            />
            <YAxis
              tick={<CustomYAxisTick />}
              stroke="rgba(255, 255, 255, 0.6)"
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar
              name="Winning Trades"
              dataKey="wins"
              fill="url(#winsGradient)"
              radius={[6, 6, 0, 0]}
              filter="url(#glowBarWinLoss)"
            />
            <Bar
              name="Losing Trades"
              dataKey="losses"
              fill="url(#lossesGradient)"
              radius={[6, 6, 0, 0]}
              filter="url(#glowBarWinLoss)"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  if (!data.length) {
    const emptyContent = (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        No trade data available
      </div>
    );

    if (!showCard) {
      return emptyContent;
    }

    return (
      <div className="w-full h-full bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center">
        <div className="text-slate-400 dark:text-slate-600">No trade data available</div>
      </div>
    );
  }

  if (!showCard) {
    return chartContent;
  }

  return (
    <Card className="shadow-lg hover:shadow-xl transition-all duration-300 hover:shadow-purple-500/10 overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-900 dark:to-slate-800 from-slate-50 to-slate-100">
      <CardHeader className="bg-purple-500/10 dark:bg-purple-500/20">
        <CardTitle className="text-white dark:text-slate-900 flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-500/20 dark:bg-purple-500/30">
            <div className="h-4 w-4 text-purple-400 dark:text-purple-600">📊</div>
          </div>
          Win/Loss Distribution by Month
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {chartContent}
      </CardContent>
    </Card>
  );
} 