import React from 'react';
import { cn } from '@/lib/utils';
import { 
  LineChart as LineChartIcon, 
  BarChart3, 
  Grid3x3,
  Settings,
  Maximize,
  Minimize,
  ChevronDown,
  Eye,
  EyeOff
} from 'lucide-react';
import { TIMEFRAMES, type Timeframe } from '../TimeframeSelector';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ChartToolbarProps {
  pair: string;
  exchange?: string;
  selectedTimeframe: Timeframe;
  onTimeframeChange: (timeframe: Timeframe) => void;
  chartType: 'line' | 'candlestick';
  onChartTypeChange: (type: 'line' | 'candlestick') => void;
  currencyMode?: 'usd' | 'sol';
  onCurrencyModeChange?: (mode: 'usd' | 'sol') => void;
  displayMode?: 'price' | 'marketCap';
  onDisplayModeChange?: (mode: 'price' | 'marketCap') => void;
  showBubbles?: boolean;
  onToggleBubbles?: () => void;
  quoteSymbol?: string;
  isFullscreen?: boolean;
  onFullscreenClick?: () => void;
  onSettingsClick?: () => void;
  theme?: 'dark' | 'light';
  className?: string;
}

// Axiom-style timeframes
const AXIOM_TIMEFRAMES = ['1s', '3m', '1m', '5d', '1d'];

export default function ChartToolbar({
  pair,
  exchange = 'Pump AMM',
  selectedTimeframe,
  onTimeframeChange,
  chartType,
  onChartTypeChange,
  currencyMode = 'usd',
  onCurrencyModeChange,
  displayMode = 'marketCap',
  onDisplayModeChange,
  showBubbles = true,
  onToggleBubbles,
  quoteSymbol = 'SOL',
  isFullscreen = false,
  onFullscreenClick,
  onSettingsClick,
  theme = 'dark',
  className,
}: ChartToolbarProps) {
  const isDark = theme === 'dark';

  const buttonBase = cn(
    "px-2.5 py-1.5 rounded text-xs font-medium transition-colors",
    isDark
      ? "text-gray-400 hover:text-white hover:bg-[#1f2937]"
      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
  );

  const buttonActive = cn(
    "px-2.5 py-1.5 rounded text-xs font-medium",
    isDark
      ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
      : "bg-blue-100 text-blue-700 border border-blue-300"
  );

  const iconButton = cn(
    "p-1.5 rounded transition-colors",
    isDark
      ? "text-gray-400 hover:text-white hover:bg-[#1f2937]"
      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
  );

  return (
    <div className={cn(
      "flex items-center gap-2 px-4 py-2 border-b",
      isDark ? "bg-[#0a0e17] border-[#1f2937]" : "bg-white border-gray-200",
      className
    )}>
      {/* Timeframe Selector */}
      <div className="flex items-center gap-0.5">
        {AXIOM_TIMEFRAMES.map((tf) => {
          const isSelected = selectedTimeframe.label.toLowerCase() === tf || 
            (tf === '1d' && selectedTimeframe.label === '1D');
          return (
            <button
              key={tf}
              onClick={() => {
                const mapped = TIMEFRAMES.find(t => 
                  t.label.toLowerCase() === tf || (tf === '1d' && t.label === '1D')
                ) || TIMEFRAMES[0];
                onTimeframeChange(mapped);
              }}
              className={isSelected ? buttonActive : buttonBase}
            >
              {tf}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className={cn("w-px h-5", isDark ? "bg-[#1f2937]" : "bg-gray-200")} />

      {/* Indicators Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger className={cn(buttonBase, "flex items-center gap-1")}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Indicators
          <ChevronDown className="w-3 h-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className={isDark ? "bg-[#1a1f2e] border-[#1f2937]" : ""}>
          <DropdownMenuItem className={isDark ? "text-gray-300 hover:bg-[#252b3d]" : ""}>
            Moving Average
          </DropdownMenuItem>
          <DropdownMenuItem className={isDark ? "text-gray-300 hover:bg-[#252b3d]" : ""}>
            RSI
          </DropdownMenuItem>
          <DropdownMenuItem className={isDark ? "text-gray-300 hover:bg-[#252b3d]" : ""}>
            MACD
          </DropdownMenuItem>
          <DropdownMenuItem className={isDark ? "text-gray-300 hover:bg-[#252b3d]" : ""}>
            Bollinger Bands
          </DropdownMenuItem>
          <DropdownMenuItem className={isDark ? "text-gray-300 hover:bg-[#252b3d]" : ""}>
            Volume Profile
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Display Options */}
      <DropdownMenu>
        <DropdownMenuTrigger className={cn(buttonBase, "flex items-center gap-1")}>
          <Grid3x3 className="w-4 h-4" />
          Display Options
          <ChevronDown className="w-3 h-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className={isDark ? "bg-[#1a1f2e] border-[#1f2937]" : ""}>
          <DropdownMenuItem className={isDark ? "text-gray-300 hover:bg-[#252b3d]" : ""}>
            Show Grid
          </DropdownMenuItem>
          <DropdownMenuItem className={isDark ? "text-gray-300 hover:bg-[#252b3d]" : ""}>
            Show Volume
          </DropdownMenuItem>
          <DropdownMenuItem className={isDark ? "text-gray-300 hover:bg-[#252b3d]" : ""}>
            Show Trades
          </DropdownMenuItem>
          <DropdownMenuItem className={isDark ? "text-gray-300 hover:bg-[#252b3d]" : ""}>
            Show Orders
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Hide All Bubbles */}
      <button
        onClick={onToggleBubbles}
        className={cn(buttonBase, "flex items-center gap-1")}
      >
        {showBubbles ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        {showBubbles ? 'Hide All Bubbles' : 'Show Bubbles'}
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* USD/SOL Toggle */}
      <button
        onClick={() => onCurrencyModeChange?.(currencyMode === 'usd' ? 'sol' : 'usd')}
        className={cn(
          "px-3 py-1.5 rounded text-xs font-medium transition-colors border",
          isDark
            ? "border-[#1f2937] text-gray-300 hover:bg-[#1f2937]"
            : "border-gray-200 text-gray-700 hover:bg-gray-100"
        )}
      >
        {currencyMode === 'usd' ? 'USD' : quoteSymbol}/{currencyMode === 'usd' ? quoteSymbol : 'USD'}
      </button>

      {/* MarketCap/Price Toggle */}
      <button
        onClick={() => onDisplayModeChange?.(displayMode === 'marketCap' ? 'price' : 'marketCap')}
        className={cn(
          "px-3 py-1.5 rounded text-xs font-medium transition-colors border",
          isDark
            ? "border-[#1f2937] text-gray-300 hover:bg-[#1f2937]"
            : "border-gray-200 text-gray-700 hover:bg-gray-100"
        )}
      >
        {displayMode === 'marketCap' ? 'MarketCap' : 'Price'}/{displayMode === 'marketCap' ? 'Price' : 'MarketCap'}
      </button>

      {/* Divider */}
      <div className={cn("w-px h-5", isDark ? "bg-[#1f2937]" : "bg-gray-200")} />

      {/* Chart Type Toggle */}
      <button
        onClick={() => onChartTypeChange(chartType === 'line' ? 'candlestick' : 'line')}
        className={iconButton}
        title={chartType === 'line' ? 'Switch to Candlesticks' : 'Switch to Line'}
      >
        {chartType === 'line' ? (
          <BarChart3 className="w-4 h-4" />
        ) : (
          <LineChartIcon className="w-4 h-4" />
        )}
      </button>

      {/* Fullscreen */}
      {onFullscreenClick && (
        <button
          onClick={onFullscreenClick}
          className={iconButton}
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? (
            <Minimize className="w-4 h-4" />
          ) : (
            <Maximize className="w-4 h-4" />
          )}
        </button>
      )}

      {/* Settings */}
      {onSettingsClick && (
        <button
          onClick={onSettingsClick}
          className={iconButton}
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
