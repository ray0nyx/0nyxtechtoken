import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ExternalLink, Copy, Bell, Heart, TrendingUp, TrendingDown } from 'lucide-react';

interface ProjectDetailsSidebarProps {
  pair: string;
  pairNumber?: string;
  chain?: string;
  exchange?: string;
  currentPriceUsd?: number;
  currentPriceQuote?: number;
  quoteSymbol?: string;
  liquidity?: string;
  fdv?: string;
  marketCap?: string;
  performance5m?: number;
  performance1h?: number;
  performance6h?: number;
  performance24h?: number;
  txns?: number;
  buys?: number;
  sells?: number;
  volume?: string;
  buyVol?: string;
  sellVol?: string;
  makers?: number;
  buyers?: number;
  sellers?: number;
  pairAddress?: string;
  baseTokenAddress?: string;
  quoteTokenAddress?: string;
  pooledBase?: string;
  pooledQuote?: string;
  pairCreated?: string;
  websiteUrl?: string;
  twitterUrl?: string;
  theme?: 'dark' | 'light';
  className?: string;
  onWatchlistClick?: () => void;
  onAlertsClick?: () => void;
  onBuyClick?: () => void;
  onSellClick?: () => void;
}

export default function ProjectDetailsSidebar({
  pair,
  pairNumber,
  chain = 'Solana',
  exchange = 'Raydium',
  currentPriceUsd,
  currentPriceQuote,
  quoteSymbol,
  liquidity,
  fdv,
  marketCap,
  performance5m,
  performance1h,
  performance6h,
  performance24h,
  txns,
  buys,
  sells,
  volume,
  buyVol,
  sellVol,
  makers,
  buyers,
  sellers,
  pairAddress,
  baseTokenAddress,
  quoteTokenAddress,
  pooledBase,
  pooledQuote,
  pairCreated,
  websiteUrl,
  twitterUrl,
  theme = 'dark',
  className,
  onWatchlistClick,
  onAlertsClick,
  onBuyClick,
  onSellClick,
}: ProjectDetailsSidebarProps) {
  const isDark = theme === 'dark';
  
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatPrice = (price: number): string => {
    if (!price || price <= 0) return '$0.00';
    if (price >= 1000) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
    if (price >= 1) return `$${price.toFixed(4)}`;
    if (price >= 0.01) return `$${price.toFixed(6)}`;
    if (price >= 0.0001) return `$${price.toFixed(8)}`;
    if (price >= 0.000001) return `$${price.toFixed(10)}`;
    if (price >= 0.00000001) return `$${price.toFixed(12)}`;
    return `$${price.toFixed(18).replace(/\.?0+$/, '')}`;
  };

  const formatValue = (value: string | number | undefined): string => {
    if (!value) return 'N/A';
    if (typeof value === 'string') return value;
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const formatNumber = (num: number | undefined): string => {
    if (num === undefined || num === null) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toLocaleString('en-US');
  };

  const getPerformanceColor = (value: number | undefined): string => {
    if (value === undefined || value === null) return isDark ? 'text-[#6b7280]' : 'text-gray-500';
    return value >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]';
  };

  const getPerformanceBarWidth = (value: number | undefined, max: number): number => {
    if (value === undefined || value === null) return 0;
    return Math.min(Math.abs(value) / max * 100, 100);
  };

  return (
    <div className={cn(
      "w-full flex flex-col gap-4 overflow-y-auto",
      isDark ? "bg-[#1a1f2e]" : "bg-white",
      className
    )} style={{ maxHeight: 'calc(100vh - 100px)' }}>
      {/* Project Header */}
      <div className={cn(
        "px-4 py-3 border-b",
        isDark ? "border-[#1f2937]" : "border-gray-200"
      )}>
        <div className="flex items-center gap-2 mb-1">
          <span className={cn(
            "font-bold text-lg",
            isDark ? "text-white" : "text-gray-900"
          )}>
            {pair}
          </span>
          {pairNumber && (
            <span className={cn(
              "text-sm",
              isDark ? "text-[#6b7280]" : "text-gray-500"
            )}>
              #{pairNumber}
            </span>
          )}
        </div>
        <div className={cn(
          "text-xs",
          isDark ? "text-[#6b7280]" : "text-gray-500"
        )}>
          {chain} &gt; {exchange}
        </div>
      </div>

      {/* Social Media Links */}
      {(websiteUrl || twitterUrl) && (
        <div className="px-4">
          <div className="flex items-center gap-2">
            {websiteUrl && (
              <a
                href={websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "text-xs px-2 py-1 rounded",
                  isDark
                    ? "text-[#0ea5e9] hover:bg-[#252b3d]"
                    : "text-blue-600 hover:bg-gray-100"
                )}
              >
                Website
              </a>
            )}
            {twitterUrl && (
              <a
                href={twitterUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "text-xs px-2 py-1 rounded",
                  isDark
                    ? "text-[#0ea5e9] hover:bg-[#252b3d]"
                    : "text-blue-600 hover:bg-gray-100"
                )}
              >
                X (Twitter)
              </a>
            )}
          </div>
        </div>
      )}

      {/* Current Price */}
      <div className="px-4">
        <div className={cn(
          "text-xs mb-1",
          isDark ? "text-[#6b7280]" : "text-gray-500"
        )}>
          PRICE USD
        </div>
        <div className={cn(
          "text-lg font-semibold",
          isDark ? "text-white" : "text-gray-900"
        )}>
          {currentPriceUsd ? formatPrice(currentPriceUsd) : 'N/A'}
        </div>
        {currentPriceQuote && quoteSymbol && (
          <>
            <div className={cn(
              "text-xs mt-2 mb-1",
              isDark ? "text-[#6b7280]" : "text-gray-500"
            )}>
              PRICE {quoteSymbol}
            </div>
            <div className={cn(
              "text-lg font-semibold",
              isDark ? "text-white" : "text-gray-900"
            )}>
              {formatPrice(currentPriceQuote).replace('$', '')} {quoteSymbol}
            </div>
          </>
        )}
      </div>

      {/* Key Metrics */}
      <div className="px-4 space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className={cn(
              "text-xs",
              isDark ? "text-[#6b7280]" : "text-gray-500"
            )}>
              LIQUIDITY
            </span>
            <span className={cn(
              "text-xs",
              isDark ? "text-[#6b7280]" : "text-gray-400"
            )}>ⓘ</span>
          </div>
          <div className={cn(
            "text-sm font-semibold",
            isDark ? "text-white" : "text-gray-900"
          )}>
            {liquidity || formatValue(liquidity)}
          </div>
        </div>

        <div>
          <div className={cn(
            "text-xs mb-1",
            isDark ? "text-[#6b7280]" : "text-gray-500"
          )}>
            FDV
          </div>
          <div className={cn(
            "text-sm font-semibold",
            isDark ? "text-white" : "text-gray-900"
          )}>
            {fdv || formatValue(fdv)}
          </div>
        </div>

        <div>
          <div className={cn(
            "text-xs mb-1",
            isDark ? "text-[#6b7280]" : "text-gray-500"
          )}>
            MKT CAP
          </div>
          <div className={cn(
            "text-sm font-semibold",
            isDark ? "text-white" : "text-gray-900"
          )}>
            {marketCap || formatValue(marketCap)}
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="px-4 space-y-2">
        <div className={cn(
          "text-xs mb-2",
          isDark ? "text-[#6b7280]" : "text-gray-500"
        )}>
          PERFORMANCE
        </div>
        {[
          { label: '5M', value: performance5m },
          { label: '1H', value: performance1h },
          { label: '6H', value: performance6h },
          { label: '24H', value: performance24h },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between">
            <span className={cn(
              "text-xs w-8",
              isDark ? "text-[#6b7280]" : "text-gray-500"
            )}>
              {label}:
            </span>
            <span className={cn("text-xs font-medium", getPerformanceColor(value))}>
              {value !== undefined && value !== null
                ? `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
                : 'N/A'}
            </span>
          </div>
        ))}
      </div>

      {/* Transaction Statistics */}
      <div className="px-4 space-y-3">
        <div className={cn(
          "text-xs mb-2",
          isDark ? "text-[#6b7280]" : "text-gray-500"
        )}>
          TRANSACTIONS
        </div>

        {txns !== undefined && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className={cn(
                "text-xs",
                isDark ? "text-[#6b7280]" : "text-gray-500"
              )}>
                TXNS
              </span>
              <span className={cn(
                "text-xs font-semibold",
                isDark ? "text-white" : "text-gray-900"
              )}>
                {formatNumber(txns)}
              </span>
            </div>
            {buys !== undefined && sells !== undefined && (
              <div className="flex gap-1 mt-1 h-2">
                <div
                  className="bg-[#10b981] rounded"
                  style={{ width: `${(buys / txns) * 100}%` }}
                />
                <div
                  className="bg-[#ef4444] rounded"
                  style={{ width: `${(sells / txns) * 100}%` }}
                />
              </div>
            )}
          </div>
        )}

        {buys !== undefined && (
          <div className="flex items-center justify-between">
            <span className={cn(
              "text-xs",
              isDark ? "text-[#6b7280]" : "text-gray-500"
            )}>
              BUYS
            </span>
            <span className={cn(
              "text-xs font-semibold text-[#10b981]",
              isDark ? "text-[#10b981]" : "text-green-600"
            )}>
              {formatNumber(buys)}
            </span>
          </div>
        )}

        {sells !== undefined && (
          <div className="flex items-center justify-between">
            <span className={cn(
              "text-xs",
              isDark ? "text-[#6b7280]" : "text-gray-500"
            )}>
              SELLS
            </span>
            <span className={cn(
              "text-xs font-semibold text-[#ef4444]",
              isDark ? "text-[#ef4444]" : "text-red-600"
            )}>
              {formatNumber(sells)}
            </span>
          </div>
        )}

        {volume && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className={cn(
                "text-xs",
                isDark ? "text-[#6b7280]" : "text-gray-500"
              )}>
                VOLUME
              </span>
              <span className={cn(
                "text-xs font-semibold",
                isDark ? "text-white" : "text-gray-900"
              )}>
                {volume}
              </span>
            </div>
            {buyVol && sellVol && (
              <div className="flex gap-1 mt-1 h-2">
                <div
                  className="bg-[#10b981] rounded"
                  style={{ width: `${(parseFloat(buyVol.replace(/[^0-9.]/g, '')) / (parseFloat(buyVol.replace(/[^0-9.]/g, '')) + parseFloat(sellVol.replace(/[^0-9.]/g, '')))) * 100}%` }}
                />
                <div
                  className="bg-[#ef4444] rounded"
                  style={{ width: `${(parseFloat(sellVol.replace(/[^0-9.]/g, '')) / (parseFloat(buyVol.replace(/[^0-9.]/g, '')) + parseFloat(sellVol.replace(/[^0-9.]/g, '')))) * 100}%` }}
                />
              </div>
            )}
          </div>
        )}

        {buyVol && (
          <div className="flex items-center justify-between">
            <span className={cn(
              "text-xs",
              isDark ? "text-[#6b7280]" : "text-gray-500"
            )}>
              BUY VOL
            </span>
            <span className={cn(
              "text-xs font-semibold text-[#10b981]",
              isDark ? "text-[#10b981]" : "text-green-600"
            )}>
              {buyVol}
            </span>
          </div>
        )}

        {sellVol && (
          <div className="flex items-center justify-between">
            <span className={cn(
              "text-xs",
              isDark ? "text-[#6b7280]" : "text-gray-500"
            )}>
              SELL VOL
            </span>
            <span className={cn(
              "text-xs font-semibold text-[#ef4444]",
              isDark ? "text-[#ef4444]" : "text-red-600"
            )}>
              {sellVol}
            </span>
          </div>
        )}

        {makers !== undefined && (
          <div className="flex items-center justify-between">
            <span className={cn(
              "text-xs",
              isDark ? "text-[#6b7280]" : "text-gray-500"
            )}>
              MAKERS
            </span>
            <span className={cn(
              "text-xs font-semibold",
              isDark ? "text-white" : "text-gray-900"
            )}>
              {formatNumber(makers)}
            </span>
          </div>
        )}

        {buyers !== undefined && (
          <div className="flex items-center justify-between">
            <span className={cn(
              "text-xs",
              isDark ? "text-[#6b7280]" : "text-gray-500"
            )}>
              BUYERS
            </span>
            <span className={cn(
              "text-xs font-semibold",
              isDark ? "text-white" : "text-gray-900"
            )}>
              {formatNumber(buyers)}
            </span>
          </div>
        )}

        {sellers !== undefined && (
          <div className="flex items-center justify-between">
            <span className={cn(
              "text-xs",
              isDark ? "text-[#6b7280]" : "text-gray-500"
            )}>
              SELLERS
            </span>
            <span className={cn(
              "text-xs font-semibold",
              isDark ? "text-white" : "text-gray-900"
            )}>
              {formatNumber(sellers)}
            </span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="px-4 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {onWatchlistClick && (
            <Button
              variant="outline"
              size="sm"
              onClick={onWatchlistClick}
              className={cn(
                "w-full",
                isDark
                  ? "border-[#374151] text-[#9ca3af] hover:bg-[#252b3d]"
                  : "border-gray-300 text-gray-600 hover:bg-gray-100"
              )}
            >
              <Heart className="w-3 h-3 mr-1" />
              Watchlist
            </Button>
          )}
          {onAlertsClick && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAlertsClick}
              className={cn(
                "w-full",
                isDark
                  ? "border-[#374151] text-[#9ca3af] hover:bg-[#252b3d]"
                  : "border-gray-300 text-gray-600 hover:bg-gray-100"
              )}
            >
              <Bell className="w-3 h-3 mr-1" />
              Alerts
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {onBuyClick && (
            <Button
              size="sm"
              onClick={onBuyClick}
              className="w-full bg-[#10b981] hover:bg-[#059669] text-white"
            >
              <TrendingUp className="w-3 h-3 mr-1" />
              Buy
            </Button>
          )}
          {onSellClick && (
            <Button
              size="sm"
              onClick={onSellClick}
              className="w-full bg-[#ef4444] hover:bg-[#dc2626] text-white"
            >
              <TrendingDown className="w-3 h-3 mr-1" />
              Sell
            </Button>
          )}
        </div>
      </div>

      {/* Pair Information */}
      <div className={cn(
        "px-4 py-3 border-t space-y-2",
        isDark ? "border-[#1f2937]" : "border-gray-200"
      )}>
        {pairCreated && (
          <div className={cn(
            "text-xs",
            isDark ? "text-[#6b7280]" : "text-gray-500"
          )}>
            Pair created {pairCreated}
          </div>
        )}

        {pooledBase && (
          <div className={cn(
            "text-xs",
            isDark ? "text-[#6b7280]" : "text-gray-500"
          )}>
            Pooled {pooledBase}
          </div>
        )}

        {pooledQuote && (
          <div className={cn(
            "text-xs",
            isDark ? "text-[#6b7280]" : "text-gray-500"
          )}>
            Pooled {pooledQuote}
          </div>
        )}

        {pairAddress && (
          <div className="space-y-1">
            <div className={cn(
              "text-xs",
              isDark ? "text-[#6b7280]" : "text-gray-500"
            )}>
              Pair
            </div>
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-xs font-mono truncate",
                isDark ? "text-white" : "text-gray-900"
              )}>
                {pairAddress.substring(0, 8)}...{pairAddress.substring(pairAddress.length - 6)}
              </span>
              <button
                onClick={() => handleCopy(pairAddress)}
                className={cn(
                  "hover:opacity-70 transition-opacity",
                  isDark ? "text-[#6b7280]" : "text-gray-500"
                )}
                title="Copy address"
              >
                <Copy className="w-3 h-3" />
              </button>
              <a
                href={`https://solscan.io/account/${pairAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "text-[#0ea5e9] hover:underline",
                  isDark ? "text-[#0ea5e9]" : "text-blue-600"
                )}
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {baseTokenAddress && (
          <div className="space-y-1">
            <div className={cn(
              "text-xs",
              isDark ? "text-[#6b7280]" : "text-gray-500"
            )}>
              {pair.split('/')[0]}
            </div>
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-xs font-mono truncate",
                isDark ? "text-white" : "text-gray-900"
              )}>
                {baseTokenAddress.substring(0, 8)}...{baseTokenAddress.substring(baseTokenAddress.length - 6)}
              </span>
              <button
                onClick={() => handleCopy(baseTokenAddress)}
                className={cn(
                  "hover:opacity-70 transition-opacity",
                  isDark ? "text-[#6b7280]" : "text-gray-500"
                )}
                title="Copy address"
              >
                <Copy className="w-3 h-3" />
              </button>
              <a
                href={`https://solscan.io/account/${baseTokenAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "text-[#0ea5e9] hover:underline",
                  isDark ? "text-[#0ea5e9]" : "text-blue-600"
                )}
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {quoteTokenAddress && (
          <div className="space-y-1">
            <div className={cn(
              "text-xs",
              isDark ? "text-[#6b7280]" : "text-gray-500"
            )}>
              {pair.split('/')[1] || quoteSymbol}
            </div>
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-xs font-mono truncate",
                isDark ? "text-white" : "text-gray-900"
              )}>
                {quoteTokenAddress.substring(0, 8)}...{quoteTokenAddress.substring(quoteTokenAddress.length - 6)}
              </span>
              <a
                href={`https://solscan.io/account/${quoteTokenAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "text-[#0ea5e9] hover:underline",
                  isDark ? "text-[#0ea5e9]" : "text-blue-600"
                )}
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {/* Social Links */}
        {(websiteUrl || twitterUrl) && (
          <div className="space-y-2 pt-4 border-t border-[#1f2937] dark:border-gray-700">
            <div className={cn(
              "text-xs font-medium",
              isDark ? "text-[#6b7280]" : "text-gray-500"
            )}>
              Links
            </div>
            <div className="flex flex-wrap gap-2">
              {websiteUrl && (
                <a
                  href={websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "text-xs px-2 py-1 rounded border flex items-center gap-1 hover:opacity-80 transition-opacity",
                    isDark 
                      ? "border-[#374151] text-[#9ca3af] hover:bg-[#252b3d]" 
                      : "border-gray-300 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <ExternalLink className="w-3 h-3" />
                  Website
                </a>
              )}
              {twitterUrl && (
                <a
                  href={twitterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "text-xs px-2 py-1 rounded border flex items-center gap-1 hover:opacity-80 transition-opacity",
                    isDark 
                      ? "border-[#374151] text-[#9ca3af] hover:bg-[#252b3d]" 
                      : "border-gray-300 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <ExternalLink className="w-3 h-3" />
                  Twitter
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

