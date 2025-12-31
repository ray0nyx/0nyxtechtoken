import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, ChevronDown, Wallet as WalletIcon, Edit, Check, Trash2, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import WalletManager from '@/components/crypto/WalletManager';
import { createClient } from '@/lib/supabase/client';
import { useTheme } from '@/components/ThemeProvider';
import { cn } from '@/lib/utils';
import {
  fetchUserTrackedWallets,
  fetchTokenPrices,
  type WalletBalance,
  type TokenPrice
} from '@/lib/wallet-balance-service';
import { TurnkeyWalletProvider, useTurnkeyWallet } from '@/lib/wallet-abstraction/TurnkeyWalletContext';
import { useAuth } from '@/hooks/useAuth';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { useToast } from '@/components/ui/use-toast';
import { Copy } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth-utils';
import { syncAllTrackedWallets, getSyncStatus } from '@/lib/services/walletTradeSyncService';

interface WalletItem {
  id: string;
  address: string;
  label: string;
  blockchain: 'solana' | 'bitcoin';
  totalUsdValue: number;
  change24h: number;
  sparklineData: number[];
}



function WalletsContent() {
  const navigate = useNavigate();
  const supabase = createClient();
  const { theme } = useTheme();
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const { createWallet: createTurnkeyWallet, loading: turnkeyLoading } = useTurnkeyWallet();
  const { user } = useAuth();
  const { toast } = useToast();
  const { publicKey, connected } = useWallet();

  const [isLoading, setIsLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<'24h' | '7d' | '30d'>('24h');
  const [totalBalance, setTotalBalance] = useState(0);
  const [totalChange, setTotalChange] = useState(0);
  const [wallets, setWallets] = useState<WalletItem[]>([]);
  const [showWalletManager, setShowWalletManager] = useState(false);
  const [editingWalletAddress, setEditingWalletAddress] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [mainWalletAddress, setMainWalletAddress] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<{ totalSolanaTrades: number; lastSyncAt: string | null } | null>(null);

  // Load main wallet from localStorage on mount
  useEffect(() => {
    const savedMainWallet = localStorage.getItem('main_wallet_address');
    if (savedMainWallet) {
      setMainWalletAddress(savedMainWallet);
    }
  }, []);


  // Auto-sync wallet trades on mount and when user changes
  useEffect(() => {
    const autoSyncTrades = async () => {
      if (user?.id) {
        try {
          // Sync trades silently in the background
          await syncAllTrackedWallets(user.id);
          // Update sync status
          const status = await getSyncStatus(user.id);
          setSyncStatus(status);
        } catch (error) {
          console.error('Auto-sync trades failed:', error);
        }
      }
    };
    autoSyncTrades();
  }, [user?.id]);

  // Handler to rename a wallet and save to Supabase
  const handleRenameWallet = async (walletAddress: string, newLabel: string) => {
    if (!user?.id || !newLabel.trim()) {
      setEditingWalletAddress(null);
      return;
    }

    try {
      // Update in Supabase
      const { error } = await supabase
        .from('wallet_tracking')
        .update({ label: newLabel.trim() })
        .eq('user_id', user.id)
        .eq('wallet_address', walletAddress);

      if (error) {
        console.error('Error renaming wallet:', error);
        toast({
          title: 'Error',
          description: 'Failed to rename wallet. Please try again.',
          variant: 'destructive',
        });
      } else {
        // Update local state
        setWallets(prev => prev.map(w =>
          w.address === walletAddress ? { ...w, label: newLabel.trim() } : w
        ));
        toast({
          title: 'Saved!',
          description: 'Wallet name updated successfully.',
        });
      }
    } catch (err) {
      console.error('Error renaming wallet:', err);
    }

    setEditingWalletAddress(null);
  };

  // Handler to delete a wallet from tracking
  const handleDeleteWallet = async (walletAddress: string) => {
    if (!user?.id) return;

    // Prevent deletion of main wallet
    if (walletAddress === mainWalletAddress) {
      toast({
        title: 'Cannot Delete Main Wallet',
        description: 'You cannot delete your main wallet. Please set another wallet as main first.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('wallet_tracking')
        .delete()
        .eq('user_id', user.id)
        .eq('wallet_address', walletAddress);

      if (error) {
        console.error('Error deleting wallet:', error);
        toast({
          title: 'Error',
          description: 'Failed to delete wallet. Please try again.',
          variant: 'destructive',
        });
      } else {
        // Remove from local state
        setWallets(prev => prev.filter(w => w.address !== walletAddress));
        toast({
          title: 'Deleted',
          description: 'Wallet removed successfully.',
        });
      }
    } catch (err) {
      console.error('Error deleting wallet:', err);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    loadWalletData();
  }, [timePeriod]);

  // Auto-track connected Solana wallets
  useEffect(() => {
    const trackConnectedWallet = async () => {
      if (connected && publicKey && user) {
        const walletAddress = publicKey.toBase58();

        try {
          // Check if wallet is already tracked
          const { data: existing } = await supabase
            .from('wallet_tracking')
            .select('id')
            .eq('user_id', user.id)
            .eq('wallet_address', walletAddress)
            .maybeSingle();

          if (!existing) {
            // Add to tracking
            await supabase
              .from('wallet_tracking')
              .insert({
                user_id: user.id,
                wallet_address: walletAddress,
                blockchain: 'solana',
                label: 'Connected Wallet',
                is_active: true,
              });

            // Reload wallet data to show the new wallet
            loadWalletData();
          }
        } catch (error) {
          console.error('Error tracking connected wallet:', error);
        }
      }
    };

    trackConnectedWallet();
  }, [connected, publicKey, user]);


  const loadWalletData = async () => {
    setIsLoading(true);
    try {
      // Support both Supabase and SIWS wallet auth
      const authUser = await getCurrentUser();
      if (!authUser) {
        console.log('Wallets: No authenticated user found');
        setIsLoading(false);
        return;
      }

      const userId = authUser.id;
      const isWalletUser = authUser.isWalletUser;
      console.log('Wallets: Loading data for user:', userId, 'isWalletUser:', isWalletUser);

      // Fetch tracked wallets - use API for SIWS users (bypasses RLS)
      let walletBalances: WalletBalance[] = [];

      if (isWalletUser) {
        // Use Edge Function API for SIWS users
        const { getWalletsViaAPI } = await import('@/lib/wallet-api');
        const result = await getWalletsViaAPI(userId);

        if (result.error) {
          console.error('Error fetching wallets via API:', result.error);
        } else if (result.wallets && result.wallets.length > 0) {
          console.log('Wallets fetched via API:', result.wallets);

          // Fetch balances for each wallet
          const { fetchSolanaWalletBalance, fetchBitcoinWalletBalance } = await import('@/lib/wallet-balance-service');

          walletBalances = await Promise.all(
            result.wallets.map(async (wallet: any) => {
              try {
                let balance: WalletBalance | null = null;
                if (wallet.blockchain === 'solana') {
                  balance = await fetchSolanaWalletBalance(wallet.wallet_address);
                } else if (wallet.blockchain === 'bitcoin') {
                  balance = await fetchBitcoinWalletBalance(wallet.wallet_address);
                }

                if (balance) {
                  return { ...balance, label: wallet.label };
                }

                return {
                  address: wallet.wallet_address,
                  blockchain: wallet.blockchain as 'solana' | 'bitcoin',
                  balances: {},
                  totalUsdValue: 0,
                  label: wallet.label,
                };
              } catch (error) {
                console.error(`Error fetching balance for ${wallet.wallet_address}:`, error);
                return {
                  address: wallet.wallet_address,
                  blockchain: wallet.blockchain as 'solana' | 'bitcoin',
                  balances: {},
                  totalUsdValue: 0,
                  label: wallet.label,
                };
              }
            })
          );
        }
      } else {
        // Use direct Supabase for regular users
        walletBalances = await Promise.race([
          fetchUserTrackedWallets(userId),
          new Promise<Array<WalletBalance>>((resolve) => setTimeout(() => resolve([]), 10000))
        ]);
      }

      if (walletBalances.length === 0) {
        console.log('Wallets: No wallets found');
        setWallets([]);
        setTotalBalance(0);
        setTotalChange(0);
        setIsLoading(false);
        return;
      }

      console.log('Wallets: Found', walletBalances.length, 'wallets');

      // Calculate total for all wallets
      let totalUsdValue = 0;
      walletBalances.forEach(wallet => {
        totalUsdValue += wallet.totalUsdValue;
      });

      // Get unique coin IDs to fetch price changes
      const allSymbols = new Set<string>();
      walletBalances.forEach(wallet => {
        Object.keys(wallet.balances).forEach(symbol => allSymbols.add(symbol));
      });

      const symbolToId: Record<string, string> = {
        'BTC': 'bitcoin',
        'SOL': 'solana',
        'ETH': 'ethereum',
        'ADA': 'cardano',
        'USDT': 'tether',
        'USDC': 'usd-coin',
      };
      const coinIds = Array.from(allSymbols).map(s => symbolToId[s] || s.toLowerCase());

      // Fetch real prices from CoinGecko to get 24h change
      const prices = await Promise.race<[Promise<Record<string, TokenPrice>>, Promise<Record<string, TokenPrice>>]>([
        fetchTokenPrices(coinIds),
        new Promise<Record<string, TokenPrice>>((resolve) => {
          setTimeout(() => resolve({}), 5000);
        })
      ]);

      // Build wallet list with per-wallet data
      const walletList: WalletItem[] = walletBalances.map((wallet, index) => {
        // Calculate weighted average change for this wallet
        let walletChange = 0;
        if (wallet.totalUsdValue > 0) {
          Object.entries(wallet.balances).forEach(([symbol, balance]) => {
            const priceData = prices[symbol];
            const weight = balance.usdValue / wallet.totalUsdValue;
            const change = priceData?.change24h || 0;
            walletChange += change * weight;
          });
        }

        // Simple sparkline based on current value (will be updated in background if needed)
        const simpleSparkline = Array.from({ length: 24 }, () => wallet.totalUsdValue);

        return {
          id: `wallet-${index}`,
          address: wallet.address,
          label: wallet.label || (wallet.blockchain === 'solana' ? 'Solana Wallet' : 'Bitcoin Wallet'),
          blockchain: wallet.blockchain,
          totalUsdValue: wallet.totalUsdValue,
          change24h: walletChange,
          sparklineData: simpleSparkline,
        };
      });

      // Sort by USD value (descending)
      walletList.sort((a, b) => b.totalUsdValue - a.totalUsdValue);

      // Calculate total change (weighted average across all wallets)
      let totalChange = 0;
      if (walletList.length > 0 && totalUsdValue > 0) {
        walletList.forEach(wallet => {
          if (wallet.totalUsdValue > 0 && !isNaN(wallet.change24h) && isFinite(wallet.change24h)) {
            const weight = wallet.totalUsdValue / totalUsdValue;
            totalChange += wallet.change24h * weight;
          }
        });
      }

      setWallets(walletList);
      setTotalBalance(totalUsdValue);
      setTotalChange(totalChange);

      // Auto-set first Turnkey wallet as main wallet if none is set
      const savedMainWallet = localStorage.getItem('main_wallet_address');
      if (!savedMainWallet && walletList.length > 0) {
        // Prefer the wallet labeled "Main Wallet" (created by Turnkey on account creation)
        const turnkeyWallet = walletList.find(w => w.label === 'Main Wallet');
        const defaultMainWallet = turnkeyWallet || walletList[0];
        localStorage.setItem('main_wallet_address', defaultMainWallet.address);
        setMainWalletAddress(defaultMainWallet.address);
      }

      setIsLoading(false);

    } catch (error) {
      console.error('Error loading wallet data:', error);
      setWallets([]);
      setTotalBalance(0);
      setTotalChange(0);
      setIsLoading(false);
    }
  };

  const handleCreateTurnkeyWallet = async () => {
    if (!user?.email) return;

    try {
      const walletAddress = await createTurnkeyWallet(user.email);

      // Show success notification with address
      toast({
        title: '✅ Wallet Created Successfully!',
        description: (
          <div className="space-y-2">
            <p className="text-sm">Your new Solana wallet address:</p>
            <div className="flex items-center gap-2 bg-black/20 p-2 rounded">
              <code className="text-xs flex-1 break-all">{walletAddress}</code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  navigator.clipboard.writeText(walletAddress);
                  toast({
                    title: 'Copied!',
                    description: 'Wallet address copied to clipboard',
                  });
                }}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ),
        duration: 10000,
      });

      // Reload wallet lists to show the new wallet with balance
      // Small delay to ensure DB commit is complete
      await new Promise(resolve => setTimeout(resolve, 500));
      await loadWalletData();
    } catch (error: any) {
      console.error("Failed to create wallet", error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to create wallet. Please try again.',
        variant: 'destructive',
      });
    }
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

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className={cn(
                    isDark ? "bg-[#27272a] hover:bg-[#3f3f46] text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-900",
                    "border border-transparent"
                  )}
                >
                  Create
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className={cn(
                isDark ? "bg-[#1a1f2e] border-white/10" : "bg-white border-gray-200"
              )}>
                <DropdownMenuItem
                  onClick={handleCreateTurnkeyWallet}
                  disabled={turnkeyLoading}
                  className="cursor-pointer"
                >
                  <WalletIcon className="w-4 h-4 mr-2" />
                  Wallet {turnkeyLoading && "(Creating...)"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <WalletMultiButton className={cn(
              "!bg-[#3b82f6] hover:!bg-[#2563eb] !h-10 !px-4 !py-2 !rounded-md !text-sm !font-medium"
            )}>
              Connect Wallets
            </WalletMultiButton>
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
          <span>Wallet</span>
          <span>Amount</span>
          <span className="text-center">24h Change</span>
          <span className="text-right">Chart</span>
        </div>

        {/* Wallet Rows */}
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
          ) : wallets.length === 0 ? (
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
              )}>No wallets found</p>
              <p className="text-sm">Create or connect a wallet to start tracking</p>
              <Button
                onClick={() => setShowWalletManager(true)}
                className="mt-4 bg-[#3b82f6] hover:bg-[#2563eb]"
              >
                Create Wallet
              </Button>
            </div>
          ) : (
            wallets.map((wallet) => (
              <div
                key={wallet.id}
                className={cn(
                  "group grid grid-cols-1 md:grid-cols-4 gap-4 p-4 md:p-6 items-center hover:bg-white/5 transition-colors cursor-pointer",
                  isDark ? "hover:bg-white/5" : "hover:bg-gray-50"
                )}
              >
                {/* Wallet Info */}
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    wallet.blockchain === 'solana' ? "bg-purple-500/20" : "bg-orange-500/20"
                  )}>
                    <WalletIcon className={cn(
                      "w-5 h-5",
                      wallet.blockchain === 'solana' ? "text-purple-400" : "text-orange-400"
                    )} />
                  </div>
                  <div>
                    {/* Editable wallet label */}
                    {editingWalletAddress === wallet.address ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingLabel}
                          onChange={(e) => setEditingLabel(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleRenameWallet(wallet.address, editingLabel);
                            } else if (e.key === 'Escape') {
                              setEditingWalletAddress(null);
                            }
                          }}
                          className={cn(
                            "bg-transparent border-b text-sm font-medium w-32 focus:outline-none",
                            isDark ? "border-white/30 text-white" : "border-gray-300 text-gray-900"
                          )}
                          autoFocus
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRenameWallet(wallet.address, editingLabel);
                          }}
                          className="text-green-400 hover:text-green-300 transition-colors"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {/* Main wallet indicator */}
                        {mainWalletAddress === wallet.address && (
                          <div className="w-4 h-4 rounded-full bg-yellow-400 flex items-center justify-center">
                            <Check className="w-3 h-3 text-black" />
                          </div>
                        )}
                        <p className={cn(
                          "font-medium",
                          isDark ? "text-white" : "text-gray-900"
                        )}>
                          {wallet.label}
                        </p>
                        {/* Only show edit/delete buttons for non-main wallets */}
                        {mainWalletAddress !== wallet.address && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingWalletAddress(wallet.address);
                                setEditingLabel(wallet.label);
                              }}
                              className={cn(
                                "opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity",
                                isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"
                              )}
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteWallet(wallet.address);
                              }}
                              className={cn(
                                "opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity",
                                isDark ? "text-gray-400 hover:text-red-400" : "text-gray-500 hover:text-red-500"
                              )}
                              title={(publicKey && wallet.address === publicKey.toBase58()) ? 'Unlink wallet' : 'Delete wallet'}
                            >
                              {(publicKey && wallet.address === publicKey.toBase58()) ? (
                                <X className="w-3 h-3" />
                              ) : (
                                <Trash2 className="w-3 h-3" />
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    <p className={cn(
                      "text-xs flex items-center gap-1",
                      isDark ? "text-gray-500" : "text-gray-500"
                    )}>
                      <span>{wallet.address.slice(0, 4)}...{wallet.address.slice(-4)}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(wallet.address);
                          toast({
                            title: 'Copied!',
                            description: 'Wallet address copied to clipboard',
                          });
                        }}
                        className="hover:text-white transition-colors"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </p>
                  </div>
                </div>

                {/* Amount (Total USD Value) */}
                <div className="md:text-left">
                  <p className={cn(
                    "font-semibold text-lg",
                    isDark ? "text-white" : "text-gray-900"
                  )}>
                    ${wallet.totalUsdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>

                {/* 24h Change */}
                <div className="md:text-center">
                  <span className={cn(
                    "inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium",
                    wallet.change24h >= 0
                      ? "bg-[#10b981]/20 text-[#10b981]"
                      : "bg-[#ef4444]/20 text-[#ef4444]"
                  )}>
                    {wallet.change24h >= 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    {isNaN(wallet.change24h) || !isFinite(wallet.change24h)
                      ? '0.00'
                      : `${wallet.change24h >= 0 ? '+' : ''}${wallet.change24h.toFixed(2)}`
                    }%
                  </span>
                </div>

                {/* Mini Sparkline Chart */}
                <div className="md:flex md:justify-end">
                  <div className="w-24 h-8">
                    <svg className="w-full h-full" viewBox="0 0 100 32">
                      <polyline
                        fill="none"
                        stroke={wallet.change24h >= 0 ? "#10b981" : "#ef4444"}
                        strokeWidth="2"
                        points={wallet.sparklineData.map((val, i) => {
                          const min = Math.min(...wallet.sparklineData);
                          const max = Math.max(...wallet.sparklineData);
                          const range = max - min || 1;
                          const x = (i / (wallet.sparklineData.length - 1)) * 100;
                          const y = 32 - ((val - min) / range) * 28 - 2;
                          return `${x},${y}`;
                        }).join(' ')}
                      />
                    </svg>
                  </div>
                </div>
              </div>
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

export default function CryptoWallets() {
  return (
    <TurnkeyWalletProvider>
      <WalletsContent />
    </TurnkeyWalletProvider>
  );
}
