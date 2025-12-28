import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import TradingViewLightweightChart, {
    type RealtimeCandleUpdate,
    type OrderLine
} from '../TradingViewLightweightChart';
import ChartToolbar from './ChartToolbar';
import OHLCInfoBar from './OHLCInfoBar';
import DrawingToolsSidebar from './DrawingToolsSidebar';

interface OHLCVData {
    time: string | number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
}

interface AxiomStyleChartProps {
    data: OHLCVData[];
    symbol?: string;
    exchange?: string;
    timeframe: string;
    onTimeframeChange: (tf: string) => void;
    height?: number;
    realTimePrice?: number;
    realtimeCandle?: RealtimeCandleUpdate | null;
    displayMode?: 'price' | 'marketCap';
    onDisplayModeChange?: (mode: 'price' | 'marketCap') => void;
    currencyMode?: 'usd' | 'sol';
    onCurrencyChange?: (mode: 'usd' | 'sol') => void;
    marketCap?: string;
    tokenPrice?: number;
    orders?: OrderLine[];
    onOrderDrag?: (orderId: string, newPrice: number) => void;
    onOrderCancel?: (orderId: string) => void;
    onPriceUpdate?: (price: number) => void;
    className?: string;
}

export default function AxiomStyleChart({
    data,
    symbol = '',
    exchange = 'DEX',
    timeframe,
    onTimeframeChange,
    height = 500,
    realTimePrice,
    realtimeCandle,
    displayMode = 'price',
    onDisplayModeChange,
    currencyMode = 'usd',
    onCurrencyChange,
    marketCap,
    tokenPrice,
    orders = [],
    onOrderDrag,
    onOrderCancel,
    onPriceUpdate,
    className,
}: AxiomStyleChartProps) {
    const [showBubbles, setShowBubbles] = useState(true);
    const [selectedTool, setSelectedTool] = useState('cursor');
    const [internalDisplayMode, setInternalDisplayMode] = useState<'price' | 'marketCap'>(displayMode);

    // Get latest candle data for OHLC display
    const latestCandle = data.length > 0 ? data[data.length - 1] : null;
    const previousCandle = data.length > 1 ? data[data.length - 2] : null;

    // Calculate change from previous candle
    const change = latestCandle && previousCandle
        ? latestCandle.close - previousCandle.close
        : 0;
    const changePercent = previousCandle && previousCandle.close > 0
        ? (change / previousCandle.close) * 100
        : 0;

    // Handle display mode change
    const handleDisplayModeChange = useCallback((mode: 'price' | 'marketCap') => {
        setInternalDisplayMode(mode);
        onDisplayModeChange?.(mode);
    }, [onDisplayModeChange]);

    // Handle zoom
    const handleZoomIn = useCallback(() => {
        // TODO: Implement chart zoom via chart API
        console.log('Zoom in');
    }, []);

    const handleZoomOut = useCallback(() => {
        // TODO: Implement chart zoom via chart API
        console.log('Zoom out');
    }, []);

    const currentDisplayMode = onDisplayModeChange ? displayMode : internalDisplayMode;

    return (
        <div className={cn('flex flex-col bg-[#0a0a0f] rounded-lg overflow-hidden', className)}>
            {/* Top Toolbar */}
            <ChartToolbar
                timeframe={timeframe}
                onTimeframeChange={onTimeframeChange}
                showBubbles={showBubbles}
                onBubblesToggle={() => setShowBubbles(!showBubbles)}
                displayMode={currentDisplayMode}
                onDisplayModeChange={handleDisplayModeChange}
                currencyMode={currencyMode}
                onCurrencyChange={onCurrencyChange}
                symbol={symbol}
            />

            {/* OHLC Info Bar */}
            <OHLCInfoBar
                symbol={symbol}
                exchange={exchange}
                open={latestCandle?.open}
                high={latestCandle?.high}
                low={latestCandle?.low}
                close={realTimePrice ?? latestCandle?.close}
                change={change}
                changePercent={changePercent}
                volume={latestCandle?.volume}
                displayMode={currentDisplayMode}
            />

            {/* Main Chart Area */}
            <div className="flex flex-1">
                {/* Left Sidebar - Drawing Tools */}
                <DrawingToolsSidebar
                    selectedTool={selectedTool}
                    onToolSelect={setSelectedTool}
                    onZoomIn={handleZoomIn}
                    onZoomOut={handleZoomOut}
                />

                {/* Chart */}
                <div className="flex-1 relative">
                    <TradingViewLightweightChart
                        data={data}
                        symbol={symbol}
                        height={height - 72} // Account for toolbar + OHLC bar
                        showVolume={true}
                        showGrid={true}
                        theme="dark"
                        realTimePrice={realTimePrice}
                        realtimeCandle={realtimeCandle}
                        displayMode={currentDisplayMode}
                        marketCap={marketCap}
                        tokenPrice={tokenPrice}
                        orders={orders}
                        onOrderDrag={onOrderDrag}
                        onOrderCancel={onOrderCancel}
                        onPriceUpdate={onPriceUpdate}
                    />
                </div>
            </div>

            {/* Bottom Bar - Timeframe Shortcuts (optional) */}
            <div className="flex items-center justify-between px-3 py-1 bg-[#0d0d12] border-t border-white/5 text-[10px] text-white/40">
                <div className="flex items-center gap-2">
                    {/* Quick timeframes */}
                    {['1m', '5m', '15m', '1H', '4H', '1D'].map((tf) => (
                        <button
                            key={tf}
                            onClick={() => onTimeframeChange(tf)}
                            className={cn(
                                'px-1.5 py-0.5 rounded hover:bg-white/5',
                                timeframe === tf ? 'text-cyan-400 bg-cyan-400/10' : ''
                            )}
                        >
                            {tf}
                        </button>
                    ))}
                </div>

                {/* Timezone */}
                <div className="flex items-center gap-2">
                    <span>
                        {new Date().toLocaleTimeString('en-US', {
                            hour12: false,
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                        })}
                    </span>
                    <span className="text-white/30">
                        ({Intl.DateTimeFormat().resolvedOptions().timeZone})
                    </span>
                    <span className="text-white/20">%</span>
                    <span className="text-white/20">log</span>
                    <span className="text-white/20">auto</span>
                </div>
            </div>
        </div>
    );
}
