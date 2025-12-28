import React from 'react';
import { cn } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';

interface LiquidityProvider {
  address: string;
  liquidity: number;
  percentage: number;
  feesEarned: number;
  joinedDate: string;
}

interface LiquidityProvidersTabProps {
  providers?: LiquidityProvider[];
  theme?: 'dark' | 'light';
}

export default function LiquidityProvidersTab({ providers = [], theme = 'dark' }: LiquidityProvidersTabProps) {
  const isDark = theme === 'dark';

  // Generate sample data if none provided
  const displayProviders: LiquidityProvider[] = providers.length > 0 ? providers : [
    { address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', liquidity: 500000, percentage: 45.5, feesEarned: 12500, joinedDate: '2d ago' },
    { address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', liquidity: 350000, percentage: 31.8, feesEarned: 8750, joinedDate: '5d ago' },
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
        )}>Liquidity Providers</h3>
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {displayProviders.length === 0 ? (
          <div className={cn(
            "px-4 py-8 text-center text-sm",
            isDark ? "text-[#6b7280]" : "text-gray-500"
          )}>
            No liquidity provider data available
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0" style={{ backgroundColor: isDark ? '#1a1f2e' : '#ffffff' }}>
              <tr className={cn(
                "text-xs border-b",
                isDark ? "border-[#1f2937] text-[#6b7280]" : "border-gray-200 text-gray-500"
              )}>
                <th className="text-left px-4 py-2 font-medium">ADDRESS</th>
                <th className="text-right px-2 py-2 font-medium">LIQUIDITY</th>
                <th className="text-right px-2 py-2 font-medium">PERCENTAGE</th>
                <th className="text-right px-2 py-2 font-medium">FEES EARNED</th>
                <th className="text-left px-4 py-2 font-medium">JOINED</th>
              </tr>
            </thead>
            <tbody>
              {displayProviders.map((provider) => (
                <tr
                  key={provider.address}
                  className={cn(
                    "text-xs border-b transition-colors",
                    isDark ? "border-[#1f2937]/50 hover:bg-[#252b3d]" : "border-gray-200/50 hover:bg-gray-50"
                  )}
                >
                  <td className="px-4 py-2">
                    <a
                      href={`https://solscan.io/account/${provider.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "text-[#0ea5e9] hover:underline flex items-center gap-1",
                        isDark ? "text-[#0ea5e9]" : "text-blue-600"
                      )}
                    >
                      {provider.address.substring(0, 6)}...{provider.address.substring(provider.address.length - 4)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                  <td className="px-2 py-2 text-right text-white font-semibold">{formatValue(provider.liquidity)}</td>
                  <td className="px-2 py-2 text-right text-white">{provider.percentage.toFixed(1)}%</td>
                  <td className="px-2 py-2 text-right text-[#10b981] font-semibold">{formatValue(provider.feesEarned)}</td>
                  <td className="px-4 py-2 text-left text-[#9ca3af]">{provider.joinedDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

