import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import MiniSparkline from '@/components/crypto/MiniSparkline';

interface TraderRowProps {
  avatar?: string;
  name: string;
  blockchain: 'SOL' | 'BTC' | 'ETH';
  performance: number;
  period?: string;
  sparklineData?: number[];
  onCopy?: () => void;
  className?: string;
  compact?: boolean;
}

const blockchainColors: Record<string, string> = {
  SOL: 'bg-gradient-to-r from-purple-500 to-teal-400',
  BTC: 'bg-gradient-to-r from-orange-400 to-yellow-500',
  ETH: 'bg-gradient-to-r from-blue-400 to-purple-500',
};

export default function TraderRow({
  avatar,
  name,
  blockchain,
  performance,
  period = '30d',
  sparklineData = [],
  onCopy,
  className,
  compact = false,
}: TraderRowProps) {
  const isPositive = performance >= 0;

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 bg-[#1a1f2e] rounded-xl hover:bg-[#252b3d] transition-colors',
        compact && 'p-2',
        className
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'rounded-full flex items-center justify-center text-white font-bold flex-shrink-0',
          blockchainColors[blockchain] || 'bg-[#374151]',
          compact ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'
        )}
      >
        {avatar ? (
          <img src={avatar} alt={name} className="w-full h-full rounded-full object-cover" />
        ) : (
          name.charAt(0).toUpperCase()
        )}
      </div>

      {/* Name & Performance */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('font-semibold text-white truncate', compact && 'text-sm')}>
            {name}
          </span>
          <span className="text-xs text-[#6b7280]">({blockchain})</span>
        </div>
        <div
          className={cn(
            'text-sm font-medium',
            isPositive ? 'text-[#10b981]' : 'text-[#ef4444]'
          )}
        >
          {isPositive ? '+' : ''}{performance.toFixed(0)}% {period}
        </div>
      </div>

      {/* Sparkline */}
      {!compact && sparklineData.length > 0 && (
        <div className="hidden sm:block">
          <MiniSparkline
            data={sparklineData}
            color={isPositive ? '#10b981' : '#ef4444'}
            width={60}
            height={30}
          />
        </div>
      )}

      {/* Copy Button */}
      <Button
        size="sm"
        onClick={onCopy}
        className={cn(
          'bg-[#3b82f6] hover:bg-[#2563eb] text-white flex-shrink-0',
          compact && 'text-xs px-3 py-1 h-7'
        )}
      >
        Copy
      </Button>
    </div>
  );
}

