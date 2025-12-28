import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { TrendingDown, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useTheme } from '@/components/ThemeProvider';
import { formatCurrency } from '@/lib/formatters';

interface TradeData {
  entry_date?: string;
  exit_date?: string;
  date?: string;
  pnl: number;
}

interface DrawdownData {
  date: string;
  drawdown: number;
  drawdownPercentage: number;
  displayDate: string;
}

interface DrawdownChartProps {
  trades?: any[]; // Optional trades data that can be passed in
  showCard?: boolean; // Whether to show the outer Card component
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
        {formatCurrency(-value)}
      </text>
    </g>
  );
};

export function DrawdownChart({ trades: providedTrades, showCard = true }: DrawdownChartProps) {
  const [chartData, setChartData] = useState<DrawdownData[]>([]);
  const [isLoading, setIsLoading] = useState(providedTrades ? false : true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const supabase = createClient();
  const { toast } = useToast();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Process trade data into chart format with drawdown calculations
  const processTrades = (trades: any[]) => {
    if (!trades || !Array.isArray(trades) || trades.length === 0) {
      // Return fallback data for empty trades
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Simple date formatting for fallback data
      const formatSimpleDate = (date: Date) => {
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: '2-digit',
          year: 'numeric'
        });
      };

      return [
        {
          date: today.toISOString(),
          displayDate: formatSimpleDate(today),
          drawdown: 0,
          drawdownPercentage: 0
        },
        {
          date: tomorrow.toISOString(),
          displayDate: formatSimpleDate(tomorrow),
          drawdown: 0,
          drawdownPercentage: 0
        }
      ];
    }

    // Sort trades by date
    const sortedTrades = [...trades].sort((a, b) => {
      const dateA = new Date(a.exit_date || a.entry_date || a.date || 0);
      const dateB = new Date(b.exit_date || b.entry_date || b.date || 0);
      return dateA.getTime() - dateB.getTime();
    });

    // Process trade data and calculate drawdown
    let runningBalance = 0;
    let peak = 0;
    let drawdownData: DrawdownData[] = [];

    // Add starting point at 0 drawdown
    if (sortedTrades.length > 0) {
      const firstTrade = sortedTrades[0];
      const firstDate = firstTrade.exit_date || firstTrade.entry_date || firstTrade.date;
      drawdownData.push({
        date: firstDate,
        displayDate: formatDate(firstDate),
        drawdown: 0,
        drawdownPercentage: 0
      });
    }

    sortedTrades.forEach((trade) => {
      // Use exit_date as the primary date field, fallback to entry_date or date
      const dateToUse = trade.exit_date || trade.entry_date || trade.date;

      // Format for display
      const displayDate = formatDate(dateToUse);

      // Update running balance
      const tradePnL = parseFloat(trade.pnl?.toString() || '0');
      runningBalance += tradePnL;

      // Update peak if we reach a new high
      if (runningBalance > peak) {
        peak = runningBalance;
      }

      // Calculate drawdown from peak
      const drawdown = peak - runningBalance;
      const drawdownPercentage = peak > 0 ? (drawdown / peak) * 100 : 0;

      drawdownData.push({
        date: dateToUse,
        displayDate,
        drawdown,
        drawdownPercentage
      });
    });

    // Ensure we have at least 2 points to create a line, especially for 0 drawdown
    if (drawdownData.length === 1) {
      // If only one point, duplicate it to create a line
      const singlePoint = drawdownData[0];
      const dateObj = new Date(singlePoint.date);
      dateObj.setMinutes(dateObj.getMinutes() + 1);

      drawdownData.push({
        date: dateObj.toISOString(),
        displayDate: formatDate(dateObj.toISOString()),
        drawdown: singlePoint.drawdown,
        drawdownPercentage: singlePoint.drawdownPercentage
      });
    }

    return drawdownData;
  };

  // Use provided trades if available, otherwise fetch from Supabase
  useEffect(() => {
    if (providedTrades) {
      const processedData = processTrades(providedTrades);
      setChartData(processedData);
      setIsLoading(false);
    } else {
      fetchTrades();
    }
  }, [providedTrades]);

  const fetchTrades = async (forceRefresh = false) => {
    if (providedTrades) {
      const processedData = processTrades(providedTrades);
      setChartData(processedData);
      setIsLoading(false);
      return;
    }

    if (forceRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      // Fetch trades with all date fields and PnL, sorted by exit_date
      const { data, error } = await supabase
        .from('trades')
        .select('entry_date, exit_date, date, pnl')
        .eq('user_id', user.id)
        .order('exit_date', { ascending: true });

      console.log('DrawdownChart: Fetched trades data:', data);

      if (!data || !Array.isArray(data) || data.length === 0) {
        const processedData = processTrades([]);
        setChartData(processedData);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      const processedData = processTrades(data);
      setChartData(processedData);

      if (forceRefresh) {
        toast({
          title: "Chart Refreshed",
          description: "Drawdown data has been updated.",
        });
      }
    } catch (error) {
      console.error('Error fetching trades:', error);
      toast({
        title: "Error",
        description: "Failed to fetch trading data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchTrades(true);
  };

  const formatDate = (dateStr: string | undefined | null) => {
    if (!dateStr) return '';
    try {
      return format(parseISO(dateStr), 'MMM dd, yyyy');
    } catch (e) {
      return dateStr;
    }
  };

  // Safe access to last drawdown value
  const getLastDrawdown = () => {
    if (!chartData || !Array.isArray(chartData) || chartData.length === 0) {
      return 0;
    }
    return chartData[chartData.length - 1]?.drawdown || 0;
  };

  // Calculate percentage change for trend indicator
  const getPercentageChange = () => {
    if (!chartData || chartData.length < 2) return 0;
    const firstValue = chartData[0]?.drawdown || 0;
    const lastValue = chartData[chartData.length - 1]?.drawdown || 0;
    if (firstValue === 0) return 0;
    return ((lastValue - firstValue) / Math.abs(firstValue)) * 100;
  };

  // Get current drawdown value
  const getCurrentDrawdown = () => {
    if (!chartData || !Array.isArray(chartData) || chartData.length === 0) {
      return 0;
    }
    return chartData[chartData.length - 1]?.drawdown || 0;
  };

  const chartContent = (
    <>
      {isLoading ? (
        <div className="flex items-center justify-center h-full min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : !chartData || !Array.isArray(chartData) || chartData.length === 0 ? (
        <div className="flex items-center justify-center h-full min-h-[400px] bg-slate-900 rounded-xl text-white">
          <div className="text-center">
            <div className="text-lg font-semibold mb-2">No Trading Data Available</div>
            <div className="text-sm text-slate-400">Start trading to see your drawdown analysis</div>
          </div>
        </div>
      ) : (
        <div className="h-full w-full !bg-gray-100 dark:!bg-[#0a0a0a] rounded-xl min-h-[500px]">
          <div style={{ width: '100%', height: '500px', minHeight: '500px' }}>
            <ResponsiveContainer width="100%" height={500}>
              <AreaChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <defs>
                  <linearGradient id="colorDrawdown" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="#d1d5db"
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="100%"
                      stopColor="#d1d5db"
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                  <filter id="glowText" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <XAxis
                  dataKey="displayDate"
                  stroke="rgba(16, 185, 129, 0.6)"
                  fontSize={11}
                  tick={{ fill: '#10b981', filter: 'url(#glowText)' }}
                  tickLine={false}
                  axisLine={false}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  tickMargin={10}
                />
                <YAxis
                  stroke="rgba(255, 255, 255, 0.6)"
                  fontSize={11}
                  tick={{ fill: '#d1d5db', filter: 'url(#glowText)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-lg">
                          <p className="text-slate-300 text-sm">{`Date: ${label}`}</p>
                          <p className="text-purple-400 font-semibold">
                            {`Drawdown: ${formatCurrency(payload[0].value)}`}
                          </p>
                          <p className="text-slate-400 text-xs">
                            {`Percentage: ${payload[0].payload?.drawdownPercentage?.toFixed(2)}%`}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="drawdown"
                  stroke="#d1d5db"
                  strokeWidth={2}
                  dot={false}
                  fill="url(#colorDrawdown)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </>
  );

  const percentageChange = getPercentageChange();
  const isPositive = percentageChange >= 0;
  const currentDrawdown = getCurrentDrawdown();

  if (!showCard) {
    return chartContent;
  }

  return (
    <Card
      className="w-full h-full mb-8 overflow-hidden border border-gray-200 dark:border-slate-700/50 hover:border-purple-500/30 dark:hover:border-purple-500/30 hover:shadow-2xl hover:shadow-purple-500/10 transition-all duration-500 group flex flex-col !bg-white dark:!bg-[#0a0a0a]"
      style={{
        backgroundColor: theme === 'dark' ? '#0a0a0a' : 'rgb(255, 255, 255)'
      }}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-4 px-6 pt-6 flex-shrink-0">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors duration-300">
              <TrendingDown className="h-5 w-5 text-gray-300" />
            </div>
            <CardTitle className="text-lg font-semibold text-white dark:text-white text-slate-900">Drawdown Chart</CardTitle>
          </div>
          {!isLoading && chartData && Array.isArray(chartData) && chartData.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <div className={`text-3xl font-bold ${getLastDrawdown() >= 0 ? 'text-gray-300' : 'text-gray-400'}`}>
                {formatCurrency(getLastDrawdown())}
              </div>
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${isPositive
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
                }`}>
                {isPositive ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                {Math.abs(percentageChange).toFixed(1)}%
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing || !!providedTrades}
            className="text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 transition-all duration-300 rounded-lg"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6 flex-1 min-h-0">
        {chartContent}
      </CardContent>
    </Card>
  );
}