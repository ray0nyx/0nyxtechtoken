import React, { useEffect, useRef, memo } from 'react';

interface TradingViewAdvancedChartProps {
    symbol: string;
    interval?: string;
    theme?: 'dark' | 'light';
    height?: string | number;
    autosize?: boolean;
    hideTopToolbar?: boolean;
    hideSideToolbar?: boolean;
    allowSymbolChange?: boolean;
    saveImage?: boolean;
    enablePublishing?: boolean;
    withdateranges?: boolean;
    details?: boolean;
    hotlist?: boolean;
    calendar?: boolean;
    studies?: string[];
    showIntervalTabs?: boolean;
    locale?: string;
    className?: string;
}

/**
 * TradingView Advanced Chart Widget
 * 
 * This component embeds the full TradingView Advanced Chart with all native features including:
 * - Drawing tools sidebar (trend lines, fib retracements, shapes, text, etc.)
 * - Technical indicators
 * - Multiple timeframes
 * - Full charting experience
 * 
 * Note: Only works for symbols TradingView supports. For DEX tokens that aren't on TradingView,
 * use TradingViewLightweightChart instead.
 */
function TradingViewAdvancedChart({
    symbol = 'BTCUSDT',
    interval = 'D',
    theme = 'dark',
    height = '100%',
    autosize = true,
    hideTopToolbar = false,
    hideSideToolbar = false, // Set to false to show drawing tools!
    allowSymbolChange = true,
    saveImage = true,
    enablePublishing = false,
    withdateranges = true,
    details = true,
    hotlist = true,
    calendar = false,
    studies = [],
    showIntervalTabs = true,
    locale = 'en',
    className = '',
}: TradingViewAdvancedChartProps) {
    const container = useRef<HTMLDivElement>(null);
    const scriptRef = useRef<HTMLScriptElement | null>(null);

    useEffect(() => {
        if (!container.current) return;

        // Clear previous content
        container.current.innerHTML = '';

        // Create widget container
        const widgetContainer = document.createElement('div');
        widgetContainer.className = 'tradingview-widget-container__widget';
        widgetContainer.style.height = typeof height === 'number' ? `${height}px` : height;
        widgetContainer.style.width = '100%';
        container.current.appendChild(widgetContainer);

        // Create script
        const script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
        script.type = 'text/javascript';
        script.async = true;

        // Widget configuration - Axiom/Tradovate style
        const config = {
            autosize,
            symbol: symbol,
            interval: interval,
            timezone: 'Etc/UTC',
            theme: theme,
            style: '1', // Candlesticks
            locale: locale,
            enable_publishing: enablePublishing,
            hide_top_toolbar: hideTopToolbar,
            hide_side_toolbar: hideSideToolbar, // false = show drawing tools sidebar
            allow_symbol_change: allowSymbolChange,
            save_image: saveImage,
            withdateranges: withdateranges,
            details: details,
            hotlist: hotlist,
            calendar: calendar,
            show_popup_button: true,
            popup_width: '1000',
            popup_height: '650',
            // Axiom-style dark theme colors
            backgroundColor: theme === 'dark' ? 'rgba(10, 10, 15, 1)' : 'rgba(255, 255, 255, 1)',
            gridColor: theme === 'dark' ? 'rgba(26, 26, 36, 0.5)' : 'rgba(234, 234, 234, 1)',
            // Studies/indicators to load by default
            studies: studies.length > 0 ? studies : [
                'Volume@tv-basicstudies',
            ],
            // Support host
            support_host: 'https://www.tradingview.com',
        };

        script.innerHTML = JSON.stringify(config);
        scriptRef.current = script;
        container.current.appendChild(script);

        return () => {
            if (container.current) {
                container.current.innerHTML = '';
            }
        };
    }, [
        symbol,
        interval,
        theme,
        autosize,
        hideTopToolbar,
        hideSideToolbar,
        allowSymbolChange,
        saveImage,
        enablePublishing,
        withdateranges,
        details,
        hotlist,
        calendar,
        locale,
        height,
        studies,
    ]);

    return (
        <div
            ref={container}
            className={`tradingview-widget-container ${className}`}
            style={{
                height: typeof height === 'number' ? `${height}px` : height,
                width: '100%',
                position: 'relative',
                backgroundColor: theme === 'dark' ? '#0a0a0f' : '#ffffff',
            }}
        />
    );
}

export default memo(TradingViewAdvancedChart);

// Helper to convert common symbols to TradingView format
export function toTradingViewSymbol(symbol: string, exchange?: string): string {
    // Handle common crypto pairs
    const upperSymbol = symbol.toUpperCase();

    // If it's a Solana token address, we can't use TradingView (no support)
    if (symbol.length > 30) {
        return ''; // Return empty - use lightweight chart instead
    }

    // Common mappings
    if (upperSymbol.includes('SOL') && !upperSymbol.includes('USDT')) {
        return 'BINANCE:SOLUSDT';
    }
    if (upperSymbol === 'BTC' || upperSymbol.includes('BTC')) {
        return 'BINANCE:BTCUSDT';
    }
    if (upperSymbol === 'ETH' || upperSymbol.includes('ETH')) {
        return 'BINANCE:ETHUSDT';
    }

    // Try to build a Binance pair
    if (!upperSymbol.includes(':')) {
        if (upperSymbol.endsWith('USDT') || upperSymbol.endsWith('USD')) {
            return `BINANCE:${upperSymbol}`;
        }
        return `BINANCE:${upperSymbol}USDT`;
    }

    return symbol;
}
