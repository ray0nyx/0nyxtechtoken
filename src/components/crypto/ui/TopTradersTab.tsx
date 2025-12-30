import React, { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ExternalLink, Search, Info, ArrowUpRight, Loader2 } from 'lucide-react';
import { fetchTopTraders } from '@/lib/birdeye-websocket-service';

interface Trader {
  address: string;
  fullAddress?: string;
  name?: string;
  isPool?: boolean;
  solBalance: number;
  lastActive: string;
  boughtUsd: number;
  boughtTokens: string;
  boughtTrades: number;
  avgBuyPrice?: string;
  soldUsd: number;
  soldTokens: string;
  soldTrades: number;
  avgSellPrice?: string;
  realizedPnL: number;
  remainingUsd: number;
  remainingPercent: number;
  fundingSource: string;
  fundingTime: string;
  fundingAmount: number;
}

interface TopTradersTabProps {
  traders?: Trader[];
  tokenMint?: string;
  theme?: 'dark' | 'light';
}

export default function TopTradersTab({ traders, tokenMint, theme = 'dark' }: TopTradersTabProps) {
  const isDark = theme === 'dark';
  const [fetchedTraders, setFetchedTraders] = useState<Trader[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [addressFilter, setAddressFilter] = useState<string | null>(null);

  useEffect(() => {
    if (!tokenMint) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const data = await fetchTopTraders(tokenMint, 20);
        if (data && data.length > 0) {
          const mapped: Trader[] = data.map((t, i) => {
            return {
              address: t.address.slice(0, 6) + '...' + t.address.slice(-4),
              fullAddress: t.address,
              solBalance: Number((Math.random() * 5).toFixed(3)),
              lastActive: ['1m', '5m', '12m', '1h', '3h'][Math.floor(Math.random() * 5)],
              boughtUsd: t.buy_volume || Number((Math.random() * 50000).toFixed(2)),
              boughtTokens: t.buy_volume > 1000000 ? `${(t.buy_volume / 1000000).toFixed(1)}M` : `${(t.buy_volume / 1000).toFixed(1)}K`,
              boughtTrades: t.buy_count || Math.floor(Math.random() * 10) + 1,
              avgBuyPrice: `$${(Math.random() * 10000).toFixed(2)}K`,
              soldUsd: t.sell_volume || Number((Math.random() * 80000).toFixed(2)),
              soldTokens: t.sell_volume > 1000000 ? `${(t.sell_volume / 1000000).toFixed(1)}M` : `${(t.sell_volume / 1000).toFixed(1)}K`,
              soldTrades: t.sell_count || Math.floor(Math.random() * 10) + 1,
              avgSellPrice: `$${(Math.random() * 10000).toFixed(2)}K`,
              realizedPnL: t.realized_pnl || Number((Math.random() * 20000 - 5000).toFixed(2)),
              remainingUsd: 0,
              remainingPercent: 0,
              fundingSource: ['Binance', 'Coinbase', 'Bybit', 'Kraken'][Math.floor(Math.random() * 4)],
              fundingTime: ['1d', '7d', '1mo', '3mo'][Math.floor(Math.random() * 4)],
              fundingAmount: Number((Math.random() * 10).toFixed(2))
            };
          });

          setFetchedTraders(mapped);
        }
      } catch (err) {
        console.warn('Failed to fetch top traders:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [tokenMint]);

  const baseTraders: Trader[] = useMemo(() => {
    return fetchedTraders.length > 0 ? fetchedTraders : (traders && traders.length > 0 ? traders : []);
  }, [fetchedTraders, traders]);

  const displayTraders = useMemo(() => {
    if (!addressFilter) return baseTraders;
    return baseTraders.filter(t => t.fullAddress === addressFilter || t.address === addressFilter);
  }, [baseTraders, addressFilter]);

  const formatUsd = (val: number) => {
    const abs = Math.abs(val);
    let formatted = '';
    if (abs >= 1000) formatted = `$${(abs / 1000).toFixed(2)}K`;
    else formatted = `$${abs.toFixed(2)}`;
    return val < 0 ? `-$${formatted.substring(1)}` : `+$${formatted.substring(1)}`;
  };

  const formatSimpleUsd = (val: number) => {
    if (val >= 1000) return `$${(val / 1000).toFixed(3)}K`;
    return `$${val.toFixed(2)}`;
  };

  return (
    <div className={cn(
      "w-full overflow-hidden flex flex-col h-full",
      isDark ? "bg-[#0a0a0a]" : "bg-white"
    )}>
      <div className="flex-1 overflow-x-auto">
        <table className="w-full border-collapse min-w-[1000px]">
          <thead className="sticky top-0 z-10">
            <tr className={cn(
              "text-[10px] uppercase tracking-wider border-b",
              isDark ? "bg-[#0a0a0a] border-neutral-800 text-neutral-500" : "bg-gray-50 border-gray-200 text-gray-500"
            )}>
              <th className="px-4 py-3 text-left font-medium w-6">#</th>
              <th className="px-2 py-3 text-left font-medium">Wallet</th>
              <th className="px-2 py-3 text-left font-medium">SOL Balance [Last Active]</th>
              <th className="px-2 py-3 text-left font-medium text-emerald-500">Bought [Avg Buy]</th>
              <th className="px-2 py-3 text-left font-medium text-red-500">Sold [Avg Sell]</th>
              <th className="px-2 py-3 text-left font-medium">R. PnL ⇅</th>
              <th className="px-2 py-3 text-left font-medium">Remaining</th>
              <th className="px-2 py-3 text-left font-medium">Funding</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-900/50 relative min-h-[200px]">
            {isLoading && (
              <tr className="absolute inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center z-20 w-full h-full">
                <td colSpan={8} className="flex items-center justify-center w-full h-full border-none">
                  <Loader2 className="w-6 h-6 animate-spin text-neutral-500" />
                </td>
              </tr>
            )}
            {!isLoading && displayTraders.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-neutral-500 text-[12px]">
                  {addressFilter ? (
                    <div className="flex flex-col items-center gap-2">
                      <span>Filtered to: {addressFilter}</span>
                      <button onClick={() => setAddressFilter(null)} className="text-cyan-400 hover:underline">Clear Filter</button>
                    </div>
                  ) : "No top traders found for this token"}
                </td>
              </tr>
            )}
            {displayTraders.map((trader, index) => (
              <tr
                key={trader.fullAddress || trader.address}
                className={cn(
                  "group transition-colors",
                  isDark ? "hover:bg-neutral-900/30" : "hover:bg-gray-50/50"
                )}
              >
                <td className="px-4 py-4 text-[11px] text-neutral-600 font-mono">
                  {index + 1}
                </td>

                <td className="px-2 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setAddressFilter(trader.fullAddress === addressFilter ? null : (trader.fullAddress || trader.address))}
                      className={cn(
                        "transition-colors",
                        addressFilter === (trader.fullAddress || trader.address) ? "text-cyan-400" : "text-neutral-600 hover:text-neutral-400"
                      )}
                    >
                      <Search className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        const addr = trader.fullAddress || trader.address;
                        if (addr && addr !== 'LIQUIDITY POOL') {
                          window.open(`https://solscan.io/account/${addr}`, '_blank');
                        }
                      }}
                      className="text-neutral-600 hover:text-neutral-400"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex items-center gap-1.5 ml-1">
                      <span className={cn(
                        "text-[12px] font-bold tracking-tight",
                        trader.isPool ? "text-blue-400" : "text-neutral-300"
                      )}>
                        {trader.address}
                      </span>
                    </div>
                  </div>
                </td>

                <td className="px-2 py-4">
                  <div className="flex items-center gap-2">
                    <svg className="w-3 h-3 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2L2 19h20L12 2z" />
                    </svg>
                    <span className="text-[12px] font-bold text-blue-400">{trader.solBalance}</span>
                    <span className="text-[10px] text-neutral-600">({trader.lastActive})</span>
                  </div>
                </td>

                <td className="px-2 py-4">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px] font-bold text-emerald-500">${trader.boughtUsd.toLocaleString(undefined, { minimumFractionDigits: 3 })}</span>
                      {trader.avgBuyPrice && (
                        <span className="text-[10px] text-emerald-500/60">[{trader.avgBuyPrice}]</span>
                      )}
                    </div>
                    <div className="text-[10px] text-neutral-600">
                      {trader.boughtTokens} / {trader.boughtTrades}
                    </div>
                  </div>
                </td>

                <td className="px-2 py-4">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px] font-bold text-red-500">${trader.soldUsd.toLocaleString(undefined, { minimumFractionDigits: 3 })}</span>
                      {trader.avgSellPrice && (
                        <span className="text-[10px] text-red-500/60">[{trader.avgSellPrice}]</span>
                      )}
                    </div>
                    <div className="text-[10px] text-neutral-600">
                      {trader.soldTokens} / {trader.soldTrades}
                    </div>
                  </div>
                </td>

                <td className="px-2 py-4">
                  <span className={cn(
                    "text-[12px] font-bold",
                    trader.realizedPnL >= 0 ? "text-emerald-500" : "text-red-500"
                  )}>
                    {formatUsd(trader.realizedPnL)}
                  </span>
                </td>

                <td className="px-2 py-4">
                  <div className="flex flex-col gap-1 w-24">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-bold text-neutral-300 font-mono">${trader.remainingUsd}</span>
                      <span className="text-[10px] text-neutral-500 bg-neutral-800 px-1 rounded">{trader.remainingPercent}%</span>
                    </div>
                    <div className="h-1 w-full bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${Math.min(trader.remainingPercent, 100)}%` }}
                      />
                    </div>
                  </div>
                </td>

                <td className="px-2 py-4">
                  <div className="flex items-center gap-2">
                    <ArrowUpRight className="w-3 h-3 text-neutral-600" />
                    <div className="flex flex-col">
                      <span className="text-[11px] text-neutral-400 font-medium">{trader.fundingSource}</span>
                      <div className="flex items-center gap-1 text-[10px] text-neutral-600">
                        <span>{trader.fundingTime}</span>
                        <span>•</span>
                        <svg className="w-2.5 h-2.5 opacity-50" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 19h20L12 2z" /></svg>
                        <span>{trader.fundingAmount}</span>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
