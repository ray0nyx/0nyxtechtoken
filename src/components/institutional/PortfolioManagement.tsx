import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  PieChart, 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Target,
  Settings,
  Plus,
  Edit,
  Trash2,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';

interface Strategy {
  id: string;
  name: string;
  type: 'long_short' | 'market_neutral' | 'arbitrage' | 'momentum' | 'mean_reversion';
  allocation: number;
  performance: number;
  risk: number;
  status: 'active' | 'paused' | 'stopped';
  lastRebalance: string;
  nextRebalance: string;
}

interface Position {
  symbol: string;
  quantity: number;
  marketValue: number;
  weight: number;
  strategy: string;
  pnl: number;
  pnlPercent: number;
  risk: 'low' | 'medium' | 'high' | 'critical';
}

interface RebalancingAlert {
  id: string;
  strategy: string;
  currentWeight: number;
  targetWeight: number;
  deviation: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  action: 'buy' | 'sell' | 'rebalance';
  amount: number;
}

export const PortfolioManagement: React.FC = () => {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [rebalancingAlerts, setRebalancingAlerts] = useState<RebalancingAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadPortfolioData = async () => {
      setIsLoading(true);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock data
      setStrategies([
        {
          id: '1',
          name: 'Long/Short Equity',
          type: 'long_short',
          allocation: 0.4,
          performance: 12.5,
          risk: 0.15,
          status: 'active',
          lastRebalance: '2024-01-15',
          nextRebalance: '2024-02-15'
        },
        {
          id: '2',
          name: 'Market Neutral',
          type: 'market_neutral',
          allocation: 0.25,
          performance: 8.2,
          risk: 0.08,
          status: 'active',
          lastRebalance: '2024-01-10',
          nextRebalance: '2024-02-10'
        },
        {
          id: '3',
          name: 'Arbitrage',
          type: 'arbitrage',
          allocation: 0.2,
          performance: 6.8,
          risk: 0.05,
          status: 'active',
          lastRebalance: '2024-01-20',
          nextRebalance: '2024-02-20'
        },
        {
          id: '4',
          name: 'Momentum',
          type: 'momentum',
          allocation: 0.15,
          performance: 15.3,
          risk: 0.22,
          status: 'paused',
          lastRebalance: '2024-01-05',
          nextRebalance: '2024-02-05'
        }
      ]);

      setPositions([
        { symbol: 'AAPL', quantity: 1000, marketValue: 150000, weight: 0.15, strategy: 'Long/Short Equity', pnl: 15000, pnlPercent: 11.1, risk: 'medium' },
        { symbol: 'MSFT', quantity: 500, marketValue: 180000, weight: 0.18, strategy: 'Long/Short Equity', pnl: 12000, pnlPercent: 7.1, risk: 'low' },
        { symbol: 'GOOGL', quantity: 200, marketValue: 220000, weight: 0.22, strategy: 'Market Neutral', pnl: 8000, pnlPercent: 3.8, risk: 'high' },
        { symbol: 'TSLA', quantity: 300, marketValue: 75000, weight: 0.075, strategy: 'Momentum', pnl: -5000, pnlPercent: -6.3, risk: 'critical' },
        { symbol: 'NVDA', quantity: 400, marketValue: 160000, weight: 0.16, strategy: 'Arbitrage', pnl: 4000, pnlPercent: 2.6, risk: 'medium' }
      ]);

      setRebalancingAlerts([
        {
          id: '1',
          strategy: 'Long/Short Equity',
          currentWeight: 0.42,
          targetWeight: 0.40,
          deviation: 0.02,
          priority: 'medium',
          action: 'sell',
          amount: 20000
        },
        {
          id: '2',
          strategy: 'Market Neutral',
          currentWeight: 0.23,
          targetWeight: 0.25,
          deviation: -0.02,
          priority: 'low',
          action: 'buy',
          amount: 15000
        },
        {
          id: '3',
          strategy: 'Momentum',
          currentWeight: 0.18,
          targetWeight: 0.15,
          deviation: 0.03,
          priority: 'high',
          action: 'sell',
          amount: 30000
        }
      ]);

      setIsLoading(false);
    };

    loadPortfolioData();
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
    return `${(value * 100).toFixed(1)}%`;
  };

  const getStrategyTypeColor = (type: string) => {
    switch (type) {
      case 'long_short': return 'text-blue-400';
      case 'market_neutral': return 'text-green-400';
      case 'arbitrage': return 'text-purple-400';
      case 'momentum': return 'text-orange-400';
      case 'mean_reversion': return 'text-pink-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400';
      case 'paused': return 'text-yellow-400';
      case 'stopped': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'text-green-400';
      case 'medium': return 'text-yellow-400';
      case 'high': return 'text-orange-400';
      case 'critical': return 'text-red-400';
      default: return 'text-gray-400';
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
          <h1 className="text-3xl font-bold text-white">Portfolio Management</h1>
          <p className="text-gray-400 mt-1">Multi-strategy portfolio management and rebalancing</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="institutional-btn">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button variant="outline" size="sm" className="institutional-btn">
            <Plus className="h-4 w-4 mr-2" />
            Add Strategy
          </Button>
        </div>
      </div>

      <Tabs defaultValue="strategies" className="space-y-6">
        <TabsList className="institutional-tabs">
          <TabsTrigger value="strategies">Strategies</TabsTrigger>
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="rebalancing">Rebalancing</TabsTrigger>
          <TabsTrigger value="attribution">Attribution</TabsTrigger>
        </TabsList>

        {/* Strategies Tab */}
        <TabsContent value="strategies" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {strategies.map((strategy) => (
              <Card key={strategy.id} className="institutional-card">
                <CardHeader className="institutional-card-header">
                  <div className="flex items-center justify-between">
                    <CardTitle className="institutional-card-title">
                      {strategy.name}
                    </CardTitle>
                    <Badge className={
                      strategy.status === 'active' ? 'bg-green-900/20 border-green-500/30 text-green-400' :
                      strategy.status === 'paused' ? 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400' :
                      'bg-red-900/20 border-red-500/30 text-red-400'
                    }>
                      {strategy.status.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Type</span>
                    <span className={`font-semibold ${getStrategyTypeColor(strategy.type)}`}>
                      {strategy.type.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Allocation</span>
                    <span className="font-mono text-lg text-blue-400">
                      {formatPercent(strategy.allocation)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Performance</span>
                    <span className={`font-mono text-lg ${strategy.performance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {strategy.performance >= 0 ? '+' : ''}{strategy.performance.toFixed(1)}%
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Risk</span>
                    <span className="font-mono text-lg text-orange-400">
                      {formatPercent(strategy.risk)}
                    </span>
                  </div>
                  
                  <div className="pt-2 border-t border-gray-700">
                    <div className="text-xs text-gray-400">
                      Last Rebalance: {strategy.lastRebalance}
                    </div>
                    <div className="text-xs text-gray-400">
                      Next: {strategy.nextRebalance}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="institutional-btn flex-1">
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" className="institutional-btn">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Positions Tab */}
        <TabsContent value="positions" className="space-y-4">
          <Card className="institutional-card">
            <CardHeader className="institutional-card-header">
              <CardTitle className="institutional-card-title">Current Positions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {positions.map((position, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="font-mono font-bold text-lg">{position.symbol}</div>
                      <Badge className={
                        position.risk === 'low' ? 'bg-green-900/20 border-green-500/30 text-green-400' :
                        position.risk === 'medium' ? 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400' :
                        position.risk === 'high' ? 'bg-orange-900/20 border-orange-500/30 text-orange-400' :
                        'bg-red-900/20 border-red-500/30 text-red-400'
                      }>
                        {position.risk.toUpperCase()}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-sm text-gray-400">Market Value</div>
                        <div className="font-mono text-lg text-white">
                          {formatCurrency(position.marketValue)}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-sm text-gray-400">Weight</div>
                        <div className="font-mono text-lg text-blue-400">
                          {formatPercent(position.weight)}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-sm text-gray-400">P&L</div>
                        <div className={`font-mono text-lg ${position.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatCurrency(position.pnl)}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-sm text-gray-400">Strategy</div>
                        <div className="text-sm text-gray-300">
                          {position.strategy}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rebalancing Tab */}
        <TabsContent value="rebalancing" className="space-y-4">
          <Card className="institutional-card">
            <CardHeader className="institutional-card-header">
              <CardTitle className="institutional-card-title flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                Rebalancing Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {rebalancingAlerts.map((alert) => (
                  <div key={alert.id} className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <h4 className="font-semibold text-white">{alert.strategy}</h4>
                        <Badge className={
                          alert.priority === 'low' ? 'bg-green-900/20 border-green-500/30 text-green-400' :
                          alert.priority === 'medium' ? 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400' :
                          alert.priority === 'high' ? 'bg-orange-900/20 border-orange-500/30 text-orange-400' :
                          'bg-red-900/20 border-red-500/30 text-red-400'
                        }>
                          {alert.priority.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="institutional-btn">
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Execute
                        </Button>
                        <Button variant="outline" size="sm" className="institutional-btn">
                          <Clock className="h-4 w-4 mr-1" />
                          Schedule
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="text-sm text-gray-400">Current Weight</div>
                        <div className="font-mono text-lg text-white">
                          {formatPercent(alert.currentWeight)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">Target Weight</div>
                        <div className="font-mono text-lg text-blue-400">
                          {formatPercent(alert.targetWeight)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">Deviation</div>
                        <div className={`font-mono text-lg ${Math.abs(alert.deviation) > 0.05 ? 'text-red-400' : 'text-yellow-400'}`}>
                          {formatPercent(alert.deviation)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">Action Amount</div>
                        <div className="font-mono text-lg text-purple-400">
                          {formatCurrency(alert.amount)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attribution Tab */}
        <TabsContent value="attribution" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="institutional-card">
              <CardHeader className="institutional-card-header">
                <CardTitle className="institutional-card-title">Performance Attribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Total Return</span>
                    <span className="font-mono text-lg text-green-400">+12.5%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Alpha</span>
                    <span className="font-mono text-lg text-blue-400">+3.2%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Beta</span>
                    <span className="font-mono text-lg text-yellow-400">0.89</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Tracking Error</span>
                    <span className="font-mono text-lg text-orange-400">4.2%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="institutional-card">
              <CardHeader className="institutional-card-header">
                <CardTitle className="institutional-card-title">Sector Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Technology</span>
                    <div className="flex items-center gap-2">
                      <Progress value={35} className="w-20" />
                      <span className="font-mono text-sm">35%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Healthcare</span>
                    <div className="flex items-center gap-2">
                      <Progress value={20} className="w-20" />
                      <span className="font-mono text-sm">20%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Financials</span>
                    <div className="flex items-center gap-2">
                      <Progress value={15} className="w-20" />
                      <span className="font-mono text-sm">15%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Consumer</span>
                    <div className="flex items-center gap-2">
                      <Progress value={30} className="w-20" />
                      <span className="font-mono text-sm">30%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
