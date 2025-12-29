import React from 'react';
import {
    CheckCircle,
    Search as Eye,
    Trash2,
    Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import MiniSparkline from '@/components/crypto/MiniSparkline';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/crypto-aggregation-service';
import { useRealTimeTraderMetrics } from '@/hooks/useRealTimeTraderMetrics';

interface TraderRowProps {
    trader: any;
    index: number;
    isDark: boolean;
    analyzingWallets: Set<string>;
    handleRemoveWallet: (trader: any) => void;
    handleCopyTrader: (trader: any) => void;
    shortenAddress: (address: string) => string;
    getBlockchainBadge: (address: string) => { label: string; color: string };
}

export const TraderRow: React.FC<TraderRowProps> = ({
    trader: initialTrader,
    index,
    isDark,
    analyzingWallets,
    handleRemoveWallet,
    handleCopyTrader,
    shortenAddress,
    getBlockchainBadge
}) => {
    const isAnalyzing = analyzingWallets.has(initialTrader.wallet_address);

    // Use the real-time hook
    const trader = useRealTimeTraderMetrics(initialTrader, initialTrader.wallet_address, isAnalyzing);

    const badge = getBlockchainBadge(trader.wallet_address);
    const sparklineData = Array.from({ length: 20 }, () => Math.random() * 100);

    return (
        <div
            className={cn(
                "grid grid-cols-2 lg:grid-cols-9 gap-4 px-6 py-4 transition-colors items-center",
                isDark ? "hover:bg-[#27272a]" : "hover:bg-gray-50",
                isAnalyzing && "opacity-70 animate-pulse"
            )}
        >
            {/* Trader Info */}
            <div className="col-span-2 flex items-center gap-3">
                <div className="relative">
                    <div className={`w - 10 h - 10 rounded - full flex items - center justify - center text - white font - bold text - sm shadow - md ${index === 0 ? 'bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600' :
                            index === 1 ? 'bg-gradient-to-br from-slate-300 via-slate-400 to-slate-500' :
                                index === 2 ? 'bg-gradient-to-br from-amber-600 via-amber-700 to-amber-800' :
                                    'bg-gradient-to-br from-slate-700 to-slate-900 border border-slate-700'
                        } `}>
                        {index + 1}
                    </div>
                    {trader.is_verified && (
                        <CheckCircle className="absolute -bottom-1 -right-1 w-4 h-4 text-[#3b82f6] bg-[#1a1f2e] rounded-full" />
                    )}
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <span className={cn(
                            "font-semibold",
                            isDark ? "text-white" : "text-gray-900"
                        )}>
                            {trader.label || shortenAddress(trader.wallet_address)}
                        </span>
                        <span className={`text - xs px - 1.5 py - 0.5 rounded ${badge.color} `}>
                            {badge.label}
                        </span>
                    </div>
                    <div className={cn(
                        "text-[10px] md:text-xs flex items-center gap-2 mt-0.5",
                        isDark ? "text-[#94a3b8]" : "text-gray-500"
                    )}>
                        <span className="flex items-center gap-1">
                            <Activity className="w-3 h-3 opacity-60" />
                            {trader.total_trades} trades
                        </span>
                        {trader.solBalance !== undefined && (
                            <span className="flex items-center gap-1 border-l border-white/10 pl-2">
                                <span className="text-blue-400 font-medium">{trader.solBalance.toFixed(2)} SOL</span>
                                {trader.balanceUSD !== undefined && (
                                    <span className="opacity-60 text-[10px]">(${trader.balanceUSD?.toLocaleString(undefined, { maximumFractionDigits: 0 })})</span>
                                )}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* ROI */}
            <div className="hidden lg:block text-right">
                {isAnalyzing ? (
                    <span className="text-xs text-blue-400">Analyzing...</span>
                ) : (
                    <span className={`font - semibold ${trader.roi >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'} `}>
                        {trader.roi >= 0 ? '+' : ''}{trader.roi?.toFixed(1)}%
                    </span>
                )}
            </div>

            {/* Win Rate */}
            <div className="hidden lg:block text-right">
                <span className={isDark ? "text-white" : "text-gray-900"}>{trader.win_rate?.toFixed(1)}%</span>
            </div>

            {/* P&L 30d */}
            <div className="hidden lg:block text-right">
                <span className={`font - semibold ${trader.pnl_30d >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'} `}>
                    {formatCurrency(trader.pnl_30d || 0)}
                </span>
            </div>

            {/* Sharpe */}
            <div className="hidden lg:block text-right">
                <span className={isDark ? "text-white" : "text-gray-900"}>{trader.sharpe_ratio?.toFixed(2) || '-'}</span>
            </div>

            {/* Followers */}
            <div className="hidden lg:block text-right">
                <span className={isDark ? "text-white" : "text-gray-900"}>{trader.follower_count || 0}</span>
            </div>

            {/* 30d Trades */}
            <div className="hidden lg:block text-right">
                <span className={cn("text-sm", isDark ? "text-slate-300" : "text-slate-600")}>
                    {trader.trades_30d || '-'}
                </span>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 px-1">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                        e.stopPropagation();
                        window.open(`https://solscan.io/account/${trader.wallet_address}`, '_blank');
                    }}
                    className={
                        cn(
                            "h-8 w-8 p-0 rounded-lg",
                            isDark
                                ? "text-[#9ca3af] hover:text-white hover:bg-white/5"
                                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                        )
                    }
                    title="View on Solscan"
                >
                    <Eye className="w-4 h-4" />
                </Button >
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveWallet(trader);
                    }}
                    className={cn(
                        "h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    )}
                    title="Remove Tracking"
                >
                    <Trash2 className="w-4 h-4" />
                </Button>
                <Button
                    size="sm"
                    onClick={() => handleCopyTrader(trader)}
                    className={cn(
                        "h-8 px-4 font-semibold rounded-lg shadow-sm border-t border-white/10 transition-all",
                        isDark
                            ? "bg-gradient-to-b from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white"
                            : "bg-white hover:bg-gray-50 text-gray-900 border border-gray-200"
                    )}
                >
                    Copy
                </Button>
            </div >

            {/* Mobile: Additional Info */}
            < div className="col-span-2 lg:hidden flex items-center justify-between text-sm" >
                <div className="flex gap-4">
                    <span className={`${trader.roi >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                        ROI: {trader.roi >= 0 ? '+' : ''}{trader.roi?.toFixed(1)}%
                    </span>
                    <span className={isDark ? "text-[#9ca3af]" : "text-gray-500"}>
                        Win: {trader.win_rate?.toFixed(1)}%
                    </span>
                </div>
                <MiniSparkline
                    data={sparklineData}
                    color={trader.roi >= 0 ? '#10b981' : '#ef4444'}
                    width={60}
                    height={24}
                />
            </div >
        </div >
    );
};
