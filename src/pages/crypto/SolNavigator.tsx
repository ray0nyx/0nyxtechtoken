/**
 * SolNavigator - HFT Dashboard with Top Pairs, Heatmap, and Live Feed
 * 
 * Layout:
 * - Top Bar: Search, Liquidity filters, Quick Buy
 * - Main Area: Top Pairs grid (2 columns, 4 rows) + Heatmap Visualizer
 * - Sidebar: Live Feed with chart and recent activity
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import CryptoNavTabs from '@/components/crypto/ui/CryptoNavTabs';
import {
    Search,
    RefreshCw,
    ChevronDown,
    Wifi,
    WifiOff,
} from 'lucide-react';
import { fetchSurgingTokens, type DexSearchResult } from '@/lib/dex-screener-service';

// Types for token data
interface TokenPair {
    id: string;
    name: string;
    symbol: string;
    logo?: string;
    time: string;
    price: number;
    mcap: number;
    priceChange: number;
    pairAddress: string;
    mint?: string;
}

// Heatmap cell colors by price change
const HEATMAP_COLORS = [
    'bg-red-600', 'bg-red-500', 'bg-orange-500', 'bg-orange-400',
    'bg-yellow-500', 'bg-yellow-400', 'bg-lime-500', 'bg-green-500',
    'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-blue-500',
    'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500',
];

export default function DexScreener() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [isConnected, setIsConnected] = useState(true);
    const [loading, setLoading] = useState(true);
    const [topPairs, setTopPairs] = useState<TokenPair[]>([]);
    const [selectedToken, setSelectedToken] = useState<TokenPair | null>(null);
    const [recentActivity, setRecentActivity] = useState<Array<{
        type: 'buy' | 'sell' | 'info';
        label: string;
        value: string;
        time: string;
        change?: string;
    }>>([]);

    // Generate heatmap data
    const [heatmapData, setHeatmapData] = useState<Array<{ color: string; intensity: number; symbol?: string }>>([]);

    // Calculate token age
    const calculateAge = useCallback((timestamp?: number): string => {
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

    // Format market cap
    const formatMcap = useCallback((value: number) => {
        if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
        return `$${value.toFixed(0)}`;
    }, []);

    // Transform DexScreener result to TokenPair
    const transformToken = useCallback((result: DexSearchResult): TokenPair => {
        return {
            id: result.pairAddress,
            name: result.baseToken?.name || result.symbol.split('/')[0] || 'Token',
            symbol: result.baseToken?.symbol || result.symbol.split('/')[0] || 'TOKEN',
            logo: result.baseToken?.logoURI,
            time: calculateAge(result.pairCreatedAt),
            price: result.priceUsd || result.price || 0,
            mcap: result.marketCap || result.fdv || 0,
            priceChange: result.change24h || 0,
            pairAddress: result.pairAddress,
            mint: result.baseToken?.address,
        };
    }, [calculateAge]);

    // Fetch top pairs from DexScreener
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const results = await fetchSurgingTokens(16); // Get 16 for 2 columns of 8 rows
            const tokens = results.map(transformToken);
            setTopPairs(tokens);

            // Set first token as selected
            if (tokens.length > 0 && !selectedToken) {
                setSelectedToken(tokens[0]);
            }

            // Generate heatmap from token data
            const heatmap = tokens.map(token => ({
                color: token.priceChange >= 0
                    ? HEATMAP_COLORS[8 + Math.min(7, Math.floor(token.priceChange / 5))]
                    : HEATMAP_COLORS[Math.max(0, 3 + Math.floor(token.priceChange / 10))],
                intensity: Math.min(1, Math.abs(token.priceChange) / 50 + 0.5),
                symbol: token.symbol,
            }));

            // Pad heatmap to fill grid
            while (heatmap.length < 200) {
                heatmap.push({
                    color: HEATMAP_COLORS[Math.floor(Math.random() * HEATMAP_COLORS.length)],
                    intensity: 0.3 + Math.random() * 0.4,
                    symbol: '',
                });
            }
            setHeatmapData(heatmap);

            // Generate mock activity based on real tokens
            if (tokens.length > 0) {
                setRecentActivity([
                    { type: 'buy', label: 'Price Action', value: formatMcap(tokens[0]?.mcap || 0), time: '1m', change: `+${(tokens[0]?.priceChange || 0).toFixed(1)}%` },
                    { type: 'buy', label: tokens[1]?.name || 'Token', value: formatMcap(tokens[1]?.mcap || 0), time: '2m', change: `+${(tokens[1]?.priceChange || 0).toFixed(1)}%` },
                    { type: 'sell', label: 'Fastest Top Trading', value: formatMcap(tokens[2]?.mcap || 0), time: '3m' },
                    { type: 'info', label: 'Funding Status', value: '', time: '5m' },
                    { type: 'buy', label: tokens[3]?.name || 'Token', value: formatMcap(tokens[3]?.mcap || 0), time: '6m', change: `+${(tokens[3]?.priceChange || 0).toFixed(1)}%` },
                    { type: 'info', label: tokens[4]?.name || 'Token', value: formatMcap(tokens[4]?.mcap || 0), time: '8m' },
                    { type: 'info', label: tokens[5]?.name || 'Token', value: '', time: '10m' },
                ]);
            }

            setIsConnected(true);
        } catch (error) {
            console.error('Error fetching top pairs:', error);
            setIsConnected(false);
        } finally {
            setLoading(false);
        }
    }, [transformToken, selectedToken, formatMcap]);

    // Initial fetch and auto-refresh
    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
        return () => clearInterval(interval);
    }, [fetchData]);

    // Handle token click
    const handleTokenClick = (token: TokenPair) => {
        setSelectedToken(token);
    };

    // Handle swap button
    const handleSwap = (token: TokenPair, e: React.MouseEvent) => {
        e.stopPropagation();
        navigate(`/crypto/coins?pair=${token.symbol}/USD&address=${token.mint || token.pairAddress}`);
    };

    // Split pairs into left and right columns (4 each)
    const leftColumnPairs = topPairs.slice(0, 4);
    const rightColumnPairs = topPairs.slice(4, 8);

    return (
        <div className="h-full flex flex-col bg-[#060a10] text-white overflow-hidden">
            {/* Top Navigation Tabs - Coins / Surge / DEX Screener / Pump Live */}
            <CryptoNavTabs />

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Main Area */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Search + Filters Row */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1a1f2e]">
                        <div className="flex items-center gap-2 flex-1 max-w-xs">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 bg-[#0d1117] border border-[#1a1f2e] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <span className="text-xs text-gray-500">Degustility</span>
                            <div className="flex items-center gap-1 px-2 py-1 bg-[#0d1117] rounded border border-[#1a1f2e]">
                                <span className="text-xs text-gray-400">Quick Buy 0.30L</span>
                                <ChevronDown className="w-4 h-4 text-gray-500" />
                            </div>
                            <button
                                onClick={fetchData}
                                className="p-2 text-gray-400 hover:text-white"
                            >
                                <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                            </button>
                        </div>

                        <div className="ml-auto flex items-center gap-2 text-xs text-gray-500">
                            <span>Dex Ago</span>
                        </div>
                    </div>

                    {/* Search dropdown placeholder */}
                    <div className="px-4 py-2 border-b border-[#1a1f2e] text-xs text-gray-500">
                        <Search className="inline w-3 h-3 mr-2" />
                        <span>Search...</span>
                    </div>

                    {/* Top Pairs Section - 2 Column Layout */}
                    <div className="px-4 py-3 overflow-y-auto">
                        <h3 className="text-sm font-semibold text-gray-300 mb-3">Top Pairs</h3>

                        {loading && topPairs.length === 0 ? (
                            <div className="grid grid-cols-2 gap-3">
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <div key={i} className="h-16 bg-[#0d1117] rounded-lg animate-pulse" />
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3">
                                {/* Left Column */}
                                <div className="space-y-2">
                                    {leftColumnPairs.map((pair) => (
                                        <div
                                            key={pair.id}
                                            onClick={() => handleTokenClick(pair)}
                                            className={cn(
                                                "flex items-center gap-2 p-2 bg-[#0d1117] border rounded-lg hover:border-cyan-500/30 transition-colors cursor-pointer",
                                                selectedToken?.id === pair.id ? "border-cyan-500/50" : "border-[#1a1f2e]"
                                            )}
                                        >
                                            {/* Logo */}
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                {pair.logo ? (
                                                    <img src={pair.logo} alt={pair.symbol} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-sm">🪙</span>
                                                )}
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-xs font-medium text-white truncate">{pair.symbol}</span>
                                                    <span className="text-[10px] text-gray-500 hidden sm:inline">| {pair.name}</span>
                                                    <Search className="w-2.5 h-2.5 text-gray-600" />
                                                </div>
                                                <div className="flex items-center gap-1 text-[10px] text-gray-500">
                                                    <span className="text-cyan-400">{pair.time}</span>
                                                    <span>${pair.price.toFixed(pair.price < 0.01 ? 6 : 2)}</span>
                                                </div>
                                            </div>

                                            {/* Mini Chart */}
                                            <div className="flex gap-[1px] h-6 items-end">
                                                {Array.from({ length: 10 }).map((_, i) => (
                                                    <div
                                                        key={i}
                                                        className={cn(
                                                            'w-0.5 rounded-t',
                                                            pair.priceChange >= 0 ? 'bg-green-500/60' : 'bg-red-500/60'
                                                        )}
                                                        style={{ height: `${20 + Math.random() * 80}%` }}
                                                    />
                                                ))}
                                            </div>

                                            {/* MCap */}
                                            <div className="text-right text-[10px] flex-shrink-0">
                                                <div className="text-gray-500">MCap</div>
                                                <div className="text-white font-medium">{formatMcap(pair.mcap)}</div>
                                            </div>

                                            {/* Swap Button */}
                                            <button
                                                onClick={(e) => handleSwap(pair, e)}
                                                className="px-2 py-1 bg-teal-500 hover:bg-teal-400 text-white text-[10px] font-medium rounded transition-colors flex-shrink-0"
                                            >
                                                SWAP
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {/* Right Column */}
                                <div className="space-y-2">
                                    {rightColumnPairs.map((pair) => (
                                        <div
                                            key={pair.id}
                                            onClick={() => handleTokenClick(pair)}
                                            className={cn(
                                                "flex items-center gap-2 p-2 bg-[#0d1117] border rounded-lg hover:border-cyan-500/30 transition-colors cursor-pointer",
                                                selectedToken?.id === pair.id ? "border-cyan-500/50" : "border-[#1a1f2e]"
                                            )}
                                        >
                                            {/* MCap */}
                                            <div className="text-right text-[10px] flex-shrink-0">
                                                <div className="text-gray-500">MCap</div>
                                                <div className="text-white font-medium">{formatMcap(pair.mcap)}</div>
                                            </div>

                                            {/* Swap Button */}
                                            <button
                                                onClick={(e) => handleSwap(pair, e)}
                                                className="px-2 py-1 bg-cyan-500 hover:bg-cyan-400 text-white text-[10px] font-medium rounded transition-colors flex-shrink-0"
                                            >
                                                SWAP
                                            </button>

                                            {/* Mini Chart */}
                                            <div className="flex gap-[1px] h-6 items-end">
                                                {Array.from({ length: 10 }).map((_, i) => (
                                                    <div
                                                        key={i}
                                                        className={cn(
                                                            'w-0.5 rounded-t',
                                                            pair.priceChange >= 0 ? 'bg-green-500/60' : 'bg-red-500/60'
                                                        )}
                                                        style={{ height: `${20 + Math.random() * 80}%` }}
                                                    />
                                                ))}
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Search className="w-2.5 h-2.5 text-gray-600" />
                                                    <span className="text-[10px] text-gray-500 hidden sm:inline">{pair.name} |</span>
                                                    <span className="text-xs font-medium text-white truncate">{pair.symbol}</span>
                                                </div>
                                                <div className="flex items-center justify-end gap-1 text-[10px] text-gray-500">
                                                    <span>${pair.price.toFixed(pair.price < 0.01 ? 6 : 2)}</span>
                                                    <span className="text-cyan-400">{pair.time}</span>
                                                </div>
                                            </div>

                                            {/* Logo */}
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                {pair.logo ? (
                                                    <img src={pair.logo} alt={pair.symbol} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-sm">🪙</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Heatmap Visualizer */}
                    <div className="px-4 py-3 border-t border-[#1a1f2e]">
                        <h3 className="text-sm font-semibold text-gray-300 mb-3">HEATMAP VISUALIZER</h3>
                        <div className="grid grid-cols-20 gap-[2px] max-h-[140px] overflow-hidden">
                            {heatmapData.slice(0, 200).map((cell, idx) => (
                                <div
                                    key={idx}
                                    className={cn('w-3 h-3 rounded-sm cursor-pointer hover:ring-1 hover:ring-white/30', cell.color)}
                                    style={{ opacity: cell.intensity }}
                                    title={cell.symbol || ''}
                                />
                            ))}
                        </div>

                        {/* Heatmap Legend */}
                        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded bg-cyan-400" />
                                <span>Time: 1m Trend</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded bg-green-400" />
                                <span>◊ {topPairs[0]?.symbol || 'TOKEN'}: +{(topPairs[0]?.priceChange || 0).toFixed(1)}%</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span>Blue Pflaw: Atraxt</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded bg-yellow-400" />
                                <span>Atom Sessions</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Sidebar - Live Feed */}
                <div className="w-72 border-l border-[#1a1f2e] bg-[#0a0e16] flex flex-col">
                    {/* Live Feed Header */}
                    <div className="px-4 py-3 border-b border-[#1a1f2e]">
                        <h3 className="text-sm font-semibold text-white">Live Feed</h3>
                    </div>

                    {/* Selected Token */}
                    {selectedToken && (
                        <div className="px-4 py-3 border-b border-[#1a1f2e]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center overflow-hidden">
                                    {selectedToken.logo ? (
                                        <img src={selectedToken.logo} alt={selectedToken.symbol} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-xl">🪙</span>
                                    )}
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-white">{selectedToken.name}</div>
                                    <div className="text-xs text-gray-500">${selectedToken.symbol}</div>
                                    <div className="text-[10px] text-gray-600">Followers: {Math.floor(Math.random() * 500) + 100}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Mini Chart */}
                    <div className="px-4 py-3 border-b border-[#1a1f2e]">
                        <div className="h-24 bg-[#0d1117] rounded-lg flex items-end p-2 gap-[2px]">
                            {Array.from({ length: 40 }).map((_, i) => {
                                const isGreen = selectedToken ? selectedToken.priceChange >= 0 : i > 20;
                                const height = 20 + Math.random() * 60;
                                return (
                                    <div
                                        key={i}
                                        className={cn(
                                            'flex-1 rounded-t',
                                            isGreen ? 'bg-green-500/80' : 'bg-red-500/50'
                                        )}
                                        style={{ height: `${height}%` }}
                                    />
                                );
                            })}
                        </div>
                        <div className="flex justify-between mt-2 text-[10px] text-gray-600">
                            <span>200</span>
                            <span>400</span>
                            <span>600</span>
                            <span>800</span>
                            <span>1000</span>
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="flex-1 overflow-y-auto">
                        <div className="px-4 py-3 border-b border-[#1a1f2e]">
                            <h4 className="text-xs font-medium text-gray-400 mb-2">Recent Activity</h4>
                            <div className="space-y-2">
                                {recentActivity.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between py-1.5 px-2 bg-[#0d1117] rounded text-xs"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div
                                                className={cn(
                                                    'w-2 h-2 rounded-full',
                                                    item.type === 'buy' ? 'bg-green-500' :
                                                        item.type === 'sell' ? 'bg-red-500' : 'bg-gray-500'
                                                )}
                                            />
                                            <span className="text-gray-300">{item.label}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {item.change && (
                                                <span className={item.change.startsWith('+') ? "text-green-400" : "text-red-400"}>
                                                    {item.change}
                                                </span>
                                            )}
                                            {item.value && (
                                                <span className="text-white">{item.value}</span>
                                            )}
                                            <span className="text-gray-500">{item.time}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Funding Status / Additional Info */}
                        <div className="px-4 py-3">
                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between py-1 border-b border-[#1a1f2e]">
                                    <span className="text-gray-500">Funding Status</span>
                                    <div className="flex items-center gap-2">
                                        <div className="w-16 h-1.5 bg-green-500/50 rounded" />
                                        <span className="text-gray-400">$3.38</span>
                                        <span className="text-gray-600">183</span>
                                    </div>
                                </div>
                                <div className="flex justify-between py-1 border-b border-[#1a1f2e]">
                                    <span className="text-gray-500">Token Quantity</span>
                                    <div className="flex items-center gap-2">
                                        <div className="w-16 h-1.5 bg-cyan-500/50 rounded" />
                                        <span className="text-gray-400">$8.50+</span>
                                        <span className="text-gray-600">Find</span>
                                    </div>
                                </div>
                                <div className="flex justify-between py-1 border-b border-[#1a1f2e]">
                                    <span className="text-gray-500">Biogas Fixed</span>
                                    <div className="flex items-center gap-2">
                                        <div className="w-16 h-1.5 bg-purple-500/50 rounded" />
                                        <span className="text-gray-400">$8.50+</span>
                                        <span className="text-gray-600">Find</span>
                                    </div>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span className="text-gray-500">Rainy Raise</span>
                                    <div className="flex items-center gap-2">
                                        <div className="w-16 h-1.5 bg-yellow-500/50 rounded" />
                                        <span className="text-gray-400">$TBA</span>
                                        <span className="text-gray-600">183</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Status Bar */}
            <div className="flex items-center justify-end px-4 py-2 border-t border-[#1a1f2e] bg-[#0a0e16] text-xs">
                <div className="flex items-center gap-4">
                    <span className="text-green-400">⬤⬤ ${topPairs[0]?.price.toFixed(2) || '0.00'}</span>
                    <span className="text-green-400">{topPairs.length} pairs</span>
                    <span className="flex items-center gap-1">
                        {isConnected ? (
                            <Wifi className="w-3 h-3 text-green-400" />
                        ) : (
                            <WifiOff className="w-3 h-3 text-red-400" />
                        )}
                        <span className="text-gray-400">Connection: {isConnected ? 'Active' : 'Lost'}</span>
                    </span>
                </div>
            </div>
        </div>
    );
}
