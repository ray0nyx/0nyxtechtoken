/**
 * Master Trader Discovery Component
 * Browse and discover master traders with advanced filtering and ranking
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Users, 
  Star, 
  TrendingUp, 
  TrendingDown, 
  Shield, 
  Clock, 
  DollarSign,
  Target,
  Eye,
  Plus,
  Minus,
  ArrowUp,
  ArrowDown,
  Filter,
  Search,
  ExternalLink,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

interface MasterTraderProfile {
  id: string;
  userId: string;
  profileName: string;
  strategyType: 'scalping' | 'swing' | 'arbitrage' | 'mean_reversion' | 'trend_following';
  riskLevel: 'conservative' | 'moderate' | 'aggressive' | 'high_frequency';
  performance: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    totalTrades: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    volatility: number;
    var95: number;
    consistencyScore: number;
  };
  verification: {
    isVerified: boolean;
    trackRecordMonths: number;
    assetsUnderManagement: number;
    kycStatus: string;
    complianceScore: number;
  };
  feeStructure: {
    performanceFee: number;
    managementFee: number;
    highWaterMark: boolean;
  };
  social: {
    followerCount: number;
    averageRating: number;
    reviewCount: number;
  };
  isPublic: boolean;
  isAcceptingFollowers: boolean;
  minInvestment: number;
  maxFollowers: number;
  bio: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  lastTradeAt?: string;
}

interface FollowerRelationship {
  id: string;
  masterTraderId: string;
  followerId: string;
  allocatedCapital: number;
  positionSizing: 'proportional' | 'fixed' | 'kelly';
  maxPositionSize?: number;
  riskLimits: {
    maxDailyLoss: number;
    maxDrawdown: number;
    stopLossEnabled: boolean;
    takeProfitEnabled: boolean;
  };
  replicationSettings: {
    delay: number;
    allowPartialFills: boolean;
    maxSlippage: number;
  };
  status: 'active' | 'paused' | 'stopped' | 'suspended';
  startedAt: string;
  lastTradeAt?: string;
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  totalPnl: number;
}

interface MasterTraderDiscoveryProps {
  masterTraders: MasterTraderProfile[];
  searchQuery: string;
  selectedStrategy: string;
  selectedRiskLevel: string;
  sortBy: string;
  sortOrder: string;
  onFollowTrader: (traderId: string, allocatedCapital: number) => void;
  onUnfollowTrader: (relationshipId: string) => void;
  followerRelationships: FollowerRelationship[];
}

export const MasterTraderDiscovery: React.FC<MasterTraderDiscoveryProps> = ({
  masterTraders,
  searchQuery,
  selectedStrategy,
  selectedRiskLevel,
  sortBy,
  sortOrder,
  onFollowTrader,
  onUnfollowTrader,
  followerRelationships
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTrader, setSelectedTrader] = useState<string | null>(null);
  const [followModalOpen, setFollowModalOpen] = useState(false);
  const [allocatedCapital, setAllocatedCapital] = useState(1000);

  // Filter and sort traders
  const filteredTraders = useMemo(() => {
    let filtered = masterTraders.filter(trader => {
      // Search filter
      if (searchQuery && !trader.profileName.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !trader.bio.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !trader.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))) {
        return false;
      }

      // Strategy filter
      if (selectedStrategy !== 'all' && trader.strategyType !== selectedStrategy) {
        return false;
      }

      // Risk level filter
      if (selectedRiskLevel !== 'all' && trader.riskLevel !== selectedRiskLevel) {
        return false;
      }

      // Only show public traders accepting followers
      if (!trader.isPublic || !trader.isAcceptingFollowers) {
        return false;
      }

      return true;
    });

    // Sort traders
    filtered.sort((a, b) => {
      let aValue: number;
      let bValue: number;

      switch (sortBy) {
        case 'sharpe_ratio':
          aValue = a.performance.sharpeRatio;
          bValue = b.performance.sharpeRatio;
          break;
        case 'total_return':
          aValue = a.performance.totalReturn;
          bValue = b.performance.totalReturn;
          break;
        case 'max_drawdown':
          aValue = a.performance.maxDrawdown;
          bValue = b.performance.maxDrawdown;
          break;
        case 'follower_count':
          aValue = a.social.followerCount;
          bValue = b.social.followerCount;
          break;
        case 'win_rate':
          aValue = a.performance.winRate;
          bValue = b.performance.winRate;
          break;
        default: // overall_score
          aValue = (a.performance.sharpeRatio + a.performance.totalReturn + a.performance.winRate) / 3;
          bValue = (b.performance.sharpeRatio + b.performance.totalReturn + b.performance.winRate) / 3;
      }

      return sortOrder === 'desc' ? bValue - aValue : aValue - bValue;
    });

    return filtered;
  }, [masterTraders, searchQuery, selectedStrategy, selectedRiskLevel, sortBy, sortOrder]);

  const getStrategyColor = (strategy: string) => {
    const colors = {
      scalping: 'bg-red-100 text-red-800 border-red-200',
      swing: 'bg-blue-100 text-blue-800 border-blue-200',
      arbitrage: 'bg-green-100 text-green-800 border-green-200',
      mean_reversion: 'bg-purple-100 text-purple-800 border-purple-200',
      trend_following: 'bg-orange-100 text-orange-800 border-orange-200'
    };
    return colors[strategy as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getRiskLevelColor = (riskLevel: string) => {
    const colors = {
      conservative: 'bg-green-100 text-green-800 border-green-200',
      moderate: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      aggressive: 'bg-red-100 text-red-800 border-red-200',
      high_frequency: 'bg-purple-100 text-purple-800 border-purple-200'
    };
    return colors[riskLevel as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const isFollowing = (traderId: string) => {
    return followerRelationships.some(r => r.masterTraderId === traderId && r.status === 'active');
  };

  const getRelationship = (traderId: string) => {
    return followerRelationships.find(r => r.masterTraderId === traderId);
  };

  const handleFollowClick = (trader: MasterTraderProfile) => {
    setSelectedTrader(trader.id);
    setAllocatedCapital(trader.minInvestment);
    setFollowModalOpen(true);
  };

  const handleFollowConfirm = () => {
    if (selectedTrader) {
      onFollowTrader(selectedTrader, allocatedCapital);
      setFollowModalOpen(false);
      setSelectedTrader(null);
    }
  };

  const handleUnfollowClick = (traderId: string) => {
    const relationship = getRelationship(traderId);
    if (relationship) {
      onUnfollowTrader(relationship.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Master Traders
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Discover and follow top-performing traders
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
        </div>
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          Showing {filteredTraders.length} of {masterTraders.length} traders
        </span>
        <div className="flex items-center space-x-4">
          <span>Sort by: {sortBy.replace('_', ' ')}</span>
          <span>Order: {sortOrder}</span>
        </div>
      </div>

      {/* Traders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTraders.map((trader) => {
          const relationship = getRelationship(trader.id);
          const isCurrentlyFollowing = isFollowing(trader.id);

          return (
            <Card key={trader.id} className="bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {trader.profileName}
                      </h3>
                      {trader.verification.isVerified && (
                        <CheckCircle className="w-4 h-4 text-blue-500" />
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                      {trader.bio || 'No description available'}
                    </p>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Star className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm font-medium">
                      {trader.social.averageRating.toFixed(1)}
                    </span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Strategy and Risk Level */}
                <div className="flex items-center space-x-2">
                  <Badge className={getStrategyColor(trader.strategyType)}>
                    {trader.strategyType.replace('_', ' ')}
                  </Badge>
                  <Badge className={getRiskLevelColor(trader.riskLevel)}>
                    {trader.riskLevel}
                  </Badge>
                </div>

                {/* Performance Metrics */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="flex items-center space-x-1 text-gray-500">
                      <TrendingUp className="w-3 h-3" />
                      <span>Return</span>
                    </div>
                    <div className={`font-semibold ${
                      trader.performance.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {(trader.performance.totalReturn * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center space-x-1 text-gray-500">
                      <Shield className="w-3 h-3" />
                      <span>Sharpe</span>
                    </div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {trader.performance.sharpeRatio.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center space-x-1 text-gray-500">
                      <TrendingDown className="w-3 h-3" />
                      <span>Max DD</span>
                    </div>
                    <div className="font-semibold text-red-600">
                      {(trader.performance.maxDrawdown * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center space-x-1 text-gray-500">
                      <Target className="w-3 h-3" />
                      <span>Win Rate</span>
                    </div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {(trader.performance.winRate * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center space-x-1">
                    <Users className="w-3 h-3" />
                    <span>{trader.social.followerCount} followers</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{trader.verification.trackRecordMonths}mo track record</span>
                  </div>
                </div>

                {/* Fee Structure */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Performance Fee</span>
                  <span className="font-medium">
                    {(trader.feeStructure.performanceFee * 100).toFixed(0)}%
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-2">
                  {isCurrentlyFollowing ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleUnfollowClick(trader.id)}
                      >
                        <Minus className="w-4 h-4 mr-2" />
                        Unfollow
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {/* View details */}}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => handleFollowClick(trader)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Follow
                    </Button>
                  )}
                </div>

                {/* Status for following traders */}
                {isCurrentlyFollowing && relationship && (
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Status</span>
                      <Badge 
                        variant={
                          relationship.status === 'active' ? 'default' :
                          relationship.status === 'paused' ? 'secondary' : 'destructive'
                        }
                      >
                        {relationship.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Allocated</span>
                      <span className="font-medium">
                        ${relationship.allocatedCapital.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">P&L</span>
                      <span className={`font-medium ${
                        relationship.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        ${relationship.totalPnl.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Follow Modal */}
      {followModalOpen && selectedTrader && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md bg-white dark:bg-gray-800">
            <CardHeader>
              <CardTitle>Follow Master Trader</CardTitle>
              <CardDescription>
                Set your allocated capital and risk preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Allocated Capital ($)
                </label>
                <Input
                  type="number"
                  value={allocatedCapital}
                  onChange={(e) => setAllocatedCapital(Number(e.target.value))}
                  min={1000}
                  step={100}
                  className="mt-1"
                />
              </div>
              
              <div className="text-sm text-gray-500">
                <p>• Minimum investment: $1,000</p>
                <p>• Performance fee: 20%</p>
                <p>• Management fee: 1% annually</p>
              </div>

              <div className="flex items-center space-x-2 pt-4">
                <Button
                  onClick={handleFollowConfirm}
                  className="flex-1"
                >
                  Confirm Follow
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setFollowModalOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {filteredTraders.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No traders found
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Try adjusting your search criteria or filters
          </p>
        </div>
      )}
    </div>
  );
};




