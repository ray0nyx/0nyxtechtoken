import React from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { formatCurrency } from '@/lib/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, ChevronUp, ChevronDown } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

interface TradingDotChartProps {
  trades?: any[];
  showCard?: boolean;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#0a0a0a] backdrop-blur-sm border border-neutral-800 rounded-xl shadow-2xl p-4">
        <p className="text-sm font-medium text-white mb-2">{data.day}</p>
        <p className={`text-sm font-semibold ${data.pnl >= 0 ? 'text-neutral-300' : 'text-neutral-500'}`}>
          PnL: {formatCurrency(data.pnl)}
        </p>
      </div>
    );
  }
  return null;
};

export function TradingDotChart({ trades = [], showCard = true }: TradingDotChartProps) {
  const data = React.useMemo(() => {
    if (!trades?.length) return [];

    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Group trades by day and calculate PnL
    const tradesByDay = trades.reduce((acc, trade) => {
      const date = new Date(trade.entry_date);
      const dayIndex = date.getDay();
      const day = daysOfWeek[dayIndex];
      const pnl = trade.pnl || 0;

      if (!acc[day]) {
        acc[day] = [];
      }
      acc[day].push({
        pnl,
        dayIndex,
        day
      });
      return acc;
    }, {});

    // Convert to array format for scatter plot
    return Object.entries(tradesByDay).flatMap(([day, trades]: [string, any[]]) => {
      return trades.map((trade) => ({
        dayIndex: trade.dayIndex,
        day: trade.day,
        pnl: trade.pnl,
        // Add small random offset to spread dots horizontally
        x: trade.dayIndex + (Math.random() * 0.8 - 0.4), // Spread dots ±0.4 around the day index
      }));
    });
  }, [trades]);

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        No trade data available
      </div>
    );
  }

  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Calculate current metrics for display
  const totalTrades = data.length;
  const winningTrades = data.filter((trade: any) => trade.pnl > 0).length;
  const losingTrades = data.filter((trade: any) => trade.pnl < 0).length;
  const totalPnL = data.reduce((sum: number, trade: any) => sum + trade.pnl, 0);

  // Theme-aware colors
  const textColor = isDark ? '#e2e8f0' : '#1e293b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  const axisColor = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';

  const chartContent = (
    <div className="w-full h-full bg-[#0a0a0a] rounded-xl border border-neutral-800">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}>
            P&L by Day of Week
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}>
                Total Trades:
              </span>
              <span
                className="text-sm font-bold"
                style={{ color: theme === 'dark' ? 'rgb(59 130 246)' : 'rgb(59 130 246)' }}
              >
                {totalTrades}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}>
                Win Rate:
              </span>
              <span
                className="text-sm font-bold"
                style={{ color: theme === 'dark' ? 'rgb(34 197 94)' : 'rgb(34 197 94)' }}
              >
                {totalTrades > 0 ? ((winningTrades / totalTrades) * 100).toFixed(1) : '0.0'}%
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="px-4 pb-4" style={{ height: 'calc(100% - 80px)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart
            margin={{
              top: 10,
              right: 40,
              left: 40,
              bottom: 20,
            }}
          >
            <defs>
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
              dataKey="x"
              type="number"
              domain={[-0.5, 6.5]}
              tickFormatter={(value) => {
                const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                return days[Math.round(value)];
              }}
              ticks={[0, 1, 2, 3, 4, 5, 6]}
              tick={{
                fill: '#a3a3a3',
                fontSize: 12
              }}
              tickLine={{ stroke: '#525252' }}
              axisLine={{ stroke: '#525252' }}
            />
            <YAxis
              dataKey="pnl"
              tickFormatter={(value) => formatCurrency(value)}
              tick={{
                fill: '#a3a3a3',
                fontSize: 12
              }}
              tickLine={{ stroke: '#525252' }}
              axisLine={{ stroke: '#525252' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Scatter name="Trades" data={data}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.pnl >= 0 ? '#d4d4d4' : '#525252'}
                  fillOpacity={0.6}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  if (!showCard) {
    return chartContent;
  }

  return (
    <Card className="border-slate-700/50 dark:border-slate-700/50 border-slate-200/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:shadow-cyan-500/10 overflow-hidden bg-slate-900 dark:bg-slate-900">
      <CardHeader className="bg-cyan-500/10 dark:bg-cyan-500/20 pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-medium text-white dark:text-slate-900 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/20 dark:bg-cyan-500/30">
              <Activity className="h-4 w-4 text-cyan-400 dark:text-cyan-600" />
            </div>
            Trading Dot Chart
          </CardTitle>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-slate-400 dark:text-slate-600">Total Trades</div>
              <div className="text-lg font-bold text-slate-300 dark:text-slate-600">{totalTrades}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-400 dark:text-slate-600">Total P&L</div>
              <div className={`text-lg font-bold ${totalPnL >= 0 ? 'text-blue-400 dark:text-blue-600' : 'text-purple-400 dark:text-purple-600'}`}>
                {formatCurrency(totalPnL)}
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