/**
 * QuantConnect-style Backtest Results Dashboard
 * Comprehensive results visualization with interactive charts
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Target, 
  AlertTriangle,
  Download,
  Share2,
  BarChart3,
  PieChart,
  Activity,
  Calendar,
  Clock,
  Zap
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Cell,
  Area,
  AreaChart,
  Scatter,
  ScatterChart
} from 'recharts';
import { toast } from 'sonner';

interface BacktestResults {
  id: string;
  name: string;
  status: 'completed' | 'running' | 'failed' | 'cancelled';
  progress: number;
  startDate: string;
  endDate: string;
  duration: number;
  metrics: BacktestMetrics;
  trades: Trade[];
  portfolioSnapshots: PortfolioSnapshot[];
  benchmarkData: BenchmarkData[];
  logs: string[];
  error?: string;
}

interface BacktestMetrics {
  totalReturn: number;
  annualReturn: number;
  volatility: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  maxDrawdownDuration: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  beta: number;
  alpha: number;
  informationRatio: number;
  trackingError: number;
  treynorRatio: number;
  jensenAlpha: number;
}

interface Trade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  timestamp: string;
  commission: number;
  slippage: number;
  pnl: number;
  tradeType: string;
}

interface PortfolioSnapshot {
  timestamp: string;
  totalValue: number;
  cash: number;
  holdings: Record<string, number>;
  pnl: number;
  drawdown: number;
  leverage: number;
}

interface BenchmarkData {
  timestamp: string;
  value: number;
  return: number;
}

interface BacktestResultsDashboardProps {
  results: BacktestResults;
  onExport?: (format: 'pdf' | 'csv' | 'json') => void;
  onShare?: () => void;
  onRerun?: () => void;
  showActions?: boolean;
}

const COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  info: '#06b6d4',
  purple: '#8b5cf6',
  pink: '#ec4899',
  gray: '#6b7280'
};

const CHART_COLORS = [
  COLORS.primary,
  COLORS.success,
  COLORS.danger,
  COLORS.warning,
  COLORS.info,
  COLORS.purple,
  COLORS.pink
];

export const BacktestResultsDashboard: React.FC<BacktestResultsDashboardProps> = ({
  results,
  onExport,
  onShare,
  onRerun,
  showActions = true
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedMetric, setSelectedMetric] = useState('totalReturn');

  // Calculate additional metrics
  const calculatedMetrics = useMemo(() => {
    const { metrics } = results;
    
    return {
      ...metrics,
      netProfit: metrics.totalReturn * 100000, // Assuming $100k initial capital
      winLossRatio: metrics.averageWin / Math.abs(metrics.averageLoss),
      expectancy: (metrics.winRate * metrics.averageWin) - ((1 - metrics.winRate) * Math.abs(metrics.averageLoss)),
      recoveryFactor: metrics.totalReturn / Math.abs(metrics.maxDrawdown),
      profitToMaxDrawdown: metrics.totalReturn / Math.abs(metrics.maxDrawdown)
    };
  }, [results.metrics]);

  // Prepare chart data
  const equityCurveData = useMemo(() => {
    return results.portfolioSnapshots.map(snapshot => ({
      date: new Date(snapshot.timestamp).getTime(),
      value: snapshot.totalValue,
      pnl: snapshot.pnl,
      drawdown: snapshot.drawdown,
      benchmark: results.benchmarkData.find(b => 
        new Date(b.timestamp).getTime() === new Date(snapshot.timestamp).getTime()
      )?.value || 0
    }));
  }, [results.portfolioSnapshots, results.benchmarkData]);

  const dailyReturnsData = useMemo(() => {
    const returns = [];
    for (let i = 1; i < results.portfolioSnapshots.length; i++) {
      const current = results.portfolioSnapshots[i];
      const previous = results.portfolioSnapshots[i - 1];
      const dailyReturn = (current.totalValue - previous.totalValue) / previous.totalValue;
      returns.push({
        date: new Date(current.timestamp).getTime(),
        return: dailyReturn * 100,
        positive: dailyReturn >= 0
      });
    }
    return returns;
  }, [results.portfolioSnapshots]);

  const tradesData = useMemo(() => {
    return results.trades.map(trade => ({
      date: new Date(trade.timestamp).getTime(),
      pnl: trade.pnl,
      side: trade.side,
      symbol: trade.symbol
    }));
  }, [results.trades]);

  const monthlyReturnsData = useMemo(() => {
    const monthlyData: Record<string, number> = {};
    
    results.portfolioSnapshots.forEach(snapshot => {
      const date = new Date(snapshot.timestamp);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = 0;
      }
    });

    // Calculate monthly returns
    const monthlyReturns = Object.keys(monthlyData).map(month => {
      const monthSnapshots = results.portfolioSnapshots.filter(s => {
        const date = new Date(s.timestamp);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        return monthKey === month;
      });

      if (monthSnapshots.length < 2) return { month, return: 0 };

      const first = monthSnapshots[0];
      const last = monthSnapshots[monthSnapshots.length - 1];
      const monthlyReturn = (last.totalValue - first.totalValue) / first.totalValue;

      return {
        month,
        return: monthlyReturn * 100,
        positive: monthlyReturn >= 0
      };
    });

    return monthlyReturns;
  }, [results.portfolioSnapshots]);

  const getMetricColor = (value: number, type: 'return' | 'risk' | 'ratio' | 'neutral' = 'neutral') => {
    if (type === 'return') {
      return value >= 0 ? COLORS.success : COLORS.danger;
    }
    if (type === 'risk') {
      return value <= 0.1 ? COLORS.success : value <= 0.2 ? COLORS.warning : COLORS.danger;
    }
    if (type === 'ratio') {
      return value >= 1 ? COLORS.success : value >= 0.5 ? COLORS.warning : COLORS.danger;
    }
    return COLORS.gray;
  };

  const formatNumber = (value: number, decimals: number = 2, prefix: string = '', suffix: string = '') => {
    return `${prefix}${value.toFixed(decimals)}${suffix}`;
  };

  const formatPercentage = (value: number, decimals: number = 2) => {
    return `${(value * 100).toFixed(decimals)}%`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  if (results.status === 'running') {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-6 text-center">
            <Activity className="h-12 w-12 mx-auto mb-4 text-primary animate-pulse" />
            <h3 className="text-lg font-semibold mb-2">Backtest Running</h3>
            <p className="text-muted-foreground mb-4">
              Your backtest is currently running. Progress will be updated in real-time.
            </p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{results.progress}%</span>
              </div>
              <Progress value={results.progress} className="w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (results.status === 'failed') {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h3 className="text-lg font-semibold mb-2">Backtest Failed</h3>
            <p className="text-muted-foreground mb-4">
              {results.error || 'An error occurred during the backtest.'}
            </p>
            {onRerun && (
              <Button onClick={onRerun}>
                <Zap className="h-4 w-4 mr-2" />
                Rerun Backtest
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="text-lg font-semibold">{results.name}</h2>
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <div className="flex items-center">
              <Calendar className="h-4 w-4 mr-1" />
              {new Date(results.startDate).toLocaleDateString()} - {new Date(results.endDate).toLocaleDateString()}
            </div>
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              {Math.round(results.duration / 60)}m {Math.round(results.duration % 60)}s
            </div>
            <Badge variant={results.status === 'completed' ? 'default' : 'secondary'}>
              {results.status}
            </Badge>
          </div>
        </div>
        
        {showActions && (
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={() => onExport?.('pdf')}>
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => onShare?.()}>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="charts">Charts</TabsTrigger>
            <TabsTrigger value="trades">Trades</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="flex-1 overflow-y-auto p-4">
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Return</p>
                        <p 
                          className="text-2xl font-bold"
                          style={{ color: getMetricColor(calculatedMetrics.totalReturn, 'return') }}
                        >
                          {formatPercentage(calculatedMetrics.totalReturn)}
                        </p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Sharpe Ratio</p>
                        <p 
                          className="text-2xl font-bold"
                          style={{ color: getMetricColor(calculatedMetrics.sharpeRatio, 'ratio') }}
                        >
                          {formatNumber(calculatedMetrics.sharpeRatio)}
                        </p>
                      </div>
                      <Target className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Max Drawdown</p>
                        <p 
                          className="text-2xl font-bold"
                          style={{ color: getMetricColor(calculatedMetrics.maxDrawdown, 'risk') }}
                        >
                          {formatPercentage(calculatedMetrics.maxDrawdown)}
                        </p>
                      </div>
                      <TrendingDown className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Win Rate</p>
                        <p 
                          className="text-2xl font-bold"
                          style={{ color: getMetricColor(calculatedMetrics.winRate, 'ratio') }}
                        >
                          {formatPercentage(calculatedMetrics.winRate)}
                        </p>
                      </div>
                      <BarChart3 className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Performance Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Returns</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Total Return</span>
                      <span style={{ color: getMetricColor(calculatedMetrics.totalReturn, 'return') }}>
                        {formatPercentage(calculatedMetrics.totalReturn)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Annual Return</span>
                      <span style={{ color: getMetricColor(calculatedMetrics.annualReturn, 'return') }}>
                        {formatPercentage(calculatedMetrics.annualReturn)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Volatility</span>
                      <span style={{ color: getMetricColor(calculatedMetrics.volatility, 'risk') }}>
                        {formatPercentage(calculatedMetrics.volatility)}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Risk Metrics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Max Drawdown</span>
                      <span style={{ color: getMetricColor(calculatedMetrics.maxDrawdown, 'risk') }}>
                        {formatPercentage(calculatedMetrics.maxDrawdown)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Sharpe Ratio</span>
                      <span style={{ color: getMetricColor(calculatedMetrics.sharpeRatio, 'ratio') }}>
                        {formatNumber(calculatedMetrics.sharpeRatio)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Sortino Ratio</span>
                      <span style={{ color: getMetricColor(calculatedMetrics.sortinoRatio, 'ratio') }}>
                        {formatNumber(calculatedMetrics.sortinoRatio)}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Trade Statistics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Total Trades</span>
                      <span>{calculatedMetrics.totalTrades}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Win Rate</span>
                      <span style={{ color: getMetricColor(calculatedMetrics.winRate, 'ratio') }}>
                        {formatPercentage(calculatedMetrics.winRate)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Profit Factor</span>
                      <span style={{ color: getMetricColor(calculatedMetrics.profitFactor, 'ratio') }}>
                        {formatNumber(calculatedMetrics.profitFactor)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Equity Curve */}
              <Card>
                <CardHeader>
                  <CardTitle>Equity Curve</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={equityCurveData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          type="number" 
                          scale="time" 
                          domain={['dataMin', 'dataMax']}
                          tickFormatter={(value) => new Date(value).toLocaleDateString()}
                        />
                        <YAxis tickFormatter={(value) => formatCurrency(value)} />
                        <Tooltip 
                          labelFormatter={(value) => new Date(value).toLocaleDateString()}
                          formatter={(value: any) => [formatCurrency(value), 'Portfolio Value']}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="value" 
                          stroke={COLORS.primary} 
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="charts" className="flex-1 overflow-y-auto p-4">
            <div className="space-y-6">
              {/* Daily Returns Heatmap */}
              <Card>
                <CardHeader>
                  <CardTitle>Daily Returns</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailyReturnsData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          type="number" 
                          scale="time" 
                          domain={['dataMin', 'dataMax']}
                          tickFormatter={(value) => new Date(value).toLocaleDateString()}
                        />
                        <YAxis tickFormatter={(value) => `${value.toFixed(2)}%`} />
                        <Tooltip 
                          labelFormatter={(value) => new Date(value).toLocaleDateString()}
                          formatter={(value: any) => [`${value.toFixed(2)}%`, 'Daily Return']}
                        />
                        <Bar dataKey="return" fill={(entry: any) => entry.positive ? COLORS.success : COLORS.danger} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Drawdown Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Drawdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={equityCurveData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          type="number" 
                          scale="time" 
                          domain={['dataMin', 'dataMax']}
                          tickFormatter={(value) => new Date(value).toLocaleDateString()}
                        />
                        <YAxis tickFormatter={(value) => `${value.toFixed(2)}%`} />
                        <Tooltip 
                          labelFormatter={(value) => new Date(value).toLocaleDateString()}
                          formatter={(value: any) => [`${value.toFixed(2)}%`, 'Drawdown']}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="drawdown" 
                          stroke={COLORS.danger} 
                          fill={COLORS.danger}
                          fillOpacity={0.3}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="trades" className="flex-1 overflow-y-auto p-4">
            <Card>
              <CardHeader>
                <CardTitle>Trade History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Time</th>
                        <th className="text-left p-2">Symbol</th>
                        <th className="text-left p-2">Side</th>
                        <th className="text-left p-2">Quantity</th>
                        <th className="text-left p-2">Price</th>
                        <th className="text-left p-2">PnL</th>
                        <th className="text-left p-2">Commission</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.trades.map((trade) => (
                        <tr key={trade.id} className="border-b">
                          <td className="p-2">{new Date(trade.timestamp).toLocaleString()}</td>
                          <td className="p-2">{trade.symbol}</td>
                          <td className="p-2">
                            <Badge variant={trade.side === 'buy' ? 'default' : 'secondary'}>
                              {trade.side.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="p-2">{trade.quantity}</td>
                          <td className="p-2">{formatCurrency(trade.price)}</td>
                          <td className="p-2" style={{ color: trade.pnl >= 0 ? COLORS.success : COLORS.danger }}>
                            {formatCurrency(trade.pnl)}
                          </td>
                          <td className="p-2">{formatCurrency(trade.commission)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="orders" className="flex-1 overflow-y-auto p-4">
            <Card>
              <CardHeader>
                <CardTitle>Order History</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Order history will be displayed here.</p>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="logs" className="flex-1 overflow-y-auto p-4">
            <Card>
              <CardHeader>
                <CardTitle>Execution Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted p-4 rounded-md font-mono text-sm max-h-96 overflow-y-auto">
                  {results.logs.map((log, index) => (
                    <div key={index} className="mb-1">
                      {log}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BacktestResultsDashboard;
