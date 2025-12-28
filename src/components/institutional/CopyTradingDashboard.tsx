/**
 * Copy Trading Dashboard
 * Real-time monitoring and control for copy trading operations
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { 
  Play, 
  Pause, 
  Square, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Activity,
  BarChart3,
  Settings
} from 'lucide-react';

interface CopyTradingStatus {
  config_id: string;
  source_backtest_id: string;
  target_exchanges: string[];
  sync_status: 'active' | 'paused' | 'error' | 'disabled';
  last_sync_at: string;
  total_trades: number;
  successful_trades: number;
  failed_trades: number;
  is_active: boolean;
}

interface TradeExecution {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  status: 'pending' | 'sent' | 'filled' | 'failed';
  exchange: string;
  timestamp: string;
  execution_time?: number;
}

interface ReconciliationResult {
  id: string;
  total_trades: number;
  matched_trades: number;
  mismatched_trades: number;
  missing_trades: number;
  duplicate_trades: number;
  error_trades: number;
  created_at: string;
}

interface CopyTradingDashboardProps {
  configId?: string;
  onConfigChange?: (configId: string) => void;
}

export const CopyTradingDashboard: React.FC<CopyTradingDashboardProps> = ({ 
  configId, 
  onConfigChange 
}) => {
  const [status, setStatus] = useState<CopyTradingStatus | null>(null);
  const [recentTrades, setRecentTrades] = useState<TradeExecution[]>([]);
  const [reconciliationHistory, setReconciliationHistory] = useState<ReconciliationResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (configId) {
      loadDashboardData();
      // Set up real-time updates
      const interval = setInterval(loadDashboardData, 5000); // Update every 5 seconds
      return () => clearInterval(interval);
    }
  }, [configId]);

  const loadDashboardData = async () => {
    if (!configId) return;
    
    try {
      setIsRefreshing(true);
      
      // Load status, recent trades, and reconciliation history in parallel
      const [statusData, tradesData, reconciliationData] = await Promise.all([
        fetchCopyTradingStatus(configId),
        fetchRecentTrades(configId),
        fetchReconciliationHistory(configId)
      ]);
      
      setStatus(statusData);
      setRecentTrades(tradesData);
      setReconciliationHistory(reconciliationData);
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive'
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchCopyTradingStatus = async (configId: string): Promise<CopyTradingStatus> => {
    const response = await fetch(`/api/institutional/copy-trading/status/${configId}`);
    if (!response.ok) throw new Error('Failed to fetch status');
    return await response.json();
  };

  const fetchRecentTrades = async (configId: string): Promise<TradeExecution[]> => {
    const response = await fetch(`/api/institutional/copy-trading/trades/${configId}?limit=20`);
    if (!response.ok) throw new Error('Failed to fetch trades');
    return await response.json();
  };

  const fetchReconciliationHistory = async (configId: string): Promise<ReconciliationResult[]> => {
    const response = await fetch(`/api/institutional/copy-trading/reconciliation-history/${configId}`);
    if (!response.ok) throw new Error('Failed to fetch reconciliation history');
    const data = await response.json();
    return data.history || [];
  };

  const handleStartCopyTrading = async () => {
    if (!configId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/institutional/copy-trading/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config_id: configId })
      });
      
      if (!response.ok) throw new Error('Failed to start copy trading');
      
      toast({
        title: 'Copy Trading Started',
        description: 'Copy trading has been started successfully'
      });
      
      await loadDashboardData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopCopyTrading = async () => {
    if (!configId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/institutional/copy-trading/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config_id: configId })
      });
      
      if (!response.ok) throw new Error('Failed to stop copy trading');
      
      toast({
        title: 'Copy Trading Stopped',
        description: 'Copy trading has been stopped successfully'
      });
      
      await loadDashboardData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePauseCopyTrading = async () => {
    if (!configId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/institutional/copy-trading/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config_id: configId })
      });
      
      if (!response.ok) throw new Error('Failed to pause copy trading');
      
      toast({
        title: 'Copy Trading Paused',
        description: 'Copy trading has been paused successfully'
      });
      
      await loadDashboardData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'paused':
        return <Pause className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Square className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTradeStatusIcon = (status: string) => {
    switch (status) {
      case 'filled':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-blue-500" />;
    }
  };

  if (!configId) {
    return (
      <Card className="bg-white dark:bg-gray-800 shadow-lg border-gray-200 dark:border-gray-700">
        <CardContent className="p-6">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Select a copy trading configuration to view the dashboard</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <Card className="bg-white dark:bg-gray-800 shadow-lg border-gray-200 dark:border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-xl font-semibold text-cyan-600 dark:text-cyan-400">
              Copy Trading Status
            </CardTitle>
            <CardDescription>
              Real-time monitoring of copy trading operations
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadDashboardData}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {status ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  {getStatusIcon(status.sync_status)}
                  <span className="text-sm font-medium">Status</span>
                </div>
                <Badge className={getStatusColor(status.sync_status)}>
                  {status.sync_status.toUpperCase()}
                </Badge>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Success Rate</span>
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {status.total_trades > 0 
                    ? ((status.successful_trades / status.total_trades) * 100).toFixed(1)
                    : 0}%
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <BarChart3 className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">Total Trades</span>
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  {status.total_trades}
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium">Last Sync</span>
                </div>
                <div className="text-sm text-gray-600">
                  {status.last_sync_at 
                    ? new Date(status.last_sync_at).toLocaleString()
                    : 'Never'
                  }
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Loading status...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Control Panel */}
      <Card className="bg-white dark:bg-gray-800 shadow-lg border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-purple-600 dark:text-purple-400">
            Control Panel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            {status?.sync_status === 'active' ? (
              <>
                <Button
                  onClick={handlePauseCopyTrading}
                  disabled={isLoading}
                  variant="outline"
                  className="text-yellow-600 border-yellow-600 hover:bg-yellow-50"
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </Button>
                <Button
                  onClick={handleStopCopyTrading}
                  disabled={isLoading}
                  variant="outline"
                  className="text-red-600 border-red-600 hover:bg-red-50"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              </>
            ) : (
              <Button
                onClick={handleStartCopyTrading}
                disabled={isLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Copy Trading
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Tabs */}
      <Tabs defaultValue="trades" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="trades">Recent Trades</TabsTrigger>
          <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>
        
        <TabsContent value="trades" className="space-y-4">
          <Card className="bg-white dark:bg-gray-800 shadow-lg border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                Recent Trade Executions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentTrades.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Side</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Exchange</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentTrades.map((trade) => (
                      <TableRow key={trade.id}>
                        <TableCell className="font-medium">{trade.symbol}</TableCell>
                        <TableCell>
                          <Badge variant={trade.side === 'buy' ? 'default' : 'secondary'}>
                            {trade.side.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>{trade.quantity}</TableCell>
                        <TableCell>${trade.price.toFixed(2)}</TableCell>
                        <TableCell>{trade.exchange}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {getTradeStatusIcon(trade.status)}
                            <span className="capitalize">{trade.status}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(trade.timestamp).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No recent trades found
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="reconciliation" className="space-y-4">
          <Card className="bg-white dark:bg-gray-800 shadow-lg border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-orange-600 dark:text-orange-400">
                Trade Reconciliation History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {reconciliationHistory.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Total Trades</TableHead>
                      <TableHead>Matched</TableHead>
                      <TableHead>Mismatched</TableHead>
                      <TableHead>Missing</TableHead>
                      <TableHead>Duplicates</TableHead>
                      <TableHead>Errors</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reconciliationHistory.map((result) => (
                      <TableRow key={result.id}>
                        <TableCell>
                          {new Date(result.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{result.total_trades}</TableCell>
                        <TableCell className="text-green-600">{result.matched_trades}</TableCell>
                        <TableCell className="text-yellow-600">{result.mismatched_trades}</TableCell>
                        <TableCell className="text-red-600">{result.missing_trades}</TableCell>
                        <TableCell className="text-orange-600">{result.duplicate_trades}</TableCell>
                        <TableCell className="text-red-600">{result.error_trades}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No reconciliation history found
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="performance" className="space-y-4">
          <Card className="bg-white dark:bg-gray-800 shadow-lg border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-green-600 dark:text-green-400">
                Performance Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              {status ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Success Rate</span>
                        <span>
                          {status.total_trades > 0 
                            ? ((status.successful_trades / status.total_trades) * 100).toFixed(1)
                            : 0}%
                        </span>
                      </div>
                      <Progress 
                        value={status.total_trades > 0 ? (status.successful_trades / status.total_trades) * 100 : 0}
                        className="h-2"
                      />
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Failed Trades</span>
                        <span>{status.failed_trades}</span>
                      </div>
                      <Progress 
                        value={status.total_trades > 0 ? (status.failed_trades / status.total_trades) * 100 : 0}
                        className="h-2"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600">
                        {status.successful_trades}
                      </div>
                      <div className="text-sm text-gray-600">Successful Trades</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-3xl font-bold text-red-600">
                        {status.failed_trades}
                      </div>
                      <div className="text-sm text-gray-600">Failed Trades</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Loading performance metrics...
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
