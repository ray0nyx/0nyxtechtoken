import React from 'react';
import { cn } from '@/lib/utils';
import { Star, Bell, ExternalLink, Copy, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TokenHeaderBarProps {
  tokenName: string;
  tokenSymbol: string;
  tokenLogo?: string;
  marketCap: string;
  price: number;
  liquidity: string;
  supply?: string;
  globalFeesPaid?: string;
  age?: string;
  isVerified?: boolean;
  isFavorite?: boolean;
  onFavoriteToggle?: () => void;
  onAlertClick?: () => void;
  theme?: 'dark' | 'light';
  className?: string;
}

export default function TokenHeaderBar({
  tokenName,
  tokenSymbol,
  tokenLogo,
  marketCap,
  price,
  liquidity,
  supply = '1B',
  globalFeesPaid = '260.7',
  age = '2mo',
  isVerified = false,
  isFavorite = false,
  onFavoriteToggle,
  onAlertClick,
  theme = 'dark',
  className,
}: TokenHeaderBarProps) {
  const isDark = theme === 'dark';
  const [copied, setCopied] = React.useState(false);

  const formatPrice = (p: number): string => {
    if (!p || p <= 0) return '$0.00';
    if (p >= 1) return `$${p.toFixed(3)}`;
    if (p >= 0.01) return `$${p.toFixed(4)}`;
    if (p >= 0.0001) return `$${p.toFixed(6)}`;
    return `$${p.toFixed(8)}`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(tokenSymbol);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn(
      "flex items-center justify-between px-4 py-2 border-b",
      isDark ? "bg-[#0a0e17] border-[#1f2937]" : "bg-white border-gray-200",
      className
    )}>
      {/* Left Section - Token Info */}
      <div className="flex items-center gap-4">
        {/* Token Logo & Name */}
        <div className="flex items-center gap-3">
          {tokenLogo ? (
            <>
              <img
                src={tokenLogo}
                alt={tokenSymbol}
                className="w-10 h-10 rounded-full"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
              <div className={cn(
                "hidden w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold absolute",
                isDark ? "bg-[#1f2937] text-white" : "bg-gray-200 text-gray-800"
              )}>
                {tokenSymbol.charAt(0)}
              </div>
            </>
          ) : (
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold",
              isDark ? "bg-[#1f2937] text-white" : "bg-gray-200 text-gray-800"
            )}>
              {tokenSymbol.charAt(0)}
            </div>
          )}

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-lg font-bold",
                isDark ? "text-white" : "text-gray-900"
              )}>
                {tokenSymbol}
              </span>
              <span className={cn(
                "text-sm",
                isDark ? "text-gray-400" : "text-gray-600"
              )}>
                {tokenName}
              </span>
              {isVerified && (
                <CheckCircle2 className="w-4 h-4 text-blue-500" />
              )}
              <button
                onClick={handleCopy}
                className={cn(
                  "p-1 rounded hover:bg-opacity-50",
                  isDark ? "hover:bg-[#1f2937]" : "hover:bg-gray-100"
                )}
              >
                {copied ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-400" />
                )}
              </button>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className={cn(
                "px-1.5 py-0.5 rounded",
                isDark ? "bg-green-500/20 text-green-400" : "bg-green-100 text-green-700"
              )}>
                {age}
              </span>
              <div className="flex items-center gap-1 text-gray-400">
                <span className="cursor-pointer hover:underline">88</span>
                <span>·</span>
                <span className="cursor-pointer hover:underline">🔗</span>
              </div>
            </div>
          </div>
        </div>

        {/* Market Cap - Large Display */}
        <div className={cn(
          "text-2xl font-bold ml-4",
          isDark ? "text-white" : "text-gray-900"
        )}>
          {marketCap}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 ml-4">
          <div className="flex flex-col">
            <span className={cn(
              "text-xs",
              isDark ? "text-gray-500" : "text-gray-400"
            )}>Price</span>
            <span className={cn(
              "text-sm font-medium",
              isDark ? "text-white" : "text-gray-900"
            )}>{formatPrice(price)}</span>
          </div>

          <div className="flex flex-col">
            <span className={cn(
              "text-xs",
              isDark ? "text-gray-500" : "text-gray-400"
            )}>Liquidity</span>
            <span className={cn(
              "text-sm font-medium",
              isDark ? "text-white" : "text-gray-900"
            )}>{liquidity}</span>
          </div>

          <div className="flex flex-col">
            <span className={cn(
              "text-xs",
              isDark ? "text-gray-500" : "text-gray-400"
            )}>Supply</span>
            <span className={cn(
              "text-sm font-medium",
              isDark ? "text-white" : "text-gray-900"
            )}>{supply}</span>
          </div>

          <div className="flex flex-col">
            <span className={cn(
              "text-xs",
              isDark ? "text-gray-500" : "text-gray-400"
            )}>Global Fees Paid</span>
            <span className={cn(
              "text-sm font-medium flex items-center gap-1",
              isDark ? "text-white" : "text-gray-900"
            )}>
              <span className="text-purple-400">◎</span> {globalFeesPaid}
            </span>
          </div>
        </div>
      </div>

      {/* Right Section - Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onFavoriteToggle}
          className={cn(
            "p-2",
            isFavorite ? "text-yellow-400" : isDark ? "text-gray-400" : "text-gray-600"
          )}
        >
          <Star className={cn("w-5 h-5", isFavorite && "fill-yellow-400")} />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "gap-2",
            isDark ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900"
          )}
        >
          <ExternalLink className="w-4 h-4" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onAlertClick}
          className={cn(
            "gap-2",
            isDark
              ? "border-[#1f2937] text-gray-300 hover:bg-[#1f2937]"
              : "border-gray-300 text-gray-700 hover:bg-gray-100"
          )}
        >
          <Bell className="w-4 h-4" />
          Alert
        </Button>
      </div>
    </div>
  );
}
