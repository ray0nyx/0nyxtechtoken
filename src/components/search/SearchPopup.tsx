import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Trash2, Loader2 } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { fetchNewPumpFunCoins, fetchPumpFunCoinDetails } from '@/lib/pump-fun-service';
import { searchTokens } from '@/lib/dex-screener-service';
import { fetchTokenPrice } from '@/lib/wallet-balance-service';
import { fetchOHLCV } from '@/lib/birdeye-websocket-service';
import { Connection } from '@solana/web3.js';
import { proxyImageUrl } from '@/lib/ipfs-utils';
import { cn } from '@/lib/utils';

const SEARCH_HISTORY_KEY = 'token_search_history';
const MAX_HISTORY_ITEMS = 20;

interface SearchHistoryItem {
    id: string;
    name: string;
    symbol: string;
    image?: string;
    mc?: string;
    timestamp: number;
}

interface PriceDataPoint {
    time: string;
    value: number;
}

// Helper functions for search history
const getSearchHistory = (): SearchHistoryItem[] => {
    try {
        const history = localStorage.getItem(SEARCH_HISTORY_KEY);
        return history ? JSON.parse(history) : [];
    } catch {
        return [];
    }
};

const saveSearchHistory = (history: SearchHistoryItem[]) => {
    try {
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
    } catch {
        console.error('Failed to save search history');
    }
};

const addToSearchHistory = (token: { id: string; name: string; symbol: string; image?: string; mc?: string }) => {
    const history = getSearchHistory();
    // Remove existing entry if present
    const filteredHistory = history.filter(item => item.id !== token.id);
    // Add new entry at the beginning
    const newHistory = [
        { ...token, timestamp: Date.now() },
        ...filteredHistory
    ].slice(0, MAX_HISTORY_ITEMS);
    saveSearchHistory(newHistory);
    return newHistory;
};

const removeFromSearchHistory = (tokenId: string) => {
    const history = getSearchHistory();
    const newHistory = history.filter(item => item.id !== tokenId);
    saveSearchHistory(newHistory);
    return newHistory;
};

const clearSearchHistory = () => {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
    return [];
};

export function SearchPopup({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [allTokens, setAllTokens] = useState<any[]>([]);
    const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [marketStats, setMarketStats] = useState({ price: 0, change: 0, tps: 0 });
    const [priceHistory, setPriceHistory] = useState<PriceDataPoint[]>([]);
    const priceIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const navigate = useNavigate();

    // Fetch real-time SOL price and TPS
    const fetchSolanaData = async () => {
        try {
            const priceData = await fetchTokenPrice('solana');

            // Fetch TPS
            let tps = 0;
            try {
                const connection = new Connection(import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
                const samples = await connection.getRecentPerformanceSamples(1);
                if (samples.length > 0) {
                    tps = Math.round(samples[0].numTransactions / samples[0].samplePeriodSecs);
                }
            } catch (e) {
                console.error("Failed to fetch TPS", e);
                tps = 2500; // Fallback
            }

            setMarketStats({
                price: priceData.price,
                change: priceData.change24h,
                tps
            });
        } catch (e) {
            console.error("Failed to fetch SOL data", e);
        }
    };

    // Fetch 24hr historical price data from Birdeye
    const fetch24hrHistory = async () => {
        try {
            const SOLANA_MINT = 'So11111111111111111111111111111111111111112';
            const data = await fetchOHLCV(SOLANA_MINT, '1h', 24);

            if (data && data.length > 0) {
                const formattedData: PriceDataPoint[] = data.map(item => {
                    const date = new Date(item.unixTime * 1000);
                    const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                    return { time: timeStr, value: item.close };
                });
                setPriceHistory(formattedData);
            } else {
                // Fallback to CoinGecko
                const response = await fetch(
                    'https://api.coingecko.com/api/v3/coins/solana/market_chart?vs_currency=usd&days=1'
                );
                if (response.ok) {
                    const cgData = await response.json();
                    const formattedData: PriceDataPoint[] = cgData.prices.map((item: [number, number]) => {
                        const date = new Date(item[0]);
                        const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                        return { time: timeStr, value: item[1] };
                    });
                    const step = Math.max(1, Math.floor(formattedData.length / 24));
                    const sampledData = formattedData.filter((_, i) => i % step === 0);
                    setPriceHistory(sampledData);
                }
            }
        } catch (e) {
            console.error("Failed to fetch 24hr history", e);
        }
    };


    // Cleanup interval on unmount
    useEffect(() => {
        return () => {
            if (priceIntervalRef.current) {
                clearInterval(priceIntervalRef.current);
            }
        };
    }, []);

    // Load search history and start price updates when popup opens
    useEffect(() => {
        if (isOpen) {
            setSearchHistory(getSearchHistory());

            // Fetch 24hr historical data first
            fetch24hrHistory();

            // Initial fetch for current price/TPS
            fetchSolanaData();

            // Set up interval for real-time price updates (every 30 seconds)
            priceIntervalRef.current = setInterval(fetchSolanaData, 30000);

            // Fetch tokens for search
            const loadTokens = async () => {
                setLoading(true);
                try {
                    const coins = await fetchNewPumpFunCoins(50);
                    const formatted = coins.map(coin => ({
                        id: coin.mint,
                        name: coin.name,
                        symbol: coin.symbol,
                        mc: coin.usd_market_cap ? `$${(coin.usd_market_cap / 1000).toFixed(1)}K` : 'N/A',
                        image: coin.image_uri
                    }));
                    setAllTokens(formatted);
                } catch (e) {
                    console.error("Failed to fetch tokens", e);
                } finally {
                    setLoading(false);
                }
            };
            loadTokens();
        } else {
            // Clear interval when popup closes
            if (priceIntervalRef.current) {
                clearInterval(priceIntervalRef.current);
                priceIntervalRef.current = null;
            }
            // Reset search
            setSearchQuery('');
            setSearchResults([]);
        }
    }, [isOpen]);

    // Handle Search with debounce
    useEffect(() => {
        const handleSearch = async () => {
            if (!searchQuery.trim()) {
                setSearchResults([]);
                return;
            }

            setSearchLoading(true);
            const query = searchQuery.trim();
            const queryLower = query.toLowerCase();

            // Check if it's a Solana address (base58, typically 32-44 chars)
            const isSolanaAddress = query.length >= 32 && query.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(query);

            if (isSolanaAddress) {
                try {
                    // Try Pump.fun first
                    const details = await fetchPumpFunCoinDetails(query);
                    if (details) {
                        const formatted = [{
                            id: details.mint,
                            name: details.name,
                            symbol: details.symbol,
                            mc: details.usd_market_cap ? `$${(details.usd_market_cap / 1000).toFixed(1)}K` : 'N/A',
                            image: details.image_uri
                        }];
                        setSearchResults(formatted);
                        setSearchLoading(false);
                        return;
                    }

                    // Fallback to DexScreener for non-Pump.fun tokens
                    const dexResults = await searchTokens(query);
                    if (dexResults && dexResults.length > 0) {
                        const formatted = dexResults.map(token => ({
                            id: token.baseToken.address,
                            name: token.baseToken.name,
                            symbol: token.baseToken.symbol,
                            mc: token.marketCap ? `$${(token.marketCap / 1000).toFixed(1)}K` : 'N/A',
                            image: token.baseToken.logoURI
                        }));
                        setSearchResults(formatted);
                    } else {
                        setSearchResults([]);
                    }
                } catch (e) {
                    console.error('Search by CA failed:', e);
                    setSearchResults([]);
                }
            } else {
                // Filter by name or symbol from loaded tokens
                const filtered = allTokens.filter(token =>
                    token.name.toLowerCase().includes(queryLower) ||
                    token.symbol.toLowerCase().includes(queryLower)
                );

                // If no local results, try DexScreener search
                if (filtered.length === 0 && query.length >= 2) {
                    try {
                        const dexResults = await searchTokens(query);
                        if (dexResults && dexResults.length > 0) {
                            const formatted = dexResults.map(token => ({
                                id: token.baseToken.address,
                                name: token.baseToken.name,
                                symbol: token.baseToken.symbol,
                                mc: token.marketCap ? `$${(token.marketCap / 1000).toFixed(1)}K` : 'N/A',
                                image: token.baseToken.logoURI
                            }));
                            setSearchResults(formatted);
                            setSearchLoading(false);
                            return;
                        }
                    } catch (e) {
                        console.error('DexScreener search failed:', e);
                    }
                }

                setSearchResults(filtered);
            }
            setSearchLoading(false);
        };

        const timeoutId = setTimeout(handleSearch, 300);
        return () => clearTimeout(timeoutId);
    }, [searchQuery, allTokens]);

    // Handle token selection - single click navigates
    const handleTokenSelect = (token: any) => {
        const newHistory = addToSearchHistory(token);
        setSearchHistory(newHistory);
        setIsOpen(false);
        navigate(`/crypto/tokens?address=${token.id}`);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="max-w-[1000px] w-[95vw] bg-[#111111] border-none text-gray-200 p-0 overflow-hidden rounded-2xl shadow-2xl">
                <DialogTitle className="sr-only">Search Tokens</DialogTitle>
                <DialogDescription className="sr-only">
                    Search for tokens by name or contract address and view real-time market data.
                </DialogDescription>

                {/* Header Section */}
                <div className="p-6 border-b border-white/5 bg-[#111111]">
                    <div className="flex items-center gap-3 mr-8">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                            <Input
                                placeholder="Search tokens by name or contract address..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 h-10 bg-[#25262b] border-none text-white placeholder:text-gray-500 rounded-lg focus-visible:ring-1 focus-visible:ring-gray-700"
                                autoFocus
                            />
                            {searchLoading && (
                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 animate-spin" />
                            )}
                        </div>
                    </div>
                </div>

                {/* Body Section */}
                <div className="flex h-[500px]">
                    {/* Left Panel: Search Results or History */}
                    <div className="flex-[2] border-r border-white/5 p-4 bg-[#111111]">
                        {/* Show search results when searching, otherwise show history */}
                        {searchQuery.trim() ? (
                            <>
                                <h3 className="text-lg font-medium text-gray-200 mb-4 px-2">Search Results</h3>
                                <ScrollArea className="h-[420px]">
                                    <div className="space-y-1">
                                        {searchLoading && (
                                            <div className="text-gray-500 text-center py-8">
                                                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                                                <p>Searching...</p>
                                            </div>
                                        )}
                                        {!searchLoading && searchResults.length === 0 && (
                                            <div className="text-gray-500 text-center py-8">
                                                <p>No tokens found</p>
                                                <p className="text-xs mt-1">Try a different name or contract address</p>
                                            </div>
                                        )}
                                        {!searchLoading && searchResults.map((token) => (
                                            <div
                                                key={token.id}
                                                className="flex items-center justify-between p-3 rounded-xl hover:bg-[#25262b] transition-colors cursor-pointer"
                                                onClick={() => handleTokenSelect(token)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    {token.image ? (
                                                        <img
                                                            src={proxyImageUrl(token.image)}
                                                            alt={token.name}
                                                            className="w-10 h-10 rounded-lg bg-gray-800 object-cover"
                                                        />
                                                    ) : (
                                                        <div
                                                            className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white font-bold text-lg"
                                                            style={{ display: 'flex' }}
                                                        >
                                                            {(token.symbol || token.name || '?').charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-gray-200">{token.name}</span>
                                                            <span className="text-gray-500 text-xs">{token.symbol}</span>
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-0.5">
                                                            {token.mc && <span>MC: {token.mc}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </>
                        ) : (
                            <>
                                <div className="flex items-center justify-between mb-4 px-2">
                                    <h3 className="text-lg font-medium text-gray-200">Search History</h3>
                                    {searchHistory.length > 0 && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-gray-500 hover:text-red-400 text-xs"
                                            onClick={() => setSearchHistory(clearSearchHistory())}
                                        >
                                            Clear All
                                        </Button>
                                    )}
                                </div>
                                <ScrollArea className="h-[420px]">
                                    <div className="space-y-1">
                                        {searchHistory.length === 0 && (
                                            <div className="text-gray-500 text-center py-8">
                                                <p className="mb-2">No search history yet</p>
                                                <p className="text-xs">Tokens you view will appear here</p>
                                            </div>
                                        )}
                                        {searchHistory.map((token) => (
                                            <div
                                                key={token.id}
                                                className="group flex items-center justify-between p-3 rounded-xl hover:bg-[#25262b] transition-colors cursor-pointer"
                                                onClick={() => handleTokenSelect(token)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    {token.image ? (
                                                        <img
                                                            src={proxyImageUrl(token.image)}
                                                            alt={token.name}
                                                            className="w-10 h-10 rounded-lg bg-gray-800 object-cover"
                                                        />
                                                    ) : (
                                                        <div
                                                            className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white font-bold text-lg"
                                                            style={{ display: 'flex' }}
                                                        >
                                                            {(token.symbol || token.name || '?').charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-gray-200">{token.name}</span>
                                                            <span className="text-gray-500 text-xs">{token.symbol}</span>
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-0.5">
                                                            {token.mc && <span>MC: {token.mc}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const newHistory = removeFromSearchHistory(token.id);
                                                            setSearchHistory(newHistory);
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </>
                        )}
                    </div>

                    {/* Right Panel: Market Overview */}
                    <div className="flex-1 p-6 bg-[#111111]">
                        <h3 className="text-lg font-medium text-gray-200 mb-4">Market Overview</h3>

                        {/* SOL Price Card */}
                        <div className="bg-[#0a0a0a] rounded-xl p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <img
                                        src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png"
                                        alt="SOL"
                                        className="w-8 h-8 rounded-full"
                                    />
                                    <div>
                                        <span className="text-white font-medium">Solana</span>
                                        <span className="text-gray-500 text-xs ml-2">SOL</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xl font-bold text-white">
                                        ${marketStats.price.toFixed(2)}
                                    </div>
                                    <div className={`text-sm font-medium ${marketStats.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {marketStats.change >= 0 ? '+' : ''}{marketStats.change.toFixed(2)}%
                                    </div>
                                </div>
                            </div>

                            {/* Price Chart */}
                            <div className="h-[150px] w-full mt-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={priceHistory.length > 0 ? priceHistory : [{ time: '', value: marketStats.price || 100 }]}>
                                        <defs>
                                            <linearGradient id="solPriceGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={marketStats.change >= 0 ? "#10b981" : "#ef4444"} stopOpacity={0.3} />
                                                <stop offset="95%" stopColor={marketStats.change >= 0 ? "#10b981" : "#ef4444"} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <XAxis
                                            dataKey="time"
                                            stroke="#4b5563"
                                            fontSize={10}
                                            tickLine={false}
                                            axisLine={false}
                                            interval="preserveStartEnd"
                                            tick={{ fill: '#6b7280' }}
                                        />
                                        <YAxis
                                            hide={true}
                                            domain={['dataMin - 1', 'dataMax + 1']}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="value"
                                            stroke={marketStats.change >= 0 ? "#10b981" : "#ef4444"}
                                            strokeWidth={2}
                                            fillOpacity={1}
                                            fill="url(#solPriceGradient)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Network Stats */}
                        <div className="mt-4 bg-[#0a0a0a] rounded-xl p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-gray-400 text-sm">Network TPS</span>
                                <span className="text-white font-medium">{marketStats.tps.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default SearchPopup;
