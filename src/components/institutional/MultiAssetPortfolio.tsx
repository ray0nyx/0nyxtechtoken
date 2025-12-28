import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  PieChart,
  BarChart3,
  Globe,
  Zap,
  Shield
} from 'lucide-react';
import { AssetClass, PortfolioPosition, HeatmapData } from '@/types/institutional';

interface MultiAssetPortfolioProps {
  positions: PortfolioPosition[];
  totalValue: number;
  className?: string;
}

export const MultiAssetPortfolio: React.FC<MultiAssetPortfolioProps> = ({ 
  positions, 
  totalValue, 
  className = '' 
}) => {
  const [selectedAssetClass, setSelectedAssetClass] = useState<AssetClass | 'all'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'heatmap'>('table');

  // Calculate asset class breakdown
  const assetClassBreakdown = positions.reduce((acc, position) => {
    const assetClass = position.assetClass;
    if (!acc[assetClass]) {
      acc[assetClass] = {
        count: 0,
        value: 0,
        pnl: 0,
        weight: 0
      };
    }
    acc[assetClass].count += 1;
    acc[assetClass].value += position.marketValue;
    acc[assetClass].pnl += position.unrealizedPnL;
    acc[assetClass].weight += position.weight;
    return acc;
  }, {} as Record<AssetClass, { count: number; value: number; pnl: number; weight: number }>);

  // Filter positions by selected asset class
  const filteredPositions = selectedAssetClass === 'all' 
    ? positions 
    : positions.filter(p => p.assetClass === selectedAssetClass);

  // Generate heatmap data
  const heatmapData: HeatmapData[] = Object.entries(assetClassBreakdown).map(([assetClass, data]) => ({
    assetClass: assetClass as AssetClass,
    value: data.value,
    weight: data.weight,
    risk: data.pnl / data.value > 0.1 ? 'high' : data.pnl / data.value > 0.05 ? 'medium' : 'low',
    color: getAssetClassColor(assetClass as AssetClass)
  }));

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

  const getAssetClassColor = (assetClass: AssetClass) => {
    const colors = {
      'equities': '#00d4aa',
      'fx': '#3742fa',
      'commodities': '#ffb800',
      'crypto': '#a55eea',
      'fixed-income': '#00ff88'
    };
    return colors[assetClass];
  };

  const getAssetClassIcon = (assetClass: AssetClass) => {
    const icons = {
      'equities': BarChart3,
      'fx': Globe,
      'commodities': Zap,
      'crypto': Shield,
      'fixed-income': DollarSign
    };
    return icons[assetClass];
  };

  return (
    <div className={`institutional-theme ${className}`}>
      {/* Asset Class Overview */}
      <div className="institutional-grid institutional-grid-5 gap-4 mb-6">
        {Object.entries(assetClassBreakdown).map(([assetClass, data]) => {
          const Icon = getAssetClassIcon(assetClass as AssetClass);
          const isSelected = selectedAssetClass === assetClass;
          const pnlPercent = data.value > 0 ? (data.pnl / data.value) * 100 : 0;
          
          return (
            <Card 
              key={assetClass}
              className={`institutional-card cursor-pointer transition-all ${
                isSelected ? 'ring-2 ring-blue-500' : 'hover:bg-gray-800'
              }`}
              onClick={() => setSelectedAssetClass(assetClass as AssetClass)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" style={{ color: getAssetClassColor(assetClass as AssetClass) }} />
                    <span className="text-sm font-medium capitalize">{assetClass.replace('-', ' ')}</span>
                  </div>
                  <Badge className="asset-class" style={{ 
                    backgroundColor: `${getAssetClassColor(assetClass as AssetClass)}20`,
                    color: getAssetClassColor(assetClass as AssetClass),
                    borderColor: `${getAssetClassColor(assetClass as AssetClass)}40`
                  }}>
                    {data.count}
                  </Badge>
                </div>
                
                <div className="space-y-1">
                  <div className="text-lg font-bold text-white">
                    {formatCurrency(data.value)}
                  </div>
                  <div className="text-xs text-gray-400">
                    {formatPercent(data.weight)}
                  </div>
                  <div className={`text-sm font-medium ${
                    data.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {data.pnl >= 0 ? '+' : ''}{formatCurrency(data.pnl)}
                    <span className="ml-1 text-xs">
                      ({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* View Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('table')}
            className="institutional-btn"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Table View
          </Button>
          <Button
            variant={viewMode === 'heatmap' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('heatmap')}
            className="institutional-btn"
          >
            <PieChart className="h-4 w-4 mr-2" />
            Heatmap
          </Button>
        </div>
        
        <div className="text-sm text-gray-400">
          {filteredPositions.length} positions • {formatCurrency(
            filteredPositions.reduce((sum, p) => sum + p.marketValue, 0)
          )}
        </div>
      </div>

      {/* Table View */}
      {viewMode === 'table' && (
        <Card className="institutional-card">
          <CardContent className="p-0">
            <div className="institutional-table">
              <table className="w-full">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Asset Class</th>
                    <th>Quantity</th>
                    <th>Avg Price</th>
                    <th>Current Price</th>
                    <th>Market Value</th>
                    <th>P&L</th>
                    <th>Weight</th>
                    <th>Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPositions.map((position) => {
                    const Icon = getAssetClassIcon(position.assetClass);
                    const riskLevel = position.riskMetrics.var95 / position.marketValue > 0.05 ? 'high' : 
                                    position.riskMetrics.var95 / position.marketValue > 0.02 ? 'medium' : 'low';
                    
                    return (
                      <tr key={position.id} className="hover:bg-gray-800">
                        <td className="font-mono font-medium">{position.symbol}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" style={{ color: getAssetClassColor(position.assetClass) }} />
                            <Badge className="asset-class" style={{ 
                              backgroundColor: `${getAssetClassColor(position.assetClass)}20`,
                              color: getAssetClassColor(position.assetClass),
                              borderColor: `${getAssetClassColor(position.assetClass)}40`
                            }}>
                              {position.assetClass.replace('-', ' ')}
                            </Badge>
                          </div>
                        </td>
                        <td className="font-mono">{position.quantity.toLocaleString()}</td>
                        <td className="font-mono">{formatCurrency(position.averagePrice)}</td>
                        <td className="font-mono">{formatCurrency(position.currentPrice)}</td>
                        <td className="font-mono font-medium">{formatCurrency(position.marketValue)}</td>
                        <td className={`font-mono font-medium ${
                          position.unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {position.unrealizedPnL >= 0 ? '+' : ''}{formatCurrency(position.unrealizedPnL)}
                          <div className="text-xs text-gray-400">
                            ({position.unrealizedPnLPercent >= 0 ? '+' : ''}{position.unrealizedPnLPercent.toFixed(2)}%)
                          </div>
                        </td>
                        <td className="font-mono">{formatPercent(position.weight)}</td>
                        <td>
                          <Badge className={`risk-indicator ${riskLevel}`}>
                            {riskLevel.toUpperCase()}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Heatmap View */}
      {viewMode === 'heatmap' && (
        <Card className="institutional-card">
          <CardHeader className="institutional-card-header">
            <CardTitle className="institutional-card-title">Portfolio Heatmap</CardTitle>
            <p className="institutional-card-subtitle">Visual risk exposure by asset class</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {heatmapData.map((item) => {
                const Icon = getAssetClassIcon(item.assetClass);
                return (
                  <div
                    key={item.assetClass}
                    className="p-4 rounded-lg border-2 transition-all hover:scale-105"
                    style={{
                      backgroundColor: `${item.color}20`,
                      borderColor: item.color,
                      opacity: item.weight * 2 + 0.3
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="h-4 w-4" style={{ color: item.color }} />
                      <span className="text-sm font-medium capitalize">
                        {item.assetClass.replace('-', ' ')}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="text-lg font-bold" style={{ color: item.color }}>
                        {formatCurrency(item.value)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {formatPercent(item.weight)}
                      </div>
                      <Badge className={`risk-indicator ${item.risk}`}>
                        {item.risk.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
