import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Users,
  TrendingUp,
  TrendingDown,
  Search,
  Search as Filter,
  CheckCircle,
  Shield,
  Target,
  Search as Eye,
  Copy,
  Search as ArrowUpDown,
  ExternalLink,
  Settings,
  Plus,
  Trash2,
  Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import MetricCard from '@/components/crypto/ui/MetricCard';
import MiniSparkline from '@/components/crypto/MiniSparkline';
import CopyTraderSetup from '@/components/crypto/CopyTraderSetup';
import LiveTradesModal from '@/components/crypto/LiveTradesModal';
import { TraderRow } from '@/components/crypto/TraderRow';
import { createClient } from '@/lib/supabase/client';
import { fetchSolanaWalletBalance } from '@/lib/wallet-balance-service';
import { fetchWalletPnL } from '@/lib/solana-tracker-service';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/crypto-aggregation-service';
import { useTheme } from '@/components/ThemeProvider';
import { cn } from '@/lib/utils';

interface LeaderboardTrader {
  id: string;
  wallet_address: string;
  total_pnl: number;
  roi: number;
  win_rate: number;
  total_trades: number;
  max_drawdown: number;
  netSol: number; // Total SOL spent/earned (replaces sharpe_ratio)
  assets_under_copy: number;
  follower_count: number;
  risk_score: number;
  consistency_score: number;
  pnl_30d: number;
  roi_30d: number;
  trades_30d: number;
  is_verified: boolean;
  last_trade_at: string;
  label?: string | null;
  solBalance?: number;
  balanceUSD?: number;
}

export default function CopyTradingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const supabase = createClient();
  const { toast } = useToast();
  const { theme } = useTheme();
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const [traders, setTraders] = useState<LeaderboardTrader[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'roi' | 'total_pnl' | 'win_rate' | 'netSol' | 'follower_count'>('roi');
  const [filterBlockchain, setFilterBlockchain] = useState<'all' | 'sol' | 'btc'>('all');

  // Filters
  const [selectedRiskLevels, setSelectedRiskLevels] = useState<string[]>([]);
  const [minWinRate, setMinWinRate] = useState<number>(0);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showCopySettings, setShowCopySettings] = useState(false);
  const [selectedTrader, setSelectedTrader] = useState<LeaderboardTrader | null>(null);
  const [showCopySetup, setShowCopySetup] = useState(false);
  const [showAddWalletModal, setShowAddWalletModal] = useState(false);
  const [newWalletAddress, setNewWalletAddress] = useState('');
  const [newWalletName, setNewWalletName] = useState('');
  const [isAddingWallet, setIsAddingWallet] = useState(false);
  const [showLiveTrades, setShowLiveTrades] = useState(false);

  // Copy Settings
  const [copySettings, setCopySettings] = useState({
    default_copy_mode: 'manual' as 'manual' | 'auto',
    max_copy_amount_per_trade: 1000,
    position_size_percentage: 10,
    max_daily_trades: 10,
    slippage_tolerance: 1.0,
    max_price_impact: 5.0,
    enable_stop_loss: false,
    stop_loss_percentage: 10.0,
    notifications_enabled: true,
  });

  // Stats
  const [totalCopied, setTotalCopied] = useState(0);
  const [activeTraders, setActiveTraders] = useState(0);
  const [yourPnL, setYourPnL] = useState(0);

  useEffect(() => {
    loadTraders();
    loadCopySettings();
  }, [sortBy, filterBlockchain]);

  const loadCopySettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('copy_trading_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setCopySettings({
          default_copy_mode: data.default_copy_mode || 'manual',
          max_copy_amount_per_trade: parseFloat(data.max_copy_amount_per_trade) || 1000,
          position_size_percentage: parseFloat(data.position_size_percentage) || 10,
          max_daily_trades: data.max_daily_trades || 10,
          slippage_tolerance: parseFloat(data.slippage_tolerance) || 1.0,
          max_price_impact: parseFloat(data.max_price_impact) || 5.0,
          enable_stop_loss: data.enable_stop_loss || false,
          stop_loss_percentage: parseFloat(data.stop_loss_percentage) || 10.0,
          notifications_enabled: data.notifications_enabled !== false,
        });
      }
    } catch (error) {
      // Use defaults if table doesn't exist
    }
  };

  const saveCopySettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('copy_trading_settings')
        .upsert({
          user_id: user.id,
          ...copySettings,
        });

      if (error) throw error;

      toast({
        title: 'Settings saved',
        description: 'Your copy trading settings have been updated',
      });
      setShowCopySettings(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save settings',
        variant: 'destructive',
      });
    }
  };

  const loadTraders = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch the user's private tracking list from master_trader_followers
      // joined with master_traders for the labels
      const [followsRes, leaderboardRes] = await Promise.all([
        supabase
          .from('master_trader_followers')
          .select(`
            master_trader_id,
            master_traders (
              wallet_address,
              label
            )
          `)
          .eq('user_id', user.id),
        supabase
          .from('copy_trading_leaderboard')
          .select('*')
      ]);

      if (followsRes.error) throw followsRes.error;
      if (leaderboardRes.error) throw leaderboardRes.error;

      // Create a map of wallet_address -> label from the user's follows
      const userFollows = (followsRes.data || []).map((f: any) => ({
        wallet_address: f.master_traders.wallet_address,
        label: f.master_traders.label
      }));

      const labelMap: Record<string, string> = {};
      userFollows.forEach(f => {
        labelMap[f.wallet_address] = f.label;
      });

      // Map leaderboards to the user's tracked wallets
      const leaderboardMap = new Map((leaderboardRes.data || []).map(l => [l.wallet_address, l]));

      let mergedTraders = userFollows.map(follow => {
        const stats = leaderboardMap.get(follow.wallet_address) as any;
        return {
          id: follow.wallet_address,
          wallet_address: follow.wallet_address,
          blockchain: 'solana' as const,
          label: follow.label,
          total_pnl: stats?.total_pnl || 0,
          roi: stats?.roi || 0,
          win_rate: stats?.win_rate || 0,
          total_trades: stats?.total_trades || 0,
          max_drawdown: stats?.max_drawdown || 0,
          netSol: stats?.net_sol || 0, // Total SOL spent/earned
          assets_under_copy: stats?.assets_under_copy || 0,
          follower_count: stats?.follower_count || 0,
          risk_score: stats?.risk_score || 50,
          consistency_score: stats?.consistency_score || 50,
          pnl_30d: stats?.pnl_30d || 0,
          roi_30d: stats?.roi_30d || 0,
          trades_30d: stats?.trades_30d || 0,
          is_verified: stats?.is_verified || false,
          last_trade_at: stats?.last_trade_at || new Date().toISOString()
        };
      });

      // Fetch live balances and PnL data for all traders
      try {
        const enrichedTraders = await Promise.all(mergedTraders.map(async (trader) => {
          try {
            // Fetch balance from Alchemy
            const balanceData = await fetchSolanaWalletBalance(trader.wallet_address);

            // Fetch PnL data from Solana Tracker API
            const pnlData = await fetchWalletPnL(trader.wallet_address);

            const solPrice = 200; // TODO: Get real SOL price

            // Debug logging to trace values
            if (pnlData) {
              console.log(`[CopyTrading] ${trader.wallet_address.slice(0, 8)}... API Response:`, {
                realized: pnlData.summary.realized,
                unrealized: pnlData.summary.unrealized,
                total: pnlData.summary.total,
                totalInvested: pnlData.summary.totalInvested,
                winPercentage: pnlData.summary.winPercentage,
                totalWins: pnlData.summary.totalWins,
                totalLosses: pnlData.summary.totalLosses,
              });
            }

            return {
              ...trader,
              solBalance: balanceData.balances['SOL']?.amount || 0,
              balanceUSD: balanceData.totalUsdValue,
              // ALWAYS use Solana Tracker data, default to 0 if API fails (don't use cached db values)
              win_rate: pnlData?.summary.winPercentage ?? 0,
              // Solana Tracker API returns values in USD already - no need to multiply by SOL price!
              total_pnl: pnlData?.summary.realized ?? 0,
              // PnL from Solana Tracker (already in USD)
              pnl_30d: pnlData?.summary.realized ?? 0,
              total_trades: pnlData ? (pnlData.summary.totalWins + pnlData.summary.totalLosses) : 0,
              // Net SOL: convert USD to SOL by dividing by price
              netSol: pnlData ? pnlData.summary.realized / solPrice : 0,
              roi: pnlData && pnlData.summary.totalInvested > 0
                ? (pnlData.summary.realized / pnlData.summary.totalInvested) * 100
                : 0,
            };
          } catch (e) {
            console.warn(`Could not fetch data for ${trader.wallet_address}:`, e);
            // Return trader with zeroed metrics instead of potentially inflated cached values
            return {
              ...trader,
              pnl_30d: 0,
              netSol: 0,
              total_pnl: 0,
              win_rate: 0,
              roi: 0,
              total_trades: 0,
            };
          }
        }));
        mergedTraders = enrichedTraders;
      } catch (e) {
        console.error('Error in data enrichment:', e);
      }

      setTraders(mergedTraders);
      setActiveTraders(mergedTraders?.length || 0);
      setTotalCopied(mergedTraders?.reduce((sum, t) => sum + (t.assets_under_copy || 0), 0) || 0);


      // Calculate user's P&L from copy trading
      if (user) {
        const { data: copyPositions } = await supabase
          .from('copy_trading_positions')
          .select('current_pnl')
          .eq('user_id', user.id);

        setYourPnL(copyPositions?.reduce((sum, p) => sum + (p.current_pnl || 0), 0) || 0);
      }

    } catch (error: any) {
      console.error('Error loading traders:', error);
      toast({
        title: 'Error loading leaderboard',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyTrader = async (trader: LeaderboardTrader) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to copy traders',
        variant: 'destructive',
      });
      return;
    }

    // Open copy setup modal instead of directly copying
    setSelectedTrader(trader);
    setShowCopySetup(true);
  };

  const handleCopySetupComplete = () => {
    setShowCopySetup(false);
    setSelectedTrader(null);
    loadTraders(); // Refresh to show updated stats
    toast({
      title: 'Success!',
      description: 'Copy trading configuration saved',
    });
  };

  const handleClearMockData = async () => {
    try {
      setLoading(true);
      const { error: error1 } = await supabase
        .from('copy_trading_leaderboard')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      const { error: error2 } = await supabase
        .from('master_traders')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (error1) throw error1;
      if (error2) throw error2;

      toast({
        title: 'Data Cleared',
        description: 'All traders have been removed from the platform.',
      });
      loadTraders();
    } catch (error: any) {
      toast({
        title: 'Error clearing data',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveWallet = async (trader: LeaderboardTrader) => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // First find the master trader record
      const { data: masterTrader } = await supabase
        .from('master_traders')
        .select('id')
        .eq('wallet_address', trader.wallet_address)
        .single();

      if (!masterTrader) throw new Error('Trader record not found');

      // Remove specifically from the user's followers list
      const { error } = await supabase
        .from('master_trader_followers')
        .delete()
        .eq('user_id', user.id)
        .eq('master_trader_id', masterTrader.id);

      if (error) throw error;

      toast({
        title: 'Wallet Removed',
        description: `${trader.label || trader.wallet_address} has been removed from your tracking list.`,
      });

      // Update local state immediately for better UX
      setTraders(prev => prev.filter(t => t.wallet_address !== trader.wallet_address));

      loadTraders();
    } catch (error: any) {
      toast({
        title: 'Error removing wallet',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddWallet = async () => {
    if (!newWalletAddress || !newWalletName) {
      toast({
        title: 'Missing information',
        description: 'Please provide both wallet address and name',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsAddingWallet(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // 1. Upsert into master_traders (global registry)
      const { data: masterData, error: masterError } = await supabase
        .from('master_traders')
        .upsert({
          wallet_address: newWalletAddress,
          label: newWalletName,
          risk_level: 'medium',
        }, { onConflict: 'wallet_address' })
        .select('id')
        .single();

      if (masterError) throw masterError;

      // 2. Link to user in master_trader_followers
      const { error: followError } = await supabase
        .from('master_trader_followers')
        .upsert({
          user_id: user.id,
          master_trader_id: masterData.id,
          is_active: true
        });

      if (followError) throw followError;

      toast({
        title: 'Wallet Added',
        description: `${newWalletName} has been added to your tracking list. Analysis started...`,
      });

      setShowAddWalletModal(false);
      setNewWalletAddress('');
      setNewWalletName('');

      // Reload traders to fetch PnL data from Solana Tracker API
      loadTraders();

    } catch (error: any) {
      toast({
        title: 'Error adding wallet',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsAddingWallet(false);
    }
  };

  const shortenAddress = (address: string) => {
    if (!address) return 'Unknown';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getBlockchainBadge = (address: string) => {
    if (address?.startsWith('0x')) return { label: 'ETH', color: 'bg-[#627eea]/20 text-[#627eea]' };
    if (address?.length === 44) return { label: 'SOL', color: 'bg-[#8b5cf6]/20 text-[#8b5cf6]' };
    return { label: 'BTC', color: 'bg-[#f59e0b]/20 text-[#f59e0b]' };
  };

  // Derive risk level from risk_score
  const getRiskLevel = (riskScore: number): string => {
    if (riskScore <= 3) return 'low';
    if (riskScore <= 6) return 'medium';
    return 'high';
  };

  const filteredTraders = traders.filter(t => {
    if (searchQuery && !t.wallet_address?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filterBlockchain !== 'all') {
      const badge = getBlockchainBadge(t.wallet_address);
      if (filterBlockchain === 'sol' && badge.label !== 'SOL') return false;
      if (filterBlockchain === 'btc' && badge.label !== 'BTC') return false;
    }

    // Risk level filter
    if (selectedRiskLevels.length > 0) {
      const riskLevel = getRiskLevel(t.risk_score || 5);
      if (!selectedRiskLevels.includes(riskLevel)) return false;
    }

    // Win rate filter
    if (minWinRate > 0 && (t.win_rate || 0) < minWinRate) {
      return false;
    }

    // Verified only filter
    if (verifiedOnly && !t.is_verified) {
      return false;
    }

    return true;
  });

  if (loading) {
    return (
      <div className="p-6">
        <div className={cn(
          "text-xl font-semibold mb-4",
          isDark ? "text-white" : "text-gray-900"
        )}>Copy Trading</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className={cn(
              "rounded-xl border p-4 h-24 animate-pulse",
              isDark ? "bg-[#09090b] border-[#27272a]" : "bg-white border-gray-200"
            )}></div>
          ))}
        </div>
        <div className={cn(
          "rounded-xl border h-96 animate-pulse",
          isDark ? "bg-[#09090b] border-[#27272a]" : "bg-white border-gray-200"
        )}></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Page Title */}
      <div className={cn(
        "text-2xl font-bold",
        isDark ? "text-white" : "text-gray-900"
      )}>Copy Trading</div>

      {/* Stats Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          label="Total Under Copy"
          value={formatCurrency(totalCopied)}
          icon={<Users className="w-5 h-5" />}
          className={cn(isDark && "bg-[#09090b] border-[#27272a]")}
        />
        <MetricCard
          label="Active Traders"
          value={activeTraders.toString()}
          icon={<Target className="w-5 h-5" />}
          className={cn(isDark && "bg-[#09090b] border-[#27272a]")}
        />
        <MetricCard
          label="Your P&L"
          value={formatCurrency(yourPnL)}
          change={yourPnL > 0 ? 12.5 : -5.2}
          icon={<TrendingUp className="w-5 h-5" />}
          className={cn(isDark && "bg-[#09090b] border-[#27272a]")}
        />
      </div>

      {/* Filters */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex flex-1 gap-3 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b7280]" />
              <Input
                placeholder="Search by wallet address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "pl-10",
                  isDark
                    ? "bg-[#09090b] border-[#27272a] text-white placeholder:text-[#6b7280]"
                    : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-500"
                )}
              />
            </div>

            <Select value={filterBlockchain} onValueChange={(v: any) => setFilterBlockchain(v)}>
              <SelectTrigger className={cn(
                "w-[120px]",
                isDark ? "bg-[#09090b] border-[#27272a] text-[#9ca3af]" : "bg-white border-gray-300 text-gray-700"
              )}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={cn(
                isDark ? "bg-[#09090b] border-[#27272a]" : "bg-white border-gray-200"
              )}>
                <SelectItem value="all">All Chains</SelectItem>
                <SelectItem value="sol">Solana</SelectItem>
                <SelectItem value="btc">Bitcoin</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                isDark ? "border-[#27272a] text-[#9ca3af]" : "border-gray-300 text-gray-700"
              )}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>

            <Dialog open={showCopySettings} onOpenChange={setShowCopySettings}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    isDark ? "border-[#27272a] text-[#9ca3af]" : "border-gray-300 text-gray-700"
                  )}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
              </DialogTrigger>
              <DialogContent className={cn(
                isDark ? "bg-black border-[#27272a]" : "bg-white border-gray-200"
              )}>
                <DialogHeader>
                  <DialogTitle className={cn(isDark ? "text-white" : "text-gray-900")}>
                    Copy Trading Settings
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label className={cn(isDark ? "text-gray-300" : "text-gray-700")}>
                      Default Copy Mode
                    </Label>
                    <Select
                      value={copySettings.default_copy_mode}
                      onValueChange={(v: any) => setCopySettings({ ...copySettings, default_copy_mode: v })}
                    >
                      <SelectTrigger className={cn(
                        "mt-2",
                        isDark ? "bg-[#09090b] border-[#27272a]" : "bg-white border-gray-300"
                      )}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="auto">Auto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className={cn(isDark ? "text-gray-300" : "text-gray-700")}>
                      Max Copy Amount Per Trade: ${copySettings.max_copy_amount_per_trade}
                    </Label>
                    <Slider
                      value={[copySettings.max_copy_amount_per_trade]}
                      onValueChange={(v) => setCopySettings({ ...copySettings, max_copy_amount_per_trade: v[0] })}
                      min={100}
                      max={10000}
                      step={100}
                      className="mt-2 [&_[data-radix-slider-track]]:bg-gray-700 [&_[data-radix-slider-range]]:bg-gray-400 [&_[data-radix-slider-thumb]]:border-gray-400"
                    />
                  </div>

                  <div>
                    <Label className={cn(isDark ? "text-gray-300" : "text-gray-700")}>
                      Position Size Percentage: {copySettings.position_size_percentage}%
                    </Label>
                    <Slider
                      value={[copySettings.position_size_percentage]}
                      onValueChange={(v) => setCopySettings({ ...copySettings, position_size_percentage: v[0] })}
                      min={1}
                      max={50}
                      step={1}
                      className="mt-2 [&_[data-radix-slider-track]]:bg-gray-700 [&_[data-radix-slider-range]]:bg-gray-400 [&_[data-radix-slider-thumb]]:border-gray-400"
                    />
                  </div>

                  <div>
                    <Label className={cn(isDark ? "text-gray-300" : "text-gray-700")}>
                      Max Daily Trades: {copySettings.max_daily_trades}
                    </Label>
                    <Slider
                      value={[copySettings.max_daily_trades]}
                      onValueChange={(v) => setCopySettings({ ...copySettings, max_daily_trades: v[0] })}
                      min={1}
                      max={50}
                      step={1}
                      className="mt-2 [&_[data-radix-slider-track]]:bg-gray-700 [&_[data-radix-slider-range]]:bg-gray-400 [&_[data-radix-slider-thumb]]:border-gray-400"
                    />
                  </div>

                  <div>
                    <Label className={cn(isDark ? "text-gray-300" : "text-gray-700")}>
                      Slippage Tolerance: {copySettings.slippage_tolerance}%
                    </Label>
                    <Slider
                      value={[copySettings.slippage_tolerance]}
                      onValueChange={(v) => setCopySettings({ ...copySettings, slippage_tolerance: v[0] })}
                      min={0.1}
                      max={5}
                      step={0.1}
                      className="mt-2 [&_[data-radix-slider-track]]:bg-gray-700 [&_[data-radix-slider-range]]:bg-gray-400 [&_[data-radix-slider-thumb]]:border-gray-400"
                    />
                  </div>

                  <div>
                    <Label className={cn(isDark ? "text-gray-300" : "text-gray-700")}>
                      Max Price Impact: {copySettings.max_price_impact}%
                    </Label>
                    <Slider
                      value={[copySettings.max_price_impact]}
                      onValueChange={(v) => setCopySettings({ ...copySettings, max_price_impact: v[0] })}
                      min={0.1}
                      max={10}
                      step={0.1}
                      className="mt-2 [&_[data-radix-slider-track]]:bg-gray-700 [&_[data-radix-slider-range]]:bg-gray-400 [&_[data-radix-slider-thumb]]:border-gray-400"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="stop-loss"
                      checked={copySettings.enable_stop_loss}
                      onCheckedChange={(checked) =>
                        setCopySettings({ ...copySettings, enable_stop_loss: checked as boolean })
                      }
                    />
                    <Label htmlFor="stop-loss" className={cn(isDark ? "text-gray-300" : "text-gray-700")}>
                      Enable Stop Loss
                    </Label>
                  </div>

                  {copySettings.enable_stop_loss && (
                    <div>
                      <Label className={cn(isDark ? "text-gray-300" : "text-gray-700")}>
                        Stop Loss Percentage: {copySettings.stop_loss_percentage}%
                      </Label>
                      <Slider
                        value={[copySettings.stop_loss_percentage]}
                        onValueChange={(v) => setCopySettings({ ...copySettings, stop_loss_percentage: v[0] })}
                        min={1}
                        max={50}
                        step={0.5}
                        className="mt-2 [&_[data-radix-slider-track]]:bg-gray-700 [&_[data-radix-slider-range]]:bg-gray-400 [&_[data-radix-slider-thumb]]:border-gray-400"
                      />
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="notifications"
                      checked={copySettings.notifications_enabled}
                      onCheckedChange={(checked) =>
                        setCopySettings({ ...copySettings, notifications_enabled: checked as boolean })
                      }
                    />
                    <Label htmlFor="notifications" className={cn(isDark ? "text-gray-300" : "text-gray-700")}>
                      Enable Notifications
                    </Label>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setShowCopySettings(false)}
                      className="border-gray-500 text-gray-300 hover:bg-gray-800"
                    >
                      Cancel
                    </Button>
                    <Button onClick={saveCopySettings} className="bg-gray-600 hover:bg-gray-500 text-white">
                      Save Settings
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={showAddWalletModal} onOpenChange={setShowAddWalletModal}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    isDark ? "border-[#27272a] text-[#9ca3af]" : "border-gray-300 text-gray-700"
                  )}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Wallet
                </Button>
              </DialogTrigger>
              <DialogContent className={cn(
                isDark ? "bg-black border-[#27272a]" : "bg-white border-gray-200"
              )}>
                <DialogHeader>
                  <DialogTitle className={cn(isDark ? "text-white" : "text-gray-900")}>
                    Add Master Wallet
                  </DialogTitle>
                  <DialogDescription>
                    Track a Solana wallet address for copy trading.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="wallet-address">Wallet Address</Label>
                    <Input
                      id="wallet-address"
                      placeholder="Solana address..."
                      value={newWalletAddress}
                      onChange={(e) => setNewWalletAddress(e.target.value)}
                      className={cn(isDark && "bg-black border-gray-800")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wallet-name">Wallet Name / Label</Label>
                    <Input
                      id="wallet-name"
                      placeholder="e.g. Whale Trader"
                      value={newWalletName}
                      onChange={(e) => setNewWalletName(e.target.value)}
                      className={cn(isDark && "bg-black border-gray-800")}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setShowAddWalletModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAddWallet}
                      disabled={isAddingWallet}
                    >
                      {isAddingWallet ? "Adding..." : "Save Wallet"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLiveTrades(true)}
              className={cn(
                "border-[#27272a] text-[#9ca3af] bg-black hover:bg-[#1a1a1a] transition-colors",
                !isDark && "border-gray-200 text-gray-600 bg-white"
              )}
            >
              <Activity className="w-4 h-4 mr-2" />
              Live Trades
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleClearMockData}
              className="text-red-500 hover:text-red-400 border-red-900/50 bg-black"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All Data
            </Button>
          </div>

          <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
            <SelectTrigger className={cn(
              "w-[160px]",
              isDark ? "bg-[#09090b] border-[#27272a] text-[#9ca3af]" : "bg-white border-gray-300 text-gray-700"
            )}>
              <ArrowUpDown className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={cn(
              isDark ? "bg-[#09090b] border-[#27272a]" : "bg-white border-gray-200"
            )}>
              <SelectItem value="roi">ROI</SelectItem>
              <SelectItem value="total_pnl">Total P&L</SelectItem>
              <SelectItem value="win_rate">Win Rate</SelectItem>
              <SelectItem value="netSol">Net SOL</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className={cn(
            "rounded-xl border p-4",
            isDark ? "bg-[#09090b] border-[#27272a]" : "bg-white border-gray-200"
          )}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Risk Level Filter */}
              <div>
                <Label className={cn(isDark ? "text-gray-300" : "text-gray-700")}>Risk Level</Label>
                <div className="space-y-2 mt-2">
                  {['low', 'medium', 'high'].map(risk => (
                    <div key={risk} className="flex items-center">
                      <Checkbox
                        id={`risk-${risk}`}
                        checked={selectedRiskLevels.includes(risk)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedRiskLevels([...selectedRiskLevels, risk]);
                          } else {
                            setSelectedRiskLevels(selectedRiskLevels.filter(r => r !== risk));
                          }
                        }}
                      />
                      <Label htmlFor={`risk-${risk}`} className={cn(
                        "ml-2 text-sm capitalize",
                        isDark ? "text-gray-300" : "text-gray-700"
                      )}>
                        {risk}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Win Rate Filter */}
              <div>
                <Label className={cn(isDark ? "text-gray-300" : "text-gray-700")}>
                  Min Win Rate: {minWinRate}%
                </Label>
                <Slider
                  value={[minWinRate]}
                  onValueChange={(v) => setMinWinRate(v[0])}
                  min={0}
                  max={100}
                  step={1}
                  className="mt-2"
                />
              </div>

              {/* Verified Only */}
              <div className="flex items-center space-x-2 pt-6">
                <Checkbox
                  id="verified-only"
                  checked={verifiedOnly}
                  onCheckedChange={(checked) => setVerifiedOnly(checked as boolean)}
                />
                <Label htmlFor="verified-only" className={cn(isDark ? "text-gray-300" : "text-gray-700")}>
                  Verified Only
                </Label>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => {
                setSelectedRiskLevels([]);
                setMinWinRate(0);
                setVerifiedOnly(false);
              }}
              className="mt-4"
            >
              Clear Filters
            </Button>
          </div>
        )}
      </div>

      {/* Leaderboard Table */}
      <div className={cn(
        "rounded-xl border overflow-hidden",
        isDark ? "bg-[#09090b] border-[#27272a]" : "bg-white border-gray-200"
      )}>
        {/* Table Header */}
        <div className={cn(
          "hidden lg:grid lg:grid-cols-7 gap-4 px-6 py-3 border-b text-sm font-medium",
          isDark ? "border-[#27272a] text-[#6b7280]" : "border-gray-200 text-gray-500"
        )}>
          <span className="col-span-2">Trader</span>
          <span className="text-right">ROI</span>
          <span className="text-right">Win Rate</span>
          <span className="text-right">PnL</span>
          <span className="text-right">Net SOL</span>
          <span className="text-right">Action</span>
        </div>

        {/* Table Body */}
        <div className={cn(
          "divide-y",
          isDark ? "divide-[#1f2937]" : "divide-gray-200"
        )}>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-full bg-[#374151] animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-[#374151] rounded animate-pulse" />
                  <div className="h-3 w-20 bg-[#374151] rounded animate-pulse" />
                </div>
              </div>
            ))
          ) : filteredTraders.length === 0 ? (
            <div className={cn(
              "flex flex-col items-center justify-center py-12",
              isDark ? "text-[#6b7280]" : "text-gray-500"
            )}>
              <Users className="w-12 h-12 mb-4 opacity-50" />
              <p className={cn(
                "text-lg",
                isDark ? "text-white" : "text-gray-900"
              )}>No traders found</p>
            </div>
          ) : (
            filteredTraders.map((trader, index) => (
              <TraderRow
                key={trader.id}
                trader={trader}
                index={index}
                isDark={isDark}
                handleRemoveWallet={handleRemoveWallet}
                handleCopyTrader={handleCopyTrader}
                shortenAddress={shortenAddress}
                getBlockchainBadge={getBlockchainBadge}
              />
            ))
          )}
        </div>
      </div>

      {/* Copy Trader Setup Modal */}
      <CopyTraderSetup
        open={showCopySetup}
        onOpenChange={(open) => {
          setShowCopySetup(open);
          if (!open) {
            setSelectedTrader(null);
          }
        }}
        trader={selectedTrader}
      />

      <LiveTradesModal
        open={showLiveTrades}
        onOpenChange={setShowLiveTrades}
        trackedWallets={traders.map(t => ({ address: t.wallet_address, label: t.label || t.wallet_address }))}
        isDark={isDark}
      />
    </div>
  );
}

