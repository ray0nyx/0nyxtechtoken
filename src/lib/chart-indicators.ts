/**
 * Chart Indicators Library
 * 
 * Technical indicator calculations for use with lightweight-charts.
 * All functions take simple number arrays and return calculated values.
 */

export interface IndicatorValue {
    time: number;
    value: number | null;
}

/**
 * Simple Moving Average (SMA)
 * @param data - Array of price values (typically closes)
 * @param period - Number of periods for the average
 */
export function calculateSMA(data: number[], period: number): (number | null)[] {
    const result: (number | null)[] = [];

    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            result.push(null);
        } else {
            const slice = data.slice(i - period + 1, i + 1);
            const sum = slice.reduce((a, b) => a + b, 0);
            result.push(sum / period);
        }
    }

    return result;
}

/**
 * Exponential Moving Average (EMA)
 * @param data - Array of price values
 * @param period - Number of periods
 */
export function calculateEMA(data: number[], period: number): (number | null)[] {
    const result: (number | null)[] = [];
    const multiplier = 2 / (period + 1);

    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            result.push(null);
        } else if (i === period - 1) {
            // First EMA value is the SMA
            const sum = data.slice(0, period).reduce((a, b) => a + b, 0);
            result.push(sum / period);
        } else {
            const prevEMA = result[i - 1];
            if (prevEMA === null) {
                result.push(null);
            } else {
                result.push((data[i] - prevEMA) * multiplier + prevEMA);
            }
        }
    }

    return result;
}

/**
 * Relative Strength Index (RSI)
 * @param closes - Array of closing prices
 * @param period - RSI period (default 14)
 */
export function calculateRSI(closes: number[], period: number = 14): (number | null)[] {
    if (closes.length < period + 1) {
        return new Array(closes.length).fill(null);
    }

    const rsi: (number | null)[] = [null]; // First value has no change
    const gains: number[] = [];
    const losses: number[] = [];

    // Calculate price changes
    for (let i = 1; i < closes.length; i++) {
        const change = closes[i] - closes[i - 1];
        gains.push(change > 0 ? change : 0);
        losses.push(change < 0 ? Math.abs(change) : 0);

        if (i < period) {
            rsi.push(null); // Not enough data yet
            continue;
        }

        if (i === period) {
            // First RSI uses simple average
            const avgGain = gains.reduce((a, b) => a + b, 0) / period;
            const avgLoss = losses.reduce((a, b) => a + b, 0) / period;

            if (avgLoss === 0) {
                rsi.push(100);
            } else {
                const rs = avgGain / avgLoss;
                rsi.push(100 - (100 / (1 + rs)));
            }
        } else {
            // Subsequent RSI uses smoothed average (Wilder's smoothing)
            const prevRSI = rsi[i - 1];
            if (prevRSI === null) {
                rsi.push(null);
                continue;
            }

            // Get previous averages from the RS calculation
            const recentGains = gains.slice(-period);
            const recentLosses = losses.slice(-period);

            const avgGain = recentGains.reduce((a, b) => a + b, 0) / period;
            const avgLoss = recentLosses.reduce((a, b) => a + b, 0) / period;

            if (avgLoss === 0) {
                rsi.push(100);
            } else {
                const rs = avgGain / avgLoss;
                rsi.push(100 - (100 / (1 + rs)));
            }
        }
    }

    return rsi;
}

/**
 * MACD (Moving Average Convergence Divergence)
 * @param closes - Array of closing prices
 * @param fastPeriod - Fast EMA period (default 12)
 * @param slowPeriod - Slow EMA period (default 26)
 * @param signalPeriod - Signal line period (default 9)
 */
export interface MACDResult {
    macd: (number | null)[];
    signal: (number | null)[];
    histogram: (number | null)[];
}

export function calculateMACD(
    closes: number[],
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9
): MACDResult {
    const fastEMA = calculateEMA(closes, fastPeriod);
    const slowEMA = calculateEMA(closes, slowPeriod);

    // MACD line = Fast EMA - Slow EMA
    const macd: (number | null)[] = [];
    for (let i = 0; i < closes.length; i++) {
        if (fastEMA[i] === null || slowEMA[i] === null) {
            macd.push(null);
        } else {
            macd.push(fastEMA[i]! - slowEMA[i]!);
        }
    }

    // Signal line = EMA of MACD line
    const validMacdValues = macd.filter((v): v is number => v !== null);
    const signalEMA = calculateEMA(validMacdValues, signalPeriod);

    // Align signal with macd array length
    const nullCount = macd.length - validMacdValues.length;
    const signal: (number | null)[] = new Array(nullCount).fill(null);

    let signalIdx = 0;
    for (let i = 0; i < macd.length; i++) {
        if (macd[i] !== null) {
            signal.push(signalEMA[signalIdx] ?? null);
            signalIdx++;
        }
    }

    // Pad signal to match length
    while (signal.length < macd.length) {
        signal.push(null);
    }

    // Histogram = MACD - Signal
    const histogram: (number | null)[] = [];
    for (let i = 0; i < closes.length; i++) {
        if (macd[i] === null || signal[i] === null) {
            histogram.push(null);
        } else {
            histogram.push(macd[i]! - signal[i]!);
        }
    }

    return { macd, signal, histogram };
}

/**
 * Bollinger Bands
 * @param closes - Array of closing prices
 * @param period - Period for SMA (default 20)
 * @param stdDev - Standard deviation multiplier (default 2)
 */
export interface BollingerBandsResult {
    upper: (number | null)[];
    middle: (number | null)[];
    lower: (number | null)[];
}

export function calculateBollingerBands(
    closes: number[],
    period: number = 20,
    stdDevMultiplier: number = 2
): BollingerBandsResult {
    const middle = calculateSMA(closes, period);
    const upper: (number | null)[] = [];
    const lower: (number | null)[] = [];

    for (let i = 0; i < closes.length; i++) {
        if (i < period - 1 || middle[i] === null) {
            upper.push(null);
            lower.push(null);
            continue;
        }

        // Calculate standard deviation
        const slice = closes.slice(i - period + 1, i + 1);
        const mean = middle[i]!;
        const squaredDiffs = slice.map(v => Math.pow(v - mean, 2));
        const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / period;
        const stdDev = Math.sqrt(avgSquaredDiff);

        upper.push(mean + stdDevMultiplier * stdDev);
        lower.push(mean - stdDevMultiplier * stdDev);
    }

    return { upper, middle, lower };
}

/**
 * Volume Weighted Average Price (VWAP)
 * Calculated from the start of the trading session
 * @param highs - Array of high prices
 * @param lows - Array of low prices  
 * @param closes - Array of closing prices
 * @param volumes - Array of volume values
 */
export function calculateVWAP(
    highs: number[],
    lows: number[],
    closes: number[],
    volumes: number[]
): (number | null)[] {
    const vwap: (number | null)[] = [];
    let cumulativeTPV = 0; // Typical Price * Volume
    let cumulativeVolume = 0;

    for (let i = 0; i < closes.length; i++) {
        const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
        const volume = volumes[i] || 0;

        cumulativeTPV += typicalPrice * volume;
        cumulativeVolume += volume;

        if (cumulativeVolume === 0) {
            vwap.push(null);
        } else {
            vwap.push(cumulativeTPV / cumulativeVolume);
        }
    }

    return vwap;
}

/**
 * Average True Range (ATR)
 * @param highs - Array of high prices
 * @param lows - Array of low prices
 * @param closes - Array of closing prices
 * @param period - ATR period (default 14)
 */
export function calculateATR(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number = 14
): (number | null)[] {
    const trueRanges: number[] = [];
    const atr: (number | null)[] = [];

    for (let i = 0; i < closes.length; i++) {
        if (i === 0) {
            // First TR is just High - Low
            trueRanges.push(highs[i] - lows[i]);
            atr.push(null);
            continue;
        }

        // True Range = max(High - Low, |High - PrevClose|, |Low - PrevClose|)
        const prevClose = closes[i - 1];
        const tr = Math.max(
            highs[i] - lows[i],
            Math.abs(highs[i] - prevClose),
            Math.abs(lows[i] - prevClose)
        );
        trueRanges.push(tr);

        if (i < period) {
            atr.push(null);
        } else if (i === period) {
            // First ATR is simple average
            const sum = trueRanges.slice(0, period + 1).reduce((a, b) => a + b, 0);
            atr.push(sum / (period + 1));
        } else {
            // Subsequent ATR uses smoothing
            const prevATR = atr[i - 1];
            if (prevATR === null) {
                atr.push(null);
            } else {
                atr.push((prevATR * (period - 1) + tr) / period);
            }
        }
    }

    return atr;
}

/**
 * Helper to convert indicator values to chart data format
 */
export function toChartData<T extends { time: number }>(
    times: number[],
    values: (number | null)[]
): { time: number; value: number }[] {
    const result: { time: number; value: number }[] = [];

    for (let i = 0; i < times.length; i++) {
        if (values[i] !== null) {
            result.push({ time: times[i], value: values[i] as number });
        }
    }

    return result;
}
