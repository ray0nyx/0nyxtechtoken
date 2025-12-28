import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, CandlestickSeries, LineSeries, SeriesMarkerPosition, SeriesMarkerShape, CrosshairMode } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, Time, SeriesOptionsMap, SeriesType } from 'lightweight-charts';
import { restClient } from '@polygon.io/client-js';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { format, subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Play, Pause, RotateCcw, FastForward, Rewind, Clock, ArrowLeft, Search, ChevronUp, ChevronDown, ZoomIn, Crosshair, Download, Settings, Activity, Brain } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RSI, SMA, EMA, MACD, BollingerBands } from 'technicalindicators';
import { EnhancedDataService } from '@/services/enhancedDataService';
import { AdvancedRiskManager } from './AdvancedRiskManager';
import { AdvancedStrategyBuilder } from './AdvancedStrategyBuilder';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Slider } from "@/components/ui/slider";
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/components/ThemeProvider';

// List of available symbols on the free Polygon plan
const AVAILABLE_SYMBOLS = {
  stocks: [
    // Major Tech
    'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'META', 'TSLA', 'NVDA',
    // Semiconductors
    'AMD', 'INTC', 'TSM', 'AVGO', 'QCOM', 'TXN', 'MU', 'AMAT',
    // Financial
    'JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'AXP', 'V', 'MA', 'PYPL', 'SQ',
    // Healthcare
    'JNJ', 'PFE', 'MRK', 'ABBV', 'BMY', 'UNH', 'CVS', 'GILD', 'MRNA', 'BNTX',
    // Retail
    'TGT', 'COST', 'HD', 'LOW', 'EBAY', 'SHOP', 'BABA', 'WMT',
    // Communication
    'T', 'VZ', 'TMUS', 'CMCSA', 'NFLX', 'DIS', 'ROKU',
    // Consumer Goods
    'KO', 'PEP', 'PG', 'CL', 'MCD', 'SBUX', 'NKE', 'LULU',
    // Industrial
    'BA', 'GE', 'CAT', 'DE', 'MMM', 'HON', 'LMT', 'RTX',
    // Energy
    'XOM', 'CVX', 'COP', 'BP', 'SLB', 'EOG', 'OXY',
    // Trending/Popular
    'GME', 'AMC', 'PLTR', 'COIN', 'RBLX', 'SNOW', 'ABNB', 'ZM', 'UBER', 'LYFT',
    // EV Related
    'RIVN', 'LCID', 'NIO', 'F', 'GM',
    // AI Related
    'CRM', 'PATH', 'U'
  ],
  etfs: [
    // Major Index ETFs
    'SPY', 'QQQ', 'IWM', 'DIA', 'VTI',
    // Sector ETFs
    'XLF', 'XLE', 'XLK', 'XLV', 'XLI', 'XLU', 'XLP', 'XLB', 'XLY', 'XLRE', 'XLC',
    // Bond ETFs
    'TLT', 'IEF', 'SHY', 'HYG', 'LQD', 'AGG',
    // Commodity ETFs
    'GLD', 'SLV', 'USO', 'UNG', 'DBC',
    // Volatility ETFs
    'VXX', 'UVXY',
    // Leveraged ETFs
    'TQQQ', 'SQQQ', 'UPRO', 'SPXU', 'TNA', 'TZA',
    // International ETFs
    'EFA', 'EEM', 'FXI', 'EWJ', 'EWZ'
  ],
  indices: [
    'SPX', 'NDX', 'RUT', 'DJI', 'VIX', 'OEX', 'MID', 'COMPQ', 'NYA', 'XAU'
  ],
  forex: [
    // Major pairs
    'EUR-USD', 'GBP-USD', 'USD-JPY', 'AUD-USD', 'USD-CAD', 'USD-CHF', 'NZD-USD',
    // Cross rates
    'EUR-GBP', 'EUR-JPY', 'GBP-JPY', 'AUD-JPY', 'EUR-AUD', 'EUR-CHF',
    // Exotic pairs
    'USD-MXN', 'USD-ZAR', 'USD-TRY', 'USD-SGD', 'USD-HKD'
  ],
  crypto: [
    // Major cryptocurrencies
    'BTC-USD', 'ETH-USD', 'SOL-USD', 'BNB-USD', 'XRP-USD', 'ADA-USD', 'DOGE-USD',
    'DOT-USD', 'MATIC-USD', 'SHIB-USD', 'AVAX-USD', 'LTC-USD', 'LINK-USD', 'UNI-USD',
    'ATOM-USD', 'XLM-USD', 'ALGO-USD', 'FIL-USD', 'AAVE-USD', 'COMP-USD',
    // Stablecoins
    'USDT-USD', 'USDC-USD', 'DAI-USD', 'BUSD-USD',
    // DeFi tokens
    'MKR-USD', 'SNX-USD', 'YFI-USD', 'SUSHI-USD', 'CRV-USD', '1INCH-USD',
    // Exchange tokens
    'CRO-USD', 'FTT-USD', 'LEO-USD', 'HT-USD', 'KCS-USD',
    // Layer 1/2 blockchains
    'NEAR-USD', 'FLOW-USD', 'FTM-USD', 'ONE-USD', 'HBAR-USD', 'EGLD-USD', 'ICP-USD',
    // Bitcoin to other fiat
    'BTC-EUR', 'BTC-GBP', 'BTC-JPY',
    // Ethereum to other fiat
    'ETH-EUR', 'ETH-GBP', 'ETH-JPY'
  ]
};

// Define timeframe options
const TIMEFRAMES = [
  { label: "1m", value: 1, unit: "minute" },
  { label: "5m", value: 5, unit: "minute" },
  { label: "15m", value: 15, unit: "minute" },
  { label: "30m", value: 30, unit: "minute" },
  { label: "1h", value: 1, unit: "hour" },
  { label: "4h", value: 4, unit: "hour" },
  { label: "1D", value: 1, unit: "day" },
  { label: "1W", value: 1, unit: "week" },
  { label: "1M", value: 1, unit: "month" }
];

interface Trade {
  id: string;
  type: 'buy' | 'sell';
  entryPrice: number;
  entryTime: Date;
  quantity: number;
  stopLoss?: number;
  takeProfit?: number;
  exitPrice?: number;
  exitTime?: Date;
  pnl?: number;
  // Add line IDs for tracking
  entryLineId?: string;
  exitLineId?: string;
  slLineId?: string;
  tpLineId?: string;
}

interface ChartData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

const POLYGON_API_KEY = import.meta.env.VITE_POLYGON_API_KEY;
const rest = restClient(POLYGON_API_KEY);

// Helper functions for formatting tickers
const formatTickerForAPI = (ticker: string, type: 'stocks' | 'etfs' | 'indices' | 'forex' | 'crypto'): string => {
  // Remove any separators first
  const cleanTicker = ticker.replace('-', '');

  if (type === 'forex') {
    // Polygon expects forex with C: prefix (e.g., C:EURUSD)
    return `C:${cleanTicker}`;
  }
  if (type === 'crypto') {
    // Polygon expects crypto with X: prefix (e.g., X:BTCUSD)
    return `X:${cleanTicker}`;
  }
  if (type === 'indices') {
    // Polygon expects indices with I: prefix (e.g., I:SPX)
    return `I:${cleanTicker}`;
  }
  // For stocks and ETFs, just return the ticker as is
  return ticker;
};

const formatTickerForDisplay = (ticker: string, type: 'stocks' | 'etfs' | 'indices' | 'forex' | 'crypto'): string => {
  if (type === 'forex') {
    // Show forex as EUR/USD for display
    return ticker.replace('-', '/');
  }
  if (type === 'crypto') {
    // Show crypto with a nice format: BTC/USD
    return ticker.replace('-', '/');
  }
  return ticker;
};

// Update indicator types
interface Indicator {
  id: string;
  type: 'rsi' | 'sma' | 'ema' | 'macd' | 'bollinger' | 'fibonacci';
  data: any[];
  visible: boolean;
  color: string | {
    line?: string;
    signal?: string;
    histogram?: string;
    upper?: string;
    middle?: string;
    lower?: string;
    level0?: string;
    level236?: string;
    level382?: string;
    level500?: string;
    level618?: string;
    level786?: string;
    level1000?: string;
  };
  settings: {
    period?: number;
    multiplier?: number;
    shortPeriod?: number;
    longPeriod?: number;
    signalPeriod?: number;
  };
}

// Add before the BarReplay component
const DEFAULT_INDICATOR_SETTINGS = {
  rsi: { period: 14 },
  sma: { period: 20 },
  ema: { period: 20 },
  macd: { shortPeriod: 12, longPeriod: 26, signalPeriod: 9 },
  bollinger: { period: 20, multiplier: 2 },
  fibonacci: {}
};

const INDICATOR_COLORS = {
  rsi: '#A020F0',
  sma: '#2962FF',
  ema: '#FF6B6B',
  macd: {
    line: '#2962FF',
    signal: '#FF6B6B',
    histogram: '#B4B4B4'
  },
  bollinger: {
    upper: '#2962FF',
    middle: '#B4B4B4',
    lower: '#2962FF'
  },
  fibonacci: {
    level0: '#FF6B6B',
    level236: '#FFB86C',
    level382: '#50FA7B',
    level500: '#8BE9FD',
    level618: '#BD93F9',
    level786: '#FF79C6',
    level1000: '#FF5555'
  }
};

// Add a minimal type for bar_replay_templates
interface BarReplayTemplate {
  id?: string;
  user_id: string;
  name: string;
  settings: any;
  created_at?: string;
}

export const BarReplay = () => {
  const { theme } = useTheme();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<any | null>(null);
  const markersRef = useRef<any[]>([]);
  const openTradeMarkersRef = useRef<Record<string, any[]>>({});
  const closedTradeMarkersRef = useRef<any[]>([]);
  const markersUpdateRef = useRef<number | null>(null);

  // Add back the combined PnL line ref
  const combinedPnLLineRef = useRef<any>(null);

  const [symbol, setSymbol] = useState('AAPL');
  const [startDate, setStartDate] = useState(subDays(new Date(), 30));
  const [endDate, setEndDate] = useState(new Date());
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1000); // ms between bars
  const [currentIndex, setCurrentIndex] = useState(0);
  const [data, setData] = useState<ChartData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [openTrades, setOpenTrades] = useState<Trade[]>([]);
  const [closedTrades, setClosedTrades] = useState<Trade[]>([]);
  const [totalPnL, setTotalPnL] = useState(0);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [symbolSearch, setSymbolSearch] = useState('');
  const [symbolType, setSymbolType] = useState<'stocks' | 'etfs' | 'indices' | 'forex' | 'crypto'>('stocks');
  const [showSymbolSelector, setShowSymbolSelector] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState(TIMEFRAMES[4]); // Default to 1h
  const [showResults, setShowResults] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectBarMode, setSelectBarMode] = useState(false);
  const [barSelectionMode, setBarSelectionMode] = useState(false);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [indicatorLines, setIndicatorLines] = useState<Record<string, any>>({});

  // Add state for stop loss and take profit
  const [stopLossValue, setStopLossValue] = useState<string>('');
  const [takeProfitValue, setTakeProfitValue] = useState<string>('');
  const [stopLossPreview, setStopLossPreview] = useState<number | null>(null);
  const [takeProfitPreview, setTakeProfitPreview] = useState<number | null>(null);
  const [stopLossPreviewLineId, setStopLossPreviewLineId] = useState<string | null>(null);
  const [takeProfitPreviewLineId, setTakeProfitPreviewLineId] = useState<string | null>(null);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  // 1. Add state for color customization
  const [upColor, setUpColor] = useState('#26a69a');
  const [downColor, setDownColor] = useState('#ef5350');
  const [entryLineColor, setEntryLineColor] = useState('#26a69a');
  const [exitLineColor, setExitLineColor] = useState('#ef5350');
  const [colorDialogOpen, setColorDialogOpen] = useState(false);
  // Add state for axis label colors
  const [priceAxisColor, setPriceAxisColor] = useState('#d1d4dc');
  const [timeAxisColor, setTimeAxisColor] = useState('#d1d4dc');
  // Add state for chart background color
  const [backgroundColor, setBackgroundColor] = useState('#0a0a0a');
  // Add state for grid line colors
  const [vertGridColor, setVertGridColor] = useState('#2B2B43');
  const [horzGridColor, setHorzGridColor] = useState('#2B2B43');
  // Add state for mouse only mode
  const [mouseOnlyMode, setMouseOnlyMode] = useState(false);

  // Add state for template management
  const [templates, setTemplates] = useState<{ [name: string]: any }>({});
  const [manageTemplatesOpen, setManageTemplatesOpen] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [renameTemplateName, setRenameTemplateName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState<string | null>(null);
  const [lastAppliedTemplate, setLastAppliedTemplate] = useState<string | null>(null);

  const [showRiskManager, setShowRiskManager] = useState(false);
  const [showStrategyBuilder, setShowStrategyBuilder] = useState(false);
  const [showAdvancedDashboard, setShowAdvancedDashboard] = useState(false);

  // Filter symbols based on search
  const filteredSymbols = AVAILABLE_SYMBOLS[symbolType]?.filter(sym =>
    sym.toLowerCase().includes(symbolSearch.toLowerCase())
  ) || [];

  // Function to handle symbol type change
  const handleSymbolTypeChange = (value: string) => {
    setSymbolType(value as any);

    // Set a default symbol for the selected type
    if (AVAILABLE_SYMBOLS[value as keyof typeof AVAILABLE_SYMBOLS]?.length > 0) {
      setSymbol(AVAILABLE_SYMBOLS[value as keyof typeof AVAILABLE_SYMBOLS][0]);
    }
  };


  // Initialize symbol when component mounts
  useEffect(() => {
    if (AVAILABLE_SYMBOLS[symbolType]?.length > 0 && !symbol) {
      setSymbol(AVAILABLE_SYMBOLS[symbolType][0]);
    }
  }, [symbolType, symbol]);

  // Initialize chart
  useEffect(() => {
    const initChart = () => {
      if (!chartContainerRef.current) {
        console.log('Chart container ref not ready');
        return;
      }

      try {
        console.log('Starting chart creation');
        // Create chart instance
        const chart = createChart(chartContainerRef.current, {
          layout: {
            background: { color: backgroundColor },
            textColor: priceAxisColor,
          },
          grid: {
            vertLines: { color: vertGridColor },
            horzLines: { color: horzGridColor },
          },
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
          timeScale: {
            timeVisible: true,
            secondsVisible: false,
            rightOffset: 5,
            barSpacing: 6,
            // Removed tickColor (not supported)
            shiftVisibleRangeOnNewBar: true,
            lockVisibleTimeRangeOnResize: true,
            rightBarStaysOnScroll: true,
            borderVisible: true,
            borderColor: '#D1D4DC',
            visible: true,
            drawTicks: true,
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

        console.log('Chart created:', chart);
        console.log('Chart methods:', Object.keys(chart));

        // Store chart reference
        chartRef.current = chart;

        // Create candlestick series using the updated API for v5.0.5
        try {
          console.log('Adding candlestick series using addSeries...');
          const series = chart.addSeries(CandlestickSeries, {
            upColor,
            downColor,
            borderVisible: false,
            wickUpColor: upColor,
            wickDownColor: downColor,
          });

          if (!series) {
            throw new Error('Failed to create candlestick series');
          }

          candlestickSeriesRef.current = series;

          // Adjust the price scale after series is created
          if (chart.priceScale('right')) {
            chart.priceScale('right').applyOptions({
              autoScale: true,
              scaleMargins: {
                top: 0.1,
                bottom: 0.1,
              },
            });
          }

          console.log('Chart and series initialized successfully');
        } catch (seriesError) {
          console.error('Error creating candlestick series:', seriesError);
          chart.remove();
          chartRef.current = null;
        }
      } catch (chartError) {
        console.error('Error creating chart:', chartError);
        if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
        }
      }
    };

    // Legacy resize handler for older browsers
    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

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

    // Initialize chart
    console.log('Starting chart initialization');
    initChart();

    // Legacy resize handler for older browsers
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        candlestickSeriesRef.current = null;
      }
    };
  }, [upColor, downColor, priceAxisColor, timeAxisColor, backgroundColor, vertGridColor, horzGridColor]);

  // Set up chart click handler as a separate effect to ensure it always has access to latest data
  useEffect(() => {
    if (!chartRef.current) return;

    // Store the click handler reference so we can unsubscribe it properly
    const clickHandler = (param: any) => {
      // Handle both selectBarMode and barSelectionMode
      if ((!selectBarMode && !barSelectionMode) || !data.length) return;

      try {
        console.log('Chart clicked:', {
          selectBarMode,
          barSelectionMode,
          param,
          hasPoint: !!param.point,
          dataLength: data.length
        });

        // Find the closest data point to where the user clicked
        const point = param.point;
        const coordinate = chartRef.current?.timeScale().coordinateToTime(point.x);

        if (coordinate) {
          // Find the closest bar to where the user clicked
          const targetTime = coordinate as number;

          // Get the logical index first using the time scale
          const logicalIndex = chartRef.current?.timeScale().coordinateToLogical(point.x);

          // If we have a logical index, use it as our starting point
          let closestIndex = 0;

          if (logicalIndex !== null && logicalIndex !== undefined) {
            // Logical index gives us a better starting point
            closestIndex = Math.max(0, Math.min(Math.round(logicalIndex), data.length - 1));
          } else {
            // Fallback to searching by timestamp
            let minDiff = Number.MAX_SAFE_INTEGER;

            data.forEach((bar, index) => {
              const diff = Math.abs(bar.time - targetTime);
              if (diff < minDiff) {
                minDiff = diff;
                closestIndex = index;
              }
            });
          }

          // Debug log
          console.log(`Selected candle at index ${closestIndex}, time: ${new Date(data[closestIndex].time * 1000).toLocaleString()}`);

          // Set the current index to the selected bar
          setCurrentIndex(closestIndex);

          // Clear existing trades when selecting a new starting point
          setOpenTrades([]);
          setClosedTrades([]);
          setTotalPnL(0);
          forceRemoveAllPriceLines();

          // Update the chart to show data up to the selected bar
          if (candlestickSeriesRef.current) {
            candlestickSeriesRef.current.setData(data.slice(0, closestIndex + 1));
          }

          // Handle different modes
          if (selectBarMode) {
            // Exit select bar mode
            setSelectBarMode(false);

            // Show notification
            toast({
              title: "Bar Selected",
              description: `Simulation will start from ${new Date(data[closestIndex].time * 1000).toLocaleString()}`,
            });
          } else if (barSelectionMode) {
            // Exit bar selection mode
            setBarSelectionMode(false);

            // Show notification
            toast({
              title: "Bar Selected",
              description: `Started replay from bar ${closestIndex + 1}`,
            });
          }
        }
      } catch (error) {
        console.error("Error in chart click handler:", error);
        toast({
          title: "Selection Error",
          description: "Could not select the candle. Please try again.",
        });
      }
    };

    // Add click handler for "Select Bar" mode
    chartRef.current.subscribeClick(clickHandler);

    return () => {
      // Clean up click handler on unmount or when dependencies change
      if (chartRef.current) {
        try {
          chartRef.current.unsubscribeClick(clickHandler);
        } catch (e) {
          console.error("Error unsubscribing click handler", e);
        }
      }
    };
  }, [data, selectBarMode, barSelectionMode]);


  // Fetch data based on asset type

  const fetchData = async () => {
    try {
      setError(null);
      setIsLoading(true);
      setOpenTrades([]);
      setClosedTrades([]);
      setTotalPnL(0);
      // Make sure playback is stopped when loading new data
      setIsPlaying(false);

      // Format dates for API request
      const formattedStartDate = format(startDate, 'yyyy-MM-dd');
      const formattedEndDate = format(endDate, 'yyyy-MM-dd');

      // Format the ticker for the API
      const apiTicker = formatTickerForAPI(symbol, symbolType);
      console.log(`Fetching data for ${apiTicker} (${symbolType}) from ${formattedStartDate} to ${formattedEndDate} with timeframe: ${selectedTimeframe.value} ${selectedTimeframe.unit}`);

      let response;

      // Use the appropriate API endpoint based on the symbol type
      try {
        if (symbolType === 'forex') {
          response = await rest.forex.aggregates(
            apiTicker,
            selectedTimeframe.value,
            selectedTimeframe.unit,
            formattedStartDate,
            formattedEndDate
          );
        } else if (symbolType === 'crypto') {
          response = await rest.crypto.aggregates(
            apiTicker,
            selectedTimeframe.value,
            selectedTimeframe.unit,
            formattedStartDate,
            formattedEndDate
          );
        } else if (symbolType === 'indices') {
          response = await rest.indices.aggregates(
            apiTicker,
            selectedTimeframe.value,
            selectedTimeframe.unit,
            formattedStartDate,
            formattedEndDate
          );
        } else {
          // Default (stocks, ETFs)
          response = await rest.stocks.aggregates(
            apiTicker,
            selectedTimeframe.value,
            selectedTimeframe.unit,
            formattedStartDate,
            formattedEndDate
          );
        }
      } catch (apiError: any) {
        console.error("API Error:", apiError);

        // More detailed error message
        let errorMessage = `Error fetching data from Polygon: `;
        if (apiError.status === 404) {
          errorMessage += `Symbol '${symbol}' not found or not available in the ${symbolType} category.`;
        } else if (apiError.status === 403) {
          errorMessage += `Access denied. Your Polygon.io plan may not include access to ${symbolType} data.`;
        } else {
          errorMessage += apiError.message || 'Unknown error';
        }

        throw new Error(errorMessage);
      }

      if (!response || !response.results || response.results.length === 0) {
        throw new Error(`No data received for ${symbol}. Try a different date range or symbol.`);
      }

      console.log(`Received ${response.results.length} data points from Polygon`);

      const formattedData: ChartData[] = response.results.map(bar => ({
        time: bar.t / 1000,
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
      }));

      if (formattedData.length === 0) {
        throw new Error('No price data available for the selected date range.');
      }

      setData(formattedData);
      // Set the current index to the last point to show all historical data
      const initialIndex = formattedData.length - 1;
      setCurrentIndex(initialIndex);

      if (candlestickSeriesRef.current) {
        // Show all historical data at once rather than just the first candle
        candlestickSeriesRef.current.setData(formattedData);


        // Show zoomed in section at the end instead of full chart
        if (chartRef.current) {
          // Calculate how many bars to show by default
          const barsToShow = Math.min(100, Math.floor(formattedData.length * 0.2));

          // Set the visible range to show a more zoomed in section at the end
          chartRef.current.timeScale().setVisibleLogicalRange({
            from: formattedData.length - barsToShow,
            to: formattedData.length
          });

          // Also adjust the price scale to fit the visible range
          setTimeout(() => {
            if (chartRef.current && chartRef.current.priceScale('right')) {
              chartRef.current.priceScale('right').fitContent();
            }
          }, 100);
        }
      }
    } catch (err) {
      console.error("Fetch Error:", err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      setData([]);

      // Clear the chart if there's an error
      if (candlestickSeriesRef.current) {
        candlestickSeriesRef.current.setData([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle playback
  useEffect(() => {
    if (!isPlaying || !data.length) return;

    // If we're at the end, reset to the beginning for continuous playback
    if (currentIndex >= data.length - 1) {
      setCurrentIndex(data.length - 1);
      setIsPlaying(false);

      // Always show results at the end of simulation
      console.log('[Results] Showing results dialog:', {
        symbol,
        closedTrades: closedTrades.length,
        totalPnL: totalPnL
      });
      setShowResults(true);
      return;
    }

    const timer = setInterval(() => {
      setCurrentIndex(prev => {
        const nextIndex = prev + speedMultiplier;

        // If we reach the end, pause playback and show results
        if (nextIndex >= data.length - 1) {
          setIsPlaying(false);
          console.log('[Results] Showing results dialog at end:', {
            symbol,
            closedTrades: closedTrades.length,
            totalPnL: totalPnL
          });
          setShowResults(true);
          return data.length - 1;
        }

        return nextIndex;
      });
    }, playbackSpeed);

    // Cleanup timer on unmount or when dependencies change
    return () => clearInterval(timer);
  }, [isPlaying, currentIndex, data.length, playbackSpeed, speedMultiplier, symbol, closedTrades.length, totalPnL]);

  // Handle play button click
  const handlePlay = () => {
    // Only reset to beginning if at the end and not after a bar was selected
    if (currentIndex >= data.length - 1) {
      setCurrentIndex(0);
    }
    setIsPlaying(true);
  };

  // Simplified function for arrow markers
  const updateTradeMarkers = useCallback(() => {
    if (!candlestickSeriesRef.current || !data[currentIndex]) return;

    try {
      // Create arrow markers only - without labels (TradingView style)
      const markers: any[] = [];

      // Add entry markers for open trades
      openTrades.forEach(trade => {
        markers.push({
          time: trade.entryTime.getTime() / 1000,
          position: trade.type === 'buy' ? 'belowBar' : 'aboveBar',
          color: trade.type === 'buy' ? '#2962FF' : '#FF2929',
          shape: trade.type === 'buy' ? 'arrowUp' : 'arrowDown',
          size: 1,
        });
      });

      // Add entry and exit markers for closed trades
      closedTrades.forEach(trade => {
        // Skip if incomplete
        if (!trade.exitPrice || !trade.exitTime) return;

        // Entry arrow
        markers.push({
          time: trade.entryTime.getTime() / 1000,
          position: trade.type === 'buy' ? 'belowBar' : 'aboveBar',
          color: trade.type === 'buy' ? '#2962FF' : '#FF2929',
          shape: trade.type === 'buy' ? 'arrowUp' : 'arrowDown',
          size: 1,
        });

        // Exit arrow
        markers.push({
          time: trade.exitTime.getTime() / 1000,
          position: trade.type === 'buy' ? 'aboveBar' : 'belowBar',
          color: trade.type === 'buy' ? '#FF2929' : '#2962FF',
          shape: trade.type === 'buy' ? 'arrowDown' : 'arrowUp',
          size: 1,
        });
      });

      // Set the markers
      if (candlestickSeriesRef.current) {
        // Use applyOptions if available (for v4+)
        if (typeof candlestickSeriesRef.current.applyOptions === 'function') {
          candlestickSeriesRef.current.applyOptions({
            markers: markers
          });
        }
      }
    } catch (err) {
      console.error("Error updating trade markers:", err);
    }
  }, [currentIndex, data, openTrades, closedTrades]);

  // Add function to calculate total PnL
  const calculateTotalPnL = useCallback((trades: Trade[], currentPrice: number) => {
    // Calculate PnL for open trades
    const openTradesPnL = trades.reduce((total, trade) => {
      const tradePnL = trade.type === 'buy'
        ? (currentPrice - trade.entryPrice) * trade.quantity
        : (trade.entryPrice - currentPrice) * trade.quantity;
      return total + tradePnL;
    }, 0);

    // Calculate PnL for closed trades
    const closedTradesPnL = closedTrades.reduce((total, trade) => {
      return total + (trade.pnl || 0);
    }, 0);

    // Return combined PnL
    return openTradesPnL + closedTradesPnL;
  }, [closedTrades]);

  // Modify drawOpenTradeVisuals to handle individual trade visualization without PnL
  const drawOpenTradeVisuals = useCallback((trade: Trade, currentPrice: number, series: any) => {
    if (!series) {
      console.error('[Trade Draw] No series reference available');
      return;
    }

    try {
      // Create entry line
      const entryLabel = `${trade.type.toUpperCase()} ${trade.quantity} ${trade.entryPrice.toFixed(2)}`;
      console.log(`[Trade Draw] Drawing entry line for trade ${trade.id} at ${trade.entryPrice}`);
      series.createPriceLine({
        price: trade.entryPrice,
        color: entryLineColor,
        lineWidth: 1,
        lineStyle: 1, // Solid
        axisLabelVisible: true,
        title: entryLabel,
      });

      // Create stop loss line if exists
      if (trade.stopLoss) {
        console.log(`[Trade Draw] Drawing SL line for trade ${trade.id} at ${trade.stopLoss}`);
        series.createPriceLine({
          price: trade.stopLoss,
          color: 'rgba(239, 83, 80, 0.5)',
          lineWidth: 1,
          lineStyle: 1, // Solid
          axisLabelVisible: true,
          title: 'SL',
        });
      }

      // Create take profit line if exists
      if (trade.takeProfit) {
        console.log(`[Trade Draw] Drawing TP line for trade ${trade.id} at ${trade.takeProfit}`);
        series.createPriceLine({
          price: trade.takeProfit,
          color: 'rgba(38, 166, 154, 0.5)',
          lineWidth: 1,
          lineStyle: 1, // Solid
          axisLabelVisible: true,
          title: 'TP',
        });
      }
    } catch (e) {
      console.error('[Trade Draw] Error drawing trade visuals:', {
        tradeId: trade.id,
        error: e
      });
    }
  }, [entryLineColor, exitLineColor]);

  // Add new function to update combined PnL display
  const updateCombinedPnL = useCallback((trades: Trade[], currentPrice: number, series: any) => {
    if (!series) return;

    try {
      // Remove existing combined PnL line if it exists
      if (combinedPnLLineRef.current) {
        series.removePriceLine(combinedPnLLineRef.current);
        combinedPnLLineRef.current = null;
      }

      // Calculate total PnL
      const totalPnL = calculateTotalPnL(trades, currentPrice);

      console.log('[PnL Calc] Combined PnL calculation:', {
        numberOfTrades: trades.length,
        totalPnL: totalPnL,
        currentPrice: currentPrice
      });

      // Only draw if there are open trades and significant PnL
      if (trades.length > 0 && Math.abs(totalPnL) > 0.01) {
        const pnlFormatted = totalPnL.toFixed(2);
        const pnlText = totalPnL >= 0 ? `+${pnlFormatted}` : `${pnlFormatted}`;
        const pnlColor = totalPnL >= 0 ? 'rgba(38, 166, 154, 1)' : 'rgba(239, 83, 80, 1)';

        console.log('[PnL Draw] Creating combined PnL line:', {
          totalPnL: totalPnL,
          pnlText: pnlText,
          color: totalPnL >= 0 ? 'GREEN' : 'RED'
        });

        // Create new combined PnL line
        combinedPnLLineRef.current = series.createPriceLine({
          price: currentPrice,
          color: pnlColor,
          lineWidth: 2,
          lineStyle: 2, // Dashed
          axisLabelVisible: true,
          title: `Total PnL: ${pnlText}`,
          axisLabelTextColor: '#ffffff', // White text for better contrast
        });
      }
    } catch (e) {
      console.error('[PnL Draw] Error updating combined PnL:', e);
    }
  }, [calculateTotalPnL]);

  // Add debug logging to drawClosedTradeVisuals function
  const drawClosedTradeVisuals = useCallback((trade: Trade, series: any) => {
    console.log(`Attempting to draw closed trade ${trade.id}:`, JSON.stringify(trade));

    if (!series) {
      console.error(`No series reference available for drawing closed trade ${trade.id}`);
      return;
    }

    if (!trade.exitPrice || !trade.exitTime) {
      console.error(`Missing exitPrice (${trade.exitPrice}) or exitTime (${trade.exitTime}) for closed trade ${trade.id}`);
      return;
    }

    try {
      // Verify the series has createPriceLine method
      if (typeof series.createPriceLine !== 'function') {
        console.error(`Series does not have createPriceLine method for trade ${trade.id}`);
        return;
      }

      // Format P&L for display with more visibility
      const pnlFormatted = (trade.pnl || 0).toFixed(2);
      const pnlText = (trade.pnl || 0) >= 0 ? `+${pnlFormatted}` : `${pnlFormatted}`;
      const pnlColor = (trade.pnl || 0) >= 0 ? 'rgba(38, 166, 154, 0.8)' : 'rgba(239, 83, 80, 0.8)';

      // Create entry line with better visibility
      const entryLabel = `${trade.type.toUpperCase()} ${trade.quantity} ${trade.entryPrice.toFixed(2)}`;
      console.log(`Drawing closed trade entry line at ${trade.entryPrice} with label ${entryLabel}`);

      try {
        const entryLine = series.createPriceLine({
          price: trade.entryPrice,
          color: 'rgba(150, 150, 150, 0.8)', // More visible gray
          lineWidth: 1,
          lineStyle: 1, // Solid
          axisLabelVisible: true,
          title: entryLabel,
          axisLabelTextColor: '#ffffff', // White text for contrast
        });
        console.log(`Entry line created successfully for trade ${trade.id}:`, entryLine);
      } catch (entryError) {
        console.error(`Failed to create entry line for trade ${trade.id}:`, entryError);
      }

      // Create exit line with improved visibility
      console.log(`Drawing closed trade exit line at ${trade.exitPrice} with label EXIT ${pnlText}`);

      try {
        const exitLine = series.createPriceLine({
          price: trade.exitPrice,
          color: exitLineColor,
          lineWidth: 2, // Slightly thicker line
          lineStyle: 1, // Solid line for exit
          axisLabelVisible: true,
          title: `EXIT ${pnlText}`,
          axisLabelTextColor: '#ffffff', // White text for better contrast
        });
        console.log(`Exit line created successfully for trade ${trade.id}:`, exitLine);
      } catch (exitError) {
        console.error(`Failed to create exit line for trade ${trade.id}:`, exitError);
      }
    } catch (e) {
      console.error(`Error drawing closed trade ${trade.id} visuals:`, e);
    }
  }, [exitLineColor]);

  // Clean up all price lines - simpler function
  const removeAllPriceLines = useCallback(() => {
    if (!candlestickSeriesRef.current) {
      console.warn("Cannot remove price lines - no candlestick series reference");
      return;
    }

    try {
      // Check if priceLines method exists and use it properly
      if (typeof candlestickSeriesRef.current.priceLines !== 'function') {
        console.error("priceLines method not available on series");
        return;
      }

      // Get all price lines
      const allPriceLines = candlestickSeriesRef.current.priceLines();

      console.log(`Removing ${allPriceLines?.length || 0} price lines`);

      // Remove all price lines
      if (allPriceLines && allPriceLines.length > 0) {
        allPriceLines.forEach(line => {
          try {
            if (line && candlestickSeriesRef.current) {
              candlestickSeriesRef.current.removePriceLine(line);
            }
          } catch (e) {
            console.warn("Error removing price line:", e);
          }
        });

        // Double-check price lines were actually removed
        const remainingLines = candlestickSeriesRef.current.priceLines();
        if (remainingLines && remainingLines.length > 0) {
          console.warn(`Still has ${remainingLines.length} price lines after removing all`);

          // Brute force approach as fallback - create a new series if needed
          try {
            if (chartRef.current && typeof candlestickSeriesRef.current.options === 'function') {
              // Get current options and data
              const options = candlestickSeriesRef.current.options();
              const data = candlestickSeriesRef.current.data();

              // Remove the old series
              chartRef.current.removeSeries(candlestickSeriesRef.current);

              // Create a new series
              const newSeries = chartRef.current.addSeries(CandlestickSeries, options);
              candlestickSeriesRef.current = newSeries;

              // Restore the data
              candlestickSeriesRef.current.setData(data);

              console.log("Recreated candlestick series to force price line removal");
            }
          } catch (e) {
            console.error("Failed brute force series recreation:", e);
          }
        } else {
          console.log("Successfully removed all price lines");
        }
      } else {
        console.log("No price lines to remove");
      }
    } catch (err) {
      console.error("Error removing all price lines:", err);
    }
  }, []);

  // Update the main chart update effect
  useEffect(() => {
    if (!candlestickSeriesRef.current || !chartRef.current || !data.length) {
      console.log("Chart update effect skipped - missing refs or data", {
        candlestickSeries: !!candlestickSeriesRef.current,
        chart: !!chartRef.current,
        dataLength: data.length
      });
      return;
    }

    // Always cancel any pending updates
    if (markersUpdateRef.current) {
      cancelAnimationFrame(markersUpdateRef.current);
      markersUpdateRef.current = null;
    }

    // First update the chart data
    candlestickSeriesRef.current.setData(data.slice(0, currentIndex + 1));

    // Only adjust the visible range if we're not in an active simulation
    if (!isPlaying) {
      const visibleLogicalRange = chartRef.current.timeScale().getVisibleLogicalRange();
      if (visibleLogicalRange) {
        // If chart is zoomed too far or we're at the edges, adjust the view
        if (visibleLogicalRange.from < 0 ||
          currentIndex >= visibleLogicalRange.to ||
          currentIndex <= visibleLogicalRange.from) {
          console.log('Adjusting chart view to fit content');
          chartRef.current.timeScale().fitContent();
        }
      }
    }

    // Check for trade exits - process this outside of animation frame to ensure state is updated
    const currentBar = data[currentIndex];
    const updatedOpenTrades = [...openTrades];
    const newClosedTrades: Trade[] = [];
    let pnlChange = 0;
    let tradesWereClosed = false;

    // Process trade exits
    updatedOpenTrades.forEach((trade, index) => {
      if (trade.stopLoss && (
        (trade.type === 'buy' && currentBar.low <= trade.stopLoss) ||
        (trade.type === 'sell' && currentBar.high >= trade.stopLoss)
      )) {
        // Stop loss hit
        const exitPrice = trade.stopLoss;
        const pnl = trade.type === 'buy'
          ? (exitPrice - trade.entryPrice) * trade.quantity
          : (trade.entryPrice - exitPrice) * trade.quantity;

        const closedTrade = {
          ...trade,
          exitPrice,
          exitTime: new Date(currentBar.time * 1000),
          pnl,
        };

        console.log(`SL hit for trade ${trade.id}: exitPrice=${exitPrice}, pnl=${pnl}`, closedTrade);

        newClosedTrades.push(closedTrade);
        updatedOpenTrades[index] = null as any;
        pnlChange += pnl;
        tradesWereClosed = true;
      } else if (trade.takeProfit && (
        (trade.type === 'buy' && currentBar.high >= trade.takeProfit) ||
        (trade.type === 'sell' && currentBar.low <= trade.takeProfit)
      )) {
        // Take profit hit
        const exitPrice = trade.takeProfit;
        const pnl = trade.type === 'buy'
          ? (exitPrice - trade.entryPrice) * trade.quantity
          : (trade.entryPrice - exitPrice) * trade.quantity;

        const closedTrade = {
          ...trade,
          exitPrice,
          exitTime: new Date(currentBar.time * 1000),
          pnl,
        };

        console.log(`TP hit for trade ${trade.id}: exitPrice=${exitPrice}, pnl=${pnl}`, closedTrade);

        newClosedTrades.push(closedTrade);
        updatedOpenTrades[index] = null as any;
        pnlChange += pnl;
        tradesWereClosed = true;
      }
    });

    // Update state if trades were closed
    let filteredOpenTrades = openTrades;
    let updatedClosedTrades = closedTrades;

    if (tradesWereClosed) {
      filteredOpenTrades = updatedOpenTrades.filter(trade => trade !== null);
      updatedClosedTrades = [...closedTrades, ...newClosedTrades];

      setOpenTrades(filteredOpenTrades);
      setClosedTrades(updatedClosedTrades);

      // Update total PnL by adding the pnlChange from closed trades
      setTotalPnL(prev => {
        const newTotal = prev + pnlChange;
        console.log(`Updated total PnL: ${prev} + ${pnlChange} = ${newTotal}`);
        return newTotal;
      });
    }

    // Schedule visual update with requestAnimationFrame
    markersUpdateRef.current = requestAnimationFrame(() => {
      try {
        const series = candlestickSeriesRef.current;
        if (!series) {
          console.error("No series reference in animation frame");
          return;
        }

        console.log(`🔄 rAF update - Drawing visuals for ${filteredOpenTrades.length} open trades and ${updatedClosedTrades.length} closed trades`);

        // STEP 1: ALWAYS REMOVE ALL PRICE LINES FIRST
        try {
          console.log("Removing all existing price lines");
          removeAllPriceLines();
        } catch (removeError) {
          console.error("Error removing price lines:", removeError);
        }

        // STEP 2: REDRAW ALL CURRENTLY VISIBLE ELEMENTS

        // Draw open trades (entry, SL, TP lines only)
        filteredOpenTrades.forEach(trade => {
          console.log(`Drawing open trade ${trade.id}: type=${trade.type}, entry=${trade.entryPrice}`);
          try {
            drawOpenTradeVisuals(trade, currentBar.close, series);
          } catch (tradeError) {
            console.error(`Error drawing open trade ${trade.id}:`, tradeError);
          }
        });

        // Update combined PnL display for open trades
        updateCombinedPnL(filteredOpenTrades, currentBar.close, series);

        // Draw closed trades
        updatedClosedTrades.forEach(trade => {
          if (trade.exitPrice && trade.exitTime) {
            try {
              drawClosedTradeVisuals(trade, series);
            } catch (tradeError) {
              console.error(`Error drawing closed trade ${trade.id}:`, tradeError);
            }
          }
        });

        // Update arrow markers
        try {
          updateTradeMarkers();
        } catch (markerError) {
          console.error("Error updating trade markers:", markerError);
        }

        // Reset the reference
        markersUpdateRef.current = null;
      } catch (e) {
        console.error("Error in chart update:", e);
        markersUpdateRef.current = null;
      }
    });

    return () => {
      if (markersUpdateRef.current) {
        cancelAnimationFrame(markersUpdateRef.current);
        markersUpdateRef.current = null;
      }
    };
  }, [currentIndex, data, openTrades, closedTrades, drawOpenTradeVisuals, drawClosedTradeVisuals, updateTradeMarkers, removeAllPriceLines, updateCombinedPnL]);

  // Updated handleReset with simpler price line handling
  const handleReset = () => {
    setCurrentIndex(data.length - 1);
    setIsPlaying(false);

    // Clear trade state
    setOpenTrades([]);
    setClosedTrades([]);
    setTotalPnL(0);
    setShowResults(false);

    // Clean up the chart
    removeAllPriceLines();

    // Clear markers
    if (candlestickSeriesRef.current) {
      try {
        if (typeof candlestickSeriesRef.current.applyOptions === 'function') {
          candlestickSeriesRef.current.applyOptions({
            markers: []
          });
        }
      } catch (e) {
        console.warn("Error clearing markers:", e);
      }
    }

    // Show all historical data
    if (candlestickSeriesRef.current && data.length > 0) {
      candlestickSeriesRef.current.setData(data);

      // Fit the visible range to show all data
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }
    }
  };

  // Helper function to forcefully remove all price lines - alias to our new function
  const forceRemoveAllPriceLines = removeAllPriceLines;

  // Add explicit debug log to flattenTrades function
  const flattenTrades = () => {
    if (!data[currentIndex] || openTrades.length === 0) return;

    const currentBar = data[currentIndex];
    const currentPrice = currentBar.close;
    const newClosedTrades: Trade[] = [];
    let pnlChange = 0;

    console.log(`Flattening ${openTrades.length} trades at price ${currentPrice}`);

    openTrades.forEach(trade => {
      const exitPrice = currentPrice;
      const pnl = trade.type === 'buy'
        ? (exitPrice - trade.entryPrice) * trade.quantity
        : (trade.entryPrice - exitPrice) * trade.quantity;

      const closedTrade = {
        ...trade,
        exitPrice,
        exitTime: new Date(currentBar.time * 1000),
        pnl,
      };

      console.log(`Flattened trade ${trade.id}: exitPrice=${exitPrice}, exitTime=${closedTrade.exitTime.toISOString()}, pnl=${pnl}`);

      newClosedTrades.push(closedTrade);
      pnlChange += pnl;
    });

    console.log(`All trades flattened: ${newClosedTrades.length} new closed trades with pnlChange=${pnlChange}`);

    // Update state - the markers will be updated in the effect
    setOpenTrades([]);
    setClosedTrades(prev => {
      const updated = [...prev, ...newClosedTrades];
      console.log(`Updated closedTrades state with ${updated.length} total trades`);
      return updated;
    });

    // Update total PnL by adding the pnlChange from closed trades
    setTotalPnL(prev => {
      const newTotal = prev + pnlChange;
      console.log(`Updated total PnL: ${prev} + ${pnlChange} = ${newTotal}`);
      return newTotal;
    });
  };

  // Calculate backtesting results
  const calculateResults = () => {
    // Win rate calculation
    const winningTrades = closedTrades.filter(trade => (trade.pnl || 0) > 0);
    const winRate = closedTrades.length > 0
      ? (winningTrades.length / closedTrades.length * 100).toFixed(2)
      : "0.00";

    // Biggest trade calculation
    let biggestWin = 0;
    let biggestLoss = 0;

    // Calculate gross profits and losses for profit factor
    let grossProfits = 0;
    let grossLosses = 0;

    closedTrades.forEach(trade => {
      const pnl = trade.pnl || 0;
      if (pnl > 0) {
        grossProfits += pnl;
        if (pnl > biggestWin) {
          biggestWin = pnl;
        }
      } else {
        grossLosses += Math.abs(pnl);
        if (pnl < biggestLoss) {
          biggestLoss = pnl;
        }
      }
    });

    // Calculate profit factor
    const profitFactor = grossLosses > 0 ? (grossProfits / grossLosses).toFixed(2) : "∞";

    return {
      winRate,
      totalTrades: closedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: closedTrades.length - winningTrades.length,
      biggestWin: biggestWin.toFixed(2),
      biggestLoss: biggestLoss.toFixed(2),
      totalPnL: totalPnL.toFixed(2),
      profitFactor
    };
  };

  // Handle resetting results
  const handleCloseResults = () => {
    setShowResults(false);
  };

  // Clear all markers and reset simulation
  const handleResetSimulation = () => {
    setCurrentIndex(data.length - 1);
    setIsPlaying(false);
    setOpenTrades([]);
    setClosedTrades([]);
    setTotalPnL(0);
    setShowResults(false);

    // Clean up all price lines
    forceRemoveAllPriceLines();

    // Show all historical data
    if (candlestickSeriesRef.current && data.length > 0) {
      candlestickSeriesRef.current.setData(data);

      // Fit the visible range to show all data
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }
    }
  };

  const handlePause = () => setIsPlaying(false);
  const handleForward = () => setCurrentIndex(prev => Math.min(prev + 1, data.length - 1));
  const handleRewind = () => setCurrentIndex(prev => Math.max(prev - 1, 0));

  // Modification to place trade function to include stop loss and take profit
  const placeTrade = (type: 'buy' | 'sell') => {
    if (!data[currentIndex]) return;

    const currentBar = data[currentIndex];

    // Convert input values to numbers
    const stopLoss = stopLossValue ? parseFloat(stopLossValue) : undefined;
    const takeProfit = takeProfitValue ? parseFloat(takeProfitValue) : undefined;

    // Validate stop loss and take profit values
    if (type === 'buy') {
      if (stopLoss && stopLoss >= currentBar.close) {
        toast({
          title: "Invalid Stop Loss",
          description: "Stop loss for a buy trade must be below the entry price.",
        });
        return;
      }
      if (takeProfit && takeProfit <= currentBar.close) {
        toast({
          title: "Invalid Take Profit",
          description: "Take profit for a buy trade must be above the entry price.",
        });
        return;
      }
    } else { // sell
      if (stopLoss && stopLoss <= currentBar.close) {
        toast({
          title: "Invalid Stop Loss",
          description: "Stop loss for a sell trade must be above the entry price.",
        });
        return;
      }
      if (takeProfit && takeProfit >= currentBar.close) {
        toast({
          title: "Invalid Take Profit",
          description: "Take profit for a sell trade must be below the entry price.",
        });
        return;
      }
    }

    const newTrade: Trade = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      entryPrice: currentBar.close,
      entryTime: new Date(currentBar.time * 1000),
      quantity: 100,
      stopLoss,
      takeProfit,
    };

    // Just update the state, the effect will handle marker updates
    setOpenTrades(prev => [...prev, newTrade]);

    // Clear the inputs and preview lines after placing trade
    setStopLossValue('');
    setTakeProfitValue('');
    clearPricePreviewLines();
  };

  // Function to clear preview lines
  const clearPricePreviewLines = () => {
    if (!candlestickSeriesRef.current) return;

    // Remove previous preview lines if they exist
    if (stopLossPreviewLineId !== null) {
      try {
        candlestickSeriesRef.current.removePriceLine(stopLossPreviewLineId);
        setStopLossPreviewLineId(null);
      } catch (e) {
        console.error('Error removing SL preview line:', e);
      }
    }

    if (takeProfitPreviewLineId !== null) {
      try {
        candlestickSeriesRef.current.removePriceLine(takeProfitPreviewLineId);
        setTakeProfitPreviewLineId(null);
      } catch (e) {
        console.error('Error removing TP preview line:', e);
      }
    }

    setStopLossPreview(null);
    setTakeProfitPreview(null);
  };

  // Function to preview stop loss and take profit levels
  const updatePricePreview = () => {
    if (!candlestickSeriesRef.current || !data[currentIndex]) return;

    clearPricePreviewLines();

    const currentBar = data[currentIndex];
    const stopLoss = stopLossValue ? parseFloat(stopLossValue) : null;
    const takeProfit = takeProfitValue ? parseFloat(takeProfitValue) : null;

    // Set preview values for reference in UI
    setStopLossPreview(stopLoss);
    setTakeProfitPreview(takeProfit);

    // Draw stop loss preview line
    if (stopLoss !== null && !isNaN(stopLoss)) {
      try {
        const slLine = candlestickSeriesRef.current.createPriceLine({
          price: stopLoss,
          color: 'rgba(239, 83, 80, 0.5)',
          lineWidth: 1,
          lineStyle: 1, // Solid
          axisLabelVisible: true,
          title: 'SL Preview',
        });
        setStopLossPreviewLineId(slLine);
      } catch (e) {
        console.error('Error creating SL preview line:', e);
      }
    }

    // Draw take profit preview line
    if (takeProfit !== null && !isNaN(takeProfit)) {
      try {
        const tpLine = candlestickSeriesRef.current.createPriceLine({
          price: takeProfit,
          color: 'rgba(38, 166, 154, 0.5)',
          lineWidth: 1,
          lineStyle: 1, // Solid
          axisLabelVisible: true,
          title: 'TP Preview',
        });
        setTakeProfitPreviewLineId(tpLine);
      } catch (e) {
        console.error('Error creating TP preview line:', e);
      }
    }
  };

  // Update preview when input values change
  useEffect(() => {
    updatePricePreview();

    // Cleanup when unmounting
    return () => {
      clearPricePreviewLines();
    };
  }, [stopLossValue, takeProfitValue, currentIndex]);

  // Start simulation from the beginning
  const startSimulation = () => {
    setCurrentIndex(0);
    setIsPlaying(false);
    setOpenTrades([]);
    setClosedTrades([]);
    setTotalPnL(0);
    setShowResults(false);

    // Clean up all price lines
    forceRemoveAllPriceLines();

    // Update chart to show only the first candle
    if (candlestickSeriesRef.current && data.length > 0) {
      candlestickSeriesRef.current.setData(data.slice(0, 1));

      // Fit the visible range
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }
    }
  };

  const cycleSpeedMultiplier = () => {
    setSpeedMultiplier(prev => {
      // Cycle through 1x, 2x, 4x, 8x, 10x
      const multipliers = [1, 2, 4, 8, 10];
      const currentIndex = multipliers.indexOf(prev);
      const nextIndex = (currentIndex + 1) % multipliers.length;
      return multipliers[nextIndex];
    });
  };

  const handleZoomIn = () => {
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  };

  const handleBarSelection = () => {
    setBarSelectionMode(!barSelectionMode);
    if (barSelectionMode) {
      toast({
        title: "Bar Selection Mode",
        description: "Click on any bar in the chart to start replay from that point",
      });
    } else {
      toast({
        title: "Bar Selection Mode",
        description: "Bar selection mode disabled",
      });
    }
  };


  const handleSave = () => {
    // Save current chart state or export data
    const chartData = {
      symbol,
      symbolType,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      timeframe: selectedTimeframe.value,
      trades: closedTrades,
      totalPnL
    };

    const dataStr = JSON.stringify(chartData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backtest-${symbol}-${format(new Date(), 'yyyy-MM-dd')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    setIsFullscreen(prev => !prev);

    // Need to resize the chart after toggling fullscreen
    setTimeout(() => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
          timeScale: {
            timeVisible: true,
            secondsVisible: false,
            rightOffset: 5,
            barSpacing: 6,
            shiftVisibleRangeOnNewBar: true,
            lockVisibleTimeRangeOnResize: true,
            rightBarStaysOnScroll: true,
            borderVisible: true,
            borderColor: '#D1D4DC',
            visible: true,
            drawTicks: true,
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
        chartRef.current.timeScale().fitContent();
      }
    }, 100);
  };

  // Toggle select bar mode
  const toggleSelectBarMode = () => {
    if (!data.length) {
      toast({
        title: "No Data Available",
        description: "Please load chart data first before selecting a bar."
      });
      return;
    }

    setSelectBarMode(prev => !prev);

    if (!selectBarMode) {
      // Pause playback when entering select bar mode
      setIsPlaying(false);
      toast({
        title: "Select Bar Mode Activated",
        description: "Click on any candle to start your simulation from that point."
      });
    }
  };

  // Add random candle selection function
  const selectRandomCandle = () => {
    if (!data.length) {
      toast({
        title: "No Data Available",
        description: "Please load chart data first before selecting a random candle."
      });
      return;
    }

    // Select a random index between 0 and data.length - 1
    const randomIndex = Math.floor(Math.random() * data.length);

    // Set the current index to the random candle
    setCurrentIndex(randomIndex);

    // Clear existing trades
    setOpenTrades([]);
    setClosedTrades([]);
    setTotalPnL(0);
    forceRemoveAllPriceLines();

    // Update the chart to show data up to the selected bar
    if (candlestickSeriesRef.current) {
      candlestickSeriesRef.current.setData(data.slice(0, randomIndex + 1));
    }

    // Show notification
    toast({
      title: "Random Bar Selected",
      description: `Simulation will start from ${new Date(data[randomIndex].time * 1000).toLocaleString()}`,
    });
  };

  // Add these functions inside the BarReplay component
  const calculateIndicator = useCallback((type: Indicator['type'], inputData: ChartData[], settings: any) => {
    const prices = inputData.map(d => d.close);

    switch (type) {
      case 'rsi':
        return RSI.calculate({
          values: prices,
          period: settings.period
        });

      case 'sma':
        return SMA.calculate({
          values: prices,
          period: settings.period
        });

      case 'ema':
        return EMA.calculate({
          values: prices,
          period: settings.period
        });

      case 'macd':
        return MACD.calculate({
          values: prices,
          fastPeriod: settings.shortPeriod,
          slowPeriod: settings.longPeriod,
          signalPeriod: settings.signalPeriod,
          SimpleMAOscillator: false,
          SimpleMASignal: false
        });

      case 'bollinger':
        return BollingerBands.calculate({
          values: prices,
          period: settings.period,
          stdDev: settings.multiplier
        });

      case 'fibonacci':
        const highestHigh = Math.max(...inputData.map(d => d.high));
        const lowestLow = Math.min(...inputData.map(d => d.low));
        const diff = highestHigh - lowestLow;

        return inputData.map(() => ({
          level0: lowestLow,
          level236: lowestLow + diff * 0.236,
          level382: lowestLow + diff * 0.382,
          level500: lowestLow + diff * 0.5,
          level618: lowestLow + diff * 0.618,
          level786: lowestLow + diff * 0.786,
          level1000: highestHigh
        }));

      default:
        return [];
    }
  }, []);

  const addIndicator = useCallback((type: Indicator['type']) => {
    if (!chartRef.current || !data.length) return;

    const newIndicator: Indicator = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      data: [],
      visible: true,
      color: INDICATOR_COLORS[type],
      settings: DEFAULT_INDICATOR_SETTINGS[type]
    };

    // Calculate indicator data
    const indicatorData = calculateIndicator(type, data, newIndicator.settings);
    newIndicator.data = indicatorData;

    // Create indicator lines based on type
    switch (type) {
      case 'rsi': {
        const series = chartRef.current.addSeries({ type: 'Line' as SeriesType });
        series.applyOptions({
          lineWidth: 2,
          color: newIndicator.color as string,
          priceScaleId: 'right',
          scaleMargins: { top: 0.8, bottom: 0 },
        });
        const rsiData = indicatorData.map((value: number, i: number) => ({
          time: data[i + (data.length - indicatorData.length)]?.time as Time,
          value: value
        }));
        series.setData(rsiData);
        setIndicatorLines(prev => ({ ...prev, [newIndicator.id]: series }));
        break;
      }

      case 'sma':
      case 'ema': {
        const series = chartRef.current.addSeries({ type: 'Line' as SeriesType });
        series.applyOptions({
          lineWidth: 2,
          color: newIndicator.color as string,
        });
        const maData = indicatorData.map((value: number, i: number) => ({
          time: data[i + (data.length - indicatorData.length)]?.time as Time,
          value: value
        }));
        series.setData(maData);
        setIndicatorLines(prev => ({ ...prev, [newIndicator.id]: series }));
        break;
      }

      case 'macd': {
        const colors = newIndicator.color as { line: string; signal: string; histogram: string };

        // MACD Line
        const macdLine = chartRef.current.addSeries({ type: 'Line' as SeriesType });
        macdLine.applyOptions({
          lineWidth: 2,
          color: colors.line,
          priceScaleId: 'overlay',
          scaleMargins: { top: 0.7, bottom: 0.1 },
        });

        // Signal Line
        const signalLine = chartRef.current.addSeries({ type: 'Line' as SeriesType });
        signalLine.applyOptions({
          lineWidth: 2,
          color: colors.signal,
          priceScaleId: 'overlay',
        });

        // Histogram
        const histogram = chartRef.current.addSeries({ type: 'Histogram' as SeriesType });
        histogram.applyOptions({
          color: colors.histogram,
          priceScaleId: 'overlay',
        });

        const macdData = indicatorData.map((value: any, i: number) => ({
          time: data[i + (data.length - indicatorData.length)]?.time as Time,
          value: value.MACD
        }));

        const signalData = indicatorData.map((value: any, i: number) => ({
          time: data[i + (data.length - indicatorData.length)]?.time as Time,
          value: value.signal
        }));

        const histogramData = indicatorData.map((value: any, i: number) => ({
          time: data[i + (data.length - indicatorData.length)]?.time as Time,
          value: value.histogram,
          color: value.histogram >= 0 ? colors.line : colors.signal
        }));

        macdLine.setData(macdData);
        signalLine.setData(signalData);
        histogram.setData(histogramData);

        setIndicatorLines(prev => ({
          ...prev,
          [`${newIndicator.id}_macd`]: macdLine,
          [`${newIndicator.id}_signal`]: signalLine,
          [`${newIndicator.id}_histogram`]: histogram
        } as Record<string, any>));
        break;
      }

      case 'bollinger': {
        const colors = newIndicator.color as { upper: string; middle: string; lower: string };

        // Upper Band
        const upperBand = chartRef.current.addSeries({ type: 'Line' as SeriesType });
        upperBand.applyOptions({ lineWidth: 1, color: colors.upper, lineStyle: 2 });

        // Middle Band
        const middleBand = chartRef.current.addSeries({ type: 'Line' as SeriesType });
        middleBand.applyOptions({ lineWidth: 1, color: colors.middle });

        // Lower Band
        const lowerBand = chartRef.current.addSeries({ type: 'Line' as SeriesType });
        lowerBand.applyOptions({ lineWidth: 1, color: colors.lower, lineStyle: 2 });

        const bbData = indicatorData.map((value: any, i: number) => ({
          time: data[i + (data.length - indicatorData.length)]?.time as Time,
          upper: value.upper,
          middle: value.middle,
          lower: value.lower
        }));

        upperBand.setData(bbData.map(d => ({ time: d.time, value: d.upper })));
        middleBand.setData(bbData.map(d => ({ time: d.time, value: d.middle })));
        lowerBand.setData(bbData.map(d => ({ time: d.time, value: d.lower })));

        setIndicatorLines(prev => ({
          ...prev,
          [`${newIndicator.id}_upper`]: upperBand,
          [`${newIndicator.id}_middle`]: middleBand,
          [`${newIndicator.id}_lower`]: lowerBand
        } as Record<string, any>));
        break;
      }

      case 'fibonacci': {
        const colors = newIndicator.color as {
          level0: string;
          level236: string;
          level382: string;
          level500: string;
          level618: string;
          level786: string;
          level1000: string;
        };

        const levels = ['0', '236', '382', '500', '618', '786', '1000'];
        const fibLines: Record<string, any> = {};

        levels.forEach(level => {
          const line = chartRef.current?.addSeries({ type: 'Line' as SeriesType });
          line?.applyOptions({ lineWidth: 1, color: colors[`level${level}` as keyof typeof colors], lineStyle: 2 });
          if (line) {
            const levelData = indicatorData.map((value: any, i: number) => ({
              time: data[i + (data.length - indicatorData.length)]?.time as Time,
              value: value[`level${level}`]
            }));
            line.setData(levelData);
            fibLines[`${newIndicator.id}_${level}`] = line;
          }
        });

        setIndicatorLines(prev => ({ ...prev, ...fibLines }));
        break;
      }
    }

    setIndicators(prev => [...prev, newIndicator]);

    toast({
      title: "Indicator Added",
      description: `Added ${type.toUpperCase()} indicator to the chart`
    });
  }, [data, calculateIndicator, currentIndex]);

  const removeIndicator = useCallback((id: string) => {
    const indicator = indicators.find(ind => ind.id === id);
    if (!indicator || !chartRef.current) return;

    // Remove all associated indicator lines
    Object.keys(indicatorLines).forEach(key => {
      if (key.startsWith(id)) {
        const line = indicatorLines[key];
        if (line) {
          chartRef.current?.removeSeries(line);
        }
      }
    });

    setIndicatorLines(prev => {
      const newLines = { ...prev };
      Object.keys(newLines).forEach(key => {
        if (key.startsWith(id)) {
          delete newLines[key];
        }
      });
      return newLines;
    });

    setIndicators(prev => prev.filter(ind => ind.id !== id));

    toast({
      title: "Indicator Removed",
      description: `Removed ${indicator.type.toUpperCase()} indicator from the chart`
    });
  }, [indicators]);

  // Handle scrubbing through data timeline with the slider
  const handleSliderChange = (value: number[]) => {
    // When slider changes, update the current index
    if (isPlaying) {
      // If playing, pause first
      setIsPlaying(false);
    }

    // Set the new index (slider value is 0-100, so convert to index)
    const newIndex = Math.floor((value[0] / 100) * (data.length - 1));
    setCurrentIndex(newIndex);

    // Update chart to show data up to the new index
    if (candlestickSeriesRef.current && data.length > 0) {
      candlestickSeriesRef.current.setData(data.slice(0, newIndex + 1));
    }
  };

  // Add reset view function
  const resetChartView = useCallback(() => {
    if (!chartRef.current) return;

    // Reset the visible range to show all data
    chartRef.current.timeScale().fitContent();

    // Also reset price scale without using fitContent
    if (chartRef.current.priceScale('right')) {
      chartRef.current.priceScale('right').applyOptions({
        autoScale: true
      });
    }

    toast({
      title: "Chart View Reset",
      description: "The chart view has been reset to show all data"
    });
  }, []);

  // Add useEffect to update chart layout and timeScale colors when these change
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.applyOptions({
        layout: { textColor: priceAxisColor, background: { color: backgroundColor } },
        grid: {
          vertLines: { color: vertGridColor },
          horzLines: { color: horzGridColor },
        },
        timeScale: { tickColor: timeAxisColor },
      });
    }
  }, [priceAxisColor, timeAxisColor, backgroundColor, vertGridColor, horzGridColor]);

  // 1. Load color settings from localStorage on mount
  useEffect(() => {
    const savedColors = localStorage.getItem('barReplayColors');
    if (savedColors) {
      try {
        const parsed = JSON.parse(savedColors);
        if (parsed.upColor) setUpColor(parsed.upColor);
        if (parsed.downColor) setDownColor(parsed.downColor);
        if (parsed.entryLineColor) setEntryLineColor(parsed.entryLineColor);
        if (parsed.exitLineColor) setExitLineColor(parsed.exitLineColor);
        if (parsed.priceAxisColor) setPriceAxisColor(parsed.priceAxisColor);
        if (parsed.timeAxisColor) setTimeAxisColor(parsed.timeAxisColor);
        if (parsed.backgroundColor) setBackgroundColor(parsed.backgroundColor);
        if (parsed.vertGridColor) setVertGridColor(parsed.vertGridColor);
        if (parsed.horzGridColor) setHorzGridColor(parsed.horzGridColor);
      } catch (e) {
        console.warn('Failed to parse saved bar replay colors:', e);
      }
    }
  }, []);

  // 2. Save color settings to localStorage whenever they change
  useEffect(() => {
    const colorSettings = {
      upColor,
      downColor,
      entryLineColor,
      exitLineColor,
      priceAxisColor,
      timeAxisColor,
      backgroundColor,
      vertGridColor,
      horzGridColor,
    };
    localStorage.setItem('barReplayColors', JSON.stringify(colorSettings));

    // If colors are changed manually (not from a template), clear the last applied template
    // This prevents auto-applying a template when user has made manual changes
    if (lastAppliedTemplate) {
      // Check if current colors match the last applied template
      const lastTemplate = templates[lastAppliedTemplate];
      if (lastTemplate) {
        const colorsMatch =
          lastTemplate.upColor === upColor &&
          lastTemplate.downColor === downColor &&
          lastTemplate.entryLineColor === entryLineColor &&
          lastTemplate.exitLineColor === exitLineColor &&
          lastTemplate.priceAxisColor === priceAxisColor &&
          lastTemplate.timeAxisColor === timeAxisColor &&
          lastTemplate.backgroundColor === backgroundColor &&
          lastTemplate.vertGridColor === vertGridColor &&
          lastTemplate.horzGridColor === horzGridColor;

        if (!colorsMatch) {
          // Colors have been manually changed, clear the template selection
          setSelectedTemplate(null);
          setLastAppliedTemplate(null);
          localStorage.removeItem('barReplayLastTemplate');
        }
      }
    }
  }, [upColor, downColor, entryLineColor, exitLineColor, priceAxisColor, timeAxisColor, backgroundColor, vertGridColor, horzGridColor, lastAppliedTemplate, templates]);



  // Utility: Get current user ID
  const getCurrentUserId = async (): Promise<string | null> => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return data.user.id;
  };

  // Utility: Ensure bar_replay_templates table exists
  const ensureTableExists = useCallback(async () => {
    try {
      // Try to query the table to see if it exists
      const { error } = await supabase
        .from('bar_replay_templates')
        .select('id')
        .limit(1);

      if (error && error.code === 'PGRST116') {
        // Table doesn't exist, try to create it
        console.log('bar_replay_templates table does not exist, attempting to create...');

        // Note: This would require a function in Supabase to create tables
        // For now, we'll just log and continue with localStorage fallback
        console.warn('Table creation requires database migration. Using localStorage fallback.');
        return false;
      }
      return true;
    } catch (err) {
      console.warn('Error checking table existence:', err);
      return false;
    }
  }, []);

  // Utility: Load templates (Supabase or localStorage)
  const loadTemplates = useCallback(async () => {
    const userId = await getCurrentUserId();
    if (userId) {
      // First check if table exists
      const tableExists = await ensureTableExists();

      if (tableExists) {
        try {
          // Try Supabase
          const { data, error } = await supabase
            .from('bar_replay_templates')
            .select('*')
            .eq('user_id', userId);

          if (!error && data) {
            const templatesObj: { [name: string]: any } = {};
            data.forEach((tpl: BarReplayTemplate) => {
              templatesObj[tpl.name] = tpl.settings;
            });
            setTemplates(templatesObj);
            // Also save to localStorage as backup
            localStorage.setItem('barReplayTemplates', JSON.stringify(templatesObj));

            // Load last applied template
            const lastTemplate = localStorage.getItem('barReplayLastTemplate');
            if (lastTemplate && templatesObj[lastTemplate]) {
              setSelectedTemplate(lastTemplate);
              setLastAppliedTemplate(lastTemplate);
              // Apply the template immediately
              handleApplyTemplate(lastTemplate);
            }
            return;
          } else if (error) {
            console.warn('Failed to load templates from Supabase:', error.message);
            // Continue to localStorage fallback
          }
        } catch (err) {
          console.warn('Error loading templates from Supabase:', err);
          // Continue to localStorage fallback
        }
      } else {
        console.log('Table does not exist, using localStorage fallback');
      }
    }

    // Fallback to localStorage
    const raw = localStorage.getItem('barReplayTemplates');
    if (raw) {
      try {
        const templatesObj = JSON.parse(raw);
        setTemplates(templatesObj);

        // Load last applied template
        const lastTemplate = localStorage.getItem('barReplayLastTemplate');
        if (lastTemplate && templatesObj[lastTemplate]) {
          setSelectedTemplate(lastTemplate);
          setLastAppliedTemplate(lastTemplate);
          // Apply the template immediately
          handleApplyTemplate(lastTemplate);
        }
      } catch (err) {
        console.warn('Error parsing templates from localStorage:', err);
        setTemplates({});
      }
    } else {
      setTemplates({});
    }
  }, []);

  // Utility: Save templates (Supabase or localStorage)
  const saveTemplates = useCallback(async (newTemplates: { [name: string]: any }) => {
    const userId = await getCurrentUserId();
    if (userId) {
      // Check if table exists before trying to save
      const tableExists = await ensureTableExists();

      if (tableExists) {
        try {
          // Upsert all templates to Supabase
          const upserts = Object.entries(newTemplates).map(([name, settings]) => ({
            user_id: userId,
            name,
            settings,
          }));
          const { error } = await supabase.from('bar_replay_templates').upsert(upserts, { onConflict: ['user_id', 'name'] });

          if (error) {
            console.warn('Failed to save templates to Supabase:', error.message);
            // Continue to localStorage fallback
          } else {
            console.log('Templates saved to Supabase successfully');
          }
        } catch (err) {
          console.warn('Error saving templates to Supabase:', err);
          // Continue to localStorage fallback
        }
      } else {
        console.log('Table does not exist, saving to localStorage only');
      }
    }

    // Always save to localStorage as backup/fallback
    setTemplates(newTemplates);
    localStorage.setItem('barReplayTemplates', JSON.stringify(newTemplates));
  }, [ensureTableExists]);

  // Utility: Delete template (Supabase or localStorage)
  const deleteTemplate = useCallback(async (name: string) => {
    const userId = await getCurrentUserId();
    if (userId) {
      // Check if table exists before trying to delete
      const tableExists = await ensureTableExists();

      if (tableExists) {
        try {
          const { error } = await supabase.from('bar_replay_templates').delete().eq('user_id', userId).eq('name', name);
          if (error) {
            console.warn('Failed to delete template from Supabase:', error.message);
            // Continue to localStorage fallback
          } else {
            console.log('Template deleted from Supabase successfully');
          }
        } catch (err) {
          console.warn('Error deleting template from Supabase:', err);
          // Continue to localStorage fallback
        }
      } else {
        console.log('Table does not exist, deleting from localStorage only');
      }
    }

    // Always update localStorage
    setTemplates(prev => {
      const newTemplates = { ...prev };
      delete newTemplates[name];
      localStorage.setItem('barReplayTemplates', JSON.stringify(newTemplates));
      return newTemplates;
    });
  }, [ensureTableExists]);

  // On mount, load templates
  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Update handleSaveTemplate to use saveTemplates
  const handleSaveTemplate = async () => {
    if (!saveTemplateName.trim()) return;
    const colorSettings = {
      upColor,
      downColor,
      entryLineColor,
      exitLineColor,
      priceAxisColor,
      timeAxisColor,
      backgroundColor,
      vertGridColor,
      horzGridColor,
    };
    const newTemplates = { ...templates, [saveTemplateName.trim()]: colorSettings };
    await saveTemplates(newTemplates);
    setSaveTemplateName("");
    toast({ title: "Template Saved", description: `Saved as '${saveTemplateName.trim()}'` });
  };

  // Update handleDeleteTemplate to use deleteTemplate
  const handleDeleteTemplate = async (name: string) => {
    await deleteTemplate(name);
    if (selectedTemplate === name) setSelectedTemplate(null);
  };

  // Update handleApplyTemplate to always use in-memory templates (already loaded)
  const handleApplyTemplate = (name: string) => {
    const t = templates[name];
    if (!t) return;
    setUpColor(t.upColor || upColor);
    setDownColor(t.downColor || downColor);
    setEntryLineColor(t.entryLineColor || entryLineColor);
    setExitLineColor(t.exitLineColor || exitLineColor);
    setPriceAxisColor(t.priceAxisColor || priceAxisColor);
    setTimeAxisColor(t.timeAxisColor || timeAxisColor);
    setBackgroundColor(t.backgroundColor || backgroundColor);
    setVertGridColor(t.vertGridColor || vertGridColor);
    setHorzGridColor(t.horzGridColor || horzGridColor);

    // Save the last applied template
    setSelectedTemplate(name);
    setLastAppliedTemplate(name);
    localStorage.setItem('barReplayLastTemplate', name);

    toast({ title: "Template Applied", description: `Applied '${name}'` });
  };

  // Start renaming
  const startRenaming = (name: string) => {
    setIsRenaming(name);
    setRenameTemplateName(name);
  };

  // Confirm rename
  const handleRenameTemplate = (oldName: string) => {
    if (!renameTemplateName.trim() || oldName === renameTemplateName.trim()) {
      setIsRenaming(null);
      return;
    }
    const newTemplates = { ...templates };
    newTemplates[renameTemplateName.trim()] = newTemplates[oldName];
    delete newTemplates[oldName];
    saveTemplates(newTemplates);
    setIsRenaming(null);
    setRenameTemplateName("");
    if (selectedTemplate === oldName) setSelectedTemplate(renameTemplateName.trim());
  };

  // Update chart crosshair mode when mouseOnlyMode changes
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.applyOptions({
        crosshair: mouseOnlyMode
          ? {
            mode: CrosshairMode.None,
            vertLine: { visible: false },
            horzLine: { visible: false },
          }
          : {
            mode: CrosshairMode.Normal,
            vertLine: { visible: true },
            horzLine: { visible: true },
          },
      });
    }
  }, [mouseOnlyMode]);

  return (
    <div className={`flex flex-col w-full h-full ${isFullscreen ? 'fixed inset-0 z-50 bg-[#0a0a0a]' : ''}`} style={{ height: '100vh', maxHeight: '100vh' }}>
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-[#0a0a0a] border-b border-neutral-800">
        <div className="flex items-end gap-4">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-neutral-400">Type</Label>
            <Select
              value={symbolType}
              onValueChange={handleSymbolTypeChange}
            >
              <SelectTrigger className="h-8 w-24 bg-neutral-900 border-neutral-800 text-xs text-white">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent className="bg-[#0a0a0a] border-neutral-800">
                <SelectGroup>
                  <SelectItem value="stocks" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700">Stocks</SelectItem>
                  <SelectItem value="etfs" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700">ETFs</SelectItem>
                  <SelectItem value="indices" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700">Indices</SelectItem>
                  <SelectItem value="forex" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700">Forex</SelectItem>
                  <SelectItem value="crypto" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700">Crypto</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs text-neutral-400">Symbol</Label>
            <Select
              value={symbol}
              onValueChange={(value) => setSymbol(value)}
            >
              <SelectTrigger className="h-8 w-36 bg-neutral-900 border-neutral-800 text-xs text-white">
                <SelectValue placeholder="Select Symbol" />
              </SelectTrigger>
              <SelectContent className="bg-[#0a0a0a] border-neutral-800 max-h-60">
                <SelectGroup>
                  {filteredSymbols.length > 0 ? (
                    filteredSymbols.map((sym) => (
                      <SelectItem
                        key={sym}
                        value={sym}
                        className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        {sym}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem
                      value="no-symbols"
                      disabled
                      className="text-gray-500 dark:text-gray-400"
                    >
                      No symbols available
                    </SelectItem>
                  )}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs text-neutral-400">Start</Label>
            <DatePicker
              selected={startDate}
              onChange={date => date && setStartDate(date)}
              maxDate={endDate}
              className="h-8 w-28 bg-neutral-900 border-neutral-800 text-white rounded-md px-2 text-xs"
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs text-neutral-400">End</Label>
            <DatePicker
              selected={endDate}
              onChange={date => date && setEndDate(date)}
              minDate={startDate}
              maxDate={new Date()}
              className="h-8 w-28 bg-neutral-900 border-neutral-800 text-white rounded-md px-2 text-xs"
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs text-transparent select-none">Search</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2 h-4 w-4 text-neutral-500" />
              <Input
                className="h-8 pl-8 w-44 bg-neutral-900 border-neutral-800 text-xs text-white placeholder:text-neutral-500"
                value={symbolSearch}
                onChange={e => setSymbolSearch(e.target.value)}
                placeholder="Search symbols..."
              />
            </div>
          </div>
        </div>


        <div className="flex items-end gap-4">
          {/* Stop Loss and Take Profit */}
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="stop-loss" className="text-xs text-neutral-400">Stop Loss</Label>
              <Input
                id="stop-loss"
                type="number"
                step="0.01"
                placeholder="SL"
                value={stopLossValue}
                onChange={(e) => setStopLossValue(e.target.value)}
                className="h-8 w-20 text-xs bg-neutral-900 border-neutral-800 text-white placeholder:text-neutral-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="take-profit" className="text-xs text-neutral-400">Take Profit</Label>
              <Input
                id="take-profit"
                type="number"
                step="0.01"
                placeholder="TP"
                value={takeProfitValue}
                onChange={(e) => setTakeProfitValue(e.target.value)}
                className="h-8 w-20 text-xs bg-neutral-900 border-neutral-800 text-white placeholder:text-neutral-500"
              />
            </div>
          </div>

          {/* Trading Buttons */}
          <div className="flex items-end gap-2">
            <button
              onClick={() => placeTrade('buy')}
              disabled={isLoading || data.length === 0}
              style={{
                backgroundColor: '#262626',
                color: 'white',
                border: '1px solid #404040',
                height: '32px',
                width: '105px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '500',
                cursor: isLoading || data.length === 0 ? 'not-allowed' : 'pointer',
                opacity: isLoading || data.length === 0 ? 0.5 : 1,
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!isLoading && data.length > 0) {
                  e.currentTarget.style.backgroundColor = '#404040';
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading && data.length > 0) {
                  e.currentTarget.style.backgroundColor = '#262626';
                }
              }}
            >
              Buy
            </button>
            <button
              onClick={() => placeTrade('sell')}
              disabled={isLoading || data.length === 0}
              style={{
                backgroundColor: '#262626',
                color: 'white',
                border: '1px solid #404040',
                height: '32px',
                width: '105px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '500',
                cursor: isLoading || data.length === 0 ? 'not-allowed' : 'pointer',
                opacity: isLoading || data.length === 0 ? 0.5 : 1,
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!isLoading && data.length > 0) {
                  e.currentTarget.style.backgroundColor = '#404040';
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading && data.length > 0) {
                  e.currentTarget.style.backgroundColor = '#262626';
                }
              }}
            >
              Sell
            </button>
            <button
              onClick={flattenTrades}
              disabled={isLoading || openTrades.length === 0}
              style={{
                backgroundColor: '#525252',
                color: 'white',
                border: '1px solid #737373',
                height: '32px',
                width: '105px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '500',
                cursor: isLoading || openTrades.length === 0 ? 'not-allowed' : 'pointer',
                opacity: isLoading || openTrades.length === 0 ? 0.5 : 1,
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!isLoading && openTrades.length > 0) {
                  e.currentTarget.style.backgroundColor = '#737373';
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading && openTrades.length > 0) {
                  e.currentTarget.style.backgroundColor = '#525252';
                }
              }}
            >
              Flatten
            </button>
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={fetchData}
              disabled={isLoading}
              style={{
                backgroundColor: '#262626',
                color: 'white',
                border: '1px solid #404040',
                height: '32px',
                width: '105px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '500',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.5 : 1,
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.backgroundColor = '#404040';
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.backgroundColor = '#262626';
                }
              }}
            >
              {isLoading ? 'Loading...' : 'Load Data'}
            </button>
            <button
              onClick={startSimulation}
              disabled={isLoading || data.length === 0}
              style={{
                backgroundColor: '#262626',
                color: 'white',
                border: '1px solid #404040',
                height: '32px',
                width: '105px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '500',
                cursor: isLoading || data.length === 0 ? 'not-allowed' : 'pointer',
                opacity: isLoading || data.length === 0 ? 0.5 : 1,
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!isLoading && data.length > 0) {
                  e.currentTarget.style.backgroundColor = '#404040';
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading && data.length > 0) {
                  e.currentTarget.style.backgroundColor = '#262626';
                }
              }}
            >
              Start Simulation
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 text-red-500 p-4 rounded-md mx-6">
          {error}
        </div>
      )}


      {/* Main Chart Area with Right Panel */}
      <div className="flex-1 flex bg-[#0a0a0a] min-h-0">
        {/* Chart Section */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Chart Header */}
          <div className="flex items-center justify-between px-6 py-3 bg-[#0a0a0a] border-b border-neutral-800">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {formatTickerForDisplay(symbol, symbolType)} - Backtesting
                <span className="text-sm ml-2 text-gray-600 dark:text-gray-400">
                  ({symbolType === 'stocks' ? 'Stock' :
                    symbolType === 'etfs' ? 'ETF' :
                      symbolType === 'indices' ? 'Index' :
                        symbolType === 'forex' ? 'Forex' : 'Crypto'})
                </span>
                <span className="text-sm ml-2 text-gray-600 dark:text-gray-400">
                  | {selectedTimeframe.label}
                </span>
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <Tabs
                value={selectedTimeframe.label}
                onValueChange={(value) => {
                  const timeframe = TIMEFRAMES.find(tf => tf.label === value);
                  if (timeframe) {
                    setSelectedTimeframe(timeframe);
                  }
                }}
              >
                <TabsList className="bg-neutral-900 border-neutral-800">
                  {TIMEFRAMES.map((tf) => (
                    <TabsTrigger
                      key={tf.label}
                      value={tf.label}
                      className="px-3 py-1 text-xs h-7 data-[state=active]:bg-neutral-800 data-[state=active]:text-white text-neutral-400"
                    >
                      {tf.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <Button
                variant="outline"
                size="icon"
                onClick={toggleFullscreen}
                className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-600"
                title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {isFullscreen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          {/* Chart Container */}
          <div className="flex-1 relative bg-[#0a0a0a]">
            {/* Playback Controls Overlay */}
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 flex items-center gap-2 bg-[#0a0a0a] rounded-lg shadow-lg p-2 border border-neutral-800">
              <Button onClick={handleRewind} variant="outline" size="icon" className="bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700 h-8 w-8">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </Button>
              {isPlaying ? (
                <Button onClick={handlePause} variant="outline" size="icon" className="bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700 h-8 w-8">
                  <Pause className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handlePlay} variant="outline" size="icon" className="bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700 h-8 w-8">
                  <Play className="h-4 w-4" />
                </Button>
              )}
              <Button onClick={handleForward} variant="outline" size="icon" className="bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700 h-8 w-8">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </Button>
              <Button onClick={cycleSpeedMultiplier} variant="outline" size="sm" className="bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700 h-8 px-3 flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{speedMultiplier}x</span>
              </Button>
              <Button onClick={handleReset} variant="outline" size="icon" className="bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700 h-8 w-8">
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button onClick={handleZoomIn} variant="outline" size="icon" className="bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700 h-8 w-8">
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                onClick={handleBarSelection}
                variant="outline"
                size="icon"
                className={`h-8 w-8 ${barSelectionMode
                  ? 'bg-neutral-700 hover:bg-neutral-600 text-white border-neutral-600'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700'
                  }`}
                title={barSelectionMode ? 'Click on chart to select bar (Active)' : 'Click to enable bar selection mode'}
              >
                <Crosshair className="h-4 w-4" />
              </Button>
              <Button onClick={handleSave} variant="outline" size="icon" className="bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700 h-8 w-8">
                <Download className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-300 dark:border-gray-600">
                <Input
                  type="number"
                  value={playbackSpeed}
                  onChange={e => setPlaybackSpeed(Number(e.target.value))}
                  className="w-16 h-8 text-xs bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  min={100}
                  max={5000}
                  step={100}
                />
                <span className="text-xs text-gray-500 dark:text-gray-400">ms delay</span>
              </div>
            </div>

            <ContextMenu>
              <ContextMenuTrigger>
                <div
                  ref={chartContainerRef}
                  className={`w-full h-full relative ${barSelectionMode ? 'cursor-crosshair' : ''}`}
                >

                  {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-10">
                      <div className="flex flex-col items-center gap-2">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-500"></div>
                        <p className="text-sm text-white">Loading data...</p>
                      </div>
                    </div>
                  )}

                  {selectBarMode && (
                    <div className="absolute top-2 right-2 bg-purple-600/20 px-3 py-1 rounded-full text-xs animate-pulse text-white">
                      Click on a candle to select
                    </div>
                  )}
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="bg-gray-800 border-gray-600">
                <ContextMenuItem onClick={resetChartView} className="text-white hover:bg-gray-700">
                  Reset View
                </ContextMenuItem>
                <ContextMenuItem onClick={() => setColorDialogOpen(true)} className="text-white hover:bg-gray-700">
                  Customize Chart Colors
                </ContextMenuItem>
                <ContextMenuItem onClick={() => setManageTemplatesOpen(true)} className="text-white hover:bg-gray-700">
                  Manage Templates
                </ContextMenuItem>
                <ContextMenuItem onClick={() => setMouseOnlyMode(m => !m)} className="text-white hover:bg-gray-700">
                  <span className="flex items-center gap-2">
                    {mouseOnlyMode && <span className="inline-block w-3 h-3 rounded-full bg-purple-500" />}
                    Mouse Only
                  </span>
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          </div>
        </div>

        {/* Right Trading Stats Panel */}
        <div className="w-80 bg-[#0a0a0a] border-l border-neutral-800 flex flex-col h-full">
          <div className="p-4 border-b border-neutral-800 flex-shrink-0">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Trading Results</h3>
          </div>

          <div className="flex-1 p-4 space-y-4 overflow-y-auto min-h-0">
            {/* Key Metrics */}
            <div className="space-y-3">
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3">
                <div className="text-sm text-gray-600 dark:text-gray-300 mb-1">Total P&L</div>
                <div className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                  ${totalPnL.toFixed(2)}
                </div>
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3">
                <div className="text-sm text-gray-600 dark:text-gray-300 mb-1">Win Rate</div>
                <div className="text-xl font-bold text-neutral-200">
                  {closedTrades.length > 0 ?
                    `${((closedTrades.filter(trade => (trade.pnl || 0) > 0).length / closedTrades.length) * 100).toFixed(1)}%` :
                    '0%'
                  }
                </div>
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3">
                <div className="text-sm text-gray-600 dark:text-gray-300 mb-1">Profit Factor</div>
                <div className="text-xl font-bold text-neutral-300">
                  {(() => {
                    const grossProfit = closedTrades.filter(trade => (trade.pnl || 0) > 0).reduce((sum, trade) => sum + (trade.pnl || 0), 0);
                    const grossLoss = Math.abs(closedTrades.filter(trade => (trade.pnl || 0) < 0).reduce((sum, trade) => sum + (trade.pnl || 0), 0));
                    return grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : '∞';
                  })()}
                </div>
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3">
                <div className="text-sm text-gray-600 dark:text-gray-300 mb-1">Total Trades</div>
                <div className="text-xl font-bold text-neutral-400">
                  {closedTrades.length}
                </div>
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3">
                <div className="text-sm text-gray-600 dark:text-gray-300 mb-1">Winning Trades</div>
                <div className="text-xl font-bold text-blue-500 dark:text-blue-400">
                  {closedTrades.filter(trade => (trade.pnl || 0) > 0).length}
                </div>
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3">
                <div className="text-sm text-gray-600 dark:text-gray-300 mb-1">Losing Trades</div>
                <div className="text-xl font-bold text-purple-500 dark:text-purple-400">
                  {closedTrades.filter(trade => (trade.pnl || 0) < 0).length}
                </div>
              </div>
            </div>

            {/* Open Trades */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 flex-shrink-0">
              <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">Open Trades ({openTrades.length})</div>
              <div className="space-y-2 h-24 overflow-y-auto">
                {openTrades.map(trade => (
                  <div key={trade.id} className="text-xs text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600 pb-1">
                    <div className="font-medium">{trade.type.toUpperCase()} {trade.quantity} @ ${trade.entryPrice.toFixed(2)}</div>
                    {(trade.stopLoss || trade.takeProfit) && (
                      <div className="text-gray-500 dark:text-gray-400">
                        {trade.stopLoss && `SL: $${trade.stopLoss.toFixed(2)}`}
                        {trade.stopLoss && trade.takeProfit && ' | '}
                        {trade.takeProfit && `TP: $${trade.takeProfit.toFixed(2)}`}
                      </div>
                    )}
                  </div>
                ))}
                {openTrades.length === 0 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">No open trades</div>
                )}
              </div>
            </div>

            {/* Recent Closed Trades */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 flex-shrink-0">
              <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">Recent Trades</div>
              <div className="space-y-2 h-32 overflow-y-auto">
                {closedTrades.slice(-5).reverse().map(trade => (
                  <div key={trade.id} className="text-xs text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600 pb-1">
                    <div className="font-medium">{trade.type.toUpperCase()} {trade.quantity} @ ${trade.entryPrice.toFixed(2)} → ${trade.exitPrice?.toFixed(2)}</div>
                    <div className={`${(trade.pnl || 0) >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                      P&L: ${trade.pnl?.toFixed(2)}
                    </div>
                  </div>
                ))}
                {closedTrades.length === 0 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">No closed trades</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="bg-[#0a0a0a] border-t border-neutral-800 p-4">
        {/* Timeline slider */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {data.length > 0 && currentIndex > 0 ? new Date(data[0].time * 1000).toLocaleDateString() : "--"}
            </span>
            <span className="text-xs font-medium text-gray-900 dark:text-white">
              {data.length > 0 && currentIndex < data.length
                ? new Date(data[currentIndex].time * 1000).toLocaleString()
                : "--"}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {data.length > 0 ? new Date(data[data.length - 1].time * 1000).toLocaleDateString() : "--"}
            </span>
          </div>
          <Slider
            value={[data.length > 1 ? (currentIndex / (data.length - 1)) * 100 : 0]}
            onValueChange={handleSliderChange}
            disabled={data.length <= 1}
            className="cursor-pointer"
            step={1}
          />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {currentIndex + 1} of {data.length}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {data.length > 0 && currentIndex < data.length
                ? `$${data[currentIndex].close.toFixed(2)} ${data[currentIndex].close > data[currentIndex].open ? '↑' : '↓'}`
                : "--"}
            </span>
          </div>
        </div>


        {/* Preview Info */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col gap-2">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {stopLossPreview && <span>SL: ${stopLossPreview.toFixed(2)} </span>}
              {takeProfitPreview && <span>TP: ${takeProfitPreview.toFixed(2)}</span>}
            </div>
          </div>
        </div>
      </div>




      {/* Strategy Builder Dialog */}
      <Dialog open={showStrategyBuilder} onOpenChange={setShowStrategyBuilder}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Advanced Strategy Builder</DialogTitle>
            <DialogDescription>
              Build and configure sophisticated trading strategies
            </DialogDescription>
          </DialogHeader>
          <AdvancedStrategyBuilder />
        </DialogContent>
      </Dialog>

      {/* Risk Manager Dialog */}
      <Dialog open={showRiskManager} onOpenChange={setShowRiskManager}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Advanced Risk Management</DialogTitle>
            <DialogDescription>
              Configure risk limits and monitoring systems
            </DialogDescription>
          </DialogHeader>
          <AdvancedRiskManager />
        </DialogContent>
      </Dialog>


      {/* Results Dialog */}
      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Trading Results</DialogTitle>
            <DialogDescription>
              Your backtesting simulation results
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {(() => {
              const results = calculateResults();
              return (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-medium text-muted-foreground">Win Rate</h3>
                    <p className="text-2xl font-semibold">{results.winRate}%</p>
                    <p className="text-xs text-muted-foreground">
                      ({results.winningTrades} / {results.totalTrades} trades)
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-medium text-muted-foreground">Total P&L</h3>
                    <p className={`text-2xl font-semibold ${parseFloat(results.totalPnL) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      ${results.totalPnL}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-medium text-muted-foreground">Profit Factor</h3>
                    <p className={`text-2xl font-semibold ${parseFloat(results.profitFactor) > 1 ? 'text-green-500' : 'text-red-500'}`}>
                      {results.profitFactor}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-medium text-muted-foreground">Biggest Win</h3>
                    <p className="text-2xl font-semibold text-green-500">${results.biggestWin}</p>
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-medium text-muted-foreground">Biggest Loss</h3>
                    <p className="text-2xl font-semibold text-red-500">${results.biggestLoss}</p>
                  </div>
                </div>
              );
            })()}
          </div>

          <DialogFooter className="sm:justify-center">
            <Button
              type="button"
              onClick={handleCloseResults}
              variant="secondary"
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={() => {
                setShowResults(false);
                startSimulation();
              }}
            >
              Start New Simulation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add indicator list */}
      <div className="flex items-center gap-2">

        {indicators.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {indicators.map(indicator => (
              <Button
                key={indicator.id}
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
                onClick={() => removeIndicator(indicator.id)}
              >
                <span>{indicator.type.toUpperCase()}</span>
                <svg
                  viewBox="0 0 24 24"
                  className="h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Color customization dialog */}
      <Dialog open={colorDialogOpen} onOpenChange={setColorDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Customize Chart Colors</DialogTitle>
            <DialogDescription>
              Change the colors for candlesticks, price lines, axes, and chart background below.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex items-center gap-4">
              <label className="w-32">Up Candle</label>
              <input type="color" value={upColor} onChange={e => setUpColor(e.target.value)} />
            </div>
            <div className="flex items-center gap-4">
              <label className="w-32">Down Candle</label>
              <input type="color" value={downColor} onChange={e => setDownColor(e.target.value)} />
            </div>
            <div className="flex items-center gap-4">
              <label className="w-32">Entry Line</label>
              <input type="color" value={entryLineColor} onChange={e => setEntryLineColor(e.target.value)} />
            </div>
            <div className="flex items-center gap-4">
              <label className="w-32">Exit Line</label>
              <input type="color" value={exitLineColor} onChange={e => setExitLineColor(e.target.value)} />
            </div>
            <div className="flex items-center gap-4">
              <label className="w-32">Price Axis</label>
              <input type="color" value={priceAxisColor} onChange={e => setPriceAxisColor(e.target.value)} />
            </div>
            <div className="flex items-center gap-4">
              <label className="w-32">Time Axis</label>
              <input type="color" value={timeAxisColor} onChange={e => setTimeAxisColor(e.target.value)} />
            </div>
            <div className="flex items-center gap-4">
              <label className="w-32">Background</label>
              <input type="color" value={backgroundColor} onChange={e => setBackgroundColor(e.target.value)} />
            </div>
            <div className="flex items-center gap-4">
              <label className="w-32">Grid (Vertical)</label>
              <input type="color" value={vertGridColor} onChange={e => setVertGridColor(e.target.value)} />
            </div>
            <div className="flex items-center gap-4">
              <label className="w-32">Grid (Horizontal)</label>
              <input type="color" value={horzGridColor} onChange={e => setHorzGridColor(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 mt-4">
              <Input
                placeholder="Template name"
                value={saveTemplateName}
                onChange={e => setSaveTemplateName(e.target.value)}
                className="w-48"
              />
              <Button type="button" onClick={handleSaveTemplate} variant="default" className="bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700">
                Save as Template
              </Button>
            </div>
          </div>
          <DialogFooter className="sm:justify-center">
            <Button type="button" onClick={() => setColorDialogOpen(false)} variant="secondary">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Templates dialog */}
      <Dialog open={manageTemplatesOpen} onOpenChange={setManageTemplatesOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Templates</DialogTitle>
            <DialogDescription>
              Save, load, rename, or delete your chart color templates.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            {Object.keys(templates).length === 0 && (
              <div className="text-muted-foreground text-sm">No templates saved yet.</div>
            )}
            {Object.keys(templates).map(name => (
              <div key={name} className="flex items-center gap-2">
                {isRenaming === name ? (
                  <>
                    <Input
                      value={renameTemplateName}
                      onChange={e => setRenameTemplateName(e.target.value)}
                      className="w-32"
                      autoFocus
                    />
                    <Button size="sm" variant="default" onClick={() => handleRenameTemplate(name)} className="bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700">Save</Button>
                    <Button size="sm" variant="secondary" onClick={() => setIsRenaming(null)}>Cancel</Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant={selectedTemplate === name ? "default" : "outline"}
                      onClick={() => { setSelectedTemplate(name); handleApplyTemplate(name); }}
                    >
                      {name}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => startRenaming(name)} title="Rename">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19.5 3 21l1.5-4L16.5 3.5z" /></svg>
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDeleteTemplate(name)} title="Delete">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
          <DialogFooter className="sm:justify-center">
            <Button type="button" onClick={() => setManageTemplatesOpen(false)} variant="secondary">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}; 