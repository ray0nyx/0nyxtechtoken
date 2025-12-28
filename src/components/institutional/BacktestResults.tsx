/**
 * Backtest Results Component
 * Display and manage backtest results
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { 
  Play, 
  Pause, 
  Square, 
  Download, 
  Eye,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

interface BacktestResult {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  created_at: string;
  results?: {
    total_return: number;
    sharpe_ratio: number;
    max_drawdown: number;
    win_rate: number;
    trades: any[];
  };
}

interface BacktestResultsProps {
  backtests: BacktestResult[];
  selectedBacktest: string | null;
  onSelectBacktest: (id: string) => void;
  onRefresh: () => void;
}

export function BacktestResults({ 
  backtests, 
  selectedBacktest, 
  onSelectBacktest, 
  onRefresh 
}: BacktestResultsProps) {
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
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
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };
  
  const handleCancelBacktest = async (backtestId: string) => {
    try {
      const response = await fetch(`/api/institutional/backtest/${backtestId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to cancel backtest');
      }
      
      toast({
        title: 'Backtest Cancelled',
        description: 'The backtest has been cancelled successfully.',
      });
      
      onRefresh();
    } catch (error) {
      console.error('Error cancelling backtest:', error);
      toast({
        title: 'Error',
        description: 'Failed to cancel backtest. Please try again.',
        variant: 'destructive'
      });
    }
  };
  
  const handleExportResults = async (backtestId: string) => {
    try {
      const response = await fetch(`/api/institutional/backtest/${backtestId}/export`);
      
      if (!response.ok) {
        throw new Error('Failed to export results');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backtest-${backtestId}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: 'Export Successful',
        description: 'Backtest results have been exported.',
      });
    } catch (error) {
      console.error('Error exporting results:', error);
      toast({
        title: 'Error',
        description: 'Failed to export results. Please try again.',
        variant: 'destructive'
      });
    }
  };
  
  const selectedBacktestData = backtests.find(b => b.id === selectedBacktest);
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Backtest Results
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Monitor and analyze your backtest performance
          </p>
        </div>
        
        <Button
          onClick={onRefresh}
          disabled={isRefreshing}
          variant="outline"
          className="border-cyan-200 text-cyan-700 hover:bg-cyan-50 dark:border-cyan-800 dark:text-cyan-400 dark:hover:bg-cyan-900/20"
        >
          {isRefreshing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-cyan-500 mr-2"></div>
              Refreshing...
            </>
          ) : (
            'Refresh'
          )}
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Backtest List */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Recent Backtests
          </h3>
          
          <div className="space-y-3">
            {backtests.map((backtest) => (
              <Card
                key={backtest.id}
                className={`cursor-pointer transition-all ${
                  selectedBacktest === backtest.id
                    ? 'ring-2 ring-cyan-400 bg-cyan-50 dark:bg-cyan-900/20'
                    : 'hover:shadow-md'
                }`}
                onClick={() => onSelectBacktest(backtest.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(backtest.status)}
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {backtest.name}
                      </h4>
                    </div>
                    <Badge className={getStatusColor(backtest.status)}>
                      {backtest.status}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {formatDate(backtest.created_at)}
                  </p>
                  
                  {backtest.status === 'running' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Progress</span>
                        <span className="text-cyan-600 dark:text-cyan-400">
                          {backtest.progress}%
                        </span>
                      </div>
                      <Progress value={backtest.progress} className="h-2" />
                    </div>
                  )}
                  
                  {backtest.results && (
                    <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                      <div className="flex items-center space-x-1">
                        <TrendingUp className="w-3 h-3 text-green-500" />
                        <span className="text-gray-600 dark:text-gray-400">Return:</span>
                        <span className="font-medium text-green-600">
                          {formatPercentage(backtest.results.total_return)}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Target className="w-3 h-3 text-blue-500" />
                        <span className="text-gray-600 dark:text-gray-400">Sharpe:</span>
                        <span className="font-medium text-blue-600">
                          {backtest.results.sharpe_ratio.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        
        {/* Backtest Details */}
        <div className="lg:col-span-2">
          {selectedBacktestData ? (
            <div className="space-y-6">
              {/* Backtest Header */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center space-x-2">
                        {getStatusIcon(selectedBacktestData.status)}
                        <span>{selectedBacktestData.name}</span>
                      </CardTitle>
                      <CardDescription>
                        Created on {formatDate(selectedBacktestData.created_at)}
                      </CardDescription>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {selectedBacktestData.status === 'running' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancelBacktest(selectedBacktestData.id)}
                          className="border-red-200 text-red-700 hover:bg-red-50"
                        >
                          <Square className="w-4 h-4 mr-1" />
                          Cancel
                        </Button>
                      )}
                      
                      {selectedBacktestData.status === 'completed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportResults(selectedBacktestData.id)}
                          className="border-cyan-200 text-cyan-700 hover:bg-cyan-50"
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Export
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>
              
              {/* Results */}
              {selectedBacktestData.results ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-2">
                        <TrendingUp className="w-5 h-5 text-green-500" />
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Total Return</p>
                          <p className="text-2xl font-bold text-green-600">
                            {formatPercentage(selectedBacktestData.results.total_return)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-2">
                        <Target className="w-5 h-5 text-blue-500" />
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Sharpe Ratio</p>
                          <p className="text-2xl font-bold text-blue-600">
                            {selectedBacktestData.results.sharpe_ratio.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-2">
                        <TrendingDown className="w-5 h-5 text-red-500" />
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Max Drawdown</p>
                          <p className="text-2xl font-bold text-red-600">
                            {formatPercentage(selectedBacktestData.results.max_drawdown)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-2">
                        <DollarSign className="w-5 h-5 text-purple-500" />
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Win Rate</p>
                          <p className="text-2xl font-bold text-purple-600">
                            {formatPercentage(selectedBacktestData.results.win_rate)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    {selectedBacktestData.status === 'running' ? (
                      <div className="space-y-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto"></div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Backtest Running
                          </h3>
                          <p className="text-gray-600 dark:text-gray-400">
                            Your backtest is currently executing...
                          </p>
                        </div>
                        <Progress value={selectedBacktestData.progress} className="max-w-md mx-auto" />
                      </div>
                    ) : selectedBacktestData.status === 'failed' ? (
                      <div className="space-y-4">
                        <XCircle className="w-12 h-12 text-red-500 mx-auto" />
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Backtest Failed
                          </h3>
                          <p className="text-gray-600 dark:text-gray-400">
                            There was an error executing your backtest.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <Clock className="w-12 h-12 text-yellow-500 mx-auto" />
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Backtest Pending
                          </h3>
                          <p className="text-gray-600 dark:text-gray-400">
                            Your backtest is queued for execution.
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Eye className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Select a Backtest
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Choose a backtest from the list to view detailed results.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
