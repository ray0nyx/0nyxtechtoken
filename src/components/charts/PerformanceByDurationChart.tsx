import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Timer, ChevronUp, ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";
import { createClient } from '@/lib/supabase/client';
import { differenceInMinutes } from 'date-fns';
import { useTheme } from '@/components/ThemeProvider';

interface DurationPerformance {
  name: string;
  pnl: number;
  trades: number;
  avgPnl: number;
}

export function PerformanceByDurationChart() {
  const [data, setData] = useState<DurationPerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsLoading(false);
          return;
        }

        // Fetch trades with entry and exit dates
        const { data, error } = await supabase
          .from('trades')
          .select('entry_date, exit_date, pnl')
          .eq('user_id', user.id)
          .not('exit_date', 'is', null)
          .not('entry_date', 'is', null);

        if (error) {
          console.error('Error fetching performance by duration data:', error);
          setData([]);
          setIsLoading(false);
          return;
        }

        console.log('PerformanceByDurationChart: Fetched trades data:', data);

        if (!data || data.length === 0) {
          setData([]);
          setIsLoading(false);
          return;
        }

        // Define duration buckets with the requested time intervals
        const buckets = [
          { name: '< 1 min', min: 0, max: 1, pnl: 0, trades: 0 },
          { name: '< 15 min', min: 1, max: 15, pnl: 0, trades: 0 },
          { name: '< 30 min', min: 15, max: 30, pnl: 0, trades: 0 },
          { name: '< 1 hr', min: 30, max: 60, pnl: 0, trades: 0 },
          { name: '< 4 hrs', min: 60, max: 240, pnl: 0, trades: 0 },
          { name: '< 24 hrs', min: 240, max: 1440, pnl: 0, trades: 0 }
        ];

        // Group trades by duration bucket
        data.forEach(trade => {
          if (trade.entry_date && trade.exit_date) {
            try {
              const entryDate = new Date(trade.entry_date);
              const exitDate = new Date(trade.exit_date);

              // Check if dates are valid
              if (isNaN(entryDate.getTime()) || isNaN(exitDate.getTime())) {
                console.warn('Invalid date format for trade:', trade);
                return;
              }

              const duration = differenceInMinutes(exitDate, entryDate);

              // Only include trades with valid duration (positive)
              if (duration >= 0) {
                // Find the appropriate bucket
                let bucketFound = false;

                for (let i = 0; i < buckets.length; i++) {
                  const bucket = buckets[i];

                  // For the first bucket, check if duration is less than max
                  if (i === 0 && duration < bucket.max) {
                    bucket.pnl += trade.pnl || 0;
                    bucket.trades += 1;
                    bucketFound = true;
                    break;
                  }

                  // For other buckets, check if duration is in range [min, max)
                  if (i > 0 && duration >= bucket.min && duration < bucket.max) {
                    bucket.pnl += trade.pnl || 0;
                    bucket.trades += 1;
                    bucketFound = true;
                    break;
                  }
                }

                // For trades longer than 24 hours, add to the last bucket
                if (!bucketFound && duration >= 1440) {
                  const lastBucket = buckets[buckets.length - 1];
                  lastBucket.pnl += trade.pnl || 0;
                  lastBucket.trades += 1;
                }
              }
            } catch (err) {
              console.error('Error processing trade duration:', err, trade);
            }
          }
        });

        // Filter out buckets with no trades
        const chartData = buckets
          .filter(bucket => bucket.trades > 0)
          .map(bucket => ({
            name: bucket.name,
            pnl: bucket.pnl,
            trades: bucket.trades,
            // Add average PnL per trade with division by zero protection
            avgPnl: bucket.trades > 0 ? bucket.pnl / bucket.trades : 0
          }));

        console.log('PerformanceByDurationChart: Processed bucket data:', chartData);
        setData(chartData);
      } catch (error) {
        console.error('Error fetching performance by duration data:', error);
        setData([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Calculate current metrics for trend indicator
  const currentPnl = data.length > 0 ? data.reduce((sum, item) => sum + item.pnl, 0) : 0;
  const totalTrades = data.length > 0 ? data.reduce((sum, item) => sum + item.trades, 0) : 0;

  // Theme-aware colors
  const textColor = isDark ? '#e2e8f0' : '#1e293b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  const axisColor = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';

  return (
    <Card className="border-neutral-800 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden bg-[#0a0a0a]">
      <CardHeader className="bg-[#0a0a0a] border-b border-neutral-800">
        <CardTitle className="text-white flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-neutral-800">
            <Timer className="h-4 w-4 text-neutral-400" />
          </div>
          Performance by Duration
          <div className="ml-auto flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-400">P&L:</span>
              <span className={`text-lg font-bold ${currentPnl >= 0 ? 'text-neutral-200' : 'text-neutral-500'}`}>
                {formatCurrency(currentPnl)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-400">Trades:</span>
              <span className="text-lg font-bold text-neutral-300">
                {totalTrades}
              </span>
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-[350px]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-[350px] text-slate-400 dark:text-slate-600">
            No duration performance data available
          </div>
        ) : (
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 10, right: 20, left: 10, bottom: 40 }}
              >
                <defs>
                  <linearGradient id="durationGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#d4d4d4" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#737373" stopOpacity="0.4" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
                <XAxis
                  dataKey="name"
                  stroke="#525252"
                  fontSize={12}
                  tick={{
                    fill: '#a3a3a3'
                  }}
                  tickMargin={10}
                  angle={0}
                  textAnchor="middle"
                  height={40}
                />
                <YAxis
                  tickFormatter={formatCurrency}
                  stroke="#525252"
                  fontSize={12}
                  tick={{
                    fill: '#a3a3a3'
                  }}
                  width={65}
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'pnl') {
                      return [formatCurrency(value), 'P&L'];
                    }
                    if (name === 'trades') {
                      return [value, 'Trades'];
                    }
                    return [value, name];
                  }}
                  contentStyle={{
                    backgroundColor: '#0a0a0a',
                    border: '1px solid #262626',
                    borderRadius: '12px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                    color: '#fff',
                    backdropFilter: 'blur(10px)'
                  }}
                />
                <Bar
                  dataKey="pnl"
                  fill="url(#durationGradient)"
                  radius={[4, 4, 0, 0]}
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 