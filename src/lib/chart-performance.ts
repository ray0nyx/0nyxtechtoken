/**
 * Chart Performance Utilities
 * 
 * Optimizations for achieving <16ms chart updates:
 * - Debounced crosshair callbacks
 * - Batched candle updates
 * - RequestAnimationFrame for smooth rendering
 * - Memory-efficient data structures
 * - Incremental updates (no full refetch)
 */

import { IChartApi, ISeriesApi, CandlestickData, Time, UTCTimestamp } from 'lightweight-charts';

// ============ Configuration ============

const CROSSHAIR_DEBOUNCE_MS = 16; // ~60fps
const PRICE_UPDATE_DEBOUNCE_MS = 16;
const BATCH_UPDATE_INTERVAL_MS = 50; // Batch updates every 50ms
const MAX_CANDLES_IN_MEMORY = 500;
const HIGH_FREQUENCY_THRESHOLD = 10; // Updates per second threshold

// ============ Types ============

export interface OptimizedCandle {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface ChartUpdateStats {
  lastUpdateTime: number;
  updatesPerSecond: number;
  avgUpdateDuration: number;
  droppedUpdates: number;
}

// ============ Debouncing ============

type DebouncedFunction<T extends (...args: any[]) => any> = T & {
  cancel: () => void;
  flush: () => void;
};

/**
 * Creates a debounced function that delays invoking func until after wait
 * milliseconds have elapsed since the last time the debounced function was invoked.
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): DebouncedFunction<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  const debounced = function (this: any, ...args: Parameters<T>) {
    lastArgs = args;

    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func.apply(this, lastArgs!);
      timeoutId = null;
      lastArgs = null;
    }, wait);
  } as DebouncedFunction<T>;

  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
      lastArgs = null;
    }
  };

  debounced.flush = () => {
    if (timeoutId !== null && lastArgs !== null) {
      clearTimeout(timeoutId);
      func.apply(null, lastArgs);
      timeoutId = null;
      lastArgs = null;
    }
  };

  return debounced;
}

// ============ RAF-based Updates ============

/**
 * Creates a function that uses requestAnimationFrame for smooth updates
 */
export function rafThrottle<T extends (...args: any[]) => any>(
  func: T
): T & { cancel: () => void } {
  let rafId: number | null = null;
  let lastArgs: Parameters<T> | null = null;

  const throttled = function (this: any, ...args: Parameters<T>) {
    lastArgs = args;

    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        func.apply(this, lastArgs!);
        rafId = null;
        lastArgs = null;
      });
    }
  } as T & { cancel: () => void };

  throttled.cancel = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
      lastArgs = null;
    }
  };

  return throttled;
}

// ============ Batched Updates ============

interface BatchedUpdate {
  candle: OptimizedCandle;
  timestamp: number;
}

/**
 * Batches multiple candle updates and applies them together
 */
export class CandleUpdateBatcher {
  private pendingUpdates: Map<number, OptimizedCandle> = new Map();
  private series: ISeriesApi<'Candlestick'> | null = null;
  private batchInterval: ReturnType<typeof setInterval> | null = null;
  private isProcessing = false;
  
  constructor(private intervalMs: number = BATCH_UPDATE_INTERVAL_MS) {}
  
  /**
   * Set the candlestick series to update
   */
  setSeries(series: ISeriesApi<'Candlestick'>): void {
    this.series = series;
  }
  
  /**
   * Start the batching interval
   */
  start(): void {
    if (this.batchInterval) return;
    
    this.batchInterval = setInterval(() => {
      this.flush();
    }, this.intervalMs);
  }
  
  /**
   * Stop the batching interval
   */
  stop(): void {
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
      this.batchInterval = null;
    }
  }
  
  /**
   * Add a candle update to the batch
   */
  addUpdate(candle: OptimizedCandle): void {
    // Keep only the latest update for each timestamp
    this.pendingUpdates.set(candle.time, candle);
  }
  
  /**
   * Flush all pending updates
   */
  flush(): void {
    if (!this.series || this.pendingUpdates.size === 0 || this.isProcessing) {
      return;
    }
    
    this.isProcessing = true;
    
    try {
      // Sort by time and apply updates
      const updates = Array.from(this.pendingUpdates.values())
        .sort((a, b) => a.time - b.time);
      
      for (const candle of updates) {
        this.series.update(candle);
      }
      
      this.pendingUpdates.clear();
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Get number of pending updates
   */
  getPendingCount(): number {
    return this.pendingUpdates.size;
  }
}

// ============ Incremental Data Manager ============

/**
 * Manages chart data incrementally to avoid full refetches
 */
export class IncrementalDataManager {
  private candles: Map<number, OptimizedCandle> = new Map();
  private sortedTimes: number[] = [];
  private maxCandles: number;
  
  constructor(maxCandles: number = MAX_CANDLES_IN_MEMORY) {
    this.maxCandles = maxCandles;
  }
  
  /**
   * Add or update a candle
   */
  upsertCandle(candle: OptimizedCandle): boolean {
    const isNew = !this.candles.has(candle.time);
    
    this.candles.set(candle.time, candle);
    
    if (isNew) {
      // Insert in sorted order
      const insertIndex = this.binarySearchInsert(candle.time);
      this.sortedTimes.splice(insertIndex, 0, candle.time);
      
      // Trim if over limit
      while (this.sortedTimes.length > this.maxCandles) {
        const oldestTime = this.sortedTimes.shift()!;
        this.candles.delete(oldestTime);
      }
    }
    
    return isNew;
  }
  
  /**
   * Get candle by time
   */
  getCandle(time: number): OptimizedCandle | undefined {
    return this.candles.get(time);
  }
  
  /**
   * Get all candles in chronological order
   */
  getAllCandles(): OptimizedCandle[] {
    return this.sortedTimes.map(time => this.candles.get(time)!);
  }
  
  /**
   * Get candles in a time range
   */
  getCandlesInRange(startTime: number, endTime: number): OptimizedCandle[] {
    return this.sortedTimes
      .filter(time => time >= startTime && time <= endTime)
      .map(time => this.candles.get(time)!);
  }
  
  /**
   * Get the latest candle
   */
  getLatestCandle(): OptimizedCandle | undefined {
    if (this.sortedTimes.length === 0) return undefined;
    const latestTime = this.sortedTimes[this.sortedTimes.length - 1];
    return this.candles.get(latestTime);
  }
  
  /**
   * Clear all data
   */
  clear(): void {
    this.candles.clear();
    this.sortedTimes = [];
  }
  
  /**
   * Get count of candles
   */
  size(): number {
    return this.candles.size;
  }
  
  private binarySearchInsert(time: number): number {
    let low = 0;
    let high = this.sortedTimes.length;
    
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (this.sortedTimes[mid] < time) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    
    return low;
  }
}

// ============ Performance Monitor ============

/**
 * Monitors chart update performance
 */
export class ChartPerformanceMonitor {
  private updateTimes: number[] = [];
  private updateDurations: number[] = [];
  private droppedUpdates = 0;
  private maxSamples = 100;
  private lastSecondUpdates = 0;
  private lastSecondTimestamp = 0;
  
  /**
   * Record an update
   */
  recordUpdate(durationMs: number): void {
    const now = Date.now();
    
    this.updateTimes.push(now);
    this.updateDurations.push(durationMs);
    
    // Trim old samples
    if (this.updateTimes.length > this.maxSamples) {
      this.updateTimes.shift();
      this.updateDurations.shift();
    }
    
    // Track updates per second
    if (now - this.lastSecondTimestamp >= 1000) {
      this.lastSecondUpdates = this.updateTimes.filter(
        t => now - t < 1000
      ).length;
      this.lastSecondTimestamp = now;
    }
  }
  
  /**
   * Record a dropped update
   */
  recordDroppedUpdate(): void {
    this.droppedUpdates++;
  }
  
  /**
   * Get current stats
   */
  getStats(): ChartUpdateStats {
    const now = Date.now();
    const recentUpdates = this.updateTimes.filter(t => now - t < 1000);
    const recentDurations = this.updateDurations.slice(-recentUpdates.length);
    
    const avgDuration = recentDurations.length > 0
      ? recentDurations.reduce((a, b) => a + b, 0) / recentDurations.length
      : 0;
    
    return {
      lastUpdateTime: this.updateTimes[this.updateTimes.length - 1] || 0,
      updatesPerSecond: recentUpdates.length,
      avgUpdateDuration: avgDuration,
      droppedUpdates: this.droppedUpdates,
    };
  }
  
  /**
   * Check if we're in high-frequency mode
   */
  isHighFrequency(): boolean {
    return this.lastSecondUpdates > HIGH_FREQUENCY_THRESHOLD;
  }
  
  /**
   * Reset stats
   */
  reset(): void {
    this.updateTimes = [];
    this.updateDurations = [];
    this.droppedUpdates = 0;
    this.lastSecondUpdates = 0;
  }
}

// ============ Optimized Chart Update Function ============

/**
 * Performs an optimized chart update with performance tracking
 */
export function performOptimizedUpdate(
  series: ISeriesApi<'Candlestick'>,
  candle: OptimizedCandle,
  monitor?: ChartPerformanceMonitor
): void {
  const start = performance.now();
  
  try {
    // Use requestAnimationFrame for smooth update
    requestAnimationFrame(() => {
      series.update(candle);
      
      if (monitor) {
        const duration = performance.now() - start;
        monitor.recordUpdate(duration);
        
        // Warn if update took too long
        if (duration > 16) {
          console.warn(`[ChartPerf] Slow update: ${duration.toFixed(2)}ms`);
        }
      }
    });
  } catch (error) {
    if (monitor) {
      monitor.recordDroppedUpdate();
    }
    console.error('[ChartPerf] Update failed:', error);
  }
}

// ============ Crosshair Debouncer ============

/**
 * Creates a debounced crosshair callback
 */
export function createDebouncedCrosshairCallback(
  callback: (data: { time: number; price: number; volume?: number } | null) => void
): (param: any) => void {
  return debounce((param: any) => {
    if (!param || !param.point) {
      callback(null);
      return;
    }
    
    const { time, seriesData } = param;
    
    if (!time || !seriesData) {
      callback(null);
      return;
    }
    
    // Get candlestick data from series
    const candleData = seriesData.values().next().value;
    
    if (candleData) {
      callback({
        time: time as number,
        price: candleData.close ?? candleData.value ?? 0,
        volume: candleData.volume,
      });
    }
  }, CROSSHAIR_DEBOUNCE_MS);
}

// ============ Price Line Optimizer ============

/**
 * Optimizes price line updates using RAF
 */
export class PriceLineOptimizer {
  private pendingPrice: number | null = null;
  private rafId: number | null = null;
  private updateFn: ((price: number) => void) | null = null;
  
  /**
   * Set the update function
   */
  setUpdateFunction(fn: (price: number) => void): void {
    this.updateFn = fn;
  }
  
  /**
   * Queue a price update
   */
  queueUpdate(price: number): void {
    this.pendingPrice = price;
    
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => {
        if (this.pendingPrice !== null && this.updateFn) {
          this.updateFn(this.pendingPrice);
        }
        this.rafId = null;
        this.pendingPrice = null;
      });
    }
  }
  
  /**
   * Cancel pending update
   */
  cancel(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.pendingPrice = null;
  }
}

// ============ Export Singleton Utilities ============

let performanceMonitor: ChartPerformanceMonitor | null = null;

export function getChartPerformanceMonitor(): ChartPerformanceMonitor {
  if (!performanceMonitor) {
    performanceMonitor = new ChartPerformanceMonitor();
  }
  return performanceMonitor;
}

export function resetChartPerformanceMonitor(): void {
  if (performanceMonitor) {
    performanceMonitor.reset();
  }
}





