import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { format, parseISO } from 'date-fns';
import { BarChart2, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';
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
  const color = isPositive ? '#3b82f6' : '#9333ea';
  
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

interface DailyPnLBarChartProps {
  limitMonths?: number; // Optional prop to limit data to last N months
  showCard?: boolean; // Optional prop to show/hide card wrapper
}

export function DailyPnLBarChart({ limitMonths, showCard = true }: DailyPnLBarChartProps) {
  const [chartData, setChartData] = useState<DailyPnL[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const supabase = createClient();
  const { toast } = useToast();
  const { theme } = useTheme();

  const fetchTrades = async () => {
    try {
      setIsLoading(true);
      const { data: trades, error } = await supabase
        .from('trades')
        .select('entry_date, exit_date, pnl')
        .order('entry_date', { ascending: true });

      if (error) {
        console.error('Error fetching trades:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch trades data',
          variant: 'destructive',
        });
        return;
      }

      if (!trades || trades.length === 0) {
        console.log('No trades found in database');
        setChartData([]);
        return;
      }

      console.log('Fetched trades:', trades.length, 'trades');

      // Process trades into daily P&L data
      const dailyPnLMap = new Map<string, number>();

      trades.forEach((trade: TradeData) => {
        const entryDate = trade.entry_date || trade.date;
        if (!entryDate) return;

        const date = new Date(entryDate);
        const dateKey = date.toISOString().split('T')[0];
        
        if (dailyPnLMap.has(dateKey)) {
          dailyPnLMap.set(dateKey, dailyPnLMap.get(dateKey)! + (trade.pnl || 0));
        } else {
          dailyPnLMap.set(dateKey, trade.pnl || 0);
        }
      });

      // Convert to array and sort by date
      let dailyData = Array.from(dailyPnLMap.entries())
        .map(([date, pnl]) => ({
          date,
          pnl,
          displayDate: format(parseISO(date), 'MMM dd'),
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Apply month limit if specified
      if (limitMonths) {
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - limitMonths);
        dailyData = dailyData.filter(item => new Date(item.date) >= cutoffDate);
      }

      console.log('Processed daily data:', dailyData.length, 'days');
      setChartData(dailyData);
    } catch (error) {
      console.error('Error processing trades:', error);
      toast({
        title: 'Error',
        description: 'Failed to process trades data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrades();
  }, [limitMonths]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchTrades();
    setIsRefreshing(false);
    toast({
      title: 'Success',
      description: 'Daily P&L data refreshed',
    });
  };

  const getPercentageChange = () => {
    if (chartData.length < 2) return 0;
    const current = chartData[chartData.length - 1]?.pnl || 0;
    const previous = chartData[chartData.length - 2]?.pnl || 0;
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / Math.abs(previous)) * 100;
  };

  const getCurrentDailyPnL = () => {
    if (!chartData.length) {
      return 0;
    }
    return chartData[chartData.length - 1]?.pnl || 0;
  };

  const percentageChange = getPercentageChange();
  const isPositive = percentageChange >= 0;
  const currentDailyPnL = getCurrentDailyPnL();

  const chartContent = (
    <div className="w-full h-full bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}>
            Daily P&L
          </h3>
          {!isLoading && chartData && Array.isArray(chartData) && chartData.length > 0 && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}>
                  Current P&L:
                </span>
                <span 
                  className="text-sm font-bold"
                  style={{ 
                    color: currentDailyPnL >= 0 
                      ? theme === 'dark' ? 'rgb(59 130 246)' : 'rgb(59 130 246)'
                      : theme === 'dark' ? 'rgb(147 51 234)' : 'rgb(147 51 234)'
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
            </div>
          )}
        </div>
      </div>
      <div className="px-4 pb-4" style={{ height: 'calc(100% - 80px)' }}>
        {isLoading ? (
        <div className="flex items-center justify-center h-[300px]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : !chartData || !Array.isArray(chartData) || chartData.length === 0 ? (
        <div className="flex items-center justify-center h-[300px] text-muted-foreground">
          No trading data available
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <defs>
              <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9}/>
                <stop offset="50%" stopColor="#3b82f6" stopOpacity={0.6}/>
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.3}/>
              </linearGradient>
              <linearGradient id="lossGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#9333ea" stopOpacity={0.9}/>
                <stop offset="50%" stopColor="#9333ea" stopOpacity={0.6}/>
                <stop offset="100%" stopColor="#9333ea" stopOpacity={0.3}/>
              </linearGradient>
              <filter id="glowBar">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge> 
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              <filter id="glowText" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge> 
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            <CartesianGrid strokeDasharray="1 1" stroke="rgba(255, 255, 255, 0.1)" opacity={0.3} />
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
                <span style={{ color: value >= 0 ? '#3b82f6' : '#9333ea', fontWeight: 'bold' }}>{formatCurrency(value || 0)}</span>, 
                <span style={{ color: value >= 0 ? '#3b82f6' : '#9333ea' }}>Daily P&L</span>
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
            <ReferenceLine y={0} stroke="rgba(255, 255, 255, 0.3)" strokeDasharray="2 2" />
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
    </div>
  );

  if (!showCard) return chartContent;

  return (
    <Card 
      className="w-full mb-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:shadow-purple-500/10 overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-900 dark:to-slate-800 from-slate-50 to-slate-100"
    >
      <CardHeader className="bg-purple-500/10 dark:bg-purple-500/20">
        <CardTitle className="text-white dark:text-slate-900 flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-500/20 dark:bg-purple-500/30">
            <BarChart2 className="h-4 w-4 text-purple-400 dark:text-purple-600" />
          </div>
          Daily P&L
          {!isLoading && chartData && Array.isArray(chartData) && chartData.length > 0 && (
            <div className="ml-auto flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-blue-400 dark:text-blue-600">Current P&L:</span>
                <span className={`text-lg font-bold ${currentDailyPnL >= 0 ? 'text-blue-400 dark:text-blue-600' : 'text-purple-400 dark:text-purple-600'}`}>
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
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {chartContent}
      </CardContent>
    </Card>
  );
}