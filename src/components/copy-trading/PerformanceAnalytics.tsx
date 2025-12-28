/**
 * Performance Analytics Component
 * Comprehensive performance analysis and reporting for copy trading
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  PieChart, 
  Activity,
  Clock,
  DollarSign,
  Target,
  Users,
  Shield,
  AlertTriangle,
  CheckCircle,
  Download,
  RefreshCw,
  Calendar,
  Zap
} from 'lucide-react';

interface PerformanceMetrics {
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  successRate: number;
  averageLatencyMs: number;
  totalPnl: number;
  dailyPnl: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  profitFactor: number;
  platformPerformance: Record<string, {
    totalTrades: number;
    successfulTrades: number;
    averageLatency: number;
    successRate: number;
  }>;
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

interface PerformanceAnalyticsProps {
  performanceMetrics: PerformanceMetrics | null;
  tradeSignals: TradeSignal[];
  executionResults: ExecutionResult[];
  copyTradingSessions: CopyTradingSession[];
  followerRelationships: FollowerRelationship[];
  masterTraders: MasterTraderProfile[];
}

export const PerformanceAnalytics: React.FC<PerformanceAnalyticsProps> = ({
  performanceMetrics,
  tradeSignals,
  executionResults,
  copyTradingSessions,
  followerRelationships,
  masterTraders
}) => {
  const [timeRange, setTimeRange] = useState('30d');
  const [selectedPlatform, setSelectedPlatform] = useState('all');

  // Calculate analytics data
  const analyticsData = useMemo(() => {
    if (!performanceMetrics) return null;

    // Platform performance
    const platformStats = Object.entries(performanceMetrics.platformPerformance).map(([platform, stats]) => ({
      platform,
      ...stats,
      totalVolume: stats.totalTrades * 1000, // Mock volume calculation
      avgSlippage: Math.random() * 0.01 // Mock slippage
    }));

    // Time-based performance (mock data for demonstration)
    const dailyPerformance = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return {
        date: date.toISOString().split('T')[0],
        pnl: (Math.random() - 0.5) * 1000,
        trades: Math.floor(Math.random() * 20) + 5,
        latency: Math.random() * 50 + 25
      };
    });

    // Strategy performance
    const strategyPerformance = followerRelationships.map(rel => {
      const master = masterTraders.find(t => t.id === rel.masterTraderId);
      return {
        strategy: master?.strategyType || 'unknown',
        pnl: rel.totalPnl,
        trades: rel.totalTrades,
        successRate: rel.totalTrades > 0 ? (rel.successfulTrades / rel.totalTrades) * 100 : 0
      };
    }).reduce((acc, curr) => {
      if (!acc[curr.strategy]) {
        acc[curr.strategy] = { pnl: 0, trades: 0, successRate: 0, count: 0 };
      }
      acc[curr.strategy].pnl += curr.pnl;
      acc[curr.strategy].trades += curr.trades;
      acc[curr.strategy].successRate += curr.successRate;
      acc[curr.strategy].count += 1;
      return acc;
    }, {} as { [key: string]: { pnl: number; trades: number; successRate: number; count: number } });

    // Risk metrics
    const riskMetrics = {
      maxDrawdown: performanceMetrics.maxDrawdown,
      var95: performanceMetrics.var95 || 0.02,
      sharpeRatio: performanceMetrics.sharpeRatio,
      winRate: performanceMetrics.winRate,
      profitFactor: performanceMetrics.profitFactor
    };

    return {
      platformStats,
      dailyPerformance,
      strategyPerformance,
      riskMetrics
    };
  }, [performanceMetrics, followerRelationships, masterTraders]);

  const getPerformanceColor = (value: number, type: 'pnl' | 'rate' | 'latency') => {
    switch (type) {
      case 'pnl':
        return value >= 0 ? 'text-green-600' : 'text-red-600';
      case 'rate':
        return value >= 80 ? 'text-green-600' : value >= 60 ? 'text-yellow-600' : 'text-red-600';
      case 'latency':
        return value <= 50 ? 'text-green-600' : value <= 100 ? 'text-yellow-600' : 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getPerformanceIcon = (value: number, type: 'pnl' | 'rate' | 'latency') => {
    switch (type) {
      case 'pnl':
        return value >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />;
      case 'rate':
        return value >= 80 ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />;
      case 'latency':
        return value <= 50 ? <Zap className="w-4 h-4" /> : <Clock className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  if (!performanceMetrics || !analyticsData) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No Performance Data
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Start copy trading to see performance analytics
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Performance Analytics
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Comprehensive analysis of your copy trading performance
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 Days</SelectItem>
              <SelectItem value="30d">30 Days</SelectItem>
              <SelectItem value="90d">90 Days</SelectItem>
              <SelectItem value="1y">1 Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white dark:bg-black shadow-sm border-gray-200 dark:border-gray-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total P&L</p>
                <p className={`text-2xl font-bold ${
                  performanceMetrics.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  ${performanceMetrics.totalPnl.toFixed(2)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
            <div className="mt-2">
              <span className={`text-sm font-medium ${
                performanceMetrics.dailyPnl >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {performanceMetrics.dailyPnl >= 0 ? '+' : ''}${performanceMetrics.dailyPnl.toFixed(2)} Today
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-black shadow-sm border-gray-200 dark:border-gray-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Success Rate</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {performanceMetrics.successRate.toFixed(1)}%
                </p>
              </div>
              <Target className="h-8 w-8 text-blue-500" />
            </div>
            <div className="mt-2">
              <span className="text-sm text-gray-600">
                {performanceMetrics.successfulTrades} / {performanceMetrics.totalTrades} trades
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-black shadow-sm border-gray-200 dark:border-gray-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Latency</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {performanceMetrics.averageLatencyMs.toFixed(0)}ms
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

        <Card className="bg-white dark:bg-black shadow-sm border-gray-200 dark:border-gray-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Sharpe Ratio</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {performanceMetrics.sharpeRatio.toFixed(2)}
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-orange-500" />
            </div>
            <div className="mt-2">
              <span className="text-sm text-gray-600">
                Max DD: {(performanceMetrics.maxDrawdown * 100).toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="platforms">Platforms</TabsTrigger>
          <TabsTrigger value="strategies">Strategies</TabsTrigger>
          <TabsTrigger value="risk">Risk Analysis</TabsTrigger>
          <TabsTrigger value="latency">Latency</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Performance Chart */}
            <Card className="bg-white dark:bg-black shadow-sm border-gray-200 dark:border-gray-900">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                  Daily Performance
                </CardTitle>
                <CardDescription>
                  P&L and trade volume over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analyticsData.dailyPerformance.slice(-7).map((day, index) => (
                    <div key={day.date} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-sm text-gray-600">
                          {new Date(day.date).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className={`text-sm font-medium ${
                            day.pnl >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            ${day.pnl.toFixed(2)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {day.trades} trades
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Performance Summary */}
            <Card className="bg-white dark:bg-black shadow-sm border-gray-200 dark:border-gray-900">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-green-600 dark:text-green-400">
                  Performance Summary
                </CardTitle>
                <CardDescription>
                  Key performance indicators
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Win Rate</span>
                    <div className="flex items-center space-x-2">
                      {getPerformanceIcon(performanceMetrics.winRate * 100, 'rate')}
                      <span className={`font-medium ${
                        getPerformanceColor(performanceMetrics.winRate * 100, 'rate')
                      }`}>
                        {(performanceMetrics.winRate * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Profit Factor</span>
                    <div className="flex items-center space-x-2">
                      {getPerformanceIcon(performanceMetrics.profitFactor, 'rate')}
                      <span className={`font-medium ${
                        getPerformanceColor(performanceMetrics.profitFactor, 'rate')
                      }`}>
                        {performanceMetrics.profitFactor.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Max Drawdown</span>
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <span className="font-medium text-red-600">
                        {(performanceMetrics.maxDrawdown * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Sharpe Ratio</span>
                    <div className="flex items-center space-x-2">
                      {getPerformanceIcon(performanceMetrics.sharpeRatio, 'rate')}
                      <span className={`font-medium ${
                        getPerformanceColor(performanceMetrics.sharpeRatio, 'rate')
                      }`}>
                        {performanceMetrics.sharpeRatio.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="platforms" className="space-y-4">
          <Card className="bg-white dark:bg-black shadow-sm border-gray-200 dark:border-gray-900">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-purple-600 dark:text-purple-400">
                Platform Performance
              </CardTitle>
              <CardDescription>
                Performance metrics by trading platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.platformStats.map((platform) => (
                  <div key={platform.platform} className="border border-gray-200 dark:border-gray-900 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {platform.platform}
                      </h4>
                      <Badge variant="outline">
                        {platform.totalTrades} trades
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Success Rate</p>
                        <p className="font-semibold">
                          {(platform.successRate * 100).toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Avg Latency</p>
                        <p className="font-semibold">
                          {platform.averageLatency.toFixed(0)}ms
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Total Volume</p>
                        <p className="font-semibold">
                          ${platform.totalVolume.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Avg Slippage</p>
                        <p className="font-semibold">
                          {(platform.avgSlippage * 100).toFixed(3)}%
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="strategies" className="space-y-4">
          <Card className="bg-white dark:bg-black shadow-sm border-gray-200 dark:border-gray-900">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-orange-600 dark:text-orange-400">
                Strategy Performance
              </CardTitle>
              <CardDescription>
                Performance by trading strategy
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(analyticsData.strategyPerformance).map(([strategy, stats]) => (
                  <div key={strategy} className="border border-gray-200 dark:border-gray-900 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900 dark:text-white capitalize">
                        {strategy.replace('_', ' ')}
                      </h4>
                      <Badge variant="outline">
                        {stats.count} relationships
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Total P&L</p>
                        <p className={`font-semibold ${
                          stats.pnl >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          ${stats.pnl.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Total Trades</p>
                        <p className="font-semibold">
                          {stats.trades}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Avg Success Rate</p>
                        <p className="font-semibold">
                          {(stats.successRate / stats.count).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white dark:bg-black shadow-sm border-gray-200 dark:border-gray-900">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-red-600 dark:text-red-400">
                  Risk Metrics
                </CardTitle>
                <CardDescription>
                  Current risk exposure and limits
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Max Drawdown</span>
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <span className="font-medium text-red-600">
                        {(analyticsData.riskMetrics.maxDrawdown * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">VaR 95%</span>
                    <div className="flex items-center space-x-2">
                      <Shield className="w-4 h-4 text-orange-500" />
                      <span className="font-medium text-orange-600">
                        {(analyticsData.riskMetrics.var95 * 100).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Sharpe Ratio</span>
                    <div className="flex items-center space-x-2">
                      {getPerformanceIcon(analyticsData.riskMetrics.sharpeRatio, 'rate')}
                      <span className={`font-medium ${
                        getPerformanceColor(analyticsData.riskMetrics.sharpeRatio, 'rate')
                      }`}>
                        {analyticsData.riskMetrics.sharpeRatio.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-black shadow-sm border-gray-200 dark:border-gray-900">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                  Risk Alerts
                </CardTitle>
                <CardDescription>
                  Current risk warnings and recommendations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analyticsData.riskMetrics.maxDrawdown > 0.15 && (
                    <div className="flex items-center space-x-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <span className="text-sm text-red-700 dark:text-red-400">
                        High drawdown detected - consider reducing position sizes
                      </span>
                    </div>
                  )}
                  {analyticsData.riskMetrics.sharpeRatio < 1.0 && (
                    <div className="flex items-center space-x-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-yellow-500" />
                      <span className="text-sm text-yellow-700 dark:text-yellow-400">
                        Low Sharpe ratio - review strategy selection
                      </span>
                    </div>
                  )}
                  {performanceMetrics.averageLatencyMs > 100 && (
                    <div className="flex items-center space-x-2 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                      <Clock className="w-4 h-4 text-orange-500" />
                      <span className="text-sm text-orange-700 dark:text-orange-400">
                        High latency detected - check platform connections
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="latency" className="space-y-4">
          <Card className="bg-white dark:bg-black shadow-sm border-gray-200 dark:border-gray-900">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-purple-600 dark:text-purple-400">
                Latency Analysis
              </CardTitle>
              <CardDescription>
                Execution latency and performance optimization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 border border-gray-200 dark:border-gray-900 rounded-lg">
                    <Clock className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Average Latency</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {performanceMetrics.averageLatencyMs.toFixed(0)}ms
                    </p>
                  </div>
                  <div className="text-center p-4 border border-gray-200 dark:border-gray-900 rounded-lg">
                    <Zap className="w-8 h-8 text-green-500 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Target Latency</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      &lt;100ms
                    </p>
                  </div>
                  <div className="text-center p-4 border border-gray-200 dark:border-gray-900 rounded-lg">
                    <Target className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Performance</p>
                    <p className={`text-2xl font-bold ${
                      performanceMetrics.averageLatencyMs <= 100 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {performanceMetrics.averageLatencyMs <= 100 ? 'Optimal' : 'Needs Improvement'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
