import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import MiniSparkline from '@/components/crypto/MiniSparkline';
import { useTheme } from '@/components/ThemeProvider';

interface CryptoAssetRowProps {
  icon: string | React.ReactNode;
  name: string;
  symbol: string;
  amount: number;
  price: number;
  priceUsd: number;
  change24h: number;
  sparklineData?: number[];
  onSend?: () => void;
  onReceive?: () => void;
  onTrade?: () => void;
  className?: string;
}

export default function CryptoAssetRow({
  icon,
  name,
  symbol,
  amount,
  price,
  priceUsd,
  change24h,
  sparklineData = [],
  onSend,
  onReceive,
  onTrade,
  className,
}: CryptoAssetRowProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const isPositive = change24h >= 0;

  const formatNumber = (num: number, decimals: number = 2) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(decimals)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(decimals)}K`;
    return num.toFixed(decimals);
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  return (
    <div
      className={cn(
        'flex items-center gap-4 p-4 rounded-xl border transition-colors',
        isDark 
          ? 'bg-[#1a1f2e] border-[#1f2937] hover:border-[#374151]' 
          : 'bg-white border-gray-200 hover:border-gray-300',
        className
      )}
    >
      {/* Asset Icon & Name */}
      <div className="flex items-center gap-3 min-w-[180px]">
        {typeof icon === 'string' && icon ? (
          <img
            src={icon}
            alt={name}
            className="w-10 h-10 rounded-full object-cover"
            onError={(e) => {
              // Fallback to first letter if image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const fallback = target.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
        ) : null}
        <div 
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center",
            isDark ? "bg-[#374151]" : "bg-gray-100",
            typeof icon === 'string' && icon ? "hidden" : ""
          )}
          style={{ display: typeof icon === 'string' && icon ? 'none' : 'flex' }}
        >
          {typeof icon === 'string' ? (
            <span className={cn(
              "font-bold text-sm",
              isDark ? "text-white" : "text-gray-900"
            )}>
              {symbol.charAt(0)}
            </span>
          ) : (
            icon
          )}
        </div>
        <div>
          <div className={cn(
            "font-semibold",
            isDark ? "text-white" : "text-gray-900"
          )}>{name} ({symbol})</div>
          <div className={cn(
            "text-sm",
            isDark ? "text-[#9ca3af]" : "text-gray-600"
          )}>
            {formatNumber(amount, 4)} {symbol}
          </div>
        </div>
      </div>

      {/* Price */}
      <div className="flex-1 min-w-[120px]">
        <div className={cn(
          "font-semibold",
          isDark ? "text-white" : "text-gray-900"
        )}>
          {formatNumber(price, 6)} {symbol}
        </div>
        <div className={cn(
          "text-sm",
          isDark ? "text-[#9ca3af]" : "text-gray-600"
        )}>{formatCurrency(priceUsd)}</div>
      </div>

      {/* 24h Change Sparkline */}
      <div className="flex-1 min-w-[140px] flex items-center justify-center">
        {sparklineData.length > 0 ? (
          <MiniSparkline
            data={sparklineData}
            color={isPositive ? '#10b981' : '#ef4444'}
            width={100}
            height={40}
          />
        ) : (
          <div className={cn(
            "w-[100px] h-[40px] rounded animate-pulse",
            isDark ? "bg-[#1f2937]" : "bg-gray-100"
          )} />
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onSend}
          className={cn(
            "bg-transparent",
            isDark 
              ? "border-[#374151] text-[#9ca3af] hover:text-white hover:border-[#6b7280]"
              : "border-gray-300 text-gray-700 hover:text-gray-900 hover:border-gray-400"
          )}
        >
          Send
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onReceive}
          className={cn(
            "bg-transparent",
            isDark 
              ? "border-[#374151] text-[#9ca3af] hover:text-white hover:border-[#6b7280]"
              : "border-gray-300 text-gray-700 hover:text-gray-900 hover:border-gray-400"
          )}
        >
          Receive
        </Button>
        <Button
          size="sm"
          onClick={onTrade}
          className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
        >
          Trade
        </Button>
      </div>
    </div>
  );
}

