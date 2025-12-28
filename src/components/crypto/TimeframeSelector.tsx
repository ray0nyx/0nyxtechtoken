import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface Timeframe {
  label: string;
  value: number;
  unit: 'second' | 'minute' | 'hour' | 'day' | 'month';
}

export const TIMEFRAMES: Timeframe[] = [
  { label: '1s', value: 1, unit: 'second' },
  { label: '1m', value: 1, unit: 'minute' },
  { label: '5m', value: 5, unit: 'minute' },
  { label: '15m', value: 15, unit: 'minute' },
  { label: '1h', value: 1, unit: 'hour' },
  { label: '4h', value: 4, unit: 'hour' },
  { label: '1D', value: 1, unit: 'day' },
  { label: '1M', value: 1, unit: 'month' },
];

interface TimeframeSelectorProps {
  selectedTimeframe: Timeframe;
  onTimeframeChange: (timeframe: Timeframe) => void;
  className?: string;
  variant?: 'buttons' | 'dropdown';
}

export default function TimeframeSelector({
  selectedTimeframe,
  onTimeframeChange,
  className,
  variant = 'buttons',
}: TimeframeSelectorProps) {
  if (variant === 'dropdown') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <span className="text-sm text-muted-foreground">Timeframe:</span>
        <select
          value={TIMEFRAMES.findIndex(tf => tf.label === selectedTimeframe.label)}
          onChange={(e) => {
            const index = parseInt(e.target.value);
            onTimeframeChange(TIMEFRAMES[index]);
          }}
          className="px-3 py-1.5 text-sm border rounded-md bg-background"
        >
          {TIMEFRAMES.map((tf, index) => (
            <option key={tf.label} value={index}>
              {tf.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {TIMEFRAMES.map((timeframe) => (
        <Button
          key={timeframe.label}
          variant={selectedTimeframe.label === timeframe.label ? 'default' : 'outline'}
          size="sm"
          onClick={() => onTimeframeChange(timeframe)}
          className={cn(
            'min-w-[40px] px-2 py-1 text-xs',
            selectedTimeframe.label === timeframe.label
              ? 'bg-primary text-primary-foreground'
              : 'bg-transparent'
          )}
        >
          {timeframe.label}
        </Button>
      ))}
    </div>
  );
}

