import React from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw, ChevronUp } from 'lucide-react';
import CoinCard, { type CoinCardData } from './CoinCard';

interface SurgeColumnProps {
  title: string;
  coins: CoinCardData[];
  loading?: boolean;
  onCoinClick?: (coin: CoinCardData) => void;
  onBuyClick?: (coin: CoinCardData) => void;
  onRefresh?: () => void;
  theme?: 'dark' | 'light';
  showUsd?: boolean;
  className?: string;
}

export default function SurgeColumn({
  title,
  coins,
  loading = false,
  onCoinClick,
  onBuyClick,
  onRefresh,
  theme = 'dark',
  showUsd = true,
  className,
}: SurgeColumnProps) {
  const isDark = theme === 'dark';

  // Calculate column stats
  const totalVolume = coins.reduce((sum, c) => sum + (c.volume24h || 0), 0);
  const totalLiquidity = coins.reduce((sum, c) => sum + (c.liquidity || 0), 0);
  const totalHolders = coins.reduce((sum, c) => sum + (c.holders || 0), 0);
  const totalTxns = coins.reduce((sum, c) => sum + (c.txns || 0), 0);

  const formatShortNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
  };

  return (
    <div className={cn(
      "flex flex-col h-full rounded-lg border",
      isDark ? "bg-[#0a0e14] border-[#1e2530]" : "bg-gray-50 border-gray-200",
      className
    )}>
      {/* Header */}
      <div className={cn(
        "px-4 py-3 border-b",
        isDark ? "border-[#1e2530]" : "border-gray-200"
      )}>
        {/* Title row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h3 className={cn(
              "text-sm font-bold",
              isDark ? "text-white" : "text-gray-900"
            )}>
              {title}
            </h3>
            <span className={cn(
              "text-xs px-2 py-0.5 rounded-full font-medium",
              isDark ? "bg-cyan-900/30 text-cyan-400" : "bg-cyan-100 text-cyan-600"
            )}>
              {coins.length}
            </span>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className={cn(
                "p-1.5 rounded-md hover:bg-gray-700/50 transition-colors",
                loading && "animate-spin"
              )}
              disabled={loading}
            >
              <RefreshCw className={cn(
                "w-4 h-4",
                isDark ? "text-gray-400" : "text-gray-500"
              )} />
            </button>
          )}
        </div>

        {/* Stats row - like axiom.trade */}
        <div className="flex items-center gap-3 text-[10px] text-gray-500">
          <span>V ${formatShortNumber(totalVolume)}</span>
          <span>L ${formatShortNumber(totalLiquidity)}</span>
          <span>👥 {formatShortNumber(totalHolders)}</span>
          <span>📊 {totalTxns}</span>
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-green-400">🔹 8%</span>
            <span className="text-gray-500">⚡ 0%</span>
            <span className="text-gray-500">👑 0%</span>
            <span className="text-yellow-500">🔥 9%</span>
          </div>
        </div>

        {/* Subtitle */}
        <p className={cn(
          "text-[10px] mt-2",
          isDark ? "text-gray-600" : "text-gray-400"
        )}>
          {title === 'Early'
            ? 'Newly released Pump.fun tokens'
            : 'Tokens migrating to Raydium'}
        </p>
      </div>

      {/* Scroll to top button */}
      <button className={cn(
        "flex items-center justify-center py-1 border-b",
        isDark ? "border-[#1e2530] text-gray-500 hover:text-white" : "border-gray-200"
      )}>
        <ChevronUp className="w-4 h-4" />
      </button>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {loading && coins.length === 0 ? (
          // Loading skeletons
          Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "rounded-lg p-3 animate-pulse",
                isDark ? "bg-[#0d1117]" : "bg-gray-100"
              )}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={cn(
                  "w-12 h-12 rounded-full",
                  isDark ? "bg-gray-800" : "bg-gray-300"
                )} />
                <div className="flex-1">
                  <div className={cn(
                    "h-4 rounded w-24 mb-1",
                    isDark ? "bg-gray-800" : "bg-gray-300"
                  )} />
                  <div className={cn(
                    "h-3 rounded w-16",
                    isDark ? "bg-gray-800" : "bg-gray-300"
                  )} />
                </div>
              </div>
              <div className="flex justify-between">
                <div className={cn(
                  "h-4 rounded w-20",
                  isDark ? "bg-gray-800" : "bg-gray-300"
                )} />
                <div className={cn(
                  "h-4 rounded w-24",
                  isDark ? "bg-gray-800" : "bg-gray-300"
                )} />
              </div>
            </div>
          ))
        ) : coins.length === 0 ? (
          <div className={cn(
            "flex flex-col items-center justify-center h-40 text-center px-4",
            isDark ? "text-gray-500" : "text-gray-400"
          )}>
            <p className="text-sm font-medium">No tokens found</p>
            <p className="text-xs mt-1">
              {title === 'Early'
                ? 'No newly released Pump.fun tokens at the moment'
                : 'No tokens migrating to Raydium at the moment'}
            </p>
            <p className="text-xs mt-2 opacity-75">
              Make sure the backend is running on port 8001
            </p>
          </div>
        ) : (
          coins.map((coin) => (
            <CoinCard
              key={coin.address || coin.symbol}
              coin={coin}
              onClick={() => onCoinClick?.(coin)}
              onBuyClick={() => onBuyClick?.(coin)}
              theme={theme}
              showUsd={showUsd}
            />
          ))
        )}
      </div>
    </div>
  );
}
