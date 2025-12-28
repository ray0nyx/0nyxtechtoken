import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface QuickBuyButtonsProps {
  onBuy: (amount: number) => void;
  onSell?: (amount: number) => void;
  disabled?: boolean;
  theme?: 'dark' | 'light';
  className?: string;
}

const PRESET_AMOUNTS = [0.5, 1, 2, 5, 10];

export default function QuickBuyButtons({
  onBuy,
  onSell,
  disabled = false,
  theme = 'dark',
  className,
}: QuickBuyButtonsProps) {
  const isDark = theme === 'dark';
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [customAmount, setCustomAmount] = useState<string>('');

  const handlePresetClick = (amount: number) => {
    if (mode === 'buy') {
      onBuy(amount);
    } else if (onSell) {
      onSell(amount);
    }
  };

  const handleCustomSubmit = () => {
    const amount = parseFloat(customAmount);
    if (!isNaN(amount) && amount > 0) {
      if (mode === 'buy') {
        onBuy(amount);
      } else if (onSell) {
        onSell(amount);
      }
    }
  };

  const isBuyMode = mode === 'buy';

  return (
    <div className={cn(
      "flex flex-wrap gap-2",
      className
    )}>
      {/* Preset Amount Buttons */}
      {PRESET_AMOUNTS.map((amount) => (
        <button
          key={amount}
          onClick={() => handlePresetClick(amount)}
          disabled={disabled}
          className={cn(
            "px-4 py-1.5 rounded-md text-xs font-medium transition-colors shadow-sm",
            isBuyMode
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {isBuyMode ? 'Buy' : 'Sell'} {amount} SOL
        </button>
      ))}

      {/* Custom Amount Input */}
      <div className="flex items-center gap-1">
        <Input
          type="number"
          value={customAmount}
          onChange={(e) => setCustomAmount(e.target.value)}
          placeholder="Custom"
          className={cn(
            "w-20 h-8 text-xs rounded-md",
            isDark
              ? "bg-[#0a0a0a] border-neutral-800 text-gray-200 placeholder:text-neutral-600"
              : "bg-white border-gray-200 text-gray-900"
          )}
        />
        <button
          onClick={handleCustomSubmit}
          disabled={disabled || !customAmount}
          className={cn(
            "px-4 py-1.5 rounded-md text-xs font-medium transition-colors shadow-sm",
            isBuyMode
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20",
            (disabled || !customAmount) && "opacity-50 cursor-not-allowed"
          )}
        >
          {isBuyMode ? 'Buy' : 'Sell'}
        </button>
      </div>

      {/* Mode Toggle */}
      <button
        onClick={() => setMode(mode === 'buy' ? 'sell' : 'buy')}
        className={cn(
          "px-4 py-1.5 rounded-md text-xs font-medium transition-colors border shadow-sm",
          isBuyMode
            ? "bg-[#0a0a0a] border-neutral-800 text-neutral-400 hover:bg-neutral-800 hover:text-gray-300"
            : "bg-[#0a0a0a] border-neutral-800 text-neutral-400 hover:bg-neutral-800 hover:text-gray-300"
        )}
      >
        {isBuyMode ? 'Sell Mode' : 'Buy Mode'}
      </button>
    </div>
  );
}
