import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface EquityChartViewProps {
  equityCurve: { timestamp: string; equity: number }[];
  currentEquity?: number;
  initialCapital?: number;
}

export default function EquityChartView({
  equityCurve,
  currentEquity,
  initialCapital = 100000,
}: EquityChartViewProps) {
  if (!equityCurve || equityCurve.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-[#6b7280]">
        <p>No equity data available</p>
      </div>
    );
  }

  const chartData = equityCurve.map((point) => ({
    date: new Date(point.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    equity: point.equity,
    timestamp: point.timestamp,
  }));

  const maxEquity = Math.max(...chartData.map((d) => d.equity), initialCapital);
  const minEquity = Math.min(...chartData.map((d) => d.equity), initialCapital);

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6b7280', fontSize: 12 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6b7280', fontSize: 12 }}
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
            domain={[minEquity * 0.95, maxEquity * 1.05]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1f2e',
              border: '1px solid #1f2937',
              borderRadius: '8px',
            }}
            labelStyle={{ color: '#9ca3af' }}
            formatter={(value: number) => [`$${value.toLocaleString()}`, 'Equity']}
          />
          <ReferenceLine
            y={initialCapital}
            stroke="#6b7280"
            strokeDasharray="3 3"
            label={{ value: 'Initial Capital', position: 'right', fill: '#6b7280' }}
          />
          <Area
            type="monotone"
            dataKey="equity"
            stroke="#0ea5e9"
            fill="url(#equityGradient)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

