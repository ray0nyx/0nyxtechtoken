import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { formatCurrency } from '@/lib/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingDown, ChevronUp, ChevronDown } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

interface DrawdownPnLChartProps {
  trades: any[];
  showCard?: boolean;
}

export function DrawdownPnLChart({ trades = [], showCard = true }: DrawdownPnLChartProps) {
  // Process trades to calculate cumulative PnL and drawdown
  const calculateMetrics = (trades: any[]) => {
    if (!trades.length) return [];

    // Sort trades by date
    const sortedTrades = [...trades].sort((a, b) =>
      new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()
    );

    let runningPnL = 0;
    let peak = 0;
    let currentDrawdown = 0;
    let maxDrawdown = 0;

    return sortedTrades.reduce((acc: any[], trade) => {
      // Calculate cumulative PnL
      runningPnL += (trade.pnl || 0);

      // Update peak and calculate drawdown
      if (runningPnL > peak) {
        peak = runningPnL;
        currentDrawdown = 0;
      } else {
        currentDrawdown = peak - runningPnL;
        maxDrawdown = Math.max(maxDrawdown, currentDrawdown);
      }

      const date = new Date(trade.entry_date);
      const formattedDate = `${date.getMonth() + 1}/${date.getDate()}`;

      acc.push({
        date: formattedDate,
        pnl: parseFloat(runningPnL.toFixed(2)),
        drawdown: -parseFloat(currentDrawdown.toFixed(2)) // Negative to show below zero
      });

      return acc;
    }, []);
  };

  const data = calculateMetrics(trades);

  // Custom tooltip formatter
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#0a0a0a] p-3 rounded-lg shadow-lg border border-neutral-800">
          <p className="text-sm font-medium mb-1 text-white">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p
              key={index}
              className={`text-sm font-bold ${entry.name === 'P&L' ? 'text-neutral-300' : 'text-neutral-500'
                }`}
            >
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Calculate current metrics for display
  const currentPnL = data[data.length - 1]?.pnl || 0;
  const currentDrawdown = data[data.length - 1]?.drawdown || 0;
  const maxDrawdown = Math.max(...data.map((d: any) => d.drawdown || 0));

  const getPercentageChange = (current: number, previous: number) => {
    if (!previous || previous === 0) return 0;
    return ((current - previous) / Math.abs(previous)) * 100;
  };

  const previousPnL = data[data.length - 2]?.pnl || 0;
  const previousDrawdown = data[data.length - 2]?.drawdown || 0;
  const pnlChange = getPercentageChange(currentPnL, previousPnL);
  const drawdownChange = getPercentageChange(currentDrawdown, previousDrawdown);

  // Theme-aware colors
  const textColor = isDark ? '#e2e8f0' : '#1e293b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  const axisColor = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';

  const chartContent = (
    <div className="w-full h-full bg-[#0a0a0a] rounded-xl border border-neutral-800">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}>
            P&L and Drawdown
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}>
                P&L Change:
              </span>
              <span
                className="text-sm font-bold"
                style={{
                  color: pnlChange >= 0
                    ? theme === 'dark' ? 'rgb(107 114 128)' : 'rgb(107 114 128)'
                    : theme === 'dark' ? 'rgb(209 213 219)' : 'rgb(209 213 219)'
                }}
              >
                {pnlChange >= 0 ? '+' : ''}{pnlChange.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}>
                Drawdown Change:
              </span>
              <span
                className="text-sm font-bold"
                style={{
                  color: drawdownChange >= 0
                    ? theme === 'dark' ? 'rgb(209 213 219)' : 'rgb(209 213 219)'
                    : theme === 'dark' ? 'rgb(107 114 128)' : 'rgb(107 114 128)'
                }}
              >
                {drawdownChange >= 0 ? '+' : ''}{drawdownChange.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="px-4 pb-4" style={{ height: 'calc(100% - 80px)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <defs>
              <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d4d4d4" stopOpacity={0.8} />
                <stop offset="50%" stopColor="#a3a3a3" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#737373" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#737373" stopOpacity={0.8} />
                <stop offset="50%" stopColor="#525252" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#404040" stopOpacity={0.1} />
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
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.3} />
            <XAxis
              dataKey="date"
              tick={{
                fill: '#a3a3a3',
                fontSize: 12
              }}
              tickLine={{ stroke: '#525252' }}
              axisLine={{ stroke: '#525252' }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{
                fill: '#a3a3a3',
                fontSize: 12
              }}
              tickLine={{ stroke: '#525252' }}
              axisLine={{ stroke: '#525252' }}
              label={{
                value: 'Value ($)',
                angle: -90,
                position: 'insideLeft',
                style: {
                  textAnchor: 'middle',
                  fill: '#a3a3a3',
                  fontSize: '12px'
                }
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{
                color: textColor,
                fontSize: '12px'
              }}
            />
            <Line
              type="monotone"
              dataKey="pnl"
              name="P&L"
              stroke="#a3a3a3"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 6, stroke: '#d4d4d4', strokeWidth: 2, fill: '#fff' }}
              fill="url(#pnlGradient)"
            />
            <Line
              type="monotone"
              dataKey="drawdown"
              name="Drawdown"
              stroke="#525252"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 6, stroke: '#737373', strokeWidth: 2, fill: '#fff' }}
              fill="url(#drawdownGradient)"
            />
          </LineChart>
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
              <TrendingDown className="h-4 w-4 text-gray-500" />
            </div>
            P&L and Drawdown Chart
          </CardTitle>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-slate-400 dark:text-slate-600">Current P&L</div>
              <div className={`text-lg font-bold ${currentPnL >= 0 ? 'text-gray-500' : 'text-gray-300'}`}>
                {formatCurrency(currentPnL)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-400 dark:text-slate-600">Max Drawdown</div>
              <div className="text-lg font-bold text-gray-300">
                {formatCurrency(maxDrawdown)}
              </div>
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