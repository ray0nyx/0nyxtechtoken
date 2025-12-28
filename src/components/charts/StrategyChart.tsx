import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { Loading } from "@/components/ui/loading";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Trade {
  strategy: string;
  pnl: number;
}

interface StrategyStats {
  name: string;
  pnl: number;
  trades: number;
  winRate: number;
}

export function StrategyChart() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StrategyStats[]>([]);
  const supabase = createClient();

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No authenticated user");

        const { data: trades, error } = await supabase
          .from("trades")
          .select("strategy, pnl")
          .eq("user_id", user.id);

        if (error) throw error;

        // Group trades by strategy
        const strategyMap = new Map<string, Trade[]>();
        trades?.forEach((trade: Trade) => {
          const trades = strategyMap.get(trade.strategy) || [];
          trades.push(trade);
          strategyMap.set(trade.strategy, trades);
        });

        // Calculate stats for each strategy
        const strategyStats = Array.from(strategyMap.entries()).map(([name, trades]) => {
          const totalPnL = trades.reduce((sum, trade) => sum + trade.pnl, 0);
          const winningTrades = trades.filter(trade => trade.pnl > 0).length;
          return {
            name,
            pnl: totalPnL,
            trades: trades.length,
            winRate: (winningTrades / trades.length) * 100,
          };
        });

        // Sort by total P&L
        setData(strategyStats.sort((a, b) => b.pnl - a.pnl));
      } catch (error) {
        console.error("Error fetching trades:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrades();
  }, []);

  if (loading) return <Loading />;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{label}</p>
          <p className={`text-sm ${payload[0].value >= 0 ? 'text-[#4169E1]' : 'text-[#8B008B]'}`}>
            P&L: ${payload[0].value.toFixed(2)}
          </p>
          <p className="text-sm">Trades: {payload[0].payload.trades}</p>
          <p className="text-sm">Win Rate: {payload[0].payload.winRate.toFixed(1)}%</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="bg-background/50 backdrop-blur supports-[backdrop-filter]:bg-background/50">
      <CardHeader>
        <CardTitle>Strategy Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis
                tickFormatter={(value) => `$${value.toFixed(0)}`}
                className="text-xs"
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="pnl"
                fill="#4169E1"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
} 