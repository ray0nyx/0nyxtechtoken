import React from 'react';
import { cn } from '@/lib/utils';
import { ArrowUpRight } from 'lucide-react';

export interface CoinCardData {
    symbol: string;
    name: string;
    address: string;
    pairAddress: string;
    logoUrl?: string;
    price: number;
    priceUsd: number;
    marketCap: number;
    change24h: number;
    volume24h: number;
    liquidity: number;
    holders?: number;
    txns?: number;
    buys?: number;
    sells?: number;
    age: string;
    ath?: number;
    athMultiple?: number;
    dexId: string;
    socialLinks?: {
        website?: string;
        twitter?: string;
        telegram?: string;
    };
    isPaid?: boolean;
    isGraduated?: boolean;
    raydiumPool?: string;
    // New fields for stats
    devHolding?: number;
    top10Holding?: number;
    snipersHolding?: number;
}

interface CoinCardProps {
    coin: CoinCardData;
    onClick?: () => void;
    onBuyClick?: () => void;
    theme?: 'dark' | 'light';
    showUsd?: boolean;
}

export default function CoinCard({
    coin,
    onClick,
    onBuyClick,
    theme = 'dark',
    showUsd = true,
}: CoinCardProps) {
    const isDark = theme === 'dark';

    const formatNumber = (num: number, decimals: number = 2) => {
        if (!num || isNaN(num)) return '$0';
        if (num >= 1000000000) return `$${(num / 1000000000).toFixed(decimals)}B`;
        if (num >= 1000000) return `$${(num / 1000000).toFixed(decimals)}M`;
        if (num >= 1000) return `$${(num / 1000).toFixed(decimals)}K`;
        return `$${num.toFixed(decimals)}`;
    };

    const formatPrice = (price: number) => {
        if (!price || isNaN(price)) return '$0.00';
        if (price >= 1000000) return `$${(price / 1000000).toFixed(2)}M`;
        if (price >= 1000) return `$${(price / 1000).toFixed(2)}K`;
        if (price < 0.000001) return `$${price.toExponential(2)}`;
        if (price < 0.01) return `$${price.toFixed(8)}`;
        if (price < 1) return `$${price.toFixed(6)}`;
        return `$${price.toFixed(2)}`;
    };

    const formatShortNumber = (num: number) => {
        if (!num) return '0';
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    };

    const isPositive = coin.change24h >= 0;

    return (
        <div
            onClick={onClick}
            className={cn(
                "rounded-lg p-3 border cursor-pointer transition-all duration-200",
                isDark
                    ? "bg-[#0d1117] border-[#1e2530] hover:border-[#3b4654]"
                    : "bg-white border-gray-200 hover:border-gray-400"
            )}
        >
            {/* Row 1: Logo + Name/Symbol/Age + Price */}
            <div className="flex items-start gap-3 mb-2">
                {/* Token Logo with platform badge */}
                <div className="relative flex-shrink-0">
                    {coin.logoUrl ? (
                        <img
                            src={coin.logoUrl}
                            alt={coin.symbol}
                            className="w-12 h-12 rounded-full object-cover border-2 border-[#1e2530]"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const fallback = target.nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = 'flex';
                            }}
                        />
                    ) : null}
                    <div
                        className={cn(
                            "w-12 h-12 rounded-full items-center justify-center text-lg font-bold",
                            "bg-gradient-to-br from-purple-600 to-cyan-500 text-white",
                            coin.logoUrl ? "hidden" : "flex"
                        )}
                        style={{ display: coin.logoUrl ? 'none' : 'flex' }}
                    >
                        {coin.symbol.charAt(0)}
                    </div>
                    {/* Platform badge - bottom left */}
                    <div className={cn(
                        "absolute -bottom-0.5 -left-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold",
                        coin.dexId === 'raydium' || coin.isGraduated
                            ? "bg-blue-500 text-white"
                            : "bg-green-500 text-white"
                    )}>
                        {coin.dexId === 'raydium' || coin.isGraduated ? 'R' : 'P'}
                    </div>
                </div>

                {/* Name, Symbol, Age, Social Links */}
                <div className="flex-1 min-w-0">
                    {/* Symbol and Name row */}
                    <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={cn(
                            "font-bold text-sm truncate",
                            isDark ? "text-white" : "text-gray-900"
                        )}>
                            {coin.symbol}
                        </span>
                        <span className={cn(
                            "text-xs truncate max-w-[80px]",
                            isDark ? "text-gray-500" : "text-gray-400"
                        )}>
                            {coin.name}
                        </span>
                        {coin.isGraduated && (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-blue-500/20 text-blue-400 font-medium">
                                ✓
                            </span>
                        )}
                    </div>

                    {/* Age and social links row */}
                    <div className="flex items-center gap-2">
                        <span className="text-cyan-400 text-xs font-medium">{coin.age}</span>
                        {coin.isPaid && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-amber-500/20 text-amber-400 font-bold">
                                USDT
                            </span>
                        )}
                        {/* Social icons */}
                        <div className="flex items-center gap-1.5">
                            {coin.socialLinks?.twitter && (
                                <a
                                    href={coin.socialLinks.twitter}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-gray-500 hover:text-cyan-400 transition-colors text-xs"
                                >
                                    𝕏
                                </a>
                            )}
                            {coin.socialLinks?.website && (
                                <a
                                    href={coin.socialLinks.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-gray-500 hover:text-cyan-400 transition-colors text-xs"
                                >
                                    🌐
                                </a>
                            )}
                            {coin.socialLinks?.telegram && (
                                <a
                                    href={coin.socialLinks.telegram}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-gray-500 hover:text-cyan-400 transition-colors text-xs"
                                >
                                    ✈️
                                </a>
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (coin.address) {
                                        window.open(`https://solscan.io/token/${coin.address}`, '_blank');
                                    }
                                }}
                                className="text-gray-500 hover:text-cyan-400 transition-colors text-xs"
                            >
                                🔍
                            </button>
                        </div>
                    </div>
                </div>

                {/* Age indicator - top right */}
                <div className="text-xs text-gray-500 flex-shrink-0">
                    {coin.age}
                </div>
            </div>

            {/* Row 2: MC and Price with change */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                    <span className="text-gray-500 text-xs">MC</span>
                    <span className="text-cyan-400 text-sm font-semibold">
                        {formatNumber(coin.marketCap)}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <span className={cn(
                        "text-sm font-bold",
                        isPositive ? "text-green-400" : "text-red-400"
                    )}>
                        {formatPrice(showUsd ? coin.priceUsd : coin.price)}
                    </span>
                    {coin.change24h !== 0 && (
                        <span className={cn(
                            "text-xs",
                            isPositive ? "text-green-400" : "text-red-400"
                        )}>
                            {isPositive ? '+' : ''}{coin.change24h.toFixed(1)}%
                        </span>
                    )}
                </div>
            </div>

            {/* Row 3: ATH */}
            {coin.ath && coin.ath > 0 && (
                <div className="flex items-center justify-end gap-2 mb-2 text-xs">
                    <span className="text-gray-500">ATH</span>
                    <span className="text-gray-400">{formatNumber(coin.ath)}</span>
                    {coin.athMultiple && (
                        <span className="text-gray-400">{coin.athMultiple.toFixed(2)}x</span>
                    )}
                </div>
            )}

            {/* Row 4: Stats row - V, L, Holders, Txns */}
            <div className="flex items-center justify-between text-[10px] text-gray-500 mb-2">
                <div className="flex items-center gap-2">
                    <span>V {formatNumber(coin.volume24h, 1)}</span>
                    <span>L {formatNumber(coin.liquidity, 1)}</span>
                    {coin.holders && coin.holders > 0 && (
                        <span>👥 {formatShortNumber(coin.holders)}</span>
                    )}
                    {coin.txns && coin.txns > 0 && (
                        <span>📊 {coin.txns}</span>
                    )}
                </div>
            </div>

            {/* Row 5: Percentage stats (dev, holders, etc) */}
            <div className="flex items-center gap-2 text-[10px] mb-3">
                {coin.devHolding !== undefined && (
                    <span className={cn(
                        "px-1.5 py-0.5 rounded",
                        coin.devHolding > 5 ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"
                    )}>
                        🔹 {coin.devHolding}%
                    </span>
                )}
                {coin.top10Holding !== undefined && (
                    <span className={cn(
                        "px-1.5 py-0.5 rounded",
                        coin.top10Holding > 50 ? "bg-yellow-500/20 text-yellow-400" : "bg-green-500/20 text-green-400"
                    )}>
                        👑 {coin.top10Holding}%
                    </span>
                )}
                <span className="px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-400">
                    ⚡ 0%
                </span>
                <span className="px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-400">
                    🔥 0%
                </span>
            </div>

            {/* Buy Button */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onBuyClick?.();
                }}
                className={cn(
                    "w-full py-2 rounded-lg text-sm font-semibold transition-all",
                    "bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400",
                    "text-white flex items-center justify-center gap-1"
                )}
            >
                <ArrowUpRight className="w-4 h-4" />
            </button>
        </div>
    );
}
