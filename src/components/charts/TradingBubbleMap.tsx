import React from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { formatCurrency } from '@/lib/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Map, ChevronUp, ChevronDown } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

interface TradingBubbleMapProps {
  trades: any[];
  showCard?: boolean;
}

export function TradingBubbleMap({ trades = [], showCard = true }: TradingBubbleMapProps) {
  const processTradeData = (trades: any[]) => {
    if (!trades.length) return [];

    // Sort trades by date
    const sortedTrades = [...trades].sort((a, b) =>
      new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()
    );

    return sortedTrades.map((trade, index) => {
      const date = new Date(trade.entry_date);
      const pnl = trade.pnl || 0;
      const isWin = pnl > 0;

      return {
        x: index, // x-axis: trade sequence
        y: date.getHours() + (date.getMinutes() / 60), // y-axis: time of day
        z: Math.abs(pnl), // bubble size
        pnl,
        isWin,
        date: `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`
      };
    });
  };

  const data = processTradeData(trades);

  // Find max absolute PnL for bubble scaling
  const maxPnL = Math.max(...data.map(d => Math.abs(d.pnl)));

  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Calculate current metrics for display
  const totalTrades = data.length;
  const winningTrades = data.filter((trade: any) => trade.isWin).length;
  const losingTrades = data.filter((trade: any) => !trade.isWin).length;
  const totalPnL = data.reduce((sum: number, trade: any) => sum + trade.pnl, 0);

  // Theme-aware colors
  const textColor = isDark ? '#e2e8f0' : '#1e293b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  const axisColor = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#0a0a0a] backdrop-blur-sm border border-neutral-800 rounded-xl shadow-2xl p-4">
          <p className="text-sm font-medium text-white mb-2">{data.date}</p>
          <p className={`text-sm font-semibold ${data.isWin ? 'text-neutral-300' : 'text-neutral-500'}`}>
            PnL: {formatCurrency(data.pnl)}
          </p>
        </div>
      );
    }
    return null;
  };

  // Calculate percentage changes
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const previousWinRate = 65; // Example previous win rate
  const winRateChange = previousWinRate !== 0 ? ((winRate - previousWinRate) / previousWinRate) * 100 : 0;

  const chartContent = (
    <div className="w-full h-full bg-[#0a0a0a] rounded-xl border border-neutral-800">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}>
            Trading Activity Map
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-sm" style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}>
              Win Rate Change:
            </span>
            <span
              className="text-sm font-bold"
              style={{
                color: winRateChange >= 0
                  ? theme === 'dark' ? 'rgb(34 197 94)' : 'rgb(34 197 94)'
                  : theme === 'dark' ? 'rgb(239 68 68)' : 'rgb(239 68 68)'
              }}
            >
              {winRateChange >= 0 ? '+' : ''}{winRateChange.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
      <div style={{ height: 'calc(100% - 80px)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart
            margin={{
              top: 20,
              right: 20,
              bottom: 20,
              left: 60,
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
              name="Trade Sequence"
              tick={{
                fill: '#a3a3a3',
                fontSize: 12
              }}
              tickLine={{ stroke: '#525252' }}
              axisLine={{ stroke: '#525252' }}
              label={{
                value: 'Trade Sequence',
                position: 'bottom',
                style: {
                  textAnchor: 'middle',
                  fill: '#a3a3a3',
                  fontSize: '12px'
                }
              }}
            />
            <YAxis
              dataKey="y"
              type="number"
              name="Time of Day"
              domain={[0, 24]}
              ticks={[0, 4, 8, 12, 16, 20, 24]}
              tick={{
                fill: '#a3a3a3',
                fontSize: 12
              }}
              tickLine={{ stroke: '#525252' }}
              axisLine={{ stroke: '#525252' }}
              label={{
                value: 'Time of Day (24h)',
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
            <Scatter
              name="Trades"
              data={data}
              fill="#8884d8"
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isWin ? '#d4d4d4' : '#525252'}
                  fillOpacity={0.6}
                  r={Math.max(5, Math.sqrt(Math.abs(entry.pnl) / maxPnL) * 30)}
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
              <Map className="h-4 w-4 text-cyan-400 dark:text-cyan-600" />
            </div>
            Trading Activity Map
          </CardTitle>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-slate-400 dark:text-slate-600">Total Trades</div>
              <div className="text-lg font-bold text-slate-300 dark:text-slate-600">{totalTrades}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-400 dark:text-slate-600">Win Rate</div>
              <div className="text-lg font-bold text-blue-400 dark:text-blue-600">
                {totalTrades > 0 ? Math.round((winningTrades / totalTrades) * 100) : 0}%
              </div>
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