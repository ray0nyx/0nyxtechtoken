import React from 'react';
import { cn } from '@/lib/utils';

interface Trade {
  id: string;
  time: string;
  price: number;
  amount: number;
  side: 'buy' | 'sell';
  changePercent?: number;
}

interface RecentTradesPanelProps {
  trades: Trade[];
  symbol?: string;
  className?: string;
}

export default function RecentTradesPanel({
  trades,
  symbol,
  className,
}: RecentTradesPanelProps) {
  const formatPrice = (price: number) => {
    if (price >= 1000) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
    if (price >= 1) return `$${price.toFixed(2)}`;
    if (price >= 0.01) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(6)}`;
  };

  const formatTime = (time: string) => {
    const date = new Date(time);
    const now = new Date();
    const diff = (now.getTime() - date.getTime()) / 1000;
    
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={cn('bg-[#1a1f2e] rounded-xl border border-[#1f2937] overflow-hidden', className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1f2937]">
        <h3 className="text-sm font-semibold text-white">Recent Trades</h3>
      </div>

      {/* Table */}
      <div className="max-h-[300px] overflow-y-auto">
        {trades.length === 0 ? (
          <div className="px-4 py-8 text-center text-[#6b7280] text-sm">
            No recent trades
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-[#1a1f2e]">
              <tr className="text-xs text-[#6b7280] border-b border-[#1f2937]">
                <th className="text-left px-4 py-2 font-medium">Time</th>
                <th className="text-right px-4 py-2 font-medium">Price</th>
                <th className="text-right px-4 py-2 font-medium">Change</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => (
                <tr
                  key={trade.id}
                  className="text-xs border-b border-[#1f2937]/50 hover:bg-[#252b3d] transition-colors"
                >
                  <td className="px-4 py-2 text-[#9ca3af]">
                    {formatTime(trade.time)}
                  </td>
                  <td
                    className={cn(
                      'px-4 py-2 text-right font-medium',
                      trade.side === 'buy' ? 'text-[#10b981]' : 'text-[#ef4444]'
                    )}
                  >
                    {formatPrice(trade.price)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {trade.changePercent !== undefined && (
                      <span
                        className={cn(
                          'font-medium',
                          trade.changePercent >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'
                        )}
                      >
                        {trade.changePercent >= 0 ? '+' : ''}
                        {trade.changePercent.toFixed(2)}%
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

