import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, RotateCcw, FastForward, Rewind, BarChart3, TrendingUp, TrendingDown, Target, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { AdvancedBacktestResult } from '@/services/advancedBacktestingService';

declare global {
  interface Window {
    TradingView: any;
  }
}

interface TradingViewReplayProps {
  tradeId: string;
  backtestResults?: AdvancedBacktestResult[];
  showBacktestResults?: boolean;
}

export function TradingViewReplay({ tradeId, backtestResults = [], showBacktestResults = false }: TradingViewReplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const [trade, setTrade] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [timeRange, setTimeRange] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const supabase = createClient();

  useEffect(() => {
    const loadTrade = async () => {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('id', tradeId)
        .single();

      if (error) {
        console.error('Error loading trade:', error);
        return;
      }

      setTrade(data);
      
      // Set time range with 30 minutes buffer before and after
      const entryTime = new Date(data.entry_date).getTime();
      const exitTime = new Date(data.exit_date).getTime();
      setTimeRange({
        start: entryTime - 30 * 60 * 1000,
        end: exitTime + 30 * 60 * 1000
      });
      setCurrentTime(entryTime);
    };

    loadTrade();
  }, [tradeId]);

  useEffect(() => {
    if (!containerRef.current || !trade) return;

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = initializeChart;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [trade]);

  const initializeChart = () => {
    if (!trade) return;

    const widget = new window.TradingView.widget({
      symbol: trade.symbol,
      interval: '1',
      container: containerRef.current!,
      width: '100%',
      height: 600,
      timezone: 'Etc/UTC',
      theme: 'Light',
      style: '1',
      locale: 'en',
      toolbar_bg: '#f1f3f6',
      enable_publishing: false,
      hide_side_toolbar: false,
      allow_symbol_change: false,
      save_image: false,
      studies: [
        'MASimple@tv-basicstudies',
        'Volume@tv-basicstudies',
      ],
      time: currentTime / 1000, // TradingView uses Unix timestamp in seconds
    });

    widget.onChartReady(() => {
      chartRef.current = widget;
      addTradeMarkers();
    });
  };

  const addTradeMarkers = () => {
    if (!chartRef.current || !trade) return;

    const chart = chartRef.current.chart();
    
    // Add entry marker
    chart.createShape(
      {
        time: trade.entry_date,
        price: trade.entry_price,
        text: 'Entry',
        shape: 'arrow_up',
        color: trade.position === 'long' ? '#26a69a' : '#ef5350',
        textColor: 'white',
        fontsize: 12,
        lock: true,
      },
      {
        overrides: {
          showLabel: true,
        },
      }
    );

    // Add exit marker
    chart.createShape(
      {
        time: trade.exit_date,
        price: trade.exit_price,
        text: 'Exit',
        shape: 'arrow_down',
        color: trade.position === 'long' ? '#ef5350' : '#26a69a',
        textColor: 'white',
        fontsize: 12,
        lock: true,
      },
      {
        overrides: {
          showLabel: true,
        },
      }
    );
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setCurrentTime(timeRange.start);
    setIsPlaying(false);
    if (chartRef.current) {
      chartRef.current.chart().setVisibleRange({
        from: timeRange.start / 1000,
        to: (timeRange.start + 30 * 60 * 1000) / 1000, // Show 30 minutes
      });
    }
  };

  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentTime((time) => {
        const newTime = time + 1000 * playbackSpeed;
        if (newTime >= timeRange.end) {
          setIsPlaying(false);
          return timeRange.end;
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, timeRange.end]);

  useEffect(() => {
    if (!chartRef.current) return;

    chartRef.current.chart().setVisibleRange({
      from: (currentTime - 15 * 60 * 1000) / 1000, // 15 minutes before
      to: (currentTime + 15 * 60 * 1000) / 1000,   // 15 minutes after
    });
  }, [currentTime]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <div ref={containerRef} className="w-full h-[600px]" />
        </div>
        
        {showBacktestResults && backtestResults.length > 0 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Backtest Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {backtestResults.slice(0, 3).map((result, index) => (
                  <div key={result.id} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm">{result.config.name}</h4>
                      <Badge variant={result.performance.totalReturn >= 0 ? "default" : "destructive"}>
                        {result.performance.totalReturn >= 0 ? "Profitable" : "Loss"}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-muted-foreground">Total Return</div>
                        <div className={`font-medium ${
                          result.performance.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {result.performance.totalReturn.toFixed(2)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Sharpe Ratio</div>
                        <div className="font-medium">{result.performance.sharpeRatio.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Max Drawdown</div>
                        <div className="font-medium text-red-600">{result.performance.maxDrawdown.toFixed(2)}%</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Win Rate</div>
                        <div className="font-medium">{result.performance.winRate.toFixed(2)}%</div>
                      </div>
                    </div>
                    
                    <div className="mt-2 pt-2 border-t">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Period:</span>
                        <span>{result.config.startDate} - {result.config.endDate}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Performance Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Best Performer</span>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">
                        {Math.max(...backtestResults.map(r => r.performance.totalReturn)).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Worst Performer</span>
                    <div className="flex items-center gap-1">
                      <TrendingDown className="h-4 w-4 text-red-500" />
                      <span className="text-sm font-medium">
                        {Math.min(...backtestResults.map(r => r.performance.totalReturn)).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Avg Sharpe</span>
                    <div className="flex items-center gap-1">
                      <Shield className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">
                        {(backtestResults.reduce((sum, r) => sum + r.performance.sharpeRatio, 0) / backtestResults.length).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPlaybackSpeed(Math.max(0.5, playbackSpeed - 0.5))}
          >
            <Rewind className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={handlePlayPause}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setPlaybackSpeed(Math.min(4, playbackSpeed + 0.5))}
          >
            <FastForward className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={handleReset}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>

          <span className="text-sm font-medium">
            {playbackSpeed}x
          </span>
        </div>

        <div className="space-y-2">
          <Slider
            value={[currentTime]}
            min={timeRange.start}
            max={timeRange.end}
            step={1000}
            onValueChange={([value]) => {
              setCurrentTime(value);
            }}
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{format(timeRange.start, 'HH:mm:ss')}</span>
            <span>{format(currentTime, 'HH:mm:ss')}</span>
            <span>{format(timeRange.end, 'HH:mm:ss')}</span>
          </div>
        </div>
      </div>
    </div>
  );
} 