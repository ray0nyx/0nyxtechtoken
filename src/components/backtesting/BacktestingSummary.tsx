import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Shield, 
  Brain, 
  Zap, 
  Target,
  Activity,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface BacktestingSummaryProps {
  totalBacktests: number;
  successfulBacktests: number;
  averageReturn: number;
  bestReturn: number;
  worstReturn: number;
  averageSharpe: number;
  totalRiskScore: number;
  features: {
    advancedBacktesting: boolean;
    liveTickerFeed: boolean;
    tradingViewIntegration: boolean;
    riskManagement: boolean;
    strategyBuilder: boolean;
    monteCarloSimulation: boolean;
    walkForwardAnalysis: boolean;
  };
}

export const BacktestingSummary: React.FC<BacktestingSummaryProps> = ({
  totalBacktests,
  successfulBacktests,
  averageReturn,
  bestReturn,
  worstReturn,
  averageSharpe,
  totalRiskScore,
  features
}) => {
  const successRate = totalBacktests > 0 ? (successfulBacktests / totalBacktests) * 100 : 0;
  const riskLevel = totalRiskScore < 30 ? 'Low' : totalRiskScore < 70 ? 'Medium' : 'High';
  const riskColor = riskLevel === 'Low' ? 'text-green-600' : riskLevel === 'Medium' ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Enhanced Backtesting System Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{totalBacktests}</div>
              <div className="text-sm text-muted-foreground">Total Backtests</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{successRate.toFixed(1)}%</div>
              <div className="text-sm text-muted-foreground">Success Rate</div>
            </div>
            <div className="text-center">
              <div className={`text-3xl font-bold ${averageReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {averageReturn.toFixed(2)}%
              </div>
              <div className="text-sm text-muted-foreground">Avg Return</div>
            </div>
            <div className="text-center">
              <div className={`text-3xl font-bold ${riskColor}`}>
                {riskLevel}
              </div>
              <div className="text-sm text-muted-foreground">Risk Level</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Performance Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Best Performance</span>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="font-medium text-green-600">{bestReturn.toFixed(2)}%</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Worst Performance</span>
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  <span className="font-medium text-red-600">{worstReturn.toFixed(2)}%</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Average Sharpe Ratio</span>
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-500" />
                  <span className="font-medium">{averageSharpe.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Risk Score</span>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-purple-500" />
                  <span className={`font-medium ${riskColor}`}>{totalRiskScore}/100</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              System Features
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(features).map(([feature, enabled]) => (
                <div key={feature} className="flex items-center justify-between">
                  <span className="text-sm capitalize">
                    {feature.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </span>
                  <div className="flex items-center gap-2">
                    {enabled ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    <Badge variant={enabled ? "default" : "destructive"}>
                      {enabled ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Advanced Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <Activity className="h-8 w-8 mx-auto mb-2 text-blue-500" />
              <h3 className="font-semibold">Walk-Forward Analysis</h3>
              <p className="text-sm text-muted-foreground">Test strategy stability across time periods</p>
            </div>
            
            <div className="text-center p-4 border rounded-lg">
              <Brain className="h-8 w-8 mx-auto mb-2 text-purple-500" />
              <h3 className="font-semibold">Monte Carlo Simulation</h3>
              <p className="text-sm text-muted-foreground">Simulate thousands of possible outcomes</p>
            </div>
            
            <div className="text-center p-4 border rounded-lg">
              <Shield className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <h3 className="font-semibold">Risk Management</h3>
              <p className="text-sm text-muted-foreground">Advanced risk controls and monitoring</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
