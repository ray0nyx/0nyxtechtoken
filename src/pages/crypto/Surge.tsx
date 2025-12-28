import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/ThemeProvider';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Zap, TrendingUp, Settings, BarChart2 } from 'lucide-react';
import SurgeColumn from '@/components/crypto/ui/SurgeColumn';
import { type CoinCardData } from '@/components/crypto/ui/CoinCard';
import { fetchNewTokens, fetchSurgingTokens } from '@/lib/dex-screener-service';
import { fetchNewPumpFunCoins, type PumpFunCoin } from '@/lib/pump-fun-service';

type CurrencyMode = 'usd' | 'sol';

export default function SurgePage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { toast } = useToast();
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  // State
  const [earlyCoins, setEarlyCoins] = useState<CoinCardData[]>([]);
  const [surgingCoins, setSurgingCoins] = useState<CoinCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currencyMode, setCurrencyMode] = useState<CurrencyMode>(() => {
    const saved = localStorage.getItem('surge_currency_mode');
    return (saved as CurrencyMode) || 'usd';
  });
  const [minMarketCap, setMinMarketCap] = useState<string>('0');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Calculate age string from timestamp
  const calculateAge = useCallback((timestamp: number | undefined): string => {
    if (!timestamp) return 'N/A';
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffMonths = Math.floor(diffDays / 30);

    if (diffSeconds < 60) return `${diffSeconds}s`;
    if (diffMinutes < 60) return `${diffMinutes}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 30) return `${diffDays}d`;
    return `${diffMonths}mo`;
  }, []);

  // Transform Pump.fun coin to CoinCardData
  const transformPumpFunCoin = useCallback((coin: PumpFunCoin): CoinCardData => {
    // Calculate price from market cap and supply (if available)
    // For bonding curve tokens, price is calculated from reserves
    let price = 0;
    if (coin.virtual_sol_reserves && coin.virtual_token_reserves && coin.virtual_token_reserves > 0) {
      // Price = SOL reserves / Token reserves (in SOL)
      const priceInSol = coin.virtual_sol_reserves / coin.virtual_token_reserves;
      price = priceInSol * 200; // Approximate SOL price in USD
    } else if (coin.total_supply && coin.total_supply > 0) {
      price = (coin.usd_market_cap || coin.market_cap || 0) / coin.total_supply;
    }

    // Extract best available symbol - prefer symbol, fallback to name, then mint suffix
    let symbol = coin.symbol || '';
    if (!symbol && coin.name) {
      // Use first word of name as symbol
      symbol = coin.name.split(' ')[0].slice(0, 10);
    }
    if (!symbol && coin.mint) {
      // Use last 4-8 chars of mint as symbol
      symbol = coin.mint.slice(-8, -4).toUpperCase();
    }
    symbol = symbol || 'NEW';

    // Extract best available name
    let name = coin.name || coin.symbol || '';
    if (name.length > 50) {
      name = name.slice(0, 50) + '...';
    }

    // Ensure we have valid timestamps
    const createdTimestamp = coin.created_timestamp
      ? (coin.created_timestamp > 1000000000000
        ? coin.created_timestamp
        : coin.created_timestamp * 1000) // Convert seconds to milliseconds if needed
      : Date.now();

    return {
      symbol: symbol,
      name: name,
      address: coin.mint || '',
      pairAddress: coin.associated_bonding_curve || coin.bonding_curve || '',
      logoUrl: coin.image_uri || '',
      price: price,
      priceUsd: price,
      marketCap: coin.usd_market_cap || coin.market_cap || 0,
      change24h: 0, // Pump.fun doesn't provide 24h change
      volume24h: 0,
      liquidity: 0,
      holders: 0,
      txns: 0,
      age: calculateAge(createdTimestamp),
      ath: 0,
      athMultiple: 0,
      dexId: coin.complete && coin.raydium_pool ? 'raydium' : 'pump.fun',
      socialLinks: {
        website: coin.website,
        twitter: coin.twitter,
        telegram: coin.telegram,
      },
      isPaid: false,
      // Additional Pump.fun specific data
      isGraduated: coin.complete && !!coin.raydium_pool,
      raydiumPool: coin.raydium_pool,
    };
  }, [calculateAge]);

  // Transform search results to CoinCardData
  const transformToCoinCard = useCallback((token: any): CoinCardData => {
    // Handle both DexSearchResult format and raw Pump.fun format
    const logoUrl = token.baseToken?.logoURI ||
      token.info?.imageUrl ||
      token.logoURI ||
      token.image_uri; // Pump.fun uses image_uri

    return {
      symbol: token.symbol || 'UNKNOWN/USD',
      name: token.baseToken?.name || token.name || '',
      address: token.baseToken?.address || token.address || token.mint || '',
      pairAddress: token.pairAddress || token.bonding_curve || '',
      logoUrl,
      price: token.price || 0,
      priceUsd: token.priceUsd || token.price || token.usd_market_cap || 0,
      marketCap: token.marketCap || token.fdv || token.usd_market_cap || token.market_cap || 0,
      change24h: token.change24h || 0,
      volume24h: token.volume24h || 0,
      liquidity: token.liquidity || 0,
      holders: token.holders,
      txns: token.txns,
      age: calculateAge(token.pairCreatedAt || token.created_timestamp),
      ath: token.ath,
      athMultiple: token.athMultiple,
      dexId: token.dexId || 'pump.fun',
      socialLinks: {
        website: token.baseToken?.website || token.website,
        twitter: token.baseToken?.twitter || token.twitter,
        telegram: token.baseToken?.telegram || token.telegram,
      },
      isPaid: token.isPaid,
    };
  }, []);

  // Fetch migrating tokens from backend
  const fetchMigratingTokens = async (limit: number = 20): Promise<any[]> => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001';
      const response = await fetch(`${apiUrl}/api/tokens/migrating?limit=${limit}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`Backend returned status ${response.status} for migrating tokens`);
        return [];
      }

      const data = await response.json();
      return data.tokens || [];
    } catch (error) {
      console.warn('Failed to fetch migrating tokens (backend may not be running):', error);
      // Return empty array instead of throwing - allows page to still render
      return [];
    }
  };

  // Check if backend is available
  const checkBackendHealth = async (): Promise<boolean> => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001';
      const response = await fetch(`${apiUrl}/api/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000), // 3 second timeout
      });
      return response.ok;
    } catch (error) {
      console.warn('Backend health check failed:', error);
      return false;
    }
  };

  // Fetch data
  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setRefreshing(true);

    try {
      // Check backend health first
      const backendAvailable = await checkBackendHealth();
      if (!backendAvailable) {
        console.warn('Backend is not available, skipping fetch');
        toast({
          title: 'Backend Unavailable',
          description: 'Please ensure the backend server is running on port 8001',
          variant: 'destructive',
        });
        setEarlyCoins([]);
        setSurgingCoins([]);
        return;
      }

      // Fetch newly released Pump.fun tokens for "Early" section
      const pumpFunCoins = await fetchNewPumpFunCoins(50);

      console.log(`Fetched ${pumpFunCoins.length} Pump.fun coins`);

      // Debug: Log sample coins to see what we're getting
      if (pumpFunCoins.length > 0) {
        const sample = pumpFunCoins.slice(0, 3);
        console.log('Sample coins:', sample.map(c => ({
          symbol: c.symbol,
          complete: c.complete,
          raydium_pool: c.raydium_pool,
          market_cap: c.usd_market_cap || c.market_cap,
          mint: c.mint
        })));
      }

      // Filter: Only show tokens that are NOT graduated (still on bonding curve)
      // Sort by creation time (newest first)
      const newPumpFunTokens = pumpFunCoins
        .filter(coin => {
          // Filter out graduated tokens
          const isNotGraduated = !coin.complete && !coin.raydium_pool;
          // Also filter by market cap if set
          const minMc = parseInt(minMarketCap) || 0;
          const hasMinMc = (coin.usd_market_cap || coin.market_cap || 0) >= minMc;

          // Debug logging for filtered out coins
          if (!isNotGraduated) {
            console.log(`Filtered out graduated token: ${coin.symbol} (complete: ${coin.complete}, raydium: ${coin.raydium_pool})`);
          }
          if (!hasMinMc && isNotGraduated) {
            console.log(`Filtered out low market cap token: ${coin.symbol} (MC: ${coin.usd_market_cap || coin.market_cap}, min: ${minMc})`);
          }

          return isNotGraduated && hasMinMc;
        })
        .sort((a, b) => (b.created_timestamp || 0) - (a.created_timestamp || 0)) // Newest first
        .slice(0, 20); // Take top 20 newest

      console.log(`Filtered to ${newPumpFunTokens.length} new Pump.fun tokens (from ${pumpFunCoins.length} total)`);

      // Fetch migrating tokens (graduating to Raydium) for "Surging" section
      const migratingTokensData = await fetchMigratingTokens(20);
      console.log(`Fetched ${migratingTokensData.length} migrating tokens`);

      // Also fetch surging tokens from DexScreener as fallback
      const surgingTokensData = await fetchSurgingTokens(10);
      console.log(`Fetched ${surgingTokensData.length} surging tokens from DexScreener`);

      // Filter by minimum market cap
      const minMc = parseInt(minMarketCap) || 0;

      // Transform Pump.fun coins for Early section
      const filteredEarly = newPumpFunTokens.map(transformPumpFunCoin);

      // Transform migrating tokens
      const transformedMigrating = migratingTokensData.map((token: any) => {
        // Transform migrating token to CoinCardData format
        const graduationTime = token.graduation_timestamp || 0;
        return {
          symbol: token.token_symbol || 'UNKNOWN',
          name: token.token_name || token.token_symbol || '',
          address: token.token_address || '',
          pairAddress: token.raydium_pool_address || '',
          logoUrl: token.logo_url || '',
          price: 0, // Would need to calculate from market cap
          priceUsd: 0,
          marketCap: token.market_cap_usd || 0,
          change24h: 0,
          volume24h: 0,
          liquidity: token.liquidity_usd || 0,
          holders: 0,
          txns: 0,
          age: graduationTime > 0 ? calculateAge(graduationTime) : 'N/A',
          ath: 0,
          athMultiple: 0,
          dexId: token.graduation_status === 'graduated' ? 'raydium' : 'pump.fun',
          socialLinks: {},
          isPaid: false,
          isGraduated: token.graduation_status === 'graduated',
          raydiumPool: token.raydium_pool_address,
        };
      }).filter(t => t.marketCap >= minMc)
        .sort((a, b) => {
          // Sort by graduation status (graduated first), then by market cap
          if (a.isGraduated !== b.isGraduated) {
            return a.isGraduated ? -1 : 1;
          }
          return b.marketCap - a.marketCap;
        });

      // Transform surging tokens
      const transformedSurging = surgingTokensData
        .filter((t: any) => {
          const mc = t.marketCap || t.fdv || (t as any).usd_market_cap || (t as any).market_cap || 0;
          return mc >= minMc;
        })
        .map(transformToCoinCard);

      // Combine migrating tokens with surging tokens
      const allSurging = [...transformedMigrating, ...transformedSurging]
        .slice(0, 20); // Limit to 20

      console.log(`Setting ${filteredEarly.length} early coins and ${allSurging.length} surging coins`);

      setEarlyCoins(filteredEarly);
      setSurgingCoins(allSurging);
    } catch (error) {
      console.error('Error fetching surge data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch token data. Please check if the backend is running.',
        variant: 'destructive',
      });
      // Set empty arrays on error to show "no tokens" message
      setEarlyCoins([]);
      setSurgingCoins([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [minMarketCap, transformToCoinCard, transformPumpFunCoin, calculateAge, toast]);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchData(false);
    }, 10000);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  // Save currency preference
  useEffect(() => {
    localStorage.setItem('surge_currency_mode', currencyMode);
  }, [currencyMode]);

  // Handle coin click - navigate to Coins
  const handleCoinClick = (coin: CoinCardData) => {
    const symbol = coin.symbol.includes('/') ? coin.symbol : `${coin.symbol}/USD`;
    navigate(`/crypto/coins?pair=${encodeURIComponent(symbol)}&address=${coin.address}`);
  };

  // Handle buy click
  const handleBuyClick = (coin: CoinCardData) => {
    const symbol = coin.symbol.includes('/') ? coin.symbol : `${coin.symbol}/USD`;
    navigate(`/crypto/coins?pair=${encodeURIComponent(symbol)}&address=${coin.address}&action=buy`);
  };

  return (
    <div className={cn(
      "h-full flex flex-col",
      isDark ? "bg-[#060a10]" : "bg-gray-100"
    )}>
      {/* Top Navigation Bar - axiom.trade style */}
      <div className={cn(
        "flex items-center justify-between px-4 py-2 border-b flex-shrink-0",
        isDark ? "bg-[#0a0e14] border-[#1e2530]" : "bg-gray-50 border-gray-200"
      )}>
        {/* Left: Navigation Tabs */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate('/crypto/coins')}
            className={cn(
              "px-4 py-2 rounded text-sm font-medium transition-colors",
              isDark
                ? "text-gray-400 hover:text-white hover:bg-[#1e2530]"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            )}
          >
            Trending
          </button>
          <button
            className={cn(
              "px-4 py-2 rounded text-sm font-medium transition-colors",
              "text-white bg-transparent border-b-2 border-cyan-500"
            )}
          >
            Surge
          </button>
          <button
            className={cn(
              "px-4 py-2 rounded text-sm font-medium transition-colors",
              isDark
                ? "text-gray-400 hover:text-white hover:bg-[#1e2530]"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            )}
          >
            DEX Screener
          </button>
          <button
            className={cn(
              "px-4 py-2 rounded text-sm font-medium transition-colors",
              isDark
                ? "text-gray-400 hover:text-white hover:bg-[#1e2530]"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            )}
          >
            Pump Live ▾
          </button>
        </div>

        {/* Center: Market Cap Slider */}
        <div className="flex items-center gap-4">
          {/* MC Slider with input */}
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full border",
            isDark ? "bg-[#0d1117] border-[#1e2530]" : "bg-white border-gray-200"
          )}>
            <button className="text-gray-500 hover:text-white text-sm">−</button>
            <input
              type="range"
              min="0"
              max="1000000"
              step="1000"
              value={parseInt(minMarketCap)}
              onChange={(e) => setMinMarketCap(e.target.value)}
              className="w-24 h-1 accent-cyan-500 cursor-pointer"
            />
            <span className={cn(
              "text-sm font-medium min-w-[50px] text-center",
              isDark ? "text-white" : "text-gray-900"
            )}>
              {parseInt(minMarketCap) >= 1000000
                ? `${(parseInt(minMarketCap) / 1000000).toFixed(0)}M`
                : parseInt(minMarketCap) >= 1000
                  ? `${(parseInt(minMarketCap) / 1000).toFixed(0)}K`
                  : '0'
              }
            </span>
            <button className="text-gray-500 hover:text-white text-sm">+</button>
          </div>

          {/* Filter controls */}
          <div className="flex items-center gap-2">
            <button className="p-2 text-gray-500 hover:text-white">
              <span className="text-lg">⊕</span>
            </button>
            <button className="p-2 text-gray-500 hover:text-white">
              <span className="text-lg">⏱</span>
            </button>
            <button className="p-2 text-gray-500 hover:text-white">
              <span className="text-lg">👁</span>
            </button>
          </div>
        </div>

        {/* Right: Quick Buy and Settings */}
        <div className="flex items-center gap-3">
          {/* Preset amounts */}
          <div className="flex items-center gap-1">
            <button className={cn(
              "px-2 py-1 rounded text-xs",
              isDark ? "bg-[#1e2530] text-gray-400" : "bg-gray-200 text-gray-600"
            )}>
              📦 1
            </button>
            <button className={cn(
              "px-2 py-1 rounded text-xs",
              isDark ? "bg-[#1e2530] text-gray-400" : "bg-gray-200 text-gray-600"
            )}>
              ≡ 0
            </button>
          </div>

          {/* Quick Buy */}
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded border",
            isDark ? "bg-[#0d1117] border-[#1e2530]" : "bg-white border-gray-200"
          )}>
            <span className="text-sm text-gray-400">Quick Buy</span>
            <span className="text-sm text-cyan-400 font-medium">0.0</span>
          </div>

          {/* P1 P2 P3 buttons */}
          <div className="flex items-center gap-1">
            <button className="px-2 py-1 rounded text-xs bg-cyan-500/20 text-cyan-400 font-medium">
              P1
            </button>
            <button className="px-2 py-1 rounded text-xs text-gray-500 hover:text-white">
              P2
            </button>
            <button className="px-2 py-1 rounded text-xs text-gray-500 hover:text-white">
              P3
            </button>
          </div>

          {/* Refresh */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3"
            onClick={() => fetchData(false)}
            disabled={refreshing}
          >
            <RefreshCw className={cn(
              "w-4 h-4",
              refreshing && "animate-spin"
            )} />
          </Button>
        </div>
      </div>

      {/* Main Content - Dual Column Layout */}
      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Early Column - Newly Released Pump.fun Tokens */}
        <SurgeColumn
          title="Early"
          coins={earlyCoins}
          loading={loading}
          onCoinClick={handleCoinClick}
          onBuyClick={handleBuyClick}
          onRefresh={() => fetchData(false)}
          theme={isDark ? 'dark' : 'light'}
          showUsd={currencyMode === 'usd'}
          className="flex-1 min-w-0"
        />

        {/* Surging Column - Migrating to Raydium */}
        <SurgeColumn
          title="Surging"
          coins={surgingCoins}
          loading={loading}
          onCoinClick={handleCoinClick}
          onBuyClick={handleBuyClick}
          onRefresh={() => fetchData(false)}
          theme={isDark ? 'dark' : 'light'}
          showUsd={currencyMode === 'usd'}
          className="flex-1 min-w-0"
        />
      </div>
    </div>
  );
}
