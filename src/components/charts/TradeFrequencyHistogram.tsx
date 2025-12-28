import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Trade } from '@/types/trade';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, ChevronUp, ChevronDown } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

interface TradeFrequencyHistogramProps {
  trades: Trade[];
  showCard?: boolean;
}

const TradeFrequencyHistogram = ({ trades, showCard = true }: TradeFrequencyHistogramProps) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Group trades by day
  const dailyGroups = trades.reduce((acc, trade) => {
    const day = new Date(trade.entry_date).toLocaleDateString();
    if (!acc[day]) acc[day] = [];
    acc[day].push(trade);
    return acc;
  }, {} as Record<string, Trade[]>);

  // Calculate daily stats
  const chartData = Object.entries(dailyGroups).map(([day, group]) => {
    const totalPnl = group.reduce((a, b) => a + b.pnl, 0);
    return {
      day,
      tradeCount: group.length,
      totalPnl,
      isWin: totalPnl > 0 ? 'Win' : 'Loss',
    };
  });

  // Calculate current metrics for trend indicator
  const currentTradeCount = chartData.length > 0 ? chartData[chartData.length - 1].tradeCount : 0;
  const currentPnl = chartData.length > 0 ? chartData[chartData.length - 1].totalPnl : 0;
  const previousTradeCount = chartData.length > 1 ? chartData[chartData.length - 2].tradeCount : 0;
  const previousPnl = chartData.length > 1 ? chartData[chartData.length - 2].totalPnl : 0;
  const tradeCountChange = previousTradeCount !== 0 ? ((currentTradeCount - previousTradeCount) / previousTradeCount) * 100 : 0;
  const pnlChange = previousPnl !== 0 ? ((currentPnl - previousPnl) / Math.abs(previousPnl)) * 100 : 0;

  // Theme-aware colors
  const textColor = isDark ? '#e2e8f0' : '#1e293b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  const axisColor = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';

  const chartContent = (
    <div className="w-full h-full bg-[#0a0a0a] rounded-xl border border-neutral-800">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}>
            Trade Frequency Histogram
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}>
                Trades Change:
              </span>
              <span
                className="text-sm font-bold"
                style={{
                  color: tradeCountChange >= 0
                    ? theme === 'dark' ? 'rgb(34 197 94)' : 'rgb(34 197 94)'
                    : theme === 'dark' ? 'rgb(239 68 68)' : 'rgb(239 68 68)'
                }}
              >
                {tradeCountChange >= 0 ? '+' : ''}{tradeCountChange.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}>
                P&L Change:
              </span>
              <span
                className="text-sm font-bold"
                style={{
                  color: pnlChange >= 0
                    ? theme === 'dark' ? 'rgb(34 197 94)' : 'rgb(34 197 94)'
                    : theme === 'dark' ? 'rgb(239 68 68)' : 'rgb(239 68 68)'
                }}
              >
                {pnlChange >= 0 ? '+' : ''}{pnlChange.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>
      <div style={{ height: 'calc(100% - 80px)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="tradeCountGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#d4d4d4" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#a3a3a3" stopOpacity="0.4" />
              </linearGradient>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
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
            <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
            <XAxis
              dataKey="day"
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
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="rounded-lg shadow-lg p-3 backdrop-blur-sm bg-[#0a0a0a] border border-neutral-800">
                      <p className="font-medium mb-1 text-white">
                        {label}
                      </p>
                      <p className="text-sm text-neutral-300">
                        Trades: {payload[0].value}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="tradeCount" fill="url(#tradeCountGradient)" radius={[4, 4, 0, 0]} filter="url(#glow)" />
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
            <Activity className="h-4 w-4 text-emerald-400 dark:text-emerald-600" />
          </div>
          Trade Frequency Histogram
          <div className="ml-auto flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-blue-400 dark:text-blue-600">Trades:</span>
              <span className="text-lg font-bold text-blue-400 dark:text-blue-600">
                {currentTradeCount}
              </span>
              {tradeCountChange !== 0 && (
                <div className={`flex items-center gap-1 text-xs ${tradeCountChange > 0 ? 'text-emerald-400 dark:text-emerald-600' : 'text-red-400 dark:text-red-600'}`}>
                  {tradeCountChange > 0 ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  <span>{Math.abs(tradeCountChange).toFixed(1)}%</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-purple-400 dark:text-purple-600">P&L:</span>
              <span className={`text-lg font-bold ${currentPnl >= 0 ? 'text-emerald-400 dark:text-emerald-600' : 'text-red-400 dark:text-red-600'}`}>
                ${currentPnl.toFixed(2)}
              </span>
              {pnlChange !== 0 && (
                <div className={`flex items-center gap-1 text-xs ${pnlChange > 0 ? 'text-emerald-400 dark:text-emerald-600' : 'text-red-400 dark:text-red-600'}`}>
                  {pnlChange > 0 ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  <span>{Math.abs(pnlChange).toFixed(1)}%</span>
                </div>
              )}
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {chartContent}
      </CardContent>
    </Card>
  );
};

export default TradeFrequencyHistogram; 