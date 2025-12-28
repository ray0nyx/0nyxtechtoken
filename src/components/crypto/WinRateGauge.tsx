import React from 'react';
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { Target } from 'lucide-react';

interface WinRateGaugeProps {
  winRate: number; // 0-100
  size?: number;
}

export default function WinRateGauge({ winRate, size = 200 }: WinRateGaugeProps) {
  // Ensure winRate is between 0 and 100
  const normalizedWinRate = Math.min(100, Math.max(0, winRate));
  
  // Determine color based on win rate
  const getColor = (rate: number): string => {
    if (rate >= 60) return '#10b981'; // emerald-500 (green)
    if (rate >= 40) return '#f59e0b'; // amber-500 (yellow)
    return '#ef4444'; // red-500 (red)
  };

  const color = getColor(normalizedWinRate);

  // Get gradient colors for smooth transition
  const getGradientColors = (rate: number): [string, string] => {
    if (rate >= 60) return ['#10b981', '#059669']; // emerald
    if (rate >= 40) return ['#f59e0b', '#d97706']; // amber
    return ['#ef4444', '#dc2626']; // red
  };

  const [startColor, endColor] = getGradientColors(normalizedWinRate);

  // Data for the gauge
  const data = [
    {
      name: 'Win Rate',
      value: normalizedWinRate,
      fill: `url(#gaugeGradient)`
    }
  ];

  // Get performance label
  const getPerformanceLabel = (rate: number): string => {
    if (rate >= 70) return 'Excellent';
    if (rate >= 60) return 'Good';
    if (rate >= 50) return 'Average';
    if (rate >= 40) return 'Fair';
    return 'Needs Improvement';
  };

  const performanceLabel = getPerformanceLabel(normalizedWinRate);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center">
      <ResponsiveContainer width="100%" height={size}>
        <RadialBarChart 
          cx="50%" 
          cy="50%" 
          innerRadius="70%" 
          outerRadius="100%" 
          data={data}
          startAngle={180}
          endAngle={0}
        >
          <defs>
            <linearGradient id="gaugeGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={startColor} stopOpacity={1} />
              <stop offset="100%" stopColor={endColor} stopOpacity={1} />
            </linearGradient>
          </defs>
          <PolarAngleAxis 
            type="number" 
            domain={[0, 100]} 
            angleAxisId={0} 
            tick={false}
          />
          <RadialBar
            background={{ fill: '#1e293b' }}
            clockWise
            dataKey="value"
            cornerRadius={10}
            animationDuration={1500}
            animationBegin={0}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      
      {/* Center Text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="flex items-center gap-2 mb-1">
          <Target className="w-5 h-5 text-purple-400" />
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold" style={{ color }}>
            {normalizedWinRate.toFixed(1)}%
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {performanceLabel}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-2 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500"></div>
          <span className="text-slate-400">0-40%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-amber-500"></div>
          <span className="text-slate-400">40-60%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
          <span className="text-slate-400">60-100%</span>
        </div>
      </div>
    </div>
  );
}

