import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useTheme } from '@/components/ThemeProvider';

interface RiskAnalysisRadarChartProps {
  trades?: any[];
  showCard?: boolean;
}

interface RiskMetrics {
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
}

const RiskAnalysisRadarChart: React.FC<RiskAnalysisRadarChartProps> = ({ trades = [], showCard = true }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  const [metrics, setMetrics] = useState<RiskMetrics>({
    sharpeRatio: 0,
    sortinoRatio: 0,
    calmarRatio: 0,
    winRate: 0,
    profitFactor: 0,
    maxDrawdown: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [previousMetrics, setPreviousMetrics] = useState<RiskMetrics | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (trades.length > 0) {
      calculateRiskMetrics(trades);
    } else {
      fetchTradesAndCalculate();
    }
  }, [trades]);

  const fetchTradesAndCalculate = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tradesData, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .order('entry_date', { ascending: true });

      if (error) throw error;
      calculateRiskMetrics(tradesData || []);
    } catch (err) {
      console.error('Error fetching trades:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateRiskMetrics = (tradesData: any[]) => {
    if (tradesData.length === 0) {
      setMetrics({
        sharpeRatio: 0,
        sortinoRatio: 0,
        calmarRatio: 0,
        winRate: 0,
        profitFactor: 0,
        maxDrawdown: 0
      });
      setIsLoading(false);
      return;
    }

    // Store previous metrics for trend calculation
    setPreviousMetrics(metrics);

    // Calculate basic metrics
    const pnlValues = tradesData.map(trade => trade.pnl || 0);
    const winningTrades = pnlValues.filter(pnl => pnl > 0);
    const losingTrades = pnlValues.filter(pnl => pnl < 0);
    
    const totalPnL = pnlValues.reduce((sum, pnl) => sum + pnl, 0);
    const winRate = tradesData.length > 0 ? (winningTrades.length / tradesData.length) * 100 : 0;
    const profitFactor = losingTrades.length > 0 ? 
      Math.abs(winningTrades.reduce((sum, pnl) => sum + pnl, 0) / losingTrades.reduce((sum, pnl) => sum + pnl, 0)) : 
      winningTrades.length > 0 ? 999 : 0;

    // Calculate daily returns for Sharpe and Sortino ratios
    const dailyReturns = calculateDailyReturns(tradesData);
    const meanReturn = dailyReturns.reduce((sum, ret) => sum + ret, 0) / dailyReturns.length;
    const returnStdDev = Math.sqrt(dailyReturns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / dailyReturns.length);
    
    // Sharpe Ratio (assuming risk-free rate of 0 for simplicity)
    const sharpeRatio = returnStdDev > 0 ? meanReturn / returnStdDev : 0;
    
    // Sortino Ratio (using downside deviation)
    const negativeReturns = dailyReturns.filter(ret => ret < 0);
    const downsideDeviation = negativeReturns.length > 0 ? 
      Math.sqrt(negativeReturns.reduce((sum, ret) => sum + Math.pow(ret, 2), 0) / negativeReturns.length) : 0;
    const sortinoRatio = downsideDeviation > 0 ? meanReturn / downsideDeviation : 0;
    
    // Calmar Ratio (annual return / max drawdown)
    const maxDrawdown = calculateMaxDrawdown(tradesData);
    const calmarRatio = maxDrawdown > 0 ? Math.abs(totalPnL) / maxDrawdown : 0;

    setMetrics({
      sharpeRatio: Math.max(0, Math.min(sharpeRatio, 5)), // Cap at 5 for visualization
      sortinoRatio: Math.max(0, Math.min(sortinoRatio, 5)), // Cap at 5 for visualization
      calmarRatio: Math.max(0, Math.min(calmarRatio, 5)), // Cap at 5 for visualization
      winRate: Math.min(winRate, 100), // Cap at 100%
      profitFactor: Math.min(profitFactor, 10), // Cap at 10 for visualization
      maxDrawdown: Math.min(Math.abs(maxDrawdown), 100) // Cap at 100% for visualization
    });
    setIsLoading(false);
  };

  const calculateDailyReturns = (tradesData: any[]) => {
    // Group trades by date and calculate daily P&L
    const dailyPnL: { [key: string]: number } = {};
    tradesData.forEach(trade => {
      const date = trade.entry_date || trade.date;
      if (date) {
        dailyPnL[date] = (dailyPnL[date] || 0) + (trade.pnl || 0);
      }
    });

    // Convert to daily returns (simplified - using P&L as return)
    return Object.values(dailyPnL);
  };

  const calculateMaxDrawdown = (tradesData: any[]) => {
    let peak = 0;
    let maxDrawdown = 0;
    let runningPnL = 0;

    tradesData.forEach(trade => {
      runningPnL += trade.pnl || 0;
      if (runningPnL > peak) {
        peak = runningPnL;
      }
      const drawdown = peak - runningPnL;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    });

    return maxDrawdown;
  };

  const getPercentageChange = (current: number, previous: number | null) => {
    if (!previous || previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  const getOverallScore = () => {
    // Calculate a weighted average of all metrics (normalized)
    const weights = {
      sharpeRatio: 0.2,
      sortinoRatio: 0.2,
      calmarRatio: 0.2,
      winRate: 0.15,
      profitFactor: 0.15,
      maxDrawdown: 0.1 // Lower weight for max drawdown (inverse relationship)
    };

    const normalizedMetrics = {
      sharpeRatio: metrics.sharpeRatio / 5, // Normalize to 0-1
      sortinoRatio: metrics.sortinoRatio / 5,
      calmarRatio: metrics.calmarRatio / 5,
      winRate: metrics.winRate / 100,
      profitFactor: metrics.profitFactor / 10,
      maxDrawdown: 1 - (metrics.maxDrawdown / 100) // Invert for scoring
    };

    const overallScore = 
      normalizedMetrics.sharpeRatio * weights.sharpeRatio +
      normalizedMetrics.sortinoRatio * weights.sortinoRatio +
      normalizedMetrics.calmarRatio * weights.calmarRatio +
      normalizedMetrics.winRate * weights.winRate +
      normalizedMetrics.profitFactor * weights.profitFactor +
      normalizedMetrics.maxDrawdown * weights.maxDrawdown;

    return Math.round(overallScore * 5 * 100) / 100; // Scale to 0-5 range
  };

  const overallScore = getOverallScore();
  const previousOverallScore = previousMetrics ? 
    (() => {
      const weights = { sharpeRatio: 0.2, sortinoRatio: 0.2, calmarRatio: 0.2, winRate: 0.15, profitFactor: 0.15, maxDrawdown: 0.1 };
      const normalized = {
        sharpeRatio: previousMetrics.sharpeRatio / 5,
        sortinoRatio: previousMetrics.sortinoRatio / 5,
        calmarRatio: previousMetrics.calmarRatio / 5,
        winRate: previousMetrics.winRate / 100,
        profitFactor: previousMetrics.profitFactor / 10,
        maxDrawdown: 1 - (previousMetrics.maxDrawdown / 100)
      };
      return Math.round((normalized.sharpeRatio * weights.sharpeRatio + normalized.sortinoRatio * weights.sortinoRatio + normalized.calmarRatio * weights.calmarRatio + normalized.winRate * weights.winRate + normalized.profitFactor * weights.profitFactor + normalized.maxDrawdown * weights.maxDrawdown) * 5 * 100) / 100;
    })() : null;

  const percentageChange = getPercentageChange(overallScore, previousOverallScore);

  if (isLoading) {
    const loadingContent = (
      <div className="flex items-center justify-center h-[300px]">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-700 border-t-emerald-500"></div>
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
        </div>
      </div>
    );

    if (!showCard) {
      return loadingContent;
    }

    return (
      <Card className="shadow-lg hover:shadow-xl transition-all duration-300 hover:shadow-emerald-500/10 overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-900 dark:to-slate-800 from-slate-50 to-slate-100">
        <CardHeader className="bg-emerald-500/10 pb-3">
          <CardTitle className="text-lg font-medium text-white flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/20">
              <svg className="h-4 w-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            Risk Analysis Radar
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {loadingContent}
        </CardContent>
      </Card>
    );
  }

  // Theme-aware colors
  const textColor = isDark ? '#e2e8f0' : '#1e293b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  const axisColor = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)';
  const labelColor = isDark ? '#94a3b8' : '#64748b';

  const chartContent = (
    <div className="h-[300px] flex items-center justify-center">
          <div className="relative w-64 h-64">
            {/* Radar Chart SVG */}
            <svg width="256" height="256" viewBox="0 0 256 256" className="absolute inset-0">
              {/* Background circles */}
              {[1, 2, 3, 4, 5].map((level) => (
                <circle
                  key={level}
                  cx="128"
                  cy="128"
                  r={level * 20}
                  fill="none"
                  stroke={gridColor}
                  strokeWidth="1"
                />
              ))}
              
              {/* Axis lines */}
              {[
                { angle: 0, label: 'Sharpe Ratio' },
                { angle: 60, label: 'Sortino Ratio' },
                { angle: 120, label: 'Calmar Ratio' },
                { angle: 180, label: 'Win Rate' },
                { angle: 240, label: 'Profit Factor' },
                { angle: 300, label: 'Max Drawdown' }
              ].map((axis, index) => {
                const x1 = 128 + Math.cos((axis.angle - 90) * Math.PI / 180) * 100;
                const y1 = 128 + Math.sin((axis.angle - 90) * Math.PI / 180) * 100;
                return (
                  <g key={index}>
                    <line
                      x1="128"
                      y1="128"
                      x2={x1}
                      y2={y1}
                      stroke={axisColor}
                      strokeWidth="1"
                    />
                    <text
                      x={x1 + Math.cos((axis.angle - 90) * Math.PI / 180) * 15}
                      y={y1 + Math.sin((axis.angle - 90) * Math.PI / 180) * 15}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-xs"
                      fill={labelColor}
                    >
                      {axis.label}
                    </text>
                  </g>
                );
              })}
              
              {/* Data polygon */}
              <polygon
                points={[
                  { angle: 0, value: metrics.sharpeRatio },
                  { angle: 60, value: metrics.sortinoRatio },
                  { angle: 120, value: metrics.calmarRatio },
                  { angle: 180, value: metrics.winRate / 20 }, // Scale win rate to 0-5 range
                  { angle: 240, value: metrics.profitFactor },
                  { angle: 300, value: 5 - (metrics.maxDrawdown / 20) } // Invert max drawdown
                ].map(point => {
                  const x = 128 + Math.cos((point.angle - 90) * Math.PI / 180) * (point.value * 20);
                  const y = 128 + Math.sin((point.angle - 90) * Math.PI / 180) * (point.value * 20);
                  return `${x},${y}`;
                }).join(' ')}
                fill="url(#radarGradient)"
                stroke="#ec4899"
                strokeWidth="3"
                fillOpacity="0.6"
              />
              
              {/* Data points */}
              {[
                { angle: 0, value: metrics.sharpeRatio },
                { angle: 60, value: metrics.sortinoRatio },
                { angle: 120, value: metrics.calmarRatio },
                { angle: 180, value: metrics.winRate / 20 },
                { angle: 240, value: metrics.profitFactor },
                { angle: 300, value: 5 - (metrics.maxDrawdown / 20) }
              ].map((point, index) => {
                const x = 128 + Math.cos((point.angle - 90) * Math.PI / 180) * (point.value * 20);
                const y = 128 + Math.sin((point.angle - 90) * Math.PI / 180) * (point.value * 20);
                return (
                  <circle
                    key={index}
                    cx={x}
                    cy={y}
                    r="5"
                    fill="#ec4899"
                    stroke={isDark ? "#fff" : "#000"}
                    strokeWidth="2"
                  />
                );
              })}
              
              {/* Gradient definition */}
              <defs>
                <linearGradient id="radarGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#ec4899" stopOpacity="0.8" />
                  <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#9333ea" stopOpacity="0.4" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
    </div>
  );

  if (!showCard) {
    return chartContent;
  }

  return (
    <Card className="shadow-lg hover:shadow-xl transition-all duration-300 hover:shadow-emerald-500/10 overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-900 dark:to-slate-800 from-slate-50 to-slate-100">
      <CardHeader className="bg-emerald-500/10 dark:bg-emerald-500/20 pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-medium text-white dark:text-slate-900 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/20 dark:bg-emerald-500/30">
              <svg className="h-4 w-4 text-emerald-400 dark:text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            Risk Analysis Radar
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-white dark:text-slate-900">{overallScore.toFixed(2)}</span>
            {percentageChange !== 0 && (
              <div className={`flex items-center gap-1 text-sm ${percentageChange > 0 ? 'text-emerald-400 dark:text-emerald-600' : 'text-red-400 dark:text-red-600'}`}>
                {percentageChange > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                <span>{Math.abs(percentageChange).toFixed(1)}%</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {chartContent}
      </CardContent>
    </Card>
  );
};

export default RiskAnalysisRadarChart;
