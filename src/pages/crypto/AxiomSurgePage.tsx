import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
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
import { usePumpStream, type TokenEvent } from '@/lib/helius/usePumpStream';

type TabType = 'coins' | 'surge' | 'dex' | 'pump';

export default function AxiomSurgePage() {
    const navigate = useNavigate();
    const [earlyTokens, setEarlyTokens] = useState<AxiomTokenData[]>([]);
    const [surgingTokens, setSurgingTokens] = useState<AxiomTokenData[]>([]);
    const [loading, setLoading] = useState(true);
    const [minMC, setMinMC] = useState(0);
    const [autoRefresh, setAutoRefresh] = useState(true);

    // Use Helius WebSocket for real-time pump.fun token streaming
    const {
        tokens: streamTokens,
        connected: wsConnected,
        connecting: wsConnecting,
        error: wsError,
        clearTokens
    } = usePumpStream({
        autoConnect: true,
        maxTokens: 50,
        onTokenCreated: (token) => {
            console.log('New token from Helius stream:', token.mint, token.name);
        },
        onConnectionChange: (isConnected) => {
            console.log('Helius stream:', isConnected ? 'connected' : 'disconnected');
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

        return {
            symbol: coin.symbol || coin.name?.split(' ')[0]?.substring(0, 8) || 'NEW',
            name: coin.name || 'New Token',
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

    // Fetch trending/surging data from backend
    useEffect(() => {
        const loadData = async () => {
            try {
                // 1. Fetch Trending/Surging (Live Momentum)
                const trendingData = await fetchTrendingPumpFunCoins(20);
                // Filter for "Momentum" - high progress (>80%) or high vol
                const momentumTokens = trendingData
                    .map(transformToken)
                    .filter(t => (t.progress && t.progress > 80) || t.marketCap > 50000)
                    .sort((a, b) => (b.progress || 0) - (a.progress || 0)); // Sort by closeness to migration

                setSurgingTokens(momentumTokens.slice(0, 50));

                // 2. Also fetch new from API as backup (in case WebSocket is slow to start)
                const newCoins = await fetchNewPumpFunCoins(50);
                const earlyData = newCoins
                    .map(transformToken)
                    .sort((a, b) => (b.createdTimestamp || 0) - (a.createdTimestamp || 0));

                // Merge with existing stream tokens
                setEarlyTokens(prev => {
                    const existingMints = new Set(prev.map(t => t.mint));
                    const newFromApi = earlyData.filter(t => !existingMints.has(t.mint));
                    return [...prev, ...newFromApi].slice(0, 50);
                });

                setLoading(false);

            } catch (e) {
                console.error("Failed to load surge data", e);
                setLoading(false);
            }
        };

        loadData();
    }, [refreshKey, transformToken]);

    // Handle token click
    const handleTokenClick = (token: AxiomTokenData) => {
        navigate(`/crypto/coins?pair=${token.symbol}/USD&address=${token.mint}`);
    };

    const handleBuyClick = (token: AxiomTokenData) => {
        // Implement Quick Buy logic or navigation with buy intent
        console.log("Quick buy", token.symbol);
        navigate(`/crypto/coins?pair=${token.symbol}/USD&address=${token.mint}&action=buy`);
    };

    return (
        <div className="h-full flex flex-col bg-[#060a10]">
            <CryptoNavTabs />

            {/* Controls Row */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#1e2530] bg-[#0a0e14]">
                <div className="flex items-center gap-4">
                    {/* WebSocket Status */}
                    <div className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-full border",
                        wsConnected
                            ? "bg-green-900/20 border-green-900/50 text-green-400"
                            : wsConnecting
                                ? "bg-yellow-900/20 border-yellow-900/50 text-yellow-400"
                                : "bg-red-900/20 border-red-900/50 text-red-400"
                    )}>
                        {wsConnected ? (
                            <Wifi className="w-3 h-3" />
                        ) : (
                            <WifiOff className="w-3 h-3" />
                        )}
                        <span className="text-xs">
                            {wsConnected ? 'Live' : wsConnecting ? 'Connecting...' : 'Disconnected'}
                        </span>
                    </div>

                    {/* Market Cap Slider Control */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0d1117] border border-[#1e2530]">
                        <button onClick={() => setMinMC(Math.max(0, minMC - 10000))} className="text-gray-500 hover:text-white">−</button>
                        <input
                            type="range"
                            min="0"
                            max="1000000"
                            step="10000"
                            value={minMC}
                            onChange={(e) => setMinMC(parseInt(e.target.value))}
                            className="w-24 h-1 accent-cyan-500"
                        />
                        <span className="text-white text-sm font-medium min-w-[50px] text-center">
                            {minMC >= 1000000 ? `${(minMC / 1000000).toFixed(0)}M` :
                                minMC >= 1000 ? `${(minMC / 1000).toFixed(0)}K` : '0'}
                        </span>
                        <button onClick={() => setMinMC(minMC + 10000)} className="text-gray-500 hover:text-white">+</button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleRefresh}
                        className="p-2 text-gray-400 hover:text-white"
                    >
                        <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                    </button>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0d1117] border border-[#1e2530] rounded">
                        <Zap className="w-3 h-3 text-cyan-400" />
                        <span className="text-gray-400 text-xs">Helius Stream</span>
                    </div>
                </div>
            </div>

            {/* Main Content - Two Columns */}
            <div className="flex-1 flex gap-2 p-2 overflow-hidden">
                <TokenColumn
                    title="Early Alpha Pairs"
                    subtitle={wsConnected ? "Real-time from Helius WebSocket" : "Pump.fun newest releases"}
                    tokens={earlyTokens}
                    loading={loading && earlyTokens.length === 0}
                    onTokenClick={handleTokenClick}
                    onBuyClick={handleBuyClick}
                    isLive={wsConnected}
                />

                <TokenColumn
                    title="Live Momentum"
                    subtitle="Migrating to Raydium soon"
                    tokens={surgingTokens}
                    loading={loading && surgingTokens.length === 0}
                    onTokenClick={handleTokenClick}
                    onBuyClick={handleBuyClick}
                />
            </div>
        </div>
    );
}

// Token Column Component
function TokenColumn({
    title,
    subtitle,
    tokens,
    loading,
    onTokenClick,
    onBuyClick,
    isLive = false
}: {
    title: string;
    subtitle?: string;
    tokens: AxiomTokenData[];
    loading: boolean;
    onTokenClick: (token: AxiomTokenData) => void;
    onBuyClick: (token: AxiomTokenData) => void;
    isLive?: boolean;
}) {
    // Calculate totals for header stats if desired, or keep simple
    const count = tokens.length;

    return (
        <div className="flex-1 flex flex-col rounded-xl bg-[#0a0e14] border border-[#1e2530] overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-[#1e2530] bg-[#0d1117]">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-white font-bold">{title}</h3>
                            {isLive && (
                                <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-green-900/30 text-green-400 rounded-full border border-green-900/50">
                                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                                    LIVE
                                </span>
                            )}
                            <span className="px-1.5 py-0.5 text-[10px] bg-cyan-900/30 text-cyan-400 rounded-full border border-cyan-900/50">
                                {count}
                            </span>
                        </div>
                        {subtitle && <p className="text-gray-500 text-xs mt-0.5">{subtitle}</p>}
                    </div>
                    {/* Header Controls/Stats could be here */}
                </div>
            </div>

            {/* Token list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-[#060a10]">
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
                            token={token}
                            onClick={() => onTokenClick(token)}
                            onBuyClick={() => onBuyClick(token)}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
