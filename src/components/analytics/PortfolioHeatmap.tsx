import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  PieChart,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Zap
} from 'lucide-react';

interface PortfolioHeatmapProps {
  trades: any[];
  className?: string;
}

interface HeatmapData {
  symbol: string;
  pnl: number;
  pnlPercent: number;
  trades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  risk: 'low' | 'medium' | 'high' | 'critical';
  color: string;
}

export const PortfolioHeatmap: React.FC<PortfolioHeatmapProps> = ({
  trades,
  className = ''
}) => {
  const [heatmapData, setHeatmapData] = useState<HeatmapData[]>([]);
  const [viewMode, setViewMode] = useState<'heatmap' | 'table'>('heatmap');
  const [sortBy, setSortBy] = useState<'pnl' | 'trades' | 'winRate'>('pnl');

  useEffect(() => {
    if (!trades || trades.length === 0) return;

    // Group trades by symbol
    const symbolGroups = trades.reduce((acc, trade) => {
      const symbol = trade.symbol || 'Unknown';
      if (!acc[symbol]) {
        acc[symbol] = [];
      }
      acc[symbol].push(trade);
      return acc;
    }, {} as Record<string, any[]>);

    // Calculate metrics for each symbol
    const data: HeatmapData[] = Object.entries(symbolGroups).map(([symbol, symbolTrades]) => {
      const totalPnL = symbolTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
      const totalVolume = symbolTrades.reduce((sum, trade) => sum + Math.abs(trade.quantity || 0), 0);
      const pnlPercent = totalVolume > 0 ? (totalPnL / totalVolume) * 100 : 0;
      const winningTrades = symbolTrades.filter(trade => (trade.pnl || 0) > 0);
      const losingTrades = symbolTrades.filter(trade => (trade.pnl || 0) < 0);
      const winRate = symbolTrades.length > 0 ? (winningTrades.length / symbolTrades.length) * 100 : 0;

      const avgWin = winningTrades.length > 0
        ? winningTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0) / winningTrades.length
        : 0;
      const avgLoss = losingTrades.length > 0
        ? losingTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0) / losingTrades.length
        : 0;

      // Determine risk level
      let risk: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (winRate < 40 || pnlPercent < -5) risk = 'critical';
      else if (winRate < 50 || pnlPercent < -2) risk = 'high';
      else if (winRate < 60 || pnlPercent < 0) risk = 'medium';

      // Determine color based on P&L
      let color = '#3742fa'; // Default blue
      if (totalPnL > 0) {
        if (totalPnL > 1000) color = '#00ff88'; // Green
        else if (totalPnL > 500) color = '#00d4aa'; // Teal
        else color = '#ffb800'; // Yellow
      } else {
        if (totalPnL < -1000) color = '#ff4757'; // Red
        else if (totalPnL < -500) color = '#ff6b7a'; // Light red
        else color = '#ffa502'; // Orange
      }

      return {
        symbol,
        pnl: totalPnL,
        pnlPercent,
        trades: symbolTrades.length,
        winRate,
        avgWin,
        avgLoss,
        risk,
        color
      };
    });

    // Sort data
    const sortedData = data.sort((a, b) => {
      switch (sortBy) {
        case 'pnl':
          return b.pnl - a.pnl;
        case 'trades':
          return b.trades - a.trades;
        case 'winRate':
          return b.winRate - a.winRate;
        default:
          return 0;
      }
    });

    setHeatmapData(sortedData);
  }, [trades, sortBy]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
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

  return (
    <div className={`institutional-theme ${className}`}>
      <Card className="bg-gray-100 dark:!bg-[#0a0a0a] border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
        <CardHeader className="border-b border-gray-200 dark:border-gray-600 pb-4 mb-5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Target className="h-5 w-5 text-gray-600 dark:text-gray-500" />
                Portfolio Heatmap
              </CardTitle>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Performance by symbol</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 text-sm bg-white dark:!bg-[#0a0a0a] border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                <option value="pnl">Sort by P&L</option>
                <option value="trades">Sort by Trades</option>
                <option value="winRate">Sort by Win Rate</option>
              </select>
              <Button
                variant={viewMode === 'heatmap' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('heatmap')}
                className={viewMode === 'heatmap'
                  ? "!bg-none !bg-gray-500 hover:!bg-gray-600 text-white border-gray-500 shadow-none"
                  : "!bg-none !bg-[#0a0a0a] hover:!bg-[#1a1a1a] text-gray-300 border-gray-600 shadow-none"
                }
              >
                <PieChart className="h-4 w-4 mr-1" />
                Heatmap
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('table')}
                className={viewMode === 'table'
                  ? "!bg-none !bg-gray-500 hover:!bg-gray-600 text-white border-gray-500 shadow-none"
                  : "!bg-none !bg-[#0a0a0a] hover:!bg-[#1a1a1a] text-gray-300 border-gray-600 shadow-none"
                }
              >
                <BarChart3 className="h-4 w-4 mr-1" />
                Table
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === 'heatmap' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {heatmapData.map((item) => (
                <div
                  key={item.symbol}
                  className="p-4 rounded-lg border-2 transition-all hover:scale-105 cursor-pointer"
                  style={{
                    backgroundColor: `${item.color}20`,
                    borderColor: item.color,
                    opacity: Math.min(1, Math.max(0.3, Math.abs(item.pnl) / 1000 + 0.3))
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono font-bold text-sm">{item.symbol}</span>
                    <Badge className={`risk-indicator ${item.risk}`}>
                      {item.risk.toUpperCase()}
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <div className="text-lg font-bold" style={{ color: item.color }}>
                      {formatCurrency(item.pnl)}
                    </div>
                    <div className="text-xs text-gray-400">
                      {item.trades} trades • {formatPercent(item.winRate)} win rate
                    </div>
                    <div className="text-xs text-gray-400">
                      Avg: {formatCurrency(item.avgWin)} / {formatCurrency(item.avgLoss)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="institutional-table">
              <table className="w-full">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>P&L</th>
                    <th>Trades</th>
                    <th>Win Rate</th>
                    <th>Avg Win</th>
                    <th>Avg Loss</th>
                    <th>Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {heatmapData.map((item) => (
                    <tr key={item.symbol} className="hover:bg-gray-800">
                      <td className="font-mono font-medium">{item.symbol}</td>
                      <td className={`font-mono font-medium ${item.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(item.pnl)}
                      </td>
                      <td className="font-mono">{item.trades}</td>
                      <td className="font-mono">{formatPercent(item.winRate)}</td>
                      <td className="font-mono text-green-400">{formatCurrency(item.avgWin)}</td>
                      <td className="font-mono text-red-400">{formatCurrency(item.avgLoss)}</td>
                      <td>
                        <Badge className={`risk-indicator ${item.risk}`}>
                          {item.risk.toUpperCase()}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
