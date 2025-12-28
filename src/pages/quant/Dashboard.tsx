import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, FileCode, BarChart3, TrendingUp } from 'lucide-react';
import DashboardMetrics from '@/components/quant/DashboardMetrics';
import { quantBacktesterService } from '@/lib/services/quantBacktesterService';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
} from 'recharts';

// Types from existing QuantTesting
interface BacktestResult {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startTime?: string;
  endTime?: string;
  metrics?: {
    sharpeRatio: number;
    totalReturn: number;
    maxDrawdown: number;
  };
}

export default function QuantDashboard() {
  const navigate = useNavigate();
  const [portfolioValue, setPortfolioValue] = useState(100000);
  const [portfolioChange, setPortfolioChange] = useState(12.5);
  const [activeAlgorithms, setActiveAlgorithms] = useState(3);
  const [recentBacktests, setRecentBacktests] = useState(8);
  const [sharpeRatio, setSharpeRatio] = useState(1.85);
  const [totalReturn, setTotalReturn] = useState(24.3);
  const [maxDrawdown, setMaxDrawdown] = useState(-8.2);
  const [equityCurve, setEquityCurve] = useState<{ date: string; value: number }[]>([]);
  const [recentBacktestsList, setRecentBacktestsList] = useState<BacktestResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      setIsLoading(true);
      try {
        // Fetch metrics from API
        const metrics = await quantBacktesterService.getDashboardMetrics();
        setPortfolioValue(metrics.portfolioValue);
        setPortfolioChange(metrics.portfolioChange);
        setActiveAlgorithms(metrics.activeAlgorithms);
        setRecentBacktests(metrics.recentBacktests);
        setSharpeRatio(metrics.sharpeRatio);
        setTotalReturn(metrics.totalReturn);
        setMaxDrawdown(metrics.maxDrawdown);

        // Fetch backtests for equity curve and recent list
        const backtests = await quantBacktesterService.getBacktests();
        setRecentBacktestsList(backtests.slice(0, 4)); // Show top 4 recent
        
        if (backtests.length > 0) {
          // Use the most recent backtest's equity curve
          const latestBacktest = backtests[0];
          if (latestBacktest.equityCurve && latestBacktest.equityCurve.length > 0) {
            const curveData = latestBacktest.equityCurve.map((point) => ({
              date: new Date(point.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              value: point.equity,
            }));
            setEquityCurve(curveData);
          } else {
            // Generate sample data if no equity curve available
            generateSampleEquityCurve();
          }
        } else {
          generateSampleEquityCurve();
        }
      } catch (error) {
        console.error('Error loading dashboard data:', error);
        generateSampleEquityCurve();
      } finally {
        setIsLoading(false);
      }
    };

    const generateSampleEquityCurve = () => {
      const data = [];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      let value = 100000;
      
      for (let i = 0; i < 30; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        value += (Math.random() - 0.4) * 2000;
        data.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          value: Math.max(90000, value),
        });
      }
      setEquityCurve(data);
    };

    loadDashboardData();
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-[#9ca3af] mt-1">Overview of your quant trading performance</p>
        </div>
        <Button
          onClick={() => navigate('/app/quant/algorithms')}
          className="bg-[#0ea5e9] hover:bg-[#0284c7] text-white"
        >
          <Play className="w-4 h-4 mr-2" />
          New Backtest
        </Button>
      </div>

      {/* Metrics Grid */}
      <DashboardMetrics
        portfolioValue={portfolioValue}
        portfolioChange={portfolioChange}
        activeAlgorithms={activeAlgorithms}
        recentBacktests={recentBacktests}
        sharpeRatio={sharpeRatio}
        totalReturn={totalReturn}
        maxDrawdown={maxDrawdown}
      />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Portfolio Chart - Takes 2 columns */}
        <Card className="lg:col-span-2 bg-[#1a1f2e] border-[#1f2937]">
          <CardHeader>
            <CardTitle className="text-white">Portfolio Equity Curve</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {isLoading ? (
                <div className="h-full flex items-center justify-center text-[#6b7280]">
                  <p>Loading chart data...</p>
                </div>
              ) : equityCurve.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={equityCurve}>
                    <defs>
                      <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#6b7280', fontSize: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#6b7280', fontSize: 12 }}
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1a1f2e',
                        border: '1px solid #1f2937',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: '#9ca3af' }}
                      formatter={(value: number) => [`$${value.toLocaleString()}`, 'Equity']}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#0ea5e9"
                      fill="url(#equityGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-[#6b7280]">
                  <p>No chart data available</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Active Algorithms Card */}
        <Card className="bg-[#1a1f2e] border-[#1f2937]">
          <CardHeader>
            <CardTitle className="text-white">Active Algorithms</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-[#6b7280]">
                <p>Loading algorithms...</p>
              </div>
            ) : activeAlgorithms > 0 ? (
              <>
                <div className="space-y-4">
                  {Array.from({ length: Math.min(activeAlgorithms, 3) }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-lg bg-[#0f1419] border border-[#1f2937] cursor-pointer hover:border-[#0ea5e9] transition-colors"
                      onClick={() => navigate('/app/quant/algorithms')}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-[#10b981]"></div>
                        <div>
                          <p className="text-sm font-medium text-white">Strategy {i + 1}</p>
                          <p className="text-xs text-[#6b7280]">Python • Running</p>
                        </div>
                      </div>
                      <FileCode className="w-4 h-4 text-[#6b7280]" />
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  className="w-full mt-4 border-[#1f2937] text-[#9ca3af] hover:text-white hover:bg-[#0f1419]"
                  onClick={() => navigate('/app/quant/algorithms')}
                >
                  View All
                </Button>
              </>
            ) : (
              <div className="text-center py-8 text-[#6b7280]">
                <p>No active algorithms</p>
                <Button
                  variant="outline"
                  className="mt-4 border-[#1f2937] text-[#9ca3af] hover:text-white hover:bg-[#0f1419]"
                  onClick={() => navigate('/app/quant/algorithms')}
                >
                  Create Algorithm
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Backtests */}
      <Card className="bg-[#1a1f2e] border-[#1f2937]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">Recent Backtests</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-[#0ea5e9] hover:text-[#0284c7]"
              onClick={() => navigate('/app/quant/backtests')}
            >
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center py-8 text-[#6b7280]">
                <p>Loading backtests...</p>
              </div>
            ) : recentBacktestsList.length > 0 ? (
              recentBacktestsList.map((backtest) => (
                <div
                  key={backtest.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-[#0f1419] border border-[#1f2937] cursor-pointer hover:border-[#0ea5e9] transition-colors"
                  onClick={() => navigate(`/app/quant/chart?id=${backtest.id}`)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-[#0ea5e9]/20 flex items-center justify-center">
                      <BarChart3 className="w-6 h-6 text-[#0ea5e9]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{backtest.name}</p>
                      <p className="text-xs text-[#6b7280]">
                        {backtest.startTime ? new Date(backtest.startTime).toLocaleDateString() : 'N/A'} • {backtest.status}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className={`text-sm font-medium ${backtest.metrics && backtest.metrics.totalReturn >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                        {backtest.metrics ? `${backtest.metrics.totalReturn >= 0 ? '+' : ''}${backtest.metrics.totalReturn.toFixed(2)}%` : 'N/A'}
                      </p>
                      <p className="text-xs text-[#6b7280]">
                        Sharpe: {backtest.metrics ? backtest.metrics.sharpeRatio.toFixed(2) : 'N/A'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[#0ea5e9] hover:text-[#0284c7]"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/app/quant/chart?id=${backtest.id}`);
                      }}
                    >
                      View
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-[#6b7280]">
                <p>No recent backtests</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

