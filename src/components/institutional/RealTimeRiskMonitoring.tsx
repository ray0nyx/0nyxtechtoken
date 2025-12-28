import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  AlertTriangle, 
  Shield, 
  Activity, 
  TrendingUp, 
  TrendingDown,
  Bell,
  Settings,
  Zap,
  Target,
  BarChart3,
  PieChart,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface RiskAlert {
  id: string;
  type: 'var_breach' | 'drawdown' | 'correlation' | 'volatility' | 'liquidity' | 'concentration';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  currentValue: number;
  threshold: number;
  deviation: number;
  timestamp: string;
  status: 'active' | 'acknowledged' | 'resolved';
  action: string;
}

interface RiskMetric {
  name: string;
  value: number;
  threshold: number;
  status: 'normal' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
  change: number;
  unit: string;
}

interface PositionRisk {
  symbol: string;
  position: number;
  marketValue: number;
  var: number;
  beta: number;
  weight: number;
  risk: 'low' | 'medium' | 'high' | 'critical';
  alerts: number;
}

interface StressTest {
  name: string;
  description: string;
  impact: number;
  probability: number;
  status: 'pass' | 'warning' | 'fail';
  lastRun: string;
  nextRun: string;
}

export const RealTimeRiskMonitoring: React.FC = () => {
  const [riskAlerts, setRiskAlerts] = useState<RiskAlert[]>([]);
  const [riskMetrics, setRiskMetrics] = useState<RiskMetric[]>([]);
  const [positionRisks, setPositionRisks] = useState<PositionRisk[]>([]);
  const [stressTests, setStressTests] = useState<StressTest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  useEffect(() => {
    const loadRiskData = async () => {
      setIsLoading(true);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock data
      setRiskAlerts([
        {
          id: '1',
          type: 'var_breach',
          severity: 'high',
          title: 'VaR Breach Alert',
          description: 'Portfolio VaR exceeded threshold by 15%',
          currentValue: -145000,
          threshold: -125000,
          deviation: 0.15,
          timestamp: '2024-01-22T14:30:00Z',
          status: 'active',
          action: 'Reduce position sizes or hedge exposure'
        },
        {
          id: '2',
          type: 'drawdown',
          severity: 'medium',
          title: 'Drawdown Warning',
          description: 'Current drawdown approaching 5% threshold',
          currentValue: -4.2,
          threshold: -5.0,
          deviation: 0.84,
          timestamp: '2024-01-22T14:25:00Z',
          status: 'active',
          action: 'Monitor closely and consider risk reduction'
        },
        {
          id: '3',
          type: 'correlation',
          severity: 'low',
          title: 'Correlation Spike',
          description: 'Portfolio correlation increased to 0.85',
          currentValue: 0.85,
          threshold: 0.80,
          deviation: 0.05,
          timestamp: '2024-01-22T14:20:00Z',
          status: 'acknowledged',
          action: 'Review diversification strategy'
        },
        {
          id: '4',
          type: 'concentration',
          severity: 'medium',
          title: 'Concentration Risk',
          description: 'Top 5 positions represent 65% of portfolio',
          currentValue: 0.65,
          threshold: 0.60,
          deviation: 0.05,
          timestamp: '2024-01-22T14:15:00Z',
          status: 'active',
          action: 'Consider rebalancing to reduce concentration'
        }
      ]);

      setRiskMetrics([
        {
          name: 'Value at Risk (95%)',
          value: -145000,
          threshold: -125000,
          status: 'critical',
          trend: 'down',
          change: -0.15,
          unit: 'USD'
        },
        {
          name: 'Expected Shortfall',
          value: -180000,
          threshold: -150000,
          status: 'warning',
          trend: 'down',
          change: -0.20,
          unit: 'USD'
        },
        {
          name: 'Max Drawdown',
          value: -4.2,
          threshold: -5.0,
          status: 'warning',
          trend: 'down',
          change: -0.84,
          unit: '%'
        },
        {
          name: 'Portfolio Volatility',
          value: 18.5,
          threshold: 20.0,
          status: 'normal',
          trend: 'up',
          change: 0.15,
          unit: '%'
        },
        {
          name: 'Sharpe Ratio',
          value: 1.85,
          threshold: 1.5,
          status: 'normal',
          trend: 'up',
          change: 0.12,
          unit: ''
        },
        {
          name: 'Beta',
          value: 0.89,
          threshold: 1.0,
          status: 'normal',
          trend: 'stable',
          change: 0.02,
          unit: ''
        }
      ]);

      setPositionRisks([
        { symbol: 'AAPL', position: 1000, marketValue: 150000, var: -15000, beta: 1.2, weight: 0.15, risk: 'medium', alerts: 1 },
        { symbol: 'MSFT', position: 500, marketValue: 180000, var: -18000, beta: 0.9, weight: 0.18, risk: 'low', alerts: 0 },
        { symbol: 'GOOGL', position: 200, marketValue: 220000, var: -25000, beta: 1.1, weight: 0.22, risk: 'high', alerts: 2 },
        { symbol: 'TSLA', position: 300, marketValue: 75000, var: -20000, beta: 2.1, weight: 0.075, risk: 'critical', alerts: 3 },
        { symbol: 'NVDA', position: 400, marketValue: 160000, var: -30000, beta: 1.8, weight: 0.16, risk: 'high', alerts: 1 }
      ]);

      setStressTests([
        {
          name: 'Market Crash (-20%)',
          description: 'S&P 500 drops 20%',
          impact: -180000,
          probability: 0.05,
          status: 'warning',
          lastRun: '2024-01-22T14:00:00Z',
          nextRun: '2024-01-22T15:00:00Z'
        },
        {
          name: 'Interest Rate Shock (+2%)',
          description: 'Fed raises rates by 2%',
          impact: -95000,
          probability: 0.15,
          status: 'pass',
          lastRun: '2024-01-22T14:00:00Z',
          nextRun: '2024-01-22T15:00:00Z'
        },
        {
          name: 'Tech Sector Crash (-30%)',
          description: 'Technology sector collapse',
          impact: -220000,
          probability: 0.08,
          status: 'warning',
          lastRun: '2024-01-22T14:00:00Z',
          nextRun: '2024-01-22T15:00:00Z'
        },
        {
          name: 'Volatility Spike (+50%)',
          description: 'VIX increases by 50%',
          impact: -75000,
          probability: 0.12,
          status: 'pass',
          lastRun: '2024-01-22T14:00:00Z',
          nextRun: '2024-01-22T15:00:00Z'
        }
      ]);

      setLastUpdate(new Date().toLocaleTimeString());
      setIsLoading(false);
    };

    loadRiskData();
    
    // Set up real-time updates every 30 seconds
    const interval = setInterval(loadRiskData, 30000);
    
    return () => clearInterval(interval);
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

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'text-green-400';
      case 'medium': return 'text-yellow-400';
      case 'high': return 'text-orange-400';
      case 'critical': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getSeverityBadgeColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-green-900/20 border-green-500/30 text-green-400';
      case 'medium': return 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400';
      case 'high': return 'bg-orange-900/20 border-orange-500/30 text-orange-400';
      case 'critical': return 'bg-red-900/20 border-red-500/30 text-red-400';
      default: return 'bg-gray-900/20 border-gray-500/30 text-gray-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      case 'critical': return 'text-red-400';
      default: return 'text-gray-400';
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
          <h1 className="text-3xl font-bold text-white">Real-Time Risk Monitoring</h1>
          <p className="text-gray-400 mt-1">Live risk monitoring, alerts, and stress testing</p>
          <p className="text-sm text-gray-500 mt-1">Last updated: {lastUpdate}</p>
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

      {/* Risk Alerts */}
      <Card className="institutional-card">
        <CardHeader className="institutional-card-header">
          <CardTitle className="institutional-card-title flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Active Risk Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {riskAlerts.map((alert) => (
              <div key={alert.id} className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h4 className="font-semibold text-white">{alert.title}</h4>
                    <Badge className={getSeverityBadgeColor(alert.severity)}>
                      {alert.severity.toUpperCase()}
                    </Badge>
                    <Badge className={
                      alert.status === 'active' ? 'bg-red-900/20 border-red-500/30 text-red-400' :
                      alert.status === 'acknowledged' ? 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400' :
                      'bg-green-900/20 border-green-500/30 text-green-400'
                    }>
                      {alert.status.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-400">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                
                <p className="text-sm text-gray-400 mb-3">{alert.description}</p>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-gray-400">Current Value</div>
                    <div className="font-mono text-lg text-white">
                      {alert.unit === 'USD' ? formatCurrency(alert.currentValue) : `${alert.currentValue}${alert.unit}`}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Threshold</div>
                    <div className="font-mono text-lg text-blue-400">
                      {alert.unit === 'USD' ? formatCurrency(alert.threshold) : `${alert.threshold}${alert.unit}`}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Deviation</div>
                    <div className={`font-mono text-lg ${alert.deviation > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {formatPercent(alert.deviation)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Action</div>
                    <div className="text-sm text-gray-300">
                      {alert.action}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Risk Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {riskMetrics.map((metric, index) => (
          <Card key={index} className="institutional-card">
            <CardHeader className="institutional-card-header">
              <CardTitle className="institutional-card-title flex items-center gap-2">
                {getTrendIcon(metric.trend)}
                {metric.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Current Value</span>
                  <span className={`font-mono text-lg ${getStatusColor(metric.status)}`}>
                    {metric.unit === 'USD' ? formatCurrency(metric.value) : 
                     metric.unit === '%' ? `${metric.value}%` : 
                     metric.value.toFixed(2)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Threshold</span>
                  <span className="font-mono text-lg text-blue-400">
                    {metric.unit === 'USD' ? formatCurrency(metric.threshold) : 
                     metric.unit === '%' ? `${metric.threshold}%` : 
                     metric.threshold.toFixed(2)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Change</span>
                  <span className={`font-mono text-lg ${metric.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {metric.change >= 0 ? '+' : ''}{metric.change.toFixed(2)}
                  </span>
                </div>
                
                <div className="pt-2 border-t border-gray-700">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Status</span>
                    <Badge className={
                      metric.status === 'normal' ? 'bg-green-900/20 border-green-500/30 text-green-400' :
                      metric.status === 'warning' ? 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400' :
                      'bg-red-900/20 border-red-500/30 text-red-400'
                    }>
                      {metric.status.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Position Risk and Stress Tests */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="institutional-card">
          <CardHeader className="institutional-card-header">
            <CardTitle className="institutional-card-title">Position Risk Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {positionRisks.map((position, index) => (
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
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="institutional-card">
          <CardHeader className="institutional-card-header">
            <CardTitle className="institutional-card-title">Stress Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stressTests.map((test, index) => (
                <div key={index} className="p-3 bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-white">{test.name}</h4>
                    <Badge className={
                      test.status === 'pass' ? 'bg-green-900/20 border-green-500/30 text-green-400' :
                      test.status === 'warning' ? 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400' :
                      'bg-red-900/20 border-red-500/30 text-red-400'
                    }>
                      {test.status.toUpperCase()}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-gray-400 mb-2">{test.description}</p>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">
                      Impact: {formatCurrency(test.impact)}
                    </span>
                    <span className="text-sm text-gray-400">
                      Probability: {formatPercent(test.probability)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
