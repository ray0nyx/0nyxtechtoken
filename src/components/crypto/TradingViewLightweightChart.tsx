import React, { useEffect, useRef, useCallback, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, HistogramData, ColorType, CrosshairMode, CandlestickSeries, SeriesType, IPriceLine } from 'lightweight-charts';
import { cn } from '@/lib/utils';
import TradeBubbleOverlay from './TradeBubbleOverlay';
import { useTradingStore } from '@/stores/useTradingStore';

interface OHLCVData {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

// Order line interface for limit orders, stop loss, and take profit
export interface OrderLine {
  id: string;
  type: 'limit' | 'stopLoss' | 'takeProfit';
  price: number;
  side: 'buy' | 'sell';
  amount: number;
  draggable: boolean;
}

// Real-time candle update from aggregator
export interface RealtimeCandleUpdate {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TradingViewLightweightChartProps {
  data: OHLCVData[];
  symbol?: string;
  className?: string;
  height?: number;
  showVolume?: boolean;
  showGrid?: boolean;
  theme?: 'dark' | 'light';
  onCrosshairMove?: (data: { time: string | number; price: number; volume?: number } | null) => void;
  onPriceUpdate?: (price: number) => void;
  realTimePrice?: number;
  // Real-time candle stream from aggregator (updates entire OHLC, not just close)
  realtimeCandle?: RealtimeCandleUpdate | null;
  displayMode?: 'price' | 'marketCap';
  marketCapData?: { time: string | number; value: number }[];
  marketCap?: string; // Token market cap string like "$14M"
  tokenPrice?: number; // Current token price for calculating supply
  // Order visualization props
  orders?: OrderLine[];
  onOrderDrag?: (orderId: string, newPrice: number) => void;
  onOrderCancel?: (orderId: string) => void;
}

// Parse market cap string to number
const parseMarketCap = (mcStr: string): number => {
  if (!mcStr) return 0;
  const cleaned = mcStr.replace(/[$,]/g, '');
  const match = cleaned.match(/([0-9.]+)\s*([KMBT])?/i);
  if (!match) return 0;
  const num = parseFloat(match[1]) || 0;
  const suffix = (match[2] || '').toUpperCase();
  const multipliers: Record<string, number> = { 'K': 1000, 'M': 1000000, 'B': 1000000000, 'T': 1000000000000 };
  return num * (multipliers[suffix] || 1);
};

export default function TradingViewLightweightChart({
  data,
  symbol,
  className,
  height = 400,
  showVolume = true,
  showGrid = true,
  theme = 'dark',
  onPriceUpdate,
  realTimePrice,
  realtimeCandle,
  displayMode = 'price',
  marketCapData,
  marketCap,
  tokenPrice,
  orders = [],
  onOrderDrag,
  onOrderCancel,
}: TradingViewLightweightChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const previousDataRef = useRef<OHLCVData[]>([]);
  const previousSymbolRef = useRef<string | undefined>(symbol);
  const priceLineRef = useRef<IPriceLine | null>(null);
  const previousPriceRef = useRef<number | null>(null);
  const orderLinesRef = useRef<Map<string, IPriceLine>>(new Map());
  const [displayPrice, setDisplayPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<{ value: number; percent: number } | null>(null);

  // Format market cap for display
  const formatMarketCap = (value: number): string => {
    if (!value || value <= 0) return '$0';
    if (value >= 1000000000) return `$${(value / 1000000000).toFixed(2)}B`;
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
    return `$${value.toFixed(0)}`;
  };

  // Axiom-style colors - cyan up, magenta/red down
  const colors = {
    dark: {
      backgroundColor: '#0a0a0f',      // Darker background
      textColor: '#9ca3af',
      gridColor: '#1a1a24',            // Subtle grid
      upColor: '#00D4AA',              // Cyan-green for up
      downColor: '#FF4466',            // Red-magenta for down
      borderUpColor: '#00D4AA',
      borderDownColor: '#FF4466',
      wickUpColor: '#00D4AA',
      wickDownColor: '#FF4466',
    },
    light: {
      backgroundColor: '#ffffff',
      textColor: '#374151',
      gridColor: '#e5e7eb',
      upColor: '#00D4AA',
      downColor: '#FF4466',
      borderUpColor: '#00D4AA',
      borderDownColor: '#FF4466',
      wickUpColor: '#00D4AA',
      wickDownColor: '#FF4466',
    },
  };

  const currentColors = colors[theme];

  const initChart = useCallback(() => {
    if (!chartContainerRef.current) {
      console.log('Chart container ref not available');
      return;
    }

    // Clear existing chart
    if (chartRef.current) {
      try {
        chartRef.current.remove();
      } catch (e) {
        // Ignore cleanup errors
      }
      chartRef.current = null;
      candlestickSeriesRef.current = null;
      volumeSeriesRef.current = null;
      priceLineRef.current = null;
    }

    // Ensure container has dimensions
    const container = chartContainerRef.current;
    if (container.clientWidth === 0 || container.clientHeight === 0) {
      console.log('Chart container has no dimensions, waiting...', {
        width: container.clientWidth,
        height: container.clientHeight
      });
      // Wait for next frame if container isn't ready
      requestAnimationFrame(() => {
        if (chartContainerRef.current && chartContainerRef.current.clientWidth > 0) {
          initChart();
        }
      });
      return;
    }

    console.log('Initializing chart with dimensions:', {
      width: container.clientWidth,
      height: container.clientHeight
    });


    try {
      // Create new chart - Configure with right price scale visible
      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { color: currentColors.backgroundColor },
          textColor: currentColors.textColor,
        },
        grid: {
          vertLines: { color: showGrid ? currentColors.gridColor : 'transparent' },
          horzLines: { color: showGrid ? currentColors.gridColor : 'transparent' },
        },
        width: chartContainerRef.current.clientWidth,
        height: height,
        rightPriceScale: {
          visible: true,
          borderVisible: true,
          borderColor: currentColors.gridColor,
          entireTextOnly: false,
          scaleMargins: {
            top: 0.1,
            bottom: 0.1,
          },
        },
        leftPriceScale: {
          visible: false, // Hide left price scale, show only right
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 5,
          barSpacing: 6,
          shiftVisibleRangeOnNewBar: true,
          lockVisibleTimeRangeOnResize: true,
          rightBarStaysOnScroll: true,
          borderVisible: true,
          borderColor: currentColors.gridColor,
          visible: true,
          // Note: drawTicks removed in v5
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: true,
        },
        handleScale: {
          axisPressedMouseMove: true,
          mouseWheel: true,
          pinch: true,
        },
      });

      chartRef.current = chart;
      console.log('Chart created successfully');

      // Add candlestick series using the EXACT approach from BarReplay.tsx
      try {
        console.log('Adding candlestick series...');

        // Calculate the market cap scale factor to determine data range
        const currentMc = marketCap ? parseMarketCap(marketCap) : 0;
        const latestDataClose = data.length > 0 ? data[data.length - 1].close : 0;
        const useMarketCapMode = displayMode === 'marketCap' && currentMc > 0;
        const mcScaleFactor = useMarketCapMode && latestDataClose > 0 ? currentMc / latestDataClose : 1;

        // Determine precision based on the data's price range (after scaling)
        // For market cap mode (large values) use lower precision
        // For very small prices (meme coins), we need higher precision
        let pricePrecision = 8;
        if (data.length > 0) {
          const prices = data.map(d => d.close * mcScaleFactor).filter(p => p > 0);
          const minPrice = Math.min(...prices);
          const maxPrice = Math.max(...prices);

          // Market cap mode - large numbers (values in thousands or millions)
          if (useMarketCapMode && maxPrice > 1000) {
            pricePrecision = 0; // No decimal places for market cap
          } else if (maxPrice > 10000) {
            pricePrecision = 0;
          } else if (minPrice < 0.00000001) pricePrecision = 18;
          else if (minPrice < 0.000001) pricePrecision = 14;
          else if (minPrice < 0.0001) pricePrecision = 12;
          else if (minPrice < 0.01) pricePrecision = 10;
          else if (minPrice < 1) pricePrecision = 8;
          else if (minPrice < 100) pricePrecision = 2;
          else pricePrecision = 0;
        }

        // Custom price formatter for K/M/B display (Axiom-style)
        const formatPriceValue = (price: number): string => {
          if (useMarketCapMode) {
            // Format as market cap: $8.1K, $1.2M, etc.
            if (price >= 1e9) return `$${(price / 1e9).toFixed(2)}B`;
            if (price >= 1e6) return `$${(price / 1e6).toFixed(2)}M`;
            if (price >= 1e3) return `$${(price / 1e3).toFixed(2)}K`;
            return `$${price.toFixed(0)}`;
          }
          // Format as price for small values
          if (price >= 1) return price.toFixed(4);
          if (price >= 0.01) return price.toFixed(6);
          if (price >= 0.0001) return price.toFixed(8);
          return price.toFixed(10);
        };

        const series = chart.addSeries(CandlestickSeries, {
          upColor: currentColors.upColor,
          downColor: currentColors.downColor,
          borderVisible: false,
          wickUpColor: currentColors.wickUpColor,
          wickDownColor: currentColors.wickDownColor,
          priceFormat: {
            type: 'custom',
            formatter: formatPriceValue,
            minMove: useMarketCapMode ? 1 : Math.pow(10, -pricePrecision),
          },
        });

        if (!series) {
          throw new Error('Failed to create candlestick series');
        }

        console.log('Candlestick series created successfully');
        candlestickSeriesRef.current = series;

        // Adjust the price scale after series is created - Configure for proper price display
        if (chart.priceScale('right')) {
          chart.priceScale('right').applyOptions({
            autoScale: true,
            scaleMargins: {
              top: 0.1,
              bottom: 0.1,
            },
            entireTextOnly: false,
            visible: true,
            borderVisible: true,
            borderColor: currentColors.gridColor,
          });
        }

        // Apply custom tick mark formatter for Y-axis labels (K/M/B format)
        series.applyOptions({
          priceFormat: {
            type: 'custom',
            formatter: (price: number) => {
              if (useMarketCapMode) {
                if (price >= 1e9) return `${(price / 1e9).toFixed(1)}B`;
                if (price >= 1e6) return `${(price / 1e6).toFixed(1)}M`;
                if (price >= 1e3) return `${(price / 1e3).toFixed(1)}K`;
                return `${price.toFixed(0)}`;
              }
              if (price >= 1) return price.toFixed(4);
              if (price >= 0.01) return price.toFixed(6);
              return price.toFixed(10);
            },
            minMove: useMarketCapMode ? 1 : Math.pow(10, -pricePrecision),
          },
        });

        // Format price for price line title based on magnitude
        // Enhanced formatting for very small prices (meme coins) - NEVER use scientific notation
        const formatPriceForLine = (price: number): string => {
          if (!price || price <= 0) return '0';

          // For market cap mode, format as currency abbreviations
          if (displayMode === 'marketCap') {
            if (price >= 1000000000) return `$${(price / 1000000000).toFixed(2)}B`;
            if (price >= 1000000) return `$${(price / 1000000).toFixed(2)}M`;
            if (price >= 1000) return `$${(price / 1000).toFixed(2)}K`;
            return `$${price.toFixed(0)}`;
          }

          if (price >= 1000) {
            return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
          } else if (price >= 1) {
            return price.toFixed(4);
          } else if (price >= 0.01) {
            return price.toFixed(6);
          } else if (price >= 0.0001) {
            return price.toFixed(8);
          } else if (price >= 0.000001) {
            return price.toFixed(10);
          } else if (price >= 0.00000001) {
            return price.toFixed(12);
          } else {
            // For extremely small prices, show full decimal (up to 18 places) - no scientific notation
            return price.toFixed(18).replace(/\.?0+$/, '');
          }
        };

        // Create price line for current price display if we have real-time price
        // This will be updated by the real-time price effect
        if (realTimePrice && realTimePrice > 0) {
          try {
            priceLineRef.current = series.createPriceLine({
              price: realTimePrice,
              color: currentColors.upColor,
              lineWidth: 2,
              lineStyle: 2, // Dashed line
              axisLabelVisible: true,
              title: formatPriceForLine(realTimePrice),
            });
            setDisplayPrice(realTimePrice);
            previousPriceRef.current = realTimePrice;
          } catch (e) {
            console.warn('Error creating initial price line:', e);
          }
        } else if (data.length > 0) {
          // If no real-time price yet, use the last candle's close price
          const lastCandle = data[data.length - 1];
          if (lastCandle && lastCandle.close > 0) {
            try {
              priceLineRef.current = series.createPriceLine({
                price: lastCandle.close,
                color: currentColors.textColor,
                lineWidth: 2,
                lineStyle: 2,
                axisLabelVisible: true,
                title: formatPriceForLine(lastCandle.close),
              });
              setDisplayPrice(lastCandle.close);
              previousPriceRef.current = lastCandle.close;
            } catch (e) {
              console.warn('Error creating price line from last candle:', e);
            }
          }
        }

        console.log('Chart initialization complete, series ready for data');

        // Note: Initial data will be set by the data update effect
        // This avoids closure issues and ensures data is always current

        // Add volume series if enabled - only after candlestick series is created
        // Note: volume series is disabled due to lightweight-charts v5 API changes
        if (showVolume && false) { // Disabled - addHistogramSeries removed in v5
          try {
            // In v5, need to use custom series or line series for volume
            // For now, disable volume until proper v5 implementation
            console.log('Volume series disabled due to v5 API changes');
            volumeSeriesRef.current = null;
          } catch (e) {
            console.warn('Volume series creation failed:', e);
            volumeSeriesRef.current = null;
          }
        } else {
          volumeSeriesRef.current = null;
        }
      } catch (seriesError: any) {
        console.error('Error creating candlestick series:', seriesError);
        chart.remove();
        chartRef.current = null;
        return;
      }
    } catch (error) {
      console.error('Error initializing chart:', error);
      return;
    }

    // Handle resize with ResizeObserver for better responsiveness
    let resizeObserver: ResizeObserver | null = null;
    if (chartContainerRef.current) {
      resizeObserver = new ResizeObserver(entries => {
        if (chartRef.current && entries.length > 0) {
          const { width, height } = entries[0].contentRect;
          chartRef.current.applyOptions({
            width,
            height,
          });
          chartRef.current.timeScale().fitContent();
        }
      });
      resizeObserver.observe(chartContainerRef.current);
    }

    // Legacy resize handler for older browsers
    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [currentColors, height, showGrid, showVolume]);

  // Initialize chart - only re-initialize when symbol actually changes
  useEffect(() => {
    const symbolChanged = previousSymbolRef.current !== symbol;
    previousSymbolRef.current = symbol;

    // Only re-initialize if symbol changed or chart doesn't exist
    if (!symbolChanged && chartRef.current && candlestickSeriesRef.current) {
      return; // Chart already exists and symbol hasn't changed, no need to re-init
    }

    let mounted = true;
    let initTimeout: ReturnType<typeof setTimeout>;

    const init = () => {
      if (!chartContainerRef.current || !mounted) {
        return;
      }

      const container = chartContainerRef.current;

      // Check if container has dimensions
      if (container.clientWidth === 0 || container.clientHeight === 0) {
        // Retry after a short delay
        initTimeout = setTimeout(() => {
          if (mounted && chartContainerRef.current) {
            init();
          }
        }, 100);
        return;
      }

      // Container is ready, initialize chart
      console.log('Initializing chart, container ready', { symbolChanged, symbol });
      initChart();
    };

    // Start initialization
    requestAnimationFrame(() => {
      if (mounted) {
        init();
      }
    });

    return () => {
      mounted = false;
      if (initTimeout) {
        clearTimeout(initTimeout);
      }
      // Only cleanup if symbol changed
      if (symbolChanged && chartRef.current) {
        try {
          chartRef.current.remove();
        } catch (e) {
          // Ignore errors during cleanup
        }
        chartRef.current = null;
        candlestickSeriesRef.current = null;
        volumeSeriesRef.current = null;
        priceLineRef.current = null;
        previousPriceRef.current = null;
        setDisplayPrice(null);
        setPriceChange(null);
      }
    };
  }, [initChart, symbol]);

  // Update data when it changes - use incremental updates when possible
  useEffect(() => {
    if (!candlestickSeriesRef.current) {
      // If chart not initialized but we have data, wait a bit and try again
      if (data.length > 0 && chartContainerRef.current) {
        const timer = setTimeout(() => {
          // Trigger re-initialization if series still doesn't exist
          if (!candlestickSeriesRef.current && chartContainerRef.current) {
            initChart();
          }
        }, 500);
        return () => clearTimeout(timer);
      }
      return;
    }

    if (data.length === 0) {
      console.log('TradingViewChart - No data, clearing chart');
      // Clear existing data if no new data
      candlestickSeriesRef.current.setData([]);
      if (volumeSeriesRef.current) {
        volumeSeriesRef.current.setData([]);
      }
      previousDataRef.current = [];
      return;
    }

    // Calculate market cap scale factor if in market cap mode
    // The approach: scale all prices so that the latest close = current market cap
    // This way, the Y-axis shows market cap values (e.g., 8K, 9K, 10K)
    const currentMc = marketCap ? parseMarketCap(marketCap) : 0;
    const useMarketCap = displayMode === 'marketCap' && currentMc > 0;

    // Get the latest close price from data to calculate scale factor
    const latestDataClose = data.length > 0 ? data[data.length - 1].close : 0;
    // Scale factor: what do we multiply price by to get market cap?
    // If latest price is 0.00001 and market cap is 8000, scale factor = 8000 / 0.00001 = 800,000,000
    const scaleFactor = useMarketCap && latestDataClose > 0
      ? currentMc / latestDataClose
      : 1;

    // Transform data for lightweight-charts
    // lightweight-charts expects time as Unix timestamp (number in seconds)
    const candleData: CandlestickData[] = data
      .map((d) => {
        let timeValue: number;

        // Convert time to Unix timestamp in seconds
        if (typeof d.time === 'string') {
          const date = new Date(d.time);
          if (isNaN(date.getTime())) {
            return null; // Invalid date
          }
          timeValue = Math.floor(date.getTime() / 1000);
        } else if (typeof d.time === 'number') {
          // If already in seconds, use as is; if in ms, convert to seconds
          timeValue = d.time > 1e12 ? Math.floor(d.time / 1000) : d.time;
        } else {
          return null; // Invalid time format
        }

        // Ensure all values are valid numbers (allow 0 for prices)
        let open = typeof d.open === 'number' && !isNaN(d.open) ? d.open : 0;
        let high = typeof d.high === 'number' && !isNaN(d.high) ? d.high : 0;
        let low = typeof d.low === 'number' && !isNaN(d.low) ? d.low : 0;
        let close = typeof d.close === 'number' && !isNaN(d.close) ? d.close : 0;

        // Convert to market cap if in market cap mode
        // Multiply all prices by scale factor so Y-axis shows market cap
        if (useMarketCap && scaleFactor > 1) {
          open = open * scaleFactor;
          high = high * scaleFactor;
          low = low * scaleFactor;
          close = close * scaleFactor;
        }

        // Skip if all values are zero or invalid (but allow if at least one is non-zero)
        if (open === 0 && high === 0 && low === 0 && close === 0) {
          return null;
        }

        // Validate OHLC relationships (high >= low, high >= open/close, low <= open/close)
        const validHigh = Math.max(high, open, close, low);
        const validLow = Math.min(low, open, close, high);

        return {
          time: timeValue as any, // lightweight-charts Time type accepts number
          open: open,
          high: validHigh,
          low: validLow,
          close: close,
        };
      })
      .filter((candle): candle is CandlestickData => candle !== null);

    // Check if this is a new dataset or an incremental update
    const previousData = previousDataRef.current;
    const isNewDataset = previousData.length === 0 ||
      previousData.length !== candleData.length ||
      (previousData.length > 0 && previousData[0].time !== candleData[0].time);

    if (candleData.length > 0 && candlestickSeriesRef.current) {
      try {
        // Set display price from last candle ONLY if:
        // 1. displayPrice is null (not set yet), AND
        // 2. realTimePrice is not provided (no real-time updates)
        // This prevents real-time price from being overridden by data updates
        if (displayPrice === null && !realTimePrice && candleData.length > 0) {
          const lastCandle = candleData[candleData.length - 1];
          if (lastCandle && lastCandle.close > 0) {
            setDisplayPrice(lastCandle.close);
            if (!previousPriceRef.current) {
              previousPriceRef.current = lastCandle.close;
            }
          }
        } else if (realTimePrice && realTimePrice > 0) {
          // If we have real-time price, use it instead of data
          setDisplayPrice(realTimePrice);
        }

        if (isNewDataset) {
          // New dataset - replace all data
          console.log('TradingViewChart - Setting new dataset:', candleData.length, 'candles');
          // Set data directly - lightweight-charts handles this efficiently
          candlestickSeriesRef.current.setData(candleData);

          // Format price for price line title - enhanced for small prices - NEVER use scientific notation
          const formatPriceForLine = (price: number): string => {
            if (!price || price <= 0) return '0';

            // For market cap mode, format as currency abbreviations
            if (displayMode === 'marketCap') {
              if (price >= 1000000000) return `$${(price / 1000000000).toFixed(2)}B`;
              if (price >= 1000000) return `$${(price / 1000000).toFixed(2)}M`;
              if (price >= 1000) return `$${(price / 1000).toFixed(2)}K`;
              return `$${price.toFixed(0)}`;
            }

            if (price >= 1000) {
              return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
            } else if (price >= 1) {
              return price.toFixed(4);
            } else if (price >= 0.01) {
              return price.toFixed(6);
            } else if (price >= 0.0001) {
              return price.toFixed(8);
            } else if (price >= 0.000001) {
              return price.toFixed(10);
            } else if (price >= 0.00000001) {
              return price.toFixed(12);
            } else {
              return price.toFixed(18).replace(/\.?0+$/, '');
            }
          };

          // Create or update price line if we have a price
          const lastCandle = candleData[candleData.length - 1];
          if (lastCandle && lastCandle.close > 0 && !priceLineRef.current) {
            try {
              priceLineRef.current = candlestickSeriesRef.current.createPriceLine({
                price: lastCandle.close,
                color: currentColors.textColor,
                lineWidth: 2,
                lineStyle: 2,
                axisLabelVisible: true,
                title: formatPriceForLine(lastCandle.close),
              });
            } catch (e) {
              console.warn('Error creating price line:', e);
            }
          }

          // Fit content to show all candles
          if (chartRef.current) {
            setTimeout(() => {
              if (chartRef.current) {
                chartRef.current.timeScale().fitContent();
              }
            }, 100);
          }
        } else {
          // Incremental update - check if we have new candles or just updates
          // Helper to convert time to number safely
          const timeToNumber = (time: any): number => {
            if (typeof time === 'number') return time > 1e12 ? Math.floor(time / 1000) : time;
            if (typeof time === 'string') return Math.floor(new Date(time).getTime() / 1000);
            if (time && typeof time === 'object' && time.year) {
              // BusinessDay format from lightweight-charts
              return Math.floor(new Date(time.year, (time.month || 1) - 1, time.day || 1).getTime() / 1000);
            }
            return 0;
          };

          const previousLastTime = previousData.length > 0 ? timeToNumber(previousData[previousData.length - 1].time) : null;
          const currentLastTime = timeToNumber(candleData[candleData.length - 1].time);

          if (candleData.length > previousData.length) {
            // New candle(s) added - update all new candles
            // lightweight-charts update() will add new candles if they don't exist
            const newCandles = candleData.slice(previousData.length);
            console.log('TradingViewChart - Adding new candles:', newCandles.length);
            newCandles.forEach(candle => {
              candlestickSeriesRef.current!.update(candle);
            });
          } else if (candleData.length === previousData.length && previousLastTime === currentLastTime) {
            // Same number of candles and same last time - updating existing last candle (real-time price update)
            const lastCandle = candleData[candleData.length - 1];
            const previousLastCandle = previousData[previousData.length - 1];

            if (lastCandle && previousLastCandle &&
              (lastCandle.close !== previousLastCandle.close ||
                lastCandle.high !== previousLastCandle.high ||
                lastCandle.low !== previousLastCandle.low)) {
              // Update only the last candle for real-time price updates
              console.log('TradingViewChart - Updating last candle with real-time price:', lastCandle.close);
              candlestickSeriesRef.current.update(lastCandle);
            }
          } else if (candleData.length < previousData.length) {
            // Fewer candles - treat as new dataset
            console.log('TradingViewChart - Fewer candles, replacing dataset');
            candlestickSeriesRef.current.setData(candleData);
          }
        }

        // Store current data for next comparison
        previousDataRef.current = candleData;
      } catch (dataError: any) {
        console.error('TradingViewChart - Error setting candle data:', dataError);
        // Reset previousDataRef to force full setData next time
        previousDataRef.current = [];
        // Fallback to setData - but first ensure data has no stale references
        try {
          // Re-create candleData with fresh transformations to ensure clean data
          candlestickSeriesRef.current.setData(candleData);
          previousDataRef.current = candleData;
        } catch (fallbackError) {
          console.error('TradingViewChart - Fallback setData also failed:', fallbackError);
          previousDataRef.current = [];
        }
      }
    }

    if (showVolume && volumeSeriesRef.current && data.length > 0) {
      try {
        const volumeData: HistogramData[] = data.map((d, i) => {
          let timeValue: any;
          if (typeof d.time === 'string') {
            const date = new Date(d.time);
            timeValue = (date.getTime() / 1000) as any;
          } else if (typeof d.time === 'number') {
            timeValue = d.time > 1e12 ? (d.time / 1000) as any : d.time;
          } else {
            timeValue = (Date.now() / 1000) as any;
          }

          // Determine color based on price movement
          const isUp = i > 0 && d.close >= data[i - 1].close;
          const volume = d.volume || 0;

          return {
            time: timeValue,
            value: volume,
            color: isUp
              ? currentColors.upColor + '80'  // Green with transparency
              : currentColors.downColor + '80', // Red with transparency
          };
        }).filter(v => v.value > 0); // Only include candles with volume

        if (volumeData.length > 0) {
          volumeSeriesRef.current.setData(volumeData);
        }
      } catch (volumeError) {
        console.warn('Error setting volume data:', volumeError);
        // Continue without volume - chart will still work
      }
    }
  }, [data, showVolume, currentColors, initChart, displayMode, marketCap, tokenPrice]); // Removed displayPrice from deps to prevent reset loops

  // Update latest candle with real-time price and price line
  useEffect(() => {
    // Don't require data.length > 0 - we can update even if data is empty (will use realTimePrice)
    if (!realTimePrice || !candlestickSeriesRef.current) {
      return;
    }

    // If we have data, use the last candle; otherwise create a new one from realTimePrice
    const latestCandle = data.length > 0 ? data[data.length - 1] : null;

    // If no data yet, wait for it
    if (!latestCandle && data.length === 0) {
      return;
    }

    if (!latestCandle) {
      return;
    }

    try {
      // Calculate price change
      const previousPrice = previousPriceRef.current;
      if (previousPrice && previousPrice !== realTimePrice) {
        const change = realTimePrice - previousPrice;
        const percentChange = (change / previousPrice) * 100;
        setPriceChange({
          value: change,
          percent: percentChange,
        });
      } else if (!previousPrice) {
        // First price update - compare with latest candle's close
        const candleClose = latestCandle.close;
        if (candleClose && candleClose !== realTimePrice) {
          const change = realTimePrice - candleClose;
          const percentChange = (change / candleClose) * 100;
          setPriceChange({
            value: change,
            percent: percentChange,
          });
        }
      }
      previousPriceRef.current = realTimePrice;
      setDisplayPrice(realTimePrice);

      // Update or create price line
      if (priceLineRef.current) {
        // Remove old price line
        try {
          candlestickSeriesRef.current.removePriceLine(priceLineRef.current);
        } catch (e) {
          // Ignore if price line doesn't exist
        }
      }

      // Format price for price line title based on magnitude - enhanced for small prices - NEVER use scientific notation
      const formatPriceForLine = (price: number): string => {
        if (!price || price <= 0) return '0';

        // For market cap mode, format as currency abbreviations
        if (displayMode === 'marketCap') {
          if (price >= 1000000000) return `$${(price / 1000000000).toFixed(2)}B`;
          if (price >= 1000000) return `$${(price / 1000000).toFixed(2)}M`;
          if (price >= 1000) return `$${(price / 1000).toFixed(2)}K`;
          return `$${price.toFixed(0)}`;
        }

        if (price >= 1000) {
          return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
        } else if (price >= 1) {
          return price.toFixed(4);
        } else if (price >= 0.01) {
          return price.toFixed(6);
        } else if (price >= 0.0001) {
          return price.toFixed(8);
        } else if (price >= 0.000001) {
          return price.toFixed(10);
        } else if (price >= 0.00000001) {
          return price.toFixed(12);
        } else {
          return price.toFixed(18).replace(/\.?0+$/, '');
        }
      };

      // Create new price line with updated price
      // Calculate price change for color (use the priceChange state if available, otherwise calculate)
      const currentPriceChange = priceChange ? priceChange.value : (previousPriceRef.current ? realTimePrice - previousPriceRef.current : 0);

      // Calculate scale factor for market cap mode
      // Use the same approach: scaleFactor = marketCap / latestDataClose
      const currentMc = marketCap ? parseMarketCap(marketCap) : 0;
      const latestDataClose = data.length > 0 ? data[data.length - 1].close : realTimePrice;
      const useMarketCap = displayMode === 'marketCap' && currentMc > 0;
      const scaleFactor = useMarketCap && latestDataClose > 0 ? currentMc / latestDataClose : 1;

      const displayValue = useMarketCap ? realTimePrice * scaleFactor : realTimePrice;

      const priceColor = currentPriceChange >= 0
        ? currentColors.upColor
        : currentColors.downColor;

      try {
        priceLineRef.current = candlestickSeriesRef.current.createPriceLine({
          price: displayValue,
          color: priceColor,
          lineWidth: 2,
          lineStyle: 2, // Dashed line
          axisLabelVisible: true,
          title: formatPriceForLine(displayValue),
        });
      } catch (e) {
        console.warn('Error creating price line:', e);
      }

      // Update the last candle's close price with real-time price
      if (latestCandle.close !== realTimePrice) {
        // Get the latest candle time
        let latestTime: number;

        if (typeof latestCandle.time === 'string') {
          const date = new Date(latestCandle.time);
          latestTime = Math.floor(date.getTime() / 1000);
        } else if (typeof latestCandle.time === 'number') {
          latestTime = latestCandle.time > 1e12 ? Math.floor(latestCandle.time / 1000) : latestCandle.time;
        } else {
          return;
        }

        // Convert prices to market cap using scale factor
        const openValue = useMarketCap ? latestCandle.open * scaleFactor : latestCandle.open;
        const highValue = useMarketCap ? Math.max(latestCandle.high, realTimePrice) * scaleFactor : Math.max(latestCandle.high, realTimePrice);
        const lowValue = useMarketCap ? Math.min(latestCandle.low, realTimePrice) * scaleFactor : Math.min(latestCandle.low, realTimePrice);
        const closeValue = useMarketCap ? realTimePrice * scaleFactor : realTimePrice;

        // Update the last candle's close price with real-time price
        const updatedCandle: CandlestickData = {
          time: latestTime as any,
          open: openValue,
          high: highValue,
          low: lowValue,
          close: closeValue,
        };

        // Update the previousDataRef so incremental updates work correctly
        if (previousDataRef.current.length > 0) {
          previousDataRef.current = [
            ...previousDataRef.current.slice(0, -1),
            updatedCandle
          ];
        }

        // Use update method to smoothly update the last candle without re-rendering entire chart
        candlestickSeriesRef.current.update(updatedCandle);

        // Update display price (show market cap if in that mode)
        setDisplayPrice(displayValue);
      }

      // Notify parent component of price update
      if (onPriceUpdate) {
        onPriceUpdate(realTimePrice);
      }
    } catch (error) {
      console.error('Error updating real-time price:', error);
    }
  }, [realTimePrice, data, onPriceUpdate, currentColors, priceChange, displayMode, marketCap, tokenPrice]);

  // Update chart with real-time candle from aggregator (proper OHLC updates)
  useEffect(() => {
    if (!realtimeCandle || !candlestickSeriesRef.current) return;

    try {
      const { time, open, high, low, close, volume } = realtimeCandle;

      // Properly convert time to Unix timestamp in seconds
      let candleTime: number;
      if (typeof time === 'number') {
        // If time is in milliseconds, convert to seconds
        candleTime = time > 1e12 ? Math.floor(time / 1000) : time;
      } else if (typeof time === 'string') {
        // If time is a string, parse it
        const date = new Date(time);
        candleTime = Math.floor(date.getTime() / 1000);
      } else if (time && typeof time === 'object') {
        // If time is an object (shouldn't happen but handle it)
        console.warn('TradingViewChart - time is an object, using current time');
        candleTime = Math.floor(Date.now() / 1000);
      } else {
        console.warn('TradingViewChart - Invalid time format:', time);
        return;
      }

      // Validate we have a reasonable time
      if (!candleTime || isNaN(candleTime) || candleTime <= 0) {
        console.warn('TradingViewChart - Invalid candle time:', candleTime);
        return;
      }

      // Check if this candle is older than existing data - skip if so
      if (previousDataRef.current.length > 0) {
        const lastTime = previousDataRef.current[previousDataRef.current.length - 1].time as number;
        if (candleTime < lastTime) {
          // This candle is older than existing data, skip it
          console.log('TradingViewChart - Skipping older candle, time:', candleTime, 'vs last:', lastTime);
          return;
        }
      }

      // Calculate scale factor for market cap mode
      const currentMc = marketCap ? parseMarketCap(marketCap) : 0;
      const useMarketCap = displayMode === 'marketCap' && currentMc > 0;
      const scaleFactor = useMarketCap && close > 0 ? currentMc / close : 1;

      // Apply scaling for market cap mode
      const scaledCandle = {
        time: candleTime as any,
        open: useMarketCap ? open * scaleFactor : open,
        high: useMarketCap ? high * scaleFactor : high,
        low: useMarketCap ? low * scaleFactor : low,
        close: useMarketCap ? close * scaleFactor : close,
      };

      console.log('TradingViewChart - Updating last candle with real-time price:', close);

      // Update the candle on the chart
      candlestickSeriesRef.current.update(scaledCandle);

      // Update volume if available
      if (showVolume && volumeSeriesRef.current && volume > 0) {
        const volumeColor = close >= open ? currentColors.upColor : currentColors.downColor;
        volumeSeriesRef.current.update({
          time: candleTime as any,
          value: volume,
          color: volumeColor + '80', // Semi-transparent
        });
      }

      // Update display price
      setDisplayPrice(useMarketCap ? close * scaleFactor : close);

      // Calculate price change
      if (previousPriceRef.current && previousPriceRef.current !== close) {
        const change = close - previousPriceRef.current;
        const percentChange = (change / previousPriceRef.current) * 100;
        setPriceChange({ value: change, percent: percentChange });
      }
      previousPriceRef.current = close;

      // Notify parent
      if (onPriceUpdate) {
        onPriceUpdate(close);
      }
    } catch (error) {
      console.error('Error updating real-time candle:', error);
    }
  }, [realtimeCandle, displayMode, marketCap, showVolume, currentColors, onPriceUpdate]);

  // Handle graduation and liquidity markers
  const graduationMarkersRef = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    // Listen for graduation events from WebSocket
    const store = useTradingStore.getState();
    const unsubscribe = useTradingStore.subscribe(
      (state) => state.tokenAddress,
      (tokenAddress) => {
        // When token changes, clear old markers
        graduationMarkersRef.current.clear();
      }
    );

    return unsubscribe;
  }, []);

  // Render order lines (limit, stop loss, and take profit)
  useEffect(() => {
    if (!candlestickSeriesRef.current || !orders) return;

    // Remove old order lines that are no longer in the orders array
    const currentOrderIds = new Set(orders.map(o => o.id));
    orderLinesRef.current.forEach((line, id) => {
      if (!currentOrderIds.has(id)) {
        try {
          candlestickSeriesRef.current?.removePriceLine(line);
        } catch (e) {
          // Ignore if line already removed
        }
        orderLinesRef.current.delete(id);
      }
    });

    // Get colors for order lines
    const orderColors = {
      limit: { buy: '#3B82F6', sell: '#F59E0B' },  // Blue for buy, Orange for sell
      stopLoss: '#EF4444',  // Red
      takeProfit: '#10B981',  // Green
    };

    // Calculate scale factor for market cap mode
    const currentMc = marketCap ? parseMarketCap(marketCap) : 0;
    const latestDataClose = data.length > 0 ? data[data.length - 1].close : 0;
    const useMarketCapMode = displayMode === 'marketCap' && currentMc > 0;
    const scaleFactor = useMarketCapMode && latestDataClose > 0 ? currentMc / latestDataClose : 1;

    // Add or update order lines
    orders.forEach((order) => {
      const scaledPrice = useMarketCapMode ? order.price * scaleFactor : order.price;
      const existingLine = orderLinesRef.current.get(order.id);

      // Determine line color based on order type and side
      let lineColor: string;
      if (order.type === 'limit') {
        lineColor = orderColors.limit[order.side];
      } else if (order.type === 'stopLoss') {
        lineColor = orderColors.stopLoss;
      } else {
        lineColor = orderColors.takeProfit;
      }

      // Determine label
      const typeLabels = {
        limit: order.side === 'buy' ? 'Limit Buy' : 'Limit Sell',
        stopLoss: 'Stop Loss',
        takeProfit: 'Take Profit',
      };
      const label = `${typeLabels[order.type]} ${order.amount} @ ${order.price.toFixed(8)}`;

      if (existingLine) {
        // Update existing line price if it changed
        try {
          existingLine.applyOptions({
            price: scaledPrice,
            title: label,
          });
        } catch (e) {
          // If update fails, remove and recreate
          orderLinesRef.current.delete(order.id);
        }
      } else {
        // Create new order line
        try {
          const newLine = candlestickSeriesRef.current?.createPriceLine({
            price: scaledPrice,
            color: lineColor,
            lineWidth: 2,
            lineStyle: 2, // Dashed
            axisLabelVisible: true,
            title: label,
          });

          if (newLine) {
            orderLinesRef.current.set(order.id, newLine);
          }
        } catch (e) {
          console.warn('Failed to create order line:', e);
        }
      }
    });
  }, [orders, data, displayMode, marketCap]);

  return (
    <div className={cn('relative w-full', className)} style={{ height: `${height}px` }}>
      {/* Symbol Badge - Only show symbol, no price */}
      {symbol && (
        <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-[#1a1f2e] rounded text-sm text-white font-medium">
          {symbol}
        </div>
      )}

      {/* Trade Bubble Overlay - Real-time trade visualization */}
      {chartRef.current && candlestickSeriesRef.current && data.length > 0 && (
        <TradeBubbleOverlay
          chartContainerRef={chartContainerRef}
          chartWidth={chartContainerRef.current?.clientWidth || 0}
          chartHeight={height}
          priceRange={{
            min: Math.min(...data.map(d => d.low)),
            max: Math.max(...data.map(d => d.high)),
          }}
          timeRange={{
            start: data[0]?.time || 0,
            end: data[data.length - 1]?.time || Date.now() / 1000,
          }}
        />
      )}

      {/* Current Price Display - Format based on price magnitude */}
      {(() => {
        // Prioritize realTimePrice > displayPrice > last candle close
        const currentPrice = realTimePrice || displayPrice || (data.length > 0 ? data[data.length - 1]?.close : null);
        if (!currentPrice || currentPrice <= 0) return null;

        // Format price based on magnitude for better readability
        // Enhanced formatting for very small prices (meme coins) - NEVER use scientific notation
        const formatPrice = (price: number): string => {
          if (!price || price <= 0) return '0';

          if (price >= 1000) {
            return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
          } else if (price >= 1) {
            return price.toFixed(4);
          } else if (price >= 0.01) {
            return price.toFixed(6);
          } else if (price >= 0.0001) {
            return price.toFixed(8);
          } else if (price >= 0.000001) {
            return price.toFixed(10);
          } else if (price >= 0.00000001) {
            return price.toFixed(12);
          } else {
            // For extremely small prices, show full decimal (up to 18 places) - no scientific notation
            return price.toFixed(18).replace(/\.?0+$/, '');
          }
        };

        const priceColor = priceChange
          ? (priceChange.value >= 0 ? currentColors.upColor : currentColors.downColor)
          : (realTimePrice ? currentColors.upColor : currentColors.textColor);

        // Calculate display value based on mode using scale factor
        const currentMc = marketCap ? parseMarketCap(marketCap) : 0;
        const latestDataClose = data.length > 0 ? data[data.length - 1].close : currentPrice;
        const useMarketCapDisplay = displayMode === 'marketCap' && currentMc > 0;
        const displayScaleFactor = useMarketCapDisplay && latestDataClose > 0 ? currentMc / latestDataClose : 1;

        // Display market cap if in market cap mode
        const displayValue = useMarketCapDisplay
          ? currentPrice * displayScaleFactor
          : currentPrice;

        const formattedValue = displayMode === 'marketCap'
          ? formatMarketCap(displayValue)
          : formatPrice(displayValue);

        const label = displayMode === 'marketCap' ? 'Market Cap' : 'Price';

        return (
          <div
            className="absolute top-2 right-2 z-50 px-3 py-1.5 rounded-lg shadow-lg border"
            style={{
              backgroundColor: theme === 'dark' ? 'rgba(26, 31, 46, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              borderColor: priceColor,
              minWidth: '140px'
            }}>
            <div className="flex flex-col items-end">
              <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: currentColors.textColor }}>
                {label}
              </div>
              <div className="text-lg font-bold" style={{ color: priceColor }}>
                {formattedValue}
              </div>
              {priceChange && Math.abs(priceChange.value) > 0.000001 ? (
                <div className="text-xs mt-0.5" style={{
                  color: priceChange.value >= 0 ? currentColors.upColor : currentColors.downColor
                }}>
                  {priceChange.value >= 0 ? '+' : ''}{displayMode === 'marketCap' ? formatMarketCap(priceChange.value) : formatPrice(priceChange.value)} ({priceChange.percent >= 0 ? '+' : ''}{priceChange.percent.toFixed(2)}%)
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
        );
      })()}

      {/* Chart Container */}
      <div
        ref={chartContainerRef}
        className="w-full"
        style={{ width: '100%', height: `${height}px` }}
      />

      {/* Empty state - only show if chart is initialized but no data */}
      {data.length === 0 && chartRef.current && (
        <div className="absolute inset-0 flex items-center justify-center" style={{
          backgroundColor: currentColors.backgroundColor
        }}>
          <div style={{ color: currentColors.textColor }} className="text-sm">No data available</div>
        </div>
      )}
    </div>
  );
}

