import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
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
  broker: string;
  pnl: number;
  fees?: number;
  commission?: number;
}

interface BrokerStats {
  name: string;
  pnl: number;
  fees: number;
  commission: number;
  trades: number;
}

export function BrokerChart() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<BrokerStats[]>([]);
  const supabase = createClient();

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No authenticated user");

        const { data: trades, error } = await supabase
          .from("trades")
          .select("broker, pnl, fees, commission")
          .eq("user_id", user.id);

        if (error) throw error;

        // Group trades by broker
        const brokerMap = new Map<string, Trade[]>();
        trades?.forEach((trade: Trade) => {
          const trades = brokerMap.get(trade.broker) || [];
          trades.push(trade);
          brokerMap.set(trade.broker, trades);
        });

        // Calculate stats for each broker
        const brokerStats = Array.from(brokerMap.entries()).map(([name, trades]) => {
          const totalPnL = trades.reduce((sum, trade) => sum + trade.pnl, 0);
          const totalFees = trades.reduce((sum, trade) => sum + (trade.fees || 0), 0);
          const totalCommission = trades.reduce((sum, trade) => sum + (trade.commission || 0), 0);
          return {
            name,
            pnl: totalPnL,
            fees: totalFees,
            commission: totalCommission,
            trades: trades.length,
          };
        });

        // Sort by total P&L
        setData(brokerStats.sort((a, b) => b.pnl - a.pnl));
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
      const netPnL = payload[0].value - payload[1].value - payload[2].value;
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{label}</p>
          <p className={`text-sm ${netPnL >= 0 ? 'text-[#4169E1]' : 'text-[#8B008B]'}`}>
            Net P&L: ${netPnL.toFixed(2)}
          </p>
          <p className="text-sm">Gross P&L: ${payload[0].value.toFixed(2)}</p>
          <p className="text-sm">Fees: ${payload[1].value.toFixed(2)}</p>
          <p className="text-sm">Commission: ${payload[2].value.toFixed(2)}</p>
          <p className="text-sm">Trades: {payload[0].payload.trades}</p>
        </div>
      );
    }
    return null;
  };

  // Legend items
  const legendItems = [
    { name: "Gross P&L", color: "#4169E1" },
    { name: "Fees", color: "#8B008B" },
    { name: "Commission", color: "#666666" }
  ];

  return (
    <Card className="bg-background/50 backdrop-blur supports-[backdrop-filter]:bg-background/50">
      <CardHeader>
        <CardTitle>Broker Performance</CardTitle>
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
                name="Gross P&L"
                stackId="a"
                fill="#4169E1"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="fees"
                name="Fees"
                stackId="a"
                fill="#8B008B"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="commission"
                name="Commission"
                stackId="a"
                fill="#666666"
                radius={[0, 0, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
      {/* Custom Legend */}
      <CardFooter>
        <div className="flex flex-wrap gap-4 justify-center w-full">
          {legendItems.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
              <span className="text-sm">{item.name}</span>
            </div>
          ))}
        </div>
      </CardFooter>
    </Card>
  );
} 