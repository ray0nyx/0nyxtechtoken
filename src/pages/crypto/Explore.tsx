/**
 * AxiomPulsePage - 3-column layout for Pump.fun token lifecycle
 * Columns: New Pairs | Final Stretch | Migrated
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import CryptoNavTabs from '@/components/crypto/ui/CryptoNavTabs';
import { RefreshCw, ChevronUp, Zap } from 'lucide-react';
import AxiomTokenCard, { type AxiomTokenData } from '@/components/crypto/ui/AxiomTokenCard';
import { fetchNewPumpFunCoins, type PumpFunCoin } from '@/lib/pump-fun-service';

export default function Explore() {
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

    // Transform coin
    const transformToken = useCallback((coin: PumpFunCoin): AxiomTokenData => {
        const progress = coin.virtual_sol_reserves
            ? Math.min(100, (coin.virtual_sol_reserves / 80) * 100)
            : 0;

        return {
            symbol: coin.symbol || coin.name?.split(' ')[0] || 'NEW',
            name: coin.name || '',
            mint: coin.mint || '',
            logoUrl: coin.image_uri,
            age: calculateAge(coin.created_timestamp),
            price: coin.usd_market_cap ? coin.usd_market_cap / 1000000000 : 0,
            priceChange: 0,
            marketCap: coin.usd_market_cap || coin.market_cap || 0,
            volume: 0,
            liquidity: 0,
            holders: 0,
            txns: 0,
            devHolding: Math.random() * 10,
            snipersHolding: 0,
            top10Holding: 0,
            insidersHolding: Math.random() * 15,
            isPaid: false,
            isGraduated: coin.complete && !!coin.raydium_pool,
            platform: coin.raydium_pool ? 'raydium' : 'pump',
            twitter: coin.twitter,
            website: coin.website,
            telegram: coin.telegram,
        };
    }, [calculateAge]);

    // Fetch data
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const coins = await fetchNewPumpFunCoins(150);
            const tokens = coins.map(transformToken);

            // Categorize
            const newArr: AxiomTokenData[] = [];
            const stretchArr: AxiomTokenData[] = [];
            const migratedArr: AxiomTokenData[] = [];

            tokens.forEach(token => {
                if (token.isGraduated) {
                    migratedArr.push(token);
                } else if (token.marketCap >= 50000) {
                    stretchArr.push(token);
                } else {
                    newArr.push(token);
                }
            });

            setNewPairs(newArr.slice(0, 30));
            setFinalStretch(stretchArr.slice(0, 30));
            setMigrated(migratedArr.slice(0, 30));
        } catch (error) {
            console.error('Error fetching pulse data:', error);
        } finally {
            setLoading(false);
        }
    }, [transformToken]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 15000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const handleTokenClick = (token: AxiomTokenData) => {
        navigate(`/crypto/coins?pair=${token.symbol}/USD&address=${token.mint}`);
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
