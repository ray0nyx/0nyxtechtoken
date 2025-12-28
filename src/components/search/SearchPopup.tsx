import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, Clock, TrendingUp, BarChart2, Zap, ArrowUpRight, DollarSign } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { fetchNewPumpFunCoins, type PumpFunCoin } from '@/lib/pump-fun-service';

// Mock Data for Market Overview Chart
const MARKET_DATA = [
    { time: '10:00', value: 120 },
    { time: '11:00', value: 132 },
    { time: '12:00', value: 125 },
    { time: '13:00', value: 145 },
    { time: '14:00', value: 130 },
    { time: '15:00', value: 125.76 },
];

const DOMINANCE_DATA = [
    { name: 'SOL', value: 45, color: '#10b981' }, // emerald-500
    { name: 'ETH', value: 20, color: '#374151' }, // gray-700
    { name: 'BTC', value: 25, color: '#1f2937' }, // gray-800
];

const RECENT_ACTIVITY = [
    { name: 'Seals Garludt', value: 'SOL $125.6' },
    { name: 'Feysent Syel...', value: '$146.7' },
    { name: 'Desloors Merincs', value: '$147.7' },
    { name: 'Tals Mle Vide', value: 'SOL $8.48.19' },
    { name: 'Staitard Marime', value: '$122.8' },
    { name: 'Mokte Einpild...', value: 'SOL $78.1' },
    { name: 'SPSC Shils Tarler', value: '$176.7' },
    { name: 'Lpsoiros Dect:...', value: '$120.8' },
];

export function SearchPopup({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const loadData = async () => {
                setLoading(true);
                try {
                    const coins = await fetchNewPumpFunCoins(20);
                    const formatted = coins.map(coin => ({
                        id: coin.mint,
                        name: coin.name,
                        symbol: coin.symbol,
                        age: '1m', // Placeholder
                        mc: coin.usd_market_cap ? `$${(coin.usd_market_cap / 1000).toFixed(1)}K` : 'N/A',
                        vol: '$12K', // Placeholder
                        liq: '$500', // Placeholder
                        image: coin.image_uri
                    }));
                    setSearchResults(formatted);
                } catch (e) {
                    console.error("Failed to fetch tokens", e);
                } finally {
                    setLoading(false);
                }
            };
            loadData();
        }
    }, [isOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="max-w-[1000px] w-[95vw] bg-[#1a1b1e] border-none text-gray-200 p-0 overflow-hidden rounded-2xl shadow-2xl">

                {/* Header Section */}
                <div className="p-6 border-b border-white/5 space-y-4 bg-[#141517]">
                    <div className="flex items-center justify-end gap-2 text-gray-400">
                        <span className="text-xs mr-2">Sort by</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-white hover:bg-white/10"><Clock className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-white hover:bg-white/10"><TrendingUp className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-white hover:bg-white/10"><BarChart2 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-white hover:bg-white/10"><Zap className="h-4 w-4" /></Button>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                            <Input
                                placeholder="Search Solana tokens..."
                                className="pl-10 h-10 bg-[#25262b] border-none text-white placeholder:text-gray-500 rounded-lg focus-visible:ring-1 focus-visible:ring-gray-700"
                            />
                        </div>
                        <div className="flex items-center gap-1 bg-[#25262b] rounded-lg p-1">
                            <Button size="sm" variant="secondary" className="h-8 bg-gray-600/50 hover:bg-gray-600 text-white text-xs gap-1">
                                <TrendingUp className="h-3 w-3" /> Trending
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 text-gray-400 hover:text-white text-xs">New</Button>
                            <Button size="sm" variant="ghost" className="h-8 text-gray-400 hover:text-white text-xs">Whale Watch</Button>
                        </div>
                        <Button size="icon" variant="ghost" className="h-10 w-10 text-gray-400 bg-[#25262b] rounded-lg hover:text-white hover:bg-white/10">
                            All
                        </Button>
                    </div>

                    <ScrollArea className="w-full whitespace-nowrap">
                        <div className="flex w-max space-x-2 pb-2">
                            <Badge variant="outline" className="bg-[#25262b] border-none text-gray-400 hover:text-white cursor-pointer px-3 py-1 bg-gradient-to-r from-gray-800 to-gray-800 hover:from-gray-700 hover:to-gray-700 transition-all">
                                <span className="mr-1">◎</span> SOL
                            </Badge>
                            <Badge variant="outline" className="bg-[#25262b] border-none text-gray-400 hover:text-white cursor-pointer px-3 py-1">USDC</Badge>
                            <Badge variant="outline" className="bg-[#25262b] border-none text-gray-400 hover:text-white cursor-pointer px-3 py-1 flex items-center gap-1"><DollarSign className="h-3 w-3" /> USDC</Badge>
                            <Badge variant="outline" className="bg-[#25262b] border-none text-gray-400 hover:text-white cursor-pointer px-3 py-1">USDT</Badge>
                            <Badge variant="outline" className="bg-[#25262b] border-none text-gray-400 hover:text-white cursor-pointer px-3 py-1">USDT</Badge>
                        </div>
                    </ScrollArea>
                </div>

                {/* Body Section */}
                <div className="flex h-[600px]">
                    {/* Left: Search Results */}
                    <div className="flex-[2] border-r border-white/5 p-4 bg-[#1a1b1e]">
                        <h3 className="text-lg font-medium text-gray-200 mb-4 px-2">Top Search Results</h3>
                        <ScrollArea className="h-[540px]">
                            <div className="space-y-1">
                                {loading && <div className="text-gray-500 text-center py-4">Loading tokens...</div>}
                                {!loading && searchResults.length === 0 && <div className="text-gray-500 text-center py-4">No tokens found.</div>}
                                {searchResults.map((token) => (
                                    <div key={token.id} className="group flex items-center justify-between p-3 rounded-xl hover:bg-[#25262b] transition-colors cursor-pointer">
                                        <div className="flex items-center gap-3">
                                            <img src={token.image} alt={token.name} className="w-10 h-10 rounded-lg bg-gray-800 object-cover" />
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-gray-200">{token.name}</span>
                                                    <span className="text-gray-500 text-xs bg-gray-800/50 px-1 rounded">❐</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                                    <span className="text-emerald-400">{token.age}</span>
                                                    <span>□□</span>
                                                    <span>🌐</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6 text-sm">
                                            <div className="flex flex-col items-end">
                                                <span className="text-gray-500 text-xs uppercase">MC</span>
                                                <span className="font-bold text-gray-200">{token.mc}</span>
                                            </div>
                                            <div className="flex flex-col items-end w-16">
                                                <span className="text-gray-500 text-xs uppercase">V</span>
                                                <span className="font-bold text-gray-200">{token.vol}</span>
                                            </div>
                                            <div className="flex flex-col items-end w-16">
                                                <span className="text-gray-500 text-xs uppercase">L</span>
                                                <span className="font-bold text-gray-200">{token.liq}</span>
                                            </div>
                                            <Button size="icon" className="h-8 w-8 rounded-full bg-[#2d5f58] hover:bg-[#3d7f78] text-emerald-300 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                                                <Zap className="h-4 w-4" fill="currentColor" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Right: Market Overview */}
                    <div className="flex-1 p-4 bg-[#1a1b1e] flex flex-col gap-6">
                        {/* Area Chart Section */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-md font-medium text-gray-300">Market Overview</h3>
                            </div>
                            <div className="h-[120px] w-full relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={MARKET_DATA}>
                                        <defs>
                                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <Tooltip cursor={false} content={<></>} />
                                        <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                                <div className="absolute top-2 right-0 text-right">
                                    <div className="text-xs text-gray-500">SO. SOL</div>
                                    <div className="text-xs text-emerald-400 font-bold">40L 30%</div>
                                    <div className="text-xs text-emerald-400">25%</div>
                                </div>
                                <div className="mt-2 text-sm font-medium text-gray-200">SOL Price: $125.76</div>
                            </div>
                        </div>

                        {/* Domincance Donut */}
                        <div className="flex items-center gap-4">
                            <div className="relative h-20 w-20">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={DOMINANCE_DATA}
                                            innerRadius={25}
                                            outerRadius={38}
                                            paddingAngle={0}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {DOMINANCE_DATA.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-200">
                                    45%
                                </div>
                            </div>
                            <div className="text-xs space-y-1">
                                <div className="text-gray-400">Dominance:</div>
                                <div className="flex gap-2 text-gray-300">
                                    <span>ETH: 20%</span>
                                    <span className="text-emerald-400">20%</span>
                                </div>
                                <div className="text-emerald-400 ml-8">25%</div>
                            </div>
                        </div>

                        {/* Recent Activity List */}
                        <div className="flex-1 overflow-hidden flex flex-col">
                            <h3 className="text-sm font-medium text-gray-300 mb-3">Recent Activity</h3>
                            <ScrollArea className="flex-1 -mr-2 pr-2">
                                <div className="space-y-3">
                                    {RECENT_ACTIVITY.map((item, i) => (
                                        <div key={i} className="flex justify-between items-center text-xs">
                                            <span className="text-gray-400">{item.name}</span>
                                            <span className="text-gray-300 font-mono">{item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default SearchPopup;
