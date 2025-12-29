import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Target,
  Shield,
  Search,
  Search as ArrowUpDown,
  CheckCircle,
  ExternalLink,
  Search as Eye,
  Copy,
  Zap
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/crypto-aggregation-service';
import { useToast } from '@/components/ui/use-toast';
import { seedCopyTradingLeaderboard } from '@/lib/seed-copy-trading-leaderboard';
import { useNavigate } from 'react-router-dom';

interface LeaderboardTrader {
  id: string;
  wallet_address: string;
  total_pnl: number;
  roi: number;
  win_rate: number;
  total_trades: number;
  max_drawdown: number;
  sharpe_ratio: number | null;
  assets_under_copy: number;
  follower_count: number;
  risk_score: number;
  consistency_score: number;
  pnl_30d: number;
  roi_30d: number;
  trades_30d: number;
  is_verified: boolean;
  last_trade_at: string;
}

interface CopyTradingLeaderboardProps {
  onSelectTrader?: (trader: LeaderboardTrader) => void;
}

export default function CopyTradingLeaderboard({ onSelectTrader }: CopyTradingLeaderboardProps) {
  const supabase = createClient();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [traders, setTraders] = useState<LeaderboardTrader[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'roi' | 'total_pnl' | 'win_rate' | 'sharpe_ratio' | 'follower_count'>('roi');
  const [minWinRate, setMinWinRate] = useState(0);
  const [maxRiskScore, setMaxRiskScore] = useState(100);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  useEffect(() => {
    const init = async () => {
      // Manual cleanup if needed - one time or based on a condition
      // await supabase.from('copy_trading_leaderboard').delete().neq('id', '0');

      fetchTraders();
    };

    init();
  }, [sortBy]);

  const fetchTraders = async () => {
    setLoading(true);
    try {
      // First try with filters
      let query = supabase
        .from('copy_trading_leaderboard')
        .select('*')
        .order(sortBy, { ascending: false, nullsLast: true })
        .limit(100);

      // Only add filters if they make sense
      query = query.eq('blockchain', 'solana');
      // Don't filter by is_active initially - show all, then filter in UI

      const { data, error } = await query;

      if (error) {
        console.error('Query error:', error);
        throw error;
      }

      console.log(`Fetched ${data?.length || 0} traders`);

      // Filter active traders in memory
      const activeTraders = (data || []).filter(t => t.is_active !== false);
      setTraders(activeTraders);

      if (activeTraders.length === 0 && data && data.length > 0) {
        console.warn('All traders are inactive');
        // Show inactive traders if no active ones found
        setTraders(data);
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      toast({
        title: 'Error',
        description: 'Failed to load leaderboard',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredTraders = traders.filter(trader => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!trader.wallet_address.toLowerCase().includes(query)) {
        return false;
      }
    }

    if (minWinRate > 0 && trader.win_rate < minWinRate) {
      return false;
    }

    if (trader.risk_score > maxRiskScore) {
      return false;
    }

    if (verifiedOnly && !trader.is_verified) {
      return false;
    }

    return true;
  });

  const truncateAddress = (address: string) => {
    if (!address || address.length < 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getRiskBadge = (score: number) => {
    if (score < 30) return { label: 'Low', color: 'bg-green-500/10 text-green-400 border-green-500/30' };
    if (score < 60) return { label: 'Medium', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
    return { label: 'High', color: 'bg-red-500/10 text-red-400 border-red-500/30' };
  };

  const handleStartCopying = (trader: LeaderboardTrader) => {
    // Navigate to copy trading dashboard with pre-filled wallet
    navigate(`/app/crypto-analytics?tab=copy-trading&wallet=${trader.wallet_address}`);
    // Also call onSelectTrader if provided
    if (onSelectTrader) {
      onSelectTrader(trader);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
          <Trophy className="w-6 h-6 text-emerald-400" />
          Copy Trading Leaderboard
        </h2>
        <p className="text-gray-600 dark:text-gray-400">Top performing Solana traders ranked by performance metrics</p>
      </div>

      {/* Filters */}
      <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  placeholder="Search by wallet address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-gray-50 dark:bg-slate-800/50 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {/* Sort By */}
            <div>
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="bg-gray-50 dark:bg-slate-800/50 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="roi">ROI</SelectItem>
                  <SelectItem value="total_pnl">Total P&L</SelectItem>
                  <SelectItem value="win_rate">Win Rate</SelectItem>
                  <SelectItem value="sharpe_ratio">Sharpe Ratio</SelectItem>
                  <SelectItem value="follower_count">Most Followed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Risk Filter */}
            <div>
              <Select
                value={maxRiskScore.toString()}
                onValueChange={(value) => setMaxRiskScore(parseInt(value))}
              >
                <SelectTrigger className="bg-gray-50 dark:bg-slate-800/50 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white">
                  <SelectValue placeholder="Risk Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="100">All Risk Levels</SelectItem>
                  <SelectItem value="30">Low Risk Only</SelectItem>
                  <SelectItem value="60">Low-Medium Risk</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="Min Win Rate %"
                value={minWinRate || ''}
                onChange={(e) => setMinWinRate(parseFloat(e.target.value) || 0)}
                className="w-32 bg-gray-50 dark:bg-slate-800/50 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setMinWinRate(0);
                setMaxRiskScore(100);
                setVerifiedOnly(false);
              }}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Leaderboard Table */}
      <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white">
            Top Traders ({filteredTraders.length})
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Click on a trader to view details and start copying
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
          ) : filteredTraders.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400">No traders found matching your criteria</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                    <TableHead className="text-gray-700 dark:text-gray-300">Rank</TableHead>
                    <TableHead className="text-gray-700 dark:text-gray-300">Trader</TableHead>
                    <TableHead className="text-gray-700 dark:text-gray-300 text-right">30d P&L</TableHead>
                    <TableHead className="text-gray-700 dark:text-gray-300 text-right">ROI</TableHead>
                    <TableHead className="text-gray-700 dark:text-gray-300 text-right">Win Rate</TableHead>
                    <TableHead className="text-gray-700 dark:text-gray-300 text-right">Trades</TableHead>
                    <TableHead className="text-gray-700 dark:text-gray-300 text-right">Sharpe</TableHead>
                    <TableHead className="text-gray-700 dark:text-gray-300">Risk</TableHead>
                    <TableHead className="text-gray-700 dark:text-gray-300 text-right">Followers</TableHead>
                    <TableHead className="text-gray-700 dark:text-gray-300">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTraders.map((trader, index) => {
                    const riskBadge = getRiskBadge(trader.risk_score);
                    const isProfitable = trader.pnl_30d > 0;

                    return (
                      <TableRow
                        key={trader.id}
                        className="border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer"
                        onClick={() => onSelectTrader && onSelectTrader(trader)}
                      >
                        <TableCell className="font-medium text-gray-700 dark:text-gray-300">
                          #{index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                              <Zap className="w-4 h-4 text-emerald-400" />
                            </div>
                            <div>
                              <p className="font-mono text-sm text-gray-900 dark:text-white">
                                {truncateAddress(trader.wallet_address)}
                              </p>
                              {trader.is_verified && (
                                <div className="flex items-center gap-1 mt-0.5">
                                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                                  <span className="text-xs text-emerald-400">Verified</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-semibold ${isProfitable ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isProfitable ? '+' : ''}{formatCurrency(trader.pnl_30d)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-semibold ${trader.roi > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {trader.roi > 0 ? '+' : ''}{trader.roi.toFixed(2)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-gray-900 dark:text-white font-medium">{trader.win_rate.toFixed(1)}%</span>
                            {trader.win_rate >= 60 ? (
                              <TrendingUp className="w-3 h-3 text-green-400" />
                            ) : (
                              <TrendingDown className="w-3 h-3 text-red-400" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-gray-700 dark:text-gray-300">
                          {trader.trades_30d}
                        </TableCell>
                        <TableCell className="text-right text-gray-700 dark:text-gray-300">
                          {trader.sharpe_ratio ? trader.sharpe_ratio.toFixed(2) : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={riskBadge.color}>
                            {riskBadge.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1 text-gray-700 dark:text-gray-300">
                            <Users className="w-3 h-3" />
                            {trader.follower_count}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent row click
                                navigator.clipboard.writeText(trader.wallet_address);
                                toast({
                                  title: 'Copied!',
                                  description: 'Wallet address copied to clipboard',
                                });
                              }}
                              className="text-emerald-400 hover:text-emerald-300"
                            >
                              <Copy className="w-4 h-4 mr-1" />
                              Copy Address
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartCopying(trader);
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700"
                            >
                              <Zap className="w-4 h-4 mr-1" />
                              Start Copying
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(`https://solscan.io/account/${trader.wallet_address}`, '_blank');
                              }}
                              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </Button>
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

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
          <CardContent className="p-4">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Total Traders</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{traders.length}</p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
          <CardContent className="p-4">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Avg Win Rate</p>
            <p className="text-2xl font-bold text-emerald-400">
              {traders.length > 0
                ? (traders.reduce((sum, t) => sum + t.win_rate, 0) / traders.length).toFixed(1)
                : '0'
              }%
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
          <CardContent className="p-4">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Total AUC</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(traders.reduce((sum, t) => sum + (t.assets_under_copy || 0), 0))}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
          <CardContent className="p-4">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Active Copiers</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {traders.reduce((sum, t) => sum + t.follower_count, 0)}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Helper component for missing Trophy icon
function Trophy({ className }: { className?: string }) {
  return <TrendingUp className={className} />;
}

