import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Play,
  Pause,
  X,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  DollarSign,
  Target,
  Activity,
  Settings,
  Users,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/crypto-aggregation-service';
import CopyTradingLeaderboard from '@/components/crypto/CopyTradingLeaderboard';
import CopyTraderSetup from '@/components/crypto/CopyTraderSetup';
import CopyTradingMonitor from '@/components/crypto/CopyTradingMonitor';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

interface CopyConfig {
  id: string;
  master_wallet: string;
  allocated_capital: number;
  is_active: boolean;
  total_copied_trades: number;
  successful_trades: number;
  failed_trades: number;
  total_pnl: number;
  position_sizing_mode: string;
  auto_execute: boolean;
  created_at: string;
}

interface PendingTrade {
  id: string;
  master_wallet: string;
  token_in: string;
  token_out: string;
  suggested_amount_in: number;
  expires_at: string;
  status: string;
}

interface Position {
  id: string;
  master_wallet: string;
  token_in: string;
  token_out: string;
  amount_in: number;
  amount_out: number;
  status: string;
  pnl: number | null;
  opened_at: string;
  closed_at: string | null;
}

interface CopyTradingDashboardProps {
  selectedWallet?: string | null;
}

export default function CopyTradingDashboard({ selectedWallet = null }: CopyTradingDashboardProps) {
  const supabase = createClient();
  const { toast } = useToast();
  const { connected } = useWallet();

  const [configs, setConfigs] = useState<CopyConfig[]>([]);
  const [pendingTrades, setPendingTrades] = useState<PendingTrade[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [selectedTrader, setSelectedTrader] = useState<any>(null);
  const [showSetup, setShowSetup] = useState(false);

  // If selectedWallet is provided, show setup modal automatically
  useEffect(() => {
    if (selectedWallet && connected) {
      setShowSetup(true);
      setSelectedTrader({ wallet_address: selectedWallet });
    }
  }, [selectedWallet, connected]);

  useEffect(() => {
    if (connected) {
      fetchData();
      
      // Set up real-time subscriptions
      const configSub = supabase
        .channel('copy_config_changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'copy_trading_config'
        }, () => {
          fetchConfigs();
        })
        .subscribe();

      const pendingSub = supabase
        .channel('pending_trades_changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'pending_copy_trades'
        }, () => {
          fetchPendingTrades();
        })
        .subscribe();

      return () => {
        configSub.unsubscribe();
        pendingSub.unsubscribe();
      };
    }
  }, [connected]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      fetchConfigs(),
      fetchPendingTrades(),
      fetchPositions(),
    ]);
    setLoading(false);
  };

  const fetchConfigs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('copy_trading_config')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConfigs(data || []);
    } catch (error) {
      console.error('Error fetching configs:', error);
    }
  };

  const fetchPendingTrades = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('pending_copy_trades')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setPendingTrades(data || []);
    } catch (error) {
      console.error('Error fetching pending trades:', error);
    }
  };

  const fetchPositions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('copy_trading_positions')
        .select('*')
        .eq('user_id', user.id)
        .order('opened_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setPositions(data || []);
    } catch (error) {
      console.error('Error fetching positions:', error);
    }
  };

  const toggleConfig = async (configId: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from('copy_trading_config')
        .update({ is_active: !currentState })
        .eq('id', configId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: !currentState ? 'Copy trading activated' : 'Copy trading paused',
      });

      fetchConfigs();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const deleteConfig = async (configId: string) => {
    try {
      const { error } = await supabase
        .from('copy_trading_config')
        .delete()
        .eq('id', configId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Configuration deleted',
      });

      fetchConfigs();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleSelectTrader = (trader: any) => {
    setSelectedTrader(trader);
    setShowLeaderboard(false);
    setShowSetup(true);
  };

  const truncateAddress = (address: string) => {
    if (!address || address.length < 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const truncateToken = (token: string) => {
    if (!token || token.length < 12) return token;
    return `${token.slice(0, 4)}...${token.slice(-4)}`;
  };

  const openPositions = positions.filter(p => p.status === 'open');
  const closedPositions = positions.filter(p => p.status === 'closed');
  const totalPnL = closedPositions.reduce((sum, p) => sum + (parseFloat(p.pnl as any) || 0), 0);
  const activeConfigs = configs.filter(c => c.is_active);

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Activity className="w-16 h-16 text-gray-400 dark:text-gray-600" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Connect Wallet</h3>
        <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
          Connect your Solana wallet to access copy trading features
        </p>
        <WalletMultiButton />
      </div>
    );
  }

  if (showLeaderboard) {
    return (
      <div>
        <Button
          variant="ghost"
          onClick={() => setShowLeaderboard(false)}
          className="mb-4 text-gray-900 dark:text-white"
        >
          ← Back to Dashboard
        </Button>
        <CopyTradingLeaderboard onSelectTrader={handleSelectTrader} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-8 h-8 text-emerald-400" />
            Copy Trading Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Monitor and manage your copy trading activities</p>
        </div>
        <Button
          onClick={() => setShowLeaderboard(true)}
          className="bg-emerald-500 hover:bg-emerald-600"
        >
          <TrendingUp className="w-4 h-4 mr-2" />
          Find Traders to Copy
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-emerald-500/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Active Copies</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{activeConfigs.length}</p>
              </div>
              <Activity className="w-8 h-8 text-emerald-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-blue-500/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Open Positions</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{openPositions.length}</p>
              </div>
              <Target className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-amber-500/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Pending</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{pendingTrades.length}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-400" />
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-white dark:bg-slate-800 border-gray-200 ${totalPnL >= 0 ? 'dark:border-emerald-500/30' : 'dark:border-red-500/30'}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total P&L</p>
                <p className={`text-3xl font-bold ${totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(totalPnL)}
                </p>
              </div>
              {totalPnL >= 0 ? (
                <TrendingUp className="w-8 h-8 text-emerald-400" />
              ) : (
                <TrendingDown className="w-8 h-8 text-red-400" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="monitor" className="w-full">
        <TabsList className="grid w-full grid-cols-5 bg-gray-100 dark:bg-slate-800/50">
          <TabsTrigger value="monitor">Monitor</TabsTrigger>
          <TabsTrigger value="configs">Active Copies ({activeConfigs.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({pendingTrades.length})</TabsTrigger>
          <TabsTrigger value="positions">Positions ({openPositions.length})</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Monitor Tab */}
        <TabsContent value="monitor">
          <CopyTradingMonitor autoRefresh={true} refreshInterval={5000} />
        </TabsContent>

        {/* Active Configs */}
        <TabsContent value="configs">
          <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white">Active Copy Trading Configurations</CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Manage traders you're currently copying
              </CardDescription>
            </CardHeader>
            <CardContent>
              {configs.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400 mb-4">You're not copying any traders yet</p>
                  <Button
                    onClick={() => setShowLeaderboard(true)}
                    className="bg-emerald-500 hover:bg-emerald-600"
                  >
                    Browse Leaderboard
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-200 dark:border-slate-700">
                      <TableHead className="text-gray-700 dark:text-gray-300">Master Trader</TableHead>
                      <TableHead className="text-gray-700 dark:text-gray-300 text-right">Allocated</TableHead>
                      <TableHead className="text-gray-700 dark:text-gray-300 text-right">Trades</TableHead>
                      <TableHead className="text-gray-700 dark:text-gray-300 text-right">Success Rate</TableHead>
                      <TableHead className="text-gray-700 dark:text-gray-300 text-right">P&L</TableHead>
                      <TableHead className="text-gray-700 dark:text-gray-300">Status</TableHead>
                      <TableHead className="text-gray-700 dark:text-gray-300 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {configs.map((config) => {
                      const successRate = config.total_copied_trades > 0 
                        ? (config.successful_trades / config.total_copied_trades * 100).toFixed(1)
                        : '0';
                      
                      return (
                        <TableRow key={config.id} className="border-slate-700">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                <Users className="w-4 h-4 text-emerald-400" />
                              </div>
                              <span className="font-mono text-sm text-white">
                                {truncateAddress(config.master_wallet)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-white">
                            {formatCurrency(config.allocated_capital)}
                          </TableCell>
                          <TableCell className="text-right text-slate-300">
                            {config.total_copied_trades}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={`font-medium ${parseFloat(successRate) >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {successRate}%
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={`font-semibold ${config.total_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {config.total_pnl >= 0 ? '+' : ''}{formatCurrency(config.total_pnl)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={config.is_active 
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                                : 'bg-slate-700/50 text-slate-400 border-slate-600'
                              }
                            >
                              {config.is_active ? 'Active' : 'Paused'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleConfig(config.id, config.is_active)}
                              >
                                {config.is_active ? (
                                  <Pause className="w-4 h-4" />
                                ) : (
                                  <Play className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (window.confirm('Delete this configuration?')) {
                                    deleteConfig(config.id);
                                  }
                                }}
                              >
                                <X className="w-4 h-4 text-red-400" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pending Trades */}
        <TabsContent value="pending">
          <Card className="bg-slate-900/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Pending Copy Trades</CardTitle>
              <CardDescription className="text-slate-400">
                Review and approve pending trades
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingTrades.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">No pending trades</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-300">Master</TableHead>
                      <TableHead className="text-slate-300">Trade</TableHead>
                      <TableHead className="text-slate-300 text-right">Amount</TableHead>
                      <TableHead className="text-slate-300">Expires</TableHead>
                      <TableHead className="text-slate-300 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingTrades.map((trade) => (
                      <TableRow key={trade.id} className="border-slate-700">
                        <TableCell className="font-mono text-sm text-white">
                          {truncateAddress(trade.master_wallet)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <span className="text-slate-400">{truncateToken(trade.token_in)}</span>
                            <ArrowRight className="w-3 h-3 text-slate-500" />
                            <span className="text-white">{truncateToken(trade.token_out)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-white">
                          {formatCurrency(trade.suggested_amount_in)}
                        </TableCell>
                        <TableCell className="text-sm text-amber-400">
                          {new Date(trade.expires_at).toLocaleTimeString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Execute
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-400">
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Open Positions */}
        <TabsContent value="positions">
          <Card className="bg-slate-900/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Open Positions</CardTitle>
              <CardDescription className="text-slate-400">
                Currently open copy trading positions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {openPositions.length === 0 ? (
                <div className="text-center py-12">
                  <Target className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">No open positions</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-300">Master</TableHead>
                      <TableHead className="text-slate-300">Tokens</TableHead>
                      <TableHead className="text-slate-300 text-right">Amount In</TableHead>
                      <TableHead className="text-slate-300">Opened</TableHead>
                      <TableHead className="text-slate-300 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openPositions.map((position) => (
                      <TableRow key={position.id} className="border-slate-700">
                        <TableCell className="font-mono text-sm text-white">
                          {truncateAddress(position.master_wallet)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <span className="text-slate-400">{truncateToken(position.token_in)}</span>
                            <ArrowRight className="w-3 h-3 text-slate-500" />
                            <span className="text-white">{truncateToken(position.token_out)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-white">
                          {formatCurrency(position.amount_in)}
                        </TableCell>
                        <TableCell className="text-sm text-slate-400">
                          {new Date(position.opened_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <Button size="sm" variant="ghost" className="text-emerald-400">
                              Close Position
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History */}
        <TabsContent value="history">
          <Card className="bg-slate-900/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Trade History</CardTitle>
              <CardDescription className="text-slate-400">
                Closed copy trading positions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {closedPositions.length === 0 ? (
                <div className="text-center py-12">
                  <Activity className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">No closed positions yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-300">Master</TableHead>
                      <TableHead className="text-slate-300">Tokens</TableHead>
                      <TableHead className="text-slate-300 text-right">Amount</TableHead>
                      <TableHead className="text-slate-300 text-right">P&L</TableHead>
                      <TableHead className="text-slate-300">Closed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {closedPositions.map((position) => {
                      const pnl = parseFloat(position.pnl as any) || 0;
                      return (
                        <TableRow key={position.id} className="border-slate-700">
                          <TableCell className="font-mono text-sm text-white">
                            {truncateAddress(position.master_wallet)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <span className="text-slate-400">{truncateToken(position.token_in)}</span>
                              <ArrowRight className="w-3 h-3 text-slate-500" />
                              <span className="text-white">{truncateToken(position.token_out)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-white">
                            {formatCurrency(position.amount_in)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={`font-semibold ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-slate-400">
                            {position.closed_at ? new Date(position.closed_at).toLocaleDateString() : 'N/A'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Setup Modal */}
      <CopyTraderSetup
        open={showSetup}
        onOpenChange={(open) => {
          setShowSetup(open);
          if (!open) {
            fetchConfigs();
          }
        }}
        trader={selectedTrader}
      />
    </div>
  );
}


