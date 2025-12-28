import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    ChevronDown,
    BarChart2,
    LayoutGrid,
    TrendingUp,
    Settings,
} from 'lucide-react';

interface ChartToolbarProps {
    timeframe: string;
    onTimeframeChange: (tf: string) => void;
    showBubbles: boolean;
    onBubblesToggle: () => void;
    displayMode: 'price' | 'marketCap';
    onDisplayModeChange: (mode: 'price' | 'marketCap') => void;
    currencyMode?: 'usd' | 'sol';
    onCurrencyChange?: (mode: 'usd' | 'sol') => void;
    symbol?: string;
    className?: string;
}

const TIMEFRAMES = ['1m', '3m', '5m', '15m', '30m', '1H', '4H', '1D', '1W'];

export default function ChartToolbar({
    timeframe,
    onTimeframeChange,
    showBubbles,
    onBubblesToggle,
    displayMode,
    onDisplayModeChange,
    currencyMode = 'usd',
    onCurrencyChange,
    className,
}: ChartToolbarProps) {
    const [showTimeframes, setShowTimeframes] = React.useState(false);

    return (
        <div
            className={cn(
                'flex items-center gap-1 px-2 py-1.5 bg-[#0d0d12] border-b border-white/5',
                className
            )}
        >
            {/* Timeframe Selector */}
            <div className="relative">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowTimeframes(!showTimeframes)}
                    className="h-7 px-2 text-xs font-medium text-white/80 hover:text-white hover:bg-white/5"
                >
                    {timeframe}
                    <ChevronDown className="ml-1 h-3 w-3" />
                </Button>
                {showTimeframes && (
                    <div className="absolute top-full left-0 mt-1 bg-[#1a1a24] border border-white/10 rounded-md shadow-lg z-50 min-w-[80px]">
                        {TIMEFRAMES.map((tf) => (
                            <button
                                key={tf}
                                onClick={() => {
                                    onTimeframeChange(tf);
                                    setShowTimeframes(false);
                                }}
                                className={cn(
                                    'block w-full text-left px-3 py-1.5 text-xs cursor-pointer hover:bg-white/5',
                                    timeframe === tf
                                        ? 'bg-cyan-500/20 text-cyan-400'
                                        : 'text-white/70 hover:text-white'
                                )}
                            >
                                {tf}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="w-px h-4 bg-white/10" />

            {/* Indicators Button */}
            <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs font-medium text-white/60 hover:text-white hover:bg-white/5"
            >
                <BarChart2 className="h-3.5 w-3.5 mr-1" />
                Indicators
            </Button>

            <div className="w-px h-4 bg-white/10" />

            {/* Display Options */}
            <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs font-medium text-white/60 hover:text-white hover:bg-white/5"
            >
                <LayoutGrid className="h-3.5 w-3.5 mr-1" />
                Display
                <ChevronDown className="ml-1 h-3 w-3" />
            </Button>

            <div className="w-px h-4 bg-white/10" />

            {/* Hide Bubbles Toggle */}
            <Button
                variant="ghost"
                size="sm"
                onClick={onBubblesToggle}
                className={cn(
                    'h-7 px-2 text-xs font-medium hover:bg-white/5',
                    showBubbles ? 'text-white/60' : 'text-cyan-400'
                )}
            >
                {showBubbles ? 'Hide Bubbles' : 'Show Bubbles'}
            </Button>

            <div className="w-px h-4 bg-white/10" />

            {/* USD/SOL Toggle */}
            {onCurrencyChange && (
                <>
                    <div className="flex items-center bg-white/5 rounded-md">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onCurrencyChange('usd')}
                            className={cn(
                                'h-7 px-2 text-xs font-medium rounded-r-none',
                                currencyMode === 'usd'
                                    ? 'bg-cyan-500/20 text-cyan-400'
                                    : 'text-white/60 hover:text-white'
                            )}
                        >
                            USD
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onCurrencyChange('sol')}
                            className={cn(
                                'h-7 px-2 text-xs font-medium rounded-l-none border-l border-white/10',
                                currencyMode === 'sol'
                                    ? 'bg-cyan-500/20 text-cyan-400'
                                    : 'text-white/60 hover:text-white'
                            )}
                        >
                            SOL
                        </Button>
                    </div>

                    <div className="w-px h-4 bg-white/10" />
                </>
            )}

            {/* MarketCap/Price Toggle */}
            <div className="flex items-center bg-white/5 rounded-md">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDisplayModeChange('marketCap')}
                    className={cn(
                        'h-7 px-2 text-xs font-medium rounded-r-none',
                        displayMode === 'marketCap'
                            ? 'bg-cyan-500/20 text-cyan-400'
                            : 'text-white/60 hover:text-white'
                    )}
                >
                    MarketCap
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDisplayModeChange('price')}
                    className={cn(
                        'h-7 px-2 text-xs font-medium rounded-l-none border-l border-white/10',
                        displayMode === 'price'
                            ? 'bg-cyan-500/20 text-cyan-400'
                            : 'text-white/60 hover:text-white'
                    )}
                >
                    Price
                </Button>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Right side controls */}
            <div className="flex items-center gap-1">
                {/* Settings */}
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-white/60 hover:text-white hover:bg-white/5"
                >
                    <Settings className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    );
}
