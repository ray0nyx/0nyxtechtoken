import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { Loading } from "@/components/ui/loading";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import { Target, ChevronUp, ChevronDown } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

// Custom tooltip for the pie chart
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900/95 backdrop-blur-sm border border-slate-700/50 rounded-xl shadow-2xl p-4">
        <p className="font-medium text-white mb-1">{data.name}</p>
        <p className="text-sm text-slate-300">
          {data.value} trades ({data.percentage.toFixed(1)}%)
        </p>
      </div>
    );
  }
  return null;
};

// Custom label renderer for pie chart labels
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.05) return null; // Don't show labels for slices less than 5%

  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#22c55e"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      className="text-sm font-medium"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

interface ChartData {
  name: string;
  value: number;
  percentage: number;
}

export function WinLossChart({ showCard = true }: { showCard?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ChartData[]>([]);
  const supabase = createClient();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: trades, error } = await supabase
          .from('trades')
          .select('pnl')
          .order('entry_date', { ascending: false });

        if (error) {
          console.error('Error fetching trades:', error);
          return;
        }

        if (!trades || trades.length === 0) {
          setData([]);
          setLoading(false);
          return;
        }

        // Calculate win/loss statistics
        const winningTrades = trades.filter(trade => trade.pnl > 0).length;
        const losingTrades = trades.filter(trade => trade.pnl < 0).length;
        const breakEvenTrades = trades.filter(trade => trade.pnl === 0).length;
        const totalTrades = trades.length;

        const chartData: ChartData[] = [
          {
            name: 'Winning Trades',
            value: winningTrades,
            percentage: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0
          },
          {
            name: 'Losing Trades',
            value: losingTrades,
            percentage: totalTrades > 0 ? (losingTrades / totalTrades) * 100 : 0
          }
        ];

        // Only add break-even trades if there are any
        if (breakEvenTrades > 0) {
          chartData.push({
            name: 'Break Even',
            value: breakEvenTrades,
            percentage: (breakEvenTrades / totalTrades) * 100
          });
        }

        setData(chartData);
      } catch (error) {
        console.error('Error processing trades:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase]);

  // Theme-aware colors
  const textColor = isDark ? '#e2e8f0' : '#1e293b';
  const mutedColor = isDark ? '#94a3b8' : '#64748b';

  // Calculate win rate and percentage change
  const winRate = data.length > 0 ? data.find(item => item.name === 'Winning Trades')?.percentage || 0 : 0;
  const previousWinRate = 60; // Example previous win rate for demo
  const percentageChange = previousWinRate > 0 ? ((winRate - previousWinRate) / previousWinRate) * 100 : 0;

  const chartContent = (
    <div className="w-full h-full bg-transparent dark:bg-transparent rounded-xl border-none">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}>
            Win/Loss Distribution
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-sm" style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}>
              Win Rate Change:
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
      <div className="h-full w-full" style={{ height: 'calc(100% - 80px)' }}>
        <style jsx global>{`
            .recharts-pie-label-text {
              fill: #94a3b8 !important;
              font-weight: bold !important;
            }
          `}</style>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              <linearGradient id="winningGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6b7280" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#9ca3af" stopOpacity={0.7} />
              </linearGradient>
              <linearGradient id="losingGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d1d5db" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#e5e7eb" stopOpacity={0.7} />
              </linearGradient>
              <linearGradient id="breakEvenGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#9ca3af" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#d1d5db" stopOpacity={0.7} />
              </linearGradient>
            </defs>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
              outerRadius={150}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={`url(#${entry.name === 'Winning Trades' ? 'winningGradient' : entry.name === 'Losing Trades' ? 'losingGradient' : 'breakEvenGradient'})`} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="w-full h-full bg-gray-100 dark:!bg-[#0a0a0a] rounded-xl border border-gray-200 dark:border-slate-700/50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-400"></div>
      </div>
    );
  }

  if (!showCard) return chartContent;

  const totalTradesCount = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="rounded-xl border transition-all duration-500 hover:shadow-2xl hover:shadow-gray-500/10 group overflow-hidden bg-gray-100 dark:!bg-[#0a0a0a] border-gray-200 dark:border-slate-700/50 hover:border-gray-500/30 shadow-lg shadow-gray-500/5 hover:shadow-gray-500/20 active:scale-[0.98] h-full">
      <CardHeader className="pb-1 sm:pb-2 group-hover:bg-gray-500/10 transition-colors duration-300 py-2 sm:py-3 px-4 sm:px-6">
        <CardTitle className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gray-500/10 group-hover:bg-gray-500/20 transition-colors duration-300">
            <Target className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          </div>
          Win/Loss Distribution
          <div className="ml-auto flex items-center gap-2">
            <span className="text-lg font-bold text-gray-400 dark:text-gray-500">
              {winRate.toFixed(1)}%
            </span>
            <div className="flex items-center gap-1 text-sm text-gray-400 dark:text-gray-500">
              <ChevronUp className="h-4 w-4" />
              <span>Win Rate</span>
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 h-[calc(100%-70px)]">
        {chartContent}
      </CardContent>
    </Card>
  );
}
