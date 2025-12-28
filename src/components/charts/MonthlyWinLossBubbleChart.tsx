import React from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format, parseISO, startOfMonth, getDaysInMonth } from 'date-fns';
import { formatCurrency } from '@/lib/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, ChevronUp, ChevronDown } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

interface MonthlyWinLossBubbleChartProps {
  trades?: any[];
  showCard?: boolean;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#0a0a0a] backdrop-blur-sm border border-neutral-800 rounded-xl shadow-2xl p-4">
        <p className="text-sm font-medium text-white mb-2">{data.monthDay}</p>
        <p
          className="text-sm font-semibold"
          style={{
            color: data.pnl > 0 ? '#d4d4d4' : data.pnl < 0 ? '#525252' : '#404040'
          }}
        >
          P&L: {formatCurrency(data.pnl)}
        </p>
      </div>
    );
  }
  return null;
};

export function MonthlyWinLossBubbleChart({ trades = [], showCard = true }: MonthlyWinLossBubbleChartProps) {
  const data = React.useMemo(() => {
    if (!trades?.length) return [];

    // Group trades by day
    const dailyResults = trades.reduce((acc: any, trade: any) => {
      const date = parseISO(trade.entry_date);
      const dateStr = format(date, 'yyyy-MM-dd');
      if (!acc[dateStr]) {
        acc[dateStr] = {
          date,
          pnl: 0,
          monthDay: format(date, 'MMM d'),
          x: date.getDate(), // Day of month for X-axis
          y: date.getMonth(), // Month for Y-axis
        };
      }
      acc[dateStr].pnl += trade.pnl;
      return acc;
    }, {});

    // Convert to array and calculate bubble sizes
    const tradeDays = Object.values(dailyResults);
    const maxAbsPnL = Math.max(...tradeDays.map((day: any) => Math.abs(day.pnl)));

    return tradeDays.map((day: any) => ({
      ...day,
      size: Math.max(20, Math.abs(day.pnl) / maxAbsPnL * 60), // Scale bubble size between 20 and 60
    }));
  }, [trades]);

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        No trade data available
      </div>
    );
  }

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Calculate current metrics for display
  const totalDays = data.length;
  const winningDays = data.filter((day: any) => day.pnl > 0).length;
  const losingDays = data.filter((day: any) => day.pnl < 0).length;
  const breakEvenDays = data.filter((day: any) => day.pnl === 0).length;

  // Theme-aware colors
  const textColor = isDark ? '#e2e8f0' : '#1e293b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  const axisColor = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';

  const chartContent = (
    <div className="w-full h-full bg-[#0a0a0a] rounded-xl border border-neutral-800">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart
          margin={{
            top: 20,
            right: 30,
            left: 30,
            bottom: 20,
          }}
        >
          <defs>
            <linearGradient id="winGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d4d4d4" stopOpacity={0.8} />
              <stop offset="50%" stopColor="#a3a3a3" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#737373" stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id="lossGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#737373" stopOpacity={0.8} />
              <stop offset="50%" stopColor="#525252" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#404040" stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id="breakEvenGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#404040" stopOpacity={0.8} />
              <stop offset="50%" stopColor="#262626" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#171717" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
          <XAxis
            dataKey="x"
            type="number"
            domain={[1, 31]}
            tickCount={31}
            tick={{ fill: '#a3a3a3', fontSize: 12 }}
            tickLine={{ stroke: '#525252' }}
            axisLine={{ stroke: '#525252' }}
            label={{ value: 'Day of Month', position: 'bottom', offset: 0, style: { textAnchor: 'middle', fill: '#a3a3a3' } }}
          />
          <YAxis
            dataKey="y"
            type="number"
            domain={[0, 11]}
            tickFormatter={(value) => months[value]}
            tick={{ fill: '#a3a3a3', fontSize: 12 }}
            tickLine={{ stroke: '#525252' }}
            axisLine={{ stroke: '#525252' }}
            label={{ value: 'Month', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#a3a3a3' } }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="top"
            height={36}
            content={({ payload }: any) => (
              <div className="flex justify-center gap-4">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-neutral-300 mr-2" />
                  <span className="text-sm text-slate-300">Winning Days</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-neutral-600 mr-2" />
                  <span className="text-sm text-slate-300">Losing Days</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-neutral-700 mr-2" />
                  <span className="text-sm text-slate-300">Break Even Days</span>
                </div>
              </div>
            )}
          />
          <Scatter
            data={data}
            shape="circle"
            fill={(entry: any) =>
              entry.pnl > 0 ? 'url(#winGradient)' :
                entry.pnl < 0 ? 'url(#lossGradient)' :
                  'url(#breakEvenGradient)'
            }
            stroke={(entry: any) =>
              entry.pnl > 0 ? '#d4d4d4' :
                entry.pnl < 0 ? '#525252' :
                  '#404040'
            }
          />
        </ScatterChart>
      </ResponsiveContainer>
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
            Monthly Win/Loss Bubble Chart
          </CardTitle>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-slate-400 dark:text-slate-600">Winning Days</div>
              <div className="text-lg font-bold text-blue-400 dark:text-blue-600">{winningDays}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-400 dark:text-slate-600">Losing Days</div>
              <div className="text-lg font-bold text-purple-400 dark:text-purple-600">{losingDays}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-400 dark:text-slate-600">Break Even</div>
              <div className="text-lg font-bold text-orange-400 dark:text-orange-600">{breakEvenDays}</div>
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