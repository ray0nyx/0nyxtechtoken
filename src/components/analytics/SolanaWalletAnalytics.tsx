import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { 
  Wallet, 
  Plus, 
  Trash2, 
  RefreshCw, 
  TrendingUp, 
  Coins, 
  Activity,
  ExternalLink,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { 
  isValidSolanaAddress, 
  saveWalletToTracking, 
  getUserTrackedWallets, 
  removeWalletFromTracking,
  type SolanaWalletData 
} from '@/lib/solana-utils';
import { createClient } from '@/lib/supabase/client';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface TrackedWallet {
  id: string;
  wallet_address: string;
  blockchain: string;
  label: string | null;
  is_active: boolean;
  created_at: string;
}

export function SolanaWalletAnalytics() {
  const [walletAddress, setWalletAddress] = useState('');
  const [walletLabel, setWalletLabel] = useState('');
  const [trackedWallets, setTrackedWallets] = useState<TrackedWallet[]>([]);
  const [walletData, setWalletData] = useState<Record<string, SolanaWalletData>>({});
  const [loading, setLoading] = useState(false);
  const [fetchingWallets, setFetchingWallets] = useState<Set<string>>(new Set());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    loadTrackedWallets();
  }, []);

  const loadTrackedWallets = async () => {
    try {
      const wallets = await getUserTrackedWallets('solana');
      setTrackedWallets(wallets);
      
      // Don't auto-fetch wallet data on load to prevent loops
      // Users can click refresh to fetch data manually
    } catch (error) {
      console.error('Error loading tracked wallets:', error);
      toast({
        title: 'Error',
        description: 'Failed to load tracked wallets',
        variant: 'destructive',
      });
    }
  };

  const fetchWalletData = async (address: string, walletId?: string) => {
    if (fetchingWallets.has(address)) return;
    
    setFetchingWallets(prev => new Set(prev).add(address));
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured. Please check your environment variables.');
      }

      // Try Edge Function first, but fallback to direct RPC if it fails
      let walletData: SolanaWalletData | null = null;
      
      try {
        const response = await fetch(
          `${supabaseUrl}/functions/v1/solana-wallet-analytics`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              walletAddress: address,
              useDevnet: false,
            }),
          }
        );

        if (response.ok) {
          const result = await response.json();
          if (result && result.data) {
            walletData = result.data;
          }
        }
      } catch (edgeError) {
        // Edge Function not available - will use fallback
        console.warn('Edge Function not available, using direct RPC fallback:', edgeError);
      }

      // Fallback: Fetch directly from Solana RPC if Edge Function failed
      if (!walletData) {
        const rpcUrl = 'https://api.mainnet-beta.solana.com';
        
        // Get SOL balance
        const balanceResponse = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getBalance',
            params: [address],
          }),
        });
        const balanceData = await balanceResponse.json();
        const lamports = balanceData.result?.value || 0;
        const sol = lamports / 1e9;

        // Get token accounts
        const tokenResponse = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'getTokenAccountsByOwner',
            params: [
              address,
              { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
              { encoding: 'jsonParsed' },
            ],
          }),
        });
        const tokenData = await tokenResponse.json();
        const tokens = (tokenData.result?.value || []).map((account: any) => {
          const parsedInfo = account.account.data.parsed.info;
          return {
            mint: parsedInfo.mint,
            amount: parsedInfo.tokenAmount.uiAmount || 0,
            decimals: parsedInfo.tokenAmount.decimals,
          };
        });

        // Get transaction count
        const txResponse = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 3,
            method: 'getSignaturesForAddress',
            params: [address, { limit: 10 }],
          }),
        });
        const txData = await txResponse.json();
        const transactions = txData.result || [];

        // Get SOL price
        let solPrice = 100;
        try {
          const priceResponse = await fetch(
            'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
          );
          const priceData = await priceResponse.json();
          solPrice = priceData.solana?.usd || 100;
        } catch (e) {
          console.warn('Failed to fetch SOL price:', e);
        }

        walletData = {
          address,
          balance: {
            sol,
            usdValue: sol * solPrice,
          },
          tokens,
          transactionCount: transactions.length,
          lastTransactionDate: transactions[0]?.blockTime
            ? new Date(transactions[0].blockTime * 1000).toISOString()
            : undefined,
        };

        // Cache the result in Supabase (optional)
        try {
          const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
          await supabase
            .from('wallet_analytics_cache')
            .upsert({
              wallet_address: address,
              blockchain: 'solana',
              data: walletData,
              expires_at: expiresAt,
            }, {
              onConflict: 'wallet_address,blockchain',
            });
        } catch (cacheError) {
          // Cache error is non-critical
          console.warn('Failed to cache wallet data:', cacheError);
        }
      }

      if (walletData) {
        setWalletData(prev => ({
          ...prev,
          [address]: walletData,
        }));
      } else {
        throw new Error('Failed to fetch wallet data from both Edge Function and direct RPC');
      }
    } catch (error: any) {
      console.error('Error fetching wallet data:', error);
      const errorMessage = error?.message || 'Failed to fetch wallet data';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      // Don't set wallet data on error to avoid showing stale data
    } finally {
      setFetchingWallets(prev => {
        const next = new Set(prev);
        next.delete(address);
        return next;
      });
    }
  };

  const handleAddWallet = async () => {
    if (!walletAddress.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a wallet address',
        variant: 'destructive',
      });
      return;
    }

    if (!isValidSolanaAddress(walletAddress.trim())) {
      toast({
        title: 'Error',
        description: 'Invalid Solana wallet address',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    const addressToAdd = walletAddress.trim();
    try {
      await saveWalletToTracking(
        addressToAdd,
        'solana',
        walletLabel.trim() || undefined
      );
      
      toast({
        title: 'Success',
        description: 'Wallet added successfully',
      });
      
      setWalletAddress('');
      setWalletLabel('');
      setIsDialogOpen(false);
      await loadTrackedWallets();
      // Optionally fetch data for the newly added wallet after a short delay
      setTimeout(() => {
        fetchWalletData(addressToAdd);
      }, 500);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add wallet',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveWallet = async (walletId: string) => {
    try {
      await removeWalletFromTracking(walletId);
      toast({
        title: 'Success',
        description: 'Wallet removed successfully',
      });
      await loadTrackedWallets();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove wallet',
        variant: 'destructive',
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatSOL = (value: number) => {
    return `${value.toFixed(4)} SOL`;
  };

  const getSolscanUrl = (address: string) => {
    return `https://solscan.io/account/${address}`;
  };

  return (
    <Card className="rounded-xl border transition-all duration-500 hover:shadow-2xl hover:shadow-purple-500/10 group overflow-hidden bg-transparent dark:bg-gradient-to-br dark:from-slate-900/50 dark:to-slate-800/30 border-gray-200 dark:border-slate-700/50 hover:border-purple-500/30 shadow-lg shadow-purple-500/5 hover:shadow-purple-500/20 backdrop-blur-sm">
      <CardHeader className="group-hover:bg-purple-500/10 transition-colors duration-300 px-6 pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors duration-300">
              <Wallet className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                Solana Wallet Analytics
              </CardTitle>
              <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                Track and analyze your Solana wallet performance
              </p>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Wallet
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Solana Wallet</DialogTitle>
                <DialogDescription>
                  Enter a Solana wallet address to track its analytics
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="wallet-address">Wallet Address</Label>
                  <Input
                    id="wallet-address"
                    placeholder="Enter Solana wallet address..."
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wallet-label">Label (Optional)</Label>
                  <Input
                    id="wallet-label"
                    placeholder="e.g., Main Wallet, Trading Wallet"
                    value={walletLabel}
                    onChange={(e) => setWalletLabel(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={handleAddWallet} 
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Wallet
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        {trackedWallets.length === 0 ? (
          <div className="text-center py-12">
            <Wallet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-slate-400 mb-4">
              No wallets tracked yet. Add your first Solana wallet to get started.
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Wallet
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {trackedWallets.map((wallet) => {
              const data = walletData[wallet.wallet_address];
              const isLoading = fetchingWallets.has(wallet.wallet_address);
              
              return (
                <Card 
                  key={wallet.id}
                  className="border-gray-200 dark:border-slate-700/50 bg-gray-50/50 dark:bg-slate-800/30"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-purple-400" />
                        <div>
                          <CardTitle className="text-sm font-medium">
                            {wallet.label || wallet.wallet_address.slice(0, 8) + '...'}
                          </CardTitle>
                          <p className="text-xs text-gray-500 dark:text-slate-500 font-mono">
                            {wallet.wallet_address}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => fetchWalletData(wallet.wallet_address, wallet.id)}
                          disabled={isLoading}
                        >
                          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveWallet(wallet.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                        <a
                          href={getSolscanUrl(wallet.wallet_address)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button size="sm" variant="ghost">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </a>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="space-y-3">
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                      </div>
                    ) : data ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-500">
                            <Coins className="h-3 w-3" />
                            SOL Balance
                          </div>
                          <div className="text-lg font-semibold text-purple-400">
                            {formatSOL(data.balance.sol)}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-slate-400">
                            {formatCurrency(data.balance.usdValue)}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-500">
                            <Activity className="h-3 w-3" />
                            Tokens
                          </div>
                          <div className="text-lg font-semibold text-blue-400">
                            {data.tokens?.length || 0}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-slate-400">
                            Token holdings
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-500">
                            <TrendingUp className="h-3 w-3" />
                            Transactions
                          </div>
                          <div className="text-lg font-semibold text-green-400">
                            {data.transactionCount || 0}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-slate-400">
                            Recent activity
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-sm text-gray-500 dark:text-slate-500 mb-2">
                          Click refresh to load wallet data
                        </p>
                        <p className="text-xs text-gray-400 dark:text-slate-600">
                          Note: Edge Function must be deployed to fetch data
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export type { SolanaWalletData };

