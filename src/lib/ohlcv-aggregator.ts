/**
 * OHLCV Aggregation Engine
 * 
 * Converts raw trade data into proper OHLCV candles in real-time.
 * This solves the "flattened/steppy" chart problem by properly tracking
 * Open-High-Low-Close within each time bucket.
 */

export interface OHLCVCandle {
  time: number; // Unix timestamp in seconds
  timeMs: number; // Unix timestamp in milliseconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trades: number;
  isClosed: boolean;
}

export interface TradeData {
  price: number;
  volume: number;
  timestamp: number; // Unix timestamp in milliseconds
  side?: 'buy' | 'sell';
}

type CandleCallback = (candle: OHLCVCandle) => void;
type CandleCloseCallback = (candle: OHLCVCandle) => void;

/**
 * Create an OHLCV aggregator for a specific timeframe
 */
export function createOHLCVAggregator(timeframeMs: number) {
  let currentCandle: OHLCVCandle | null = null;
  let completedCandles: OHLCVCandle[] = [];
  let lastTradeTimestamp = 0;

  const candleUpdateCallbacks: CandleCallback[] = [];
  const candleCloseCallbacks: CandleCloseCallback[] = [];

  /**
   * Get the candle start time for a given timestamp
   */
  const getCandleStartTime = (timestampMs: number): number => {
    return Math.floor(timestampMs / timeframeMs) * timeframeMs;
  };

  /**
   * Create a new candle
   */
  const createNewCandle = (price: number, volume: number, timestampMs: number): OHLCVCandle => {
    const candleStartMs = getCandleStartTime(timestampMs);
    return {
      time: Math.floor(candleStartMs / 1000),
      timeMs: candleStartMs,
      open: price,
      high: price,
      low: price,
      close: price,
      volume: volume,
      trades: 1,
      isClosed: false,
    };
  };

  /**
   * Close the current candle and start a new one
   */
  const closeCurrentCandle = () => {
    if (currentCandle && !currentCandle.isClosed) {
      currentCandle.isClosed = true;
      completedCandles.push(currentCandle);
      
      // Keep only last 500 candles in memory
      if (completedCandles.length > 500) {
        completedCandles = completedCandles.slice(-500);
      }

      // Notify listeners
      candleCloseCallbacks.forEach(cb => cb(currentCandle!));
    }
  };

  /**
   * Process an incoming trade and update/create candles
   */
  const processTrade = (trade: TradeData) => {
    const { price, volume, timestamp } = trade;
    
    if (price <= 0) return; // Ignore invalid prices

    const candleStartMs = getCandleStartTime(timestamp);
    lastTradeTimestamp = timestamp;

    // Check if we need to close current candle and start new one
    if (currentCandle) {
      const currentCandleEndMs = currentCandle.timeMs + timeframeMs;
      
      if (timestamp >= currentCandleEndMs) {
        // Close current candle
        closeCurrentCandle();
        
        // Fill any gaps with empty candles (using last close price)
        const gapStart = currentCandle!.timeMs + timeframeMs;
        let gapTime = gapStart;
        while (gapTime < candleStartMs) {
          const gapCandle: OHLCVCandle = {
            time: Math.floor(gapTime / 1000),
            timeMs: gapTime,
            open: currentCandle!.close,
            high: currentCandle!.close,
            low: currentCandle!.close,
            close: currentCandle!.close,
            volume: 0,
            trades: 0,
            isClosed: true,
          };
          completedCandles.push(gapCandle);
          gapTime += timeframeMs;
        }
        
        // Start new candle
        currentCandle = createNewCandle(price, volume, timestamp);
      } else {
        // Update current candle
        currentCandle.high = Math.max(currentCandle.high, price);
        currentCandle.low = Math.min(currentCandle.low, price);
        currentCandle.close = price;
        currentCandle.volume += volume;
        currentCandle.trades += 1;
      }
    } else {
      // First trade - create new candle
      currentCandle = createNewCandle(price, volume, timestamp);
    }

    // Notify listeners of candle update
    candleUpdateCallbacks.forEach(cb => cb(currentCandle!));
  };

  /**
   * Process a price update (without volume, for price-only feeds)
   */
  const processPriceUpdate = (price: number, timestamp: number = Date.now()) => {
    processTrade({
      price,
      volume: 0,
      timestamp,
    });
  };

  /**
   * Initialize with historical candles
   */
  const initializeWithHistory = (candles: OHLCVCandle[]) => {
    if (candles.length === 0) return;

    // Sort by time
    const sorted = [...candles].sort((a, b) => a.timeMs - b.timeMs);
    
    // Mark all as closed except potentially the last one
    completedCandles = sorted.slice(0, -1).map(c => ({ ...c, isClosed: true }));
    
    // The last candle becomes current if it's still in the current time bucket
    const lastCandle = sorted[sorted.length - 1];
    const now = Date.now();
    const currentBucketStart = getCandleStartTime(now);
    
    if (lastCandle.timeMs === currentBucketStart) {
      currentCandle = { ...lastCandle, isClosed: false };
    } else {
      completedCandles.push({ ...lastCandle, isClosed: true });
      currentCandle = null;
    }
  };

  /**
   * Get all candles (completed + current)
   */
  const getAllCandles = (): OHLCVCandle[] => {
    const result = [...completedCandles];
    if (currentCandle) {
      result.push(currentCandle);
    }
    return result;
  };

  /**
   * Get current (in-progress) candle
   */
  const getCurrentCandle = (): OHLCVCandle | null => {
    return currentCandle;
  };

  /**
   * Get completed candles
   */
  const getCompletedCandles = (): OHLCVCandle[] => {
    return [...completedCandles];
  };

  /**
   * Subscribe to candle updates (every trade updates)
   */
  const onCandleUpdate = (callback: CandleCallback) => {
    candleUpdateCallbacks.push(callback);
    return () => {
      const index = candleUpdateCallbacks.indexOf(callback);
      if (index > -1) candleUpdateCallbacks.splice(index, 1);
    };
  };

  /**
   * Subscribe to candle close events
   */
  const onCandleClose = (callback: CandleCloseCallback) => {
    candleCloseCallbacks.push(callback);
    return () => {
      const index = candleCloseCallbacks.indexOf(callback);
      if (index > -1) candleCloseCallbacks.splice(index, 1);
    };
  };

  /**
   * Clear all data
   */
  const reset = () => {
    currentCandle = null;
    completedCandles = [];
    lastTradeTimestamp = 0;
  };

  /**
   * Convert candles to chart-friendly format
   */
  const toChartFormat = (): {
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[] => {
    return getAllCandles().map(candle => ({
      time: new Date(candle.timeMs).toISOString(),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
    }));
  };

  return {
    processTrade,
    processPriceUpdate,
    initializeWithHistory,
    getAllCandles,
    getCurrentCandle,
    getCompletedCandles,
    onCandleUpdate,
    onCandleClose,
    reset,
    toChartFormat,
    getTimeframeMs: () => timeframeMs,
  };
}

/**
 * Convert timeframe string to milliseconds
 */
export function timeframeToMs(timeframe: string): number {
  const match = timeframe.match(/^(\d+)([smhHdDwWmM])$/);
  if (!match) return 60000; // Default 1 minute

  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    case 'w': return value * 7 * 24 * 60 * 60 * 1000;
    default: return 60000;
  }
}

/**
 * Create aggregator from timeframe string
 */
export function createAggregatorFromTimeframe(timeframe: string) {
  return createOHLCVAggregator(timeframeToMs(timeframe));
}

/**
 * Merge historical candles with real-time updates
 */
export function mergeHistoricalWithRealtime(
  historical: OHLCVCandle[],
  realtime: OHLCVCandle | null
): OHLCVCandle[] {
  if (!realtime) return historical;

  const result = [...historical];
  const lastHistorical = result[result.length - 1];

  if (lastHistorical && lastHistorical.timeMs === realtime.timeMs) {
    // Update the last candle
    result[result.length - 1] = {
      ...lastHistorical,
      high: Math.max(lastHistorical.high, realtime.high),
      low: Math.min(lastHistorical.low, realtime.low),
      close: realtime.close,
      volume: lastHistorical.volume + realtime.volume,
      trades: lastHistorical.trades + realtime.trades,
    };
  } else if (!lastHistorical || realtime.timeMs > lastHistorical.timeMs) {
    // Add new candle
    result.push(realtime);
  }

  return result;
}
