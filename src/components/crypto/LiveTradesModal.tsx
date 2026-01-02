import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchWalletTrades, SolanaTrackerTrade } from '@/lib/solana-tracker-service';

interface Trade extends SolanaTrackerTrade {
    traderLabel?: string;
    id: string; // Use tx as id
}

interface LiveTradesModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    trackedWallets: Array<{ address: string; label: string }>;
    isDark: boolean;
}

export default function LiveTradesModal({ open, onOpenChange, trackedWallets, isDark }: LiveTradesModalProps) {
    const navigate = useNavigate();
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(false);

    // Load cached trades on mount
    useEffect(() => {
        if (!open) return;

        const cachedData = localStorage.getItem('axiom_live_trades_cache_v2');
        if (cachedData) {
            try {
                const parsed = JSON.parse(cachedData);
                // Filter cache to only show trades for currently tracked wallets
                const relevantTrades = parsed.filter((t: Trade) =>
                    trackedWallets.some(w =>
                        w.address.toLowerCase() === (typeof t.maker === 'string' ? t.maker : '').toLowerCase()
                    )
                );
                if (relevantTrades.length > 0) {
                    setTrades(relevantTrades);
                }
            } catch (e) {
                console.error('Failed to parse cached trades', e);
            }
        }

        // Initial fetch
        fetchRealTrades();

        // Poll every 5 seconds for real-time updates
        const interval = setInterval(fetchRealTrades, 5000);
        return () => clearInterval(interval);
    }, [open, trackedWallets.map(w => w.address).join(',')]);

    const fetchRealTrades = async () => {
        if (!open || trackedWallets.length === 0) return;

        if (trades.length === 0) setLoading(true);

        try {
            // Fetch trades for each wallet in parallel
            const walletTradesPromises = trackedWallets.map(wallet =>
                fetchWalletTrades(wallet.address).then(fetchedTrades => {
                    if (fetchedTrades.length > 0) {
                        console.log(`[SolanaTracker] Found ${fetchedTrades.length} trades for ${wallet.address}`);
                    }
                    // Add trader label to each trade
                    return fetchedTrades.map(t => ({
                        ...t,
                        traderLabel: wallet.label,
                        id: t.tx // Map tx to id for consistency
                    }));
                }).catch(err => {
                    console.error(`Failed to fetch trades for ${wallet.address}:`, err);
                    return [] as Trade[];
                })
            );

            const allWalletTradesResults = await Promise.all(walletTradesPromises);
            const allTradesRaw = allWalletTradesResults.flat();
            console.log(`Total raw trades found: ${allTradesRaw.length}`);

            // Merge with existing trades (deduplicate by ID)
            setTrades(prev => {
                const combined = [...allTradesRaw, ...prev];
                const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
                const sorted = unique.sort((a, b) => b.time - a.time).slice(0, 100); // Keep last 100

                // Update cache
                localStorage.setItem('axiom_live_trades_cache_v2', JSON.stringify(sorted));
                return sorted;
            });

        } catch (err) {
            console.error('Error fetching real trades from Solana Tracker:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatTimeAgo = (timestamp: number) => {
        // Solana Tracker returns timestamp in seconds
        const time = timestamp * 1000;
        const mins = Math.floor((Date.now() - time) / (1000 * 60));
        if (mins < 1) return 'now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return new Date(time).toLocaleDateString();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={cn(
                "max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-0",
                isDark ? "bg-black border-[#27272a]" : "bg-white border-gray-200"
            )}>
                <div className={cn(
                    "flex items-center justify-between p-4 border-b pr-12",
                    isDark ? "border-[#27272a] bg-black" : "border-gray-100 bg-white"
                )}>
                    <div className="flex items-center gap-2">
                        <div>
                            <DialogTitle className={cn("text-xl font-bold", isDark ? "text-white" : "text-gray-900")}>
                                Live Activity Feed
                            </DialogTitle>
                            <DialogDescription className={isDark ? "text-slate-400" : "text-gray-500"}>
                                Real-time activity from your tracked wallets via Solana Tracker
                            </DialogDescription>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                            <div className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </div>
                            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                                {loading ? 'Updating...' : 'Live'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4">
                    <table className="w-full text-sm">
                        <thead className={cn(
                            "sticky top-0 z-10 py-2 border-b",
                            isDark ? "bg-black border-[#27272a] text-[#6b7280]" : "bg-white border-gray-200 text-gray-500"
                        )}>
                            <tr className="text-left font-medium">
                                <th className="pb-3 pr-4">Time</th>
                                <th className="pb-3 pr-4">Name</th>
                                <th className="pb-3 pr-4">Token</th>
                                <th className="pb-3 pr-4 text-right">Amount</th>
                                <th className="pb-3 pr-4 text-right">Value</th>
                                <th className="pb-3 text-right">Link</th>
                            </tr>
                        </thead>
                        <tbody className={cn(
                            "divide-y",
                            isDark ? "divide-[#1f2937]" : "divide-gray-100"
                        )}>
                            {loading && trades.length === 0 ? (
                                Array.from({ length: 10 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={6} className="py-4">
                                            <div className={cn("h-10 w-full rounded", isDark ? "bg-white/5" : "bg-gray-100")} />
                                        </td>
                                    </tr>
                                ))
                            ) : trades.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-24 text-center">
                                        <div className="flex flex-col items-center justify-center space-y-3">
                                            <Activity className="w-12 h-12 text-slate-700 animate-pulse" />
                                            <p className="text-slate-400 font-medium">No recent trades found for tracked wallets.</p>
                                            <p className="text-xs text-slate-500">Transactions are fetched directly from the blockchain.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                trades.map((trade, idx) => {
                                    const isBuy = trade.type === 'buy';
                                    const token = trade.token || {};
                                    const tokenSymbol = token.symbol || '???';
                                    const tokenMint = token.mint || '';

                                    return (
                                        <tr key={`${trade.tx}-${idx}`} className={cn(
                                            "transition-colors group",
                                            isDark ? "hover:bg-white/5 border-slate-800" : "hover:bg-gray-50 border-gray-100"
                                        )}>
                                            <td className="py-4 whitespace-nowrap text-gray-400 font-mono text-xs">
                                                {formatTimeAgo(trade.time)}
                                            </td>
                                            <td className="py-4 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className={cn("font-medium text-sm", isDark ? "text-white" : "text-gray-900")}>
                                                        {trade.traderLabel}
                                                    </span>
                                                    <span className="text-[10px] text-slate-500 font-mono">
                                                        {typeof trade.maker === 'string' ? `${trade.maker.slice(0, 4)}...${trade.maker.slice(-4)}` : 'Unknown'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-4 whitespace-nowrap">
                                                <div
                                                    className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                                                    onClick={() => tokenMint && navigate(`/crypto/tokens?pair=${tokenSymbol}/USD&address=${tokenMint}`)}
                                                >
                                                    {token.image && (
                                                        <img
                                                            src={token.image}
                                                            alt={tokenSymbol}
                                                            className="w-8 h-8 rounded-full object-cover"
                                                        />
                                                    )}
                                                    {!token.image && (
                                                        <div className={cn(
                                                            "w-8 h-8 rounded-full flex items-center justify-center font-bold",
                                                            isBuy ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                                                        )}>
                                                            {tokenSymbol[0]}
                                                        </div>
                                                    )}
                                                    <div className="flex flex-col">
                                                        <span className={cn("font-bold text-sm", isDark ? "text-gray-100" : "text-gray-900")}>
                                                            {tokenSymbol}
                                                        </span>
                                                        <span className={cn(
                                                            "text-[10px] font-bold px-1 rounded inline-block w-fit",
                                                            isBuy ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                                                        )}>
                                                            {isBuy ? 'BUY' : 'SELL'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 whitespace-nowrap text-right font-medium">
                                                <span className={cn("text-sm", isDark ? "text-white" : "text-gray-900")}>
                                                    {(trade.amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} {tokenSymbol}
                                                </span>
                                            </td>
                                            <td className="py-4 whitespace-nowrap text-right">
                                                <span className={cn("text-sm font-mono", isDark ? "text-gray-400" : "text-gray-600")}>
                                                    ${(trade.volume || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                </span>
                                            </td>
                                            <td className="py-4 whitespace-nowrap text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className={cn("h-8 w-8 p-0", isDark ? "hover:bg-white/10" : "hover:bg-gray-100")}
                                                    onClick={() => window.open(`https://solscan.io/tx/${trade.tx}`, '_blank')}
                                                >
                                                    <ExternalLink className="w-4 h-4 text-slate-500" />
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </DialogContent>
        </Dialog>
    );
}

