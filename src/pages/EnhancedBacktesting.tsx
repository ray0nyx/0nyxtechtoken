import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { 
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
  Activity
} from 'lucide-react';
import { LiveTickerFeed } from '@/components/LiveTickerFeed';
import { EnhancedBacktestingDashboard } from '@/components/backtesting/EnhancedBacktestingDashboard';
import { AdvancedStrategyBuilder } from '@/components/backtesting/AdvancedStrategyBuilder';
import { AdvancedRiskManager } from '@/components/backtesting/AdvancedRiskManager';

export default function EnhancedBacktesting() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Live Ticker Feed Header */}
      <div className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700/50">
        <LiveTickerFeed 
          symbols={['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'NFLX']}
          updateInterval={5000}
          showControls={true}
          className="border-0 bg-transparent"
        />
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Enhanced Backtesting Engine</h1>
          <p className="text-slate-300">
            Professional-grade strategy testing with institutional features
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-slate-800/50 border border-slate-700/50">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="strategy" className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              Strategy Builder
            </TabsTrigger>
            <TabsTrigger value="risk" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Risk Management
            </TabsTrigger>
            <TabsTrigger value="analysis" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Advanced Analysis
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-slate-800/50 border-slate-700/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-green-400">24.5%</div>
                      <div className="text-sm text-slate-400">Avg Annual Return</div>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-blue-400">1.85</div>
                      <div className="text-sm text-slate-400">Sharpe Ratio</div>
                    </div>
                    <BarChart3 className="h-8 w-8 text-blue-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-red-400">-8.2%</div>
                      <div className="text-sm text-slate-400">Max Drawdown</div>
                    </div>
                    <TrendingDown className="h-8 w-8 text-red-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-purple-400">68%</div>
                      <div className="text-sm text-slate-400">Win Rate</div>
                    </div>
                    <Target className="h-8 w-8 text-purple-400" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-slate-800/50 border-slate-700/50">
                <CardHeader>
                  <CardTitle className="text-white">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      className="h-20 flex flex-col items-center justify-center bg-slate-700/50 border-slate-600 hover:bg-slate-600"
                      onClick={() => setActiveTab('strategy')}
                    >
                      <Code className="h-6 w-6 mb-2" />
                      <span className="text-sm">New Strategy</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-20 flex flex-col items-center justify-center bg-slate-700/50 border-slate-600 hover:bg-slate-600"
                      onClick={() => setActiveTab('analysis')}
                    >
                      <Brain className="h-6 w-6 mb-2" />
                      <span className="text-sm">Advanced Analysis</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-20 flex flex-col items-center justify-center bg-slate-700/50 border-slate-600 hover:bg-slate-600"
                      onClick={() => setActiveTab('risk')}
                    >
                      <Shield className="h-6 w-6 mb-2" />
                      <span className="text-sm">Risk Management</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-20 flex flex-col items-center justify-center bg-slate-700/50 border-slate-600 hover:bg-slate-600"
                      onClick={() => setActiveTab('dashboard')}
                    >
                      <Activity className="h-6 w-6 mb-2" />
                      <span className="text-sm">Dashboard</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700/50">
                <CardHeader>
                  <CardTitle className="text-white">Recent Backtests</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/50">
                      <div>
                        <div className="font-medium text-white">Momentum Strategy</div>
                        <div className="text-sm text-slate-400">AAPL, MSFT, GOOGL</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-green-400">+15.2%</div>
                        <div className="text-xs text-slate-400">Sharpe: 1.85</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/50">
                      <div>
                        <div className="font-medium text-white">Mean Reversion</div>
                        <div className="text-sm text-slate-400">TSLA, NVDA, META</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-red-400">-3.1%</div>
                        <div className="text-xs text-slate-400">Sharpe: 0.45</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/50">
                      <div>
                        <div className="font-medium text-white">ML Strategy</div>
                        <div className="text-sm text-slate-400">Multi-asset</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-green-400">+22.8%</div>
                        <div className="text-xs text-slate-400">Sharpe: 2.15</div>
                      </div>
                    </div>
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

          <TabsContent value="analysis" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-slate-800/50 border-slate-700/50">
                <CardHeader>
                  <CardTitle className="text-white">Walk-Forward Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-400 mb-4">
                    Test strategy stability across different time periods
                  </p>
                  <Button className="w-full bg-blue-600 hover:bg-blue-700">
                    <Activity className="h-4 w-4 mr-2" />
                    Run Walk-Forward Analysis
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700/50">
                <CardHeader>
                  <CardTitle className="text-white">Monte Carlo Simulation</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-400 mb-4">
                    Simulate thousands of possible outcomes
                  </p>
                  <Button className="w-full bg-purple-600 hover:bg-purple-700">
                    <Brain className="h-4 w-4 mr-2" />
                    Run Monte Carlo
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="dashboard">
            <EnhancedBacktestingDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
