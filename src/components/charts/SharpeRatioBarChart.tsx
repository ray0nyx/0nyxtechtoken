import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Trade } from '@/types/trade';

interface SharpeRatioBarChartProps {
  trades: Trade[];
}

const SharpeRatioBarChart = ({ trades }: SharpeRatioBarChartProps) => {
  const monthlyData = trades.reduce((acc, trade) => {
    const month = new Date(trade.entry_date).toLocaleString('default', { month: 'short', year: 'numeric' });
    if (!acc[month]) {
      acc[month] = { pnl: 0, returns: [] };
    }
    acc[month].pnl += trade.pnl;
    acc[month].returns.push(trade.pnl);
    return acc;
  }, {} as Record<string, { pnl: number, returns: number[] }>);

  const chartData = Object.entries(monthlyData).map(([month, data]) => {
    const avgReturn = data.pnl / (data.returns.length || 1);
    const stdDev = Math.sqrt(data.returns.map(r => Math.pow(r - avgReturn, 2)).reduce((a, b) => a + b, 0) / (data.returns.length || 1));
    const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;
    return { month, sharpeRatio };
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="sharpeRatio" fill="#82ca9d" name="Monthly Sharpe Ratio" />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default SharpeRatioBarChart;