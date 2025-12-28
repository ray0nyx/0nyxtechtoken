import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, ChevronUp, ChevronDown, RefreshCw } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { useTheme } from '@/components/ThemeProvider';

interface ProfitFactorChartProps {
  trades: any[];
  limitMonths?: number; // Optional prop to limit data to last N months
  showCard?: boolean;
}

const CustomYAxisTick = ({ x, y, payload }: any) => {
  const value = payload.value;
  const isPositive = value >= 0;
  const color = isPositive ? '#6b7280' : '#4b5563';

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
        {value.toFixed(2)}
      </text>
    </g>
  );
};

export function ProfitFactorChart({ trades = [], limitMonths, showCard = true }: ProfitFactorChartProps) {
  const { theme } = useTheme();


  // Process trades to calculate profit factor over time
  const calculateProfitFactorOverTime = (trades: any[]) => {
    if (!trades.length) {
      return [];
    }


    // Filter trades to last N months if limitMonths is provided
    let filteredTrades = trades;
    if (limitMonths) {
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - limitMonths);
      filteredTrades = trades.filter(trade =>
        new Date(trade.entry_date) >= cutoffDate
      );
    }

    // Sort trades by date
    const sortedTrades = [...filteredTrades].sort((a, b) => {
      const dateA = new Date(a.entry_date || a.date);
      const dateB = new Date(b.entry_date || b.date);
      return dateA.getTime() - dateB.getTime();
    });


    // Group trades by month
    const monthlyData = sortedTrades.reduce((acc, trade) => {
      // Handle different date formats
      let date;
      if (trade.entry_date) {
        date = new Date(trade.entry_date);
      } else if (trade.date) {
        date = new Date(trade.date);
      } else {
        console.warn('Trade missing date:', trade);
        return acc;
      }

      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date for trade:', trade.entry_date || trade.date, trade);
        return acc;
      }

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      // Parse PnL as number to ensure proper calculation
      const pnlValue = parseFloat(trade.pnl?.toString() || '0');


      if (!acc[monthKey]) {
        acc[monthKey] = { wins: 0, losses: 0 };
      }

      if (pnlValue > 0) {
        acc[monthKey].wins += pnlValue;
      } else if (pnlValue < 0) {
        acc[monthKey].losses += Math.abs(pnlValue);
      }

      return acc;
    }, {} as Record<string, { wins: number; losses: number }>);

    // Convert to chart data
    let chartData = Object.entries(monthlyData).map(([month, data]) => {
      let profitFactor = 0;
      if (data.losses > 0) {
        profitFactor = data.wins / data.losses;
      } else if (data.wins > 0) {
        // If there are wins but no losses, set a reasonable value
        profitFactor = 2; // This represents a good profit factor when no losses
      } else if (data.losses > 0 && data.wins === 0) {
        // If there are only losses, profit factor is 0
        profitFactor = 0;
      }


      // Parse the month key correctly (format: YYYY-MM)
      const [year, monthNum] = month.split('-');
      const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);

      return {
        period: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        profitFactor,
        wins: data.wins,
        losses: data.losses,
        monthKey: month
      };
    });

    // Generate all months from earliest trade month to current month
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Find the earliest month with trades
    const earliestMonth = chartData.length > 0 ? chartData[0].monthKey : currentMonthKey;

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
    const tradeMonths = Object.keys(monthlyData);
    tradeMonths.forEach(month => {
      if (!allMonths.includes(month)) {
        allMonths.push(month);
      }
    });

    // Sort the months to ensure proper order
    allMonths.sort();


    // Create a map of existing chart data
    const existingData = new Map(chartData.map(item => [item.monthKey, item]));

    // Rebuild chart data with all months
    chartData = allMonths.map(monthKey => {
      if (existingData.has(monthKey)) {
        const data = existingData.get(monthKey)!;
        return data;
      } else {
        // Parse the month key correctly (format: YYYY-MM)
        const [year, monthNum] = monthKey.split('-');
        const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);

        const newData = {
          period: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          profitFactor: 0,
          wins: 0,
          losses: 0,
          monthKey
        };
        return newData;
      }
    });


    // Sort again to ensure proper order
    chartData.sort((a, b) => a.monthKey.localeCompare(b.monthKey));

    // Ensure we always have a 0 value to force Y-axis to start from 0
    if (chartData.length > 0) {
      const minValue = Math.min(...chartData.map(d => d.profitFactor));
      if (minValue > 0) {
        chartData.unshift({
          period: 'Start',
          profitFactor: 0,
          wins: 0,
          losses: 0
        });
      }
    }

    return chartData;
  };

  let data;
  try {
    data = calculateProfitFactorOverTime(trades);

    // Fallback: If no data, at least show current month
    if (data.length === 0) {
      const now = new Date();
      const currentMonth = now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      data = [{
        period: currentMonth,
        profitFactor: 0,
        wins: 0,
        losses: 0
      }];
    }
  } catch (error) {
    console.error('ProfitFactorChart: Error calculating data:', error);
    data = [];
  }

  // Calculate overall profit factor from all trades
  const calculateOverallProfitFactor = (trades: any[]) => {
    if (!trades.length) return 0;

    const totalWins = trades.reduce((sum, trade) => sum + (trade.pnl > 0 ? trade.pnl : 0), 0);
    const totalLosses = Math.abs(trades.reduce((sum, trade) => sum + (trade.pnl < 0 ? trade.pnl : 0), 0));

    return totalLosses > 0 ? totalWins / totalLosses : 0;
  };

  const currentProfitFactor = calculateOverallProfitFactor(trades);
  const previousProfitFactor = data.length > 1 ? data[data.length - 2].profitFactor : 0;
  const percentageChange = previousProfitFactor !== 0 ? ((currentProfitFactor - previousProfitFactor) / previousProfitFactor) * 100 : 0;

  // Chart content for performance page (showCard={false}) - with text overlay
  const performanceChartContent = (
    <div className="w-full h-full bg-slate-50 dark:!bg-[#0a0a0a] rounded-xl">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}>
            Profit Factor Distribution
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-sm" style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}>
              Profit Factor Change:
            </span>
            <span
              className="text-sm font-bold"
              style={{
                color: percentageChange >= 0
                  ? theme === 'dark' ? 'rgb(34 197 94)' : 'rgb(34 197 94)'
                  : theme === 'dark' ? 'rgb(239 68 68)' : 'rgb(239 68 68)'
              }}
            >
              {percentageChange >= 0 ? '+' : ''}{percentageChange.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
      <div className="px-4 pb-4" style={{ height: 'calc(100% - 80px)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} key={`profit-factor-${data.length}-${Math.max(...data.map(d => d.profitFactor))}`}>
            <defs>
              <linearGradient id="profitFactorGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#6b7280" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#6b7280" stopOpacity="0.2" />
              </linearGradient>
              <filter id="glowLine" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" opacity={0.3} />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 12, fill: '#6b7280', filter: 'url(#glowText)' }}
              stroke="rgba(107, 114, 128, 0.6)"
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={<CustomYAxisTick />}
              stroke="rgba(255, 255, 255, 0.6)"
              domain={[0, 'dataMax + 1']}
              allowDataOverflow={false}
              allowDecimals={false}
              type="number"
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const profitFactor = payload[0].value;
                  const displayValue = profitFactor === 2 ? "Good (No Losses)" : profitFactor.toFixed(2);

                  return (
                    <div className="bg-slate-900/95 dark:bg-white/95 border border-slate-700/50 dark:border-slate-300/50 rounded-lg shadow-lg p-3 backdrop-blur-sm">
                      <p className="font-medium text-white dark:text-slate-900 mb-1">{label}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Profit Factor: {displayValue}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Line
              type="monotone"
              dataKey="profitFactor"
              stroke="#6b7280"
              strokeWidth={2}
              dot={{ fill: '#6b7280', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#6b7280', strokeWidth: 2 }}
              filter="url(#glowLine)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  // Chart content for analytics page (showCard={true}) - without text overlay
  const analyticsChartContent = (
    <div className="w-full h-full bg-slate-50 dark:!bg-[#0a0a0a] rounded-xl">
      <div className="px-4 pb-4" style={{ height: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} key={`profit-factor-${data.length}-${Math.max(...data.map(d => d.profitFactor))}`}>
            <defs>
              <linearGradient id="profitFactorGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#6b7280" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#6b7280" stopOpacity="0.2" />
              </linearGradient>
              <filter id="glowLine" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" opacity={0.3} />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 12, fill: '#6b7280', filter: 'url(#glowText)' }}
              stroke="rgba(107, 114, 128, 0.6)"
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={<CustomYAxisTick />}
              stroke="rgba(255, 255, 255, 0.6)"
              domain={[0, 'dataMax + 1']}
              allowDataOverflow={false}
              allowDecimals={false}
              type="number"
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const profitFactor = payload[0].value;
                  const displayValue = profitFactor === 2 ? "Good (No Losses)" : profitFactor.toFixed(2);

                  return (
                    <div className="bg-slate-900/95 dark:bg-white/95 border border-slate-700/50 dark:border-slate-300/50 rounded-lg shadow-lg p-3 backdrop-blur-sm">
                      <p className="font-medium text-white dark:text-slate-900 mb-1">{label}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Profit Factor: {displayValue}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Line
              type="monotone"
              dataKey="profitFactor"
              stroke="#6b7280"
              strokeWidth={2}
              dot={{ fill: '#6b7280', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#6b7280', strokeWidth: 2 }}
              filter="url(#glowLine)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  if (!showCard) return performanceChartContent;

  return (
    <Card
      className="w-full mb-8 overflow-hidden border border-gray-200 dark:border-slate-700/50 hover:border-gray-500/30 dark:hover:border-gray-500/30 hover:shadow-2xl hover:shadow-gray-500/10 transition-all duration-500 group"
      style={{
        backgroundColor: theme === 'dark' ? '#0a0a0a' : 'rgb(243 244 246)'
      }}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-4 px-6 pt-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gray-500/10 group-hover:bg-gray-500/20 transition-colors duration-300">
              <TrendingUp className="h-5 w-5 text-gray-500" />
            </div>
            <CardTitle className="text-lg font-semibold text-white dark:text-white text-slate-900">Profit Factor Distribution</CardTitle>
          </div>
          {data.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <div className="text-3xl font-bold text-gray-500">
                {currentProfitFactor.toFixed(2)}
              </div>
              {percentageChange !== 0 && (
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${percentageChange > 0
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-red-500/20 text-red-400'
                  }`}>
                  {percentageChange > 0 ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                  {Math.abs(percentageChange).toFixed(1)}%
                </div>
              )}
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.location.reload()}
          className="text-slate-400 hover:text-gray-500 hover:bg-gray-500/10 transition-colors duration-200"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <div className="h-[400px]">
          {analyticsChartContent}
        </div>
      </CardContent>
    </Card>
  );
}
