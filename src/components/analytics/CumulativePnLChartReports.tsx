import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { format, parseISO } from 'date-fns';
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
  cumulativePnL: number;
  displayDate: string;
}

interface CumulativePnLChartReportsProps {
  trades?: any[]; // Optional trades data that can be passed in
}

const CumulativePnLChartReports = ({ trades: providedTrades }: CumulativePnLChartReportsProps) => {
  const [chartData, setChartData] = useState<DailyPnL[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [trades, setTrades] = useState<any[]>([]);
  const { theme } = useTheme();

  const fetchTrades = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('No user found');
        return;
      }

      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .order('entry_date', { ascending: true });

      if (error) {
        console.error('Error fetching trades:', error);
        return;
      }

      setTrades(data || []);
    } catch (error) {
      console.error('Error in fetchTrades:', error);
    }
  };

  useEffect(() => {
    if (providedTrades) {
      setTrades(providedTrades);
    } else {
      fetchTrades();
    }
  }, [providedTrades]);

  const processTrades = (tradesData: any[]): DailyPnL[] => {
    if (!tradesData || tradesData.length === 0) {
      // Return fallback data with two points at 0 P&L for today and tomorrow
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const formatSimpleDate = (date: Date) => {
        return date.toISOString().split('T')[0];
      };
      
      return [
        {
          date: formatSimpleDate(today),
          pnl: 0,
          cumulativePnL: 0,
          displayDate: format(today, 'MMM d')
        },
        {
          date: formatSimpleDate(tomorrow),
          pnl: 0,
          cumulativePnL: 0,
          displayDate: format(tomorrow, 'MMM d')
        }
      ];
    }

    // Group trades by date and calculate daily P&L
    const dailyPnLMap = new Map<string, number>();
    
    tradesData.forEach(trade => {
      const tradeDate = trade.exit_date || trade.entry_date || trade.date;
      if (!tradeDate) return;
      
      const dateKey = tradeDate.split('T')[0]; // Get YYYY-MM-DD part
      const pnl = parseFloat(trade.pnl) || 0;
      
      if (dailyPnLMap.has(dateKey)) {
        dailyPnLMap.set(dateKey, dailyPnLMap.get(dateKey)! + pnl);
      } else {
        dailyPnLMap.set(dateKey, pnl);
      }
    });

    // Convert to array and sort by date
    const dailyPnLArray = Array.from(dailyPnLMap.entries())
      .map(([date, pnl]) => ({
        date,
        pnl,
        cumulativePnL: 0, // Will be calculated below
        displayDate: format(parseISO(date), 'MMM d')
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate cumulative P&L
    let cumulative = 0;
    dailyPnLArray.forEach(day => {
      cumulative += day.pnl;
      day.cumulativePnL = cumulative;
    });

    // If there's only one trade, add a starting point at 0
    if (dailyPnLArray.length === 1) {
      const singleTrade = dailyPnLArray[0];
      const tradeDate = new Date(singleTrade.date);
      const startDate = new Date(tradeDate);
      startDate.setMinutes(startDate.getMinutes() - 1); // 1 minute before
      
      dailyPnLArray.unshift({
        date: startDate.toISOString().split('T')[0],
        pnl: 0,
        cumulativePnL: 0,
        displayDate: format(startDate, 'MMM d')
      });
    }

    return dailyPnLArray;
  };

  useEffect(() => {
    if (trades.length > 0 || providedTrades) {
      const processedData = processTrades(trades);
      setChartData(processedData);
      setIsLoading(false);
    } else if (trades.length === 0) {
      // No trades available, show fallback data
      const fallbackData = processTrades([]);
      setChartData(fallbackData);
      setIsLoading(false);
    }
  }, [trades, providedTrades]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[800px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!chartData || !Array.isArray(chartData) || chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[800px] bg-slate-900 rounded-xl text-white">
        <div className="text-center">
          <div className="text-lg font-semibold mb-2">No Trading Data Available</div>
          <div className="text-sm text-slate-400">Start trading to see your cumulative P&L</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full !bg-gray-100 dark:!bg-slate-900 rounded-xl">
      <div style={{ width: '100%', height: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <defs>
              <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                <stop 
                  offset="0%" 
                  stopColor="#3b82f6" 
                  stopOpacity={0.4}
                />
                <stop 
                  offset="100%" 
                  stopColor="#3b82f6" 
                  stopOpacity={0.1}
                />
              </linearGradient>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
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
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis 
              dataKey="displayDate" 
              stroke="rgba(34, 197, 94, 0.8)"
              fontSize={12}
              angle={-45}
              textAnchor="end"
              height={60}
              tickMargin={10}
            />
            <YAxis 
              tick={<CustomYAxisTick />}
              stroke="rgba(255, 255, 255, 0.6)"
              domain={['dataMin - 100', 'dataMax + 100']}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.95)' : 'rgb(255 255 255)',
                border: theme === 'dark' ? '1px solid rgb(51 65 85)' : '1px solid rgb(229 231 235)',
                borderRadius: '8px',
                color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)'
              }}
              formatter={(value: number) => [formatCurrency(value), 'Cumulative P&L']}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Area
              type="monotone"
              dataKey="cumulativePnL"
              stroke="#3b82f6"
              strokeWidth={3}
              fill="url(#colorPnl)"
              filter="url(#glow)"
              dot={false}
              activeDot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default CumulativePnLChartReports;
