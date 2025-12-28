import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { ResponsiveContainer, Sankey, Tooltip, Label } from 'recharts';
import { formatCurrency } from '@/lib/formatters';

interface TradingSankeyChartProps {
  trades?: any[];
}

export function TradingSankeyChart({ trades = [] }: TradingSankeyChartProps) {
  const processTradeData = (trades: any[]) => {
    if (!trades.length) return { nodes: [], links: [] };

    // Initialize day-wise PnL tracking
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayPnL = daysOfWeek.reduce((acc, day) => ({ ...acc, [day]: { wins: 0, losses: 0 } }), {});

    // Calculate PnL for each day
    trades.forEach(trade => {
      const date = new Date(trade.entry_date);
      const day = daysOfWeek[date.getDay()];
      const pnl = trade.pnl || 0;

      if (pnl > 0) {
        dayPnL[day].wins += pnl;
      } else {
        dayPnL[day].losses += Math.abs(pnl);
      }
    });

    // Create nodes and links for the Sankey diagram
    const nodes = [
      // Source nodes (Days)
      ...daysOfWeek.map(day => ({
        name: day,
        category: 'day',
        value: dayPnL[day].wins - dayPnL[day].losses // Net PnL for color
      })),
      // Intermediate nodes (Win/Loss)
      { name: 'Winning Days', category: 'result', value: 1 },
      { name: 'Losing Days', category: 'result', value: -1 },
      // Target node (Total PnL)
      { name: 'Total PnL', category: 'total', value: 0 }
    ];

    const links = [];
    let totalWins = 0;
    let totalLosses = 0;

    // Create links from days to win/loss nodes
    daysOfWeek.forEach((day, index) => {
      const { wins, losses } = dayPnL[day];
      totalWins += wins;
      totalLosses += losses;

      if (wins > 0) {
        links.push({
          source: index,
          target: daysOfWeek.length,
          value: wins,
          dayType: 'win'
        });
      }
      if (losses > 0) {
        links.push({
          source: index,
          target: daysOfWeek.length + 1,
          value: losses,
          dayType: 'loss'
        });
      }
    });

    // Create links to final PnL node
    links.push(
      {
        source: daysOfWeek.length,
        target: daysOfWeek.length + 2,
        value: totalWins,
        dayType: 'win'
      },
      {
        source: daysOfWeek.length + 1,
        target: daysOfWeek.length + 2,
        value: -totalLosses,
        dayType: 'loss'
      }
    );

    return { nodes, links };
  };

  const data = processTradeData(trades);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const { source, target, value, dayType } = payload[0];
      return (
        <div className="bg-white/90 dark:bg-gray-800/90 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium mb-1">
            {source} → {target}
          </p>
          <p className={`text-sm font-bold ${dayType === 'win' ? 'text-blue-500' : 'text-purple-500'}`}>
            {formatCurrency(Math.abs(value))}
          </p>
        </div>
      );
    }
    return null;
  };

  // Get node color based on category and value
  const getNodeColor = (node: any) => {
    switch (node.category) {
      case 'day':
        return node.value >= 0 ? '#3b82f6' : '#a855f7';
      case 'result':
        return node.value > 0 ? '#3b82f6' : '#a855f7';
      case 'total':
        return '#64748b'; // Neutral color for total
      default:
        return '#8884d8';
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        {!trades.length ? (
          <div className="flex items-center justify-center h-[400px] text-muted-foreground">
            No trade data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <Sankey
              data={data}
              node={{
                nodePadding: 50,
                nodeWidth: 15,
                fill: (node: any) => getNodeColor(node),
              }}
              link={{
                stroke: "#000",
                strokeOpacity: 0.2,
                fill: (entry: any) => entry.dayType === 'win' ? '#3b82f6' : '#a855f7',
                fillOpacity: 0.6
              }}
              margin={{
                top: 20,
                right: 50,
                left: 50,
                bottom: 20,
              }}
            >
              <Label
                position="insideTopLeft"
                offset={20}
                content={({ index, x, y, width, height, payload }: any) => (
                  <text
                    x={x + width + 10}
                    y={y + height / 2}
                    fill="#64748b"
                    textAnchor="start"
                    dominantBaseline="middle"
                    fontSize={12}
                  >
                    {payload.name}
                  </text>
                )}
              />
              <Tooltip content={<CustomTooltip />} />
            </Sankey>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
} 