import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Play, 
  Pause, 
  Square, 
  BarChart3, 
  LineChart, 
  PieChart,
  Settings,
  Download,
  Upload,
  Code,
  Target,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap
} from 'lucide-react';

interface BacktestConfig {
  id: string;
  name: string;
  strategy: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  rebalanceFrequency: string;
  transactionCosts: number;
  slippage: number;
  maxPositions: number;
  riskFreeRate: number;
  benchmark: string;
}

interface BacktestResult {
  id: string;
  config: BacktestConfig;
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  maxDrawdownDuration: number;
  winRate: number;
  profitFactor: number;
  expectancy: number;
  var95: number;
  var99: number;
  expectedShortfall: number;
  beta: number;
  alpha: number;
  informationRatio: number;
  trackingError: number;
  status: 'running' | 'completed' | 'failed' | 'paused';
  progress: number;
  startTime: string;
  endTime?: string;
  errorMessage?: string;
}

interface WalkForwardResult {
  period: string;
  inSampleReturn: number;
  outOfSampleReturn: number;
  inSampleSharpe: number;
  outOfSampleSharpe: number;
  stability: number;
  degradation: number;
}

interface MonteCarloResult {
  simulation: number;
  finalValue: number;
  totalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  var95: number;
  var99: number;
}

export const AdvancedBacktesting: React.FC = () => {
  const [backtests, setBacktests] = useState<BacktestResult[]>([]);
  const [walkForwardResults, setWalkForwardResults] = useState<WalkForwardResult[]>([]);
  const [monteCarloResults, setMonteCarloResults] = useState<MonteCarloResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBacktest, setSelectedBacktest] = useState<string | null>(null);

  useEffect(() => {
    const loadBacktestData = async () => {
      setIsLoading(true);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock data
      setBacktests([
        {
          id: '1',
          config: {
            id: '1',
            name: 'Momentum Strategy',
            strategy: '12-month momentum with 1-month skip',
            startDate: '2020-01-01',
            endDate: '2024-01-01',
            initialCapital: 1000000,
            rebalanceFrequency: 'monthly',
            transactionCosts: 0.001,
            slippage: 0.0005,
            maxPositions: 20,
            riskFreeRate: 0.02,
            benchmark: 'SPY'
          },
          totalReturn: 45.2,
          annualizedReturn: 12.8,
          volatility: 0.18,
          sharpeRatio: 1.85,
          sortinoRatio: 2.34,
          calmarRatio: 0.67,
          maxDrawdown: -12.3,
          maxDrawdownDuration: 45,
          winRate: 0.68,
          profitFactor: 1.85,
          expectancy: 0.023,
          var95: -0.045,
          var99: -0.067,
          expectedShortfall: -0.078,
          beta: 0.89,
          alpha: 0.032,
          informationRatio: 0.45,
          trackingError: 0.12,
          status: 'completed',
          progress: 100,
          startTime: '2024-01-20T10:00:00Z',
          endTime: '2024-01-20T10:15:00Z'
        },
        {
          id: '2',
          config: {
            id: '2',
            name: 'Mean Reversion',
            strategy: 'Bollinger Bands with RSI confirmation',
            startDate: '2020-01-01',
            endDate: '2024-01-01',
            initialCapital: 1000000,
            rebalanceFrequency: 'weekly',
            transactionCosts: 0.001,
            slippage: 0.0005,
            maxPositions: 15,
            riskFreeRate: 0.02,
            benchmark: 'SPY'
          },
          totalReturn: 28.7,
          annualizedReturn: 8.2,
          volatility: 0.15,
          sharpeRatio: 1.42,
          sortinoRatio: 1.89,
          calmarRatio: 0.52,
          maxDrawdown: -8.9,
          maxDrawdownDuration: 32,
          winRate: 0.72,
          profitFactor: 1.65,
          expectancy: 0.018,
          var95: -0.038,
          var99: -0.056,
          expectedShortfall: -0.065,
          beta: 0.76,
          alpha: 0.024,
          informationRatio: 0.38,
          trackingError: 0.09,
          status: 'completed',
          progress: 100,
          startTime: '2024-01-20T11:00:00Z',
          endTime: '2024-01-20T11:12:00Z'
        },
        {
          id: '3',
          config: {
            id: '3',
            name: 'Multi-Factor Model',
            strategy: 'Fama-French 5-factor model with ML optimization',
            startDate: '2020-01-01',
            endDate: '2024-01-01',
            initialCapital: 1000000,
            rebalanceFrequency: 'monthly',
            transactionCosts: 0.001,
            slippage: 0.0005,
            maxPositions: 25,
            riskFreeRate: 0.02,
            benchmark: 'SPY'
          },
          totalReturn: 52.1,
          annualizedReturn: 14.2,
          volatility: 0.16,
          sharpeRatio: 2.15,
          sortinoRatio: 2.78,
          calmarRatio: 0.89,
          maxDrawdown: -9.8,
          maxDrawdownDuration: 28,
          winRate: 0.75,
          profitFactor: 2.12,
          expectancy: 0.031,
          var95: -0.042,
          var99: -0.063,
          expectedShortfall: -0.072,
          beta: 0.82,
          alpha: 0.045,
          informationRatio: 0.58,
          trackingError: 0.11,
          status: 'running',
          progress: 75,
          startTime: '2024-01-20T12:00:00Z'
        }
      ]);

      setWalkForwardResults([
        {
          period: '2020-2021',
          inSampleReturn: 0.18,
          outOfSampleReturn: 0.15,
          inSampleSharpe: 1.85,
          outOfSampleSharpe: 1.42,
          stability: 0.77,
          degradation: 0.23
        },
        {
          period: '2021-2022',
          inSampleReturn: 0.22,
          outOfSampleReturn: 0.19,
          inSampleSharpe: 2.15,
          outOfSampleSharpe: 1.89,
          stability: 0.88,
          degradation: 0.12
        },
        {
          period: '2022-2023',
          inSampleReturn: 0.16,
          outOfSampleReturn: 0.14,
          inSampleSharpe: 1.78,
          outOfSampleSharpe: 1.65,
          stability: 0.93,
          degradation: 0.07
        }
      ]);

      setMonteCarloResults([
        { simulation: 1, finalValue: 1452000, totalReturn: 0.452, maxDrawdown: -0.123, sharpeRatio: 1.85, var95: -0.045, var99: -0.067 },
        { simulation: 2, finalValue: 1387000, totalReturn: 0.387, maxDrawdown: -0.089, sharpeRatio: 1.42, var95: -0.038, var99: -0.056 },
        { simulation: 3, finalValue: 1521000, totalReturn: 0.521, maxDrawdown: -0.098, sharpeRatio: 2.15, var95: -0.042, var99: -0.063 },
        { simulation: 4, finalValue: 1283000, totalReturn: 0.283, maxDrawdown: -0.156, sharpeRatio: 1.28, var95: -0.052, var99: -0.078 },
        { simulation: 5, finalValue: 1418000, totalReturn: 0.418, maxDrawdown: -0.112, sharpeRatio: 1.67, var95: -0.041, var99: -0.061 }
      ]);

      setIsLoading(false);
    };

    loadBacktestData();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400';
      case 'running': return 'text-blue-400';
      case 'paused': return 'text-yellow-400';
      case 'failed': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-900/20 border-green-500/30 text-green-400';
      case 'running': return 'bg-blue-900/20 border-blue-500/30 text-blue-400';
      case 'paused': return 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400';
      case 'failed': return 'bg-red-900/20 border-red-500/30 text-red-400';
      default: return 'bg-gray-900/20 border-gray-500/30 text-gray-400';
    }
  };

  if (isLoading) {
    return (
      <div className="institutional-theme p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="institutional-theme p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Advanced Backtesting Engine</h1>
          <p className="text-gray-400 mt-1">Walk-forward analysis, Monte Carlo simulations, and strategy optimization</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="institutional-btn">
            <Code className="h-4 w-4 mr-2" />
            Python/R
          </Button>
          <Button variant="outline" size="sm" className="institutional-btn">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      <Tabs defaultValue="backtests" className="space-y-6">
        <TabsList className="institutional-tabs">
          <TabsTrigger value="backtests">Backtests</TabsTrigger>
          <TabsTrigger value="walkforward">Walk-Forward</TabsTrigger>
          <TabsTrigger value="montecarlo">Monte Carlo</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
        </TabsList>

        {/* Backtests Tab */}
        <TabsContent value="backtests" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-white">Backtest Results</h3>
            <Button variant="outline" size="sm" className="institutional-btn">
              <Play className="h-4 w-4 mr-2" />
              New Backtest
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {backtests.map((backtest) => (
              <Card key={backtest.id} className="institutional-card">
                <CardHeader className="institutional-card-header">
                  <div className="flex items-center justify-between">
                    <CardTitle className="institutional-card-title">
                      {backtest.config.name}
                    </CardTitle>
                    <Badge className={getStatusBadgeColor(backtest.status)}>
                      {backtest.status.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-400">{backtest.config.strategy}</p>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Total Return</span>
                      <span className={`font-mono text-lg ${backtest.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {backtest.totalReturn >= 0 ? '+' : ''}{backtest.totalReturn.toFixed(1)}%
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Sharpe Ratio</span>
                      <span className="font-mono text-lg text-blue-400">
                        {backtest.sharpeRatio.toFixed(2)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Max Drawdown</span>
                      <span className="font-mono text-lg text-red-400">
                        {backtest.maxDrawdown.toFixed(1)}%
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Win Rate</span>
                      <span className="font-mono text-lg text-purple-400">
                        {formatPercent(backtest.winRate)}
                      </span>
                    </div>
                  </div>
                  
                  {backtest.status === 'running' && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Progress</span>
                        <span className="text-sm text-gray-300">{backtest.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${backtest.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  
                  <div className="pt-2 border-t border-gray-700">
                    <div className="text-xs text-gray-400 mb-2">
                      {backtest.config.startDate} - {backtest.config.endDate}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="institutional-btn flex-1">
                        <LineChart className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button variant="outline" size="sm" className="institutional-btn">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Walk-Forward Analysis Tab */}
        <TabsContent value="walkforward" className="space-y-4">
          <Card className="institutional-card">
            <CardHeader className="institutional-card-header">
              <CardTitle className="institutional-card-title flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-500" />
                Walk-Forward Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {walkForwardResults.map((result, index) => (
                  <div key={index} className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-white">{result.period}</h4>
                      <div className="flex items-center gap-2">
                        <Badge className={
                          result.stability > 0.8 ? 'bg-green-900/20 border-green-500/30 text-green-400' :
                          result.stability > 0.6 ? 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400' :
                          'bg-red-900/20 border-red-500/30 text-red-400'
                        }>
                          Stability: {formatPercent(result.stability)}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="text-sm text-gray-400">In-Sample Return</div>
                        <div className="font-mono text-lg text-green-400">
                          {formatPercent(result.inSampleReturn)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">Out-of-Sample Return</div>
                        <div className="font-mono text-lg text-blue-400">
                          {formatPercent(result.outOfSampleReturn)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">In-Sample Sharpe</div>
                        <div className="font-mono text-lg text-purple-400">
                          {result.inSampleSharpe.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">Out-of-Sample Sharpe</div>
                        <div className="font-mono text-lg text-orange-400">
                          {result.outOfSampleSharpe.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Degradation</span>
                        <span className={`text-sm ${result.degradation < 0.2 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatPercent(result.degradation)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monte Carlo Tab */}
        <TabsContent value="montecarlo" className="space-y-4">
          <Card className="institutional-card">
            <CardHeader className="institutional-card-header">
              <CardTitle className="institutional-card-title flex items-center gap-2">
                <Zap className="h-5 w-5 text-purple-500" />
                Monte Carlo Simulations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {monteCarloResults.map((result, index) => (
                  <div key={index} className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-white">Simulation {result.simulation}</h4>
                      <div className="flex items-center gap-2">
                        <Badge className={
                          result.totalReturn > 0.4 ? 'bg-green-900/20 border-green-500/30 text-green-400' :
                          result.totalReturn > 0.2 ? 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400' :
                          'bg-red-900/20 border-red-500/30 text-red-400'
                        }>
                          {formatPercent(result.totalReturn)}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="text-sm text-gray-400">Final Value</div>
                        <div className="font-mono text-lg text-white">
                          {formatCurrency(result.finalValue)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">Total Return</div>
                        <div className="font-mono text-lg text-green-400">
                          {formatPercent(result.totalReturn)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">Max Drawdown</div>
                        <div className="font-mono text-lg text-red-400">
                          {formatPercent(result.maxDrawdown)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">Sharpe Ratio</div>
                        <div className="font-mono text-lg text-blue-400">
                          {result.sharpeRatio.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Optimization Tab */}
        <TabsContent value="optimization" className="space-y-4">
          <Card className="institutional-card">
            <CardHeader className="institutional-card-header">
              <CardTitle className="institutional-card-title flex items-center gap-2">
                <Settings className="h-5 w-5 text-orange-500" />
                Strategy Optimization
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Settings className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">Strategy Optimization</h3>
                <p className="text-gray-400 mb-4">
                  Optimize your strategy parameters using genetic algorithms, grid search, or Bayesian optimization.
                </p>
                <Button variant="outline" className="institutional-btn">
                  <Code className="h-4 w-4 mr-2" />
                  Start Optimization
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
