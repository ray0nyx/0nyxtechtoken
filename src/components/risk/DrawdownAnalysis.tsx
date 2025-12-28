import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  TrendingDown,
  Clock,
  Calendar,
  AlertTriangle,
  BarChart3,
  DollarSign,
  Percent,
  Activity
} from 'lucide-react';
import { riskAnalyticsService, DrawdownContribution } from '@/services/riskAnalyticsService';

interface DrawdownAnalysisProps {
  className?: string;
}

export function DrawdownAnalysisCard({ className }: DrawdownAnalysisProps) {
  const [drawdownData, setDrawdownData] = useState<DrawdownContribution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'contribution' | 'percentage' | 'duration'>('contribution');
  const [timeFilter, setTimeFilter] = useState<'all' | '30d' | '90d' | '1y'>('all');

  useEffect(() => {
    loadDrawdownData();
  }, [timeFilter]);

  const loadDrawdownData = async () => {
    try {
      setIsLoading(true);
      const data = await riskAnalyticsService.getDrawdownContributions();
      
      // Apply time filter
      let filteredData = data;
      if (timeFilter !== 'all') {
        const cutoffDate = new Date();
        switch (timeFilter) {
          case '30d':
            cutoffDate.setDate(cutoffDate.getDate() - 30);
            break;
          case '90d':
            cutoffDate.setDate(cutoffDate.getDate() - 90);
            break;
          case '1y':
            cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
            break;
        }
        filteredData = data.filter(item => new Date(item.peakDate) >= cutoffDate);
      }
      
      setDrawdownData(filteredData);
    } catch (error) {
      console.error('Error loading drawdown data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sortedData = [...drawdownData].sort((a, b) => {
    switch (sortBy) {
      case 'contribution':
        return b.contribution - a.contribution;
      case 'percentage':
        return b.percentage - a.percentage;
      case 'duration':
        return b.duration - a.duration;
      default:
        return 0;
    }
  });

  const totalDrawdown = drawdownData.reduce((sum, item) => sum + item.contribution, 0);
  const maxDrawdown = Math.max(...drawdownData.map(item => item.contribution), 0);

  const getSeverityColor = (percentage: number) => {
    if (percentage < 5) return 'text-green-500 bg-green-100 dark:bg-green-900/20';
    if (percentage < 15) return 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/20';
    if (percentage < 30) return 'text-orange-500 bg-orange-100 dark:bg-orange-900/20';
    return 'text-red-500 bg-red-100 dark:bg-red-900/20';
  };

  const getDurationColor = (duration: number) => {
    if (duration < 7) return 'text-green-500';
    if (duration < 30) return 'text-yellow-500';
    if (duration < 90) return 'text-orange-500';
    return 'text-red-500';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <Card className={cn("border shadow-sm bg-gray-100 dark:bg-card", className)}>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingDown className="h-5 w-5 mr-2 text-primary" />
            Drawdown Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
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

  if (drawdownData.length === 0) {
    return (
      <Card className={cn("border shadow-sm bg-gray-100 dark:bg-card", className)}>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingDown className="h-5 w-5 mr-2 text-primary" />
            Drawdown Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <TrendingDown className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No drawdown data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border shadow-sm", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <TrendingDown className="h-5 w-5 mr-2 text-primary" />
            Drawdown Analysis
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Select value={timeFilter} onValueChange={(value: any) => setTimeFilter(value)}>
              <SelectTrigger className="w-24 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="30d">30D</SelectItem>
                <SelectItem value="90d">90D</SelectItem>
                <SelectItem value="1y">1Y</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-500">
              {formatCurrency(totalDrawdown)}
            </div>
            <div className="text-xs text-muted-foreground">Total Drawdown</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-500">
              {formatCurrency(maxDrawdown)}
            </div>
            <div className="text-xs text-muted-foreground">Max Single</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-500">
              {drawdownData.length}
            </div>
            <div className="text-xs text-muted-foreground">Positions</div>
          </div>
        </div>

        {/* Sort Options */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Sort by:</span>
          <div className="flex space-x-2">
            {[
              { value: 'contribution', label: 'Amount' },
              { value: 'percentage', label: 'Percentage' },
              { value: 'duration', label: 'Duration' }
            ].map(option => (
              <Button
                key={option.value}
                variant={sortBy === option.value ? "default" : "outline"}
                size="sm"
                onClick={() => setSortBy(option.value as any)}
                className="text-xs h-7"
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Drawdown Contributions */}
        <div className="space-y-3">
          {sortedData.slice(0, 10).map((item, index) => (
            <div key={item.symbol} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium">{item.symbol}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(item.peakDate)} → {formatDate(item.troughDate)}
                    </div>
                  </div>
                </div>
                <Badge className={cn("text-xs", getSeverityColor(item.percentage))}>
                  {item.percentage.toFixed(1)}%
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Contribution</div>
                  <div className="text-lg font-semibold text-red-500">
                    {formatCurrency(item.contribution)}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Duration</div>
                  <div className={cn("text-lg font-semibold", getDurationColor(item.duration))}>
                    {item.duration}d
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Recovery</div>
                  <div className="text-lg font-semibold">
                    {item.recoveryDate ? formatDate(item.recoveryDate) : 'Ongoing'}
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Drawdown Severity</span>
                  <span>{item.percentage.toFixed(1)}%</span>
                </div>
                <Progress 
                  value={Math.min(item.percentage, 100)} 
                  className="h-2"
                />
              </div>

              {/* Timeline */}
              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>Peak: {formatDate(item.peakDate)}</span>
                <Clock className="h-3 w-3 ml-2" />
                <span>Duration: {item.duration} days</span>
                {item.recoveryDate && (
                  <>
                    <Activity className="h-3 w-3 ml-2" />
                    <span>Recovered: {formatDate(item.recoveryDate)}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Top Contributors Summary */}
        {drawdownData.length > 0 && (
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium mb-3">Top Contributors</h3>
            <div className="space-y-2">
              {drawdownData.slice(0, 5).map((item, index) => (
                <div key={item.symbol} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-muted rounded-full flex items-center justify-center text-xs">
                      {index + 1}
                    </div>
                    <span className="text-sm font-medium">{item.symbol}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">
                      {formatCurrency(item.contribution)}
                    </span>
                    <Badge className={cn("text-xs", getSeverityColor(item.percentage))}>
                      {item.percentage.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risk Assessment */}
        <div className="border-t pt-4">
          <div className="flex items-center space-x-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-medium">Risk Assessment</span>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            {totalDrawdown > 100000 && (
              <p>⚠️ High total drawdown exposure detected</p>
            )}
            {maxDrawdown > 50000 && (
              <p>⚠️ Individual position causing significant drawdown</p>
            )}
            {drawdownData.filter(item => item.duration > 90).length > 0 && (
              <p>⚠️ Some positions have been in drawdown for extended periods</p>
            )}
            {drawdownData.length === 0 && (
              <p>✅ No significant drawdowns detected</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
