import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { format, parseISO, subMonths } from 'date-fns';
import { BarChart2, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useTheme } from '@/components/ThemeProvider';
import { formatCurrency } from '@/lib/formatters';
import { getCurrentUser } from '@/lib/auth-utils';

interface TradeData {
  entry_date?: string;
  exit_date?: string;
  date?: string;
  pnl: number;
}

const CustomYAxisTick = ({ x, y, payload }: any) => {
  const value = payload.value;
  const isPositive = value >= 0;
  const color = isPositive ? '#6b7280' : '#d1d5db'; // gray-500 for positive, gray-300 for negative

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

interface DailyPnL {
  date: string;
  pnl: number;
  displayDate: string;
}

interface DailyPnLBarChartAnalyticsProps {
  limitMonths?: number; // Optional prop to limit data to last N months
}

export function DailyPnLBarChartAnalytics({ limitMonths }: DailyPnLBarChartAnalyticsProps) {
  const [chartData, setChartData] = useState<DailyPnL[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const supabase = createClient();
  const { toast } = useToast();
  const { theme } = useTheme();

  const fetchTrades = useCallback(async () => {
    console.log('DailyPnLBarChartAnalytics: Starting to fetch trades...');
    setIsLoading(true);

    // Support both Supabase and SIWS wallet auth
    const user = await getCurrentUser();

    if (!user) {
      // Silently fail for unauthenticated users - they'll see empty chart
      console.log('DailyPnLBarChartAnalytics: No authenticated user');
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
      console.log('No trades found in database');
      setChartData([]);
      setIsLoading(false);
      return;
    }

    console.log('Fetched trades:', trades.length, 'trades');

    // Process trades into daily P&L data
    const dailyPnLMap = new Map<string, number>();

    trades.forEach((trade: TradeData) => {
      const tradeDate = trade.exit_date ? format(parseISO(trade.exit_date), 'yyyy-MM-dd') : '';
      if (tradeDate) {
        dailyPnLMap.set(tradeDate, (dailyPnLMap.get(tradeDate) || 0) + (trade.pnl || 0));
      }
    });

    let processedData: DailyPnL[] = Array.from(dailyPnLMap.entries())
      .map(([date, pnl]) => ({
        date,
        pnl,
        displayDate: format(parseISO(date), 'MMM dd'),
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (limitMonths && limitMonths > 0) {
      const cutoffDate = subMonths(new Date(), limitMonths);
      processedData = processedData.filter(data => parseISO(data.date) >= cutoffDate);
    }

    console.log('Processed daily data:', processedData.length, 'days');
    console.log('Sample data:', processedData.slice(0, 3));
    setChartData(processedData);
    setIsLoading(false);
  }, [limitMonths, supabase, toast]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchTrades();
    setIsRefreshing(false);
  };

  const getPercentageChange = () => {
    if (chartData.length < 2) return 0;
    const latestPnL = chartData[chartData.length - 1].pnl;
    const previousPnL = chartData[chartData.length - 2].pnl;

    if (previousPnL === 0) {
      return latestPnL === 0 ? 0 : 100; // If previous is 0, and current is not 0, it's a 100% change
    }
    return ((latestPnL - previousPnL) / Math.abs(previousPnL)) * 100;
  };

  const getCurrentDailyPnL = () => {
    if (chartData.length === 0) {
      return 0;
    }
    return chartData[chartData.length - 1]?.pnl || 0;
  };

  const percentageChange = getPercentageChange();
  const isPositive = percentageChange >= 0;
  const currentDailyPnL = getCurrentDailyPnL();

  return (
    <Card
      className="w-full mb-8 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden !bg-white dark:!bg-[#0a0a0a]"
      style={{
        backgroundColor: theme === 'dark' ? '#0a0a0a' : 'rgba(255, 255, 255, 1)',
        border: theme === 'dark' ? '1px solid rgba(71, 85, 105, 0.3)' : '1px solid rgba(226, 232, 240, 0.3)',
      }}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-4 px-6 pt-6">
        <CardTitle className="flex items-center gap-2" style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}>
          <div className="p-1.5 rounded-lg" style={{ backgroundColor: theme === 'dark' ? 'rgba(147, 51, 234, 0.2)' : 'rgba(147, 51, 234, 0.1)' }}>
            <BarChart2 className="h-4 w-4" style={{ color: theme === 'dark' ? 'rgb(147 51 234)' : 'rgb(147 51 234)' }} />
          </div>
          Daily P&L
        </CardTitle>
        {!isLoading && chartData && Array.isArray(chartData) && chartData.length > 0 && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}>
                Current P&L:
              </span>
              <span
                className="text-lg font-bold"
                style={{
                  color: currentDailyPnL >= 0
                    ? theme === 'dark' ? 'rgb(107 114 128)' : 'rgb(107 114 128)'
                    : theme === 'dark' ? 'rgb(209 213 219)' : 'rgb(209 213 219)'
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
          ) : !chartData || !Array.isArray(chartData) || chartData.length === 0 ? (
            <div className="flex items-center justify-center h-[550px] text-muted-foreground">
              No trading data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={550}>
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <defs>
                  <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6b7280" stopOpacity={0.9} />
                    <stop offset="50%" stopColor="#6b7280" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#6b7280" stopOpacity={0.3} />
                  </linearGradient>
                  <linearGradient id="lossGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d1d5db" stopOpacity={0.9} />
                    <stop offset="50%" stopColor="#d1d5db" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#d1d5db" stopOpacity={0.3} />
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
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" opacity={0.3} />
                <XAxis
                  dataKey="displayDate"
                  stroke="rgba(16, 185, 129, 0.6)"
                  fontSize={11}
                  tick={{ fill: '#10b981', filter: 'url(#glowText)' }}
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
                    <span style={{ color: value >= 0 ? '#6b7280' : '#d1d5db', fontWeight: 'bold' }}>{formatCurrency(value || 0)}</span>,
                    <span style={{ color: value >= 0 ? '#6b7280' : '#d1d5db' }}>Daily P&L</span>
                  ]}
                  labelFormatter={(label) => `Date: ${label}`}
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
                    backdropFilter: 'blur(10px)',
                  }}
                />
                <ReferenceLine y={0} stroke="rgba(255, 255, 255, 0.2)" strokeDasharray="2 2" />
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
      </CardContent>
    </Card>
  );
}
