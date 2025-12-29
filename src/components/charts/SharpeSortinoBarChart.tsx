import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Trade } from '@/types/trade';
import { sharpeRatio, sortinoRatio } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, ChevronUp, ChevronDown } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

interface SharpeSortinoBarChartProps {
  trades: Trade[];
  riskFreeRate?: number;
  showCard?: boolean;
}

const SharpeSortinoBarChart = ({ trades, riskFreeRate = 0, showCard = true }: SharpeSortinoBarChartProps) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Group trades by month
  const monthlyData = trades.reduce((acc, trade) => {
    const month = new Date(trade.entry_date).toLocaleString('default', { month: 'short', year: 'numeric' });
    if (!acc[month]) acc[month] = [];
    acc[month].push(trade.pnl);
    return acc;
  }, {} as Record<string, number[]>);

  const chartData = Object.entries(monthlyData).map(([month, returns]) => {
    return {
      month,
      sharpe: sharpeRatio(returns, riskFreeRate),
      sortino: sortinoRatio(returns, riskFreeRate),
    };
  });

  // Calculate current metrics for trend indicator
  const currentSharpe = chartData.length > 0 ? chartData[chartData.length - 1].sharpe : 0;
  const currentSortino = chartData.length > 0 ? chartData[chartData.length - 1].sortino : 0;
  const previousSharpe = chartData.length > 1 ? chartData[chartData.length - 2].sharpe : 0;
  const previousSortino = chartData.length > 1 ? chartData[chartData.length - 2].sortino : 0;
  const sharpeChange = previousSharpe !== 0 ? ((currentSharpe - previousSharpe) / Math.abs(previousSharpe)) * 100 : 0;
  const sortinoChange = previousSortino !== 0 ? ((currentSortino - previousSortino) / Math.abs(previousSortino)) * 100 : 0;

  // Theme-aware colors
  const textColor = isDark ? '#e2e8f0' : '#1e293b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  const axisColor = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';

  const chartContent = (
    <div className="w-full h-full bg-[#0a0a0a] rounded-xl border border-neutral-800">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}>
            Monthly P&L Sharpe/Sortino
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}>
                Sharpe Change:
              </span>
              <span
                className="text-sm font-bold"
                style={{
                  color: sharpeChange >= 0
                    ? theme === 'dark' ? 'rgb(107 114 128)' : 'rgb(107 114 128)'
                    : theme === 'dark' ? 'rgb(209 213 219)' : 'rgb(209 213 219)'
                }}
              >
                {sharpeChange >= 0 ? '+' : ''}{sharpeChange.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}>
                Sortino Change:
              </span>
              <span
                className="text-sm font-bold"
                style={{
                  color: sortinoChange >= 0
                    ? theme === 'dark' ? 'rgb(107 114 128)' : 'rgb(107 114 128)'
                    : theme === 'dark' ? 'rgb(209 213 219)' : 'rgb(209 213 219)'
                }}
              >
                {sortinoChange >= 0 ? '+' : ''}{sortinoChange.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>
      <div style={{ height: 'calc(100% - 80px)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="sharpeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#d4d4d4" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#a3a3a3" stopOpacity="0.4" />
              </linearGradient>
              <linearGradient id="sortinoGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#737373" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#525252" stopOpacity="0.4" />
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
                    <div className="bg-[#0a0a0a] border border-neutral-800 rounded-lg shadow-lg p-3 backdrop-blur-sm">
                      <p className="font-medium mb-1 text-white">{label}</p>
                      <p className="text-sm text-neutral-300">Sharpe: {(payload[0].value as number).toFixed(2)}</p>
                      <p className="text-sm text-neutral-400">Sortino: {(payload[1].value as number).toFixed(2)}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="sharpe" fill="url(#sharpeGradient)" name="Sharpe Ratio" />
            <Bar dataKey="sortino" fill="url(#sortinoGradient)" name="Sortino Ratio" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  if (!showCard) return chartContent;

  return (
    <Card className="shadow-lg hover:shadow-xl transition-all duration-300 hover:shadow-purple-500/10 overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-900 dark:to-slate-800 from-slate-50 to-slate-100">
      <CardHeader className="bg-purple-500/10 dark:bg-purple-500/20">
        <CardTitle className="text-white dark:text-slate-900 flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-500/20 dark:bg-purple-500/30">
            <BarChart3 className="h-4 w-4 text-purple-400 dark:text-purple-600" />
          </div>
          Monthly P&L Sharpe/Sortino
          <div className="ml-auto flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Sharpe:</span>
              <span className="text-lg font-bold text-gray-500">
                {currentSharpe.toFixed(2)}
              </span>
              {sharpeChange !== 0 && (
                <div className={`flex items-center gap-1 text-xs ${sharpeChange > 0 ? 'text-gray-500' : 'text-gray-300'}`}>
                  {sharpeChange > 0 ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  <span>{Math.abs(sharpeChange).toFixed(1)}%</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Sortino:</span>
              <span className="text-lg font-bold text-gray-500">
                {currentSortino.toFixed(2)}
              </span>
              {sortinoChange !== 0 && (
                <div className={`flex items-center gap-1 text-xs ${sortinoChange > 0 ? 'text-gray-500' : 'text-gray-300'}`}>
                  {sortinoChange > 0 ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  <span>{Math.abs(sortinoChange).toFixed(1)}%</span>
                </div>
              )}
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="sharpeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.4" />
              </linearGradient>
              <linearGradient id="sortinoGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#9333ea" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#9333ea" stopOpacity="0.4" />
              </linearGradient>
              <filter id="glowText" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey="month"
              stroke={axisColor}
              tick={{
                fill: theme === 'dark' ? 'rgb(107 114 128)' : 'rgb(107 114 128)', // gray-500
                fontSize: 12,
                filter: 'url(#glowText)'
              }}
            />
            <YAxis
              stroke={axisColor}
              tick={{
                fill: theme === 'dark' ? 'rgb(107 114 128)' : 'rgb(107 114 128)', // gray-500
                fontSize: 12,
                filter: 'url(#glowText)'
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                color: textColor,
                backdropFilter: 'blur(10px)'
              }}
            />
            <Legend />
            <Bar dataKey="sharpe" fill="url(#sharpeGradient)" name="Sharpe Ratio" radius={[4, 4, 0, 0]} />
            <Bar dataKey="sortino" fill="url(#sortinoGradient)" name="Sortino Ratio" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default SharpeSortinoBarChart; 