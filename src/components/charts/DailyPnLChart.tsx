import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { format, parseISO } from 'date-fns';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { formatCurrency } from '@/lib/formatters';
import { Trade } from '@/types/trade';

interface DailyPnL {
  date: string;
  pnl: number;
  displayDate: string;
}

interface DailyPnLChartProps {
  trades: Trade[];
  limitMonths?: number;
  showCard?: boolean;
}

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
        fontSize={11}
        filter="url(#glowText)"
      >
        {formatCurrency(value)}
      </text>
    </g>
  );
};

export function DailyPnLChart({ trades, limitMonths, showCard = true }: DailyPnLChartProps) {
  const { theme } = useTheme();

  // Process trades into daily P&L data
  const chartData = useMemo(() => {
    if (!trades || trades.length === 0) return [];

    const dailyPnLMap = new Map<string, number>();

    trades.forEach((trade) => {
      const entryDate = trade.entry_date;
      if (!entryDate) return;

      const date = new Date(entryDate);
      const dateKey = date.toISOString().split('T')[0];

      if (dailyPnLMap.has(dateKey)) {
        dailyPnLMap.set(dateKey, dailyPnLMap.get(dateKey)! + (trade.pnl || 0));
      } else {
        dailyPnLMap.set(dateKey, trade.pnl || 0);
      }
    });

    // Convert to array and sort by date
    let dailyData = Array.from(dailyPnLMap.entries())
      .map(([date, pnl]) => ({
        date,
        pnl,
        displayDate: format(parseISO(date), 'MMM dd'),
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Apply month limit if specified
    if (limitMonths) {
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - limitMonths);
      dailyData = dailyData.filter(item => new Date(item.date) >= cutoffDate);
    }

    return dailyData;
  }, [trades, limitMonths]);

  // Calculate current metrics
  const currentDailyPnL = chartData.length > 0 ? chartData[chartData.length - 1]?.pnl || 0 : 0;
  const previousDailyPnL = chartData.length > 1 ? chartData[chartData.length - 2]?.pnl || 0 : 0;
  const percentageChange = previousDailyPnL !== 0 ? ((currentDailyPnL - previousDailyPnL) / Math.abs(previousDailyPnL)) * 100 : 0;
  const isPositive = percentageChange >= 0;

  const chartContent = (
    <div className="w-full h-full bg-[#0a0a0a] rounded-xl border border-neutral-800">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}>
            Daily P&L
          </h3>
          {chartData.length > 0 && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}>
                  Current P&L:
                </span>
                <span
                  className="text-sm font-bold"
                  style={{
                    color: currentDailyPnL >= 0
                      ? '#a3a3a3'
                      : '#525252'
                  }}
                >
                  {formatCurrency(currentDailyPnL)}
                </span>
                {percentageChange !== 0 && (
                  <div className={`flex items-center gap-1 text-xs ${isPositive ? 'text-emerald-400 dark:text-emerald-600' : 'text-red-400 dark:text-red-600'}`}>
                    {isPositive ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    <span>{Math.abs(percentageChange).toFixed(1)}%</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="px-4 pb-4" style={{ height: 'calc(100% - 80px)' }}>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No trading data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            >
              <defs>
                <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d4d4d4" stopOpacity={0.9} />
                  <stop offset="50%" stopColor="#a3a3a3" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#737373" stopOpacity={0.3} />
                </linearGradient>
                <linearGradient id="lossGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#737373" stopOpacity={0.9} />
                  <stop offset="50%" stopColor="#525252" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#404040" stopOpacity={0.3} />
                </linearGradient>
                <filter id="glowBar">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur" />
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
              <CartesianGrid strokeDasharray="1 1" stroke="rgba(255, 255, 255, 0.1)" opacity={0.3} />
              <XAxis
                dataKey="displayDate"
                stroke="#525252"
                fontSize={11}
                tick={{ fill: '#a3a3a3' }}
                tickMargin={10}
                angle={-45}
                textAnchor="end"
                height={60}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="number"
                tick={<CustomYAxisTick />}
                stroke="rgba(255, 255, 255, 0.6)"
                fontSize={11}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value: number) => [
                  <span style={{ color: value >= 0 ? '#a3a3a3' : '#525252', fontWeight: 'bold' }}>{formatCurrency(value || 0)}</span>,
                  <span style={{ color: '#a3a3a3' }}>Daily P&L</span>
                ]}
                labelFormatter={(label) => `Date: ${label}`}
                contentStyle={{
                  backgroundColor: 'rgba(10, 10, 10, 0.95)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
                  backdropFilter: 'blur(10px)',
                }}
              />
              <ReferenceLine y={0} stroke="rgba(255, 255, 255, 0.3)" strokeDasharray="2 2" />
              <Bar
                dataKey="pnl"
                radius={[4, 4, 0, 0]}
                filter="url(#glowBar)"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={`url(#${entry.pnl >= 0 ? 'profitGradient' : 'lossGradient'})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );

  if (!showCard) return chartContent;

  return chartContent;
}