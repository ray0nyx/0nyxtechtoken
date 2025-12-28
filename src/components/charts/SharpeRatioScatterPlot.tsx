import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Trade } from '@/types/trade';
import { sharpeRatio, sortinoRatio, standardDeviation } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, ChevronUp, ChevronDown } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

interface SharpeRatioScatterPlotProps {
  trades: Trade[];
  riskFreeRate?: number;
  showCard?: boolean;
}

const SharpeRatioScatterPlot = ({ trades, riskFreeRate = 0, showCard = true }: SharpeRatioScatterPlotProps) => {
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
    const avgReturn = returns.reduce((a, b) => a + b, 0) / (returns.length || 1);
    const stdDev = standardDeviation(returns);
    const sharpe = sharpeRatio(returns, riskFreeRate);
    const sortino = sortinoRatio(returns, riskFreeRate);
    return { month, volatility: stdDev, avgReturn, sharpe, sortino };
  });

  // Calculate current metrics for trend indicator
  const currentSharpe = chartData.length > 0 ? chartData[chartData.length - 1].sharpe : 0;
  const previousSharpe = chartData.length > 1 ? chartData[chartData.length - 2].sharpe : 0;
  const percentageChange = previousSharpe !== 0 ? ((currentSharpe - previousSharpe) / Math.abs(previousSharpe)) * 100 : 0;

  // Color scale for sortino (gray shades)
  const getColor = (sortino: number) => {
    if (sortino >= 2) return '#d4d4d4'; // Light gray
    if (sortino >= 1) return '#a3a3a3'; // Medium gray
    return '#525252'; // Dark gray
  };

  // Theme-aware colors
  const textColor = isDark ? '#e2e8f0' : '#1e293b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  const axisColor = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';

  const chartContent = (
    <div className="w-full h-full bg-[#0a0a0a] rounded-xl border border-neutral-800">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}>
            Sharpe/Sortino Scatter Plot
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-sm" style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}>
              Sharpe Change:
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
      <div style={{ height: 'calc(100% - 80px)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <defs>
              <linearGradient id="scatterGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#d4d4d4" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#737373" stopOpacity="0.8" />
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
              type="number"
              dataKey="volatility"
              name="Volatility"
              unit=""
              stroke="#525252"
              tick={{
                fill: '#a3a3a3',
                fontSize: 12
              }}
            />
            <YAxis
              type="number"
              dataKey="avgReturn"
              name="Average Return"
              unit=""
              stroke="#525252"
              tick={{
                fill: '#a3a3a3',
                fontSize: 12
              }}
            />
            <ZAxis type="number" dataKey="sharpe" range={[50, 400]} />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div
                      className="rounded-lg shadow-lg p-3 backdrop-blur-sm bg-[#0a0a0a] border border-neutral-800"
                    >
                      <p className="font-medium mb-1 text-white">
                        {data.month}
                      </p>
                      <p className="text-sm text-neutral-300">
                        Volatility: {data.volatility.toFixed(2)}
                      </p>
                      <p className="text-sm text-neutral-300">
                        Avg Return: ${data.avgReturn.toFixed(2)}
                      </p>
                      <p className="text-sm text-neutral-400">
                        Sharpe: {data.sharpe.toFixed(2)}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Scatter data={chartData} fill="#8884d8">
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={`url(#scatterGradient)`} filter="url(#glow)" />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  if (!showCard) return chartContent;

  return (
    <Card className="shadow-lg hover:shadow-xl transition-all duration-300 hover:shadow-blue-500/10 overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-900 dark:to-slate-800 from-slate-50 to-slate-100">
      <CardHeader className="bg-blue-500/10 dark:bg-blue-500/20">
        <CardTitle className="text-white dark:text-slate-900 flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-500/20 dark:bg-blue-500/30">
            <TrendingUp className="h-4 w-4 text-blue-400 dark:text-blue-600" />
          </div>
          Sharpe/Sortino Scatter Plot
          <div className="ml-auto flex items-center gap-2">
            <span className="text-lg font-bold text-blue-400 dark:text-blue-600">
              {currentSharpe.toFixed(2)}
            </span>
            {percentageChange !== 0 && (
              <div className={`flex items-center gap-1 text-sm ${percentageChange > 0 ? 'text-emerald-400 dark:text-emerald-600' : 'text-red-400 dark:text-red-600'}`}>
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
};

export default SharpeRatioScatterPlot;