import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { MoreHorizontal, ExternalLink, Copy, TrendingUp, TrendingDown } from 'lucide-react';

export interface Position {
    id: string;
    tokenSymbol: string;
    tokenName: string;
    tokenLogo?: string;
    tokenMint: string;
    boughtSol: number;
    soldSol: number;
    remainingSol: number;
    pnl: number;
    pnlPercent: number;
    timestamp: number;
}

interface PositionsTabProps {
    positions?: Position[];
    theme?: 'dark' | 'light';
    className?: string;
    onTokenClick?: (tokenMint: string) => void;
}

export default function PositionsTab({
    positions = [],
    theme = 'dark',
    className,
    onTokenClick,
}: PositionsTabProps) {
    const isDark = theme === 'dark';
    const [localPositions, setLocalPositions] = useState<Position[]>(positions);

    // Load positions from localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem('user_positions');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setLocalPositions(parsed);
                }
            }
        } catch (e) {
            console.warn('Failed to load positions from localStorage:', e);
        }
    }, []);

    // Update when prop positions change
    useEffect(() => {
        if (positions.length > 0) {
            setLocalPositions(positions);
        }
    }, [positions]);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const formatSol = (value: number): string => {
        if (value >= 1) return value.toFixed(2);
        if (value >= 0.01) return value.toFixed(4);
        return value.toFixed(6);
    };

    if (localPositions.length === 0) {
        return (
            <div className={cn("w-full", className)}>
                {/* Header Row */}
                <div className={cn(
                    "grid grid-cols-6 gap-4 px-4 py-2 text-xs font-medium uppercase tracking-wide",
                    isDark ? "text-neutral-500" : "text-gray-500"
                )}>
                    <div>Token</div>
                    <div className="text-right">Bought</div>
                    <div className="text-right">Sold</div>
                    <div className="text-right">Remaining</div>
                    <div className="text-right">PnL</div>
                    <div className="text-right">Actions</div>
                </div>

                {/* Empty State */}
                <div className={cn(
                    "text-center py-12",
                    isDark ? "text-neutral-500" : "text-gray-500"
                )}>
                    No positions found
                </div>
            </div>
        );
    }

    return (
        <div className={cn("w-full", className)}>
            {/* Header Row */}
            <div className={cn(
                "grid grid-cols-6 gap-4 px-4 py-2 text-xs font-medium uppercase tracking-wide border-b",
                isDark ? "text-neutral-500 border-neutral-800" : "text-gray-500 border-gray-200"
            )}>
                <div>Token</div>
                <div className="text-right">Bought</div>
                <div className="text-right">Sold</div>
                <div className="text-right">Remaining</div>
                <div className="text-right">PnL</div>
                <div className="text-right">Actions</div>
            </div>

            {/* Position Rows */}
            <div className="divide-y divide-neutral-800">
                {localPositions.map((position) => (
                    <div
                        key={position.id}
                        className={cn(
                            "grid grid-cols-6 gap-4 px-4 py-3 items-center hover:bg-neutral-900/50 transition-colors cursor-pointer",
                            isDark ? "text-white" : "text-gray-900"
                        )}
                        onClick={() => onTokenClick?.(position.tokenMint)}
                    >
                        {/* Token */}
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-neutral-700 flex items-center justify-center overflow-hidden">
                                {position.tokenLogo ? (
                                    <img src={position.tokenLogo} alt={position.tokenSymbol} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-xs text-neutral-400">{position.tokenSymbol?.charAt(0) || '?'}</span>
                                )}
                            </div>
                            <div>
                                <div className="text-sm font-medium">{position.tokenSymbol}</div>
                                <div className="text-xs text-neutral-500 truncate max-w-[80px]">
                                    {position.tokenName || position.tokenMint.slice(0, 6) + '...'}
                                </div>
                            </div>
                        </div>

                        {/* Bought */}
                        <div className="text-right">
                            <span className="text-sm text-neutral-300 font-mono">
                                {formatSol(position.boughtSol)} SOL
                            </span>
                        </div>

                        {/* Sold */}
                        <div className="text-right">
                            <span className="text-sm text-neutral-300 font-mono">
                                {formatSol(position.soldSol)} SOL
                            </span>
                        </div>

                        {/* Remaining */}
                        <div className="text-right">
                            <span className={cn(
                                "text-sm font-mono",
                                position.remainingSol > 0 ? "text-emerald-400" : "text-neutral-500"
                            )}>
                                {formatSol(position.remainingSol)} SOL
                            </span>
                        </div>

                        {/* PnL */}
                        <div className="text-right">
                            <div className="flex items-center justify-end gap-1">
                                {position.pnl >= 0 ? (
                                    <TrendingUp className="w-3 h-3 text-emerald-400" />
                                ) : (
                                    <TrendingDown className="w-3 h-3 text-red-400" />
                                )}
                                <span className={cn(
                                    "text-sm font-mono font-medium",
                                    position.pnl >= 0 ? "text-emerald-400" : "text-red-400"
                                )}>
                                    {position.pnl >= 0 ? '+' : ''}{formatSol(position.pnl)} SOL
                                </span>
                            </div>
                            <div className={cn(
                                "text-xs",
                                position.pnlPercent >= 0 ? "text-emerald-400/70" : "text-red-400/70"
                            )}>
                                ({position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%)
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="text-right flex items-center justify-end gap-1">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    copyToClipboard(position.tokenMint);
                                }}
                                className="p-1.5 hover:bg-neutral-700 rounded transition-colors"
                                title="Copy token address"
                            >
                                <Copy className="w-3.5 h-3.5 text-neutral-400 hover:text-white" />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(`https://solscan.io/token/${position.tokenMint}`, '_blank');
                                }}
                                className="p-1.5 hover:bg-neutral-700 rounded transition-colors"
                                title="View on Solscan"
                            >
                                <ExternalLink className="w-3.5 h-3.5 text-neutral-400 hover:text-white" />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                }}
                                className="p-1.5 hover:bg-neutral-700 rounded transition-colors"
                                title="More actions"
                            >
                                <MoreHorizontal className="w-3.5 h-3.5 text-neutral-400 hover:text-white" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
