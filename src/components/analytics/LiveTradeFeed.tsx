import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  DollarSign,
  RefreshCw,
  Wifi,
  WifiOff
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { NormalizedTrade, ExchangeConnection } from '@/types/tradeSync';
import { format } from 'date-fns';

interface LiveTradeFeedProps {
  connections: ExchangeConnection[];
  onRefresh?: () => void;
}

export function LiveTradeFeed({ connections, onRefresh }: LiveTradeFeedProps) {
  const [trades, setTrades] = useState<NormalizedTrade[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    // Subscribe to real-time trade updates
    const subscription = supabase
      .channel('trades')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'trades',
          filter: 'platform=in.(binance,coinbase,kraken,kucoin,bybit,okx,bitget,huobi,gateio,mexc)'
        },
        (payload) => {
          const newTrade = payload.new as any;
          const normalizedTrade: NormalizedTrade = {
            id: newTrade.id,
            userId: newTrade.user_id,
            connectionId: newTrade.connection_id,
            exchangeTradeId: newTrade.exchange_trade_id,
            symbol: newTrade.symbol,
            side: newTrade.side,
            quantity: newTrade.quantity,
            price: newTrade.price,
            fee: newTrade.fee,
            feeCurrency: newTrade.fee_currency,
            executedAt: new Date(newTrade.executed_at),
            exchangeTimestamp: new Date(newTrade.exchange_timestamp),
            platform: newTrade.platform,
            orderId: newTrade.order_id,
            positionId: newTrade.position_id,
            rawData: newTrade.raw_data
          };
          
          setTrades(prev => [normalizedTrade, ...prev.slice(0, 99)]); // Keep last 100 trades
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const loadRecentTrades = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .in('platform', ['binance', 'coinbase', 'kraken', 'kucoin', 'bybit', 'okx', 'bitget', 'huobi', 'gateio', 'mexc'])
        .order('executed_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const normalizedTrades: NormalizedTrade[] = (data || []).map(trade => ({
        id: trade.id,
        userId: trade.user_id,
        connectionId: trade.connection_id,
        exchangeTradeId: trade.exchange_trade_id,
        symbol: trade.symbol,
        side: trade.side,
        quantity: trade.quantity,
        price: trade.price,
        fee: trade.fee,
        feeCurrency: trade.fee_currency,
        executedAt: new Date(trade.executed_at),
        exchangeTimestamp: new Date(trade.exchange_timestamp),
        platform: trade.platform,
        orderId: trade.order_id,
        positionId: trade.position_id,
        rawData: trade.raw_data
      }));

      setTrades(normalizedTrades);
    } catch (error) {
      console.error('Error loading trades:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRecentTrades();
  }, []);

  const getConnectionStatus = (platform: string) => {
    const connection = connections.find(conn => conn.exchangeName === platform);
    return connection?.syncStatus || 'disconnected';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <Wifi className="h-3 w-3 text-green-500" />;
      case 'syncing':
        return <RefreshCw className="h-3 w-3 text-blue-500 animate-spin" />;
      case 'error':
        return <WifiOff className="h-3 w-3 text-red-500" />;
      default:
        return <WifiOff className="h-3 w-3 text-gray-400" />;
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    }).format(price);
  };

  const formatQuantity = (quantity: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 8,
    }).format(quantity);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Live Trade Feed</CardTitle>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadRecentTrades}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Connection Status */}
        <div className="flex flex-wrap gap-2 mb-4">
          {connections.map((connection) => (
            <Badge
              key={connection.id}
              variant={connection.syncStatus === 'connected' ? 'default' : 'secondary'}
              className="flex items-center space-x-1"
            >
              {getStatusIcon(connection.syncStatus)}
              <span className="text-xs">{connection.exchangeName}</span>
            </Badge>
          ))}
        </div>

        <Separator className="mb-4" />

        {/* Trade Feed */}
        <ScrollArea className="h-96">
          {trades.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2" />
              <p>No trades yet</p>
              <p className="text-sm">Connect an exchange to see live trades</p>
            </div>
          ) : (
            <div className="space-y-2">
              {trades.map((trade) => (
                <div
                  key={trade.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    {/* Side Indicator */}
                    <div className={`p-1 rounded-full ${
                      trade.side === 'buy' 
                        ? 'bg-green-100 text-green-600' 
                        : 'bg-red-100 text-red-600'
                    }`}>
                      {trade.side === 'buy' ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                    </div>

                    {/* Trade Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-sm">{trade.symbol}</span>
                        <Badge variant="outline" className="text-xs">
                          {trade.platform}
                        </Badge>
                        {getStatusIcon(getConnectionStatus(trade.platform))}
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                        <span>{formatQuantity(trade.quantity)} @ {formatPrice(trade.price)}</span>
                        <span>Fee: {trade.fee} {trade.feeCurrency}</span>
                      </div>
                    </div>
                  </div>

                  {/* Time and Value */}
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {formatPrice(trade.price * trade.quantity)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(trade.executedAt, 'HH:mm:ss')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Summary Stats */}
        {trades.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Total Trades: {trades.length}</span>
              <span>
                Last Update: {format(trades[0]?.executedAt || new Date(), 'MMM dd, HH:mm')}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
