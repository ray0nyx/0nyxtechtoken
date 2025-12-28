/**
 * Copy Trading Dashboard Component
 * Real-time dashboard for monitoring copy trading activities
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  DollarSign,
  Target,
  Users,
  Zap,
  AlertTriangle,
  CheckCircle,
  Play,
  Pause,
  Square,
  RefreshCw
} from 'lucide-react';

interface CopyTradingSession {
  id: string;
  masterTradeId: string;
  followerTradeId?: string;
  masterConnectionId: string;
  followerRelationshipId: string;
  replicationDelayMs: number;
  slippage?: number;
  fillQuality?: number;
  executedAt: string;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled';
  errorMessage?: string;
  retryCount: number;
}

interface TradeSignal {
  id: string;
  masterTradeId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price?: number;
  orderType: 'market' | 'limit' | 'stop' | 'stop_limit';
  stopLoss?: number;
  takeProfit?: number;
  leverage: number;
  timestamp: string;
  platform: string;
  metadata: Record<string, any>;
}

interface ExecutionResult {
  id: string;
  signalId: string;
  platform: string;
  success: boolean;
  orderId?: string;
  filledQuantity?: number;
  filledPrice?: number;
  remainingQuantity?: number;
  fees?: number;
  executionTime: string;
  errorMessage?: string;
  replicationDelay: number;
  slippage?: number;
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

interface CopyTradingDashboardProps {
  copyTradingSessions: CopyTradingSession[];
  tradeSignals: TradeSignal[];
  executionResults: ExecutionResult[];
  followerRelationships: FollowerRelationship[];
  masterTraders: MasterTraderProfile[];
  onStartCopyTrading: (relationshipId: string) => void;
  onStopCopyTrading: (relationshipId: string) => void;
  onPauseCopyTrading: (relationshipId: string) => void;
  onRefreshData: () => void;
}

export const CopyTradingDashboard: React.FC<CopyTradingDashboardProps> = ({
  copyTradingSessions,
  tradeSignals,
  executionResults,
  followerRelationships,
  masterTraders,
  onStartCopyTrading,
  onStopCopyTrading,
  onPauseCopyTrading,
  onRefreshData
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Calculate real-time metrics
  const activeSessions = copyTradingSessions.filter(session => 
    session.status === 'executing' || session.status === 'pending'
  );
  
  const completedSessions = copyTradingSessions.filter(session => 
    session.status === 'completed'
  );
  
  const failedSessions = copyTradingSessions.filter(session => 
    session.status === 'failed'
  );

  const activeRelationships = followerRelationships.filter(rel => 
    rel.status === 'active'
  );

  const totalPnl = followerRelationships.reduce((sum, rel) => sum + rel.totalPnl, 0);
  const totalTrades = followerRelationships.reduce((sum, rel) => sum + rel.totalTrades, 0);
  const successfulTrades = followerRelationships.reduce((sum, rel) => sum + rel.successfulTrades, 0);
  const successRate = totalTrades > 0 ? (successfulTrades / totalTrades) * 100 : 0;

  const averageLatency = copyTradingSessions.length > 0 
    ? copyTradingSessions.reduce((sum, session) => sum + session.replicationDelayMs, 0) / copyTradingSessions.length
    : 0;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefreshData();
    setIsRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'stopped':
      case 'failed':
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'executing':
      case 'pending':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'paused':
        return <Pause className="w-4 h-4" />;
      case 'stopped':
      case 'failed':
      case 'cancelled':
        return <Square className="w-4 h-4" />;
      case 'executing':
      case 'pending':
        return <Play className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Copy Trading Dashboard
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Real-time monitoring of your copy trading activities
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total P&L</p>
                <p className={`text-2xl font-bold ${
                  totalPnl >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  ${totalPnl.toFixed(2)}
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
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Success Rate</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {successRate.toFixed(1)}%
                </p>
              </div>
              <Target className="h-8 w-8 text-blue-500" />
            </div>
            <div className="mt-2">
              <span className="text-sm text-gray-600">
                {successfulTrades} / {totalTrades} trades
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Latency</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {averageLatency.toFixed(0)}ms
                </p>
              </div>
              <Clock className="h-8 w-8 text-purple-500" />
            </div>
            <div className="mt-2">
              <span className="text-sm text-blue-600 font-medium">
                Sub-100ms Target
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Sessions</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {activeSessions.length}
                </p>
              </div>
              <Activity className="h-8 w-8 text-orange-500" />
            </div>
            <div className="mt-2">
              <span className="text-sm text-gray-600">
                {activeRelationships.length} relationships
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dashboard Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="signals">Signals</TabsTrigger>
          <TabsTrigger value="executions">Executions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Active Relationships */}
            <Card className="bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                  Active Relationships
                </CardTitle>
                <CardDescription>
                  Currently following master traders
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activeRelationships.slice(0, 5).map((relationship) => {
                    const master = masterTraders.find(t => t.id === relationship.masterTraderId);
                    return (
                      <div key={relationship.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                            <Users className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {master?.profileName || 'Unknown Trader'}
                            </p>
                            <p className="text-sm text-gray-500">
                              {master?.strategyType?.replace('_', ' ')} • ${relationship.allocatedCapital.toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className={getStatusColor(relationship.status)}>
                            {relationship.status}
                          </Badge>
                          <div className="flex space-x-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onPauseCopyTrading(relationship.id)}
                            >
                              <Pause className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onStopCopyTrading(relationship.id)}
                            >
                              <Square className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-green-600 dark:text-green-400">
                  Recent Activity
                </CardTitle>
                <CardDescription>
                  Latest copy trading events
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {copyTradingSessions.slice(0, 5).map((session) => (
                    <div key={session.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                          {getStatusIcon(session.status)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            Trade {session.masterTradeId.slice(-8)}
                          </p>
                          <p className="text-sm text-gray-500">
                            {new Date(session.executedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={getStatusColor(session.status)}>
                          {session.status}
                        </Badge>
                        <p className="text-sm text-gray-500 mt-1">
                          {session.replicationDelayMs}ms delay
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          <Card className="bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-purple-600 dark:text-purple-400">
                Copy Trading Sessions
              </CardTitle>
              <CardDescription>
                All copy trading sessions and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {copyTradingSessions.map((session) => (
                  <div key={session.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                          {getStatusIcon(session.status)}
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            Session {session.id.slice(-8)}
                          </h4>
                          <p className="text-sm text-gray-500">
                            Master Trade: {session.masterTradeId.slice(-8)}
                          </p>
                        </div>
                      </div>
                      <Badge className={getStatusColor(session.status)}>
                        {session.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Replication Delay</p>
                        <p className="font-semibold">
                          {session.replicationDelayMs}ms
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Slippage</p>
                        <p className="font-semibold">
                          {session.slippage ? `${(session.slippage * 100).toFixed(3)}%` : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Fill Quality</p>
                        <p className="font-semibold">
                          {session.fillQuality ? `${(session.fillQuality * 100).toFixed(1)}%` : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Retry Count</p>
                        <p className="font-semibold">
                          {session.retryCount}
                        </p>
                      </div>
                    </div>
                    {session.errorMessage && (
                      <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <p className="text-sm text-red-700 dark:text-red-400">
                          <AlertTriangle className="w-4 h-4 inline mr-2" />
                          {session.errorMessage}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="signals" className="space-y-4">
          <Card className="bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-orange-600 dark:text-orange-400">
                Trade Signals
              </CardTitle>
              <CardDescription>
                Real-time trade signals from master traders
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tradeSignals.slice(0, 10).map((signal) => (
                  <div key={signal.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          signal.side === 'buy' ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'
                        }`}>
                          {signal.side === 'buy' ? 
                            <TrendingUp className="w-5 h-5 text-green-600" /> : 
                            <TrendingDown className="w-5 h-5 text-red-600" />
                          }
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {signal.symbol}
                          </h4>
                          <p className="text-sm text-gray-500">
                            {signal.side.toUpperCase()} • {signal.orderType} • {signal.leverage}x
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline">
                        {signal.platform}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Quantity</p>
                        <p className="font-semibold">
                          {signal.quantity}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Price</p>
                        <p className="font-semibold">
                          {signal.price ? `$${signal.price.toFixed(2)}` : 'Market'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Stop Loss</p>
                        <p className="font-semibold">
                          {signal.stopLoss ? `$${signal.stopLoss.toFixed(2)}` : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Take Profit</p>
                        <p className="font-semibold">
                          {signal.takeProfit ? `$${signal.takeProfit.toFixed(2)}` : 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 text-sm text-gray-500">
                      {new Date(signal.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="executions" className="space-y-4">
          <Card className="bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-indigo-600 dark:text-indigo-400">
                Execution Results
              </CardTitle>
              <CardDescription>
                Trade execution results and performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {executionResults.slice(0, 10).map((result) => (
                  <div key={result.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          result.success ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'
                        }`}>
                          {result.success ? 
                            <CheckCircle className="w-5 h-5 text-green-600" /> : 
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                          }
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            Signal {result.signalId.slice(-8)}
                          </h4>
                          <p className="text-sm text-gray-500">
                            {result.platform} • {result.replicationDelay}ms delay
                          </p>
                        </div>
                      </div>
                      <Badge className={result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                        {result.success ? 'Success' : 'Failed'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Order ID</p>
                        <p className="font-semibold text-sm">
                          {result.orderId ? result.orderId.slice(-8) : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Filled Quantity</p>
                        <p className="font-semibold">
                          {result.filledQuantity || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Filled Price</p>
                        <p className="font-semibold">
                          {result.filledPrice ? `$${result.filledPrice.toFixed(2)}` : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Fees</p>
                        <p className="font-semibold">
                          {result.fees ? `$${result.fees.toFixed(4)}` : 'N/A'}
                        </p>
                      </div>
                    </div>
                    {result.errorMessage && (
                      <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <p className="text-sm text-red-700 dark:text-red-400">
                          <AlertTriangle className="w-4 h-4 inline mr-2" />
                          {result.errorMessage}
                        </p>
                      </div>
                    )}
                    <div className="mt-3 text-sm text-gray-500">
                      {new Date(result.executionTime).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};




