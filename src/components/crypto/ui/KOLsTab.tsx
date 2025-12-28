import React from 'react';
import { cn } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';

interface KOL {
  name: string;
  address: string;
  followers: number;
  totalVolume: number;
  totalTrades: number;
  influence: number;
}

interface KOLsTabProps {
  kols?: KOL[];
  theme?: 'dark' | 'light';
}

export default function KOLsTab({ kols = [], theme = 'dark' }: KOLsTabProps) {
  const isDark = theme === 'dark';

  // Generate sample data if none provided
  const displayKOLs: KOL[] = kols.length > 0 ? kols : [
    { name: '@crypto_influencer', address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', followers: 125000, totalVolume: 2500000, totalTrades: 450, influence: 8.5 },
    { name: '@solana_trader', address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', followers: 98000, totalVolume: 1800000, totalTrades: 320, influence: 7.2 },
    { name: '@defi_expert', address: 'GjJyeC1rW1z6uY3Z2hYbJ7K8mN9pQrStUvWxYzAbCdEf', followers: 75000, totalVolume: 1500000, totalTrades: 280, influence: 6.8 },
  ];

  const formatValue = (value: number): string => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const formatFollowers = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toLocaleString();
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
        )}>Key Opinion Leaders (KOLs)</h3>
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {displayKOLs.length === 0 ? (
          <div className={cn(
            "px-4 py-8 text-center text-sm",
            isDark ? "text-[#6b7280]" : "text-gray-500"
          )}>
            No KOL data available
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0" style={{ backgroundColor: isDark ? '#1a1f2e' : '#ffffff' }}>
              <tr className={cn(
                "text-xs border-b",
                isDark ? "border-[#1f2937] text-[#6b7280]" : "border-gray-200 text-gray-500"
              )}>
                <th className="text-left px-4 py-2 font-medium">NAME</th>
                <th className="text-left px-2 py-2 font-medium">ADDRESS</th>
                <th className="text-right px-2 py-2 font-medium">FOLLOWERS</th>
                <th className="text-right px-2 py-2 font-medium">VOLUME</th>
                <th className="text-right px-2 py-2 font-medium">TRADES</th>
                <th className="text-right px-4 py-2 font-medium">INFLUENCE</th>
              </tr>
            </thead>
            <tbody>
              {displayKOLs.map((kol) => (
                <tr
                  key={kol.address}
                  className={cn(
                    "text-xs border-b transition-colors",
                    isDark ? "border-[#1f2937]/50 hover:bg-[#252b3d]" : "border-gray-200/50 hover:bg-gray-50"
                  )}
                >
                  <td className="px-4 py-2 text-white font-medium">{kol.name}</td>
                  <td className="px-2 py-2">
                    <a
                      href={`https://solscan.io/account/${kol.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "text-[#0ea5e9] hover:underline flex items-center gap-1",
                        isDark ? "text-[#0ea5e9]" : "text-blue-600"
                      )}
                    >
                      {kol.address.substring(0, 6)}...{kol.address.substring(kol.address.length - 4)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                  <td className="px-2 py-2 text-right text-white">{formatFollowers(kol.followers)}</td>
                  <td className="px-2 py-2 text-right text-white">{formatValue(kol.totalVolume)}</td>
                  <td className="px-2 py-2 text-right text-white">{kol.totalTrades}</td>
                  <td className="px-4 py-2 text-right text-white font-semibold">{kol.influence.toFixed(1)}/10</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

