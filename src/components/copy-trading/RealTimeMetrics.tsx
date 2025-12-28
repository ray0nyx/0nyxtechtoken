/**
 * Real-Time Metrics Component
 * Live monitoring of copy trading performance and system status
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  DollarSign,
  Target,
  Zap,
  AlertTriangle,
  CheckCircle,
  Users,
  BarChart3,
  RefreshCw
} from 'lucide-react';

interface RealTimeMetricsProps {
  performanceMetrics: {
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
  } | null;
  activeSessions: number;
  activeRelationships: number;
  lastUpdate: string;
  onRefresh: () => void;
}

export const RealTimeMetrics: React.FC<RealTimeMetricsProps> = ({
  performanceMetrics,
  activeSessions,
  activeRelationships,
  lastUpdate,
  onRefresh
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
  };

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

  const getStatusColor = (value: number, type: 'sessions' | 'relationships') => {
    switch (type) {
      case 'sessions':
        return value > 0 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      case 'relationships':
        return value > 0 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  if (!performanceMetrics) {
    return (
      <div className="text-center py-8">
        <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No Metrics Available
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Start copy trading to see real-time metrics
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Live Metrics
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Last updated: {new Date(lastUpdate).toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* P&L Metrics */}
        <Card className="bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-900 dark:text-white">P&L Performance</h4>
              <DollarSign className="w-5 h-5 text-green-500" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total P&L</span>
                <div className="flex items-center space-x-1">
                  {getPerformanceIcon(performanceMetrics.totalPnl, 'pnl')}
                  <span className={`font-semibold ${
                    getPerformanceColor(performanceMetrics.totalPnl, 'pnl')
                  }`}>
                    ${performanceMetrics.totalPnl.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Daily P&L</span>
                <div className="flex items-center space-x-1">
                  {getPerformanceIcon(performanceMetrics.dailyPnl, 'pnl')}
                  <span className={`font-semibold ${
                    getPerformanceColor(performanceMetrics.dailyPnl, 'pnl')
                  }`}>
                    ${performanceMetrics.dailyPnl.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Max Drawdown</span>
                <span className="font-semibold text-red-600">
                  {(performanceMetrics.maxDrawdown * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trading Metrics */}
        <Card className="bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-900 dark:text-white">Trading Performance</h4>
              <Target className="w-5 h-5 text-blue-500" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Success Rate</span>
                <div className="flex items-center space-x-1">
                  {getPerformanceIcon(performanceMetrics.successRate, 'rate')}
                  <span className={`font-semibold ${
                    getPerformanceColor(performanceMetrics.successRate, 'rate')
                  }`}>
                    {performanceMetrics.successRate.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Win Rate</span>
                <div className="flex items-center space-x-1">
                  {getPerformanceIcon(performanceMetrics.winRate * 100, 'rate')}
                  <span className={`font-semibold ${
                    getPerformanceColor(performanceMetrics.winRate * 100, 'rate')
                  }`}>
                    {(performanceMetrics.winRate * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Trades</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {performanceMetrics.totalTrades}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Latency Metrics */}
        <Card className="bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-900 dark:text-white">Execution Speed</h4>
              <Clock className="w-5 h-5 text-purple-500" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Avg Latency</span>
                <div className="flex items-center space-x-1">
                  {getPerformanceIcon(performanceMetrics.averageLatencyMs, 'latency')}
                  <span className={`font-semibold ${
                    getPerformanceColor(performanceMetrics.averageLatencyMs, 'latency')
                  }`}>
                    {performanceMetrics.averageLatencyMs.toFixed(0)}ms
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Target</span>
                <span className="text-sm text-blue-600 font-medium">
                  &lt;100ms
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Status</span>
                <Badge className={
                  performanceMetrics.averageLatencyMs <= 100 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                }>
                  {performanceMetrics.averageLatencyMs <= 100 ? 'Optimal' : 'Needs Improvement'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Status */}
        <Card className="bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-900 dark:text-white">System Status</h4>
              <Activity className="w-5 h-5 text-orange-500" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Active Sessions</span>
                <Badge className={getStatusColor(activeSessions, 'sessions')}>
                  {activeSessions}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Relationships</span>
                <Badge className={getStatusColor(activeRelationships, 'relationships')}>
                  {activeRelationships}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">System Health</span>
                <div className="flex items-center space-x-1">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium text-green-600">Healthy</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Summary */}
      <Card className="bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900 dark:text-white">Performance Summary</h4>
            <BarChart3 className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-500">Sharpe Ratio</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {performanceMetrics.sharpeRatio.toFixed(2)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">Profit Factor</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {performanceMetrics.profitFactor.toFixed(2)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">Successful Trades</p>
              <p className="text-lg font-semibold text-green-600">
                {performanceMetrics.successfulTrades}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">Failed Trades</p>
              <p className="text-lg font-semibold text-red-600">
                {performanceMetrics.failedTrades}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900 dark:text-white">Quick Actions</h4>
            <Users className="w-5 h-5 text-blue-500" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <button className="p-2 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
              View All Trades
            </button>
            <button className="p-2 text-sm bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors">
              Export Data
            </button>
            <button className="p-2 text-sm bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors">
              View Analytics
            </button>
            <button className="p-2 text-sm bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors">
              Risk Settings
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};




