import React from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface MiniSparklineProps {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
}

export default function MiniSparkline({ 
  data, 
  color = '#8b5cf6', 
  height = 20,
  width = 60 
}: MiniSparklineProps) {
  if (!data || data.length === 0) {
    return <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">—</div>;
  }

  // Normalize data to 0-100 range for consistent display
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  const normalizedData = data.map((value, index) => ({
    value: ((value - min) / range) * 100,
    index
  }));

  // Determine if trend is positive or negative
  const firstValue = data[0];
  const lastValue = data[data.length - 1];
  const isPositive = lastValue >= firstValue;
  const lineColor = isPositive ? '#10b981' : '#ef4444';

  return (
    <div style={{ width, height }} className="flex items-center">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={normalizedData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color || lineColor}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

