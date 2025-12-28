import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Bell,
  BellOff,
  ArrowRight,
  Zap
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/crypto-aggregation-service';

interface MonitoredTrade {
  id: string;
  master_wallet: string;
  token_in: string;
  token_out: string;
  amount_in: number;
  amount_out: number | null;
  price: number | null;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'rejected';
  created_at: string;
  executed_at: string | null;
  pnl: number | null;
  slippage: number | null;
}

interface CopyTradingMonitorProps {
  configId?: string;
  masterWallet?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export default function CopyTradingMonitor({
  configId,
  masterWallet,
  autoRefresh = true,
  refreshInterval = 5000
}: CopyTradingMonitorProps) {
  const supabase = createClient();
  const { toast } = useToast();
  
  const [trades, setTrades] = useState<MonitoredTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [lastTradeId, setLastTradeId] = useState<string | null>(null);

  useEffect(() => {
    fetchTrades();
    
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchTrades(true);
      }, refreshInterval);
      
      return () => clearInterval(interval);
    }
  }, [configId, masterWallet, autoRefresh, refreshInterval]);

  const fetchTrades = async (silent = false) => {
    if (!silent) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('pending_copy_trades')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (configId) {
        query = query.eq('config_id', configId);
      }

      if (masterWallet) {
        query = query.eq('master_wallet', masterWallet);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Check for new trades
      if (notificationsEnabled && data && data.length > 0) {
        const newestTrade = data[0];
        if (lastTradeId && newestTrade.id !== lastTradeId) {
          // New trade detected
          toast({
            title: 'New Trade Detected',
            description: `${newestTrade.token_in} → ${newestTrade.token_out}`,
          });
          
          // Play notification sound (if browser supports it)
          try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OSdTgwOUKfk8LZjHAY4kdfyzHksBSR3x/DdkEAKFF606euoVRQKRp/g8r5sIQUrgc7y2Yk2CBtpvfDknU4MDlCn5PC2YxwGOJHX8sx5LAUkd8fw3ZBAC');
            audio.play().catch(() => {
              // Ignore audio play errors
            });
          } catch (e) {
            // Ignore audio errors
          }
        }
        setLastTradeId(newestTrade.id);
      }

      setTrades(data || []);
    } catch (error) {
      console.error('Error fetching monitored trades:', error);
      if (!silent) {
        toast({
          title: 'Error',
          description: 'Failed to load trades',
          variant: 'destructive'
        });
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleApprove = async (tradeId: string) => {
    try {
      const { error } = await supabase
        .from('pending_copy_trades')
        .update({ status: 'executing' })
        .eq('id', tradeId);

      if (error) throw error;

      toast({
        title: 'Trade Approved',
        description: 'Trade execution started',
      });

      fetchTrades();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve trade',
        variant: 'destructive'
      });
    }
  };

  const handleReject = async (tradeId: string) => {
    try {
      const { error } = await supabase
        .from('pending_copy_trades')
        .update({ status: 'rejected' })
        .eq('id', tradeId);

      if (error) throw error;

      toast({
        title: 'Trade Rejected',
        description: 'Trade has been rejected',
      });

      fetchTrades();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject trade',
        variant: 'destructive'
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">Pending</Badge>;
      case 'executing':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">Executing</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">Completed</Badge>;
      case 'failed':
        return <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30">Failed</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-gray-500/10 text-gray-400 border-gray-500/30">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const truncateAddress = (address: string) => {
    if (!address || address.length < 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const truncateToken = (token: string) => {
    if (!token || token.length < 12) return token;
    return `${token.slice(0, 4)}...${token.slice(-4)}`;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    return date.toLocaleTimeString();
  };

  const pendingTrades = trades.filter(t => t.status === 'pending' || t.status === 'executing');
  const completedTrades = trades.filter(t => t.status === 'completed');
  const failedTrades = trades.filter(t => t.status === 'failed');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-emerald-400" />
            Copy Trading Monitor
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Real-time monitoring of copy trading activities</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
            className={notificationsEnabled ? 'text-emerald-400' : 'text-gray-400'}
          >
            {notificationsEnabled ? (
              <Bell className="w-4 h-4 mr-2" />
            ) : (
              <BellOff className="w-4 h-4 mr-2" />
            )}
            {notificationsEnabled ? 'Notifications On' : 'Notifications Off'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchTrades()}
            disabled={isRefreshing}
            className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Pending</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{pendingTrades.length}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Completed</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{completedTrades.length}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Failed</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{failedTrades.length}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{trades.length}</p>
              </div>
              <Activity className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trade Feed */}
      <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white">Trade Feed</CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            {autoRefresh && `Auto-refreshing every ${refreshInterval / 1000}s`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
          ) : trades.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400">No trades to monitor</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-200 dark:border-slate-700">
                    <TableHead className="text-gray-700 dark:text-gray-300">Time</TableHead>
                    <TableHead className="text-gray-700 dark:text-gray-300">Master Wallet</TableHead>
                    <TableHead className="text-gray-700 dark:text-gray-300">Trade</TableHead>
                    <TableHead className="text-gray-700 dark:text-gray-300 text-right">Amount</TableHead>
                    <TableHead className="text-gray-700 dark:text-gray-300 text-right">P&L</TableHead>
                    <TableHead className="text-gray-700 dark:text-gray-300">Status</TableHead>
                    <TableHead className="text-gray-700 dark:text-gray-300 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trades.map((trade) => {
                    const isNew = lastTradeId && trade.id === lastTradeId;
                    return (
                      <TableRow 
                        key={trade.id} 
                        className={`border-gray-200 dark:border-slate-700 ${isNew ? 'bg-emerald-50 dark:bg-emerald-500/5' : ''}`}
                      >
                        <TableCell className="text-gray-700 dark:text-gray-300 text-sm">
                          {formatTime(trade.created_at)}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-gray-900 dark:text-white">
                          {truncateAddress(trade.master_wallet)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <span className="text-gray-600 dark:text-gray-400">{truncateToken(trade.token_in)}</span>
                            <ArrowRight className="w-3 h-3 text-gray-500 dark:text-gray-500" />
                            <span className="text-gray-900 dark:text-white">{truncateToken(trade.token_out)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-gray-900 dark:text-white">
                          {formatCurrency(trade.amount_in)}
                        </TableCell>
                        <TableCell className="text-right">
                          {trade.pnl !== null ? (
                            <span className={`font-semibold ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {trade.pnl >= 0 ? '+' : ''}{formatCurrency(trade.pnl)}
                            </span>
                          ) : (
                            <span className="text-gray-500 dark:text-gray-500">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(trade.status)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            {trade.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleApprove(trade.id)}
                                  className="bg-emerald-500 hover:bg-emerald-600"
                                >
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleReject(trade.id)}
                                  className="text-red-400 hover:text-red-300"
                                >
                                  <XCircle className="w-3 h-3" />
                                </Button>
                              </>
                            )}
                            {trade.status === 'executing' && (
                              <div className="flex items-center gap-1 text-blue-400">
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                <span className="text-sm">Executing...</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

