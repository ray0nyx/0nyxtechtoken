import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  Zap,
  Shield,
  Brain,
  Database,
  BarChart2,
  Activity
} from 'lucide-react';
import { AdvancedBacktestingService, BacktestConfig, AdvancedBacktestResult } from '@/services/advancedBacktestingService';
import { EnhancedDataService } from '@/services/enhancedDataService';
import { AdvancedStrategyBuilder } from './AdvancedStrategyBuilder';
import { AdvancedRiskManager } from './AdvancedRiskManager';
import { BacktestingSummary } from './BacktestingSummary';

interface BacktestComparison {
  id: string;
  name: string;
  results: AdvancedBacktestResult;
  benchmark: AdvancedBacktestResult;
  outperformance: number;
  riskAdjustedReturn: number;
}

interface PortfolioOptimization {
  id: string;
  name: string;
  targetReturn: number;
  maxRisk: number;
  constraints: Record<string, any>;
  optimizedWeights: Record<string, number>;
  expectedReturn: number;
  expectedRisk: number;
  sharpeRatio: number;
}

export const EnhancedBacktestingDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [backtests, setBacktests] = useState<AdvancedBacktestResult[]>([]);
  const [comparisons, setComparisons] = useState<BacktestComparison[]>([]);
  const [optimizations, setOptimizations] = useState<PortfolioOptimization[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedBacktest, setSelectedBacktest] = useState<string | null>(null);

  useEffect(() => {
    loadBacktestData();
  }, []);

  const loadBacktestData = async () => {
    setIsLoading(true);
    try {
      // Load existing backtests
      const savedBacktests = localStorage.getItem('enhanced_backtests');
      if (savedBacktests) {
        setBacktests(JSON.parse(savedBacktests));
      }
    } catch (error) {
      console.error('Error loading backtest data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const runNewBacktest = async (config: BacktestConfig) => {
    setIsLoading(true);
    try {
      const result = await AdvancedBacktestingService.runBacktest(config);
      setBacktests(prev => [...prev, result]);
      
      // Save to localStorage
      const updatedBacktests = [...backtests, result];
      localStorage.setItem('enhanced_backtests', JSON.stringify(updatedBacktests));
      
      setSelectedBacktest(result.id);
    } catch (error) {
      console.error('Error running backtest:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const runWalkForwardAnalysis = async (config: BacktestConfig) => {
    setIsLoading(true);
    try {
      const result = await AdvancedBacktestingService.runWalkForwardAnalysis(config);
      console.log('Walk-forward analysis completed:', result);
    } catch (error) {
      console.error('Error running walk-forward analysis:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const runMonteCarloSimulation = async (config: BacktestConfig) => {
    setIsLoading(true);
    try {
      const result = await AdvancedBacktestingService.runMonteCarloSimulation(config);
      console.log('Monte Carlo simulation completed:', result);
    } catch (error) {
      console.error('Error running Monte Carlo simulation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const optimizeStrategy = async (config: BacktestConfig) => {
    setIsLoading(true);
    try {
      const result = await AdvancedBacktestingService.optimizeStrategy(config, {
        lookbackPeriod: { min: 6, max: 24, step: 6 },
        topN: { min: 10, max: 50, step: 10 },
        rebalanceFrequency: { min: 1, max: 12, step: 1 }
      });
      console.log('Strategy optimization completed:', result);
    } catch (error) {
      console.error('Error optimizing strategy:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedBacktestData = backtests.find(b => b.id === selectedBacktest);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Enhanced Backtesting Engine</h1>
          <p className="text-muted-foreground">
            Advanced strategy testing with institutional-grade features
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Import Strategy
          </Button>
          <Button>
            <Download className="h-4 w-4 mr-2" />
            Export Results
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="strategy">Strategy Builder</TabsTrigger>
          <TabsTrigger value="risk">Risk Management</TabsTrigger>
          <TabsTrigger value="analysis">Advanced Analysis</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <BacktestingSummary
            totalBacktests={backtests.length}
            successfulBacktests={backtests.filter(b => b.performance.totalReturn > 0).length}
            averageReturn={backtests.length > 0 ? backtests.reduce((sum, b) => sum + b.performance.totalReturn, 0) / backtests.length : 0}
            bestReturn={backtests.length > 0 ? Math.max(...backtests.map(b => b.performance.totalReturn)) : 0}
            worstReturn={backtests.length > 0 ? Math.min(...backtests.map(b => b.performance.totalReturn)) : 0}
            averageSharpe={backtests.length > 0 ? backtests.reduce((sum, b) => sum + b.performance.sharpeRatio, 0) / backtests.length : 0}
            totalRiskScore={backtests.length > 0 ? backtests.reduce((sum, b) => sum + (b.riskMetrics.var95 + b.riskMetrics.expectedShortfall), 0) / backtests.length : 0}
            features={{
              advancedBacktesting: true,
              liveTickerFeed: true,
              tradingViewIntegration: true,
              riskManagement: true,
              strategyBuilder: true,
              monteCarloSimulation: true,
              walkForwardAnalysis: true
            }}
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold">{backtests.length}</div>
                    <div className="text-sm text-muted-foreground">Total Backtests</div>
                  </div>
                  <BarChart3 className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold">
                      {backtests.filter(b => b.status === 'completed').length}
                    </div>
                    <div className="text-sm text-muted-foreground">Completed</div>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold">
                      {backtests.filter(b => b.status === 'running').length}
                    </div>
                    <div className="text-sm text-muted-foreground">Running</div>
                  </div>
                  <Clock className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold">
                      {backtests.filter(b => b.status === 'failed').length}
                    </div>
                    <div className="text-sm text-muted-foreground">Failed</div>
                  </div>
                  <AlertCircle className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Backtests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {backtests.slice(0, 5).map((backtest) => (
                    <div
                      key={backtest.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedBacktest === backtest.id
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedBacktest(backtest.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{backtest.config.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {backtest.config.startDate} - {backtest.config.endDate}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {backtest.performance.totalReturn.toFixed(2)}%
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Sharpe: {backtest.performance.sharpeRatio.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col items-center justify-center"
                    onClick={() => setActiveTab('strategy')}
                  >
                    <Code className="h-6 w-6 mb-2" />
                    <span className="text-sm">New Strategy</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col items-center justify-center"
                    onClick={() => setActiveTab('analysis')}
                  >
                    <BarChart2 className="h-6 w-6 mb-2" />
                    <span className="text-sm">Advanced Analysis</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col items-center justify-center"
                    onClick={() => setActiveTab('optimization')}
                  >
                    <Target className="h-6 w-6 mb-2" />
                    <span className="text-sm">Optimize</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col items-center justify-center"
                    onClick={() => setActiveTab('risk')}
                  >
                    <Shield className="h-6 w-6 mb-2" />
                    <span className="text-sm">Risk Management</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="strategy">
          <AdvancedStrategyBuilder />
        </TabsContent>

        <TabsContent value="risk">
          <AdvancedRiskManager />
        </TabsContent>

        <TabsContent value="analysis" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Walk-Forward Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Test strategy stability across different time periods
                </p>
                <Button
                  onClick={() => selectedBacktestData && runWalkForwardAnalysis(selectedBacktestData.config)}
                  disabled={!selectedBacktestData || isLoading}
                >
                  <Activity className="h-4 w-4 mr-2" />
                  Run Walk-Forward Analysis
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Monte Carlo Simulation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Simulate thousands of possible outcomes
                </p>
                <Button
                  onClick={() => selectedBacktestData && runMonteCarloSimulation(selectedBacktestData.config)}
                  disabled={!selectedBacktestData || isLoading}
                >
                  <Brain className="h-4 w-4 mr-2" />
                  Run Monte Carlo
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="optimization" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Strategy Optimization</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Optimize strategy parameters for maximum risk-adjusted returns
              </p>
              <Button
                onClick={() => selectedBacktestData && optimizeStrategy(selectedBacktestData.config)}
                disabled={!selectedBacktestData || isLoading}
              >
                <Target className="h-4 w-4 mr-2" />
                Optimize Strategy
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          {selectedBacktestData ? (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{selectedBacktestData.config.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-2xl font-bold text-green-600">
                        {selectedBacktestData.performance.totalReturn.toFixed(2)}%
                      </div>
                      <div className="text-sm text-muted-foreground">Total Return</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-600">
                        {selectedBacktestData.performance.sharpeRatio.toFixed(2)}
                      </div>
                      <div className="text-sm text-muted-foreground">Sharpe Ratio</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-red-600">
                        {selectedBacktestData.performance.maxDrawdown.toFixed(2)}%
                      </div>
                      <div className="text-sm text-muted-foreground">Max Drawdown</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-purple-600">
                        {selectedBacktestData.performance.winRate.toFixed(2)}%
                      </div>
                      <div className="text-sm text-muted-foreground">Win Rate</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Performance Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span>Annualized Return:</span>
                        <span className="font-medium">
                          {selectedBacktestData.performance.annualizedReturn.toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Volatility:</span>
                        <span className="font-medium">
                          {selectedBacktestData.performance.volatility.toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Sortino Ratio:</span>
                        <span className="font-medium">
                          {selectedBacktestData.performance.sortinoRatio.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Calmar Ratio:</span>
                        <span className="font-medium">
                          {selectedBacktestData.performance.calmarRatio.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Risk Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span>VaR (95%):</span>
                        <span className="font-medium">
                          {selectedBacktestData.riskMetrics.var95.toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Expected Shortfall:</span>
                        <span className="font-medium">
                          {selectedBacktestData.riskMetrics.expectedShortfall.toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Beta:</span>
                        <span className="font-medium">
                          {selectedBacktestData.performance.beta.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Alpha:</span>
                        <span className="font-medium">
                          {selectedBacktestData.performance.alpha.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select a backtest to view results</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

