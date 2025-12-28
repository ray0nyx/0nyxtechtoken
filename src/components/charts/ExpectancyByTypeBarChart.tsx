import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Trade } from '@/types/trade';
import { expectancy } from '@/lib/utils';

interface ExpectancyByTypeBarChartProps {
  trades: Trade[];
}

const getTypeKey = (trade: Trade) => {
  // Use strategy if available, else position (long/short)
  return trade.strategy ? trade.strategy : trade.position;
};

const ExpectancyByTypeBarChart = ({ trades }: ExpectancyByTypeBarChartProps) => {
  // Group trades by type
  const typeGroups = trades.reduce((acc, trade) => {
    const key = getTypeKey(trade);
    if (!acc[key]) acc[key] = [];
    acc[key].push(trade);
    return acc;
  }, {} as Record<string, Trade[]>);

  const chartData = Object.entries(typeGroups).map(([type, group]) => {
    const wins = group.filter(t => t.pnl > 0);
    const losses = group.filter(t => t.pnl < 0);
    const winRate = group.length ? wins.length / group.length : 0;
    const avgWin = wins.length ? wins.reduce((a, b) => a + b.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length ? losses.reduce((a, b) => a + b.pnl, 0) / losses.length : 0;
    return {
      type,
      expectancy: expectancy(winRate, avgWin, avgLoss),
      winRate: winRate * 100,
      avgWin,
      avgLoss,
      count: group.length
    };
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
        <XAxis dataKey="type" stroke="#525252" tick={{ fill: '#a3a3a3' }} />
        <YAxis stroke="#525252" tick={{ fill: '#a3a3a3' }} />
        <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #262626', color: '#fff' }} />
        <Legend />
        <Bar dataKey="expectancy" fill="#d4d4d4" radius={[4, 4, 0, 0]} name="Expectancy" />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default ExpectancyByTypeBarChart; 