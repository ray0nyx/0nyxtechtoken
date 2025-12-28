import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Zap,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Clock,
  DollarSign,
  Percent,
  AlertTriangle,
  ExternalLink,
  Copy,
  CheckCircle,
  Filter,
  Layers,
  Droplets,
  Wallet,
  Download
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Connection } from '@solana/web3.js';
import { importDexTradesFromWallet, calculateDexMetrics } from '@/lib/solana-dex-parser';
import { useToast } from '@/components/ui/use-toast';

interface DexTrade {
  id?: string;
  dex: 'jupiter' | 'raydium' | 'orca' | 'meteora';
  token_in: string;
  token_out: string;
  amount_in: number;
  amount_out: number;
  price_impact?: number;
  slippage?: number;
  fee?: number;
  timestamp: string;
  tx_hash: string;
  wallet: string;
}

export default function SolanaDexAnalytics() {
  const navigate = useNavigate();
  const supabase = createClient();
  const { toast } = useToast();
  const { publicKey, connected } = useWallet();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [trades, setTrades] = useState<DexTrade[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDex, setSelectedDex] = useState<string | null>(null);
  const [copiedTx, setCopiedTx] = useState<string | null>(null);
  const [metrics, setMetrics] = useState({
    totalVolume: 0,
    totalTrades: 0,
    avgSlippage: 0,
    totalFees: 0,
    dexBreakdown: {} as Record<string, number>
  });

  const dexes = [
    { id: 'jupiter', name: 'Jupiter', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30' },
    { id: 'raydium', name: 'Raydium', color: 'text-purple-400', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/30' },
    { id: 'orca', name: 'Orca', color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30' },
    { id: 'meteora', name: 'Meteora', color: 'text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/30' }
  ];

  useEffect(() => {
    if (connected && publicKey) {
    fetchData();
    }
  }, [connected, publicKey]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Fetch user's DEX trades from database
      const { data: tradesData, error: tradesError } = await supabase
        .from('dex_trades')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false })
        .limit(100);

      if (!tradesError && tradesData) {
        setTrades(tradesData);
        
        // Calculate metrics
        const calculatedMetrics = calculateDexMetrics(tradesData.map(t => ({
          dex: t.dex,
          tokenIn: t.token_in,
          tokenOut: t.token_out,
          amountIn: parseFloat(t.amount_in),
          amountOut: parseFloat(t.amount_out),
          priceImpact: t.price_impact ? parseFloat(t.price_impact) : undefined,
          slippage: t.slippage ? parseFloat(t.slippage) : undefined,
          fee: t.fee ? parseFloat(t.fee) : undefined,
          timestamp: t.timestamp,
          txHash: t.tx_hash,
          wallet: t.wallet
        })));
        
        setMetrics(calculatedMetrics);
      }
    } catch (error) {
      console.error('Error fetching DEX data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportTrades = async () => {
    if (!connected || !publicKey) {
      toast({
        title: 'Wallet not connected',
        description: 'Please connect your Solana wallet to import trades',
        variant: 'destructive'
      });
      return;
    }

    setIsImporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get RPC endpoint with fallbacks
      const rpcEndpoints = [
        import.meta.env.VITE_SOLANA_RPC_URL,
        import.meta.env.VITE_ALCHEMY_RPC_URL,
        'https://api.mainnet-beta.solana.com',
        'https://rpc.ankr.com/solana',
        'https://solana-api.projectserum.com'
      ].filter(Boolean);
      
      toast({
        title: 'Importing trades...',
        description: 'This may take a moment. Please wait.',
      });

      // Suppress console errors during RPC calls
      const originalError = console.error;
      const originalWarn = console.warn;
      console.error = () => {};
      console.warn = () => {};
      
      // Try each RPC endpoint until one works
      let parsedTrades: any[] = [];
      
      try {
        for (let i = 0; i < rpcEndpoints.length; i++) {
          try {
            const connection = new Connection(rpcEndpoints[i] as string, 'confirmed');
            parsedTrades = await importDexTradesFromWallet(
              connection,
              publicKey.toString(),
              50
            );
            // Success, break out of loop
            break;
          } catch (error: any) {
            const is403 = error?.message?.includes('403') || 
                         error?.message?.includes('Access forbidden') || 
                         error?.code === 403;
            
            if (is403 && i < rpcEndpoints.length - 1) {
              // Try next endpoint
              continue;
            }
            
            // If last endpoint or non-403 error, break and show error
            if (i === rpcEndpoints.length - 1) {
              throw error;
            }
          }
        }
      } finally {
        // Restore console methods
        console.error = originalError;
        console.warn = originalWarn;
      }

      if (!parsedTrades || parsedTrades.length === 0) {
        toast({
          title: 'No trades found',
          description: 'No DEX trades found in your wallet history. This may be due to RPC rate limits. Try again later or configure a custom RPC endpoint.',
        });
        return;
      }

      // Save to database
      const tradesForDb = parsedTrades.map(trade => ({
        user_id: user.id,
        dex: trade.dex,
        token_in: trade.tokenIn,
        token_out: trade.tokenOut,
        amount_in: trade.amountIn,
        amount_out: trade.amountOut,
        price_impact: trade.priceImpact,
        slippage: trade.slippage,
        fee: trade.fee,
        timestamp: trade.timestamp,
        tx_hash: trade.txHash,
        wallet: trade.wallet
      }));

      const { error } = await supabase
        .from('dex_trades')
        .upsert(tradesForDb, {
          onConflict: 'tx_hash',
          ignoreDuplicates: true
        });

      if (error) throw error;

      toast({
        title: 'Success!',
        description: `Imported ${parsedTrades.length} DEX trades`,
      });

      // Refresh data
      await fetchData();
    } catch (error: any) {
      // Check if it's an RPC 403 error
      const isRpcError = error?.message?.includes('403') || 
                        error?.message?.includes('Access forbidden') ||
                        error?.code === 403;
      
      if (isRpcError) {
        toast({
          title: 'RPC Rate Limited',
          description: 'Public RPC endpoints are rate-limited. Please configure a custom RPC endpoint (VITE_SOLANA_RPC_URL) or try again later.',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Import failed',
          description: error.message || 'Failed to import trades',
          variant: 'destructive'
        });
      }
    } finally {
      setIsImporting(false);
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTx(text);
    setTimeout(() => setCopiedTx(null), 2000);
  };

  const truncateAddress = (address: string) => {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Filter trades
  const filteredTrades = trades.filter(trade => {
    if (selectedDex && trade.dex !== selectedDex) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return trade.token_in.toLowerCase().includes(query) ||
             trade.token_out.toLowerCase().includes(query) ||
             trade.tx_hash.toLowerCase().includes(query);
    }
    return true;
  });

  // Empty state component
  const EmptyState = ({ title, description, actionLabel, onAction }: {
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
  }) => (
    <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 shadow-lg shadow-emerald-500/5 backdrop-blur-sm">
      <CardContent className="p-12 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
          <Zap className="w-8 h-8 text-emerald-400" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">{description}</p>
        {actionLabel && onAction && (
          <Button onClick={onAction} className="bg-emerald-500 hover:bg-emerald-600">
            {actionLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-emerald-400" />
            </div>
            Solana DEX Analytics
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Track your trades across Jupiter, Raydium, Orca & Meteora</p>
        </div>
        <div className="flex items-center gap-3">
          {connected && publicKey && (
            <>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400 text-sm font-mono">
                  {truncateAddress(publicKey.toString())}
                </span>
              </div>
              <Button 
                onClick={handleImportTrades}
                disabled={isImporting}
                className="bg-emerald-500 hover:bg-emerald-600"
              >
                <Download className="w-4 h-4 mr-2" />
                {isImporting ? 'Importing...' : 'Import Trades'}
              </Button>
            </>
          )}
          {!connected && (
            <WalletMultiButton className="!bg-emerald-500 hover:!bg-emerald-600" />
          )}
        </div>
      </div>

      {/* Wallet Connection Required */}
      {!connected && (
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 shadow-lg backdrop-blur-sm">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <Wallet className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Connect Your Wallet</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Connect your Solana wallet to import and analyze your DEX trades
            </p>
            <WalletMultiButton className="!bg-emerald-500 hover:!bg-emerald-600 !mx-auto" />
          </CardContent>
        </Card>
      )}

      {connected && (
        <>
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-500" />
            <Input
              placeholder="Search tokens or transaction hash..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/5 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-500"
            />
      </div>

      {/* DEX Filter Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setSelectedDex(null)}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
            selectedDex === null
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/5'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 dark:hover:bg-slate-800/30'
          }`}
        >
          All DEXs
        </button>
        {dexes.map(dex => (
          <button
            key={dex.id}
            onClick={() => setSelectedDex(dex.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 flex items-center gap-2 ${
              selectedDex === dex.id
                    ? `${dex.bgColor} ${dex.color} border ${dex.borderColor} shadow-lg`
                    : 'text-gray-400 hover:text-white hover:bg-white/5 dark:hover:bg-slate-800/30'
            }`}
          >
            {dex.name}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
        </div>
          ) : filteredTrades.length === 0 && trades.length === 0 ? (
        <div className="space-y-6">
          {/* Overview Stats - Empty State */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 shadow-lg shadow-emerald-500/5 hover:shadow-emerald-500/20 backdrop-blur-sm transition-all duration-300">
              <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                        <DollarSign className="w-4 h-4 text-emerald-400" />
                      </div>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">Total Volume (24h)</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">$0</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">No trades yet</p>
              </CardContent>
            </Card>

                <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20 shadow-lg shadow-blue-500/5 hover:shadow-blue-500/20 backdrop-blur-sm transition-all duration-300">
              <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <Activity className="w-4 h-4 text-blue-400" />
                      </div>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">Total Trades</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">0</p>
                    <p className="text-xs text-gray-500 dark:text-slate-500">Import your trades</p>
              </CardContent>
            </Card>

                <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20 shadow-lg shadow-purple-500/5 hover:shadow-purple-500/20 backdrop-blur-sm transition-all duration-300">
              <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <Percent className="w-4 h-4 text-purple-400" />
                      </div>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">Avg Slippage</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">—</p>
                    <p className="text-xs text-gray-500 dark:text-slate-500">No data</p>
              </CardContent>
            </Card>

                <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20 shadow-lg shadow-amber-500/5 hover:shadow-amber-500/20 backdrop-blur-sm transition-all duration-300">
              <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                        <Droplets className="w-4 h-4 text-amber-400" />
                      </div>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">Total Fees Paid</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">$0</p>
                    <p className="text-xs text-gray-500 dark:text-slate-500">No fees tracked</p>
              </CardContent>
            </Card>
          </div>

          {/* Empty State */}
          <EmptyState
            title="No DEX Trades Found"
                description="Import your DEX trade history from your connected Solana wallet to see analytics for Jupiter, Raydium, Orca, and Meteora."
            actionLabel="Import Trades"
                onAction={handleImportTrades}
          />
                    </div>
          ) : (
            <>
              {/* Overview Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 shadow-lg shadow-emerald-500/5 hover:shadow-emerald-500/20 backdrop-blur-sm transition-all duration-300">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                        <DollarSign className="w-4 h-4 text-emerald-400" />
                  </div>
                    </div>
                    <p className="text-gray-600 dark:text-slate-400 text-xs mb-1">Total Volume</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(metrics.totalVolume)}
                </p>
              </CardContent>
            </Card>

                <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20 shadow-lg shadow-blue-500/5 hover:shadow-blue-500/20 backdrop-blur-sm transition-all duration-300">
              <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <Activity className="w-4 h-4 text-blue-400" />
                      </div>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">Total Trades</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{metrics.totalTrades}</p>
              </CardContent>
            </Card>

                <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20 shadow-lg shadow-purple-500/5 hover:shadow-purple-500/20 backdrop-blur-sm transition-all duration-300">
              <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <Percent className="w-4 h-4 text-purple-400" />
                      </div>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">Avg Slippage</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {metrics.avgSlippage.toFixed(2)}%
                </p>
              </CardContent>
            </Card>

                <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20 shadow-lg shadow-amber-500/5 hover:shadow-amber-500/20 backdrop-blur-sm transition-all duration-300">
              <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                        <Droplets className="w-4 h-4 text-amber-400" />
                      </div>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">Total Fees Paid</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {metrics.totalFees.toFixed(4)} SOL
                </p>
              </CardContent>
            </Card>
          </div>

              {/* Trades List */}
              <Card className="bg-gradient-to-br from-slate-900/50 to-slate-800/30 border-slate-700/50 shadow-lg backdrop-blur-sm">
            <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" />
                    DEX Trades {selectedDex && `(${dexes.find(d => d.id === selectedDex)?.name})`}
              </CardTitle>
                  <CardDescription className="text-gray-600 dark:text-slate-400">
                    {filteredTrades.length} trades found
                  </CardDescription>
            </CardHeader>
            <CardContent>
                  {filteredTrades.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-600 dark:text-gray-400">No trades found matching your filters</p>
                    </div>
                  ) : (
              <div className="space-y-3">
                      {filteredTrades.slice(0, 20).map((trade, index) => {
                        const dexInfo = dexes.find(d => d.id === trade.dex);
                        return (
                    <div
                            key={trade.id || index}
                            className="flex items-center justify-between p-4 rounded-xl bg-white/5 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-white/10 dark:hover:bg-slate-700 hover:border-emerald-500/30 transition-all duration-300"
                    >
                            <div className="flex items-center gap-4 flex-1">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${dexInfo?.bgColor || 'bg-gray-500/10'}`}>
                                <ArrowDownRight className={`w-5 h-5 ${dexInfo?.color || 'text-gray-400'}`} />
                        </div>
                              <div className="flex-1">
                          <div className="flex items-center gap-2">
                                  <span className="font-semibold text-gray-900 dark:text-white">
                                    {truncateAddress(trade.token_in)} → {truncateAddress(trade.token_out)}
                            </span>
                                  <Badge variant="outline" className={`text-xs ${dexInfo?.borderColor || 'border-gray-500/30'} ${dexInfo?.color || 'text-gray-400'}`}>
                                    {dexInfo?.name || trade.dex}
                            </Badge>
                          </div>
                                <div className="flex items-center gap-3 mt-1">
                                  <p className="text-gray-500 dark:text-gray-500 text-sm">
                                    {trade.amount_in.toFixed(4)} in → {trade.amount_out.toFixed(4)} out
                                  </p>
                                  {trade.fee && (
                                    <p className="text-gray-500 dark:text-gray-500 text-xs">
                                      Fee: {trade.fee.toFixed(6)} SOL
                                    </p>
                                  )}
                          </div>
                        </div>
                      </div>
                            <div className="flex items-center gap-3">
                      <div className="text-right">
                                <p className="text-gray-600 dark:text-gray-400 text-sm">
                                  {formatTime(trade.timestamp)}
                                </p>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(trade.tx_hash)}
                                  className="text-xs p-0 h-auto hover:bg-transparent"
                          >
                                  {copiedTx === trade.tx_hash ? (
                                    <CheckCircle className="w-3 h-3 text-emerald-400" />
                            ) : (
                                    <Copy className="w-3 h-3 text-gray-500" />
                            )}
                                </Button>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(`https://solscan.io/tx/${trade.tx_hash}`, '_blank')}
                                className="p-2"
                          >
                                <ExternalLink className="w-4 h-4 text-gray-500" />
                              </Button>
                        </div>
                      </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* DEX Breakdown */}
              {Object.keys(metrics.dexBreakdown).length > 0 && (
                <Card className="bg-gradient-to-br from-slate-900/50 to-slate-800/30 border-slate-700/50 shadow-lg backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-gray-900 dark:text-white">DEX Breakdown</CardTitle>
                    <CardDescription className="text-gray-600 dark:text-gray-400">
                      Trade distribution across different DEXs
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {Object.entries(metrics.dexBreakdown).map(([dex, count]) => {
                        const dexInfo = dexes.find(d => d.id === dex);
                        const percentage = (count / metrics.totalTrades) * 100;
                        return (
                          <div key={dex} className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${dexInfo?.bgColor}`} />
                                <span className={`${dexInfo?.color || 'text-gray-400'} font-medium`}>{dexInfo?.name || dex}</span>
                              </div>
                              <span className="text-gray-900 dark:text-white font-medium">{count} trades ({percentage.toFixed(1)}%)</span>
                            </div>
                            <div className="h-2 bg-white/10 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${dexInfo?.bgColor || 'bg-gray-500'} rounded-full transition-all duration-500`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
              </div>
            </CardContent>
          </Card>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
