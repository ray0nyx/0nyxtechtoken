import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  Pause, 
  Play, 
  Settings,
  RefreshCw,
  Zap
} from 'lucide-react';
import { restClient } from '@polygon.io/client-js';

interface TickerData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: number;
}

interface LiveTickerFeedProps {
  symbols?: string[];
  updateInterval?: number;
  showControls?: boolean;
  className?: string;
}

export const LiveTickerFeed: React.ComponentType<LiveTickerFeedProps> = ({
  symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'NFLX'],
  updateInterval = 5000,
  showControls = true,
  className = ''
}) => {
  const [tickerData, setTickerData] = useState<TickerData[]>([]);
  const [isLive, setIsLive] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const polygonClient = useRef(restClient(process.env.NEXT_PUBLIC_POLYGON_API_KEY));

  const fetchTickerData = async () => {
    if (!isLive) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const promises = symbols.map(async (symbol) => {
        try {
          const response = await polygonClient.current.stocks.lastTrade(symbol);
          
          if (response.results) {
            const trade = response.results;
            return {
              symbol,
              price: trade.p,
              change: 0, // Will be calculated with previous price
              changePercent: 0,
              volume: trade.s || 0,
              timestamp: trade.t || Date.now()
            };
          }
          return null;
        } catch (error) {
          console.error(`Error fetching data for ${symbol}:`, error);
          return null;
        }
      });

      const results = await Promise.all(promises);
      const validResults = results.filter((result): result is TickerData => result !== null);
      
      // Calculate changes
      const updatedData = validResults.map(result => {
        const previousData = tickerData.find(t => t.symbol === result.symbol);
        if (previousData) {
          const change = result.price - previousData.price;
          const changePercent = (change / previousData.price) * 100;
          return {
            ...result,
            change,
            changePercent
          };
        }
        return result;
      });

      setTickerData(updatedData);
    } catch (error) {
      console.error('Error fetching ticker data:', error);
      setError('Failed to fetch live data');
    } finally {
      setIsLoading(false);
    }
  };

  const startLiveFeed = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    fetchTickerData(); // Initial fetch
    intervalRef.current = setInterval(fetchTickerData, updateInterval);
  };

  const stopLiveFeed = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const toggleLiveFeed = () => {
    if (isLive) {
      stopLiveFeed();
      setIsLive(false);
    } else {
      setIsLive(true);
      startLiveFeed();
    }
  };

  const refreshData = () => {
    fetchTickerData();
  };

  useEffect(() => {
    startLiveFeed();
    return () => {
      stopLiveFeed();
    };
  }, [symbols, updateInterval]);

  useEffect(() => {
    if (isLive) {
      startLiveFeed();
    } else {
      stopLiveFeed();
    }
  }, [isLive]);

  const formatPrice = (price: number) => {
    return price.toFixed(2);
  };

  const formatChange = (change: number) => {
    return change >= 0 ? `+${change.toFixed(2)}` : change.toFixed(2);
  };

  const formatChangePercent = (changePercent: number) => {
    return changePercent >= 0 ? `+${changePercent.toFixed(2)}%` : `${changePercent.toFixed(2)}%`;
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(1)}M`;
    } else if (volume >= 1000) {
      return `${(volume / 1000).toFixed(1)}K`;
    }
    return volume.toString();
  };

  return (
    <Card className={`w-full ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-green-500" />
            <h3 className="text-lg font-semibold">Live Market Feed</h3>
            <Badge variant={isLive ? "default" : "secondary"}>
              {isLive ? "LIVE" : "PAUSED"}
            </Badge>
          </div>
          
          {showControls && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshData}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleLiveFeed}
              >
                {isLive ? (
                  <>
                    <Pause className="h-4 w-4 mr-1" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-1" />
                    Resume
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <div className="overflow-x-auto">
          <div className="flex space-x-6 min-w-max">
            {tickerData.map((ticker) => (
              <div
                key={ticker.symbol}
                className="flex-shrink-0 bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 min-w-[200px]"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm">{ticker.symbol}</span>
                  <div className="flex items-center">
                    {ticker.change >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="text-lg font-bold">
                    ${formatPrice(ticker.price)}
                  </div>
                  
                  <div className={`text-sm font-medium ${
                    ticker.change >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatChange(ticker.change)} ({formatChangePercent(ticker.changePercent)})
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    Vol: {formatVolume(ticker.volume)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {tickerData.length === 0 && !isLoading && (
          <div className="text-center py-8 text-gray-500">
            <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No ticker data available</p>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-4">
            <RefreshCw className="h-6 w-6 mx-auto animate-spin text-gray-500" />
            <p className="text-sm text-gray-500 mt-2">Loading live data...</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LiveTickerFeed;
