/**
 * Enhanced Chart with Indicators and Drawing Tools
 * 
 * This component wraps lightweight-charts with:
 * - Real-time data from useTradingStore (via WebSocket)
 * - Technical indicators (RSI, MACD, SMA, EMA, Bollinger Bands)
 * - Interactive drawing tools (horizontal lines, trendlines, rays)
 * - Indicator panes below the main chart
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { createChart, IChartApi, ISeriesApi, Time, CandlestickSeries, LineSeries, HistogramSeries } from 'lightweight-charts';
import { cn } from '@/lib/utils';
import { useTradingStore, selectCandles, selectCurrentCandle, type OHLCVCandle } from '@/stores/useTradingStore';
import { useTradingWebSocket } from '@/lib/trading-websocket';
import DrawingToolsSidebar from './chart/DrawingToolsSidebar';
import {
    DrawingManager,
    createDrawingManager,
    type DrawingTool,
    type Drawing
} from '@/lib/chart-drawing-manager';
import {
    calculateRSI,
    calculateMACD,
    calculateSMA,
    calculateEMA,
    calculateBollingerBands,
    toChartData,
} from '@/lib/chart-indicators';

interface IndicatorConfig {
    rsi?: { enabled: boolean; period: number };
    macd?: { enabled: boolean; fast: number; slow: number; signal: number };
    sma?: { enabled: boolean; periods: number[] };
    ema?: { enabled: boolean; periods: number[] };
    bollingerBands?: { enabled: boolean; period: number; stdDev: number };
}

interface EnhancedChartProps {
    tokenAddress: string;
    timeframes?: string[];
    height?: number;
    theme?: 'dark' | 'light';
    showVolume?: boolean;
    showDrawingTools?: boolean;
    indicators?: IndicatorConfig;
    onPriceUpdate?: (price: number) => void;
    className?: string;
}

const DEFAULT_INDICATORS: IndicatorConfig = {
    rsi: { enabled: false, period: 14 },
    macd: { enabled: false, fast: 12, slow: 26, signal: 9 },
    sma: { enabled: false, periods: [20, 50] },
    ema: { enabled: false, periods: [12, 26] },
    bollingerBands: { enabled: false, period: 20, stdDev: 2 },
};

// Axiom-style colors
const COLORS = {
    dark: {
        background: '#0a0a0f',
        text: '#9ca3af',
        grid: '#1a1a24',
        upColor: '#00D4AA',
        downColor: '#FF4466',
    },
    light: {
        background: '#ffffff',
        text: '#374151',
        grid: '#e5e7eb',
        upColor: '#00D4AA',
        downColor: '#FF4466',
    },
};

const INDICATOR_COLORS = {
    rsi: '#a855f7',
    macd: '#3b82f6',
    macdSignal: '#f97316',
    macdHistogramUp: '#22c55e',
    macdHistogramDown: '#ef4444',
    sma: ['#eab308', '#14b8a6'],
    ema: ['#ec4899', '#8b5cf6'],
    bollingerUpper: '#60a5fa',
    bollingerLower: '#60a5fa',
    bollingerMiddle: '#fbbf24',
};

export default function EnhancedChart({
    tokenAddress,
    timeframes = ['1m', '5m', '15m', '1h'],
    height = 400,
    theme = 'dark',
    showVolume = true,
    showDrawingTools = true,
    indicators = DEFAULT_INDICATORS,
    onPriceUpdate,
    className,
}: EnhancedChartProps) {
    // Connect to WebSocket and subscribe to token
    const { isConnected, subscribe, requestCandles } = useTradingWebSocket(tokenAddress, timeframes);

    // Get real-time data from store
    const storeCandles = useTradingStore(selectCandles);
    const currentCandle = useTradingStore(selectCurrentCandle);
    const currentPrice = useTradingStore((state) => state.currentPrice);
    const selectedTimeframe = useTradingStore((state) => state.selectedTimeframe);
    const wsStatus = useTradingStore((state) => state.wsStatus);

    const mainChartContainerRef = useRef<HTMLDivElement>(null);
    const mainChartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const drawingManagerRef = useRef<DrawingManager | null>(null);

    const [selectedTool, setSelectedTool] = useState<DrawingTool>('cursor');
    const [drawings, setDrawings] = useState<Drawing[]>([]);

    const colors = COLORS[theme];
    const indicatorConfig = { ...DEFAULT_INDICATORS, ...indicators };

    // Calculate chart heights
    const rsiHeight = indicatorConfig.rsi?.enabled ? 100 : 0;
    const macdHeight = indicatorConfig.macd?.enabled ? 100 : 0;
    const mainChartHeight = height - rsiHeight - macdHeight;

    // Convert store candles to chart format with current candle
    const chartData = useMemo(() => {
        if (!storeCandles || storeCandles.length === 0) return [];

        const data = storeCandles.map(c => ({
            time: c.time as Time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume || 0,
        }));

        // Add or update current (unclosed) candle if exists
        if (currentCandle && !currentCandle.isClosed) {
            const lastIndex = data.findIndex(d => (d.time as number) === currentCandle.time);
            const candleData = {
                time: currentCandle.time as Time,
                open: currentCandle.open,
                high: currentCandle.high,
                low: currentCandle.low,
                close: currentCandle.close,
                volume: currentCandle.volume || 0,
            };

            if (lastIndex >= 0) {
                data[lastIndex] = candleData;
            } else {
                data.push(candleData);
            }
        }

        return data;
    }, [storeCandles, currentCandle]);

    // Initialize main chart
    useEffect(() => {
        if (!mainChartContainerRef.current) return;

        // Cleanup previous chart
        if (mainChartRef.current) {
            mainChartRef.current.remove();
            mainChartRef.current = null;
            candleSeriesRef.current = null;
            volumeSeriesRef.current = null;
            drawingManagerRef.current = null;
        }

        // Create chart
        const chart = createChart(mainChartContainerRef.current, {
            layout: {
                background: { color: colors.background },
                textColor: colors.text,
            },
            grid: {
                vertLines: { color: colors.grid },
                horzLines: { color: colors.grid },
            },
            width: mainChartContainerRef.current.clientWidth,
            height: mainChartHeight,
            rightPriceScale: {
                visible: true,
                borderVisible: true,
                borderColor: colors.grid,
            },
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
                rightOffset: 5,
                barSpacing: 8,
            },
            crosshair: {
                mode: 1,
            },
        });

        mainChartRef.current = chart;

        // Add candlestick series using v5 API
        const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: colors.upColor,
            downColor: colors.downColor,
            borderVisible: false,
            wickUpColor: colors.upColor,
            wickDownColor: colors.downColor,
        });

        candleSeriesRef.current = candleSeries;

        // Add volume if enabled
        if (showVolume) {
            const volumeSeries = chart.addSeries(HistogramSeries, {
                color: colors.upColor,
                priceFormat: { type: 'volume' },
                priceScaleId: 'volume',
            });

            chart.priceScale('volume').applyOptions({
                scaleMargins: { top: 0.8, bottom: 0 },
                visible: false,
            });

            volumeSeriesRef.current = volumeSeries;
        }

        // Initialize drawing manager
        if (showDrawingTools && candleSeries) {
            drawingManagerRef.current = createDrawingManager(chart, candleSeries, {
                defaultColor: colors.upColor,
                onDrawingComplete: (drawing) => {
                    setDrawings(prev => [...prev, drawing]);
                },
            });

            // Subscribe to click events
            chart.subscribeClick((param) => {
                if (drawingManagerRef.current) {
                    drawingManagerRef.current.handleClick(param);
                }
            });

            // Subscribe to crosshair move
            chart.subscribeCrosshairMove((param) => {
                if (drawingManagerRef.current) {
                    drawingManagerRef.current.handleCrosshairMove(param);
                }
                if (param.point && candleSeriesRef.current) {
                    const price = candleSeriesRef.current.coordinateToPrice(param.point.y);
                    if (price && onPriceUpdate) {
                        onPriceUpdate(price);
                    }
                }
            });
        }

        const handleResize = () => {
            if (mainChartContainerRef.current && mainChartRef.current) {
                mainChartRef.current.applyOptions({
                    width: mainChartContainerRef.current.clientWidth,
                });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (mainChartRef.current) {
                mainChartRef.current.remove();
            }
        };
    }, [theme, mainChartHeight, showVolume, showDrawingTools, colors]);

    // Update chart data when candles change
    useEffect(() => {
        if (!candleSeriesRef.current || chartData.length === 0) return;

        candleSeriesRef.current.setData(chartData);

        // Update volume series
        if (volumeSeriesRef.current && showVolume) {
            const volumeData = chartData.map(d => ({
                time: d.time,
                value: d.volume,
                color: d.close >= d.open ? colors.upColor + '60' : colors.downColor + '60',
            }));
            volumeSeriesRef.current.setData(volumeData);
        }

        // Fit content on first load
        if (mainChartRef.current && chartData.length > 0) {
            mainChartRef.current.timeScale().fitContent();
        }
    }, [chartData, showVolume, colors.upColor, colors.downColor]);

    // Update indicators when candles change
    useEffect(() => {
        if (!mainChartRef.current || chartData.length < 20) return;

        const chart = mainChartRef.current;
        const closes = chartData.map(d => d.close);
        const times = chartData.map(d => d.time);

        // Add SMA overlays
        if (indicatorConfig.sma?.enabled) {
            indicatorConfig.sma.periods.forEach((period, idx) => {
                const smaValues = calculateSMA(closes, period);
                const smaData = toChartData(times.map(t => t as number), smaValues);

                const smaSeries = chart.addSeries(LineSeries, {
                    color: INDICATOR_COLORS.sma[idx % INDICATOR_COLORS.sma.length],
                    lineWidth: 1,
                    lastValueVisible: false,
                    priceLineVisible: false,
                });
                smaSeries.setData(smaData.map(d => ({ time: d.time as Time, value: d.value })));
            });
        }

        // Add EMA overlays
        if (indicatorConfig.ema?.enabled) {
            indicatorConfig.ema.periods.forEach((period, idx) => {
                const emaValues = calculateEMA(closes, period);
                const emaData = toChartData(times.map(t => t as number), emaValues);

                const emaSeries = chart.addSeries(LineSeries, {
                    color: INDICATOR_COLORS.ema[idx % INDICATOR_COLORS.ema.length],
                    lineWidth: 1,
                    lastValueVisible: false,
                    priceLineVisible: false,
                });
                emaSeries.setData(emaData.map(d => ({ time: d.time as Time, value: d.value })));
            });
        }

        // Add Bollinger Bands overlay
        if (indicatorConfig.bollingerBands?.enabled) {
            const bb = calculateBollingerBands(
                closes,
                indicatorConfig.bollingerBands.period,
                indicatorConfig.bollingerBands.stdDev
            );

            // Upper band
            const upperSeries = chart.addSeries(LineSeries, {
                color: INDICATOR_COLORS.bollingerUpper,
                lineWidth: 1,
                lineStyle: 2,
                lastValueVisible: false,
                priceLineVisible: false,
            });
            upperSeries.setData(toChartData(times.map(t => t as number), bb.upper).map(d => ({ time: d.time as Time, value: d.value })));

            // Middle band
            const middleSeries = chart.addSeries(LineSeries, {
                color: INDICATOR_COLORS.bollingerMiddle,
                lineWidth: 1,
                lastValueVisible: false,
                priceLineVisible: false,
            });
            middleSeries.setData(toChartData(times.map(t => t as number), bb.middle).map(d => ({ time: d.time as Time, value: d.value })));

            // Lower band
            const lowerSeries = chart.addSeries(LineSeries, {
                color: INDICATOR_COLORS.bollingerLower,
                lineWidth: 1,
                lineStyle: 2,
                lastValueVisible: false,
                priceLineVisible: false,
            });
            lowerSeries.setData(toChartData(times.map(t => t as number), bb.lower).map(d => ({ time: d.time as Time, value: d.value })));
        }
    }, [chartData.length, indicatorConfig.sma?.enabled, indicatorConfig.ema?.enabled, indicatorConfig.bollingerBands?.enabled]);

    // Handle tool selection
    const handleToolSelect = useCallback((tool: DrawingTool) => {
        setSelectedTool(tool);
        if (drawingManagerRef.current) {
            drawingManagerRef.current.setTool(tool);
        }
    }, []);

    // Handle zoom
    const handleZoomIn = useCallback(() => {
        if (mainChartRef.current) {
            const timeScale = mainChartRef.current.timeScale();
            const currentBarSpacing = timeScale.options().barSpacing;
            timeScale.applyOptions({ barSpacing: Math.min(currentBarSpacing * 1.2, 50) });
        }
    }, []);

    const handleZoomOut = useCallback(() => {
        if (mainChartRef.current) {
            const timeScale = mainChartRef.current.timeScale();
            const currentBarSpacing = timeScale.options().barSpacing;
            timeScale.applyOptions({ barSpacing: Math.max(currentBarSpacing / 1.2, 2) });
        }
    }, []);

    // Handle clear drawings
    const handleClearDrawings = useCallback(() => {
        if (drawingManagerRef.current) {
            drawingManagerRef.current.clearAllDrawings();
            setDrawings([]);
        }
    }, []);

    return (
        <div className={cn('flex bg-[#0a0a0f] rounded-lg overflow-hidden', className)}>
            {/* Drawing Tools Sidebar */}
            {showDrawingTools && (
                <DrawingToolsSidebar
                    selectedTool={selectedTool}
                    onToolSelect={handleToolSelect}
                    onZoomIn={handleZoomIn}
                    onZoomOut={handleZoomOut}
                    onClearDrawings={handleClearDrawings}
                />
            )}

            {/* Charts Container */}
            <div className="flex-1 flex flex-col">
                {/* Connection Status */}
                {wsStatus !== 'connected' && (
                    <div className="px-2 py-1 text-xs bg-yellow-500/10 text-yellow-400 border-b border-yellow-500/20">
                        {wsStatus === 'connecting' ? 'Connecting to market data...' :
                            wsStatus === 'error' ? 'Connection error - retrying...' : 'Disconnected'}
                    </div>
                )}

                {/* Main Chart */}
                <div
                    ref={mainChartContainerRef}
                    className="w-full"
                    style={{ height: mainChartHeight }}
                />

                {/* RSI Indicator Pane */}
                {indicatorConfig.rsi?.enabled && chartData.length >= 20 && (
                    <RSIPane
                        data={chartData}
                        period={indicatorConfig.rsi.period}
                        height={rsiHeight}
                        theme={theme}
                        mainChart={mainChartRef.current}
                    />
                )}

                {/* MACD Indicator Pane */}
                {indicatorConfig.macd?.enabled && chartData.length >= 30 && (
                    <MACDPane
                        data={chartData}
                        fast={indicatorConfig.macd.fast}
                        slow={indicatorConfig.macd.slow}
                        signal={indicatorConfig.macd.signal}
                        height={macdHeight}
                        theme={theme}
                        mainChart={mainChartRef.current}
                    />
                )}
            </div>
        </div>
    );
}

// RSI Indicator Pane
interface ChartDataPoint {
    time: Time;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

interface RSIPaneProps {
    data: ChartDataPoint[];
    period: number;
    height: number;
    theme: 'dark' | 'light';
    mainChart: IChartApi | null;
}

function RSIPane({ data, period, height, theme, mainChart }: RSIPaneProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const colors = COLORS[theme];

    useEffect(() => {
        if (!containerRef.current || data.length < period) return;

        if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
        }

        const chart = createChart(containerRef.current, {
            layout: {
                background: { color: colors.background },
                textColor: colors.text,
            },
            grid: {
                vertLines: { color: colors.grid },
                horzLines: { color: colors.grid },
            },
            width: containerRef.current.clientWidth,
            height: height - 24,
            rightPriceScale: {
                visible: true,
                borderVisible: true,
                scaleMargins: { top: 0.1, bottom: 0.1 },
            },
            timeScale: { visible: false },
        });

        chartRef.current = chart;

        const closes = data.map(d => d.close);
        const rsiValues = calculateRSI(closes, period);
        const rsiData = toChartData(data.map(d => d.time as number), rsiValues);

        // RSI line
        const rsiSeries = chart.addSeries(LineSeries, {
            color: INDICATOR_COLORS.rsi,
            lineWidth: 2,
            lastValueVisible: true,
            priceLineVisible: false,
        });
        rsiSeries.setData(rsiData.map(d => ({ time: d.time as Time, value: d.value })));

        // Overbought line (70)
        const overboughtSeries = chart.addSeries(LineSeries, {
            color: 'rgba(239, 68, 68, 0.5)',
            lineWidth: 1,
            lineStyle: 2,
            lastValueVisible: false,
            priceLineVisible: false,
        });
        overboughtSeries.setData(data.map(d => ({ time: d.time, value: 70 })));

        // Oversold line (30)
        const oversoldSeries = chart.addSeries(LineSeries, {
            color: 'rgba(34, 197, 94, 0.5)',
            lineWidth: 1,
            lineStyle: 2,
            lastValueVisible: false,
            priceLineVisible: false,
        });
        oversoldSeries.setData(data.map(d => ({ time: d.time, value: 30 })));

        // Sync time scale with main chart
        if (mainChart) {
            mainChart.timeScale().subscribeVisibleTimeRangeChange(() => {
                const range = mainChart.timeScale().getVisibleRange();
                if (range) {
                    chart.timeScale().setVisibleRange(range);
                }
            });
        }

        const handleResize = () => {
            if (containerRef.current && chartRef.current) {
                chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (chartRef.current) {
                chartRef.current.remove();
            }
        };
    }, [data, period, height, theme, mainChart, colors]);

    return (
        <div className="border-t border-white/5">
            <div className="px-2 py-1 text-xs text-white/50 bg-[#0d0d12]">
                RSI ({period})
            </div>
            <div ref={containerRef} className="w-full" />
        </div>
    );
}

// MACD Indicator Pane
interface MACDPaneProps {
    data: ChartDataPoint[];
    fast: number;
    slow: number;
    signal: number;
    height: number;
    theme: 'dark' | 'light';
    mainChart: IChartApi | null;
}

function MACDPane({ data, fast, slow, signal, height, theme, mainChart }: MACDPaneProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const colors = COLORS[theme];

    useEffect(() => {
        if (!containerRef.current || data.length < slow) return;

        if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
        }

        const chart = createChart(containerRef.current, {
            layout: {
                background: { color: colors.background },
                textColor: colors.text,
            },
            grid: {
                vertLines: { color: colors.grid },
                horzLines: { color: colors.grid },
            },
            width: containerRef.current.clientWidth,
            height: height - 24,
            rightPriceScale: {
                visible: true,
                borderVisible: true,
                scaleMargins: { top: 0.1, bottom: 0.1 },
            },
            timeScale: { visible: false },
        });

        chartRef.current = chart;

        const closes = data.map(d => d.close);
        const macdResult = calculateMACD(closes, fast, slow, signal);
        const times = data.map(d => d.time as number);

        // MACD histogram
        const histogramSeries = chart.addSeries(HistogramSeries, {
            priceFormat: { type: 'price', precision: 8, minMove: 0.00000001 },
            priceScaleId: 'macd',
        });

        const histogramData = toChartData(times, macdResult.histogram).map(d => ({
            time: d.time as Time,
            value: d.value,
            color: d.value >= 0 ? INDICATOR_COLORS.macdHistogramUp : INDICATOR_COLORS.macdHistogramDown,
        }));
        histogramSeries.setData(histogramData);

        // MACD line
        const macdSeries = chart.addSeries(LineSeries, {
            color: INDICATOR_COLORS.macd,
            lineWidth: 2,
            priceScaleId: 'macd',
            lastValueVisible: true,
            priceLineVisible: false,
        });
        macdSeries.setData(toChartData(times, macdResult.macd).map(d => ({ time: d.time as Time, value: d.value })));

        // Signal line
        const signalSeries = chart.addSeries(LineSeries, {
            color: INDICATOR_COLORS.macdSignal,
            lineWidth: 2,
            priceScaleId: 'macd',
            lastValueVisible: false,
            priceLineVisible: false,
        });
        signalSeries.setData(toChartData(times, macdResult.signal).map(d => ({ time: d.time as Time, value: d.value })));

        // Sync time scale
        if (mainChart) {
            mainChart.timeScale().subscribeVisibleTimeRangeChange(() => {
                const range = mainChart.timeScale().getVisibleRange();
                if (range) {
                    chart.timeScale().setVisibleRange(range);
                }
            });
        }

        const handleResize = () => {
            if (containerRef.current && chartRef.current) {
                chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (chartRef.current) {
                chartRef.current.remove();
            }
        };
    }, [data, fast, slow, signal, height, theme, mainChart, colors]);

    return (
        <div className="border-t border-white/5">
            <div className="px-2 py-1 text-xs text-white/50 bg-[#0d0d12]">
                MACD ({fast}, {slow}, {signal})
            </div>
            <div ref={containerRef} className="w-full" />
        </div>
    );
}
