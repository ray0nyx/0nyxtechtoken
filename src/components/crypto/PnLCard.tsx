/**
 * Real-time PnL Card Component
 * 
 * Displays PnL for a position with WebSocket updates
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useTradingStore } from '@/stores/useTradingStore';
import { subscribeToPriceUpdates } from '@/lib/sse-service';

interface PnLCardProps {
  positionId: string;
  tokenAddress: string;
  entryPrice: number;
  quantity: number;
  side: 'long' | 'short';
  className?: string;
}

export default function PnLCard({
  positionId,
  tokenAddress,
  entryPrice,
  quantity,
  side,
  className,
}: PnLCardProps) {
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [pnl, setPnl] = useState<number>(0);
  const [pnlPercent, setPnlPercent] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Subscribe to price updates via SSE
    const subscription = subscribeToPriceUpdates(
      tokenAddress,
      (data) => {
        const price = data.price || data.priceUsd || null;
        if (price) {
          setCurrentPrice(price);
          setIsLoading(false);
        }
      },
      (error) => {
        console.error('SSE price update error:', error);
        setIsLoading(false);
      }
    );

    // Also try WebSocket as fallback
    const store = useTradingStore.getState();
    if (store.currentPrice) {
      setCurrentPrice(store.currentPrice);
      setIsLoading(false);
    }

    return () => {
      subscription.close();
    };
  }, [tokenAddress]);

  // Calculate PnL
  useEffect(() => {
    if (currentPrice === null || entryPrice === 0) {
      setPnl(0);
      setPnlPercent(0);
      return;
    }

    const priceChange = side === 'long'
      ? currentPrice - entryPrice
      : entryPrice - currentPrice;

    const pnlValue = priceChange * quantity;
    const pnlPercentValue = (priceChange / entryPrice) * 100;

    setPnl(pnlValue);
    setPnlPercent(pnlPercentValue);
  }, [currentPrice, entryPrice, quantity, side]);

  const isProfit = pnl > 0;
  const isLoss = pnl < 0;
  const pnlColor = isProfit
    ? 'text-green-500'
    : isLoss
    ? 'text-red-500'
    : 'text-gray-500';

  const Icon = isProfit
    ? TrendingUp
    : isLoss
    ? TrendingDown
    : Minus;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Position PnL</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Current Price</span>
            <span className="text-sm font-medium">
              {isLoading ? (
                <span className="text-muted-foreground">Loading...</span>
              ) : currentPrice !== null ? (
                `$${currentPrice.toFixed(6)}`
              ) : (
                <span className="text-muted-foreground">N/A</span>
              )}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Entry Price</span>
            <span className="text-sm font-medium">${entryPrice.toFixed(6)}</span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-sm font-medium">Unrealized PnL</span>
            <div className={`flex items-center gap-1 ${pnlColor}`}>
              <Icon className="h-4 w-4" />
              <span className="text-sm font-bold">
                {isProfit ? '+' : ''}${pnl.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">PnL %</span>
            <span className={`text-xs font-medium ${pnlColor}`}>
              {isProfit ? '+' : ''}
              {pnlPercent.toFixed(2)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
