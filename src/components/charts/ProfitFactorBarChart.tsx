import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatDate } from '@/lib/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, ChevronUp, ChevronDown } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

interface ProfitFactorBarChartProps {
  trades?: any[];
  showCard?: boolean;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#0a0a0a] border border-neutral-800 rounded-lg shadow-lg p-3 backdrop-blur-sm">
        <p className="font-medium text-white mb-1">
          {formatDate(data.date, 'short')}
        </p>
        <p className="text-sm text-neutral-300">
          Profit Factor: {data.profitFactor.toFixed(2)}
        </p>
      </div>
    );
  }
  return null;
};

export function ProfitFactorBarChart({ trades = [], showCard = true }: ProfitFactorBarChartProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const data = React.useMemo(() => {
    if (!trades?.length) return [];

    // Group trades by month
    const monthlyData = trades.reduce((acc, trade) => {
      // Handle different date formats
      let date;
      if (trade.entry_date) {
        date = new Date(trade.entry_date);
      } else if (trade.date) {
        date = new Date(trade.date);
      } else {
        return acc;
      }

      // Check if date is valid
      if (isNaN(date.getTime())) {
        return acc;
      }

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!acc[monthKey]) {
        acc[monthKey] = { wins: 0, losses: 0 };
      }

      // Parse PnL as number to ensure proper calculation
      const pnlValue = parseFloat(trade.pnl?.toString() || '0');

      if (pnlValue > 0) {
        acc[monthKey].wins += pnlValue;
      } else if (pnlValue < 0) {
        acc[monthKey].losses += Math.abs(pnlValue);
      }

      return acc;
    }, {} as Record<string, { wins: number; losses: number }>);

    // Generate all months from earliest trade month to current month
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Get all months that have trade data
    const tradeMonths = Object.keys(monthlyData);
    const earliestMonth = tradeMonths.length > 0 ? tradeMonths[0] : currentMonthKey;

    // Generate all months from earliest to current (inclusive)
    const allMonths = [];
    const startDate = new Date(earliestMonth + '-01');
    const endDate = new Date(currentMonthKey + '-01');

    // Generate months from start to end (inclusive)
    for (let date = new Date(startDate); date <= endDate; date.setMonth(date.getMonth() + 1)) {
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      allMonths.push(monthKey);
    }

    // Always ensure current month is included
    if (!allMonths.includes(currentMonthKey)) {
      allMonths.push(currentMonthKey);
    }

    // Also ensure we include any months that have trade data but might not be in the generated range
    tradeMonths.forEach(month => {
      if (!allMonths.includes(month)) {
        allMonths.push(month);
      }
    });

    // Sort the months to ensure proper order
    allMonths.sort();

    // Convert to chart data
    return allMonths.map(monthKey => {
      const data = monthlyData[monthKey] || { wins: 0, losses: 0 };

      // Parse the month key correctly (format: YYYY-MM)
      const [year, monthNum] = monthKey.split('-');
      const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);

      return {
        date: monthKey + '-01',
        period: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        profitFactor: data.losses > 0 ? data.wins / data.losses : data.wins > 0 ? 2 : 0,
        wins: data.wins,
        losses: data.losses
      };
    });
  }, [trades]);

  // Calculate current profit factor and percentage change
  const currentProfitFactor = data.length > 0 ? data[data.length - 1].profitFactor : 0;
  const previousProfitFactor = data.length > 1 ? data[data.length - 2].profitFactor : 0;
  const percentageChange = previousProfitFactor !== 0 ? ((currentProfitFactor - previousProfitFactor) / previousProfitFactor) * 100 : 0;

  // Theme-aware colors
  const textColor = isDark ? '#e2e8f0' : '#1e293b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  const axisColor = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';

  const chartContent = (
    <div className="w-full h-full bg-[#0a0a0a] rounded-xl border border-neutral-800">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}>
            Profit Factor Bar Chart
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-sm" style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}>
              Profit Factor Change:
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
      <div className="px-4 pb-4" style={{ height: 'calc(100% - 80px)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="profitFactorGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#d4d4d4" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#a3a3a3" stopOpacity="0.4" />
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
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="profitFactor"
              fill="url(#profitFactorGradient)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  if (!showCard) return chartContent;

  return (
    <Card className="shadow-lg hover:shadow-xl transition-all duration-300 hover:shadow-emerald-500/10 overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-900 dark:to-slate-800 from-slate-50 to-slate-100">
      <CardHeader className="bg-emerald-500/10 dark:bg-emerald-500/20">
        <CardTitle className="text-white dark:text-slate-900 flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/20 dark:bg-emerald-500/30">
            <BarChart3 className="h-4 w-4 text-emerald-400 dark:text-emerald-600" />
          </div>
          Profit Factor Distribution
          <div className="ml-auto flex items-center gap-2">
            <span className="text-lg font-bold text-emerald-400 dark:text-emerald-600">
              {currentProfitFactor.toFixed(2)}
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
