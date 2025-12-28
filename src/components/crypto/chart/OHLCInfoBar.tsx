import React from 'react';
import { cn } from '@/lib/utils';

interface OHLCInfoBarProps {
    symbol?: string;
    exchange?: string;
    open?: number;
    high?: number;
    low?: number;
    close?: number;
    change?: number;
    changePercent?: number;
    volume?: number;
    displayMode?: 'price' | 'marketCap';
    className?: string;
}

/**
 * Format price/value for display with K/M/B suffixes
 */
function formatValue(value: number | undefined, displayMode: 'price' | 'marketCap' = 'price'): string {
    if (value === undefined || value === null || isNaN(value)) return '-';

    if (displayMode === 'marketCap') {
        if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
        if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
        if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
        return value.toFixed(2);
    }

    // Price formatting for small values (meme coins)
    if (value >= 1000) return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (value >= 1) return value.toFixed(4);
    if (value >= 0.01) return value.toFixed(6);
    if (value >= 0.0001) return value.toFixed(8);
    if (value >= 0.000001) return value.toFixed(10);
    return value.toFixed(12);
}

/**
 * Format change percentage
 */
function formatChange(change: number | undefined, percent: number | undefined): string {
    if (change === undefined || percent === undefined) return '';

    const sign = change >= 0 ? '+' : '';
    const absChange = Math.abs(change);

    let changeStr: string;
    if (absChange >= 1000) {
        changeStr = (absChange / 1000).toFixed(2) + 'K';
    } else if (absChange >= 1) {
        changeStr = absChange.toFixed(2);
    } else {
        changeStr = absChange.toFixed(6);
    }

    return `${sign}${changeStr} (${sign}${percent.toFixed(2)}%)`;
}

export default function OHLCInfoBar({
    symbol = '',
    exchange = '',
    open,
    high,
    low,
    close,
    change,
    changePercent,
    volume,
    displayMode = 'price',
    className,
}: OHLCInfoBarProps) {
    const isPositive = (change ?? 0) >= 0;

    return (
        <div
            className={cn(
                'flex items-center gap-4 px-3 py-1.5 bg-[#0d0d12] text-xs font-mono',
                className
            )}
        >
            {/* Symbol & Exchange */}
            {symbol && (
                <div className="flex items-center gap-2">
                    <span className="text-white font-semibold">{symbol}</span>
                    {exchange && (
                        <span className="text-white/40">on {exchange}</span>
                    )}
                </div>
            )}

            {/* Status Dot */}
            <div className="flex items-center gap-1">
                <div className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    isPositive ? 'bg-emerald-400' : 'bg-red-400'
                )} />
            </div>

            {/* OHLC Values */}
            <div className="flex items-center gap-3 text-white/70">
                <span>
                    <span className="text-white/40">O:</span>
                    <span className="text-cyan-400 ml-0.5">{formatValue(open, displayMode)}</span>
                </span>
                <span>
                    <span className="text-white/40">H:</span>
                    <span className="text-emerald-400 ml-0.5">{formatValue(high, displayMode)}</span>
                </span>
                <span>
                    <span className="text-white/40">L:</span>
                    <span className="text-red-400 ml-0.5">{formatValue(low, displayMode)}</span>
                </span>
                <span>
                    <span className="text-white/40">C:</span>
                    <span className={cn(
                        'ml-0.5',
                        isPositive ? 'text-emerald-400' : 'text-red-400'
                    )}>
                        {formatValue(close, displayMode)}
                    </span>
                </span>
            </div>

            {/* Change */}
            {(change !== undefined || changePercent !== undefined) && (
                <span className={cn(
                    'font-medium',
                    isPositive ? 'text-emerald-400' : 'text-red-400'
                )}>
                    {formatChange(change, changePercent)}
                </span>
            )}

            {/* Volume (optional) */}
            {volume !== undefined && volume > 0 && (
                <span className="text-white/40 ml-auto">
                    Vol: <span className="text-white/60">{formatValue(volume, 'marketCap')}</span>
                </span>
            )}
        </div>
    );
}
