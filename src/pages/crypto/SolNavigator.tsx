/**
 * SolNavigator - 3-column layout for Pump.fun token lifecycle
 * Columns: New Pairs | Final Stretch | Migrated
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import CryptoNavTabs from '@/components/crypto/ui/CryptoNavTabs';
import { RefreshCw, ChevronUp, Zap } from 'lucide-react';
import AxiomTokenCard, { type AxiomTokenData } from '@/components/crypto/ui/AxiomTokenCard';
import { fetchNewPumpFunCoins, fetchTrendingPumpFunCoins, type PumpFunCoin } from '@/lib/pump-fun-service';
import { fetchGraduatedRaydiumTokens, type DexSearchResult } from '@/lib/dex-screener-service';
import { useBackendTokenStream } from '@/lib/useBackendTokenStream';
import { useMigratedTokenStream } from '@/lib/useMigratedTokenStream';

export default function SolNavigator() {
    const navigate = useNavigate();
    const [newPairs, setNewPairs] = useState<AxiomTokenData[]>([]);
    const [finalStretch, setFinalStretch] = useState<AxiomTokenData[]>([]);
    const [migrated, setMigrated] = useState<AxiomTokenData[]>([]);
    const [loading, setLoading] = useState(true);

    // Calculate age
    const calculateAge = useCallback((timestamp: number | undefined): string => {
        if (!timestamp) return 'N/A';
        const ts = timestamp > 1000000000000 ? timestamp : timestamp * 1000;
        const diffMs = Date.now() - ts;
        const diffSeconds = Math.floor(diffMs / 1000);
        const diffMinutes = Math.floor(diffSeconds / 60);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffSeconds < 60) return `${diffSeconds}s`;
        if (diffMinutes < 60) return `${diffMinutes}m`;
        if (diffHours < 24) return `${diffHours}h`;
        return `${diffDays}d`;
    }, []);

    // Transform PumpFunCoin (from API or Backend Stream)
    const transformToken = useCallback((coin: PumpFunCoin): AxiomTokenData => {
        const vSol = coin.virtual_sol_reserves || 0;
        const mc = coin.usd_market_cap || coin.market_cap || 0;

        // Calculate progress like in AxiomTokenCard if not provided
        const progress = coin.complete ? 100 : (vSol > 0 ? Math.min(100, (vSol / 85) * 100) : 0);

        return {
            symbol: coin.symbol || coin.name?.split(' ')[0] || 'NEW',
            name: coin.name || '',
            mint: coin.mint || '',
            logoUrl: coin.image_uri,
            age: calculateAge(coin.created_timestamp),
            createdTimestamp: coin.created_timestamp || Date.now(),
            price: mc > 0 ? mc / 1000000000 : 0,
            priceChange: coin.price_change_24h || 0,
            marketCap: mc,
            volume: coin.volume_24h || 0,
            liquidity: coin.liquidity || (vSol > 0 ? vSol * 200 : 0),
            holders: 0,
            txns: 0,
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
            progress: progress,
        };
    }, [calculateAge]);

    // Backend WebSocket for real-time updates (Same as Surge page)
    const {
        tokens: streamTokens,
        connected: wsConnected,
        clearTokens
    } = useBackendTokenStream({
        autoConnect: true,
        maxTokens: 50,
        onTokenCreated: (token) => {
            console.log('Sol Navigator: New token detected', token.mint);
        }
    });

    // Migrated Token Stream (Same as Surge page)
    const {
        tokens: migratedStreamTokens
    } = useMigratedTokenStream({
        autoConnect: true,
        maxTokens: 50
    });

    // Real-time updates - trigger refetch when new tokens arrive from stream
    useEffect(() => {
        if (streamTokens.length > 0) {
            // Update New Pairs immediately with stream tokens
            const transformed = streamTokens.map(transformToken);

            // Update New Pairs
            setNewPairs(prev => {
                const all = [...transformed, ...prev];
                const unique = Array.from(new Map(all.map(t => [t.mint, t])).values());
                return unique
                    .filter(t => !t.isGraduated && (Date.now() - (t.createdTimestamp || 0)) < 600000)
                    .sort((a, b) => (b.createdTimestamp || 0) - (a.createdTimestamp || 0))
                    .slice(0, 50);
            });

            // Update Final Stretch
            setFinalStretch(prev => {
                const all = [...transformed, ...prev];
                const unique = Array.from(new Map(all.map(t => [t.mint, t])).values());

                // Filter for Final Stretch: MC 5k-50k OR Progress >= 20%
                return unique
                    .filter(t => {
                        const mc = t.marketCap || 0;
                        const progress = t.progress || 0;
                        return (mc >= 5000 && mc < 50000) || progress >= 20;
                    })
                    // Sort by MC desc (standard for this section)
                    .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0))
                    .slice(0, 50);
            });
        }
    }, [streamTokens, transformToken]);

    // Handle Migrated Stream Updates
    useEffect(() => {
        if (migratedStreamTokens.length > 0) {
            // Transform migrated tokens (they come as PumpFunCoin format but are graduated)
            const transformedMigrated = migratedStreamTokens.map(transformToken);

            setMigrated(prev => {
                const all = [...transformedMigrated, ...prev];
                const unique = Array.from(new Map(all.map(t => [t.mint, t])).values());

                // These are all migrated by definition of the stream
                return unique
                    .map(t => ({ ...t, isGraduated: true, platform: 'raydium' as const }))
                    .sort((a, b) => (b.createdTimestamp || 0) - (a.createdTimestamp || 0)) // Newest migrated on top
                    .slice(0, 50);
            });
        }
    }, [migratedStreamTokens, transformToken]);

    // Fetch initial data
    const fetchData = useCallback(async () => {
        try {
            setLoading(true);

            // Fetch data for all three sections in parallel
            const [newCoins, trendingCoins, graduatedTokens] = await Promise.all([
                fetchNewPumpFunCoins(100),
                fetchTrendingPumpFunCoins(150),
                fetchGraduatedRaydiumTokens(50)  // Actual graduated tokens from Raydium
            ]);

            console.log('Fetched:', {
                newCoins: newCoins.length,
                trendingCoins: trendingCoins.length,
                graduatedTokens: graduatedTokens.length
            });

            // Transform Pump.fun tokens
            const transformedNew = newCoins.map(transformToken);
            const transformedTrending = trendingCoins.map(transformToken);

            // Transform graduated Raydium tokens (DexSearchResult format)
            const transformedGraduated: AxiomTokenData[] = graduatedTokens.map((token: DexSearchResult) => ({
                symbol: token.baseToken?.symbol || 'UNKNOWN',
                name: token.baseToken?.name || '',
                mint: token.baseToken?.address || token.pairAddress || '',
                logoUrl: token.baseToken?.logoURI || '',
                age: calculateAge(token.pairCreatedAt),
                createdTimestamp: token.pairCreatedAt || Date.now(),
                price: token.priceUsd || 0,
                priceChange: token.change24h || 0,
                marketCap: token.marketCap || token.fdv || 0,
                volume: token.volume24h || 0,
                liquidity: token.liquidity || 0,
                holders: 0,
                txns: 0,
                devHolding: 0,
                snipersHolding: 0,
                top10Holding: 0,
                insidersHolding: 0,
                isPaid: false,
                isGraduated: true,  // These are all graduated (on Raydium)
                platform: 'raydium',
                twitter: token.baseToken?.twitter,
                website: token.baseToken?.website,
                telegram: token.baseToken?.telegram,
                progress: 100,  // 100% progress since graduated
            }));

            console.log('Graduated Raydium tokens:', transformedGraduated.length);

            // Deduplicate Pump.fun tokens for New Pairs and Final Stretch
            const allPumpTokens = [...transformedNew, ...transformedTrending];
            const uniquePumpTokens = Array.from(new Map(allPumpTokens.map(t => [t.mint, t])).values());

            // Filter out graduated tokens from Pump.fun data
            const nonGraduatedTokens = uniquePumpTokens.filter(t => !t.isGraduated && (t.marketCap || 0) < 50000);

            // NEW PAIRS: Newest non-graduated tokens
            const newArr = nonGraduatedTokens
                .sort((a, b) => (b.createdTimestamp || 0) - (a.createdTimestamp || 0))
                .slice(0, 100);

            console.log('New Pairs tokens:', newArr.length);

            // FINAL STRETCH: Tokens with higher market cap or progress (approaching graduation)
            const stretchArr = nonGraduatedTokens
                .filter(t => {
                    const mc = t.marketCap || 0;
                    const progress = t.progress || 0;
                    return (mc >= 5000 && mc < 50000) || progress >= 20;
                })
                .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));

            console.log('Final Stretch tokens:', stretchArr.length);

            // Set state - New Pairs and Final Stretch from Pump.fun, Migrated from Raydium
            setNewPairs(newArr.slice(0, 50));
            setFinalStretch(stretchArr.slice(0, 50));
            setMigrated(transformedGraduated.slice(0, 50));
        } catch (error) {
            console.error('Error fetching Sol Navigator data:', error);
        } finally {
            setLoading(false);
        }
    }, [transformToken]);

    useEffect(() => {
        fetchData();
        // Periodic fetch every 15 seconds for real-time updates across all sections
        const interval = setInterval(fetchData, 15000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const handleTokenClick = (token: AxiomTokenData) => {
        navigate(`/crypto/tokens?pair=${token.symbol}/USD&address=${token.mint}`);
    };

    return (
        <div className="h-full flex flex-col bg-black">
            {/* Top Navigation Tabs - Coins / Surge / DEX Screener / Pump Live */}
            <CryptoNavTabs />

            {/* Secondary Header - Cleaned up */}
            <div className="h-2 border-b border-[#1e2530] bg-black">
            </div>

            {/* Three Column Layout */}
            <div className="flex-1 flex gap-2 p-2 overflow-hidden">
                <PulseColumn
                    title="New Pairs"
                    tokens={newPairs}
                    loading={loading}
                    onTokenClick={handleTokenClick}
                    color="cyan"
                />
                <PulseColumn
                    title="Final Stretch"
                    tokens={finalStretch}
                    loading={loading}
                    onTokenClick={handleTokenClick}
                    color="yellow"
                />
                <PulseColumn
                    title="Migrated"
                    tokens={migrated}
                    loading={loading}
                    onTokenClick={handleTokenClick}
                    color="green"
                />
            </div>
        </div>
    );
}

// Pulse column component
function PulseColumn({
    title,
    tokens,
    loading,
    onTokenClick,
    color = 'cyan',
}: {
    title: string;
    tokens: AxiomTokenData[];
    loading: boolean;
    onTokenClick: (token: AxiomTokenData) => void;
    color?: 'cyan' | 'yellow' | 'green';
}) {
    const colorMap = {
        cyan: 'text-cyan-400 bg-cyan-500/20',
        yellow: 'text-yellow-400 bg-yellow-500/20',
        green: 'text-green-400 bg-green-500/20',
    };

    return (
        <div className="flex-1 flex flex-col bg-black overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-black">
                <div className="flex items-center gap-2">
                    <h3 className="text-white text-sm font-bold">{title}</h3>
                </div>
            </div>

            {/* Scroll button */}
            <button className="flex items-center justify-center py-1 text-gray-500 hover:text-white">
                <ChevronUp className="w-3 h-3" />
            </button>

            {/* Token list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {loading && tokens.length === 0 ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-32 bg-[#0d1117] rounded-lg animate-pulse" />
                    ))
                ) : tokens.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
                        No tokens
                    </div>
                ) : (
                    tokens.map(token => (
                        <AxiomTokenCard
                            key={token.mint}
                            token={token}
                            onClick={() => onTokenClick(token)}
                            compact
                        />
                    ))
                )}
            </div>
        </div>
    );
}
