/**
 * Axiom Pulse Dashboard - 3 Column Layout
 * 
 * Displays three categories side-by-side: New Pairs, Final Stretch, Migrated
 * Matches axiom.trade's Pulse design
 */

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/ThemeProvider';
import { RefreshCw, ChevronUp, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchNewPumpFunCoins, type PumpFunCoin } from '@/lib/pump-fun-service';

interface PulseToken {
  mint: string;
  symbol: string;
  name: string;
  image_uri?: string;
  market_cap: number;
  price: number;
  age: string;
  progress?: number;
  isGraduated?: boolean;
  raydiumPool?: string;
  socialLinks?: {
    twitter?: string;
    website?: string;
    telegram?: string;
  };
}

// Compact token card for Pulse view
function PulseCard({
  token,
  onClick,
  theme = 'dark'
}: {
  token: PulseToken;
  onClick?: () => void;
  theme?: 'dark' | 'light';
}) {
  const isDark = theme === 'dark';

  const formatNumber = (num: number) => {
    if (!num) return '$0';
    if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
    return `$${num.toFixed(0)}`;
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 p-2 rounded border cursor-pointer transition-all",
        isDark
          ? "bg-[#0d1117] border-[#1e2530] hover:border-[#3b4654]"
          : "bg-white border-gray-200 hover:border-gray-400"
      )}
    >
      {/* Token image */}
      <div className="flex-shrink-0">
        {token.image_uri ? (
          <img
            src={token.image_uri}
            alt={token.symbol}
            className="w-8 h-8 rounded object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        ) : (
          <div className={cn(
            "w-8 h-8 rounded flex items-center justify-center text-xs font-bold",
            "bg-gradient-to-br from-purple-600 to-cyan-500 text-white"
          )}>
            {token.symbol.charAt(0)}
          </div>
        )}
      </div>

      {/* Token info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="font-bold text-xs text-white truncate">{token.symbol}</span>
          <span className="text-[10px] text-gray-500 truncate max-w-[60px]">{token.name}</span>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-cyan-400">{token.age}</span>
          <span className="text-gray-500">🔍</span>
          <span className="text-gray-500">📊</span>
        </div>
      </div>

      {/* Price/MC */}
      <div className="text-right flex-shrink-0">
        <div className="text-xs text-gray-400">MC {formatNumber(token.market_cap)}</div>
        <div className="text-xs text-white font-medium">{formatNumber(token.price)}</div>
      </div>

      {/* Progress bar (for Final Stretch) */}
      {token.progress !== undefined && (
        <div className="w-12 flex-shrink-0">
          <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-yellow-500 to-green-500"
              style={{ width: `${Math.min(token.progress, 100)}%` }}
            />
          </div>
          <div className="text-[9px] text-gray-500 text-center">{token.progress?.toFixed(0)}%</div>
        </div>
      )}

      {/* Buy button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
        }}
        className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-400 hover:bg-green-500/30"
      >
        + SOL
      </button>
    </div>
  );
}

// Column component for each category
function PulseColumn({
  title,
  tokens,
  loading,
  onRefresh,
  theme = 'dark',
  className
}: {
  title: string;
  tokens: PulseToken[];
  loading?: boolean;
  onRefresh?: () => void;
  theme?: 'dark' | 'light';
  className?: string;
}) {
  const isDark = theme === 'dark';

  return (
    <div className={cn(
      "flex flex-col h-full rounded-lg border",
      isDark ? "bg-[#0a0e14] border-[#1e2530]" : "bg-gray-50 border-gray-200",
      className
    )}>
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between px-3 py-2 border-b",
        isDark ? "border-[#1e2530]" : "border-gray-200"
      )}>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">{tokens.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <button className="px-2 py-0.5 text-[10px] bg-cyan-500/20 text-cyan-400 rounded">P1</button>
          <button className="px-2 py-0.5 text-[10px] text-gray-500">P2</button>
          <button className="px-2 py-0.5 text-[10px] text-gray-500">P3</button>
        </div>
      </div>

      {/* Scroll to top */}
      <button className={cn(
        "flex items-center justify-center py-1 border-b",
        isDark ? "border-[#1e2530] text-gray-500 hover:text-white" : "border-gray-200"
      )}>
        <ChevronUp className="w-3 h-3" />
      </button>

      {/* Token list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading && tokens.length === 0 ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={cn(
              "h-14 rounded animate-pulse",
              isDark ? "bg-gray-800" : "bg-gray-200"
            )} />
          ))
        ) : tokens.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
            No tokens
          </div>
        ) : (
          tokens.map((token) => (
            <PulseCard key={token.mint} token={token} theme={theme} />
          ))
        )}
      </div>
    </div>
  );
}

export default function AxiomPulse() {
  const { theme } = useTheme();
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const [newPairs, setNewPairs] = useState<PulseToken[]>([]);
  const [finalStretch, setFinalStretch] = useState<PulseToken[]>([]);
  const [migrated, setMigrated] = useState<PulseToken[]>([]);
  const [loading, setLoading] = useState(true);

  // Calculate age from timestamp
  const calculateAge = useCallback((timestamp: number | undefined): string => {
    if (!timestamp) return 'N/A';
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) return `${diffSeconds}s`;
    if (diffMinutes < 60) return `${diffMinutes}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return `${diffDays}d`;
  }, []);

  // Transform PumpFun coin to PulseToken
  const transformToPulseToken = useCallback((coin: PumpFunCoin): PulseToken => {
    const createdTimestamp = coin.created_timestamp
      ? (coin.created_timestamp > 1000000000000
        ? coin.created_timestamp
        : coin.created_timestamp * 1000)
      : Date.now();

    // Calculate progress based on virtual_sol_reserves
    // Graduation happens at ~80 SOL
    const progress = coin.virtual_sol_reserves
      ? Math.min(100, (coin.virtual_sol_reserves / 80) * 100)
      : 0;

    return {
      mint: coin.mint || '',
      symbol: coin.symbol || coin.name?.split(' ')[0] || 'NEW',
      name: coin.name || '',
      image_uri: coin.image_uri,
      market_cap: coin.usd_market_cap || coin.market_cap || 0,
      price: coin.usd_market_cap ? coin.usd_market_cap / 1000000000 : 0,
      age: calculateAge(createdTimestamp),
      progress: progress,
      isGraduated: coin.complete && !!coin.raydium_pool,
      raydiumPool: coin.raydium_pool,
      socialLinks: {
        twitter: coin.twitter,
        website: coin.website,
        telegram: coin.telegram,
      },
    };
  }, [calculateAge]);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const coins = await fetchNewPumpFunCoins(100);

      const allTokens = coins.map(transformToPulseToken);

      // Categorize tokens
      const newTokens: PulseToken[] = [];
      const stretchTokens: PulseToken[] = [];
      const migratedTokens: PulseToken[] = [];

      allTokens.forEach(token => {
        if (token.isGraduated) {
          migratedTokens.push(token);
        } else if (token.progress && token.progress >= 70) {
          stretchTokens.push(token);
        } else {
          newTokens.push(token);
        }
      });

      setNewPairs(newTokens.slice(0, 30));
      setFinalStretch(stretchTokens.slice(0, 30));
      setMigrated(migratedTokens.slice(0, 30));
    } catch (error) {
      console.error('Error fetching pulse data:', error);
    } finally {
      setLoading(false);
    }
  }, [transformToPulseToken]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className={cn(
      "h-full flex flex-col",
      isDark ? "bg-[#060a10]" : "bg-gray-100"
    )}>
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between px-4 py-2 border-b flex-shrink-0",
        isDark ? "bg-[#0a0e14] border-[#1e2530]" : "bg-gray-50 border-gray-200"
      )}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-400" />
            <h1 className="text-lg font-bold text-white">Pulse</h1>
          </div>
          <div className="flex items-center gap-1">
            <button className="px-2 py-1 rounded text-xs bg-gray-700 text-gray-400">≡</button>
            <button className="px-2 py-1 rounded text-xs bg-gray-700 text-gray-400">⚡</button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Display</span>
          <select className={cn(
            "px-2 py-1 rounded text-xs border",
            isDark ? "bg-[#0d1117] border-[#1e2530] text-white" : "bg-white border-gray-200"
          )}>
            <option>Standard</option>
            <option>Compact</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={fetchData}
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Three Column Layout */}
      <div className="flex-1 flex gap-2 p-2 overflow-hidden">
        <PulseColumn
          title="New Pairs"
          tokens={newPairs}
          loading={loading}
          theme={isDark ? 'dark' : 'light'}
          className="flex-1"
        />
        <PulseColumn
          title="Final Stretch"
          tokens={finalStretch}
          loading={loading}
          theme={isDark ? 'dark' : 'light'}
          className="flex-1"
        />
        <PulseColumn
          title="Migrated"
          tokens={migrated}
          loading={loading}
          theme={isDark ? 'dark' : 'light'}
          className="flex-1"
        />
      </div>
    </div>
  );
}
