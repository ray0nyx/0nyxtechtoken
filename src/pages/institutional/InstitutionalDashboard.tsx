import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  Target, 
  Brain, 
  BarChart2, 
  PieChart, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  Settings,
  BarChart3,
  LineChart,
  DollarSign,
  Percent,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { InstitutionalService, InstitutionalMetrics, PositionRisk, StrategyPerformance } from '@/services/institutionalService';
import { supabase } from '@/lib/supabase';
import { TeamWorkspace } from '@/components/institutional/TeamWorkspace';
import { ComplianceDashboard } from '@/components/institutional/ComplianceDashboard';
import { AlgorithmicTradingDashboard } from '@/components/institutional/AlgorithmicTradingDashboard';
import { MarketDataDashboard } from '@/components/institutional/MarketDataDashboard';

interface InstitutionalOverview {
  totalAUM: number;
  activeStrategies: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  performance: number;
  sharpeRatio: number;
  maxDrawdown: number;
  var95: number;
  activeAlerts: number;
  lastUpdate: string;
}

interface QuickStats {
  title: string;
  value: string;
  change: number;
  trend: 'up' | 'down' | 'stable';
  icon: React.ComponentType<any>;
  color: string;
}

export const InstitutionalDashboard: React.FC = () => {
  const [overview, setOverview] = useState<InstitutionalOverview | null>(null);
  const [metrics, setMetrics] = useState<InstitutionalMetrics | null>(null);
  const [positionRisks, setPositionRisks] = useState<PositionRisk[]>([]);
  const [strategyPerformance, setStrategyPerformance] = useState<StrategyPerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error('No authenticated user');
          setIsLoading(false);
          return;
        }
        
        setUserId(user.id);
        
        // Load institutional metrics
        const metricsData = await InstitutionalService.getInstitutionalMetrics(user.id);
        setMetrics(metricsData);
        
        // Load position risks
        const positionRisksData = await InstitutionalService.getPositionRisk(user.id);
        setPositionRisks(positionRisksData);
        
        // Load strategy performance
        const strategyData = await InstitutionalService.getStrategyPerformance(user.id);
        setStrategyPerformance(strategyData);
        
        // Create overview from metrics
        setOverview({
          totalAUM: metricsData.totalAUM,
          activeStrategies: metricsData.activeStrategies,
          riskLevel: metricsData.riskLevel,
          performance: metricsData.performance,
          sharpeRatio: metricsData.sharpeRatio,
          maxDrawdown: metricsData.maxDrawdown,
          var95: metricsData.var95,
          activeAlerts: metricsData.activeAlerts,
          lastUpdate: new Date().toLocaleTimeString()
        });
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading institutional data:', error);
        setIsLoading(false);
      }
    };

    loadUserData();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const quickStats: QuickStats[] = metrics ? [
    {
      title: 'Total AUM',
      value: formatCurrency(metrics.totalAUM),
      change: 2.3, // This would need historical data to calculate
      trend: 'up',
      icon: DollarSign,
      color: 'text-green-400'
    },
    {
      title: 'Active Strategies',
      value: metrics.activeStrategies.toString(),
      change: 0,
      trend: 'stable',
      icon: Target,
      color: 'text-blue-400'
    },
    {
      title: 'Performance',
      value: `${metrics.performance.toFixed(1)}%`,
      change: 1.2, // This would need historical data to calculate
      trend: metrics.performance >= 0 ? 'up' : 'down',
      icon: TrendingUp,
      color: metrics.performance >= 0 ? 'text-green-400' : 'text-red-400'
    },
    {
      title: 'Sharpe Ratio',
      value: metrics.sharpeRatio.toFixed(2),
      change: 0.15, // This would need historical data to calculate
      trend: 'up',
      icon: BarChart3,
      color: 'text-purple-400'
    },
    {
      title: 'Max Drawdown',
      value: `${(metrics.maxDrawdown * 100).toFixed(1)}%`,
      change: -0.3, // This would need historical data to calculate
      trend: 'down',
      icon: TrendingDown,
      color: 'text-red-400'
    },
    {
      title: 'VaR (95%)',
      value: formatCurrency(metrics.var95),
      change: -5.2, // This would need historical data to calculate
      trend: 'down',
      icon: AlertTriangle,
      color: 'text-orange-400'
    }
  ] : [
    {
      title: 'Total AUM',
      value: '$0',
      change: 0,
      trend: 'stable',
      icon: DollarSign,
      color: 'text-gray-400'
    },
    {
      title: 'Active Strategies',
      value: '0',
      change: 0,
      trend: 'stable',
      icon: Target,
      color: 'text-gray-400'
    },
    {
      title: 'Performance',
      value: '0.0%',
      change: 0,
      trend: 'stable',
      icon: TrendingUp,
      color: 'text-gray-400'
    },
    {
      title: 'Sharpe Ratio',
      value: '0.00',
      change: 0,
      trend: 'stable',
      icon: BarChart3,
      color: 'text-gray-400'
    },
    {
      title: 'Max Drawdown',
      value: '0.0%',
      change: 0,
      trend: 'stable',
      icon: TrendingDown,
      color: 'text-gray-400'
    },
    {
      title: 'VaR (95%)',
      value: '$0',
      change: 0,
      trend: 'stable',
      icon: AlertTriangle,
      color: 'text-gray-400'
    }
  ];

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-400';
      case 'medium': return 'text-yellow-400';
      case 'high': return 'text-orange-400';
      case 'critical': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getRiskBadgeColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'bg-green-900/20 border-green-500/30 text-green-400';
      case 'medium': return 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400';
      case 'high': return 'bg-orange-900/20 border-orange-500/30 text-orange-400';
      case 'critical': return 'bg-red-900/20 border-red-500/30 text-red-400';
      default: return 'bg-gray-900/20 border-gray-500/30 text-gray-400';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-400" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-400" />;
      case 'stable': return <Activity className="h-4 w-4 text-blue-400" />;
      default: return <Activity className="h-4 w-4 text-gray-400" />;
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
          <h1 className="text-3xl font-bold text-white">Institutional Dashboard</h1>
          <p className="text-gray-400 mt-1">Professional trading platform for institutional clients</p>
          <p className="text-sm text-gray-500 mt-1">Last updated: {overview?.lastUpdate}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-400">Live</span>
          </div>
          <Button variant="outline" size="sm" className="institutional-btn">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {quickStats.map((stat, index) => (
          <Card key={index} className="institutional-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
                <div className="flex items-center gap-1">
                  {getTrendIcon(stat.trend)}
                  <span className={`text-sm ${stat.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stat.change >= 0 ? '+' : ''}{stat.change.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
              <div className="text-sm text-gray-400">{stat.title}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Risk Overview */}
      <Card className="institutional-card">
        <CardHeader className="institutional-card-header">
          <CardTitle className="institutional-card-title flex items-center gap-2">
            <Shield className="h-5 w-5 text-red-500" />
            Risk Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-white mb-2">
                {metrics?.activeAlerts || 0}
              </div>
              <div className="text-sm text-gray-400 mb-2">Active Alerts</div>
              <Badge className={getRiskBadgeColor(metrics?.riskLevel || 'medium')}>
                {metrics?.riskLevel.toUpperCase()} RISK
              </Badge>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-400 mb-2">
                {formatCurrency(metrics?.var95 || 0)}
              </div>
              <div className="text-sm text-gray-400">VaR (95%)</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-400 mb-2">
                {((metrics?.maxDrawdown || 0) * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-gray-400">Max Drawdown</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Institutional Features */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="institutional-tabs">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="risk">Risk Management</TabsTrigger>
          <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
          <TabsTrigger value="research">Research</TabsTrigger>
          <TabsTrigger value="backtesting">Backtesting</TabsTrigger>
          <TabsTrigger value="attribution">Attribution</TabsTrigger>
          <TabsTrigger value="team">Team Workspace</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="algorithmic">Algorithmic Trading</TabsTrigger>
          <TabsTrigger value="market-data">Market Data</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="institutional-card">
              <CardHeader className="institutional-card-header">
                <CardTitle className="institutional-card-title">Position Risk Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {positionRisks.length > 0 ? positionRisks.slice(0, 5).map((position, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="font-mono font-bold text-sm">{position.symbol}</div>
                        <Badge className={
                          position.risk === 'low' ? 'bg-green-900/20 border-green-500/30 text-green-400' :
                          position.risk === 'medium' ? 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400' :
                          position.risk === 'high' ? 'bg-orange-900/20 border-orange-500/30 text-orange-400' :
                          'bg-red-900/20 border-red-500/30 text-red-400'
                        }>
                          {position.risk.toUpperCase()}
                        </Badge>
                        {position.alerts > 0 && (
                          <Badge className="bg-red-900/20 border-red-500/30 text-red-400">
                            {position.alerts} Alert{position.alerts > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="text-right">
                        <div className="font-mono text-sm text-gray-300">
                          {formatCurrency(position.marketValue)}
                        </div>
                        <div className="text-xs text-gray-400">
                          VaR: {formatCurrency(position.var)}
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-4 text-gray-400">
                      No position data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="institutional-card">
              <CardHeader className="institutional-card-header">
                <CardTitle className="institutional-card-title">Strategy Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {strategyPerformance.length > 0 ? strategyPerformance.map((strategy, index) => (
                    <div key={index} className="p-3 bg-gray-800 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-white">{strategy.name}</h4>
                        <Badge className={
                          strategy.status === 'active' ? 'bg-green-900/20 border-green-500/30 text-green-400' :
                          strategy.status === 'paused' ? 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400' :
                          'bg-red-900/20 border-red-500/30 text-red-400'
                        }>
                          {strategy.status.toUpperCase()}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-400">Performance:</span>
                          <span className={`ml-2 ${strategy.performance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatCurrency(strategy.performance)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">Trades:</span>
                          <span className="ml-2 text-white">{strategy.trades}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Win Rate:</span>
                          <span className="ml-2 text-green-400">
                            {(strategy.winRate * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">Sharpe:</span>
                          <span className="ml-2 text-purple-400">
                            {strategy.sharpeRatio.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-4 text-gray-400">
                      No strategy data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Risk Management Tab */}
        <TabsContent value="risk" className="space-y-4">
          <div className="text-center py-8">
            <Shield className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Advanced Risk Management</h3>
            <p className="text-gray-400 mb-4">
              Access comprehensive risk management tools including VaR analysis, stress testing, and real-time monitoring.
            </p>
            <Button variant="outline" className="institutional-btn">
              <Shield className="h-4 w-4 mr-2" />
              Open Risk Dashboard
            </Button>
          </div>
        </TabsContent>

        {/* Portfolio Tab */}
        <TabsContent value="portfolio" className="space-y-4">
          <div className="text-center py-8">
            <Target className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Portfolio Management</h3>
            <p className="text-gray-400 mb-4">
              Manage multi-strategy portfolios with advanced rebalancing, position sizing, and performance attribution.
            </p>
            <Button variant="outline" className="institutional-btn">
              <Target className="h-4 w-4 mr-2" />
              Open Portfolio Management
            </Button>
          </div>
        </TabsContent>

        {/* Research Tab */}
        <TabsContent value="research" className="space-y-4">
          <div className="text-center py-8">
            <Brain className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Quantitative Research</h3>
            <p className="text-gray-400 mb-4">
              Advanced factor analysis, machine learning models, and alternative data integration for research.
            </p>
            <Button variant="outline" className="institutional-btn">
              <Brain className="h-4 w-4 mr-2" />
              Open Research Platform
            </Button>
          </div>
        </TabsContent>

        {/* Backtesting Tab */}
        <TabsContent value="backtesting" className="space-y-4">
          <div className="text-center py-8">
            <BarChart2 className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Advanced Backtesting</h3>
            <p className="text-gray-400 mb-4">
              Walk-forward analysis, Monte Carlo simulations, and strategy optimization tools.
            </p>
            <Button variant="outline" className="institutional-btn">
              <BarChart2 className="h-4 w-4 mr-2" />
              Open Backtesting Engine
            </Button>
          </div>
        </TabsContent>

        {/* Attribution Tab */}
        <TabsContent value="attribution" className="space-y-4">
          <div className="text-center py-8">
            <PieChart className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Performance Attribution</h3>
            <p className="text-gray-400 mb-4">
              Factor analysis, sector allocation, and security-level performance attribution.
            </p>
            <Button variant="outline" className="institutional-btn">
              <PieChart className="h-4 w-4 mr-2" />
              Open Attribution Analysis
            </Button>
          </div>
        </TabsContent>

        {/* Team Workspace Tab */}
        <TabsContent value="team" className="space-y-4">
          <TeamWorkspace />
        </TabsContent>

        {/* Compliance Tab */}
        <TabsContent value="compliance" className="space-y-4">
          <ComplianceDashboard />
        </TabsContent>

        {/* Algorithmic Trading Tab */}
        <TabsContent value="algorithmic" className="space-y-4">
          <AlgorithmicTradingDashboard />
        </TabsContent>

        {/* Market Data Tab */}
        <TabsContent value="market-data" className="space-y-4">
          <MarketDataDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
};
