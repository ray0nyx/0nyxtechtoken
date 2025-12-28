import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  DollarSign, 
  BarChart3,
  Activity,
  Zap,
  Shield,
  Clock,
  Percent
} from 'lucide-react';

interface TradingMetricsProps {
  dailyPnL?: number | null;
  winRate?: number;
  totalTrades?: number;
  avgWin?: number;
  avgLoss?: number;
  profitFactor?: number;
  maxDrawdown?: number;
  className?: string;
}

export function TradingMetrics({
  dailyPnL,
  winRate,
  totalTrades,
  avgWin,
  avgLoss,
  profitFactor,
  maxDrawdown,
  className
}: TradingMetricsProps) {
  const metrics = [
    {
      label: 'Daily P&L',
      value: dailyPnL !== null ? `$${dailyPnL >= 0 ? '+' : ''}${dailyPnL.toFixed(2)}` : 'N/A',
      icon: DollarSign,
      color: dailyPnL !== null ? (dailyPnL >= 0 ? 'text-green-500' : 'text-red-500') : 'text-muted-foreground',
      bgColor: dailyPnL !== null ? (dailyPnL >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20') : 'bg-muted/50',
      borderColor: dailyPnL !== null ? (dailyPnL >= 0 ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800') : 'border-muted'
    },
    {
      label: 'Win Rate',
      value: winRate !== undefined ? `${winRate.toFixed(1)}%` : 'N/A',
      icon: Target,
      color: winRate !== undefined ? (winRate >= 50 ? 'text-green-500' : 'text-orange-500') : 'text-muted-foreground',
      bgColor: winRate !== undefined ? (winRate >= 50 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-orange-50 dark:bg-orange-900/20') : 'bg-muted/50',
      borderColor: winRate !== undefined ? (winRate >= 50 ? 'border-green-200 dark:border-green-800' : 'border-orange-200 dark:border-orange-800') : 'border-muted'
    },
    {
      label: 'Total Trades',
      value: totalTrades !== undefined ? totalTrades.toString() : 'N/A',
      icon: BarChart3,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-200 dark:border-blue-800'
    },
    {
      label: 'Avg Win',
      value: avgWin !== undefined ? `$${avgWin.toFixed(2)}` : 'N/A',
      icon: TrendingUp,
      color: 'text-green-500',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-200 dark:border-green-800'
    },
    {
      label: 'Avg Loss',
      value: avgLoss !== undefined ? `$${avgLoss.toFixed(2)}` : 'N/A',
      icon: TrendingDown,
      color: 'text-red-500',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      borderColor: 'border-red-200 dark:border-red-800'
    },
    {
      label: 'Profit Factor',
      value: profitFactor !== undefined ? profitFactor.toFixed(2) : 'N/A',
      icon: Activity,
      color: profitFactor !== undefined ? (profitFactor >= 1.5 ? 'text-green-500' : 'text-orange-500') : 'text-muted-foreground',
      bgColor: profitFactor !== undefined ? (profitFactor >= 1.5 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-orange-50 dark:bg-orange-900/20') : 'bg-muted/50',
      borderColor: profitFactor !== undefined ? (profitFactor >= 1.5 ? 'border-green-200 dark:border-green-800' : 'border-orange-200 dark:border-orange-800') : 'border-muted'
    }
  ];

  const getPerformanceBadge = () => {
    if (dailyPnL === null || dailyPnL === undefined) return null;
    
    if (dailyPnL > 0) {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Profitable Day</Badge>;
    } else if (dailyPnL < 0) {
      return <Badge variant="destructive">Loss Day</Badge>;
    } else {
      return <Badge variant="secondary">Break Even</Badge>;
    }
  };

  return (
    <Card className={cn("border shadow-sm transition-all duration-300 hover:shadow-md", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium flex items-center">
            <Activity className="h-5 w-5 mr-2 text-primary" />
            Trading Metrics
          </CardTitle>
          {getPerformanceBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {metrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <div
                key={metric.label}
                className={cn(
                  "p-3 rounded-lg border transition-all duration-200 hover:shadow-sm",
                  metric.bgColor,
                  metric.borderColor
                )}
              >
                <div className="flex items-center space-x-2">
                  <Icon className={cn("h-4 w-4", metric.color)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground truncate">
                      {metric.label}
                    </p>
                    <p className={cn("text-sm font-semibold truncate", metric.color)}>
                      {metric.value}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Additional Insights */}
        <div className="pt-3 border-t">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Risk Level</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {maxDrawdown !== undefined ? `${maxDrawdown.toFixed(1)}%` : 'N/A'} Max DD
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
