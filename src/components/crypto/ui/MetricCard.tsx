import React from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

interface MetricCardProps {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  className?: string;
  valueClassName?: string;
  trend?: 'up' | 'down' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
}

export default function MetricCard({
  label,
  value,
  change,
  changeLabel,
  icon,
  className,
  valueClassName,
  trend,
  size = 'md',
}: MetricCardProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  
  const isPositive = change !== undefined ? change >= 0 : trend === 'up';
  const isNegative = change !== undefined ? change < 0 : trend === 'down';

  const sizeClasses = {
    sm: {
      container: 'p-3',
      value: 'text-lg',
      label: 'text-xs',
      change: 'text-xs',
    },
    md: {
      container: 'p-4',
      value: 'text-2xl',
      label: 'text-sm',
      change: 'text-sm',
    },
    lg: {
      container: 'p-5',
      value: 'text-3xl',
      label: 'text-base',
      change: 'text-base',
    },
  };

  const sizes = sizeClasses[size];

  return (
    <div
      className={cn(
        'rounded-xl border',
        isDark 
          ? 'bg-[#1a1f2e] border-[#1f2937]' 
          : 'bg-white border-gray-200',
        sizes.container,
        className
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={cn(
          'font-medium',
          sizes.label,
          isDark ? 'text-[#9ca3af]' : 'text-gray-600'
        )}>
          {label}
        </span>
        {icon && <div className={isDark ? 'text-[#6b7280]' : 'text-gray-400'}>{icon}</div>}
      </div>

      <div className="flex items-end gap-2">
        <span
          className={cn(
            'font-bold',
            sizes.value,
            isDark ? 'text-white' : 'text-gray-900',
            valueClassName
          )}
        >
          {value}
        </span>

        {(change !== undefined || changeLabel) && (
          <div
            className={cn(
              'flex items-center gap-1 px-1.5 py-0.5 rounded',
              sizes.change,
              isPositive && 'text-[#10b981] bg-[#10b981]/10',
              isNegative && 'text-[#ef4444] bg-[#ef4444]/10',
              !isPositive && !isNegative && (
                isDark ? 'text-[#9ca3af] bg-[#374151]/50' : 'text-gray-600 bg-gray-100'
              )
            )}
          >
            {isPositive && <TrendingUp className="w-3 h-3" />}
            {isNegative && <TrendingDown className="w-3 h-3" />}
            <span>
              {change !== undefined
                ? `${isPositive ? '+' : ''}${change.toFixed(2)}%`
                : changeLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

