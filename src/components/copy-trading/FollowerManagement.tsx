/**
 * Follower Management Component
 * Manage your copy trading relationships and monitor performance
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Target, 
  Play, 
  Pause, 
  Square, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  Clock,
  Users,
  Settings,
  Eye,
  Trash2,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Activity
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

interface FollowerManagementProps {
  followerRelationships: FollowerRelationship[];
  masterTraders: MasterTraderProfile[];
  onStartCopyTrading: (relationshipId: string) => void;
  onStopCopyTrading: (relationshipId: string) => void;
  onPauseCopyTrading: (relationshipId: string) => void;
  onUnfollowTrader: (relationshipId: string) => void;
}

export const FollowerManagement: React.FC<FollowerManagementProps> = ({
  followerRelationships,
  masterTraders,
  onStartCopyTrading,
  onStopCopyTrading,
  onPauseCopyTrading,
  onUnfollowTrader
}) => {
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRelationship, setSelectedRelationship] = useState<string | null>(null);

  // Filter relationships
  const filteredRelationships = useMemo(() => {
    return followerRelationships.filter(relationship => {
      const masterTrader = masterTraders.find(t => t.id === relationship.masterTraderId);
      if (!masterTrader) return false;

      // Status filter
      if (selectedStatus !== 'all' && relationship.status !== selectedStatus) {
        return false;
      }

      // Search filter
      if (searchQuery && !masterTrader.profileName.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      return true;
    });
  }, [followerRelationships, masterTraders, selectedStatus, searchQuery]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const activeRelationships = followerRelationships.filter(r => r.status === 'active');
    const totalAllocated = followerRelationships.reduce((sum, r) => sum + r.allocatedCapital, 0);
    const totalPnl = followerRelationships.reduce((sum, r) => sum + r.totalPnl, 0);
    const totalTrades = followerRelationships.reduce((sum, r) => sum + r.totalTrades, 0);
    const successfulTrades = followerRelationships.reduce((sum, r) => sum + r.successfulTrades, 0);
    const successRate = totalTrades > 0 ? (successfulTrades / totalTrades) * 100 : 0;

    return {
      activeCount: activeRelationships.length,
      totalAllocated,
      totalPnl,
      totalTrades,
      successRate
    };
  }, [followerRelationships]);

  const getStatusColor = (status: string) => {
    const colors = {
      active: 'bg-green-100 text-green-800 border-green-200',
      paused: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      stopped: 'bg-red-100 text-red-800 border-red-200',
      suspended: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'paused':
        return <Pause className="w-4 h-4 text-yellow-500" />;
      case 'stopped':
        return <Square className="w-4 h-4 text-red-500" />;
      case 'suspended':
        return <AlertTriangle className="w-4 h-4 text-gray-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getPositionSizingColor = (sizing: string) => {
    const colors = {
      proportional: 'bg-blue-100 text-blue-800 border-blue-200',
      fixed: 'bg-purple-100 text-purple-800 border-purple-200',
      kelly: 'bg-green-100 text-green-800 border-green-200'
    };
    return colors[sizing as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            My Copy Trading
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Manage your copy trading relationships and monitor performance
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Follows</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {summaryStats.activeCount}
                </p>
              </div>
              <Target className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Allocated</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  ${summaryStats.totalAllocated.toLocaleString()}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total P&L</p>
                <p className={`text-2xl font-bold ${
                  summaryStats.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  ${summaryStats.totalPnl.toFixed(2)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Success Rate</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {summaryStats.successRate.toFixed(1)}%
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search traders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="stopped">Stopped</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Relationships List */}
      <div className="space-y-4">
        {filteredRelationships.map((relationship) => {
          const masterTrader = masterTraders.find(t => t.id === relationship.masterTraderId);
          if (!masterTrader) return null;

          return (
            <Card key={relationship.id} className="bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {masterTrader.profileName}
                      </h3>
                      <Badge className={getStatusColor(relationship.status)}>
                        {getStatusIcon(relationship.status)}
                        <span className="ml-1 capitalize">{relationship.status}</span>
                      </Badge>
                      {masterTrader.verification.isVerified && (
                        <CheckCircle className="w-4 h-4 text-blue-500" />
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Strategy</p>
                        <p className="font-medium capitalize">
                          {masterTrader.strategyType.replace('_', ' ')}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Allocated Capital</p>
                        <p className="font-medium">
                          ${relationship.allocatedCapital.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Position Sizing</p>
                        <Badge className={getPositionSizingColor(relationship.positionSizing)}>
                          {relationship.positionSizing}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Started</p>
                        <p className="font-medium">
                          {new Date(relationship.startedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Total Trades</p>
                        <p className="text-lg font-semibold">{relationship.totalTrades}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Success Rate</p>
                        <p className="text-lg font-semibold">
                          {relationship.totalTrades > 0 
                            ? ((relationship.successfulTrades / relationship.totalTrades) * 100).toFixed(1)
                            : 0}%
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">P&L</p>
                        <p className={`text-lg font-semibold ${
                          relationship.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          ${relationship.totalPnl.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {relationship.lastTradeAt && (
                      <div className="mt-3 text-sm text-gray-500">
                        <Clock className="w-3 h-3 inline mr-1" />
                        Last trade: {new Date(relationship.lastTradeAt).toLocaleString()}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col space-y-2 ml-4">
                    {relationship.status === 'active' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onPauseCopyTrading(relationship.id)}
                        >
                          <Pause className="w-4 h-4 mr-2" />
                          Pause
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onStopCopyTrading(relationship.id)}
                          className="text-red-600 border-red-600 hover:bg-red-50"
                        >
                          <Square className="w-4 h-4 mr-2" />
                          Stop
                        </Button>
                      </>
                    )}

                    {relationship.status === 'paused' && (
                      <Button
                        size="sm"
                        onClick={() => onStartCopyTrading(relationship.id)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Resume
                      </Button>
                    )}

                    {relationship.status === 'stopped' && (
                      <Button
                        size="sm"
                        onClick={() => onStartCopyTrading(relationship.id)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Start
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {/* View details */}}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Details
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onUnfollowTrader(relationship.id)}
                      className="text-red-600 border-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Unfollow
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredRelationships.length === 0 && (
        <div className="text-center py-12">
          <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {followerRelationships.length === 0 ? 'No copy trading relationships' : 'No relationships match your filters'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {followerRelationships.length === 0 
              ? 'Start following master traders to begin copy trading'
              : 'Try adjusting your search criteria or filters'
            }
          </p>
          {followerRelationships.length === 0 && (
            <Button>
              <Users className="w-4 h-4 mr-2" />
              Discover Master Traders
            </Button>
          )}
        </div>
      )}
    </div>
  );
};




