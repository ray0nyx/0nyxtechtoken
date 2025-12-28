import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { 
  Wallet, 
  Plus, 
  Trash2, 
  Bitcoin,
  Zap,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  ExternalLink
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface TrackedWallet {
  id: string;
  wallet_address: string;
  blockchain: 'solana' | 'bitcoin';
  label: string;
  is_active: boolean;
  created_at: string;
}

interface WalletManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onWalletsUpdated?: () => void;
}

export default function WalletManager({ isOpen, onClose, onWalletsUpdated }: WalletManagerProps) {
  const supabase = createClient();
  const { toast } = useToast();
  
  const [wallets, setWallets] = useState<TrackedWallet[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAddingWallet, setIsAddingWallet] = useState(false);
  
  // Form state
  const [newWalletAddress, setNewWalletAddress] = useState('');
  const [newWalletLabel, setNewWalletLabel] = useState('');
  const [newWalletBlockchain, setNewWalletBlockchain] = useState<'solana' | 'bitcoin'>('solana');

  useEffect(() => {
    if (isOpen) {
      fetchWallets();
    }
  }, [isOpen]);

  const fetchWallets = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('wallet_tracking')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWallets(data || []);
    } catch (error) {
      console.error('Error fetching wallets:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch wallets',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const validateWalletAddress = (address: string, blockchain: 'solana' | 'bitcoin'): boolean => {
    if (blockchain === 'solana') {
      // Solana addresses are base58 and typically 32-44 characters
      return address.length >= 32 && address.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(address);
    } else {
      // Bitcoin addresses can be various formats (P2PKH, P2SH, Bech32)
      // Basic validation: starts with 1, 3, or bc1 and appropriate length
      return /^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address);
    }
  };

  const handleAddWallet = async () => {
    if (!newWalletAddress.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a wallet address',
        variant: 'destructive'
      });
      return;
    }

    if (!validateWalletAddress(newWalletAddress.trim(), newWalletBlockchain)) {
      toast({
        title: 'Invalid Address',
        description: `Please enter a valid ${newWalletBlockchain} wallet address`,
        variant: 'destructive'
      });
      return;
    }

    setIsAddingWallet(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('wallet_tracking')
        .insert({
          user_id: user.id,
          wallet_address: newWalletAddress.trim(),
          blockchain: newWalletBlockchain,
          label: newWalletLabel.trim() || `${newWalletBlockchain === 'solana' ? 'Solana' : 'Bitcoin'} Wallet ${wallets.length + 1}`,
          is_active: true
        });

      if (error) {
        if (error.code === '23505') {
          throw new Error('This wallet is already being tracked');
        }
        throw error;
      }

      toast({
        title: 'Success',
        description: 'Wallet added successfully',
      });

      // Reset form
      setNewWalletAddress('');
      setNewWalletLabel('');
      
      // Refresh list
      await fetchWallets();
      
      // Notify parent
      if (onWalletsUpdated) {
        onWalletsUpdated();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add wallet',
        variant: 'destructive'
      });
    } finally {
      setIsAddingWallet(false);
    }
  };

  const handleDeleteWallet = async (walletId: string) => {
    try {
      const { error } = await supabase
        .from('wallet_tracking')
        .delete()
        .eq('id', walletId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Wallet removed successfully',
      });

      await fetchWallets();
      
      if (onWalletsUpdated) {
        onWalletsUpdated();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove wallet',
        variant: 'destructive'
      });
    }
  };

  const handleToggleWallet = async (walletId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('wallet_tracking')
        .update({ is_active: !currentStatus })
        .eq('id', walletId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Wallet ${!currentStatus ? 'enabled' : 'disabled'}`,
      });

      await fetchWallets();
      
      if (onWalletsUpdated) {
        onWalletsUpdated();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update wallet status',
        variant: 'destructive'
      });
    }
  };

  const truncateAddress = (address: string) => {
    if (!address || address.length < 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-400" />
            Manage Crypto Wallets
          </DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-slate-400">
            Add multiple Solana and Bitcoin wallet addresses to aggregate your crypto analytics
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Add Wallet Form */}
          <Card className="bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="text-lg text-gray-900 dark:text-white">Add New Wallet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-700 dark:text-slate-300">Blockchain</Label>
                  <Select
                    value={newWalletBlockchain}
                    onValueChange={(value: 'solana' | 'bitcoin') => setNewWalletBlockchain(value)}
                  >
                    <SelectTrigger className="bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="solana">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-emerald-400" />
                          Solana
                        </div>
                      </SelectItem>
                      <SelectItem value="bitcoin">
                        <div className="flex items-center gap-2">
                          <Bitcoin className="w-4 h-4 text-amber-400" />
                          Bitcoin
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-gray-700 dark:text-slate-300">Label (Optional)</Label>
                  <Input
                    placeholder="e.g., Main Trading Wallet"
                    value={newWalletLabel}
                    onChange={(e) => setNewWalletLabel(e.target.value)}
                    className="bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div>
                <Label className="text-gray-700 dark:text-slate-300">Wallet Address</Label>
                <Input
                  placeholder={newWalletBlockchain === 'solana' ? 'Enter Solana wallet address...' : 'Enter Bitcoin wallet address...'}
                  value={newWalletAddress}
                  onChange={(e) => setNewWalletAddress(e.target.value)}
                  className="bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-slate-500 font-mono"
                />
              </div>

              <Button
                onClick={handleAddWallet}
                disabled={isAddingWallet || !newWalletAddress.trim()}
                className="w-full bg-emerald-500 hover:bg-emerald-600"
              >
                {isAddingWallet ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Wallet
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Wallets List */}
          <Card className="bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="text-lg text-gray-900 dark:text-white">Tracked Wallets ({wallets.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                </div>
              ) : wallets.length === 0 ? (
                <div className="text-center py-8">
                  <Wallet className="w-12 h-12 text-gray-400 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-gray-600 dark:text-slate-400">No wallets added yet</p>
                  <p className="text-gray-500 dark:text-slate-500 text-sm mt-1">Add your first wallet to start tracking</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {wallets.map((wallet) => (
                    <div 
                      key={wallet.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-white dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          wallet.blockchain === 'solana' 
                            ? 'bg-emerald-500/10' 
                            : 'bg-amber-500/10'
                        }`}>
                          {wallet.blockchain === 'solana' ? (
                            <Zap className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <Bitcoin className="w-5 h-5 text-amber-400" />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-gray-900 dark:text-white truncate">{wallet.label}</p>
                            <Badge variant="outline" className={`text-xs capitalize ${
                              wallet.blockchain === 'solana'
                                ? 'border-emerald-500/30 text-emerald-400'
                                : 'border-amber-500/30 text-amber-400'
                            }`}>
                              {wallet.blockchain}
                            </Badge>
                            {wallet.is_active ? (
                              <Badge variant="outline" className="text-xs border-green-500/30 text-green-400">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs border-gray-500/30 text-gray-400">
                                <XCircle className="w-3 h-3 mr-1" />
                                Disabled
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-slate-400 font-mono truncate">
                            {truncateAddress(wallet.wallet_address)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (wallet.blockchain === 'solana') {
                              window.open(`https://solscan.io/account/${wallet.wallet_address}`, '_blank');
                            } else {
                              window.open(`https://blockstream.info/address/${wallet.wallet_address}`, '_blank');
                            }
                          }}
                          className="text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                          title={`View on ${wallet.blockchain === 'solana' ? 'Solscan' : 'Blockstream'}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleWallet(wallet.id, wallet.is_active)}
                          className="text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                        >
                          {wallet.is_active ? 'Disable' : 'Enable'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteWallet(wallet.id)}
                          className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end mt-4">
          <Button
            onClick={onClose}
            variant="outline"
            className="border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-800"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

