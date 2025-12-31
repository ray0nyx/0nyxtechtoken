import React, { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
    User as Users,
    Zap as Activity,
    BarChart2,
    Zap as Globe,
    Zap as Twitter,
    Zap as Send,
    Zap as Rocket,
    User as Shield
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { proxyImageUrl } from '@/lib/ipfs-utils';
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Progress } from "@/components/ui/progress";

export interface AxiomTokenData {
    symbol: string;
    name: string;
    mint: string;
    logoUrl?: string;
    age: string;
    createdTimestamp?: number;
    progress?: number; // Bonding curve progress 0-100
    price: number;
    priceChange: number;
    marketCap: number;
    startingMC?: number; // Original market cap at creation
    ath?: number;
    athMultiple?: number;
    volume: number;
    liquidity: number;
    holders: number;
    txns: number;
    devHolding?: number;
    snipersHolding?: number;
    top10Holding?: number;
    insidersHolding?: number;
    bundleHolding?: number;
    isPaid?: boolean;
    isGraduated?: boolean;
    platform?: 'pump' | 'raydium';
    twitter?: string;
    website?: string;
    telegram?: string;
    // Real price history for sparkline (array of prices, most recent last)
    priceHistory?: number[];
    // Market cap history for sparkline
    mcHistory?: number[];
}

interface AxiomTokenCardProps {
    token: AxiomTokenData;
    onClick?: () => void;
    onBuyClick?: () => void;
    compact?: boolean;
    realtimePrice?: number;
}

export default function AxiomTokenCard({
    token,
    onClick,
    onBuyClick,
    compact = false,
    realtimePrice,
}: AxiomTokenCardProps) {
    const [imgSrc, setImgSrc] = useState<string | undefined>(undefined);
    const [retryCount, setRetryCount] = useState(0);

    // Real-time chart history state (tracking market cap now)
    const [mcHistory, setMcHistory] = useState<number[]>(
        token.mcHistory && token.mcHistory.length > 0
            ? token.mcHistory
            : (token.marketCap ? [token.marketCap] : [])
    );

    // Track ATH dynamically
    const [athMC, setAthMC] = useState<number>(token.ath || token.marketCap || 0);

    // Update history when realtimePrice changes (derive MC from it)
    useEffect(() => {
        if (!realtimePrice) return;

        // Estimate new MC based on price movement
        const newMC = token.price > 0
            ? (realtimePrice / token.price) * token.marketCap
            : realtimePrice * 1_000_000_000;

        setMcHistory(prev => {
            const last = prev[prev.length - 1];
            if (last === newMC) return prev;
            const newHistory = [...prev, newMC];
            return newHistory.length > 30 ? newHistory.slice(newHistory.length - 30) : newHistory;
        });

        // Update ATH if new high
        if (newMC > athMC) {
            setAthMC(newMC);
        }
    }, [realtimePrice, token.price, token.marketCap, athMC]);

    // Initialize image source
    useEffect(() => {
        if (!token.logoUrl) {
            setImgSrc(undefined);
            return;
        }
        setImgSrc(proxyImageUrl(token.logoUrl));
    }, [token.logoUrl]);

    const handleImgError = () => {
        setImgSrc(undefined); // Trigger fallback UI
    };

    // Format helpers
    const formatNumber = (num: number) => {
        if (!num || isNaN(num)) return '$0';
        if (num >= 1000000000) return `$${(num / 1000000000).toFixed(2)}B`;
        if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
        if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`;
        return `$${num.toFixed(0)}`;
    };

    const formatCompact = (num: number) => {
        if (!num) return '0';
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    };

    // Calculate dynamic values
    const displayPrice = realtimePrice || token.price;
    // Estimate MC based on price movement if supply constant
    const displayMC = realtimePrice && token.price > 0
        ? (realtimePrice / token.price) * token.marketCap
        : (realtimePrice ? realtimePrice * 1_000_000_000 : token.marketCap);

    // Dynamic price change calculation relative to STARTING market cap
    const startingMC = token.startingMC || (mcHistory.length > 0 ? mcHistory[0] : token.marketCap);
    const currentMC = displayMC;

    const displayChange = startingMC > 0
        ? ((currentMC - startingMC) / startingMC) * 100
        : token.priceChange;

    const isPositive = displayChange >= 0;

    // Use MC history for chart (market cap movement)
    const chartData = useMemo(() => {
        if (mcHistory.length >= 2) {
            return mcHistory.map((val, i) => ({ i, val }));
        }
        const val = currentMC || 0;
        return [
            { i: 0, val },
            { i: 1, val }
        ];
    }, [mcHistory, currentMC]);

    return (
        <HoverCard openDelay={200} closeDelay={100}>
            {/* @ts-ignore - Radix asChild prop type mismatch often occurs with custom wrappers */}
            <HoverCardTrigger asChild>
                <div
                    onClick={onClick}
                    className={cn(
                        "relative rounded-xl border bg-black border-white/10 cursor-pointer group transition-all duration-200 hover:border-white/20 overflow-hidden",
                        compact ? "p-2" : "p-3"
                    )}
                >
                    {/* Header: Logo, Name/Symbol, Time */}
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex gap-2">
                            {/* Avatar */}
                            <div className="relative">
                                {imgSrc ? (
                                    <img
                                        src={imgSrc}
                                        alt={token.symbol}
                                        className="w-10 h-10 rounded-lg object-cover bg-black"
                                        onError={handleImgError}
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                                        {token.symbol[0]}
                                    </div>
                                )}
                                {/* Platform Badge */}
                                <div className={cn(
                                    "absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold border-2 border-black",
                                    token.platform === 'raydium' ? "bg-cyan-500 text-black" : "bg-green-500 text-black"
                                )}>
                                    {token.platform === 'raydium' ? 'R' : 'P'}
                                </div>
                            </div>

                            {/* Info */}
                            <div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-white font-bold text-sm tracking-wide">{token.symbol.toUpperCase()}</span>
                                    <span className="text-gray-500 text-xs truncate max-w-[80px]">{token.name}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-gray-400 text-xs font-mono bg-[#161B22] px-1 rounded">
                                        MC <span className={cn("font-bold", realtimePrice ? "text-green-400 animate-pulse" : "text-cyan-400")}>{formatNumber(displayMC)}</span>
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Top Right: Time, Change, and Current MC */}
                        <div className="text-right">
                            <div className="text-gray-400 text-xs font-mono mb-0.5">{token.age}</div>
                            <div className={cn(
                                "text-xs font-bold font-mono",
                                isPositive ? "text-green-400" : "text-red-400"
                            )}>
                                {isPositive ? '+' : ''}{displayChange.toFixed(2)}%
                            </div>
                            <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                                MC <span className={cn("font-bold", realtimePrice ? "text-green-400" : "text-cyan-400")}>{formatNumber(displayMC)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Middle: Sparkline Chart (Market Cap Movement) */}
                    <div className="h-12 w-full my-2 relative opacity-80 group-hover:opacity-100 transition-opacity">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <Line
                                    type="monotone"
                                    dataKey="val"
                                    stroke={isPositive ? "#4ade80" : "#f87171"}
                                    strokeWidth={2}
                                    dot={false}
                                    isAnimationActive={false}
                                />
                                <YAxis domain={['auto', 'auto']} hide />
                            </LineChart>
                        </ResponsiveContainer>

                        {/* ATH Indicator - Bottom Right under chart */}
                        <div className="absolute bottom-0 right-0 text-[9px] text-gray-500 font-mono">
                            ATH: <span className="text-cyan-400 font-bold">{formatNumber(athMC)}</span>
                        </div>
                    </div>

                    {/* Bottom: Stats Row - New Icon Layout */}
                    <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono mt-2 pt-2 border-t border-white/10">
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Volume */}
                            <span className="flex items-center gap-0.5" title="Volume">
                                <span className="font-bold text-gray-400">V</span> {formatNumber(token.volume)}
                            </span>
                            {/* Liquidity */}
                            <span className="flex items-center gap-0.5" title="Liquidity">
                                <span className="font-bold text-gray-400">L</span> {formatNumber(token.liquidity)}
                            </span>
                            {/* Holders */}
                            <span className="flex items-center gap-0.5" title="Holders">
                                <Users className="w-3 h-3 text-green-400" /> {formatCompact(token.holders)}
                            </span>
                            {/* Transactions */}
                            <span className="flex items-center gap-0.5" title="Transactions">
                                <svg className="w-3 h-3 text-green-400" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                                </svg> {token.txns}
                            </span>
                        </div>

                        {/* Trade / Quick Buy Button */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onBuyClick?.();
                            }}
                            className="bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[10px] uppercase font-bold px-3 py-1 rounded-full transition-colors flex items-center gap-1 z-10"
                        >
                            Quick Buy
                        </button>
                    </div>

                    {/* Holding Percentages Row - New Icons */}
                    <div className="flex items-center gap-2 mt-1.5 text-[9px] flex-wrap">
                        {/* Dev Holding - Star/Octopus */}
                        <span className="flex items-center gap-0.5 text-red-400" title="Dev Holding">
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg> {token.devHolding || 0}%
                        </span>
                        {/* Top 10 Holding - Whale */}
                        <span className="flex items-center gap-0.5 text-green-400" title="Top 10 Holding">
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 3C7.03 3 3 7.03 3 12s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm0 16c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7zm-1-11h2v6h-2zm0 8h2v2h-2z" />
                            </svg> {token.top10Holding || 0}%
                        </span>
                        {/* Insiders Holding - Shield */}
                        <span className="flex items-center gap-0.5 text-red-400" title="Insiders Holding">
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
                            </svg> {token.insidersHolding || 0}%
                        </span>
                        {/* Snipers Holding - Face */}
                        <span className="flex items-center gap-0.5 text-gray-400" title="Snipers Holding">
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="12" cy="12" r="10" />
                                <circle cx="9" cy="10" r="1.5" fill="black" />
                                <circle cx="15" cy="10" r="1.5" fill="black" />
                                <path d="M8 14s1.5 2 4 2 4-2 4-2" stroke="black" strokeWidth="1" fill="none" />
                            </svg> {token.snipersHolding || 0}%
                        </span>
                        {/* Bundle Holding - Molecule */}
                        <span className="flex items-center gap-0.5 text-red-400" title="Bundle Holding">
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="12" cy="6" r="3" />
                                <circle cx="6" cy="18" r="3" />
                                <circle cx="18" cy="18" r="3" />
                                <line x1="12" y1="9" x2="6" y2="15" stroke="currentColor" strokeWidth="2" />
                                <line x1="12" y1="9" x2="18" y2="15" stroke="currentColor" strokeWidth="2" />
                            </svg> {token.bundleHolding || 0}%
                        </span>

                        {token.isPaid && (
                            <span className="text-pink-400 bg-pink-400/10 px-1 rounded">Paid</span>
                        )}
                        {/* Socials Small */}
                        <div className="ml-auto flex gap-1">
                            {token.twitter && <Twitter className="w-3 h-3 text-gray-500 hover:text-cyan-400" />}
                            {token.website && <Globe className="w-3 h-3 text-gray-500 hover:text-cyan-400" />}
                            {token.telegram && <Send className="w-3 h-3 text-gray-500 hover:text-cyan-400" />}
                        </div>
                    </div>
                </div>
            </HoverCardTrigger>

            {/* Migration Progress Hover Popup */}
            {/* @ts-ignore - Content type mismatch */}
            <HoverCardContent className="w-64 bg-black border-white/10 text-gray-200">
                <div className="space-y-2">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                        <Rocket className="w-4 h-4 text-cyan-500" /> Migration Progress
                    </h4>
                    <div className="text-xs text-gray-400">
                        Bonding curve progress to Raydium
                    </div>
                    <Progress value={token.progress || 0} className="h-2 bg-gray-800" indicatorClassName="bg-gradient-to-r from-cyan-500 to-blue-500" />
                    <div className="flex justify-between text-xs font-mono">
                        <span>{token.progress?.toFixed(1)}%</span>
                        <span className="text-cyan-400">Goal: 100%</span>
                    </div>
                    {token.progress && token.progress > 95 && (
                        <div className="text-[10px] text-green-400 flex items-center gap-1 bg-green-900/20 p-1.5 rounded">
                            <Activity className="w-3 h-3" /> Imminent Migration
                        </div>
                    )}
                </div>
            </HoverCardContent>
        </HoverCard>
    );
}
