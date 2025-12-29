import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Trade } from '@/types/trade';
import { expectancy } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, ChevronUp, ChevronDown } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

interface RollingExpectancyLineChartProps {
  trades: Trade[];
  windowSize?: number;
  showCard?: boolean;
}

const RollingExpectancyLineChart = ({ trades, windowSize = 20, showCard = true }: RollingExpectancyLineChartProps) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Sort trades by entry date
  const sorted = [...trades].sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());

  const data = sorted.map((_, idx, arr) => {
    if (idx < windowSize - 1) return null;
    const window = arr.slice(idx - windowSize + 1, idx + 1);
    const wins = window.filter(t => t.pnl > 0);
    const losses = window.filter(t => t.pnl < 0);
    const winRate = window.length ? wins.length / window.length : 0;
    const avgWin = wins.length ? wins.reduce((a, b) => a + b.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length ? losses.reduce((a, b) => a + b.pnl, 0) / losses.length : 0;
    return {
      idx,
      date: new Date(window[window.length - 1].entry_date).toLocaleDateString(),
      expectancy: expectancy(winRate, avgWin, avgLoss),
    };
  }).filter(Boolean);

  // Calculate current expectancy for trend indicator
  const currentExpectancy = data.length > 0 ? data[data.length - 1].expectancy : 0;
  const previousExpectancy = data.length > 1 ? data[data.length - 2].expectancy : 0;
  const percentageChange = previousExpectancy !== 0 ? ((currentExpectancy - previousExpectancy) / Math.abs(previousExpectancy)) * 100 : 0;

  // Theme-aware colors
  const textColor = isDark ? '#e2e8f0' : '#1e293b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  const axisColor = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';

  const chartContent = (
    <div className="w-full h-full bg-[#0a0a0a] rounded-xl border border-neutral-800">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}>
            Rolling 20 Trade Expectancy
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-sm" style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}>
              Expectancy Change:
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
      <div style={{ height: 'calc(100% - 80px)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="expectancyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#d4d4d4" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#a3a3a3" stopOpacity="0.2" />
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
            <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
            <XAxis
              dataKey="tradeNumber"
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
                      <p className="font-medium mb-1 text-white">Trade #{label}</p>
                      <p className="text-sm text-neutral-300">Expectancy: ${(payload[0].value as number).toFixed(2)}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Line
              type="monotone"
              dataKey="expectancy"
              stroke="#a3a3a3"
              strokeWidth={2}
              dot={{ fill: '#d4d4d4', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#d4d4d4', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  if (!showCard) return chartContent;

  return (
    <Card className="shadow-lg hover:shadow-xl transition-all duration-300 hover:shadow-orange-500/10 overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-900 dark:to-slate-800 from-slate-50 to-slate-100">
      <CardHeader className="bg-orange-500/10 dark:bg-orange-500/20">
        <CardTitle className="text-white dark:text-slate-900 flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-orange-500/20 dark:bg-orange-500/30">
            <TrendingUp className="h-4 w-4 text-orange-400 dark:text-orange-600" />
          </div>
          Rolling 20 Trade Expectancy
          <div className="ml-auto flex items-center gap-2">
            <span className="text-lg font-bold text-gray-500">
              {currentExpectancy.toFixed(2)}
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
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="expectancyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#f97316" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#f97316" stopOpacity="0.2" />
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
              dataKey="date"
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
            <Line
              type="monotone"
              dataKey="expectancy"
              stroke="#f97316"
              name="Rolling Expectancy"
              dot={false}
              strokeWidth={3}
              activeDot={{ r: 6, stroke: '#f97316', strokeWidth: 2, fill: '#fff' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default RollingExpectancyLineChart; 