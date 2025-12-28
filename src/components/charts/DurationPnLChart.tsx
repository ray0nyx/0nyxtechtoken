import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { Loading } from "@/components/ui/loading";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface Trade {
  entry_date: string;
  exit_date: string;
  pnl: number;
  symbol: string;
}

interface DurationTrade {
  duration: number;
  pnl: number;
  symbol: string;
}

function calculateDurationInDays(entryDate: string, exitDate: string): number {
  const start = new Date(entryDate);
  const end = new Date(exitDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function DurationPnLChart() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DurationTrade[]>([]);
  const supabase = createClient();

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No authenticated user");

        const { data: trades, error } = await supabase
          .from("trades")
          .select("entry_date, exit_date, pnl, symbol")
          .eq("user_id", user.id);

        if (error) throw error;

        const durationTrades = trades?.map((trade: Trade) => ({
          duration: calculateDurationInDays(trade.entry_date, trade.exit_date),
          pnl: trade.pnl,
          symbol: trade.symbol,
        })) || [];

        setData(durationTrades);
      } catch (error) {
        console.error("Error fetching trades:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrades();
  }, []);

  if (loading) return <Loading />;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const trade = payload[0].payload;
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{trade.symbol}</p>
          <p className={`text-sm ${trade.pnl >= 0 ? 'text-[#4169E1]' : 'text-[#8B008B]'}`}>
            P&L: ${trade.pnl.toFixed(2)}
          </p>
          <p className="text-sm">Duration: {trade.duration} days</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="bg-background/50 backdrop-blur supports-[backdrop-filter]:bg-background/50">
      <CardHeader>
        <CardTitle>Trade Duration vs P&L</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="duration"
                name="Duration"
                unit=" days"
                type="number"
                className="text-xs"
              />
              <YAxis
                dataKey="pnl"
                name="P&L"
                tickFormatter={(value) => `$${value.toFixed(0)}`}
                className="text-xs"
              />
              <Tooltip content={<CustomTooltip />} />
              <Scatter name="Trades" data={data}>
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.pnl >= 0 ? "#4169E1" : "#8B008B"}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
} 