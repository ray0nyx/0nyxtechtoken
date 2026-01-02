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
import { fetchGraduatedRaydiumTokens, fetchBulkTokenInfo, type DexSearchResult } from '@/lib/dex-screener-service';
import { useBackendTokenStream } from '@/lib/useBackendTokenStream';
import { useMigratedTokenStream } from '@/lib/useMigratedTokenStream';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { quoteAndSwap } from '@/lib/jupiter-sdk-service';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useToast } from '@/components/ui/use-toast';

export default function SolNavigator() {
    const navigate = useNavigate();
    const { publicKey, signTransaction } = useWallet();
    const { connection } = useConnection();
    const { toast } = useToast();
    const [newPairs, setNewPairs] = useState<AxiomTokenData[]>([]);
    const [finalStretch, setFinalStretch] = useState<AxiomTokenData[]>([]);
    const [migrated, setMigrated] = useState<AxiomTokenData[]>([]);
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
    // Initialize from localStorage if available
    const initPriceCache = (): Map<string, PriceCacheEntry> => {
        try {
            const saved = localStorage.getItem('solNavigatorPriceCache');
            if (saved) {
                const parsed = JSON.parse(saved);
                const map = new Map<string, PriceCacheEntry>();
                // Only restore entries that are less than 10 minutes old
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
            console.warn('Failed to load price cache from localStorage:', e);
        }
        return new Map();
    };

    const priceCache = React.useRef<Map<string, PriceCacheEntry>>(initPriceCache());

    // Counter to trigger re-renders when prices update (without changing list identity)
    const [priceUpdateTick, setPriceUpdateTick] = useState(0);

    // Save price cache to localStorage periodically
    useEffect(() => {
        const saveCache = () => {
            try {
                const obj: Record<string, any> = {};
                priceCache.current.forEach((value, key) => {
                    obj[key] = value;
                });
                localStorage.setItem('solNavigatorPriceCache', JSON.stringify(obj));
            } catch (e) {
                console.warn('Failed to save price cache:', e);
            }
        };

        // Save every 5 seconds
        const interval = setInterval(saveCache, 5000);

        // Also save on unmount
        return () => {
            clearInterval(interval);
            saveCache();
        };
    }, []);

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

        const safeSymbol = coin.symbol?.trim() || coin.name?.trim().split(' ')[0]?.substring(0, 8) || 'NEW';
        const safeName = coin.name?.trim() || 'New Token';

        return {
            symbol: safeSymbol,
            name: safeName,
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
    // Real-time updates - trigger refetch when new tokens arrive from stream
    useEffect(() => {
        if (streamTokens.length > 0) {
            // Update New Pairs immediately with stream tokens
            const transformed = streamTokens.map(transformToken);

            // Update New Pairs
            setNewPairs(prev => {
                const now = Date.now();
                const prevMap = new Map(prev.map(t => [t.mint, t]));

                // Only add TRULY new tokens. 
                // If it exists in prev, we IGNORE the stream update because stream data is usually "initial state"
                // and we don't want to overwrite our "Live Updated" price.
                const trulyNew = transformed
                    .filter(t => !prevMap.has(t.mint))
                    .map(t => ({ ...t, discoveryTimestamp: now }));

                const all = [...prev, ...trulyNew];
                const unique = Array.from(new Map(all.map(t => [t.mint, t])).values());

                return unique
                    .filter(t => !t.isGraduated && (now - (t.createdTimestamp || 0)) < 600000)
                    .sort((a, b) => (b.discoveryTimestamp || 0) - (a.discoveryTimestamp || 0))
                    .slice(0, 50);
            });

            // Update Final Stretch
            setFinalStretch(prev => {
                const now = Date.now();
                const prevMap = new Map(prev.map(t => [t.mint, t]));

                const trulyNew = transformed
                    .filter(t => !prevMap.has(t.mint))
                    .map(t => ({ ...t, discoveryTimestamp: now }));

                const all = [...prev, ...trulyNew];
                const unique = Array.from(new Map(all.map(t => [t.mint, t])).values());

                return unique
                    .filter(t => {
                        const mc = t.marketCap || 0;
                        const progress = t.progress || 0;
                        return (mc >= 5000 && mc < 50000) || progress >= 20;
                    })
                    .sort((a, b) => (b.discoveryTimestamp || 0) - (a.discoveryTimestamp || 0))
                    .slice(0, 50);
            });
        }
    }, [streamTokens, transformToken]);

    // Track visible mints for bulk updates
    const visibleMintsRef = React.useRef<string[]>([]);

    useEffect(() => {
        const all = [...newPairs, ...finalStretch, ...migrated];
        visibleMintsRef.current = [...new Set(all.map(t => t.mint))];
    }, [newPairs, finalStretch, migrated]);

    // Periodically update prices for all visible tokens - updates price cache, not list state
    useEffect(() => {
        const interval = setInterval(async () => {
            const mints = visibleMintsRef.current;
            if (mints.length === 0) return;

            // Take top 90 to fit within 3 DexScreener batches (max 30 each)
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

                    // Skip if no meaningful change
                    if (existing && existing.marketCap === newMC && existing.price === newPrice) {
                        continue;
                    }

                    hasChanges = true;

                    // Update or create cache entry with history
                    const history = existing?.mcHistory || [];
                    const newHistory = [...history, newMC];
                    // Keep last 30 points
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

                // Trigger re-render only if we have changes
                if (hasChanges) {
                    setPriceUpdateTick(prev => prev + 1);
                }
            } catch (e) {
                // Silent failure desirable here
            }
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    // Handle Migrated Stream Updates
    useEffect(() => {
        if (migratedStreamTokens.length > 0) {
            // Transform migrated tokens (they come as PumpFunCoin format but are graduated)
            const transformedMigrated = migratedStreamTokens.map(transformToken);

            setMigrated(prev => {
                const now = Date.now();
                const prevMap = new Map(prev.map(t => [t.mint, t]));

                const trulyNew = transformedMigrated
                    .filter(t => !prevMap.has(t.mint))
                    .map(t => ({ ...t, discoveryTimestamp: now }));

                const all = [...prev, ...trulyNew];
                const unique = Array.from(new Map(all.map(t => [t.mint, t])).values());

                return unique
                    .map(t => ({ ...t, isGraduated: true, platform: 'raydium' as const }))
                    .sort((a, b) => (b.discoveryTimestamp || 0) - (a.discoveryTimestamp || 0)) // Newest migrated on top
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
            // Merge with previous state to preserve discovery timestamps
            const now = Date.now();

            setNewPairs(prev => {
                const now = Date.now();
                const prevMap = new Map(prev.map(t => [t.mint, t]));

                const trulyNewPoints = newArr
                    .filter(t => !prevMap.has(t.mint))
                    .map(t => ({ ...t, discoveryTimestamp: now }));

                const all = [...prev, ...trulyNewPoints];
                const unique = Array.from(new Map(all.map(t => [t.mint, t])).values());
                return unique
                    .filter(t => !t.isGraduated && (now - (t.createdTimestamp || 0)) < 600000)
                    .sort((a, b) => (b.discoveryTimestamp || 0) - (a.discoveryTimestamp || 0))
                    .slice(0, 50);
            });

            setFinalStretch(prev => {
                const now = Date.now();
                const prevMap = new Map(prev.map(t => [t.mint, t]));

                const newStretch = stretchArr
                    .filter(t => !prevMap.has(t.mint))
                    .map(t => ({ ...t, discoveryTimestamp: now }));

                const all = [...prev, ...newStretch];
                const unique = Array.from(new Map(all.map(t => [t.mint, t])).values());

                return unique
                    .filter(t => {
                        const mc = t.marketCap || 0;
                        const progress = t.progress || 0;
                        return (mc >= 5000 && mc < 50000) || progress >= 20;
                    })
                    .sort((a, b) => (b.discoveryTimestamp || 0) - (a.discoveryTimestamp || 0))
                    .slice(0, 50);
            });

            setMigrated(prev => {
                const now = Date.now();
                const prevMap = new Map(prev.map(t => [t.mint, t]));

                const newMigrated = transformedGraduated
                    .filter(t => !prevMap.has(t.mint))
                    .map(t => ({ ...t, discoveryTimestamp: now }));

                const all = [...prev, ...newMigrated];
                const unique = Array.from(new Map(all.map(t => [t.mint, t])).values());

                return unique
                    .map(t => ({ ...t, isGraduated: true, platform: 'raydium' as const }))
                    .sort((a, b) => (b.discoveryTimestamp || 0) - (a.discoveryTimestamp || 0))
                    .slice(0, 50);
            });
        } catch (error) {
            console.error('Error fetching Sol Navigator data:', error);
        } finally {
            setLoading(false);
        }
    }, [transformToken]);

    useEffect(() => {
        fetchData();
        // Periodic fetch every 60 seconds for discovering new tokens (prices are updated via priceCache every 5s)
        const interval = setInterval(fetchData, 60000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const handleTokenClick = (token: AxiomTokenData) => {
        navigate(`/crypto/tokens?pair=${token.symbol}/USD&address=${token.mint}`);
    };

    const handleQuickBuy = async (token: AxiomTokenData, amountInSol: number = 0.1) => {
        if (!publicKey || !signTransaction) {
            toast({ title: 'Wallet not connected', description: 'Please connect your wallet to trade.', variant: 'destructive' });
            return;
        }

        try {
            toast({ title: 'Initiating Quick Buy', description: `Buying ${amountInSol} SOL of ${token.symbol}...` });

            const result = await quoteAndSwap(
                connection,
                {
                    inputMint: 'So11111111111111111111111111111111111111112', // SOL
                    outputMint: token.mint,
                    amount: amountInSol * LAMPORTS_PER_SOL,
                    slippageBps: 100, // 1% default slippage for meme coins
                    platformFeeBps: 100, // 1% fee to 0nyx Tech
                },
                {
                    userPublicKey: publicKey.toString(),
                    wrapAndUnwrapSol: true,
                },
                signTransaction
            );

            if (result.success) {
                toast({
                    title: 'Quick Buy Successful',
                    description: `Successfully swapped ${amountInSol} SOL for ${token.symbol}.`,
                    variant: 'default',
                });
            } else {
                throw new Error(result.error);
            }
        } catch (error: any) {
            console.error('Quick buy failed:', error);
            toast({ title: 'Quick Buy Failed', description: error.message || 'Transaction failed', variant: 'destructive' });
        }
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
                    onBuyClick={handleQuickBuy}
                    color="cyan"
                    priceCache={priceCache}
                />
                <PulseColumn
                    title="Final Stretch"
                    tokens={finalStretch}
                    loading={loading}
                    onTokenClick={handleTokenClick}
                    onBuyClick={handleQuickBuy}
                    color="yellow"
                    priceCache={priceCache}
                />
                <PulseColumn
                    title="Migrated"
                    tokens={migrated}
                    loading={loading}
                    onTokenClick={handleTokenClick}
                    onBuyClick={handleQuickBuy}
                    color="green"
                    priceCache={priceCache}
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
    onBuyClick,
    color = 'cyan',
    priceCache,
}: {
    title: string;
    tokens: AxiomTokenData[];
    loading: boolean;
    onTokenClick: (token: AxiomTokenData) => void;
    onBuyClick: (token: AxiomTokenData, amount?: number) => void;
    color?: 'cyan' | 'yellow' | 'green';
    priceCache?: React.RefObject<Map<string, { marketCap: number; price: number; mcHistory: number[]; lastUpdate: number; volume24h: number; liquidity: number }>>;
}) {
    const colorMap = {
        cyan: 'text-cyan-400 bg-cyan-500/20',
        yellow: 'text-yellow-400 bg-yellow-500/20',
        green: 'text-green-400 bg-green-500/20',
    };

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
                    tokens.map(token => {
                        const liveToken = getTokenWithLivePrice(token);
                        return (
                            <AxiomTokenCard
                                key={token.mint}
                                token={liveToken}
                                onClick={() => onTokenClick(token)}
                                onBuyClick={(amount) => onBuyClick(token, amount)}
                                compact
                            />
                        );
                    })
                )}
            </div>
        </div>
    );
}
