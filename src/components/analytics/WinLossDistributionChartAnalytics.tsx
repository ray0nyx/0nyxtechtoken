import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { BarChart2, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useTheme } from '@/components/ThemeProvider';
import { formatCurrency } from '@/lib/formatters';
import { getCurrentUser } from '@/lib/auth-utils';

interface TradeData {
  entry_date?: string;
  exit_date?: string;
  pnl: number;
}

const CustomYAxisTick = ({ x, y, payload }: any) => {
  const value = payload.value;
  const isPositive = value >= 0;
  const color = isPositive ? '#6b7280' : '#d1d5db';

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
        {value}
      </text>
    </g>
  );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800/95 border border-slate-700 rounded-lg p-3 shadow-xl backdrop-blur-sm">
        <p className="text-slate-300 text-sm mb-2">{`Week: ${label}`}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {`${entry.name}: ${entry.value}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

interface WeeklyData {
  week: string;
  wins: number;
  losses: number;
  netPnl: number;
}

export function WinLossDistributionChartAnalytics() {
  const [data, setData] = useState<WeeklyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const supabase = createClient();
  const { toast } = useToast();
  const { theme } = useTheme();

  const fetchTrades = useCallback(async () => {
    console.log('WinLossDistributionChartAnalytics: Starting to fetch trades...');
    setIsLoading(true);

    // Support both Supabase and SIWS wallet auth
    const user = await getCurrentUser();

    if (!user) {
      // Silently fail for unauthenticated users - they'll see empty chart
      console.log('WinLossDistributionChartAnalytics: No authenticated user');
      setIsLoading(false);
      return;
    }

    const { data: trades, error } = await supabase
      .from('trades')
      .select('pnl, entry_date, exit_date')
      .eq('user_id', user.id)
      .order('exit_date', { ascending: true });

    if (error) {
      toast({
        title: 'Error fetching trades',
        description: error.message,
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    if (!trades || trades.length === 0) {
      setData([]);
      setIsLoading(false);
      return;
    }

    // Process trades into weekly data
    const weeklyMap = new Map<string, { wins: number; losses: number; netPnl: number }>();

    trades.forEach((trade: TradeData) => {
      const tradeDate = trade.exit_date ? parseISO(trade.exit_date) : null;
      if (!tradeDate) return;

      const weekStart = startOfWeek(tradeDate, { weekStartsOn: 1 }); // Monday
      const weekKey = format(weekStart, 'MMM dd');

      if (!weeklyMap.has(weekKey)) {
        weeklyMap.set(weekKey, { wins: 0, losses: 0, netPnl: 0 });
      }

      const weekData = weeklyMap.get(weekKey)!;
      weekData.netPnl += trade.pnl || 0;

      if ((trade.pnl || 0) > 0) {
        weekData.wins += 1;
      } else if ((trade.pnl || 0) < 0) {
        weekData.losses += 1;
      }
    });

    const processedData: WeeklyData[] = Array.from(weeklyMap.entries())
      .map(([week, data]) => ({
        week,
        wins: data.wins,
        losses: data.losses,
        netPnl: data.netPnl,
      }))
      .sort((a, b) => new Date(a.week).getTime() - new Date(b.week).getTime());

    console.log('Processed weekly data:', processedData.length, 'weeks');
    console.log('Sample data:', processedData.slice(0, 3));
    setData(processedData);
    setIsLoading(false);
  }, [supabase, toast]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchTrades();
    setIsRefreshing(false);
  };

  const currentWins = data.length > 0 ? data[data.length - 1]?.wins || 0 : 0;
  const previousWins = data.length > 1 ? data[data.length - 2]?.wins || 0 : 0;
  const percentageChange = previousWins !== 0 ? ((currentWins - previousWins) / previousWins) * 100 : 0;
  const isPositive = percentageChange >= 0;

  return (
    <Card
      className="w-full mb-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:shadow-purple-500/10 overflow-hidden"
      style={{
        backgroundColor: theme === 'dark' ? '#0a0a0a' : 'rgba(255, 255, 255, 0.8)',
        border: theme === 'dark' ? '1px solid rgba(71, 85, 105, 0.3)' : '1px solid rgba(226, 232, 240, 0.3)',
      }}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-4 px-6 pt-6">
        <CardTitle className="flex items-center gap-2" style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}>
          <div className="p-1.5 rounded-lg" style={{ backgroundColor: theme === 'dark' ? 'rgba(107, 114, 128, 0.2)' : 'rgba(107, 114, 128, 0.1)' }}>
            <BarChart2 className="h-4 w-4" style={{ color: theme === 'dark' ? 'rgb(107 114 128)' : 'rgb(107 114 128)' }} />
          </div>
          Win/Loss Distribution by Month
        </CardTitle>
        {!isLoading && data.length > 0 && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}>
                Current Wins:
              </span>
              <span
                className="text-lg font-bold"
                style={{ color: theme === 'dark' ? 'rgb(107 114 128)' : 'rgb(107 114 128)' }}
              >
                {currentWins}
              </span>
              {percentageChange !== 0 && (
                <div className={`flex items-center gap-1 text-xs ${isPositive ? 'text-emerald-400 dark:text-emerald-600' : 'text-red-400 dark:text-red-600'}`}>
                  {isPositive ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  <span>{Math.abs(percentageChange).toFixed(1)}%</span>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="text-slate-400 hover:text-green-400 hover:bg-green-500/10 transition-all duration-300 rounded-lg"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-6">
        <div className="w-full h-[600px] bg-slate-50 dark:!bg-[#0a0a0a] rounded-xl">
          {isLoading ? (
            <div className="flex items-center justify-center h-[550px]">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : data.length === 0 ? (
            <div className="flex items-center justify-center h-[550px] text-muted-foreground">
              No trade data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={550}>
              <BarChart
                data={data}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 20,
                }}
              >
                <defs>
                  <linearGradient id="winsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6b7280" stopOpacity={0.9} />
                    <stop offset="50%" stopColor="#6b7280" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#6b7280" stopOpacity={0.3} />
                  </linearGradient>
                  <linearGradient id="lossesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d1d5db" stopOpacity={0.9} />
                    <stop offset="50%" stopColor="#d1d5db" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#d1d5db" stopOpacity={0.3} />
                  </linearGradient>
                  <filter id="glowBarWinLoss">
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
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" opacity={0.3} />
                <XAxis
                  dataKey="week"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  interval={0}
                  stroke="rgba(16, 185, 129, 0.6)"
                  fontSize={11}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `${value}`}
                  tick={{ fill: '#10b981', fontSize: 11, filter: 'url(#glowText)' }}
                />
                <YAxis
                  tick={<CustomYAxisTick />}
                  stroke="rgba(255, 255, 255, 0.6)"
                  fontSize={11}
                  axisLine={false}
                  tickLine={false}
                  padding={{ top: 20, bottom: 20 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="wins"
                  fill="url(#winsGradient)"
                  radius={[6, 6, 0, 0]}
                  filter="url(#glowBarWinLoss)"
                />
                <Bar
                  dataKey="losses"
                  fill="url(#lossesGradient)"
                  radius={[6, 6, 0, 0]}
                  filter="url(#glowBarWinLoss)"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
