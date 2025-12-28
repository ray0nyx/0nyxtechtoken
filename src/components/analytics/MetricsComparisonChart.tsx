import React from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/formatters';
import { useTheme } from '@/components/ThemeProvider';

interface MetricsComparisonChartProps {
  trades: any[];
  showCard?: boolean;
}

export function MetricsComparisonChart({ trades = [], showCard = true }: MetricsComparisonChartProps) {
  const { theme } = useTheme();
  // Process trades to calculate current metrics
  const calculateMetrics = (trades: any[]) => {
    if (!trades.length) return null;

    const winningTrades = trades.filter(t => (t.pnl || 0) > 0);
    const losingTrades = trades.filter(t => (t.pnl || 0) < 0);

    // Calculate metrics
    const winRate = (winningTrades.length / trades.length) * 100;
    const avgWin = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / winningTrades.length
      : 0;
    const avgLoss = losingTrades.length > 0
      ? Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / losingTrades.length)
      : 0;

    // Calculate total wins and losses for profit factor
    const totalWins = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? 5 : 0;

    // Scale metrics appropriately for radar display
    const profitFactorMax = profitFactor > 2 ? Math.ceil(profitFactor) : 2;
    const scaledProfitFactor = (Math.min(profitFactor, profitFactorMax) / profitFactorMax) * 100;
    const scaledWinRate = winRate; // Win rate is already 0-100
    const maxPnL = Math.max(avgWin, avgLoss);
    const scaledAvgWin = maxPnL > 0 ? (avgWin / maxPnL) * 100 : 0;
    const scaledAvgLoss = maxPnL > 0 ? (avgLoss / maxPnL) * 100 : 0;

    // Calculate percentage changes (simplified for demo - in real app, compare with previous period)
    const winRateChange = 5.2; // Example: 5.2% increase
    const profitFactorChange = -2.1; // Example: 2.1% decrease
    const avgWinChange = 8.7; // Example: 8.7% increase
    const avgLossChange = -3.4; // Example: 3.4% decrease

    return [
      {
        metric: "Win Rate",
        value: scaledWinRate,
        fullValue: `${winRate.toFixed(2)}%`,
        change: winRateChange
      },
      {
        metric: "Profit Factor",
        value: scaledProfitFactor,
        fullValue: profitFactor.toFixed(2),
        change: profitFactorChange
      },
      {
        metric: "Avg Win",
        value: scaledAvgWin,
        fullValue: formatCurrency(avgWin),
        change: avgWinChange
      },
      {
        metric: "Avg Loss",
        value: scaledAvgLoss,
        fullValue: formatCurrency(avgLoss),
        change: avgLossChange
      }
    ];
  };

  const data = calculateMetrics(trades) || [];

  // Custom tooltip formatter
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      const isPositive = dataPoint.change >= 0;
      return (
        <div className="bg-[#0a0a0a] border border-neutral-800 rounded-lg shadow-lg p-3 backdrop-blur-sm">
          <p className="text-sm font-medium text-white">
            {dataPoint.metric}
          </p>
          <p className="text-sm font-bold text-neutral-300">
            {dataPoint.fullValue}
          </p>
          <p
            className="text-xs"
            style={{
              color: isPositive ? '#a3a3a3' : '#525252'
            }}
          >
            {isPositive ? '+' : ''}{dataPoint.change.toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  const chart = (
    <div className="w-full h-full bg-[#0a0a0a] rounded-xl border border-neutral-800">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}>
            Risk Assessment
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-400">
              Avg Change:
            </span>
            <span
              className="text-sm font-bold"
              style={{
                color: data.length > 0 && data[0].change >= 0 ? '#a3a3a3' : '#737373'
              }}
            >
              {data.length > 0 ? (data.reduce((sum, item) => sum + item.change, 0) / data.length).toFixed(1) : '0.0'}%
            </span>
          </div>
        </div>
      </div>
      <div style={{ height: 'calc(100% - 80px)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <defs>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="glowText" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <PolarGrid
              gridType="polygon"
              stroke="#333"
              strokeOpacity={0.5}
            />
            <PolarAngleAxis
              dataKey="metric"
              tick={{
                fill: '#a3a3a3',
                fontSize: 12
              }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 100]}
              tick={{
                fontSize: 12,
                fill: '#737373'
              }}
              axisLine={false}
              tickCount={5}
            />
            <Tooltip content={<CustomTooltip />} />
            <Radar
              name="Metrics"
              dataKey="value"
              stroke="#a3a3a3"
              fill="#a3a3a3"
              fillOpacity={0.3}
              strokeWidth={3}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  if (!showCard) return chart;

  return (
    <Card className="shadow-lg hover:shadow-xl transition-all duration-300 border-neutral-800 overflow-hidden bg-[#0a0a0a]">
      <div className="bg-[#0a0a0a] p-4 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-neutral-800">
            <div className="h-4 w-4 text-neutral-400">📊</div>
          </div>
          <h3 className="text-lg font-semibold text-white">Risk Assessment</h3>
        </div>
      </div>
      <div className="p-6">
        {chart}
      </div>
    </Card>
  );
} 