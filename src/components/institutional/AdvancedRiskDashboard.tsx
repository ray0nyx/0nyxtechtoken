import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Shield, 
  AlertTriangle, 
  TrendingDown, 
  TrendingUp,
  Activity,
  Target,
  Zap,
  BarChart3,
  PieChart,
  Settings
} from 'lucide-react';

interface RiskMetrics {
  var95: number;
  var99: number;
  expectedShortfall: number;
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  beta: number;
  correlation: number;
  volatility: number;
  skewness: number;
  kurtosis: number;
}

interface PositionRisk {
  symbol: string;
  position: number;
  marketValue: number;
  var: number;
  beta: number;
  weight: number;
  risk: 'low' | 'medium' | 'high' | 'critical';
}

interface StressTestScenario {
  name: string;
  description: string;
  impact: number;
  probability: number;
  status: 'pass' | 'warning' | 'fail';
}

export const AdvancedRiskDashboard: React.FC = () => {
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics>({
    var95: 0,
    var99: 0,
    expectedShortfall: 0,
    maxDrawdown: 0,
    sharpeRatio: 0,
    sortinoRatio: 0,
    calmarRatio: 0,
    beta: 0,
    correlation: 0,
    volatility: 0,
    skewness: 0,
    kurtosis: 0
  });

  const [positionRisks, setPositionRisks] = useState<PositionRisk[]>([]);
  const [stressTests, setStressTests] = useState<StressTestScenario[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading risk data
    const loadRiskData = async () => {
      setIsLoading(true);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock data - in production, this would come from your risk engine
      setRiskMetrics({
        var95: -125000,
        var99: -180000,
        expectedShortfall: -220000,
        maxDrawdown: -350000,
        sharpeRatio: 1.85,
        sortinoRatio: 2.34,
        calmarRatio: 0.67,
        beta: 0.89,
        correlation: 0.72,
        volatility: 0.18,
        skewness: -0.23,
        kurtosis: 3.45
      });

      setPositionRisks([
        { symbol: 'AAPL', position: 1000, marketValue: 150000, var: -15000, beta: 1.2, weight: 0.15, risk: 'medium' },
        { symbol: 'MSFT', position: 500, marketValue: 180000, var: -18000, beta: 0.9, weight: 0.18, risk: 'low' },
        { symbol: 'GOOGL', position: 200, marketValue: 220000, var: -25000, beta: 1.1, weight: 0.22, risk: 'high' },
        { symbol: 'TSLA', position: 300, marketValue: 75000, var: -20000, beta: 2.1, weight: 0.075, risk: 'critical' },
        { symbol: 'NVDA', position: 400, marketValue: 160000, var: -30000, beta: 1.8, weight: 0.16, risk: 'high' }
      ]);

      setStressTests([
        { name: 'Market Crash (-20%)', description: 'S&P 500 drops 20%', impact: -180000, probability: 0.05, status: 'warning' },
        { name: 'Interest Rate Shock (+2%)', description: 'Fed raises rates by 2%', impact: -95000, probability: 0.15, status: 'pass' },
        { name: 'Tech Sector Crash (-30%)', description: 'Technology sector collapse', impact: -220000, probability: 0.08, status: 'warning' },
        { name: 'Volatility Spike (+50%)', description: 'VIX increases by 50%', impact: -75000, probability: 0.12, status: 'pass' }
      ]);

      setIsLoading(false);
    };

    loadRiskData();
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

  if (isLoading) {
    return (
      <div className="institutional-theme p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
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
          <h1 className="text-3xl font-bold text-white">Advanced Risk Dashboard</h1>
          <p className="text-gray-400 mt-1">Real-time risk monitoring and analysis</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="institutional-btn">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button variant="outline" size="sm" className="institutional-btn">
            <BarChart3 className="h-4 w-4 mr-2" />
            Reports
          </Button>
        </div>
      </div>

      {/* Key Risk Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="institutional-card">
          <CardHeader className="institutional-card-header">
            <CardTitle className="institutional-card-title flex items-center gap-2">
              <Shield className="h-5 w-5 text-red-500" />
              Value at Risk (95%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">
              {formatCurrency(riskMetrics.var95)}
            </div>
            <div className="text-sm text-gray-400 mt-1">
              Daily VaR at 95% confidence
            </div>
          </CardContent>
        </Card>

        <Card className="institutional-card">
          <CardHeader className="institutional-card-header">
            <CardTitle className="institutional-card-title flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Expected Shortfall
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-400">
              {formatCurrency(riskMetrics.expectedShortfall)}
            </div>
            <div className="text-sm text-gray-400 mt-1">
              Average loss beyond VaR
            </div>
          </CardContent>
        </Card>

        <Card className="institutional-card">
          <CardHeader className="institutional-card-header">
            <CardTitle className="institutional-card-title flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-purple-500" />
              Max Drawdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-400">
              {formatCurrency(riskMetrics.maxDrawdown)}
            </div>
            <div className="text-sm text-gray-400 mt-1">
              Peak-to-trough decline
            </div>
          </CardContent>
        </Card>

        <Card className="institutional-card">
          <CardHeader className="institutional-card-header">
            <CardTitle className="institutional-card-title flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-500" />
              Sharpe Ratio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">
              {riskMetrics.sharpeRatio.toFixed(2)}
            </div>
            <div className="text-sm text-gray-400 mt-1">
              Risk-adjusted returns
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Risk Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="institutional-card">
          <CardHeader className="institutional-card-header">
            <CardTitle className="institutional-card-title">Risk-Adjusted Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Sortino Ratio</span>
              <span className="font-mono text-lg text-green-400">
                {riskMetrics.sortinoRatio.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Calmar Ratio</span>
              <span className="font-mono text-lg text-blue-400">
                {riskMetrics.calmarRatio.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Beta</span>
              <span className="font-mono text-lg text-yellow-400">
                {riskMetrics.beta.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Volatility</span>
              <span className="font-mono text-lg text-purple-400">
                {formatPercent(riskMetrics.volatility)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Skewness</span>
              <span className="font-mono text-lg text-orange-400">
                {riskMetrics.skewness.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Kurtosis</span>
              <span className="font-mono text-lg text-red-400">
                {riskMetrics.kurtosis.toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="institutional-card">
          <CardHeader className="institutional-card-header">
            <CardTitle className="institutional-card-title">Position Risk Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {positionRisks.map((position, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="font-mono font-bold text-sm">{position.symbol}</div>
                    <Badge className={getRiskBadgeColor(position.risk)}>
                      {position.risk.toUpperCase()}
                    </Badge>
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
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stress Testing */}
      <Card className="institutional-card">
        <CardHeader className="institutional-card-header">
          <CardTitle className="institutional-card-title flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Stress Test Scenarios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stressTests.map((scenario, index) => (
              <div key={index} className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-white">{scenario.name}</h4>
                  <Badge className={
                    scenario.status === 'pass' ? 'bg-green-900/20 border-green-500/30 text-green-400' :
                    scenario.status === 'warning' ? 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400' :
                    'bg-red-900/20 border-red-500/30 text-red-400'
                  }>
                    {scenario.status.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-sm text-gray-400 mb-3">{scenario.description}</p>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-300">
                    Impact: {formatCurrency(scenario.impact)}
                  </span>
                  <span className="text-sm text-gray-300">
                    Probability: {formatPercent(scenario.probability)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
