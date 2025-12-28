import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { format, parseISO } from 'date-fns';
import { TrendingUp, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useTheme } from '@/components/ThemeProvider';
import { formatCurrency } from '@/lib/formatters';

interface TradeData {
  entry_date?: string;
  exit_date?: string;
  date?: string;
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
        {formatCurrency(value)}
      </text>
    </g>
  );
};

interface DailyPnL {
  date: string;
  pnl: number;
  cumulativePnL: number;
  displayDate: string;
}

interface CumulativePnLChartProps {
  trades?: any[]; // Optional trades data that can be passed in
  showCard?: boolean; // Whether to show the outer Card component
}

export function CumulativePnLChart({ trades: providedTrades, showCard = true }: CumulativePnLChartProps) {
  const [chartData, setChartData] = useState<DailyPnL[]>([]);
  const [isLoading, setIsLoading] = useState(providedTrades ? false : true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const supabase = createClient();
  const { toast } = useToast();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Process trade data into chart format
  const processTrades = (trades: any[]) => {
    if (!trades || !Array.isArray(trades) || trades.length === 0) {
      // Return fallback data to show a line at 0
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      return [
        {
          date: today.toISOString(),
          displayDate: formatDate(today.toISOString()),
          pnl: 0,
          cumulativePnL: 0
        },
        {
          date: tomorrow.toISOString(),
          displayDate: formatDate(tomorrow.toISOString()),
          pnl: 0,
          cumulativePnL: 0
        }
      ];
    }

    // Sort trades by date
    const sortedTrades = [...trades].sort((a, b) => {
      const dateA = new Date(a.exit_date || a.entry_date || a.date || 0);
      const dateB = new Date(b.exit_date || b.entry_date || b.date || 0);
      return dateA.getTime() - dateB.getTime();
    });

    // Process trade data and calculate cumulative PnL
    let cumulativePnL = 0;
    const processedTrades = sortedTrades.map((trade) => {
      // Use exit_date as the primary date field, fallback to entry_date or date
      const dateToUse = trade.exit_date || trade.entry_date || trade.date;

      // Format for display
      const displayDate = formatDate(dateToUse);

      // Calculate cumulative PnL
      cumulativePnL += parseFloat(trade.pnl?.toString() || '0');

      return {
        date: dateToUse,
        displayDate,
        pnl: parseFloat(trade.pnl?.toString() || '0'),
        cumulativePnL
      };
    });

    // If there's only one trade, add a starting point at 0 to show a line
    if (processedTrades.length === 1) {
      const singleTrade = processedTrades[0];
      const tradeDate = new Date(singleTrade.date);
      const startDate = new Date(tradeDate);
      startDate.setMinutes(startDate.getMinutes() - 1); // 1 minute before the trade

      return [
        {
          date: startDate.toISOString(),
          displayDate: formatDate(startDate.toISOString()),
          pnl: 0,
          cumulativePnL: 0
        },
        ...processedTrades
      ];
    }

    return processedTrades;
  };

  // Use provided trades if available
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

      console.log('CumulativePnLChart: Fetched trades data:', data);

      if (!data || !Array.isArray(data) || data.length === 0) {
        setChartData([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      const processedData = processTrades(data);
      setChartData(processedData);

      if (forceRefresh) {
        toast({
          title: "Chart Refreshed",
          description: "Cumulative P&L chart data has been refreshed.",
        });
      }
    } catch (error) {
      console.error('Error fetching trades for cumulative PnL chart:', error);
      setChartData([]);
      if (forceRefresh) {
        toast({
          title: "Error",
          description: "Failed to refresh chart data.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchTrades(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  const formatDate = (dateStr: string | undefined | null) => {
    if (!dateStr) return '';
    try {
      return format(parseISO(dateStr), 'MMM dd, yyyy');
    } catch (e) {
      return dateStr;
    }
  };

  // Safe access to last cumulative PnL value
  const getLastCumulativePnL = () => {
    if (!chartData || !Array.isArray(chartData) || chartData.length === 0) {
      return 0;
    }
    return chartData[chartData.length - 1]?.cumulativePnL || 0;
  };

  // Calculate percentage change for trend indicator
  const getPercentageChange = () => {
    if (!chartData || chartData.length < 2) return 0;
    const firstValue = chartData[0]?.cumulativePnL || 0;
    const lastValue = chartData[chartData.length - 1]?.cumulativePnL || 0;
    if (firstValue === 0) return 0;
    return ((lastValue - firstValue) / Math.abs(firstValue)) * 100;
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
            <div className="text-sm text-slate-400">Start trading to see your cumulative P&L</div>
          </div>
        </div>
      ) : (
        <div className="h-full w-full !bg-gray-100 dark:!bg-[#0a0a0a] rounded-xl min-h-[400px]">
          <div style={{ width: '100%', height: '400px', minHeight: '400px' }}>
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <defs>
                  <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="#6b7280"
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="100%"
                      stopColor="#6b7280"
                      stopOpacity={0.1}
                    />
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
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" opacity={0.3} />
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
                  tick={{ fill: '#6b7280', filter: 'url(#glowText)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-lg">
                          <p className="text-slate-300 text-sm">{`Date: ${label}`}</p>
                          <p className="text-blue-400 font-semibold">
                            {`Cumulative P&L: ${formatCurrency(payload[0].value)}`}
                          </p>
                          <p className="text-slate-400 text-xs">
                            {`Trade P&L: ${formatCurrency(payload[0].payload?.pnl)}`}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cumulativePnL"
                  stroke="#6b7280"
                  strokeWidth={3}
                  fill="url(#colorPnl)"
                  dot={false}
                  activeDot={false}
                  filter="url(#glow)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </>
  );

  // Return chart with or without the card wrapper
  if (!showCard) {
    return chartContent;
  }

  const percentageChange = getPercentageChange();
  const isPositive = percentageChange >= 0;

  return (
    <Card
      className="w-full mb-8 overflow-hidden border border-gray-200 dark:border-slate-700/50 hover:border-blue-500/30 dark:hover:border-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-500 group !bg-white dark:!bg-[#0a0a0a]"
      style={{
        backgroundColor: theme === 'dark' ? '#0a0a0a' : 'rgb(255, 255, 255)'
      }}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-4 px-6 pt-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors duration-300">
              <TrendingUp className="h-5 w-5 text-gray-500" />
            </div>
            <CardTitle className="text-lg font-semibold text-white dark:text-white text-slate-900">Cumulative P&L</CardTitle>
          </div>
          {!isLoading && chartData && Array.isArray(chartData) && chartData.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <div className={`text-3xl font-bold ${getLastCumulativePnL() >= 0 ? 'text-gray-500' : 'text-gray-300'}`}>
                {formatCurrency(getLastCumulativePnL())}
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
            className="text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all duration-300 rounded-lg"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        {chartContent}
      </CardContent>
    </Card>
  );
} 