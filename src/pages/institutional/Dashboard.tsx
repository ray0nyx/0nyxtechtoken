import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, 
  Shield, 
  PieChart, 
  TrendingUp,
  Settings,
  Bell,
  User,
  Globe,
  Zap,
  DollarSign
} from 'lucide-react';
import { RiskDashboard } from '@/components/institutional/RiskDashboard';
import { MultiAssetPortfolio } from '@/components/institutional/MultiAssetPortfolio';
import { ComplianceDashboard } from '@/components/institutional/ComplianceDashboard';
import { AssetClass, PortfolioPosition, RiskMetrics } from '@/types/institutional';

export const InstitutionalDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [portfolio, setPortfolio] = useState<{
    positions: PortfolioPosition[];
    totalValue: number;
    riskMetrics: RiskMetrics;
  }>({
    positions: [],
    totalValue: 0,
    riskMetrics: {
      var95: 0,
      var99: 0,
      expectedShortfall: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      maxDrawdown: 0,
      calmarRatio: 0,
      beta: 0,
      volatility: 0,
      skewness: 0,
      kurtosis: 0
    }
  });

  // Mock data - in real implementation, this would come from API
  useEffect(() => {
    const mockPositions: PortfolioPosition[] = [
      {
        id: '1',
        symbol: 'AAPL',
        assetClass: 'equities',
        quantity: 1000,
        averagePrice: 150.25,
        currentPrice: 175.50,
        marketValue: 175500,
        unrealizedPnL: 25250,
        unrealizedPnLPercent: 16.8,
        weight: 0.35,
        riskMetrics: {
          var95: 8750,
          var99: 12250,
          expectedShortfall: 10500,
          sharpeRatio: 1.85,
          sortinoRatio: 2.1,
          maxDrawdown: 8.5,
          calmarRatio: 2.2,
          beta: 1.2,
          volatility: 18.5,
          skewness: -0.3,
          kurtosis: 2.8
        }
      },
      {
        id: '2',
        symbol: 'EURUSD',
        assetClass: 'fx',
        quantity: 100000,
        averagePrice: 1.0850,
        currentPrice: 1.0920,
        marketValue: 109200,
        unrealizedPnL: 700,
        unrealizedPnLPercent: 0.65,
        weight: 0.22,
        riskMetrics: {
          var95: 2500,
          var99: 3500,
          expectedShortfall: 3000,
          sharpeRatio: 0.95,
          sortinoRatio: 1.1,
          maxDrawdown: 3.2,
          calmarRatio: 0.3,
          beta: 0.1,
          volatility: 8.2,
          skewness: 0.1,
          kurtosis: 1.9
        }
      },
      {
        id: '3',
        symbol: 'BTC',
        assetClass: 'crypto',
        quantity: 5,
        averagePrice: 45000,
        currentPrice: 52000,
        marketValue: 260000,
        unrealizedPnL: 35000,
        unrealizedPnLPercent: 15.6,
        weight: 0.28,
        riskMetrics: {
          var95: 15000,
          var99: 22000,
          expectedShortfall: 18500,
          sharpeRatio: 1.2,
          sortinoRatio: 1.4,
          maxDrawdown: 25.8,
          calmarRatio: 0.6,
          beta: 2.1,
          volatility: 45.2,
          skewness: 0.8,
          kurtosis: 4.2
        }
      },
      {
        id: '4',
        symbol: 'GLD',
        assetClass: 'commodities',
        quantity: 500,
        averagePrice: 180.50,
        currentPrice: 185.25,
        marketValue: 92625,
        unrealizedPnL: 2375,
        unrealizedPnLPercent: 2.6,
        weight: 0.15,
        riskMetrics: {
          var95: 3500,
          var99: 4800,
          expectedShortfall: 4200,
          sharpeRatio: 0.8,
          sortinoRatio: 0.9,
          maxDrawdown: 5.5,
          calmarRatio: 0.47,
          beta: 0.3,
          volatility: 12.8,
          skewness: -0.2,
          kurtosis: 2.1
        }
      }
    ];

    const totalValue = mockPositions.reduce((sum, pos) => sum + pos.marketValue, 0);
    const totalPnL = mockPositions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0);
    
    // Calculate portfolio-level risk metrics
    const portfolioRiskMetrics: RiskMetrics = {
      var95: 25000,
      var99: 35000,
      expectedShortfall: 30000,
      sharpeRatio: 1.4,
      sortinoRatio: 1.6,
      maxDrawdown: 12.5,
      calmarRatio: 1.12,
      beta: 1.1,
      volatility: 22.8,
      skewness: 0.2,
      kurtosis: 3.1
    };

    setPortfolio({
      positions: mockPositions,
      totalValue,
      riskMetrics: portfolioRiskMetrics
    });
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

  return (
    <div className="institutional-theme min-h-screen bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-700 bg-gray-800">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-white"><span className="text-purple-400">0nyx</span> Institutional</h1>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-400">Live</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" className="institutional-btn">
                <Bell className="h-4 w-4 mr-2" />
                Alerts
              </Button>
              <Button variant="outline" size="sm" className="institutional-btn">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
              <Button variant="outline" size="sm" className="institutional-btn">
                <User className="h-4 w-4 mr-2" />
                Profile
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        {/* Portfolio Summary */}
        <div className="institutional-grid institutional-grid-4 gap-6 mb-6">
          <Card className="institutional-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="metric-label">Total Portfolio Value</div>
                  <div className="metric-value text-white">
                    {formatCurrency(portfolio.totalValue)}
                  </div>
                </div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
              <div className="text-xs text-gray-400 mt-2">
                {portfolio.positions.length} positions
              </div>
            </CardContent>
          </Card>

          <Card className="institutional-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="metric-label">Unrealized P&L</div>
                  <div className="metric-value text-green-400">
                    {formatCurrency(portfolio.positions.reduce((sum, p) => sum + p.unrealizedPnL, 0))}
                  </div>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
              <div className="text-xs text-gray-400 mt-2">
                {formatPercent(portfolio.positions.reduce((sum, p) => sum + p.unrealizedPnL, 0) / portfolio.totalValue)}
              </div>
            </CardContent>
          </Card>

          <Card className="institutional-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="metric-label">Sharpe Ratio</div>
                  <div className="metric-value text-blue-400">
                    {portfolio.riskMetrics.sharpeRatio.toFixed(2)}
                  </div>
                </div>
                <BarChart3 className="h-8 w-8 text-blue-500" />
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Risk-adjusted return
              </div>
            </CardContent>
          </Card>

          <Card className="institutional-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="metric-label">VaR 95%</div>
                  <div className="metric-value text-red-400">
                    {formatCurrency(portfolio.riskMetrics.var95)}
                  </div>
                </div>
                <Shield className="h-8 w-8 text-red-500" />
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Daily risk limit
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Dashboard Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="institutional-card p-1">
            <TabsTrigger value="overview" className="institutional-btn">
              <PieChart className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="portfolio" className="institutional-btn">
              <BarChart3 className="h-4 w-4 mr-2" />
              Portfolio
            </TabsTrigger>
            <TabsTrigger value="risk" className="institutional-btn">
              <Shield className="h-4 w-4 mr-2" />
              Risk Management
            </TabsTrigger>
            <TabsTrigger value="compliance" className="institutional-btn">
              <Shield className="h-4 w-4 mr-2" />
              Compliance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="institutional-grid institutional-grid-2 gap-6">
              <Card className="institutional-card">
                <CardHeader className="institutional-card-header">
                  <CardTitle className="institutional-card-title">Asset Allocation</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {['equities', 'fx', 'crypto', 'commodities', 'fixed-income'].map((assetClass) => {
                      const positions = portfolio.positions.filter(p => p.assetClass === assetClass);
                      const totalValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
                      const weight = totalValue / portfolio.totalValue;
                      const pnl = positions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
                      
                      if (totalValue === 0) return null;
                      
                      return (
                        <div key={assetClass} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full" style={{
                              backgroundColor: assetClass === 'equities' ? '#00d4aa' :
                                              assetClass === 'fx' ? '#3742fa' :
                                              assetClass === 'crypto' ? '#a55eea' :
                                              assetClass === 'commodities' ? '#ffb800' : '#00ff88'
                            }}></div>
                            <span className="text-sm font-medium capitalize">
                              {assetClass.replace('-', ' ')}
                            </span>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium text-white">
                              {formatCurrency(totalValue)}
                            </div>
                            <div className="text-xs text-gray-400">
                              {formatPercent(weight)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="institutional-card">
                <CardHeader className="institutional-card-header">
                  <CardTitle className="institutional-card-title">Top Performers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {portfolio.positions
                      .sort((a, b) => b.unrealizedPnLPercent - a.unrealizedPnLPercent)
                      .slice(0, 5)
                      .map((position) => (
                        <div key={position.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <span className="font-mono text-sm">{position.symbol}</span>
                          </div>
                          <div className="text-right">
                            <div className={`text-sm font-medium ${
                              position.unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {position.unrealizedPnL >= 0 ? '+' : ''}{formatPercent(position.unrealizedPnLPercent / 100)}
                            </div>
                            <div className="text-xs text-gray-400">
                              {formatCurrency(position.unrealizedPnL)}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="portfolio">
            <MultiAssetPortfolio 
              positions={portfolio.positions}
              totalValue={portfolio.totalValue}
            />
          </TabsContent>

          <TabsContent value="risk">
            <RiskDashboard portfolio={portfolio} />
          </TabsContent>

          <TabsContent value="compliance">
            <ComplianceDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
