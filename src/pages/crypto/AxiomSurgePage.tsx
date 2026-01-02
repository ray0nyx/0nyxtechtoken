import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useRef } from 'react';
import CryptoNavTabs from '@/components/crypto/ui/CryptoNavTabs';
import {
    RefreshCw,
    ChevronUp,
    Plus,
    Clock,
    Search as Eye,
    Search as Box,
    Search as Menu,
    User as Users,
    BarChart2,
    Zap,
    Zap as Flame,
    Zap as Crown,
    Wifi,
    WifiOff
} from 'lucide-react';
import AxiomTokenCard, { type AxiomTokenData } from '@/components/crypto/ui/AxiomTokenCard';
import { fetchNewPumpFunCoins, fetchTrendingPumpFunCoins, type PumpFunCoin } from '@/lib/pump-fun-service';
import { fetchBulkTokenInfo } from '@/lib/dex-screener-service';
import { usePumpStream } from '@/lib/helius/usePumpStream';
import { type TokenEvent } from '@/lib/helius/DataParser';

type TabType = 'coins' | 'surge' | 'dex' | 'pump';

export default function AxiomSurgePage() {
    const navigate = useNavigate();
    const [earlyTokens, setEarlyTokens] = useState<AxiomTokenData[]>([]);
    const [surgingTokens, setSurgingTokens] = useState<AxiomTokenData[]>([]);
    const [loading, setLoading] = useState(true);

    // Extended price cache type for all real-time data
    type PriceCacheEntry = {
        marketCap: number;
        price: number;
        mcHistory: number[];
        lastUpdate: number;
        volume24h: number;
        liquidity: number;
    };

    // Price cache that persists across list refreshes - this is the source of truth for live prices
    const initPriceCache = (): Map<string, PriceCacheEntry> => {
        try {
            const saved = localStorage.getItem('solNavigatorPriceCache');
            if (saved) {
                const parsed = JSON.parse(saved);
                const map = new Map<string, PriceCacheEntry>();
                const cutoff = Date.now() - 10 * 60 * 1000;
                for (const [key, value] of Object.entries(parsed)) {
                    const entry = value as PriceCacheEntry;
                    if (entry.lastUpdate && entry.lastUpdate > cutoff) {
                        map.set(key, entry);
                    }
                }
                return map;
            }
        } catch (e) {
            console.warn('Failed to load price cache:', e);
        }
        return new Map();
    };

    const priceCache = useRef<Map<string, PriceCacheEntry>>(initPriceCache());
    const [priceUpdateTick, setPriceUpdateTick] = useState(0);

    // Save price cache periodically
    useEffect(() => {
        const interval = setInterval(() => {
            try {
                const obj: Record<string, any> = {};
                priceCache.current.forEach((value, key) => {
                    obj[key] = value;
                });
                localStorage.setItem('solNavigatorPriceCache', JSON.stringify(obj));
            } catch (e) { console.warn('Failed to save cache:', e); }
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    // Track visible mints for bulk updates
    const visibleMintsRef = useRef<string[]>([]);
    useEffect(() => {
        const all = [...earlyTokens, ...surgingTokens];
        visibleMintsRef.current = [...new Set(all.map(t => t.mint))];
    }, [earlyTokens, surgingTokens]);

    // Periodically update prices for all visible tokens
    useEffect(() => {
        const interval = setInterval(async () => {
            const mints = visibleMintsRef.current;
            if (mints.length === 0) return;

            // Take top 90 to fit within 3 DexScreener batches
            const targetMints = mints.slice(0, 90);

            try {
                const updates = await fetchBulkTokenInfo(targetMints);
                if (!updates || updates.length === 0) return;

                let hasChanges = false;
                const now = Date.now();

                for (const update of updates) {
                    const mint = (update as any).mint;
                    if (!mint) continue;

                    const existing = priceCache.current.get(mint);
                    const newMC = update.marketCap || 0;
                    const newPrice = update.price || 0;
                    const newVolume = update.volume24h || 0;
                    const newLiquidity = update.liquidity || 0;

                    if (existing && existing.marketCap === newMC && existing.price === newPrice) {
                        continue;
                    }

                    hasChanges = true;
                    const history = existing?.mcHistory || [];
                    const newHistory = [...history, newMC];
                    const trimmedHistory = newHistory.length > 30 ? newHistory.slice(-30) : newHistory;

                    priceCache.current.set(mint, {
                        marketCap: newMC,
                        price: newPrice,
                        mcHistory: trimmedHistory,
                        lastUpdate: now,
                        volume24h: newVolume,
                        liquidity: newLiquidity
                    });
                }

                if (hasChanges) {
                    setPriceUpdateTick(prev => prev + 1);
                }
            } catch (e) {
                // Silent failure
            }
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    // Load minMC from localStorage on init
    const [minMC, setMinMC] = useState<number>(() => {
        const saved = localStorage.getItem('onyx_surge_min_mc');
        return saved ? parseInt(saved, 10) : 0;
    });

    // Persist minMC whenever it changes
    useEffect(() => {
        localStorage.setItem('onyx_surge_min_mc', minMC.toString());
    }, [minMC]);

    const pillRef = useRef<HTMLDivElement>(null);

    const handlePillClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!pillRef.current) return;
        const rect = pillRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, x / rect.width));
        // Scale to 100k, round to nearest 1k
        const newVal = Math.round((percentage * 100000) / 1000) * 1000;
        setMinMC(newVal);
    };

    // Locked/Unlocked state for sticky filtering
    const [unlockedMints, setUnlockedMints] = useState<Set<string>>(new Set());

    useEffect(() => {
        const toUnlock = new Set<string>();
        let foundNew = false;

        // Scan master lists and unlock anything that meets current filter
        earlyTokens.forEach(t => {
            if (!unlockedMints.has(t.mint) && (t.marketCap || 0) >= minMC) {
                toUnlock.add(t.mint);
                foundNew = true;
            }
        });

        surgingTokens.forEach(t => {
            if (!unlockedMints.has(t.mint) && (t.marketCap || 0) >= minMC) {
                toUnlock.add(t.mint);
                foundNew = true;
            }
        });

        if (foundNew) {
            setUnlockedMints(prev => {
                const next = new Set(prev);
                toUnlock.forEach(m => next.add(m));
                return next;
            });
        }
    }, [earlyTokens, surgingTokens, minMC]);

    // Filter tokens by market cap automatically - Sticky behavior
    const filteredEarly = earlyTokens.filter(t => unlockedMints.has(t.mint));
    const filteredSurging = surgingTokens.filter(t => unlockedMints.has(t.mint));
    const [autoRefresh, setAutoRefresh] = useState(true);

    // Use Helius WebSocket for real-time token detections
    const {
        tokens: streamTokens,
        connected: wsConnected,
        connecting: wsConnecting,
        error: wsError,
        clearTokens
    } = usePumpStream({
        autoConnect: true,
        onTokenCreated: (token) => {
            console.log('New token detected by Helius:', token.mint, token.symbol);
        },
    });


    // Calculate age from timestamp
    const calculateAge = useCallback((timestamp: number | undefined): string => {
        if (!timestamp) return 'N/A';
        const now = Date.now();
        // Handle both seconds and milliseconds
        const ts = timestamp > 1000000000000 ? timestamp : timestamp * 1000;
        const diffMs = now - ts;
        const diffSeconds = Math.floor(diffMs / 1000);
        const diffMinutes = Math.floor(diffSeconds / 60);

        if (diffSeconds < 60) return `${diffSeconds}s`;
        if (diffMinutes < 60) return `${diffMinutes}m`;
        // Fallback for older (shouldn't happen often in surge)
        const diffHours = Math.floor(diffMinutes / 60);
        return `${diffHours}h`;
    }, []);

    // Transform PumpFun coin to AxiomTokenData
    const transformToken = useCallback((coin: PumpFunCoin): AxiomTokenData => {
        const createdTimestamp = coin.created_timestamp || Date.now();

        // Calculate bonding curve progress from reserves
        const vSol = coin.virtual_sol_reserves || 0;
        const progress = coin.complete ? 100 : (vSol > 0
            ? Math.min(100, (vSol / 85) * 100) // approx 85 SOL is migration target
            : 0);

        // Use real market cap from API
        const mc = coin.usd_market_cap || coin.market_cap || 0;

        // Use real data when available
        const solPrice = 200;
        const liq = coin.liquidity || (vSol > 0 ? vSol * solPrice : 0);
        const vol = coin.volume_24h || 0;
        const priceChange = coin.price_change_24h || 0;

        const safeSymbol = coin.symbol?.trim() || coin.name?.trim().split(' ')[0]?.substring(0, 8) || 'NEW';
        const safeName = coin.name?.trim() || 'New Token';

        return {
            symbol: safeSymbol,
            name: safeName,
            mint: coin.mint || '',
            logoUrl: coin.image_uri,
            age: calculateAge(createdTimestamp),
            createdTimestamp: createdTimestamp,
            progress: progress,
            price: mc > 0 ? mc / 1000000000 : 0,
            priceChange: priceChange, // Use raw change, card will handle display
            marketCap: mc,
            volume: vol,
            liquidity: liq,
            holders: 1, // Placeholder as pump often doesn't give holders initially
            txns: 0, // Placeholder
            devHolding: 0,
            snipersHolding: 0,
            top10Holding: 0,
            insidersHolding: 0,
            isPaid: false,
            isGraduated: coin.complete || !!coin.raydium_pool,
            platform: coin.raydium_pool ? 'raydium' : 'pump',
            twitter: coin.twitter,
            website: coin.website,
            telegram: coin.telegram,
        };
    }, [calculateAge]);

    // Transform Helius stream tokens to AxiomTokenData
    const transformStreamToken = useCallback((token: TokenEvent): AxiomTokenData => {
        return {
            symbol: token.symbol || 'NEW',
            name: token.name || 'New Token',
            mint: token.mint,
            logoUrl: token.image,
            age: token.timeAgo || 'just now',
            createdTimestamp: token.createdAt,
            progress: 0, // New tokens start at 0
            price: 0,
            priceChange: 0,
            marketCap: token.mcap || 0,
            volume: 0,
            liquidity: token.liquidity || 0,
            holders: 1,
            txns: 0,
            devHolding: 0,
            snipersHolding: 0,
            top10Holding: 0,
            insidersHolding: 0,
            isPaid: false,
            isGraduated: false,
            platform: 'pump',
        };
    }, []);

    // Force refresh state
    const [refreshKey, setRefreshKey] = useState(0);

    const handleRefresh = useCallback(() => {
        setLoading(true);
        setEarlyTokens([]);
        setSurgingTokens([]);
        clearTokens();
        setRefreshKey(prev => prev + 1);
    }, [clearTokens]);

    // Merge stream tokens with API tokens for early tokens
    useEffect(() => {
        // Transform stream tokens
        const streamedTokens = streamTokens.map(transformStreamToken);

        // Update early tokens with stream tokens (newest first)
        if (streamedTokens.length > 0) {
            setEarlyTokens(prev => {
                // Merge streamed tokens with existing, dedupe by mint
                const existingMints = new Set(prev.map(t => t.mint));
                const newTokens = streamedTokens.filter(t => !existingMints.has(t.mint));
                return [...newTokens, ...prev].slice(0, 50);
            });
        }
    }, [streamTokens, transformStreamToken]);

    // Live Momentum and Early Alpha Pairs: Initial Load from API for instant content
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                setLoading(true);

                // 1. Load Early Alpha (Newest)
                const earlyCoins = await fetchNewPumpFunCoins(30);
                const earlyData = earlyCoins.map(transformToken);
                setEarlyTokens(earlyData);

                // 2. Load Live Momentum - use same API as Early Alpha since fetchTrendingPumpFunCoins returns very few results
                const momentumCoins = await fetchNewPumpFunCoins(30);
                console.log(`[LIVE MOMENTUM] Fetched ${momentumCoins.length} coins`);

                const momentumData = momentumCoins.map(transformToken);
                console.log(`[LIVE MOMENTUM] Transformed to ${momentumData.length} tokens`);

                // Sort by market cap (highest first) for "momentum" feel
                const sortedMomentum = momentumData.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
                console.log(`[LIVE MOMENTUM] Sorted. Top 3:`, sortedMomentum.slice(0, 3).map(t => t.symbol));

                setSurgingTokens(sortedMomentum);

                setLoading(false);
            } catch (error) {
                console.error('Error loading initial surge data:', error);
                setLoading(false);
            }
        };

        loadInitialData();
    }, [transformToken]);


    // Handle token click
    const handleTokenClick = (token: AxiomTokenData) => {
        navigate(`/crypto/tokens?pair=${token.symbol}/USD&address=${token.mint}`);
    };

    const handleBuyClick = (token: AxiomTokenData) => {
        // Implement Quick Buy logic or navigation with buy intent
        console.log("Quick buy", token.symbol);
        navigate(`/crypto/tokens?pair=${token.symbol}/USD&address=${token.mint}&action=buy`);
    };

    return (
        <div className="h-full flex flex-col bg-black">
            <CryptoNavTabs />

            {/* Controls Row */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#1e2530] bg-black">
                <div className="flex items-center gap-4">
                    {/* Market Cap Filter Control - Image Style */}
                    <div className="flex items-center gap-2">
                        {/* Minus Button */}
                        <button
                            onClick={() => setMinMC(Math.max(0, minMC - 5000))}
                            className="w-7 h-7 flex items-center justify-center rounded-full bg-[#1e2530] text-gray-400 hover:text-white transition-colors"
                        >
                            <span className="text-lg font-light leading-none">−</span>
                        </button>

                        {/* Pill Slider */}
                        <div
                            ref={pillRef}
                            onClick={handlePillClick}
                            className="relative w-32 h-7 rounded-full bg-[#0d1117] border border-[#1e2530] cursor-pointer overflow-hidden group shadow-inner"
                        >
                            {/* Silver Fill */}
                            <div
                                className="absolute left-0 top-0 h-full bg-[#c0c0c0] transition-all duration-300 ease-out"
                                style={{ width: `${(minMC / 100000) * 100}%` }}
                            />
                            {/* Text Content */}
                            <div className="absolute inset-0 flex items-center justify-center z-10 select-none">
                                <span className={cn(
                                    "text-[10px] font-black tracking-widest uppercase",
                                    minMC / 100000 > 0.45 ? "text-black" : "text-white"
                                )}>
                                    {minMC >= 1000 ? `${(minMC / 1000).toFixed(0)}K` : '0'}
                                </span>
                            </div>
                        </div>

                        {/* Plus Button */}
                        <button
                            onClick={() => setMinMC(Math.min(100000, minMC + 5000))}
                            className="w-7 h-7 flex items-center justify-center rounded-full bg-[#1e2530] text-gray-400 hover:text-white transition-colors"
                        >
                            <span className="text-lg font-light leading-none">+</span>
                        </button>
                    </div>
                </div>

            </div>

            {/* Main Content - Two Columns */}
            <div className="flex-1 flex gap-2 p-2 overflow-hidden">
                <TokenColumn
                    title="Early Alpha Pairs"
                    tokens={filteredEarly}
                    loading={loading && earlyTokens.length === 0}
                    onTokenClick={handleTokenClick}
                    onBuyClick={handleBuyClick}
                    isLive={wsConnected}
                    priceCache={priceCache}
                />

                <TokenColumn
                    title="Live Momentum"
                    tokens={surgingTokens}
                    loading={loading && surgingTokens.length === 0}
                    onTokenClick={handleTokenClick}
                    onBuyClick={handleBuyClick}
                    priceCache={priceCache}
                />
            </div>
        </div>
    );
}

// Token Column Component
function TokenColumn({
    title,
    tokens,
    loading,
    onTokenClick,
    onBuyClick,
    isLive = false,
    priceCache
}: {
    title: string;
    subtitle?: string;
    tokens: AxiomTokenData[];
    loading: boolean;
    onTokenClick: (token: AxiomTokenData) => void;
    onBuyClick: (token: AxiomTokenData) => void;
    isLive?: boolean;
    priceCache?: React.RefObject<Map<string, { marketCap: number; price: number; mcHistory: number[]; lastUpdate: number; volume24h: number; liquidity: number }>>;
}) {
    // Helper to merge token with live price data
    const getTokenWithLivePrice = (token: AxiomTokenData): AxiomTokenData => {
        if (!priceCache?.current) return token;
        const cached = priceCache.current.get(token.mint);
        if (cached) {
            return {
                ...token,
                marketCap: cached.marketCap || token.marketCap,
                price: cached.price || token.price,
                mcHistory: cached.mcHistory.length > 0 ? cached.mcHistory : token.mcHistory,
                volume: cached.volume24h || token.volume,
                liquidity: cached.liquidity || token.liquidity,
            };
        }
        return token;
    };

    return (
        <div className="flex-1 flex flex-col rounded-xl bg-black border border-[#1e2530] overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-[#1e2530] bg-black">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-white font-bold">{title}</h3>
                        </div>
                    </div>
                    {/* Header Controls/Stats could be here */}
                </div>
            </div>

            {/* Token list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-black">
                {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-40 bg-[#0d1117] rounded-xl animate-pulse border border-[#1e2530]" />
                    ))
                ) : tokens.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm gap-2">
                        <Box className="w-8 h-8 opacity-20" />
                        <span>Waiting for new tokens...</span>
                    </div>
                ) : (
                    tokens.map(token => (
                        <AxiomTokenCard
                            key={token.mint}
                            token={getTokenWithLivePrice(token)}
                            onClick={() => onTokenClick(token)}
                            onBuyClick={() => onBuyClick(token)}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
