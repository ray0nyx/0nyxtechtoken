import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  Target,
  Zap
} from 'lucide-react';

interface InstitutionalMetricsProps {
  totalPnL: number;
  totalTrades: number;
  winRate: number;
  largestWin: number;
  largestLoss: number;
  grossProfit: number;
  grossLoss: number;
  className?: string;
}

export const InstitutionalMetrics: React.FC<InstitutionalMetricsProps> = ({
  totalPnL,
  totalTrades,
  winRate,
  largestWin,
  largestLoss,
  grossProfit,
  grossLoss,
  className = ''
}) => {
  // Calculate institutional metrics
  const profitFactor = grossLoss !== 0 ? grossProfit / Math.abs(grossLoss) : 0;
  const avgWin = totalTrades > 0 ? grossProfit / (totalTrades * winRate / 100) : 0;
  const avgLoss = totalTrades > 0 ? Math.abs(grossLoss) / (totalTrades * (100 - winRate) / 100) : 0;
  const expectancy = (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss;

  // Risk assessment
  const getRiskLevel = (value: number, thresholds: { low: number; medium: number; high: number }) => {
    if (value <= thresholds.low) return 'low';
    if (value <= thresholds.medium) return 'medium';
    if (value <= thresholds.high) return 'high';
    return 'critical';
  };

  const winRateRisk = getRiskLevel(winRate, { low: 40, medium: 60, high: 80 });
  const profitFactorRisk = getRiskLevel(profitFactor, { low: 1.2, medium: 1.5, high: 2.0 });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Performance Metrics */}
        <Card className="rounded-xl border transition-all duration-500 hover:shadow-2xl hover:shadow-emerald-500/10 group overflow-hidden bg-white dark:!bg-[#0a0a0a] border-gray-200 dark:border-slate-700/50 hover:border-emerald-500/30 shadow-lg shadow-emerald-500/5 hover:shadow-emerald-500/20">
          <CardHeader className="group-hover:bg-emerald-500/10 transition-colors duration-300 px-6 pt-6">
            <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors duration-300">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
              </div>
              Performance
            </CardTitle>
            <p className="text-sm text-gray-600 dark:text-slate-400 mt-2">Key performance indicators</p>
          </CardHeader>
          <CardContent className="px-6 pb-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs text-gray-600 dark:text-slate-400 mb-1">Total P&L</div>
                <div className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(totalPnL)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-600 dark:text-slate-400">
                  {totalTrades} trades
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs text-gray-600 dark:text-slate-400 mb-1">Win Rate</div>
                <div className="text-2xl font-bold text-gray-400">
                  {formatPercent(winRate)}
                </div>
              </div>
              <div className="text-right">
                <Badge className={`px-2 py-1 rounded-full text-xs font-medium ${winRateRisk === 'low' ? 'bg-red-500/20 text-red-400' :
                    winRateRisk === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      winRateRisk === 'high' ? 'bg-green-500/20 text-green-400' :
                        'bg-red-500/20 text-red-400'
                  }`}>
                  {winRateRisk.toUpperCase()}
                </Badge>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-700/50">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Expectancy</span>
                <span className={`font-mono ${expectancy >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(expectancy)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Risk Analysis */}
        <Card className="rounded-xl border transition-all duration-500 hover:shadow-2xl hover:shadow-gray-500/10 group overflow-hidden bg-white dark:!bg-[#0a0a0a] border-gray-200 dark:border-slate-700/50 hover:border-gray-500/30 shadow-lg shadow-gray-500/5 hover:shadow-gray-500/20">
          <CardHeader className="group-hover:bg-gray-500/10 transition-colors duration-300 px-6 pt-6">
            <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gray-500/10 group-hover:bg-gray-500/20 transition-colors duration-300">
                <Shield className="h-5 w-5 text-gray-400" />
              </div>
              Risk Analysis
            </CardTitle>
            <p className="text-sm text-gray-600 dark:text-slate-400 mt-2">Risk-adjusted metrics</p>
          </CardHeader>
          <CardContent className="px-6 pb-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs text-gray-600 dark:text-slate-400 mb-1">Profit Factor</div>
                <div className="text-2xl font-bold text-gray-300">
                  {profitFactor.toFixed(2)}
                </div>
              </div>
              <div className="text-right">
                <Badge className={`px-2 py-1 rounded-full text-xs font-medium ${profitFactorRisk === 'low' ? 'bg-red-500/20 text-red-400' :
                    profitFactorRisk === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      profitFactorRisk === 'high' ? 'bg-green-500/20 text-green-400' :
                        'bg-red-500/20 text-red-400'
                  }`}>
                  {profitFactorRisk.toUpperCase()}
                </Badge>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs text-gray-600 dark:text-slate-400 mb-1">Avg Win</div>
                <div className="text-2xl font-bold text-gray-400">
                  {formatCurrency(avgWin)}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs text-gray-600 dark:text-slate-400 mb-1">Avg Loss</div>
                <div className="text-2xl font-bold text-gray-300">
                  {formatCurrency(avgLoss)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trade Analysis */}
        <Card className="rounded-xl border transition-all duration-500 hover:shadow-2xl hover:shadow-gray-200/10 group overflow-hidden bg-white dark:!bg-[#0a0a0a] border-gray-200 dark:border-slate-700/50 hover:border-gray-200/30 shadow-lg shadow-gray-200/5 hover:shadow-gray-200/20">
          <CardHeader className="group-hover:bg-gray-200/10 transition-colors duration-300 px-6 pt-6">
            <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gray-200/10 group-hover:bg-gray-200/20 transition-colors duration-300">
                <Activity className="h-5 w-5 text-gray-300" />
              </div>
              Trade Analysis
            </CardTitle>
            <p className="text-sm text-gray-600 dark:text-slate-400 mt-2">Trade performance breakdown</p>
          </CardHeader>
          <CardContent className="px-6 pb-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs text-gray-600 dark:text-slate-400 mb-1">Largest Win</div>
                <div className="text-2xl font-bold text-gray-400">
                  {formatCurrency(largestWin)}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs text-gray-600 dark:text-slate-400 mb-1">Largest Loss</div>
                <div className="text-2xl font-bold text-gray-300">
                  {formatCurrency(largestLoss)}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-700/50">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Win/Loss Ratio</span>
                <span className="text-slate-300 font-mono">
                  {largestLoss !== 0 ? (largestWin / Math.abs(largestLoss)).toFixed(2) : 'N/A'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Risk Alerts */}
        <Card className="rounded-xl border transition-all duration-500 hover:shadow-2xl hover:shadow-orange-500/10 group overflow-hidden bg-white dark:!bg-[#0a0a0a] border-gray-200 dark:border-slate-700/50 hover:border-orange-500/30 shadow-lg shadow-orange-500/5 hover:shadow-orange-500/20">
          <CardHeader className="group-hover:bg-orange-500/10 transition-colors duration-300 px-6 pt-6">
            <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <div className="p-2 rounded-lg bg-orange-500/10 group-hover:bg-orange-500/20 transition-colors duration-300">
                <AlertTriangle className="h-5 w-5 text-orange-400" />
              </div>
              Risk Alerts
            </CardTitle>
            <p className="text-sm text-gray-600 dark:text-slate-400 mt-2">Active monitoring</p>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="space-y-3">
              {winRateRisk === 'low' && (
                <div className="flex items-center gap-3 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <div>
                    <div className="text-sm font-medium text-red-400">Low Win Rate</div>
                    <div className="text-xs text-red-300">
                      Win rate below 40% threshold
                    </div>
                  </div>
                </div>
              )}

              {profitFactorRisk === 'low' && (
                <div className="flex items-center gap-3 p-3 bg-orange-900/20 border border-orange-500/30 rounded-lg">
                  <Target className="h-4 w-4 text-orange-500" />
                  <div>
                    <div className="text-sm font-medium text-orange-400">Low Profit Factor</div>
                    <div className="text-xs text-orange-300">
                      Profit factor below 1.2 threshold
                    </div>
                  </div>
                </div>
              )}

              {winRateRisk === 'high' && profitFactorRisk === 'high' && (
                <div className="flex items-center gap-3 p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
                  <Zap className="h-4 w-4 text-green-500" />
                  <div>
                    <div className="text-sm font-medium text-green-400">Optimal Performance</div>
                    <div className="text-xs text-green-300">
                      All metrics within target ranges
                    </div>
                  </div>
                </div>
              )}

              {winRateRisk !== 'low' && profitFactorRisk !== 'low' && winRateRisk !== 'high' && (
                <div className="flex items-center gap-3 p-3 bg-gray-900/20 border border-gray-500/30 rounded-lg">
                  <Activity className="h-4 w-4 text-gray-500" />
                  <div>
                    <div className="text-sm font-medium text-gray-400">Monitoring Active</div>
                    <div className="text-xs text-gray-300">
                      Performance within acceptable ranges
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
