import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CryptoAssetRow from '@/components/crypto/ui/CryptoAssetRow';
import WalletManager from '@/components/crypto/WalletManager';
import { createClient } from '@/lib/supabase/client';
import { fetchAggregatedCryptoData, type AggregatedCryptoStats } from '@/lib/crypto-aggregation-service';
import { useTheme } from '@/components/ThemeProvider';
import { cn } from '@/lib/utils';
import {
  fetchUserTrackedWallets,
  fetchTokenPrices,
  generateSparklineData,
  type WalletBalance,
  type TokenPrice
} from '@/lib/wallet-balance-service';

interface WalletAsset {
  id: string;
  icon: string;
  name: string;
  symbol: string;
  amount: number;
  price: number;
  priceUsd: number;
  change24h: number;
  sparklineData: number[];
}

// Asset configurations
const assetConfigs: Record<string, { icon: string; color: string }> = {
  BTC: { icon: '/images/bitcoin-logo.png', color: '#f59e0b' },
  SOL: { icon: '/images/solana-logo.png', color: '#8b5cf6' },
  ETH: { icon: '/images/ethereum-logo.png', color: '#627eea' },
  ADA: { icon: '/images/cardano-logo.png', color: '#0033ad' },
  USDT: { icon: '/images/tether-logo.png', color: '#26a17b' },
  USDC: { icon: '/images/usdc-logo.png', color: '#2775ca' },
};

export default function CryptoWallets() {
  const navigate = useNavigate();
  const supabase = createClient();
  const { theme } = useTheme();
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const [isLoading, setIsLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<'24h' | '7d' | '30d'>('24h');
  const [totalBalance, setTotalBalance] = useState(0);
  const [totalChange, setTotalChange] = useState(0);
  const [assets, setAssets] = useState<WalletAsset[]>([]);
  const [showWalletManager, setShowWalletManager] = useState(false);

  useEffect(() => {
    loadWalletData();
  }, [timePeriod]);


  const loadWalletData = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Fetch tracked wallets with real balances (with timeout)
      const walletBalances = await Promise.race([
        fetchUserTrackedWallets(user.id),
        new Promise<Array<WalletBalance>>((resolve) => setTimeout(() => resolve([]), 10000)) // 10s timeout
      ]);

      if (walletBalances.length === 0) {
        setAssets([]);
        setTotalBalance(0);
        setTotalChange(0);
        setIsLoading(false);
        return;
      }

      // Aggregate balances by symbol across all wallets
      const aggregatedBalances: Record<string, { amount: number; usdValue: number }> = {};
      let totalUsdValue = 0;

      walletBalances.forEach(wallet => {
        Object.entries(wallet.balances).forEach(([symbol, balance]) => {
          if (!aggregatedBalances[symbol]) {
            aggregatedBalances[symbol] = { amount: 0, usdValue: 0 };
          }
          aggregatedBalances[symbol].amount += balance.amount;
          aggregatedBalances[symbol].usdValue += balance.usdValue;
        });
        totalUsdValue += wallet.totalUsdValue;
      });

      // Get unique symbols to fetch prices
      const symbols = Object.keys(aggregatedBalances);
      const coinIds = symbols.map(s => {
        const map: Record<string, string> = {
          'BTC': 'bitcoin',
          'SOL': 'solana',
          'ETH': 'ethereum',
          'ADA': 'cardano',
          'USDT': 'tether',
          'USDC': 'usd-coin',
        };
        return map[s] || s.toLowerCase();
      });

      // Fetch real prices from CoinGecko (fast, don't wait for images)
      const prices = await Promise.race<[Promise<Record<string, TokenPrice>>, Promise<Record<string, TokenPrice>>]>([
        fetchTokenPrices(coinIds),
        new Promise<Record<string, TokenPrice>>((resolve) => {
          setTimeout(() => resolve({}), 5000); // 5s timeout for prices
        })
      ]);

      // Generate asset list with real data (optimized - skip sparklines on initial load)
      const assetList = Object.entries(aggregatedBalances).map(([symbol, balance]) => {
        const priceData = prices[symbol];
        const currentPrice = priceData?.price || 0;
        const change24h = priceData?.change24h || 0;

        // Use image from CoinGecko if available, otherwise fallback to local config
        const config = assetConfigs[symbol] || { icon: '', color: '#6b7280' };
        let icon = priceData?.image || config.icon;

        // Simple sparkline: just use current price (no network calls on initial load)
        // Sparklines can be loaded later if needed
        const simpleSparkline = Array.from({ length: 24 }, () => currentPrice);

        return {
          id: symbol,
          icon: icon,
          name: priceData?.name || (symbol === 'BTC' ? 'Bitcoin' :
            symbol === 'SOL' ? 'Solana' :
              symbol === 'ETH' ? 'Ethereum' :
                symbol === 'ADA' ? 'Cardano' :
                  symbol === 'USDT' ? 'Tether' :
                    symbol === 'USDC' ? 'USD Coin' :
                      symbol),
          symbol,
          amount: balance.amount,
          price: currentPrice,
          priceUsd: balance.usdValue,
          change24h,
          sparklineData: simpleSparkline, // Simple fallback, no network calls
        };
      });

      // Sort by USD value (descending)
      assetList.sort((a, b) => b.priceUsd - a.priceUsd);

      // Calculate total change (weighted average)
      // Only include assets with valid values and non-zero total
      let totalChange = 0;
      if (assetList.length > 0 && totalUsdValue > 0) {
        const validAssets = assetList.filter(asset =>
          asset.priceUsd > 0 &&
          !isNaN(asset.change24h) &&
          isFinite(asset.change24h) &&
          asset.change24h !== null &&
          asset.change24h !== undefined
        );

        if (validAssets.length > 0) {
          totalChange = validAssets.reduce((sum, asset) => {
            const weight = asset.priceUsd / totalUsdValue;
            const change = asset.change24h || 0;
            return sum + (change * weight);
          }, 0);
        }
      }

      setAssets(assetList);
      setTotalBalance(totalUsdValue);
      setTotalChange(totalChange);

      setIsLoading(false); // Set loading to false immediately after setting assets

      // Load sparklines and images in background (non-blocking)
      // This happens after the UI is already rendered
      setTimeout(() => {
        assetList.forEach((asset) => {
          // Only fetch sparkline if we have a valid price
          if (asset.price > 0) {
            generateSparklineData(asset.symbol, '1h', 24)
              .then(sparkline => {
                if (sparkline.length > 0) {
                  setAssets(prev => prev.map(a =>
                    a.symbol === asset.symbol
                      ? { ...a, sparklineData: sparkline }
                      : a
                  ));
                }
              })
              .catch(() => {
                // Ignore sparkline errors
              });
          }
        });
      }, 100); // Small delay to ensure UI is rendered first

    } catch (error) {
      console.error('Error loading wallet data:', error);
      setAssets([]);
      setTotalBalance(0);
      setTotalChange(0);
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const handleSend = (assetId: string) => {
    console.log('Send', assetId);
    // TODO: Implement send modal
  };

  const handleReceive = (assetId: string) => {
    console.log('Receive', assetId);
    // TODO: Implement receive modal
  };

  const handleTrade = (assetId: string) => {
    navigate(`/crypto/coins?symbol=${assetId}`);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className={cn(
          "text-xl font-semibold mb-4",
          isDark ? "text-white" : "text-gray-900"
        )}>Wallets</div>
        <div className={cn(
          "rounded-xl border p-6 h-32 animate-pulse mb-6",
          isDark ? "bg-black border-white/10" : "bg-white border-gray-200"
        )}>
          <div className={cn(
            "h-4 w-24 rounded mb-2",
            isDark ? "bg-[#374151]" : "bg-gray-200"
          )}></div>
          <div className={cn(
            "h-8 w-48 rounded",
            isDark ? "bg-[#374151]" : "bg-gray-200"
          )}></div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={cn(
              "rounded-xl border p-4 h-20 animate-pulse",
              isDark ? "bg-black border-white/10" : "bg-white border-gray-200"
            )}></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Page Title */}
      <div className={cn(
        "text-2xl font-bold",
        isDark ? "text-white" : "text-gray-900"
      )}>Wallets</div>

      {/* Total Balance Header */}
      <div className={cn(
        "rounded-xl border p-6",
        isDark ? "bg-black border-white/10" : "bg-white border-gray-200"
      )}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className={cn(
              "text-sm mb-1",
              isDark ? "text-[#9ca3af]" : "text-gray-600"
            )}>Total Balance</div>
            <div className="flex items-baseline gap-3">
              <span className={cn(
                "text-4xl font-bold",
                isDark ? "text-white" : "text-gray-900"
              )}>
                ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={cn(
                "text-lg",
                isDark ? "text-[#6b7280]" : "text-gray-500"
              )}>USD</span>
              <div className={`flex items-center gap-1 px-2 py-1 rounded text-sm ${(totalChange >= 0 && !isNaN(totalChange))
                  ? 'bg-[#10b981]/20 text-[#10b981]'
                  : 'bg-[#ef4444]/20 text-[#ef4444]'
                }`}>
                {(totalChange >= 0 && !isNaN(totalChange)) ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <span>
                  {isNaN(totalChange) || !isFinite(totalChange)
                    ? '0.00'
                    : `${totalChange >= 0 ? '+' : ''}${totalChange.toFixed(2)}`
                  }%
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Select value={timePeriod} onValueChange={(v: any) => setTimePeriod(v)}>
              <SelectTrigger className={cn(
                "w-[140px]",
                isDark ? "bg-neutral-900 border-white/10 text-slate-300" : "bg-gray-50 border-gray-300 text-gray-700"
              )}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={cn(
                isDark ? "bg-neutral-900 border-white/10" : "bg-white border-gray-200"
              )}>
                <SelectItem value="24h">24h change</SelectItem>
                <SelectItem value="7d">7d change</SelectItem>
                <SelectItem value="30d">30d change</SelectItem>
              </SelectContent>
            </Select>

            <Button
              onClick={() => setShowWalletManager(true)}
              className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Wallet
            </Button>
          </div>
        </div>
      </div>

      {/* Asset List */}
      <div className={cn(
        "rounded-xl border overflow-hidden",
        isDark ? "bg-black border-white/10" : "bg-white border-gray-200"
      )}>
        {/* Table Header */}
        <div className={cn(
          "hidden md:grid md:grid-cols-4 gap-4 px-6 py-3 border-b text-sm",
          isDark ? "border-white/10 text-gray-500" : "border-gray-200 text-gray-600"
        )}>
          <span>Asset</span>
          <span>Price</span>
          <span className="text-center">24h change</span>
          <span className="text-right">Actions</span>
        </div>

        {/* Asset Rows */}
        <div className={cn(
          "divide-y",
          isDark ? "divide-white/10" : "divide-gray-200"
        )}>
          {isLoading ? (
            // Loading skeletons
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-full bg-neutral-900 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-neutral-900 rounded animate-pulse" />
                  <div className="h-3 w-20 bg-neutral-900 rounded animate-pulse" />
                </div>
              </div>
            ))
          ) : assets.length === 0 ? (
            <div className={cn(
              "flex flex-col items-center justify-center py-12",
              isDark ? "text-[#6b7280]" : "text-gray-500"
            )}>
              <div className="w-12 h-12 mb-4 opacity-50 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <p className={cn(
                "text-lg mb-2",
                isDark ? "text-white" : "text-gray-900"
              )}>No assets found</p>
              <p className="text-sm">Add a wallet to start tracking your assets</p>
              <Button
                onClick={() => setShowWalletManager(true)}
                className="mt-4 bg-[#3b82f6] hover:bg-[#2563eb]"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Wallet
              </Button>
            </div>
          ) : (
            assets.map((asset) => (
              <CryptoAssetRow
                key={asset.id}
                icon={asset.icon || (
                  <span className={cn(
                    "font-bold text-sm",
                    isDark ? "text-white" : "text-gray-900"
                  )}>
                    {asset.symbol.charAt(0)}
                  </span>
                )}
                name={asset.name}
                symbol={asset.symbol}
                amount={asset.amount}
                price={asset.price}
                priceUsd={asset.priceUsd}
                change24h={asset.change24h}
                sparklineData={asset.sparklineData}
                onSend={() => handleSend(asset.id)}
                onReceive={() => handleReceive(asset.id)}
                onTrade={() => handleTrade(asset.symbol)}
                className="border-0"
              />
            ))
          )}
        </div>
      </div>

      {/* Wallet Manager Modal */}
      <WalletManager
        isOpen={showWalletManager}
        onClose={() => setShowWalletManager(false)}
        onWalletsUpdated={loadWalletData}
      />
    </div>
  );
}

