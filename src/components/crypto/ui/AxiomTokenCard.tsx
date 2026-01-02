import React, { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
    Users,
    Zap,
    ChefHat,
    Crosshair,
    Ghost,
    Share2,
    Star,
    Rocket,
    Twitter,
    Globe,
    Send,
    Activity,
    Copy,
    Check,
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { proxyImageUrl } from '@/lib/ipfs-utils';
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
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
    // Timestamp when first discovered or moved into a specific section
    discoveryTimestamp?: number;
}

interface AxiomTokenCardProps {
    token: AxiomTokenData;
    onClick?: () => void;
    onBuyClick?: (amount?: number) => void;
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
    const [quickBuyAmount, setQuickBuyAmount] = useState<number>(0.1);
    const [showQuickBuyMenu, setShowQuickBuyMenu] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopyCA = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(token.mint);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    useEffect(() => {
        const saved = localStorage.getItem('quickBuyAmount');
        if (saved) {
            setQuickBuyAmount(parseFloat(saved));
        }
    }, []);

    // Real-time chart history - prioritize mcHistory from props (from priceCache), fallback to local state
    const [localMcHistory, setLocalMcHistory] = useState<number[]>(
        token.mcHistory && token.mcHistory.length > 0
            ? token.mcHistory
            : (token.marketCap ? [token.marketCap] : [])
    );

    // The effective mcHistory to use - prefer prop if available (from priceCache)
    const effectiveMcHistory = (token.mcHistory && token.mcHistory.length > 1)
        ? token.mcHistory
        : localMcHistory;

    // Track ATH dynamically
    const [athMC, setAthMC] = useState<number>(token.ath || token.marketCap || 0);

    // Update local history when token.marketCap changes (for tokens not in priceCache)
    useEffect(() => {
        const newMC = token.marketCap;
        if (!newMC || newMC === 0) return;

        setLocalMcHistory(prev => {
            const last = prev[prev.length - 1];
            if (last === newMC) return prev;
            const newHistory = [...prev, newMC];
            return newHistory.length > 30 ? newHistory.slice(-30) : newHistory;
        });

        // Update ATH if new high
        setAthMC(prev => Math.max(prev, newMC));
    }, [token.marketCap]);

    // Sync local history if prop history is provided and better
    useEffect(() => {
        if (token.mcHistory && token.mcHistory.length > localMcHistory.length) {
            setLocalMcHistory(token.mcHistory);
        }
    }, [token.mcHistory, localMcHistory.length]);

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

    // Track initial MC (the MC when token was first displayed) - this NEVER updates after first render
    const [initialMC] = useState<number>(() => {
        // Priority: startingMC prop > first history value > current marketCap
        if (token.startingMC && token.startingMC > 0) return token.startingMC;
        if (token.mcHistory && token.mcHistory.length > 0) return token.mcHistory[0];
        return token.marketCap || 0;
    });

    // Track current MC for display - syncing with props (this is the LIVE value)
    const [currentMC, setCurrentMC] = useState<number>(token.marketCap || 0);

    // Sync state with prop updates (polling from parent)
    useEffect(() => {
        if (token.marketCap && token.marketCap !== currentMC) {
            setCurrentMC(token.marketCap);
            // ATH update is handled in the earlier effect
        }
    }, [token.marketCap, currentMC]);

    // Calculate display values
    const displayPrice = realtimePrice || token.price;

    // Live MC - use the most recent value from history or currentMC
    const liveMC = effectiveMcHistory.length > 0
        ? effectiveMcHistory[effectiveMcHistory.length - 1]
        : currentMC;

    // Final display MC ensures we never show $0
    const finalDisplayMC = liveMC > 0 ? liveMC : currentMC;

    // Dynamic price change calculation
    // Calculate change relative to initialMC (the starting point) for real-time percentage updates
    const calculateChange = () => {
        // Always calculate relative to initialMC if we have a valid value
        if (initialMC && initialMC > 0 && finalDisplayMC > 0) {
            return ((finalDisplayMC - initialMC) / initialMC) * 100;
        }
        // Fallback to startingMC prop if initialMC wasn't captured
        if (token.startingMC && token.startingMC > 0) {
            return ((finalDisplayMC - token.startingMC) / token.startingMC) * 100;
        }
        return token.priceChange;
    };

    const displayChange = calculateChange();
    const isPositive = displayChange >= 0;

    // Use MC history for chart (market cap movement)
    const chartData = useMemo(() => {
        if (effectiveMcHistory.length >= 2) {
            return effectiveMcHistory.map((val, i) => ({ i, val }));
        }
        const val = currentMC || 0;
        return [
            { i: 0, val },
            { i: 1, val }
        ];
    }, [effectiveMcHistory, currentMC]);

    return (
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
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                            <span className="text-white font-bold text-sm tracking-wide">{token.symbol.toUpperCase()}</span>
                            <span className="text-gray-500 text-xs truncate">{token.name}</span>
                            <button
                                onClick={handleCopyCA}
                                className="flex-shrink-0 text-gray-500 hover:text-cyan-400 transition-colors p-0.5"
                                title="Copy Contract Address"
                            >
                                {copied ? (
                                    <Check className="w-3 h-3 text-green-400" />
                                ) : (
                                    <Copy className="w-3 h-3" />
                                )}
                            </button>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-gray-400 text-xs font-mono bg-[#161B22] px-1 rounded">
                                MC <span className="font-bold text-cyan-400">{formatNumber(initialMC)}</span>
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
                    <div className="text-[10px] text-gray-500 font-mono mt-0.5 flex items-center justify-end gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                        <span>MC <span className={cn("font-bold", "text-green-400")}>{formatNumber(finalDisplayMC)}</span></span>
                    </div>
                </div>
            </div>

            {/* Middle: Sparkline Chart (Market Cap Movement) - Hover for Migration Progress */}
            <HoverCard openDelay={200} closeDelay={100}>
                <HoverCardTrigger asChild>
                    <div className="h-12 w-full my-2 relative opacity-80 group-hover:opacity-100 transition-opacity cursor-help">
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
                </HoverCardTrigger>

                {/* Migration Progress Hover Popup */}
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

            {/* Bottom: Stats Row */}
            <TooltipProvider delayDuration={0}>
                <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono mt-2 pt-2 border-t border-white/10">
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Volume */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="flex items-center gap-0.5 cursor-help">
                                    <span className="font-bold text-yellow-400">V</span> {formatNumber(token.volume)}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent className="bg-black border-white/20 text-white text-xs">
                                Total Volume
                            </TooltipContent>
                        </Tooltip>
                        {/* Liquidity */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="flex items-center gap-0.5 cursor-help">
                                    <span className="font-bold text-yellow-400">L</span> {formatNumber(token.liquidity)}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent className="bg-black border-white/20 text-white text-xs">
                                Total Liquidity
                            </TooltipContent>
                        </Tooltip>
                        {/* Holders */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="flex items-center gap-0.5 cursor-help">
                                    <Users className="w-3 h-3 text-yellow-400" /> {formatCompact(token.holders)}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent className="bg-black border-white/20 text-white text-xs">
                                Token Holders
                            </TooltipContent>
                        </Tooltip>
                    </div>

                    {/* Trade / Quick Buy Button */}
                    <div className="relative z-10"
                        onMouseEnter={() => setShowQuickBuyMenu(true)}
                        onMouseLeave={() => setShowQuickBuyMenu(false)}
                    >
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onBuyClick?.(quickBuyAmount);
                            }}
                            className="bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[10px] uppercase font-bold px-3 py-1 rounded-full transition-colors flex items-center gap-1"
                        >
                            Quick Buy {quickBuyAmount} SOL
                        </button>

                        {/* Quick Buy Amount Selector */}
                        {showQuickBuyMenu && (
                            <div className="absolute bottom-full right-0 pb-2 z-50 w-24">
                                <div className="bg-black border border-white/20 rounded-lg p-1.5 flex flex-col gap-1 shadow-xl max-h-32 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                                    <div className="text-[9px] text-gray-400 text-center mb-1 sticky top-0 bg-black pb-1 border-b border-white/10">Select Amount</div>
                                    {[0.01, 0.1, 0.5, 1, 5, 10].map(amount => (
                                        <button
                                            key={amount}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setQuickBuyAmount(amount);
                                                localStorage.setItem('quickBuyAmount', amount.toString());
                                                setShowQuickBuyMenu(false);
                                            }}
                                            className={cn(
                                                "text-[10px] font-mono px-2 py-1.5 rounded hover:bg-white/10 text-left transition-colors flex justify-between items-center shrink-0",
                                                quickBuyAmount === amount ? "text-cyan-400 bg-white/5" : "text-gray-300"
                                            )}
                                        >
                                            <span>{amount}</span>
                                            <span className="opacity-50">SOL</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </TooltipProvider>

            {/* Holding Percentages Row */}
            <TooltipProvider delayDuration={0}>
                <div className="flex items-center gap-2 mt-1.5 text-[9px] flex-wrap">
                    {/* Top 10 Holding - Star */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="flex items-center gap-0.5 text-gray-300 cursor-help">
                                <Star className="w-3 h-3 text-yellow-400" /> {token.top10Holding || 0}%
                            </span>
                        </TooltipTrigger>
                        <TooltipContent className="bg-black border-white/20 text-white text-xs">
                            Top 10%
                        </TooltipContent>
                    </Tooltip>
                    {/* Dev Holding - Chef Hat */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="flex items-center gap-0.5 text-gray-300 cursor-help">
                                <ChefHat className="w-3 h-3 text-yellow-400" /> {token.devHolding || 0}%
                            </span>
                        </TooltipTrigger>
                        <TooltipContent className="bg-black border-white/20 text-white text-xs">
                            Dev Holdings
                        </TooltipContent>
                    </Tooltip>
                    {/* Snipers Holding - Crosshair */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="flex items-center gap-0.5 text-gray-300 cursor-help">
                                <Crosshair className="w-3 h-3 text-yellow-400" /> {token.snipersHolding || 0}%
                            </span>
                        </TooltipTrigger>
                        <TooltipContent className="bg-black border-white/20 text-white text-xs">
                            Sniper Holdings
                        </TooltipContent>
                    </Tooltip>
                    {/* Insiders Holding - Ghost */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="flex items-center gap-0.5 text-gray-300 cursor-help">
                                <Ghost className="w-3 h-3 text-yellow-400" /> {token.insidersHolding || 0}%
                            </span>
                        </TooltipTrigger>
                        <TooltipContent className="bg-black border-white/20 text-white text-xs">
                            Insider Holdings
                        </TooltipContent>
                    </Tooltip>
                    {/* Bundle Holding - Share2 (connected nodes) */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="flex items-center gap-0.5 text-gray-300 cursor-help">
                                <Share2 className="w-3 h-3 text-yellow-400" /> {token.bundleHolding || 0}%
                            </span>
                        </TooltipTrigger>
                        <TooltipContent className="bg-black border-white/20 text-white text-xs">
                            Bundler Holdings
                        </TooltipContent>
                    </Tooltip>

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
            </TooltipProvider>
        </div>
    );
}
