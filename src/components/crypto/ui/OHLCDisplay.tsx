import React from 'react';
import { cn } from '@/lib/utils';

interface OHLCDisplayProps {
  pair: string;
  exchange?: string;
  timeframe?: string;
  source?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  changePercent?: number;
  displayMode?: 'price' | 'marketCap';
  isLive?: boolean;
  theme?: 'dark' | 'light';
  className?: string;
}

export default function OHLCDisplay({
  pair,
  exchange = 'Pump AMM',
  timeframe = '1s',
  source = 'wagyu.trade',
  open,
  high,
  low,
  close,
  volume,
  changePercent = 0,
  displayMode = 'marketCap',
  isLive = true,
  theme = 'dark',
  className,
}: OHLCDisplayProps) {
  const isDark = theme === 'dark';

  // Format value based on display mode
  const formatValue = (value: number): string => {
    if (!value || value <= 0) return '0';
    
    if (displayMode === 'marketCap') {
      // Format as market cap (e.g., 18.5M)
      if (value >= 1000000000) return `${(value / 1000000000).toFixed(2)}B`;
      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
      return value.toFixed(0);
    } else {
      // Format as price
      if (value >= 1000) return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
      if (value >= 1) return value.toFixed(4);
      if (value >= 0.01) return value.toFixed(6);
      if (value >= 0.0001) return value.toFixed(8);
      return value.toFixed(10);
    }
  };

  const formatVolume = (vol: number): string => {
    if (!vol || vol <= 0) return '0';
    if (vol >= 1000000) return `${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `${(vol / 1000).toFixed(1)}K`;
    return vol.toFixed(0);
  };

  const isPositive = changePercent >= 0;

  return (
    <div className={cn(
      "flex items-center gap-4 px-4 py-1.5 text-sm",
      isDark ? "bg-[#0a0e17]" : "bg-white",
      className
    )}>
      {/* Pair Info */}
      <div className="flex items-center gap-2">
        <span className={cn(
          "font-medium",
          isDark ? "text-white" : "text-gray-900"
        )}>
          {pair}
        </span>
        <span className={cn(
          isDark ? "text-gray-500" : "text-gray-400"
        )}>
          on {exchange}
        </span>
        <span className={cn(
          isDark ? "text-gray-600" : "text-gray-300"
        )}>
          ·
        </span>
        <span className={cn(
          isDark ? "text-gray-500" : "text-gray-400"
        )}>
          {timeframe}
        </span>
        <span className={cn(
          isDark ? "text-gray-600" : "text-gray-300"
        )}>
          ·
        </span>
        <span className={cn(
          isDark ? "text-gray-500" : "text-gray-400"
        )}>
          {source}
        </span>
      </div>

      {/* Live Indicator */}
      {isLive && (
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
      )}

      {/* OHLC Values */}
      <div className="flex items-center gap-3">
        <span className={cn(
          "font-mono",
          isDark ? "text-gray-400" : "text-gray-600"
        )}>
          <span className="text-cyan-400">O</span>
          <span className={isDark ? "text-white" : "text-gray-900"}>
            {formatValue(open)}
          </span>
        </span>
        
        <span className={cn(
          "font-mono",
          isDark ? "text-gray-400" : "text-gray-600"
        )}>
          <span className="text-cyan-400">H</span>
          <span className={isDark ? "text-white" : "text-gray-900"}>
            {formatValue(high)}
          </span>
        </span>
        
        <span className={cn(
          "font-mono",
          isDark ? "text-gray-400" : "text-gray-600"
        )}>
          <span className="text-cyan-400">L</span>
          <span className={isDark ? "text-white" : "text-gray-900"}>
            {formatValue(low)}
          </span>
        </span>
        
        <span className={cn(
          "font-mono",
          isDark ? "text-gray-400" : "text-gray-600"
        )}>
          <span className="text-cyan-400">C</span>
          <span className={isDark ? "text-white" : "text-gray-900"}>
            {formatValue(close)}
          </span>
        </span>

        {volume !== undefined && (
          <span className={cn(
            "font-mono",
            isDark ? "text-gray-400" : "text-gray-600"
          )}>
            <span className={isDark ? "text-white" : "text-gray-900"}>
              {formatVolume(volume)}
            </span>
          </span>
        )}

        {/* Change Percent */}
        <span className={cn(
          "font-mono font-medium",
          isPositive ? "text-emerald-400" : "text-red-400"
        )}>
          ({isPositive ? '+' : ''}{changePercent.toFixed(2)}%)
        </span>
      </div>
    </div>
  );
}
