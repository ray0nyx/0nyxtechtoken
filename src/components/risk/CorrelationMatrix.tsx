import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Info,
  RefreshCw
} from 'lucide-react';
import { riskAnalyticsService, CorrelationMatrix } from '@/services/riskAnalyticsService';

interface CorrelationMatrixProps {
  className?: string;
}

export function CorrelationMatrixCard({ className }: CorrelationMatrixProps) {
  const [correlationData, setCorrelationData] = useState<CorrelationMatrix | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  useEffect(() => {
    loadCorrelationData();
  }, []);

  const loadCorrelationData = async () => {
    try {
      setIsLoading(true);
      // This would be called from the risk analytics service
      // For now, we'll simulate the data
      const mockData: CorrelationMatrix = {
        symbols: ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'NVDA', 'AMZN'],
        correlations: [
          [1.00, 0.65, 0.72, 0.45, 0.68, 0.58],
          [0.65, 1.00, 0.78, 0.52, 0.71, 0.63],
          [0.72, 0.78, 1.00, 0.48, 0.75, 0.69],
          [0.45, 0.52, 0.48, 1.00, 0.55, 0.41],
          [0.68, 0.71, 0.75, 0.55, 1.00, 0.66],
          [0.58, 0.63, 0.69, 0.41, 0.66, 1.00]
        ],
        averageCorrelation: 0.62,
        maxCorrelation: 0.78,
        diversificationRatio: 0.38
      };
      setCorrelationData(mockData);
    } catch (error) {
      console.error('Error loading correlation data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getCorrelationColor = (correlation: number) => {
    const absCorr = Math.abs(correlation);
    if (absCorr < 0.3) return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
    if (absCorr < 0.6) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
    if (absCorr < 0.8) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
    return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
  };

  const getCorrelationIcon = (correlation: number) => {
    if (correlation > 0.7) return <TrendingUp className="h-3 w-3" />;
    if (correlation < -0.7) return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  const getDiversificationLevel = (ratio: number) => {
    if (ratio > 0.7) return { level: 'Excellent', color: 'text-green-500' };
    if (ratio > 0.5) return { level: 'Good', color: 'text-yellow-500' };
    if (ratio > 0.3) return { level: 'Fair', color: 'text-orange-500' };
    return { level: 'Poor', color: 'text-red-500' };
  };

  if (isLoading) {
    return (
      <Card className={cn("border shadow-sm bg-gray-100 dark:bg-card", className)}>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="h-5 w-5 mr-2 text-primary" />
            Correlation Matrix
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-4 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!correlationData) {
    return (
      <Card className={cn("border shadow-sm bg-gray-100 dark:bg-card", className)}>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="h-5 w-5 mr-2 text-primary" />
            Correlation Matrix
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No correlation data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const diversification = getDiversificationLevel(correlationData.diversificationRatio);

  return (
    <Card className={cn("border shadow-sm", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <BarChart3 className="h-5 w-5 mr-2 text-primary" />
            Correlation Matrix
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={loadCorrelationData}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-500">
              {correlationData.averageCorrelation.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground">Avg Correlation</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-500">
              {correlationData.maxCorrelation.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground">Max Correlation</div>
          </div>
          <div className="text-center">
            <div className={cn("text-2xl font-bold", diversification.color)}>
              {correlationData.diversificationRatio.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground">Diversification</div>
          </div>
        </div>

        {/* Diversification Assessment */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Diversification Level</span>
            <Badge className={cn("text-xs", diversification.color)}>
              {diversification.level}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            {diversification.level === 'Excellent' && 'Portfolio is well diversified with low correlations'}
            {diversification.level === 'Good' && 'Portfolio shows good diversification with moderate correlations'}
            {diversification.level === 'Fair' && 'Portfolio has some diversification but could be improved'}
            {diversification.level === 'Poor' && 'Portfolio lacks diversification with high correlations'}
          </div>
        </div>

        {/* Correlation Matrix */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Position Correlations</h3>
          <div className="overflow-x-auto">
            <div className="min-w-max">
              {/* Header Row */}
              <div className="flex mb-2">
                <div className="w-16"></div>
                {correlationData.symbols.map(symbol => (
                  <div key={symbol} className="w-12 text-center text-xs font-medium text-muted-foreground">
                    {symbol}
                  </div>
                ))}
              </div>
              
              {/* Matrix Rows */}
              {correlationData.symbols.map((symbol, rowIndex) => (
                <div key={symbol} className="flex items-center mb-1">
                  <div className="w-16 text-xs font-medium text-muted-foreground pr-2">
                    {symbol}
                  </div>
                  {correlationData.symbols.map((_, colIndex) => {
                    const correlation = correlationData.correlations[rowIndex][colIndex];
                    const isDiagonal = rowIndex === colIndex;
                    const isSelected = selectedSymbol === symbol;
                    
                    return (
                      <button
                        key={`${rowIndex}-${colIndex}`}
                        className={cn(
                          "w-12 h-8 border rounded-sm flex items-center justify-center text-xs font-medium transition-all duration-200 hover:scale-105",
                          isDiagonal 
                            ? "bg-gray-100 dark:bg-gray-800 text-gray-500" 
                            : getCorrelationColor(correlation),
                          isSelected && "ring-2 ring-primary"
                        )}
                        onClick={() => setSelectedSymbol(isSelected ? null : symbol)}
                        disabled={isDiagonal}
                        title={`${symbol} vs ${correlationData.symbols[colIndex]}: ${correlation.toFixed(2)}`}
                      >
                        {isDiagonal ? (
                          <Minus className="h-3 w-3" />
                        ) : (
                          <div className="flex items-center space-x-1">
                            {getCorrelationIcon(correlation)}
                            <span>{correlation.toFixed(1)}</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Selected Symbol Analysis */}
        {selectedSymbol && (
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium mb-3">
              {selectedSymbol} Correlation Analysis
            </h3>
            <div className="space-y-2">
              {correlationData.symbols
                .filter(symbol => symbol !== selectedSymbol)
                .map(symbol => {
                  const symbolIndex = correlationData.symbols.indexOf(symbol);
                  const selectedIndex = correlationData.symbols.indexOf(selectedSymbol);
                  const correlation = correlationData.correlations[selectedIndex][symbolIndex];
                  
                  return (
                    <div key={symbol} className="flex items-center justify-between">
                      <span className="text-sm">{symbol}</span>
                      <div className="flex items-center space-x-2">
                        <Badge className={cn("text-xs", getCorrelationColor(correlation))}>
                          {correlation.toFixed(2)}
                        </Badge>
                        {getCorrelationIcon(correlation)}
                      </div>
                    </div>
                  );
                })
              }
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-green-100 rounded" />
                <span>Low (&lt;0.3)</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-yellow-100 rounded" />
                <span>Moderate (0.3-0.6)</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-orange-100 rounded" />
                <span>High (0.6-0.8)</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-red-100 rounded" />
                <span>Very High (&gt;0.8)</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
