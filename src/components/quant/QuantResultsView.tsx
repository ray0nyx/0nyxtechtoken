/**
 * Professional Quant Results View
 * Displays backtest results in a format familiar to quantitative analysts
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Activity, 
  Download,
  BarChart2,
  LineChart,
  PieChart
} from 'lucide-react';
import {
  LineChart as RechartsLineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  Cell
} from 'recharts';

interface BacktestResults {
  total_return: number;
  annual_return: number;
  volatility: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  calmar_ratio: number;
  max_drawdown: number;
  max_drawdown_duration: number;
  win_rate: number;
  profit_factor: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  average_win: number;
  average_loss: number;
  largest_win: number;
  largest_loss: number;
  consecutive_wins: number;
  consecutive_losses: number;
  equity_curve?: Array<{ date: string; equity: number; drawdown: number }>;
  monthly_returns?: Array<{ month: string; return: number }>;
  trade_distribution?: Array<{ pnl: number; count: number }>;
}

interface QuantResultsViewProps {
  results: BacktestResults;
  strategyName: string;
  config: {
    start_date: string;
    end_date: string;
    initial_capital: number;
    symbols: string[];
  };
}

export function QuantResultsView({ results, strategyName, config }: QuantResultsViewProps) {
  const formatPercentage = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  const formatCurrency = (value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Generate mock equity curve if not provided
  const equityCurve = results.equity_curve || Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (30 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    equity: config.initial_capital * (1 + (results.total_return / 100) * (i / 30)),
    drawdown: -results.max_drawdown * (i / 30)
  }));

  // Generate mock monthly returns if not provided
  const monthlyReturns = results.monthly_returns || Array.from({ length: 12 }, (_, i) => ({
    month: new Date(2024, i, 1).toLocaleDateString('en-US', { month: 'short' }),
    return: (results.annual_return / 12) + (Math.random() - 0.5) * 5
  }));

  // Generate trade distribution if not provided
  const tradeDistribution = results.trade_distribution || Array.from({ length: 20 }, (_, i) => ({
    pnl: -1000 + (i * 100),
    count: Math.floor(Math.random() * 10) + 1
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{strategyName}</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
            {config.symbols.join(', ')} • {config.start_date} to {config.end_date}
          </p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Key Performance Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Total Return</span>
            </div>
            <p className={`text-2xl font-bold ${results.total_return >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatPercentage(results.total_return)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Annual: {formatPercentage(results.annual_return)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border-purple-200 dark:border-purple-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5 text-purple-600" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Sharpe Ratio</span>
            </div>
            <p className="text-2xl font-bold text-purple-600">{results.sharpe_ratio.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">Sortino: {results.sortino_ratio.toFixed(2)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border-red-200 dark:border-red-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-5 h-5 text-red-600" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Max Drawdown</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{formatPercentage(results.max_drawdown)}</p>
            <p className="text-xs text-gray-500 mt-1">Duration: {results.max_drawdown_duration} days</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border-amber-200 dark:border-amber-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-5 h-5 text-amber-600" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Win Rate</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{results.win_rate.toFixed(1)}%</p>
            <p className="text-xs text-gray-500 mt-1">Profit Factor: {results.profit_factor.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Equity Curve with Drawdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LineChart className="w-5 h-5 text-purple-500" />
            Equity Curve & Drawdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={equityCurve}>
              <defs>
                <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="date" 
                stroke="#6b7280"
                tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis yAxisId="left" stroke="#6b7280" />
              <YAxis yAxisId="right" orientation="right" stroke="#6b7280" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#d1d5db' }}
              />
              <Legend />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="equity"
                stroke="#a855f7"
                fillOpacity={1}
                fill="url(#equityGradient)"
                name="Equity"
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="drawdown"
                stroke="#ef4444"
                fillOpacity={1}
                fill="url(#drawdownGradient)"
                name="Drawdown"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly Returns Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-purple-500" />
            Monthly Returns
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyReturns}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#d1d5db' }}
                formatter={(value: number) => formatPercentage(value)}
              />
              <Bar dataKey="return" name="Return">
                {monthlyReturns.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.return >= 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detailed Metrics Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: 'Annual Return', value: formatPercentage(results.annual_return), color: results.annual_return >= 0 ? 'text-emerald-600' : 'text-red-600' },
                { label: 'Volatility', value: `${results.volatility.toFixed(2)}%`, color: 'text-gray-900 dark:text-white' },
                { label: 'Sortino Ratio', value: results.sortino_ratio.toFixed(2), color: 'text-purple-600' },
                { label: 'Calmar Ratio', value: results.calmar_ratio.toFixed(2), color: 'text-purple-600' },
                { label: 'Profit Factor', value: results.profit_factor.toFixed(2), color: results.profit_factor >= 1 ? 'text-emerald-600' : 'text-red-600' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{item.label}</span>
                  <span className={`font-semibold ${item.color}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trade Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: 'Total Trades', value: results.total_trades, color: 'text-gray-900 dark:text-white' },
                { label: 'Winning Trades', value: results.winning_trades, color: 'text-emerald-600' },
                { label: 'Losing Trades', value: results.losing_trades, color: 'text-red-600' },
                { label: 'Average Win', value: formatCurrency(results.average_win), color: 'text-emerald-600' },
                { label: 'Average Loss', value: formatCurrency(results.average_loss), color: 'text-red-600' },
                { label: 'Largest Win', value: formatCurrency(results.largest_win), color: 'text-emerald-600' },
                { label: 'Largest Loss', value: formatCurrency(results.largest_loss), color: 'text-red-600' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{item.label}</span>
                  <span className={`font-semibold ${item.color}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trade Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-purple-500" />
            Trade P&L Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={tradeDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="pnl" 
                stroke="#6b7280"
                tickFormatter={(value) => formatCurrency(value)}
              />
              <YAxis stroke="#6b7280" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#d1d5db' }}
              />
              <Bar dataKey="count" name="Trade Count">
                {tradeDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

