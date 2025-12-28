import React from 'react';
import { cn } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';

interface Sniper {
  address: string;
  snipes: number;
  successRate: number;
  avgTimeToSell: number;
  totalProfit: number;
  firstBuyTime: string;
}

interface SnipersTabProps {
  snipers?: Sniper[];
  theme?: 'dark' | 'light';
}

export default function SnipersTab({ snipers = [], theme = 'dark' }: SnipersTabProps) {
  const isDark = theme === 'dark';

  // Generate sample data if none provided
  const displaySnipers: Sniper[] = snipers.length > 0 ? snipers : [
    { address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', snipes: 45, successRate: 82.5, avgTimeToSell: 2.5, totalProfit: 125000, firstBuyTime: '2m ago' },
    { address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', snipes: 38, successRate: 78.9, avgTimeToSell: 3.2, totalProfit: 98000, firstBuyTime: '5m ago' },
    { address: 'GjJyeC1rW1z6uY3Z2hYbJ7K8mN9pQrStUvWxYzAbCdEf', snipes: 32, successRate: 75.0, avgTimeToSell: 4.1, totalProfit: 75000, firstBuyTime: '8m ago' },
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
        )}>Snipers</h3>
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {displaySnipers.length === 0 ? (
          <div className={cn(
            "px-4 py-8 text-center text-sm",
            isDark ? "text-[#6b7280]" : "text-gray-500"
          )}>
            No sniper data available
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0" style={{ backgroundColor: isDark ? '#1a1f2e' : '#ffffff' }}>
              <tr className={cn(
                "text-xs border-b",
                isDark ? "border-[#1f2937] text-[#6b7280]" : "border-gray-200 text-gray-500"
              )}>
                <th className="text-left px-4 py-2 font-medium">ADDRESS</th>
                <th className="text-right px-2 py-2 font-medium">SNIPES</th>
                <th className="text-right px-2 py-2 font-medium">SUCCESS RATE</th>
                <th className="text-right px-2 py-2 font-medium">AVG TIME</th>
                <th className="text-right px-2 py-2 font-medium">TOTAL PROFIT</th>
                <th className="text-left px-4 py-2 font-medium">FIRST BUY</th>
              </tr>
            </thead>
            <tbody>
              {displaySnipers.map((sniper) => (
                <tr
                  key={sniper.address}
                  className={cn(
                    "text-xs border-b transition-colors",
                    isDark ? "border-[#1f2937]/50 hover:bg-[#252b3d]" : "border-gray-200/50 hover:bg-gray-50"
                  )}
                >
                  <td className="px-4 py-2">
                    <a
                      href={`https://solscan.io/account/${sniper.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "text-[#0ea5e9] hover:underline flex items-center gap-1",
                        isDark ? "text-[#0ea5e9]" : "text-blue-600"
                      )}
                    >
                      {sniper.address.substring(0, 6)}...{sniper.address.substring(sniper.address.length - 4)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                  <td className="px-2 py-2 text-right text-white">{sniper.snipes}</td>
                  <td className={cn(
                    "px-2 py-2 text-right font-medium",
                    sniper.successRate >= 70 ? "text-[#10b981]" : "text-[#ef4444]"
                  )}>
                    {sniper.successRate.toFixed(1)}%
                  </td>
                  <td className="px-2 py-2 text-right text-white">{sniper.avgTimeToSell.toFixed(1)}h</td>
                  <td className={cn(
                    "px-2 py-2 text-right font-semibold",
                    sniper.totalProfit >= 0 ? "text-[#10b981]" : "text-[#ef4444]"
                  )}>
                    {sniper.totalProfit >= 0 ? '+' : ''}{formatValue(sniper.totalProfit)}
                  </td>
                  <td className="px-4 py-2 text-left text-[#9ca3af]">{sniper.firstBuyTime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

