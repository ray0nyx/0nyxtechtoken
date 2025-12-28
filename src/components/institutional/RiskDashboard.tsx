import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Shield, 
  BarChart3,
  Activity,
  Target,
  Zap
} from 'lucide-react';
import { RiskMetrics, PortfolioPosition } from '@/types/institutional';

interface RiskDashboardProps {
  portfolio: {
    positions: PortfolioPosition[];
    totalValue: number;
    riskMetrics: RiskMetrics;
  };
  className?: string;
}

export const RiskDashboard: React.FC<RiskDashboardProps> = ({ portfolio, className = '' }) => {
  const [realTimeMetrics, setRealTimeMetrics] = useState<RiskMetrics>(portfolio.riskMetrics);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setRealTimeMetrics(prev => ({
        ...prev,
        var95: prev.var95 * (0.98 + Math.random() * 0.04),
        sharpeRatio: prev.sharpeRatio * (0.99 + Math.random() * 0.02),
        volatility: prev.volatility * (0.98 + Math.random() * 0.04),
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getRiskLevel = (value: number, thresholds: { low: number; medium: number; high: number }) => {
    if (value <= thresholds.low) return 'low';
    if (value <= thresholds.medium) return 'medium';
    if (value <= thresholds.high) return 'high';
    return 'critical';
  };

  const varRiskLevel = getRiskLevel(realTimeMetrics.var95, { low: 2, medium: 5, high: 10 });
  const sharpeRiskLevel = getRiskLevel(realTimeMetrics.sharpeRatio, { low: 0.5, medium: 1.0, high: 2.0 });
  const drawdownRiskLevel = getRiskLevel(realTimeMetrics.maxDrawdown, { low: 5, medium: 10, high: 20 });

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

  const formatNumber = (value: number, decimals: number = 2) => {
    return value.toFixed(decimals);
  };

  return (
    <div className={`institutional-theme ${className}`}>
      <div className="institutional-grid institutional-grid-4 gap-6">
        {/* VaR Metrics */}
        <Card className="institutional-card">
          <CardHeader className="institutional-card-header">
            <CardTitle className="institutional-card-title flex items-center gap-2">
              <Shield className="h-5 w-5 text-red-500" />
              Value at Risk
            </CardTitle>
            <p className="institutional-card-subtitle">95% and 99% confidence levels</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="metric-label">VaR 95%</div>
                <div className="metric-value text-red-400">
                  {formatCurrency(realTimeMetrics.var95)}
                </div>
              </div>
              <div className="text-right">
                <Badge className={`risk-indicator ${varRiskLevel}`}>
                  {varRiskLevel.toUpperCase()}
                </Badge>
                <div className="text-xs text-gray-400 mt-1">
                  {formatPercent(realTimeMetrics.var95 / portfolio.totalValue)}
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <div>
                <div className="metric-label">VaR 99%</div>
                <div className="metric-value text-red-300">
                  {formatCurrency(realTimeMetrics.var99)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400">
                  {formatPercent(realTimeMetrics.var99 / portfolio.totalValue)}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-700">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Expected Shortfall</span>
                <span className="text-red-400 font-mono">
                  {formatCurrency(realTimeMetrics.expectedShortfall)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Metrics */}
        <Card className="institutional-card">
          <CardHeader className="institutional-card-header">
            <CardTitle className="institutional-card-title flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Performance
            </CardTitle>
            <p className="institutional-card-subtitle">Risk-adjusted returns</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="metric-label">Sharpe Ratio</div>
                <div className="metric-value text-green-400">
                  {formatNumber(realTimeMetrics.sharpeRatio)}
                </div>
              </div>
              <div className="text-right">
                <Badge className={`risk-indicator ${sharpeRiskLevel}`}>
                  {sharpeRiskLevel.toUpperCase()}
                </Badge>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <div>
                <div className="metric-label">Sortino Ratio</div>
                <div className="metric-value text-blue-400">
                  {formatNumber(realTimeMetrics.sortinoRatio)}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <div>
                <div className="metric-label">Calmar Ratio</div>
                <div className="metric-value text-purple-400">
                  {formatNumber(realTimeMetrics.calmarRatio)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Drawdown Analysis */}
        <Card className="institutional-card">
          <CardHeader className="institutional-card-header">
            <CardTitle className="institutional-card-title flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-orange-500" />
              Drawdown
            </CardTitle>
            <p className="institutional-card-subtitle">Maximum loss analysis</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="metric-label">Max Drawdown</div>
                <div className="metric-value text-orange-400">
                  {formatPercent(realTimeMetrics.maxDrawdown / 100)}
                </div>
              </div>
              <div className="text-right">
                <Badge className={`risk-indicator ${drawdownRiskLevel}`}>
                  {drawdownRiskLevel.toUpperCase()}
                </Badge>
              </div>
            </div>
            
            <div className="pt-2 border-t border-gray-700 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Current Drawdown</span>
                <span className="text-orange-400 font-mono">
                  {formatPercent(Math.random() * 5)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Recovery Time</span>
                <span className="text-gray-300 font-mono">
                  {Math.floor(Math.random() * 30)} days
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Volatility & Beta */}
        <Card className="institutional-card">
          <CardHeader className="institutional-card-header">
            <CardTitle className="institutional-card-title flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              Market Risk
            </CardTitle>
            <p className="institutional-card-subtitle">Volatility and correlation</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="metric-label">Volatility</div>
                <div className="metric-value text-blue-400">
                  {formatPercent(realTimeMetrics.volatility / 100)}
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <div>
                <div className="metric-label">Beta</div>
                <div className="metric-value text-yellow-400">
                  {formatNumber(realTimeMetrics.beta)}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-700 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Skewness</span>
                <span className="text-gray-300 font-mono">
                  {formatNumber(realTimeMetrics.skewness)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Kurtosis</span>
                <span className="text-gray-300 font-mono">
                  {formatNumber(realTimeMetrics.kurtosis)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Alerts */}
      <Card className="institutional-card mt-6">
        <CardHeader className="institutional-card-header">
          <CardTitle className="institutional-card-title flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Risk Alerts
          </CardTitle>
          <p className="institutional-card-subtitle">Active risk monitoring</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {varRiskLevel === 'high' && (
              <div className="flex items-center gap-3 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <div>
                  <div className="text-sm font-medium text-red-400">High VaR Alert</div>
                  <div className="text-xs text-red-300">
                    VaR 95% exceeds recommended threshold
                  </div>
                </div>
              </div>
            )}
            
            {drawdownRiskLevel === 'high' && (
              <div className="flex items-center gap-3 p-3 bg-orange-900/20 border border-orange-500/30 rounded-lg">
                <TrendingDown className="h-4 w-4 text-orange-500" />
                <div>
                  <div className="text-sm font-medium text-orange-400">Drawdown Alert</div>
                  <div className="text-xs text-orange-300">
                    Maximum drawdown approaching limit
                  </div>
                </div>
              </div>
            )}

            {sharpeRiskLevel === 'low' && (
              <div className="flex items-center gap-3 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                <Target className="h-4 w-4 text-yellow-500" />
                <div>
                  <div className="text-sm font-medium text-yellow-400">Performance Alert</div>
                  <div className="text-xs text-yellow-300">
                    Sharpe ratio below target threshold
                  </div>
                </div>
              </div>
            )}

            {varRiskLevel === 'low' && sharpeRiskLevel === 'high' && drawdownRiskLevel === 'low' && (
              <div className="flex items-center gap-3 p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
                <Zap className="h-4 w-4 text-green-500" />
                <div>
                  <div className="text-sm font-medium text-green-400">Optimal Risk Profile</div>
                  <div className="text-xs text-green-300">
                    All risk metrics within target ranges
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
