import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, TrendingUp } from "lucide-react";
import { format, parseISO } from 'date-fns';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer
} from 'recharts';
import { getTodayPnL, TradeData } from '@/lib/pnlData';

interface ChartDataPoint {
  date: string;
  displayDate: string;
  pnl: number;
  cumulativePnL: number;
}

export function TodayPnLChart() {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalPnL, setTotalPnL] = useState(0);

  const fetchTodayPnL = async () => {
    try {
      setIsLoading(true);

      const { trades, totalPnL } = await getTodayPnL();

      console.log('TodayPnLChart: Fetched data:', { trades, totalPnL });

      // If no trades found, create empty chart
      if (trades.length === 0) {
        const emptyData = [
          {
            date: new Date().toISOString(),
            displayDate: '9:30 AM',
            pnl: 0,
            cumulativePnL: 0
          },
          {
            date: new Date().toISOString(),
            displayDate: '4:00 PM',
            pnl: 0,
            cumulativePnL: 0
          }
        ];
        setChartData(emptyData);
        setTotalPnL(0);
        setIsLoading(false);
        return;
      }

      // Process trade data
      let cumulativePnL = 0;
      const sortedTrades = trades.sort((a, b) => {
        const aDate = new Date(a.exit_date || a.entry_date || a.date);
        const bDate = new Date(b.exit_date || b.entry_date || b.date);
        return aDate.getTime() - bDate.getTime();
      });

      // Create starting point
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const startOfDay = new Date(todayStr);
      startOfDay.setHours(9, 30, 0, 0);

      const processedData = [
        // Add starting point
        {
          date: startOfDay.toISOString(),
          displayDate: format(startOfDay, 'h:mm a'),
          pnl: 0,
          cumulativePnL: 0
        },
        // Add actual trades
        ...sortedTrades.map((trade) => {
          const dateToUse = trade.exit_date || trade.entry_date || trade.date;
          const displayDate = format(parseISO(dateToUse), 'h:mm a');
          const pnlValue = parseFloat(trade.pnl?.toString() || '0');
          cumulativePnL += pnlValue;

          return {
            date: dateToUse,
            displayDate,
            pnl: pnlValue,
            cumulativePnL
          };
        })
      ];

      // If there's only one trade, add an end point at market close
      if (sortedTrades.length === 1) {
        const endOfDay = new Date(todayStr);
        endOfDay.setHours(16, 0, 0, 0); // Market close at 4:00 PM
        processedData.push({
          date: endOfDay.toISOString(),
          displayDate: format(endOfDay, 'h:mm a'),
          pnl: cumulativePnL,
          cumulativePnL: cumulativePnL
        });
      }

      console.log('TodayPnLChart: Final processed data:', processedData);
      console.log('TodayPnLChart: Final cumulative P&L:', cumulativePnL);
      setChartData(processedData);
      setTotalPnL(cumulativePnL);
    } catch (error) {
      console.error('Error fetching today\'s PnL data:', error);
      setChartData([]);
      setTotalPnL(0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayPnL();
  }, []);

  // Add a refresh function that can be called externally
  const refreshData = () => {
    fetchTodayPnL();
  };

  // Expose refresh function to window for debugging
  if (typeof window !== 'undefined') {
    (window as any).refreshTodayPnL = refreshData;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  console.log('TodayPnLChart: Rendering with isLoading:', isLoading, 'chartData:', chartData, 'totalPnL:', totalPnL);

  return (
    <Card className="rounded-xl border transition-all duration-500 hover:shadow-2xl hover:shadow-teal-500/10 group overflow-hidden bg-gray-100 dark:!bg-[#0a0a0a] border-gray-200 dark:border-slate-700/50 hover:border-teal-500/30 dark:hover:border-teal-500/30 shadow-lg shadow-teal-500/5 hover:shadow-teal-500/20 h-full">
      <CardHeader className="pb-2 group-hover:bg-teal-500/10 transition-colors duration-300 flex flex-row items-center justify-between px-4 pt-4">
        <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <div className="p-2 rounded-lg bg-teal-500/10 group-hover:bg-teal-500/20 transition-colors duration-300">
            <TrendingUp className="h-5 w-5 text-teal-600 dark:text-teal-400" />
          </div>
          Today's P&L
        </CardTitle>
        <div className="flex items-center gap-2">
          {totalPnL !== 0 && (
            <div className={`text-lg font-bold ${totalPnL >= 0 ? 'text-gray-500' : 'text-gray-300'}`}>
              {formatCurrency(totalPnL)}
            </div>
          )}
          <button
            onClick={refreshData}
            className="p-1 rounded hover:bg-teal-500/20 transition-colors"
            title="Refresh data"
          >
            <RefreshCw className="h-4 w-4 text-teal-400" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 h-[calc(100%-70px)] flex items-center justify-center">
        {isLoading ? (
          <div className="flex justify-center items-center h-full w-full bg-transparent dark:!bg-[#0a0a0a] rounded-xl">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="h-8 w-8 animate-spin text-teal-400" />
              <span className="text-slate-400">Loading today's data...</span>
            </div>
          </div>
        ) : !chartData || chartData.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-full w-full bg-transparent dark:!bg-[#0a0a0a] rounded-xl">
            <TrendingUp className="h-8 w-8 text-slate-400 mb-3" />
            <p className="text-slate-400">No trading data for today</p>
          </div>
        ) : (
          <div className="h-full w-full bg-transparent dark:!bg-[#0a0a0a] rounded-xl p-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
              >
                <defs>
                  {/* Glow filter for axis text */}
                  <filter id="glowText" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <linearGradient id="colorTodayPnl" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={totalPnL >= 0 ? '#6b7280' : '#d1d5db'}
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="95%"
                      stopColor={totalPnL >= 0 ? '#6b7280' : '#d1d5db'}
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" opacity={0.3} />
                <XAxis
                  dataKey="displayDate"
                  stroke="rgba(16, 185, 129, 0.6)"
                  fontSize={12}
                  tickMargin={8}
                  tick={{ fill: '#10b981', fontWeight: 600, filter: 'url(#glowText)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={formatCurrency}
                  stroke="rgba(255, 255, 255, 0.6)"
                  fontSize={12}
                  axisLine={false}
                  tickLine={false}
                  tick={({ x, y, payload }: any) => {
                    const value = payload.value;
                    const color = value >= 0 ? '#6b7280' : '#d1d5db';
                    return (
                      <g transform={`translate(${x},${y})`}>
                        <text x={0} y={0} dy={4} textAnchor="end" fill={color} fontSize={12} filter="url(#glowText)">
                          {formatCurrency(value)}
                        </text>
                      </g>
                    );
                  }}
                />
                <RechartsTooltip
                  formatter={(value: number) => [
                    <span style={{ color: totalPnL >= 0 ? '#6b7280' : '#d1d5db', fontWeight: 'bold' }}>{formatCurrency(value || 0)}</span>,
                    <span style={{ color: '#94a3b8' }}>P&L</span>
                  ]}
                  labelFormatter={(label) => <span style={{ color: '#94a3b8' }}>{label as string}</span>}
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    color: '#fff',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                    backdropFilter: 'blur(10px)'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cumulativePnL"
                  stroke={totalPnL >= 0 ? '#6b7280' : '#d1d5db'}
                  strokeWidth={3}
                  fill="url(#colorTodayPnl)"
                  dot={false}
                  activeDot={{ r: 6, stroke: totalPnL >= 0 ? '#4b5563' : '#9ca3af', strokeWidth: 2, fill: '#fff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 