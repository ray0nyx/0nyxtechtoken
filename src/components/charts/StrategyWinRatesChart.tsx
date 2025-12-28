import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart2 } from "lucide-react";
import { useState, useEffect } from "react";
import { createClient } from '@/lib/supabase/client';

interface StrategyWinRate {
  name: string;
  winRate: number;
  totalTrades: number;
}

export function StrategyWinRatesChart() {
  const [data, setData] = useState<StrategyWinRate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsLoading(false);
          return;
        }

        // Fetch trades grouped by strategy
        const { data, error } = await supabase
          .from('trades')
          .select('strategy, pnl')
          .eq('user_id', user.id);

        if (error) {
          console.error('Error fetching strategy win rates data:', error);
          setData([]);
          setIsLoading(false);
          return;
        }

        console.log('StrategyWinRatesChart: Fetched trades data:', data);

        if (!data || data.length === 0) {
          setData([]);
          setIsLoading(false);
          return;
        }

        // Group by strategy and calculate win rates
        const strategyMap = new Map<string, { wins: number; total: number }>();
        
        data.forEach(trade => {
          const strategy = trade.strategy || 'Unknown';
          const pnl = trade.pnl || 0;
          const current = strategyMap.get(strategy) || { wins: 0, total: 0 };
          
          if (pnl > 0) {
            current.wins += 1;
          }
          current.total += 1;
          
          strategyMap.set(strategy, current);
        });

        // Convert to array format for chart
        const chartData = Array.from(strategyMap.entries())
          .map(([name, stats]) => ({ 
            name, 
            winRate: stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0,
            totalTrades: stats.total
          }))
          .filter(item => item.totalTrades >= 3) // Only include strategies with at least 3 trades (reduced from 5)
          .sort((a, b) => b.winRate - a.winRate); // Sort by win rate descending

        setData(chartData);
      } catch (error) {
        console.error('Error fetching strategy win rates data:', error);
        setData([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatPercentage = (value: number) => {
    return `${value}%`;
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-blue-500" />
          <CardTitle>Strategy Win Rates</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-[300px]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No strategy data available
          </div>
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.2} />
                <XAxis 
                  type="number"
                  domain={[0, 100]}
                  tickFormatter={formatPercentage}
                  stroke="#888"
                  fontSize={12}
                />
                <YAxis 
                  dataKey="name"
                  type="category"
                  stroke="#888"
                  fontSize={12}
                  width={100}
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'winRate') {
                      return [formatPercentage(value), 'Win Rate'];
                    }
                    return [value, name];
                  }}
                  contentStyle={{ 
                    backgroundColor: 'rgba(0, 0, 0, 0.8)', 
                    border: 'none',
                    borderRadius: '4px',
                    color: '#fff'
                  }}
                  labelFormatter={(value) => {
                    const item = data.find(d => d.name === value);
                    return `${value} (${item?.totalTrades || 0} trades)`;
                  }}
                />
                <Bar 
                  dataKey="winRate" 
                  fill="#3b82f6" 
                  radius={[0, 4, 4, 0]}
                  barSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 