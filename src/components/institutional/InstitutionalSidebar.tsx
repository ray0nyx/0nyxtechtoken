/**
 * Institutional Sidebar Component
 * Sidebar with quick actions and status overview
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Zap,
  Shield,
  Link as LinkIcon
} from 'lucide-react';

interface InstitutionalSidebarProps {
  backtests: any[];
  exchanges: any[];
  onSelectBacktest: (id: string) => void;
  onTabChange: (tab: string) => void;
}

export function InstitutionalSidebar({
  backtests,
  exchanges,
  onSelectBacktest,
  onTabChange
}: InstitutionalSidebarProps) {

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'running':
        return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-cyan-500"></div>;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'running':
        return 'bg-cyan-100 text-cyan-700 border-cyan-200';
      default:
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const activeBacktests = backtests.filter(b => b.status === 'running');
  const completedBacktests = backtests.filter(b => b.status === 'completed');
  const activeExchanges = exchanges.filter(e => e.is_active);

  const totalReturn = completedBacktests.reduce((sum, backtest) => {
    return sum + (backtest.results?.total_return || 0);
  }, 0);

  const avgReturn = completedBacktests.length > 0 ? totalReturn / completedBacktests.length : 0;

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <Card className="dark:bg-black dark:border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="w-5 h-5 text-cyan-600" />
            <span>Quick Stats</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {backtests.length}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Backtests</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {activeBacktests.length}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Running</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {activeExchanges.length}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Exchanges</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatPercentage(avgReturn)}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Avg Return</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="dark:bg-black dark:border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="w-5 h-5 text-cyan-600" />
            <span>Quick Actions</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={() => onTabChange('strategy')}
            variant="outline"
            className="w-full justify-start border-cyan-200 text-cyan-700 hover:bg-cyan-50 dark:border-cyan-800 dark:text-cyan-400 dark:hover:bg-cyan-900/20"
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            New Backtest
          </Button>

          <Button
            onClick={() => onTabChange('exchanges')}
            variant="outline"
            className="w-full justify-start border-cyan-200 text-cyan-700 hover:bg-cyan-50 dark:border-cyan-800 dark:text-cyan-400 dark:hover:bg-cyan-900/20"
          >
            <LinkIcon className="w-4 h-4 mr-2" />
            Link Exchange
          </Button>

          <Button
            onClick={() => onTabChange('risk')}
            variant="outline"
            className="w-full justify-start border-cyan-200 text-cyan-700 hover:bg-cyan-50 dark:border-cyan-800 dark:text-cyan-400 dark:hover:bg-cyan-900/20"
          >
            <Shield className="w-4 h-4 mr-2" />
            Risk Settings
          </Button>
        </CardContent>
      </Card>

      {/* Recent Backtests */}
      <Card className="dark:bg-black dark:border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-cyan-600" />
            <span>Recent Backtests</span>
          </CardTitle>
          <CardDescription>
            Latest backtest results
          </CardDescription>
        </CardHeader>
        <CardContent>
          {backtests.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                No backtests yet
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {backtests.slice(0, 5).map((backtest) => (
                <div
                  key={backtest.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                  onClick={() => onSelectBacktest(backtest.id)}
                >
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(backtest.status)}
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {backtest.name}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {formatDate(backtest.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Badge className={getStatusColor(backtest.status)}>
                      {backtest.status}
                    </Badge>

                    {backtest.results && (
                      <div className="text-right">
                        <p className={`text-xs font-medium ${backtest.results.total_return >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                          {formatPercentage(backtest.results.total_return)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Exchange Status */}
      <Card className="dark:bg-black dark:border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <LinkIcon className="w-5 h-5 text-cyan-600" />
            <span>Exchange Status</span>
          </CardTitle>
          <CardDescription>
            Connected exchange accounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {exchanges.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                No exchanges connected
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {exchanges.map((exchange) => (
                <div
                  key={exchange.id}
                  className="flex items-center justify-between p-2 rounded-lg"
                >
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${exchange.is_active ? 'bg-green-500' : 'bg-red-500'
                      }`}></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                        {exchange.exchange_name}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {exchange.is_active ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                  </div>

                  <Badge className={exchange.is_active ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}>
                    {exchange.is_active ? 'Connected' : 'Disconnected'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Summary */}
      {completedBacktests.length > 0 && (
        <Card className="dark:bg-black dark:border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-cyan-600" />
              <span>Performance Summary</span>
            </CardTitle>
            <CardDescription>
              Overall backtest performance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total Return</span>
              <span className={`text-sm font-medium ${totalReturn >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                {formatPercentage(totalReturn)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Average Return</span>
              <span className={`text-sm font-medium ${avgReturn >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                {formatPercentage(avgReturn)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Success Rate</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {Math.round((completedBacktests.filter(b => b.results?.total_return > 0).length / completedBacktests.length) * 100)}%
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Best Return</span>
              <span className="text-sm font-medium text-green-600">
                {formatPercentage(Math.max(...completedBacktests.map(b => b.results?.total_return || 0)))}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
