import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { LineChart as LineChartIcon, BarChart3 } from 'lucide-react';

interface OHLCVData {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface CustomPriceChartProps {
  data: OHLCVData[];
  symbol?: string;
  quoteSymbol?: string; // e.g., "SOL" for BONK/SOL pairs
  className?: string;
  height?: number;
  showVolume?: boolean;
  showGrid?: boolean;
  theme?: 'dark' | 'light';
  onCrosshairMove?: (data: { time: string | number; price: number; volume?: number } | null) => void;
  onPriceUpdate?: (price: number) => void;
  realTimePrice?: number;
  initialViewMode?: 'line' | 'candlestick';
}

// Format price based on magnitude with optional quote symbol suffix
const formatPrice = (price: number, quoteSymbol?: string): string => {
  if (!price || price <= 0) {
    return quoteSymbol === 'SOL' ? '0.00 SOL' : '0.00';
  }
  
  let formatted: string;
  if (price >= 1000) {
    formatted = price.toLocaleString('en-US', { maximumFractionDigits: 2 });
  } else if (price >= 1) {
    formatted = price.toFixed(4);
  } else if (price >= 0.01) {
    formatted = price.toFixed(6);
  } else if (price >= 0.0001) {
    formatted = price.toFixed(8);
  } else if (price >= 0.000001) {
    formatted = price.toFixed(10);
  } else {
    formatted = price.toExponential(4);
  }
  
  return quoteSymbol ? `${formatted} ${quoteSymbol}` : formatted;
};

// Format Y-axis labels - ensure decimals are always shown
const formatYAxis = (value: number, quoteSymbol?: string): string => {
  if (!value || value <= 0) {
    return quoteSymbol === 'SOL' ? '0.00 SOL' : '0.00';
  }
  
  // For Y-axis, always show meaningful decimals based on value magnitude
  let formatted: string;
  if (value >= 1000) {
    formatted = value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else if (value >= 1) {
    formatted = value.toFixed(4);
  } else if (value >= 0.01) {
    formatted = value.toFixed(6);
  } else if (value >= 0.0001) {
    formatted = value.toFixed(8);
  } else if (value >= 0.000001) {
    formatted = value.toFixed(10);
  } else {
    // For very small values, show more precision
    formatted = value.toFixed(12);
  }
  
  return quoteSymbol ? `${formatted} ${quoteSymbol}` : formatted;
};

// Custom candlestick shape component
const Candlestick = ({ x, y, width, payload, priceRange, height }: any) => {
  if (!payload) return null;
  
  const { open, high, low, close } = payload;
  const isUp = close >= open;
  const color = isUp ? '#10b981' : '#ef4444';
  
  // Calculate pixel positions
  const range = priceRange.max - priceRange.min;
  const chartHeight = height - 100; // Account for margins
  
  const highY = chartHeight - ((high - priceRange.min) / range) * chartHeight;
  const lowY = chartHeight - ((low - priceRange.min) / range) * chartHeight;
  const openY = chartHeight - ((open - priceRange.min) / range) * chartHeight;
  const closeY = chartHeight - ((close - priceRange.min) / range) * chartHeight;
  
  const bodyTop = Math.min(openY, closeY);
  const bodyBottom = Math.max(openY, closeY);
  const bodyHeight = Math.max(1, Math.abs(closeY - openY));
  
  return (
    <g>
      {/* Wick (high-low line) */}
      <line
        x1={x + width / 2}
        y1={highY}
        x2={x + width / 2}
        y2={lowY}
        stroke={color}
        strokeWidth={1}
      />
      {/* Body (open-close rectangle) */}
      <rect
        x={x + width * 0.2}
        y={bodyTop}
        width={width * 0.6}
        height={bodyHeight}
        fill={color}
        stroke={color}
        strokeWidth={1}
      />
    </g>
  );
};

export default function CustomPriceChart({
  data,
  symbol,
  quoteSymbol,
  className,
  height = 400,
  showVolume = true,
  showGrid = true,
  theme = 'dark',
  onPriceUpdate,
  realTimePrice,
  initialViewMode,
}: CustomPriceChartProps) {
  const [viewMode, setViewMode] = useState<'line' | 'candlestick'>(initialViewMode || 'candlestick');
  
  // Sync with external viewMode prop changes
  useEffect(() => {
    if (initialViewMode && initialViewMode !== viewMode) {
      setViewMode(initialViewMode);
    }
  }, [initialViewMode, viewMode]);
  const [displayPrice, setDisplayPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<{ value: number; percent: number } | null>(null);
  const previousPriceRef = useRef<number | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const colors = {
    dark: {
      backgroundColor: '#0a0e17',
      textColor: '#9ca3af',
      gridColor: '#1f2937',
      upColor: '#10b981',
      downColor: '#ef4444',
      lineColor: '#0ea5e9',
    },
    light: {
      backgroundColor: '#ffffff',
      textColor: '#374151',
      gridColor: '#e5e7eb',
      upColor: '#10b981',
      downColor: '#ef4444',
      lineColor: '#3b82f6',
    },
  };

  const currentColors = colors[theme];

  // Process data for Recharts with validation
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data
      .map((d) => {
        // Validate data entry
        if (!d || typeof d !== 'object') return null;
        
        // Convert time to Date string
        let timeValue: string;
        try {
          if (typeof d.time === 'string') {
            timeValue = d.time;
          } else if (typeof d.time === 'number') {
            // Convert Unix timestamp to Date string
            const date = new Date(d.time > 1e12 ? d.time : d.time * 1000);
            if (isNaN(date.getTime())) {
              return null; // Invalid date
            }
            timeValue = date.toISOString();
          } else {
            return null; // Invalid time format
          }
        } catch (e) {
          return null; // Error parsing time
        }

        // Validate and parse OHLC values
        const open = parseFloat(d.open?.toString() || '0');
        const high = parseFloat(d.high?.toString() || '0');
        const low = parseFloat(d.low?.toString() || '0');
        const close = parseFloat(d.close?.toString() || '0');
        const volume = parseFloat(d.volume?.toString() || '0');

        // Validate all values are numbers and finite
        if (!isFinite(open) || !isFinite(high) || !isFinite(low) || !isFinite(close)) {
          return null;
        }

        // Ensure high >= low and high/low contain open/close
        const validHigh = Math.max(high, open, close, low);
        const validLow = Math.min(low, open, close, high);

        // Skip if all values are zero or negative
        if (validHigh <= 0 || validLow < 0) {
          return null;
        }

        return {
          time: timeValue,
          timestamp: typeof d.time === 'number' ? d.time : new Date(timeValue).getTime(),
          open: open,
          high: validHigh,
          low: validLow,
          close: close,
          volume: isFinite(volume) && volume >= 0 ? volume : 0,
          isUp: close >= open,
        };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .sort((a, b) => a.timestamp - b.timestamp); // Ensure chronological order
  }, [data]);

  // Update chart data with real-time price - force re-render when price changes
  const updatedChartData = useMemo(() => {
    if (chartData.length === 0) return chartData;

    // If we have real-time price, update the last candle
    if (realTimePrice && realTimePrice > 0 && isFinite(realTimePrice)) {
      const lastCandle = chartData[chartData.length - 1];
      if (lastCandle) {
        const updatedLastCandle = {
          ...lastCandle,
          close: realTimePrice,
          high: Math.max(lastCandle.high || lastCandle.close || 0, realTimePrice),
          low: Math.min(lastCandle.low || lastCandle.close || Infinity, realTimePrice),
          isUp: realTimePrice >= (lastCandle.open || lastCandle.close || 0),
        };

        return [...chartData.slice(0, -1), updatedLastCandle];
      }
    }

    return chartData;
  }, [chartData, realTimePrice]);

  // Force re-render when real-time price changes significantly
  const priceUpdateKey = useMemo(() => {
    if (!realTimePrice) return 0;
    // Round to 6 decimal places to avoid excessive re-renders from tiny changes
    return Math.round(realTimePrice * 1000000);
  }, [realTimePrice]);

  // Calculate price change
  useEffect(() => {
    const currentPrice = realTimePrice || (updatedChartData.length > 0 ? updatedChartData[updatedChartData.length - 1]?.close : null);
    
    if (currentPrice && currentPrice > 0) {
      setDisplayPrice(currentPrice);
      
      if (previousPriceRef.current && previousPriceRef.current !== currentPrice) {
        const change = currentPrice - previousPriceRef.current;
        const percentChange = (change / previousPriceRef.current) * 100;
        setPriceChange({
          value: change,
          percent: percentChange,
        });
      } else if (!previousPriceRef.current && updatedChartData.length > 1) {
        // Compare with previous candle
        const prevCandle = updatedChartData[updatedChartData.length - 2];
        if (prevCandle && prevCandle.close) {
          const change = currentPrice - prevCandle.close;
          const percentChange = (change / prevCandle.close) * 100;
          setPriceChange({
            value: change,
            percent: percentChange,
          });
        }
      }
      
      previousPriceRef.current = currentPrice;
      
      if (onPriceUpdate) {
        onPriceUpdate(currentPrice);
      }
    }
  }, [realTimePrice, updatedChartData, onPriceUpdate]);

  // Calculate min/max for Y-axis - improved to handle all price ranges
  const priceRange = useMemo(() => {
    // Collect all valid prices from chart data
    const allPrices: number[] = [];
    
    // Determine max reasonable price based on quote symbol
    // For SOL pairs, prices are typically very small, but we should be more flexible
    const isSOLPair = quoteSymbol === 'SOL';
    const maxReasonablePrice = isSOLPair ? 10 : Infinity; // Allow up to 10 SOL for flexibility
    
    if (updatedChartData.length > 0) {
      updatedChartData.forEach(d => {
        // Validate and include all OHLC values
        const values = [d.high, d.low, d.open, d.close];
        values.forEach(val => {
          if (val != null && 
              typeof val === 'number' && 
              isFinite(val) && 
              val > 0 && 
              (!isSOLPair || val < maxReasonablePrice)) {
            allPrices.push(val);
          }
        });
      });
    }
    
    // Add real-time price if available
    if (realTimePrice && 
        realTimePrice > 0 && 
        isFinite(realTimePrice) && 
        (!isSOLPair || realTimePrice < maxReasonablePrice)) {
      allPrices.push(realTimePrice);
    }
    
    // If we have no valid prices, use fallback
    if (allPrices.length === 0) {
      // Try to use real-time price even if it seems high (might be USD pair)
      if (realTimePrice && realTimePrice > 0 && isFinite(realTimePrice)) {
        return {
          min: Math.max(0, realTimePrice * 0.8), // 20% below
          max: realTimePrice * 1.2, // 20% above
        };
      }
      // Default fallback
      return { min: 0, max: isSOLPair ? 0.0001 : 1 };
    }
    
    // Calculate min and max from valid prices
    const min = Math.min(...allPrices);
    const max = Math.max(...allPrices);
    
    // For very small prices (meme coins), start from 0
    // For larger prices (USD pairs), show a reasonable range
    const shouldStartFromZero = max < 0.01;
    const padding = max * 0.2;
    
    return {
      min: shouldStartFromZero ? 0 : Math.max(0, min - padding),
      max: max + padding,
    };
  }, [updatedChartData, realTimePrice, quoteSymbol]);

  // Format X-axis (time)
  const formatXAxis = (tickItem: string) => {
    try {
      const date = new Date(tickItem);
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return tickItem;
    }
  };

  const currentPrice = realTimePrice || displayPrice || (updatedChartData.length > 0 ? updatedChartData[updatedChartData.length - 1]?.close : null);
  const priceColor = priceChange 
    ? (priceChange.value >= 0 ? currentColors.upColor : currentColors.downColor)
    : (realTimePrice ? currentColors.upColor : currentColors.textColor);

  // Error boundary: ensure we always have some data to render
  const hasData = updatedChartData.length > 0;
  
  if (!hasData) {
    return (
      <div className={cn('relative w-full flex items-center justify-center', className)} style={{ height: `${height}px` }}>
        <div className="text-center space-y-2">
          <div style={{ color: currentColors.textColor }} className="text-sm">No chart data available</div>
          <div style={{ color: currentColors.textColor, opacity: 0.7 }} className="text-xs">
            {data && data.length > 0 
              ? 'Data validation failed. Please check data format.' 
              : 'Waiting for data...'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={chartContainerRef} className={cn('relative w-full', className)} style={{ height: `${height}px` }}>
      {/* Symbol Badge */}
      {symbol && (
        <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-[#1a1f2e] rounded text-sm text-white font-medium">
          {symbol}
        </div>
      )}

      {/* View Toggle Button */}
      <div className="absolute top-2 left-20 z-10">
        <div className="flex gap-1 bg-[#1a1f2e] rounded p-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('line')}
            className={cn(
              "h-7 px-2 text-xs",
              viewMode === 'line' 
                ? "bg-[#0ea5e9] text-white" 
                : "text-[#9ca3af] hover:text-white"
            )}
          >
            <LineChartIcon className="w-3 h-3 mr-1" />
            Line
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('candlestick')}
            className={cn(
              "h-7 px-2 text-xs",
              viewMode === 'candlestick' 
                ? "bg-[#0ea5e9] text-white" 
                : "text-[#9ca3af] hover:text-white"
            )}
          >
            <BarChart3 className="w-3 h-3 mr-1" />
            Candles
          </Button>
        </div>
      </div>

      {/* Current Price Display */}
      {currentPrice && currentPrice > 0 && (
        <div 
          className="absolute top-2 right-2 z-50 px-3 py-1.5 rounded-lg shadow-lg border" 
          style={{ 
            backgroundColor: theme === 'dark' ? 'rgba(26, 31, 46, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            borderColor: priceColor,
            minWidth: '140px'
          }}
        >
          <div className="flex flex-col items-end">
            <div className="text-lg font-bold" style={{ color: priceColor }}>
              {formatPrice(currentPrice, quoteSymbol)}
            </div>
            {priceChange && Math.abs(priceChange.value) > 0.000001 ? (
              <div className="text-xs mt-0.5" style={{ 
                color: priceChange.value >= 0 ? currentColors.upColor : currentColors.downColor 
              }}>
                {priceChange.value >= 0 ? '+' : ''}{formatPrice(priceChange.value, quoteSymbol)} ({priceChange.percent >= 0 ? '+' : ''}{priceChange.percent.toFixed(2)}%)
              </div>
            ) : realTimePrice ? (
              <div className="text-xs mt-0.5 flex items-center gap-1" style={{ 
                color: currentColors.textColor 
              }}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                Live
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Chart */}
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={updatedChartData}
          margin={{ top: 20, right: 30, left: 20, bottom: showVolume ? 60 : 20 }}
        >
          {showGrid && (
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke={currentColors.gridColor}
              opacity={0.3}
            />
          )}
          
          <XAxis
            dataKey="time"
            tickFormatter={formatXAxis}
            stroke={currentColors.textColor}
            style={{ fontSize: '11px' }}
            tickLine={{ stroke: currentColors.textColor }}
            axisLine={{ stroke: currentColors.gridColor }}
          />
          
          <YAxis
            yAxisId="price"
            orientation="right"
            domain={[priceRange.min, priceRange.max]}
            tickFormatter={(value: number) => formatYAxis(value, quoteSymbol)}
            stroke={currentColors.textColor}
            style={{ fontSize: '11px' }}
            tickLine={{ stroke: currentColors.textColor }}
            axisLine={{ stroke: currentColors.gridColor }}
            width={100}
            allowDecimals={true}
            tickCount={8}
            allowDataOverflow={false}
            type="number"
          />

          {showVolume && (
            <YAxis
              yAxisId="volume"
              orientation="right"
              hide
            />
          )}

          <Tooltip
            contentStyle={{
              backgroundColor: theme === 'dark' ? '#1a1f2e' : '#ffffff',
              border: `1px solid ${currentColors.gridColor}`,
              borderRadius: '6px',
              color: currentColors.textColor,
            }}
            labelStyle={{ color: currentColors.textColor }}
            formatter={(value: any, name: string) => {
              if (name === 'close' || name === 'open' || name === 'high' || name === 'low') {
                return [formatPrice(value, quoteSymbol), name.toUpperCase()];
              }
              return [value, name];
            }}
          />

          {viewMode === 'line' ? (
            <Line
              key={`price-line-${priceUpdateKey}`}
              yAxisId="price"
              type="monotone"
              dataKey="close"
              stroke={currentColors.lineColor}
              strokeWidth={2}
              dot={false}
              isAnimationActive={true}
              animationDuration={300}
              animationBegin={0}
            />
          ) : (
            // Candlestick view - simplified: show close price line with high/low bands
            <>
              {/* High price line */}
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="high"
                stroke={currentColors.upColor}
                strokeWidth={1}
                dot={false}
                opacity={0.5}
                strokeDasharray="2 2"
              />
              {/* Low price line */}
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="low"
                stroke={currentColors.downColor}
                strokeWidth={1}
                dot={false}
                opacity={0.5}
                strokeDasharray="2 2"
              />
              {/* Close price line (main) */}
              <Line
                key={`close-line-${priceUpdateKey}`}
                yAxisId="price"
                type="monotone"
                dataKey="close"
                stroke={currentColors.lineColor}
                strokeWidth={2}
                dot={false}
                isAnimationActive={true}
                animationDuration={300}
                animationBegin={0}
              />
            </>
          )}

          {/* Real-time price reference line */}
          {realTimePrice && (
            <ReferenceLine
              yAxisId="price"
              y={realTimePrice}
              stroke={priceColor}
              strokeWidth={1}
              strokeDasharray="3 3"
              label={{ value: formatPrice(realTimePrice, quoteSymbol), position: 'right', fill: priceColor, fontSize: 10 }}
            />
          )}

          {showVolume && (
            <Bar
              yAxisId="volume"
              dataKey="volume"
              fill={currentColors.textColor}
              opacity={0.3}
            >
              {updatedChartData.map((entry, index) => (
                <Cell 
                  key={`volume-cell-${index}`} 
                  fill={entry.isUp ? currentColors.upColor : currentColors.downColor}
                  opacity={0.4}
                />
              ))}
            </Bar>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
