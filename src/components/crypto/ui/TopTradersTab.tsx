import React from 'react';
import { cn } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';

interface Trader {
  address: string;
  totalVolume: number;
  totalTrades: number;
  winRate: number;
  avgProfit: number;
  totalProfit: number;
}

interface TopTradersTabProps {
  traders?: Trader[];
  tokenMint?: string;
  theme?: 'dark' | 'light';
}

export default function TopTradersTab({ traders = [], tokenMint, theme = 'dark' }: TopTradersTabProps) {
  const isDark = theme === 'dark';

  // Generate sample data if none provided
  const displayTraders: Trader[] = traders.length > 0 ? traders : [
    { address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', totalVolume: 1250000, totalTrades: 342, winRate: 68.5, avgProfit: 1250, totalProfit: 427500 },
    { address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', totalVolume: 980000, totalTrades: 289, winRate: 72.3, avgProfit: 980, totalProfit: 283220 },
    { address: 'GjJyeC1rW1z6uY3Z2hYbJ7K8mN9pQrStUvWxYzAbCdEf', totalVolume: 875000, totalTrades: 256, winRate: 65.2, avgProfit: 875, totalProfit: 224000 },
  ];

  const formatValue = (value: number): string => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  return (
    <div className={cn(
      "rounded-xl border overflow-hidden",
      isDark ? "bg-[#1a1f2e] border-[#1f2937]" : "bg-white border-gray-200"
    )}>
      <div className="px-4 py-3 border-b" style={{ borderColor: isDark ? '#1f2937' : '#e5e7eb' }}>
        <h3 className={cn(
          "text-sm font-semibold",
          isDark ? "text-white" : "text-gray-900"
        )}>Top Traders</h3>
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {displayTraders.length === 0 ? (
          <div className={cn(
            "px-4 py-8 text-center text-sm",
            isDark ? "text-[#6b7280]" : "text-gray-500"
          )}>
            No trader data available
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0" style={{ backgroundColor: isDark ? '#1a1f2e' : '#ffffff' }}>
              <tr className={cn(
                "text-xs border-b",
                isDark ? "border-[#1f2937] text-[#6b7280]" : "border-gray-200 text-gray-500"
              )}>
                <th className="text-left px-4 py-2 font-medium">RANK</th>
                <th className="text-left px-2 py-2 font-medium">ADDRESS</th>
                <th className="text-right px-2 py-2 font-medium">VOLUME</th>
                <th className="text-right px-2 py-2 font-medium">TRADES</th>
                <th className="text-right px-2 py-2 font-medium">WIN RATE</th>
                <th className="text-right px-2 py-2 font-medium">AVG PROFIT</th>
                <th className="text-right px-4 py-2 font-medium">TOTAL PROFIT</th>
              </tr>
            </thead>
            <tbody>
              {displayTraders.map((trader, index) => (
                <tr
                  key={trader.address}
                  className={cn(
                    "text-xs border-b transition-colors",
                    isDark ? "border-[#1f2937]/50 hover:bg-[#252b3d]" : "border-gray-200/50 hover:bg-gray-50"
                  )}
                >
                  <td className="px-4 py-2 text-[#9ca3af]">#{index + 1}</td>
                  <td className="px-2 py-2">
                    <a
                      href={`https://solscan.io/account/${trader.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "text-[#0ea5e9] hover:underline flex items-center gap-1",
                        isDark ? "text-[#0ea5e9]" : "text-blue-600"
                      )}
                    >
                      {trader.address.substring(0, 6)}...{trader.address.substring(trader.address.length - 4)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                  <td className="px-2 py-2 text-right text-white">{formatValue(trader.totalVolume)}</td>
                  <td className="px-2 py-2 text-right text-white">{trader.totalTrades}</td>
                  <td className={cn(
                    "px-2 py-2 text-right font-medium",
                    trader.winRate >= 50 ? "text-[#10b981]" : "text-[#ef4444]"
                  )}>
                    {trader.winRate.toFixed(1)}%
                  </td>
                  <td className={cn(
                    "px-2 py-2 text-right",
                    trader.avgProfit >= 0 ? "text-[#10b981]" : "text-[#ef4444]"
                  )}>
                    {trader.avgProfit >= 0 ? '+' : ''}{formatValue(trader.avgProfit)}
                  </td>
                  <td className={cn(
                    "px-4 py-2 text-right font-semibold",
                    trader.totalProfit >= 0 ? "text-[#10b981]" : "text-[#ef4444]"
                  )}>
                    {trader.totalProfit >= 0 ? '+' : ''}{formatValue(trader.totalProfit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

