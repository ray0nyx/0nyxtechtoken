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
    isPaid?: boolean;
    isGraduated?: boolean;
    platform?: 'pump' | 'raydium';
    twitter?: string;
    website?: string;
    telegram?: string;
    // Real price history for sparkline (array of prices, most recent last)
    priceHistory?: number[];
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

    // Real-time chart history state
    const [history, setHistory] = useState<number[]>(
        token.priceHistory && token.priceHistory.length > 0
            ? token.priceHistory
            : (token.price ? [token.price] : [])
    );

    // Update history when realtimePrice changes
    useEffect(() => {
        if (!realtimePrice) return;

        setHistory(prev => {
            // Avoid duplicates if price hasn't changed effectively
            const last = prev[prev.length - 1];
            if (last === realtimePrice) return prev;

            // Keep last 30 points for sparkline
            const newHistory = [...prev, realtimePrice];
            return newHistory.length > 30 ? newHistory.slice(newHistory.length - 30) : newHistory;
        });
    }, [realtimePrice]);

    // Helper to resolve IPFS urls
    const resolveIpfsUrl = (url?: string) => {
        if (!url) return undefined;
        if (url.startsWith('ipfs://')) {
            return url.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
        }
        if (url.includes('cf-ipfs.com')) {
            return url.replace('cf-ipfs.com', 'gateway.pinata.cloud');
        }
        return url;
    };

    // Initialize image source
    useEffect(() => {
        if (!token.logoUrl) {
            setImgSrc(undefined);
            return;
        }
        setImgSrc(resolveIpfsUrl(token.logoUrl));
        setRetryCount(0);
    }, [token.logoUrl]);

    const handleImgError = () => {
        if (!imgSrc) return;

        if (retryCount === 0 && imgSrc.includes('gateway.pinata.cloud')) {
            // Try Cloudflare
            setImgSrc(imgSrc.replace('gateway.pinata.cloud', 'cf-ipfs.com'));
            setRetryCount(1);
        } else if (retryCount <= 1 && (imgSrc.includes('cf-ipfs.com') || imgSrc.includes('pinata'))) {
            // Try generic as last resort
            const cid = imgSrc.split('/ipfs/').pop();
            if (cid) {
                setImgSrc(`https://ipfs.io/ipfs/${cid}`);
                setRetryCount(2);
            } else {
                setImgSrc(undefined);
            }
        } else {
            setImgSrc(undefined); // Trigger fallback UI
        }
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
        : (realtimePrice ? realtimePrice * 1_000_000_000 : token.marketCap); // Fallback to 1B supply if token.price is 0

    // Dynamic price change calculation
    // If we have distinct realtime price, compare to initial token.price (acting as 'open' or 'prev')
    // Ensure we handle division by zero or missing initial price
    const currentPrice = realtimePrice || (history.length > 0 ? history[history.length - 1] : token.price);
    const initialPrice = token.price || (history.length > 0 ? history[0] : 0);

    const displayChange = currentPrice && initialPrice > 0
        ? ((currentPrice - initialPrice) / initialPrice) * 100
        : token.priceChange;

    const isPositive = displayChange >= 0;

    // Use real price history if available.
    // If we don't have enough history, show a flat line at current price to indicate "waiting for data"
    // rather than a fake random walk which is misleading.
    const chartData = useMemo(() => {
        // Use accumulated history if we have enough points (>= 2)
        if (history.length >= 2) {
            return history.map((val, i) => ({ i, val }));
        }

        // Fallback: If we only have 1 point or no history, show a flat line
        // This is better than a fake random walk that implies trend where there isn't one
        const val = currentPrice || 0;
        return [
            { i: 0, val },
            { i: 1, val }
        ];
    }, [history, currentPrice]);

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

                        {/* Top Right: Time Change/Value */}
                        <div className="text-right">
                            <div className="text-gray-400 text-xs font-mono mb-0.5">{token.age}</div>
                            <div className={cn(
                                "text-xs font-bold font-mono",
                                isPositive ? "text-green-400" : "text-red-400"
                            )}>
                                {isPositive ? '+' : ''}{displayChange.toFixed(2)}%
                            </div>
                        </div>
                    </div>

                    {/* Middle: Sparkline Chart */}
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

                        {/* ATH Indicator line if applicable */}
                        {token.ath && (
                            <div className="absolute top-0 right-0 text-[9px] text-gray-500 bg-black/80 px-1 rounded">
                                ATH {formatNumber(token.ath)} {token.athMultiple ? `(${token.athMultiple.toFixed(1)}x)` : ''}
                            </div>
                        )}
                    </div>

                    {/* Bottom: Stats Row */}
                    <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono mt-2 pt-2 border-t border-white/10">
                        <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1" title="Volume">
                                <span className="font-bold text-gray-400">V</span> {formatNumber(token.volume)}
                            </span>
                            <span className="flex items-center gap-1" title="Liquidity">
                                <span className="font-bold text-gray-400">L</span> {formatNumber(token.liquidity)}
                            </span>
                            <span className="flex items-center gap-1" title="Holders">
                                <Users className="w-3 h-3 text-gray-400" /> {formatCompact(token.holders)}
                            </span>
                            <span className="flex items-center gap-1" title="Transactions">
                                <Activity className="w-3 h-3 text-gray-400" /> {token.txns}
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

                    {/* Badges/Flags Row (Optional) */}
                    <div className="flex items-center gap-2 mt-1.5 text-[9px]">
                        <span className="flex items-center gap-0.5 text-red-400/80">
                            <Users className="w-2.5 h-2.5" /> {token.devHolding || 0}%
                        </span>
                        <span className="flex items-center gap-0.5 text-orange-400/80">
                            <Shield className="w-2.5 h-2.5" /> {token.insidersHolding || 0}%
                        </span>
                        <span className="flex items-center gap-0.5 text-purple-400/80">
                            <Rocket className="w-2.5 h-2.5" /> 1%
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
