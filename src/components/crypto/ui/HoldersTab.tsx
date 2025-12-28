import React from 'react';
import { cn } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';

interface Holder {
  address: string;
  balance: number;
  percentage: number;
  value: number;
}

interface HoldersTabProps {
  holders?: Holder[];
  tokenMint?: string;
  theme?: 'dark' | 'light';
}

export default function HoldersTab({ holders = [], tokenMint, theme = 'dark' }: HoldersTabProps) {
  const isDark = theme === 'dark';

  // Generate sample data if none provided
  const displayHolders: Holder[] = holders.length > 0 ? holders : [
    { address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', balance: 5000000, percentage: 12.5, value: 125000 },
    { address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', balance: 3500000, percentage: 8.75, value: 87500 },
    { address: 'GjJyeC1rW1z6uY3Z2hYbJ7K8mN9pQrStUvWxYzAbCdEf', balance: 2800000, percentage: 7.0, value: 70000 },
  ];

  const formatBalance = (balance: number): string => {
    if (balance >= 1000000) return `${(balance / 1000000).toFixed(2)}M`;
    if (balance >= 1000) return `${(balance / 1000).toFixed(2)}K`;
    return balance.toLocaleString('en-US');
  };

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
        )}>Token Holders</h3>
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {displayHolders.length === 0 ? (
          <div className={cn(
            "px-4 py-8 text-center text-sm",
            isDark ? "text-[#6b7280]" : "text-gray-500"
          )}>
            No holder data available
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
                <th className="text-right px-2 py-2 font-medium">BALANCE</th>
                <th className="text-right px-2 py-2 font-medium">PERCENTAGE</th>
                <th className="text-right px-4 py-2 font-medium">VALUE</th>
              </tr>
            </thead>
            <tbody>
              {displayHolders.map((holder, index) => (
                <tr
                  key={holder.address}
                  className={cn(
                    "text-xs border-b transition-colors",
                    isDark ? "border-[#1f2937]/50 hover:bg-[#252b3d]" : "border-gray-200/50 hover:bg-gray-50"
                  )}
                >
                  <td className="px-4 py-2 text-[#9ca3af]">#{index + 1}</td>
                  <td className="px-2 py-2">
                    <a
                      href={`https://solscan.io/account/${holder.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "text-[#0ea5e9] hover:underline flex items-center gap-1",
                        isDark ? "text-[#0ea5e9]" : "text-blue-600"
                      )}
                    >
                      {holder.address.substring(0, 6)}...{holder.address.substring(holder.address.length - 4)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                  <td className="px-2 py-2 text-right text-white">{formatBalance(holder.balance)}</td>
                  <td className="px-2 py-2 text-right text-white">{holder.percentage.toFixed(2)}%</td>
                  <td className="px-4 py-2 text-right text-white font-semibold">{formatValue(holder.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

