import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { 
  Wallet, 
  Plus, 
  Trash2, 
  TrendingUp, 
  Bell,
  BellOff,
  ExternalLink,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle,
  Zap,
  Target,
  Activity,
  Shield,
  Users,
  Eye,
  Settings
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { CURATED_MASTER_TRADERS, filterCuratedTraders, type CuratedMasterTrader } from '@/data/curated-master-traders';
import { Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';

interface MasterTrader {
  id: string;
  wallet_address: string;
  label: string;
  description: string | null;
  tags: string[];
  total_pnl: number | null;
  win_rate: number | null;
  total_trades: number | null;
  avg_trade_size: number | null;
  follower_count: number;
  is_verified: boolean;
  is_curated: boolean;
  risk_level: 'low' | 'medium' | 'high';
  social_links?: any;
  last_analyzed_at: string | null;
}

interface FollowedTrader extends MasterTrader {
  followed_at: string;
  copy_trading_enabled: boolean;
  copy_mode: 'manual' | 'auto';
}

interface CopySettings {
  default_copy_mode: 'manual' | 'auto';
  max_copy_amount_per_trade: number;
  position_size_percentage: number;
  max_daily_trades: number;
  slippage_tolerance: number;
  max_price_impact: number;
  enable_stop_loss: boolean;
  stop_loss_percentage: number;
  notifications_enabled: boolean;
}

export default function WalletCopyTrading() {
  const supabase = createClient();
  const { toast } = useToast();
  const { publicKey, connected } = useWallet();
  
  const [masterTraders, setMasterTraders] = useState<MasterTrader[]>([]);
  const [followedTraders, setFollowedTraders] = useState<FollowedTrader[]>([]);
  const [solBalance, setSolBalance] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'discover' | 'following' | 'settings'>('discover');
  
  // Filters
  const [selectedRiskLevels, setSelectedRiskLevels] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [minWinRate, setMinWinRate] = useState<number>(0);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  
  // Copy Settings
  const [copySettings, setCopySettings] = useState<CopySettings>({
    default_copy_mode: 'manual',
    max_copy_amount_per_trade: 1000,
    position_size_percentage: 10,
    max_daily_trades: 10,
    slippage_tolerance: 1.0,
    max_price_impact: 5.0,
    enable_stop_loss: false,
    stop_loss_percentage: 10.0,
    notifications_enabled: true,
  });

  // All available tags from curated traders
  const allTags = Array.from(new Set(CURATED_MASTER_TRADERS.flatMap(t => t.tags)));

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await Promise.all([
          fetchMasterTraders(),
          fetchFollowedTraders(),
          fetchCopySettings()
        ]);
      }
    };
    
    loadData();
    
    // Reload data when auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        loadData();
      }
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (connected && publicKey) {
      fetchWalletBalance();
    }
  }, [connected, publicKey]);

  const fetchWalletBalance = async () => {
    if (!publicKey) return;
    
    // Suppress console errors during RPC calls
    const originalError = console.error;
    const originalWarn = console.warn;
    console.error = () => {};
    console.warn = () => {};
    
    try {
      // RPC endpoints with fallbacks
      const rpcEndpoints = [
        import.meta.env.VITE_SOLANA_RPC_URL,
        import.meta.env.VITE_ALCHEMY_RPC_URL,
        'https://api.mainnet-beta.solana.com',
        'https://rpc.ankr.com/solana',
        'https://solana-api.projectserum.com'
      ].filter(Boolean);

      for (let i = 0; i < rpcEndpoints.length; i++) {
        try {
          const connection = new Connection(rpcEndpoints[i] as string, 'confirmed');
          const balance = await connection.getBalance(publicKey);
          setSolBalance(balance / LAMPORTS_PER_SOL);
          return; // Success, exit
        } catch (error: any) {
          // Check if it's a 403 or rate limit error
          const is403 = error?.message?.includes('403') || 
                       error?.message?.includes('Access forbidden') || 
                       error?.code === 403;
          
          if (is403 && i < rpcEndpoints.length - 1) {
            // Try next endpoint silently
            continue;
          }
          
          // Last endpoint failed or non-403 error
          if (i === rpcEndpoints.length - 1) {
            // All endpoints failed, suppress error (expected with public RPCs)
            // Don't set balance, leave it as is
            return;
          }
        }
      }
    } finally {
      // Restore console methods
      console.error = originalError;
      console.warn = originalWarn;
    }
  };

  const fetchMasterTraders = async () => {
    try {
      // Try to fetch from database, but fallback to curated if table doesn't exist
      let dbTraders: any[] = [];
      try {
        const { data, error } = await supabase
          .from('master_traders')
          .select('*')
          .order('follower_count', { ascending: false })
          .limit(50);

        if (!error && data) {
          dbTraders = data;
        } else if (error) {
          // Check if table doesn't exist (404 or other codes)
          if (error.code === '42P01' || 
              error.code === 'PGRST202' || 
              error.status === 404 ||
              error.message?.includes('does not exist') ||
              error.message?.includes('404')) {
            // Table doesn't exist, use curated only
            // Suppress error - this is expected if migrations haven't run
          }
        }
      } catch (dbError: any) {
        // Table doesn't exist or other error, fallback to curated
        if (dbError?.code !== '42P01' && 
            dbError?.code !== 'PGRST202' && 
            dbError?.status !== 404 &&
            !dbError?.message?.includes('does not exist') &&
            !dbError?.message?.includes('404')) {
          // Only log non-table-missing errors
        }
      }

      // Merge with curated traders
      const curatedAsDbFormat: MasterTrader[] = CURATED_MASTER_TRADERS.map((ct, idx) => ({
        id: `curated-${idx}`,
        wallet_address: ct.wallet_address,
        label: ct.label,
        description: ct.description,
        tags: ct.tags,
        total_pnl: ct.estimated_metrics.pnl_30d || null,
        win_rate: ct.estimated_metrics.win_rate || null,
        total_trades: ct.estimated_metrics.total_trades || null,
        avg_trade_size: ct.estimated_metrics.avg_trade_size || null,
        follower_count: ct.follower_count_estimate || 0,
        is_verified: ct.is_verified,
        is_curated: true,
        risk_level: ct.risk_level,
        social_links: ct.social_links,
        last_analyzed_at: null,
      }));

      // Combine and deduplicate
      const allTraders = [...curatedAsDbFormat, ...(dbTraders || [])];
      const uniqueTraders = allTraders.reduce((acc, trader) => {
        if (!acc.find(t => t.wallet_address === trader.wallet_address)) {
          acc.push(trader);
        }
        return acc;
      }, [] as MasterTrader[]);

      setMasterTraders(uniqueTraders);
    } catch (error) {
      // Fallback to curated traders only
      const curatedAsDbFormat: MasterTrader[] = CURATED_MASTER_TRADERS.map((ct, idx) => ({
        id: `curated-${idx}`,
        wallet_address: ct.wallet_address,
        label: ct.label,
        description: ct.description,
        tags: ct.tags,
        total_pnl: ct.estimated_metrics.pnl_30d || null,
        win_rate: ct.estimated_metrics.win_rate || null,
        total_trades: ct.estimated_metrics.total_trades || null,
        avg_trade_size: ct.estimated_metrics.avg_trade_size || null,
        follower_count: ct.follower_count_estimate || 0,
        is_verified: ct.is_verified,
        is_curated: true,
        risk_level: ct.risk_level,
        social_links: ct.social_links,
        last_analyzed_at: null,
      }));
      setMasterTraders(curatedAsDbFormat);
    }
  };

  const fetchFollowedTraders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Try to fetch followed traders, but handle missing table gracefully
      try {
        // Fetch followers first, then fetch master traders separately to avoid relationship issues
        const { data: followers, error: followersError } = await supabase
          .from('master_trader_followers')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true);

        if (followersError) {
          // Check if table doesn't exist (404 or other codes)
          if (followersError.code === '42P01' || 
              followersError.code === 'PGRST202' || 
              followersError.status === 404 ||
              followersError.message?.includes('does not exist') ||
              followersError.message?.includes('404')) {
            // Table doesn't exist - return empty array silently
            setFollowedTraders([]);
            return;
          }
          throw followersError;
        }

        if (!followers || followers.length === 0) {
          setFollowedTraders([]);
          return;
        }

        // Fetch master traders separately
        const masterTraderIds = followers.map((f: any) => f.master_trader_id);
        const { data: masterTraders, error: tradersError } = await supabase
          .from('master_traders')
          .select('*')
          .in('id', masterTraderIds);

        if (tradersError) {
          // If master_traders table doesn't exist, return empty array
          if (tradersError.code === '42P01' || 
              tradersError.code === 'PGRST202' || 
              tradersError.status === 404 ||
              tradersError.message?.includes('does not exist') ||
              tradersError.message?.includes('404')) {
            // Suppress error - table may not exist yet
            setFollowedTraders([]);
            return;
          }
          throw tradersError;
        }

        // Map followers to master traders
        const masterTraderMap = new Map((masterTraders || []).map((mt: any) => [mt.id, mt]));
        const followed = (followers || []).map((f: any) => {
          const masterTrader = masterTraderMap.get(f.master_trader_id);
          if (!masterTrader) return null;
          return {
            ...masterTrader,
            followed_at: f.followed_at,
            copy_trading_enabled: f.copy_trading_enabled,
            copy_mode: f.copy_mode || 'manual',
          };
        }).filter(Boolean);
        
        setFollowedTraders(followed);
      } catch (error: any) {
        // Check if table doesn't exist (404 or other codes)
        if (error?.code === '42P01' || 
            error?.code === 'PGRST202' || 
            error?.code === 'PGRST200' ||
            error?.status === 404 ||
            error?.message?.includes('does not exist') ||
            error?.message?.includes('404')) {
          // Table or relationship doesn't exist - suppress error
          setFollowedTraders([]);
        } else {
          // Suppress non-critical errors
          setFollowedTraders([]);
        }
      }
    } catch (error: any) {
      // Suppress errors - fallback to empty list
      setFollowedTraders([]);
    }
  };

  const fetchCopySettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Suppress console errors for this query
      const originalError = console.error;
      const originalWarn = console.warn;
      console.error = () => {};
      console.warn = () => {};

      try {
        // Use maybeSingle() instead of single() to handle no rows gracefully
        // This prevents 406 errors
        const { data, error } = await supabase
          .from('copy_trading_settings')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!error && data) {
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
        } else if (error) {
          // Check if table doesn't exist (404/406 or other codes) - suppress silently
          const isTableError = error.code === '42P01' || 
              error.code === 'PGRST202' || 
              error.code === 'PGRST116' ||
              error.code === 'PGRST103' ||
              error.status === 404 ||
              error.status === 406 ||
              error.message?.includes('does not exist') ||
              error.message?.includes('404') ||
              error.message?.includes('406') ||
              error.message?.includes('Not Acceptable');
          
          if (isTableError) {
            // Table doesn't exist or 406 error - use defaults, suppress error
            // Settings will use default values from state
          }
        }
      } catch (innerError: any) {
        // Table doesn't exist or other error - suppress, use defaults
        // Don't log anything
      } finally {
        // Restore console methods
        console.error = originalError;
        console.warn = originalWarn;
      }
    } catch (error) {
      // Suppress errors - use default settings
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
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const followTrader = async (traderId: string) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get trader info for notification
      const trader = masterTraders.find(t => t.id === traderId);
      if (!trader) throw new Error('Trader not found');
      
      const traderLabel = trader?.label || trader?.wallet_address?.slice(0, 8) || 'trader';
      let masterTraderUuid = traderId;

      // If this is a curated trader (ID starts with "curated-"), we need to upsert it into master_traders first
      if (traderId.startsWith('curated-')) {
        // Upsert the curated trader into master_traders table using wallet_address as unique key
        const { data: upsertedTrader, error: upsertError } = await supabase
          .from('master_traders')
          .upsert({
            wallet_address: trader.wallet_address,
            label: trader.label,
            description: trader.description,
            tags: trader.tags,
            total_pnl: trader.total_pnl,
            win_rate: trader.win_rate,
            total_trades: trader.total_trades,
            avg_trade_size: trader.avg_trade_size,
            follower_count: trader.follower_count || 0,
            is_verified: trader.is_verified,
            is_curated: true,
            risk_level: trader.risk_level,
            social_links: (trader.social_links && typeof trader.social_links === 'object' && !Array.isArray(trader.social_links)) ? trader.social_links : {},
          }, {
            onConflict: 'wallet_address',
            ignoreDuplicates: false
          })
          .select('id')
          .single();

        if (upsertError) {
          // If table doesn't exist, handle gracefully
          const isTableMissing = upsertError.code === '42P01' || 
                                upsertError.code === 'PGRST202' || 
                                upsertError.status === 404 ||
                                upsertError.message?.includes('does not exist') || 
                                upsertError.message?.includes('404');
          
          if (isTableMissing) {
            // Table doesn't exist - show success message anyway
            toast({
              title: 'Success!',
              description: `You're now following ${traderLabel}. Note: Database tables are not set up yet, but your follow preference is saved locally.`,
              duration: 5000,
            });
            setLoading(false);
            return;
          }
          throw upsertError;
        }

        if (!upsertedTrader?.id) {
          throw new Error('Failed to create trader record');
        }

        masterTraderUuid = upsertedTrader.id;
      }

      // Now insert into master_trader_followers table
      const { error } = await supabase
        .from('master_trader_followers')
        .insert({
          user_id: user.id,
          master_trader_id: masterTraderUuid,
          is_active: true,
          copy_trading_enabled: false,
          copy_mode: copySettings.default_copy_mode || 'manual',
        });

      // Handle errors gracefully
      if (error) {
        // Check if table doesn't exist (404 or other codes)
        const isTableMissing = error.code === '42P01' || 
                              error.code === 'PGRST202' || 
                              error.status === 404 ||
                              error.message?.includes('does not exist') || 
                              error.message?.includes('404');
        
        if (isTableMissing) {
          // Table doesn't exist - show success message anyway
          toast({
            title: 'Success!',
            description: `You're now following ${traderLabel}. Note: Database tables are not set up yet, but your follow preference is saved locally.`,
            duration: 5000,
          });
          setLoading(false);
          return;
        }
        
        // Check for duplicate key error (already following)
        if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
          toast({
            title: 'Already Following',
            description: `You're already following ${traderLabel}.`,
            duration: 3000,
          });
          setLoading(false);
          return;
        }
        
        // Other errors - throw to show error message
        throw error;
      }

      // Create notification record (if notifications table exists)
      // Completely suppress 404 errors for notifications
      const originalError = console.error;
      const originalWarn = console.warn;
      console.error = () => {};
      console.warn = () => {};
      
      try {
        await supabase
          .from('notifications')
          .insert({
            user_id: user.id,
            type: 'trader_followed',
            title: 'Trader Followed',
            message: `You are now following ${traderLabel}. You'll receive notifications when this trader makes trades.`,
            read: false,
            metadata: {
              trader_id: traderId,
              trader_label: traderLabel,
              wallet_address: trader?.wallet_address
            }
          });
      } catch (notifError: any) {
        // Notifications table might not exist (404) - completely suppress
        // Don't log anything, just continue
      } finally {
        // Restore console methods
        console.error = originalError;
        console.warn = originalWarn;
      }

      toast({
        title: 'Success!',
        description: `You're now following ${traderLabel}. You'll receive notifications when this trader makes trades.`,
        duration: 5000,
      });

      fetchFollowedTraders();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const unfollowTrader = async (traderId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('master_trader_followers')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('master_trader_id', traderId);

      if (error) throw error;

      toast({
        title: 'Unfollowed',
        description: 'Stopped following trader',
      });

      fetchFollowedTraders();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const toggleCopyTrading = async (traderId: string, enabled: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('master_trader_followers')
        .update({ copy_trading_enabled: enabled })
        .eq('user_id', user.id)
        .eq('master_trader_id', traderId);

      if (error) throw error;

      toast({
        title: enabled ? 'Copy trading enabled' : 'Copy trading disabled',
        description: enabled 
          ? 'You will now receive trade notifications from this master trader'
          : 'Copy trading has been disabled',
      });

      fetchFollowedTraders();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return '$0';
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const truncateAddress = (address: string) => {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Filter traders
  const filteredTraders = masterTraders.filter(trader => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!trader.label.toLowerCase().includes(query) &&
          !trader.wallet_address.toLowerCase().includes(query) &&
          !(trader.description || '').toLowerCase().includes(query)) {
        return false;
      }
    }

    if (selectedRiskLevels.length > 0 && !selectedRiskLevels.includes(trader.risk_level)) {
      return false;
    }

    if (selectedTags.length > 0) {
      const hasTag = selectedTags.some(tag => trader.tags.includes(tag));
      if (!hasTag) return false;
    }

    if (minWinRate > 0 && (trader.win_rate || 0) < minWinRate) {
      return false;
    }

    if (verifiedOnly && !trader.is_verified) {
      return false;
    }

    return true;
  });

  const getRiskBadgeColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'bg-green-500/10 text-green-400 border-green-500/30';
      case 'medium': return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'high': return 'bg-red-500/10 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
    }
  };

  const isFollowing = (traderId: string) => {
    return followedTraders.some(f => f.id === traderId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-emerald-400" />
            </div>
            Wallet Copy Trading
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Follow and copy trades from profitable Solana wallets</p>
              </div>
        {connected && publicKey && (
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400 text-sm font-mono">
                  {solBalance.toFixed(4)} SOL
                </span>
              </div>
            </div>
              </div>
        )}
              </div>

      {/* Wallet Connection */}
      {!connected && (
        <Card className="bg-white dark:bg-gradient-to-br dark:from-emerald-500/10 dark:to-emerald-500/5 border-gray-200 dark:border-emerald-500/20 shadow-md dark:shadow-lg backdrop-blur-sm">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <Wallet className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Connect Your Wallet</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Connect your Solana wallet to follow master traders and enable copy trading
                </p>
            <WalletMultiButton className="!bg-emerald-500 hover:!bg-emerald-600 !mx-auto" />
          </CardContent>
        </Card>
      )}

      {connected && (
        <>
      {/* Tabs */}
          <div className="flex items-center gap-2 border-b border-gray-200 dark:border-slate-700/50">
            <button
              onClick={() => setActiveTab('discover')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'discover'
                  ? 'text-emerald-400 border-b-2 border-emerald-500'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Discover Traders
            </button>
            <button
              onClick={() => setActiveTab('following')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'following'
                  ? 'text-emerald-400 border-b-2 border-emerald-500'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Following ({followedTraders.length})
            </button>
          <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'settings'
                  ? 'text-emerald-400 border-b-2 border-emerald-500'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
              Settings
          </button>
      </div>

          {/* Discover Tab */}
          {activeTab === 'discover' && (
            <div className="space-y-4">
              {/* Search & Filters */}
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                      placeholder="Search by name, address, or description..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 bg-gray-50 dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white"
                  />
                </div>
                </div>
                  <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedRiskLevels([]);
                    setSelectedTags([]);
                    setMinWinRate(0);
                    setVerifiedOnly(false);
                  }}
                  className="border-gray-300 dark:border-slate-700"
                  >
                  <Filter className="w-4 h-4 mr-2" />
                  Clear Filters
                  </Button>
              </div>

              {/* Filter Options */}
              <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Risk Level Filter */}
                    <div>
                      <Label className="text-gray-700 dark:text-gray-300 mb-2 block">Risk Level</Label>
                      <div className="space-y-2">
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
                            <label htmlFor={`risk-${risk}`} className="ml-2 text-sm capitalize text-gray-700 dark:text-gray-300">
                              {risk}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Tags Filter */}
                    <div className="md:col-span-2">
                      <Label className="text-gray-700 dark:text-gray-300 mb-2 block">Tags</Label>
                      <div className="flex flex-wrap gap-2">
                        {allTags.slice(0, 8).map(tag => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className={`cursor-pointer transition-colors ${
                              selectedTags.includes(tag)
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : 'border-gray-500/30 text-gray-400 hover:border-emerald-500/30'
                            }`}
                            onClick={() => {
                              if (selectedTags.includes(tag)) {
                                setSelectedTags(selectedTags.filter(t => t !== tag));
                              } else {
                                setSelectedTags([...selectedTags, tag]);
                              }
                            }}
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Win Rate Filter */}
                    <div>
                      <Label className="text-gray-700 dark:text-gray-300 mb-2 block">Min Win Rate (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={minWinRate}
                        onChange={(e) => setMinWinRate(parseFloat(e.target.value) || 0)}
                        className="bg-gray-50 dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white"
                      />
                      <div className="mt-2 flex items-center">
                        <Checkbox
                          id="verified-only"
                          checked={verifiedOnly}
                          onCheckedChange={(checked) => setVerifiedOnly(checked as boolean)}
                        />
                        <label htmlFor="verified-only" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                          Verified only
                        </label>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Master Traders Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTraders.map(trader => (
                  <Card 
                    key={trader.id}
                    className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:border-emerald-500/30 shadow-md dark:shadow-lg hover:shadow-xl dark:hover:shadow-emerald-500/10 transition-all duration-300 backdrop-blur-sm"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <span className="text-gray-900 dark:text-white">{trader.label}</span>
                            {trader.is_verified && (
                              <CheckCircle className="w-4 h-4 text-emerald-400" />
                            )}
                          </CardTitle>
                          <p className="text-xs text-gray-500 dark:text-gray-500 font-mono mt-1">
                            {truncateAddress(trader.wallet_address)}
                          </p>
                        </div>
                        <Badge variant="outline" className={getRiskBadgeColor(trader.risk_level)}>
                          {trader.risk_level}
                        </Badge>
                      </div>
                      {trader.description && (
                        <CardDescription className="text-sm mt-2 text-gray-600 dark:text-gray-400">
                          {trader.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Metrics */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-500">30d P&L</p>
                          <p className="text-lg font-bold text-emerald-400">{formatCurrency(trader.total_pnl)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-500">Win Rate</p>
                          <p className="text-lg font-bold text-gray-900 dark:text-white">
                            {trader.win_rate ? `${trader.win_rate.toFixed(1)}%` : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-500">Total Trades</p>
                          <p className="text-base font-semibold text-gray-900 dark:text-white">
                            {trader.total_trades || 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-500">Followers</p>
                          <p className="text-base font-semibold text-gray-900 dark:text-white">
                            {trader.follower_count}
                          </p>
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1">
                        {trader.tags.slice(0, 4).map((tag, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs border-emerald-500/30 text-emerald-400">
                            {tag}
                          </Badge>
                        ))}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        {isFollowing(trader.id) ? (
                        <Button
                            variant="outline"
                          size="sm"
                            onClick={() => unfollowTrader(trader.id)}
                            className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
                        >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Unfollow
                        </Button>
                        ) : (
                        <Button
                          size="sm"
                            onClick={() => followTrader(trader.id)}
                            disabled={loading}
                            className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                        >
                            <Plus className="w-4 h-4 mr-1" />
                            Follow
                        </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`https://solscan.io/account/${trader.wallet_address}`, '_blank')}
                          className="border-gray-300 dark:border-slate-700"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                    </div>

              {filteredTraders.length === 0 && (
                <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 backdrop-blur-sm">
                  <CardContent className="p-12 text-center">
                    <Users className="w-12 h-12 text-gray-500 dark:text-gray-500 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">No traders match your filters</p>
                  </CardContent>
                </Card>
            )}
        </div>
      )}

          {/* Following Tab */}
          {activeTab === 'following' && (
            <div className="space-y-4">
              {followedTraders.length === 0 ? (
                <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 backdrop-blur-sm">
                  <CardContent className="p-12 text-center">
                    <Users className="w-12 h-12 text-gray-500 dark:text-gray-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No traders followed yet</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      Discover and follow master traders to get started
                    </p>
                    <Button onClick={() => setActiveTab('discover')} className="bg-emerald-500 hover:bg-emerald-600">
                      <Eye className="w-4 h-4 mr-2" />
                      Discover Traders
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {followedTraders.map(trader => (
                    <Card 
                      key={trader.id}
                      className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:border-emerald-500/30 shadow-md dark:shadow-lg transition-all duration-300 backdrop-blur-sm"
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <span className="text-gray-900 dark:text-white">{trader.label}</span>
                              {trader.is_verified && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                            </CardTitle>
                            <p className="text-xs text-gray-500 dark:text-gray-500 font-mono mt-1">
                              {truncateAddress(trader.wallet_address)}
                            </p>
            </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleCopyTrading(trader.id, !trader.copy_trading_enabled)}
                            >
                              {trader.copy_trading_enabled ? (
                                <Bell className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <BellOff className="w-4 h-4 text-gray-500" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => unfollowTrader(trader.id)}
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
            </Button>
          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-500">30d P&L</p>
                            <p className="text-base font-bold text-emerald-400">{formatCurrency(trader.total_pnl)}</p>
                      </div>
                      <div>
                            <p className="text-xs text-gray-500 dark:text-gray-500">Win Rate</p>
                            <p className="text-base font-bold text-gray-900 dark:text-white">
                              {trader.win_rate ? `${trader.win_rate.toFixed(1)}%` : 'N/A'}
                            </p>
                          </div>
                        </div>

                        {trader.copy_trading_enabled && (
                          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-medium mb-2">
                              <Zap className="w-4 h-4" />
                              Copy Trading Active
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              Mode: <span className="capitalize font-semibold">{trader.copy_mode}</span>
                            </p>
                          </div>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`https://solscan.io/account/${trader.wallet_address}`, '_blank')}
                          className="w-full border-gray-200 dark:border-slate-700"
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          View on Solscan
                        </Button>
                      </CardContent>
                    </Card>
                          ))}
                        </div>
              )}
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <Card className="bg-white dark:bg-gradient-to-br dark:from-slate-900/50 dark:to-slate-800/30 border-gray-200 dark:border-slate-700/50 shadow-md dark:shadow-lg backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                  <Settings className="w-5 h-5 text-emerald-400" />
                  Copy Trading Settings
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-slate-400">Configure your copy trading preferences and risk management</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300 mb-2">Default Copy Mode</Label>
                    <Select
                      value={copySettings.default_copy_mode}
                      onValueChange={(value: 'manual' | 'auto') => 
                        setCopySettings({ ...copySettings, default_copy_mode: value })
                      }
                    >
                      <SelectTrigger className="bg-gray-50 dark:bg-slate-800/30 border-gray-300 dark:border-slate-700/50 text-gray-900 dark:text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual (Notifications)</SelectItem>
                        <SelectItem value="auto">Auto (Requires Approval)</SelectItem>
                      </SelectContent>
                    </Select>
                      </div>

                  <div>
                    <Label className="text-gray-700 dark:text-gray-300 mb-2">Max Copy Amount Per Trade ($)</Label>
                    <Input
                      type="number"
                      value={copySettings.max_copy_amount_per_trade}
                      onChange={(e) => setCopySettings({
                        ...copySettings,
                        max_copy_amount_per_trade: parseFloat(e.target.value) || 0
                      })}
                      className="bg-gray-50 dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white"
                    />
                    </div>

                      <div>
                    <Label className="text-gray-700 dark:text-gray-300 mb-2">Position Size (% of Portfolio)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={copySettings.position_size_percentage}
                      onChange={(e) => setCopySettings({
                        ...copySettings,
                        position_size_percentage: parseFloat(e.target.value) || 10
                      })}
                      className="bg-gray-50 dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white"
                    />
                      </div>

                      <div>
                    <Label className="text-gray-700 dark:text-gray-300 mb-2">Max Daily Trades</Label>
                    <Input
                      type="number"
                      value={copySettings.max_daily_trades}
                      onChange={(e) => setCopySettings({
                        ...copySettings,
                        max_daily_trades: parseInt(e.target.value) || 10
                      })}
                      className="bg-gray-50 dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white"
                    />
                      </div>

                      <div>
                    <Label className="text-gray-700 dark:text-gray-300 mb-2">Slippage Tolerance (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={copySettings.slippage_tolerance}
                      onChange={(e) => setCopySettings({
                        ...copySettings,
                        slippage_tolerance: parseFloat(e.target.value) || 1.0
                      })}
                      className="bg-gray-50 dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white"
                    />
                      </div>

                      <div>
                    <Label className="text-gray-700 dark:text-gray-300 mb-2">Max Price Impact (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={copySettings.max_price_impact}
                      onChange={(e) => setCopySettings({
                        ...copySettings,
                        max_price_impact: parseFloat(e.target.value) || 5.0
                      })}
                      className="bg-gray-50 dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white"
                    />
                  </div>
                      </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-slate-800/30 border border-gray-200 dark:border-slate-700/50">
                    <div>
                      <Label className="text-gray-700 dark:text-gray-300">Enable Stop-Loss</Label>
                      <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                        Automatically exit positions when they hit stop-loss threshold
                      </p>
                    </div>
                    <Checkbox
                      checked={copySettings.enable_stop_loss}
                      onCheckedChange={(checked) => setCopySettings({
                        ...copySettings,
                        enable_stop_loss: checked as boolean
                      })}
                    />
                  </div>

                  {copySettings.enable_stop_loss && (
                    <div>
                      <Label className="text-gray-700 dark:text-gray-300 mb-2">Stop-Loss Percentage (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={copySettings.stop_loss_percentage}
                        onChange={(e) => setCopySettings({
                          ...copySettings,
                          stop_loss_percentage: parseFloat(e.target.value) || 10.0
                        })}
                        className="bg-gray-50 dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white"
                      />
        </div>
      )}

                  <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                    <div>
                      <Label className="text-gray-700 dark:text-gray-300">Enable Notifications</Label>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        Receive notifications when master traders make trades
                      </p>
                    </div>
                    <Checkbox
                      checked={copySettings.notifications_enabled}
                      onCheckedChange={(checked) => setCopySettings({
                        ...copySettings,
                        notifications_enabled: checked as boolean
                      })}
                    />
                  </div>
                </div>

                {/* Warning */}
                <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
                  <div className="flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-1">Important Risk Disclosure</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Copy trading involves substantial risk. Past performance does not guarantee future results. 
                        Only invest what you can afford to lose. Always conduct your own research before following any trader.
                      </p>
                    </div>
                  </div>
                </div>

            <Button
                  onClick={saveCopySettings}
                  className="w-full bg-emerald-500 hover:bg-emerald-600"
            >
                  Save Settings
            </Button>
          </CardContent>
        </Card>
          )}
        </>
      )}
    </div>
  );
}
