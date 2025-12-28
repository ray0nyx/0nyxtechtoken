import React from 'react';
import { cn } from '@/lib/utils';

interface OrderBookEntry {
  price: number;
  amount: number;
  total?: number;
  type: 'buy' | 'sell';
}

interface OrderBookPanelProps {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  lastPrice?: number;
  priceChange?: number;
  className?: string;
}

export default function OrderBookPanel({
  bids,
  asks,
  lastPrice,
  priceChange,
  className,
}: OrderBookPanelProps) {
  const maxBidTotal = bids.length > 0 ? Math.max(...bids.map(b => b.total || b.amount * b.price)) : 1;
  const maxAskTotal = asks.length > 0 ? Math.max(...asks.map(a => a.total || a.amount * a.price)) : 1;

  const formatPrice = (price: number) => {
    if (price < 0.01) return price.toFixed(7);
    if (price < 1) return price.toFixed(4);
    return price.toFixed(2);
  };

  const formatAmount = (amount: number) => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(2)}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(2)}K`;
    return amount.toFixed(2);
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1f2937] flex-shrink-0">
        <h3 className="text-sm font-semibold text-white">Order Book</h3>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-3 px-4 py-2 text-xs text-[#6b7280] border-b border-[#1f2937] flex-shrink-0">
        <span>Buy</span>
        <span className="text-center">Price</span>
        <span className="text-right">Sell</span>
      </div>

      {/* Order Book - Scrollable */}
      <div 
        className="flex-1 overflow-y-auto overflow-x-hidden" 
        style={{ 
          maxHeight: '500px',
          minHeight: '300px',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {asks.length === 0 && bids.length === 0 ? (
          <div className="flex items-center justify-center h-full min-h-[200px]">
            <div className="text-center text-[#6b7280] text-sm">
              <p>No order book data available</p>
              <p className="text-xs mt-1">Loading...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Asks (Sells) - reversed to show highest at top */}
            {[...asks].reverse().map((ask, i) => {
          const depthPercent = ((ask.total || ask.amount * ask.price) / maxAskTotal) * 100;
          return (
            <div
              key={`ask-${i}`}
              className="relative grid grid-cols-3 px-4 py-1 text-xs hover:bg-[#252b3d]"
            >
              <div
                className="absolute inset-y-0 right-0 bg-[#ef4444]/10"
                style={{ width: `${depthPercent}%` }}
              />
              <span className="relative text-[#9ca3af]">-</span>
              <span className="relative text-center text-[#ef4444]">
                {formatPrice(ask.price)}
              </span>
              <span className="relative text-right text-[#9ca3af]">
                {formatAmount(ask.amount)}
              </span>
            </div>
          );
        })}

        {/* Spread / Last Price */}
        {lastPrice && (
          <div className="grid grid-cols-3 px-4 py-2 bg-[#0f1419] border-y border-[#1f2937]">
            <span />
            <span
              className={cn(
                'text-center font-semibold text-sm',
                priceChange && priceChange >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'
              )}
            >
              {formatPrice(lastPrice)}
            </span>
            <span />
          </div>
        )}

        {/* Bids (Buys) */}
        {bids.map((bid, i) => {
          const depthPercent = ((bid.total || bid.amount * bid.price) / maxBidTotal) * 100;
          return (
            <div
              key={`bid-${i}`}
              className="relative grid grid-cols-3 px-4 py-1 text-xs hover:bg-[#252b3d]"
            >
              <div
                className="absolute inset-y-0 left-0 bg-[#10b981]/10"
                style={{ width: `${depthPercent}%` }}
              />
              <span className="relative text-[#9ca3af]">
                {formatAmount(bid.amount)}
              </span>
              <span className="relative text-center text-[#10b981]">
                {formatPrice(bid.price)}
              </span>
              <span className="relative text-right text-[#9ca3af]">-</span>
            </div>
          );
        })}
          </>
        )}
      </div>
    </div>
  );
}

