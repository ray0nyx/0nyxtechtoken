import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Connection } from '@solana/web3.js';
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink, RefreshCw, Trophy, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { searchTokens } from '@/lib/dex-screener-service';
import { fetchWalletTrades, ParsedSwapTransaction } from '@/lib/helius-service';

interface Trade extends ParsedSwapTransaction {
    traderLabel?: string;
    tokenSymbol: string;
    marketCap: number;
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

        const cachedData = localStorage.getItem('axiom_live_trades_cache');
        if (cachedData) {
            try {
                const parsed = JSON.parse(cachedData);
                // Filter cache to only show trades for currently tracked wallets
                const relevantTrades = parsed.filter((t: Trade) =>
                    trackedWallets.some(w =>
                        w.address.toLowerCase() === (t.maker || (t as any).wallet || '').toLowerCase()
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

        // Don't set loading to true if we already have data (background refresh)
        // setTrades will trigger re-render anyway
        if (trades.length === 0) setLoading(true);

        try {
            // Fetch trades for each wallet in parallel
            const walletTradesPromises = trackedWallets.map(wallet =>
                fetchWalletTrades(wallet.address, 50).then(trades => { // Fetch 50 to dig deeper
                    if (trades.length > 0) {
                        console.log(`[Helius] Found ${trades.length} trades for ${wallet.address}`);
                    }
                    // Add trader label to each trade
                    return trades.map(t => ({
                        ...t,
                        traderLabel: wallet.label
                    }));
                }).catch(err => {
                    console.error(`Failed to fetch trades for ${wallet.address}:`, err);
                    return [] as Trade[];
                })
            );

            const allWalletTradesResults = await Promise.all(walletTradesPromises);
            const allTradesRaw = allWalletTradesResults.flat();
            console.log(`Total raw trades found: ${allTradesRaw.length}`);

            // Enrich with token meta and market cap if missing
            const enrichedTradesPromise = Promise.all(
                allTradesRaw.map(async (trade) => {
                    // If we already have this trade in state with enriched data, reuse it
                    const existing = trades.find(t => t.id === trade.id);
                    if (existing && existing.priceUsd > 0 && existing.tokenSymbol !== '???') {
                        return existing;
                    }

                    try {
                        const tokenMeta = await searchTokens(trade.tokenAddress);
                        const pair = tokenMeta?.[0];
                        return {
                            ...trade,
                            tokenSymbol: pair?.baseToken?.symbol || trade.tokenAddress.slice(0, 4),
                            marketCap: pair?.marketCap || 0,
                        } as Trade;
                    } catch (e) {
                        return {
                            ...trade,
                            tokenSymbol: trade.tokenAddress.slice(0, 4),
                            marketCap: 0,
                        } as Trade;
                    }
                })
            );

            const enrichedTrades = await enrichedTradesPromise;

            // Merge with existing trades (deduplicate by ID)
            setTrades(prev => {
                const combined = [...enrichedTrades, ...prev];
                const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
                const sorted = unique.sort((a, b) => b.timestamp - a.timestamp).slice(0, 100); // Keep last 100

                // Update cache
                localStorage.setItem('axiom_live_trades_cache', JSON.stringify(sorted));
                return sorted;
            });

        } catch (err) {
            console.error('Error fetching real trades from Helius:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatTimeAgo = (timestamp: string | number) => {
        const time = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
        const mins = Math.floor((Date.now() - time) / (1000 * 60));
        if (mins < 1) return 'now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return new Date(time).toLocaleDateString();
    };

    const formatMC = (mc: number) => {
        if (!mc || mc === 0) return '-';
        if (mc >= 1000000) return `$${(mc / 1000000).toFixed(1)}M`;
        if (mc >= 1000) return `$${(mc / 1000).toFixed(1)}K`;
        return `$${mc.toFixed(0)}`;
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
                                Real-time activity from your tracked wallets
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
                                <th className="pb-3 pr-4 text-right">$MC</th>
                                <th className="pb-3 text-right">Link</th>
                            </tr>
                        </thead>
                        <tbody className={cn(
                            "divide-y",
                            isDark ? "divide-[#1f2937]" : "divide-gray-100"
                        )}>
                            {loading ? (
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
                                    const tokenMint = trade.tokenAddress;
                                    const amountToken = trade.tokenAmount;
                                    const amountSol = trade.solAmount;
                                    const tokenSymbol = (trade as any).tokenSymbol || '???';

                                    return (
                                        <tr key={`${trade.txHash}-${idx}`} className={cn(
                                            "transition-colors group",
                                            isDark ? "hover:bg-white/5 border-slate-800" : "hover:bg-gray-50 border-gray-100"
                                        )}>
                                            <td className="py-4 whitespace-nowrap text-gray-400 font-mono text-xs">
                                                {formatTimeAgo(trade.timestamp)}
                                            </td>
                                            <td className="py-4 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className={cn("font-medium text-sm", isDark ? "text-white" : "text-gray-900")}>
                                                        {trade.traderLabel}
                                                    </span>
                                                    <span className="text-[10px] text-slate-500 font-mono">
                                                        {trade.maker.slice(0, 4)}...{trade.maker.slice(-4)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-4 whitespace-nowrap">
                                                <div
                                                    className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                                                    onClick={() => navigate(`/crypto/tokens?pair=${trade.tokenSymbol}/USD&address=${tokenMint}`)}
                                                >
                                                    <div className={cn(
                                                        "w-8 h-8 rounded-full flex items-center justify-center font-bold",
                                                        isBuy ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                                                    )}>
                                                        {tokenSymbol[0]}
                                                    </div>
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
                                                <div className="flex flex-col items-end">
                                                    <span className={cn("text-sm", isDark ? "text-white" : "text-gray-900")}>
                                                        {amountToken.toLocaleString(undefined, { maximumFractionDigits: 2 })} {tokenSymbol}
                                                    </span>
                                                    <span className="text-xs text-slate-500">
                                                        {amountSol.toFixed(3)} SOL
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-4 whitespace-nowrap text-right">
                                                <span className={cn("text-sm font-mono", isDark ? "text-gray-400" : "text-gray-600")}>
                                                    {formatMC(trade.marketCap)}
                                                </span>
                                            </td>
                                            <td className="py-4 whitespace-nowrap text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className={cn("h-8 w-8 p-0", isDark ? "hover:bg-white/10" : "hover:bg-gray-100")}
                                                    onClick={() => window.open(`https://solscan.io/tx/${trade.txHash}`, '_blank')}
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
