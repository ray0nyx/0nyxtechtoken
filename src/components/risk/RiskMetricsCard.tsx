import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  Shield,
  TrendingDown,
  AlertTriangle,
  Activity,
  Target,
  BarChart3,
  Zap,
  DollarSign,
  Percent,
  TrendingUp
} from 'lucide-react';
import { riskAnalyticsService, RiskMetrics } from '@/services/riskAnalyticsService';

interface RiskMetricsCardProps {
  className?: string;
}

export function RiskMetricsCard({ className }: RiskMetricsCardProps) {
  const [metrics, setMetrics] = useState<RiskMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      setIsLoading(true);
      const data = await riskAnalyticsService.calculateRiskMetrics();
      setMetrics(data);
    } catch (error) {
      console.error('Error loading risk metrics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getRiskLevel = (value: number, thresholds: { low: number; medium: number; high: number }) => {
    if (value <= thresholds.low) return { level: 'low', color: 'text-green-500', bgColor: 'bg-green-100 dark:bg-green-900/20' };
    if (value <= thresholds.medium) return { level: 'medium', color: 'text-yellow-500', bgColor: 'bg-yellow-100 dark:bg-yellow-900/20' };
    if (value <= thresholds.high) return { level: 'high', color: 'text-orange-500', bgColor: 'bg-orange-100 dark:bg-orange-900/20' };
    return { level: 'critical', color: 'text-red-500', bgColor: 'bg-red-100 dark:bg-red-900/20' };
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  if (isLoading) {
    return (
      <Card className={cn("border shadow-sm bg-gray-100 dark:bg-card", className)}>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="h-5 w-5 mr-2 text-primary" />
            Risk Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-muted rounded animate-pulse" />
                <div className="h-2 bg-muted rounded animate-pulse w-3/4" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card className={cn("border shadow-sm bg-gray-100 dark:bg-card", className)}>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="h-5 w-5 mr-2 text-primary" />
            Risk Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No risk data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const leverageRisk = getRiskLevel(metrics.leverage, { low: 1.5, medium: 2.5, high: 4.0 });
  const concentrationRisk = getRiskLevel(metrics.concentrationRisk, { low: 20, medium: 40, high: 60 });
  const drawdownRisk = getRiskLevel(metrics.maxDrawdown, { low: 5, medium: 15, high: 25 });

  return (
    <Card className={cn("border shadow-sm", className)}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Shield className="h-5 w-5 mr-2 text-primary" />
            Risk Metrics
          </div>
          <Badge variant="outline" className="text-xs">
            Real-time
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Exposure Metrics */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">Exposure</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Exposure</span>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-lg font-semibold">{formatCurrency(metrics.totalExposure)}</div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Net Exposure</span>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className={cn(
                "text-lg font-semibold",
                metrics.netExposure >= 0 ? "text-green-500" : "text-red-500"
              )}>
                {formatCurrency(metrics.netExposure)}
              </div>
            </div>
          </div>
        </div>

        {/* Leverage */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Leverage</span>
            <Badge className={cn("text-xs", leverageRisk.bgColor, leverageRisk.color)}>
              {leverageRisk.level.toUpperCase()}
            </Badge>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{metrics.leverage.toFixed(2)}x</span>
              <span className="text-sm text-muted-foreground">Max: {metrics.maxLeverage.toFixed(2)}x</span>
            </div>
            <Progress 
              value={Math.min((metrics.leverage / 4) * 100, 100)} 
              className="h-2"
            />
          </div>
        </div>

        {/* Drawdown */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Drawdown</span>
            <Badge className={cn("text-xs", drawdownRisk.bgColor, drawdownRisk.color)}>
              {drawdownRisk.level.toUpperCase()}
            </Badge>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-red-500">
                {formatPercentage(metrics.maxDrawdown)}
              </span>
              <span className="text-sm text-muted-foreground">
                Current: {formatPercentage(metrics.currentDrawdown)}
              </span>
            </div>
            <Progress 
              value={Math.min(metrics.maxDrawdown, 100)} 
              className="h-2"
            />
          </div>
        </div>

        {/* Risk-Adjusted Returns */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">Risk-Adjusted Returns</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-1">Sharpe</div>
              <div className="text-lg font-semibold">{metrics.sharpeRatio.toFixed(2)}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-1">Sortino</div>
              <div className="text-lg font-semibold">{metrics.sortinoRatio.toFixed(2)}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-1">Calmar</div>
              <div className="text-lg font-semibold">{metrics.calmarRatio.toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* VaR */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">Value at Risk</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">VaR 95%</span>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-lg font-semibold text-orange-500">
                {formatCurrency(metrics.var95)}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">VaR 99%</span>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-lg font-semibold text-red-500">
                {formatCurrency(metrics.var99)}
              </div>
            </div>
          </div>
        </div>

        {/* Concentration Risk */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Concentration Risk</span>
            <Badge className={cn("text-xs", concentrationRisk.bgColor, concentrationRisk.color)}>
              {concentrationRisk.level.toUpperCase()}
            </Badge>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{formatPercentage(metrics.concentrationRisk)}</span>
              <span className="text-sm text-muted-foreground">Herfindahl Index</span>
            </div>
            <Progress 
              value={Math.min(metrics.concentrationRisk, 100)} 
              className="h-2"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
