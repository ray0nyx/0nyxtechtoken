import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PnLCalendar, PeriodPnLData } from "@/components/analytics/PnLCalendar";
import { CumulativePnLChart } from "@/components/analytics/CumulativePnLChart";
import { DailyPnLBarChartAnalytics } from "@/components/analytics/DailyPnLBarChartAnalytics";
import { DrawdownChart } from "@/components/analytics/DrawdownChart";
import { TodayPnLChart } from "@/components/analytics/TodayPnLChart";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle, ChevronUp, ChevronDown } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useTheme } from "@/components/ThemeProvider";
import { Json } from "@/types/database.types";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { ProfitFactorChart } from '@/components/charts/ProfitFactorChart';
import { WinLossDistributionChartAnalytics } from '@/components/analytics/WinLossDistributionChartAnalytics';
import { InstitutionalMetrics } from '@/components/analytics/InstitutionalMetrics';
import { PortfolioHeatmap } from '@/components/analytics/PortfolioHeatmap';
import { TradingFeesManager } from '@/components/fees/TradingFeesManager';
import { BitcoinOnChainDashboard } from '@/components/analytics/BitcoinOnChainDashboard';

interface DayPnL {
  date: string;
  pnl: number;
}

interface TradeStats {
  strategyPerformance: number;
  winRate: number;
  tradeDurationVsPnl: number;
  performanceByDuration: number;
  winningTrades: number;
  losingTrades: number;
  totalTrades: number;
  largestWin: number;
  largestLoss: number;
  dailyPnl: Record<string, number>;
  weeklyPnl: Record<string, number>;
  monthlyPnl: Record<string, number>;
  grossProfit?: number;
  grossLoss?: number;
}

const defaultStats: TradeStats = {
  strategyPerformance: 0,
  winRate: 0,
  tradeDurationVsPnl: 0,
  performanceByDuration: 0,
  winningTrades: 0,
  losingTrades: 0,
  totalTrades: 0,
  largestWin: 0,
  largestLoss: 0,
  dailyPnl: {},
  weeklyPnl: {},
  monthlyPnl: {}
};

// Use imported PeriodPnLData from PnLCalendar

export default function Analytics() {
  const [stats, setStats] = useState<TradeStats>(defaultStats);
  const [monthlyPnL, setMonthlyPnL] = useState<DayPnL[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [trades, setTrades] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [currentPeriodPnL, setCurrentPeriodPnL] = useState<PeriodPnLData>({
    currentDayPnL: 0,
    currentWeekPnL: 0,
    currentMonthPnL: 0,
    monthlyPnL: []
  });
  const { toast } = useToast();
  const { theme } = useTheme();
  const supabase = createClient();

  // Animation states
  const [animateStats, setAnimateStats] = useState(false);
  const [animateRatio, setAnimateRatio] = useState(false);
  const [animatePeriod, setAnimatePeriod] = useState(false);
  const [animateCharts, setAnimateCharts] = useState(false);

  // Handle animations
  useEffect(() => {
    if (!isLoading) {
      // Staggered animations
      setAnimateStats(true);

      const ratioTimer = setTimeout(() => setAnimateRatio(true), 100);
      const periodTimer = setTimeout(() => setAnimatePeriod(true), 200);
      const chartsTimer = setTimeout(() => setAnimateCharts(true), 300);

      return () => {
        clearTimeout(ratioTimer);
        clearTimeout(periodTimer);
        clearTimeout(chartsTimer);
      };
    }
  }, [isLoading]);

  useEffect(() => {
    fetchStats();
  }, []);

  // Helper function to safely extract value from JSONB
  const getValueFromJson = (json: Json | null): number => {
    if (!json) return 0;
    if (typeof json === 'object' && json !== null && 'value' in json) {
      return (json as { value: number }).value || 0;
    }
    if (typeof json === 'number') {
      return json;
    }
    return 0;
  };

  // Helper function to safely parse PnL records
  const getPnlRecord = (value: any): Record<string, number> => {
    if (typeof value === 'object' && value !== null) {
      return value as Record<string, number>;
    }
    return {};
  };

  const fetchStats = async () => {
    // Prevent multiple simultaneous requests
    if (isFetching) {
      console.log('Analytics fetchStats already in progress, skipping...');
      return;
    }

    setIsFetching(true);
    setIsLoading(true);
    setError(null);

    let timeoutId: NodeJS.Timeout | null = null;

    // Add timeout to prevent hanging
    timeoutId = setTimeout(() => {
      console.warn('Analytics fetchStats timeout - forcing loading to false');
      setIsLoading(false);
      setIsRefreshing(false);
      setIsFetching(false);
    }, 8000); // Reduced from 10 to 8 seconds

    // Add minimum loading time for smooth UI transitions
    const minLoadingTime = new Promise(resolve => setTimeout(resolve, 300)); // Reduced from 500ms

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('No authenticated user found');
        setIsLoading(false);
        return;
      }

      console.log('Performance page: Authenticated user found:', user.id);

      // Fetch trades first
      const { data: tradesData, error: tradesError } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .order('entry_date', { ascending: true });

      if (tradesError) {
        console.error("Error fetching trades:", tradesError);
        throw tradesError;
      }

      setTrades(tradesData || []);

      // First, query trades to get the latest largest win
      const { data: tradesDataWin, error: tradesErrorWin } = await supabase
        .from('trades')
        .select('pnl')
        .eq('user_id', user.id)
        .gt('pnl', 0)
        .order('pnl', { ascending: false })
        .limit(1);

      if (tradesErrorWin) {
        console.error("Error fetching largest trade:", tradesErrorWin);
        throw tradesErrorWin;
      }

      // Get latest largest win (if available)
      const currentLargestWin = tradesDataWin && tradesDataWin.length > 0 ? tradesDataWin[0].pnl : 0;

      // Query trades to get the latest largest loss
      const { data: lossData, error: lossError } = await supabase
        .from('trades')
        .select('pnl')
        .eq('user_id', user.id)
        .lt('pnl', 0)
        .order('pnl', { ascending: true })
        .limit(1);

      if (lossError) {
        console.error("Error fetching largest loss trade:", lossError);
        throw lossError;
      }

      // Get latest largest loss (if available)
      const currentLargestLoss = lossData && lossData.length > 0 ? lossData[0].pnl : 0;

      // Query trades to get the total count of winning trades
      const { data: winningTradesData, error: winningTradesError } = await supabase
        .from('trades')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id)
        .gt('pnl', 0);

      if (winningTradesError) {
        console.error("Error fetching winning trades count:", winningTradesError);
        throw winningTradesError;
      }

      // Get current count of winning trades
      const currentWinningTrades = winningTradesData?.length || 0;

      // Query trades to get the total count of losing trades
      const { data: losingTradesData, error: losingTradesError } = await supabase
        .from('trades')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id)
        .lt('pnl', 0);

      if (losingTradesError) {
        console.error("Error fetching losing trades count:", losingTradesError);
        throw losingTradesError;
      }

      // Get current count of losing trades
      const currentLosingTrades = losingTradesData?.length || 0;

      // Query total P&L sum and count for calculating average
      const { data: pnlData, error: pnlError } = await supabase
        .from('trades')
        .select('pnl')
        .eq('user_id', user.id);

      if (pnlError) {
        console.error("Error fetching trades for average P&L calculation:", pnlError);
        throw pnlError;
      }

      // Calculate current average P&L - sum all trades and divide by count
      let currentTotalPnL = 0;
      const currentTotalTrades = pnlData?.length || 0;

      if (pnlData && pnlData.length > 0) {
        currentTotalPnL = pnlData.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
      }

      // Calculate the average
      const currentAveragePnL = currentTotalTrades > 0 ? currentTotalPnL / currentTotalTrades : 0;

      // Calculate current win rate from winning trades count and total trades
      const currentWinRate = currentTotalTrades > 0
        ? (currentWinningTrades / currentTotalTrades) * 100
        : 0;

      // Query trades to get data for profit factor calculation
      const { data: profitFactorData, error: profitFactorError } = await supabase
        .from('trades')
        .select('pnl')
        .eq('user_id', user.id);

      if (profitFactorError) {
        console.error("Error fetching trades for profit factor calculation:", profitFactorError);
        throw profitFactorError;
      }

      // Calculate gross profit and gross loss for profit factor
      let grossProfit = 0;
      let grossLoss = 0;

      if (profitFactorData && profitFactorData.length > 0) {
        profitFactorData.forEach(trade => {
          if (trade.pnl > 0) {
            grossProfit += trade.pnl;
          } else if (trade.pnl < 0) {
            grossLoss += Math.abs(trade.pnl); // Convert negative to positive
          }
        });
      }

      // Calculate profit factor (gross profit / gross loss)
      const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

      // Fetch analytics data
      const { data: analyticsData, error: analyticsError } = await supabase
        .from('analytics')
        .select('*')
        .eq('user_id', user.id);

      if (analyticsError) {
        console.error("Error fetching analytics:", analyticsError);
        throw analyticsError;
      }

      console.log("Analytics: Fetched analytics data:", analyticsData);

      // Handle case of no data or multiple rows
      if (!analyticsData || analyticsData.length === 0) {
        console.log("No analytics data found for user:", user.id);
        setStats({
          ...defaultStats,
          largestWin: currentLargestWin, // Use the current largest win
          largestLoss: currentLargestLoss, // Use the current largest loss
          winningTrades: currentWinningTrades, // Use the current winning trades count
          losingTrades: currentLosingTrades, // Use the current losing trades count
          totalTrades: currentTotalTrades, // Use the current total trades count
          strategyPerformance: currentTotalPnL, // Use the current total P&L
          performanceByDuration: profitFactor, // Use profit factor instead of average P&L
          winRate: currentWinRate, // Use the current win rate
          grossProfit: grossProfit, // Store for pie chart
          grossLoss: grossLoss, // Store for pie chart
        });
      } else {
        // Use the first row if multiple rows are returned
        const data = analyticsData[0];
        console.log("Using analytics data:", data);

        // Extract values from analytics data
        setStats({
          strategyPerformance: currentTotalPnL, // Use the current total P&L
          winRate: currentWinRate, // Use the current win rate
          tradeDurationVsPnl: getValueFromJson(data.average_pnl),
          performanceByDuration: profitFactor, // Use profit factor instead of average P&L
          winningTrades: currentWinningTrades, // Use the current winning trades count
          losingTrades: currentLosingTrades, // Use the current losing trades count
          totalTrades: currentTotalTrades, // Use the current total trades count
          largestWin: currentLargestWin, // Use the current largest win instead of analytics data
          largestLoss: currentLargestLoss, // Use the current largest loss instead of analytics data
          dailyPnl: getPnlRecord(data.daily_pnl),
          weeklyPnl: getPnlRecord(data.weekly_pnl),
          monthlyPnl: getPnlRecord(data.monthly_pnl),
          grossProfit: grossProfit, // Store for pie chart
          grossLoss: grossLoss, // Store for pie chart
        });
      }
    } catch (err) {
      console.error("Error in fetchStats:", err);
      setError("Failed to fetch analytics data. Please try again later.");
      toast({
        title: "Error",
        description: "Failed to fetch analytics data. Please try again later.",
        variant: "destructive",
      });
    } finally {
      clearTimeout(timeoutId);
      // Wait for minimum loading time to ensure smooth UI transitions
      await minLoadingTime;
      setIsLoading(false);
      setIsRefreshing(false);
      setIsFetching(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchStats();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      signDisplay: 'auto',
    }).format(amount || 0);
  };

  const formatPercentage = (value: number) => {
    return `${(value || 0).toFixed(2)}%`;
  };

  // Format profit factor (add decimal places for values close to 1)
  const formatProfitFactor = (value: number) => {
    if (!isFinite(value)) return "∞"; // For infinity
    if (value === 0) return "0";

    // For values around 1, show more decimal places
    if (value > 0.9 && value < 1.1) {
      return value.toFixed(2);
    }

    // For larger values, show fewer decimal places
    if (value >= 10) {
      return value.toFixed(1);
    }

    return value.toFixed(2);
  };

  // Helper function to get the most recent value from a Record
  const getMostRecentValue = (record: Record<string, number> | undefined): number => {
    if (!record) return 0;
    if (Object.keys(record).length === 0) return 0;

    // Sort keys in descending order (most recent first)
    const sortedKeys = Object.keys(record).sort().reverse();
    return record[sortedKeys[0]] || 0;
  };

  const toggleDebugMode = () => {
    setDebugMode(!debugMode);
  };

  const handlePeriodPnLUpdate = (data: PeriodPnLData) => {
    setCurrentPeriodPnL(prevData => ({
      ...data,
      monthlyPnL: data.monthlyPnL || prevData.monthlyPnL || []
    }));
  };

  return (
    <ErrorBoundary>
      <div className="px-3 sm:px-4 md:px-8 py-3 sm:py-4 md:py-6 space-y-4 sm:space-y-6 max-w-[100vw] overflow-x-hidden">

        {error && (
          <div className="bg-destructive/15 border border-destructive text-destructive px-3 sm:px-4 py-2 sm:py-3 rounded-lg mb-4 sm:mb-6 animate-in fade-in slide-in-from-top-5 duration-300">
            <div className="flex items-center">
              <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
              <span className="text-sm sm:text-base">{error}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 transition-all hover:bg-destructive hover:text-destructive-foreground"
              onClick={fetchStats}
            >
              <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              Retry
            </Button>
          </div>
        )}

        <div className={`grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6 md:mb-8 transition-all duration-500 ${animateStats ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <Card className="rounded-xl border transition-all duration-500 hover:shadow-2xl hover:shadow-gray-500/10 group overflow-hidden bg-gray-100 dark:!bg-[#0a0a0a] border-gray-200 dark:border-slate-700/50 hover:border-gray-500/30 shadow-lg shadow-gray-500/5 hover:shadow-gray-500/20 active:scale-[0.98] touch-manipulation">
            <CardHeader className="pb-1 sm:pb-2 group-hover:bg-gray-500/10 transition-colors duration-300 py-2 sm:py-3 px-4 sm:px-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gray-500/10 group-hover:bg-gray-500/20 transition-colors duration-300">
                  <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                </div>
                Total Trades
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3 sm:pb-4 px-4 sm:px-6">
              {isLoading ? (
                <Skeleton className="h-6 sm:h-8 w-14 sm:w-20" />
              ) : (
                <div className="flex flex-col items-center justify-center py-2 sm:py-4">
                  <div className="text-3xl sm:text-4xl md:text-6xl font-black group-hover:scale-110 transition-transform duration-300 text-gray-400">
                    {stats.totalTrades}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border transition-all duration-500 hover:shadow-2xl hover:shadow-green-500/10 group overflow-hidden bg-gray-100 dark:!bg-[#0a0a0a] border-gray-200 dark:border-slate-700/50 hover:border-green-500/30 shadow-lg shadow-green-500/5 hover:shadow-green-500/20 active:scale-[0.98] touch-manipulation">
            <CardHeader className="pb-1 sm:pb-2 group-hover:bg-green-500/10 transition-colors duration-300 py-2 sm:py-3 px-4 sm:px-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-green-500/10 group-hover:bg-green-500/20 transition-colors duration-300">
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                </div>
                Win Rate
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3 sm:pb-4 px-4 sm:px-6">
              {isLoading ? (
                <Skeleton className="h-6 sm:h-8 w-14 sm:w-20" />
              ) : (
                <div className="space-y-2 sm:space-y-4">
                  <div className={`text-lg sm:text-xl md:text-2xl font-bold group-hover:scale-105 origin-left transition-transform duration-200 ${stats.winRate >= 60 ? 'text-green-400' : 'text-gray-900 dark:text-white'}`}>
                    {formatPercentage(stats.winRate)}
                    <div className="text-[10px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {stats.winRate >= 60 ? '👍 Good win rate!' : 'Room for improvement'}
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs sm:text-sm">
                    <div className="group-hover:translate-x-[-2px] sm:group-hover:translate-x-[-4px] transition-transform duration-200">
                      <div className="text-[10px] sm:text-xs text-slate-400">Avg Win</div>
                      <div className="text-sm sm:text-base md:text-lg font-bold text-gray-400">
                        {formatCurrency(stats.grossProfit / stats.winningTrades)}
                      </div>
                    </div>
                    <div className="flex flex-col items-center justify-center px-1 sm:px-4 w-full max-w-[80px] sm:max-w-[200px]">
                      <div className="w-full h-2 sm:h-3 rounded-full bg-slate-700/50 overflow-hidden relative">
                        <div
                          className="absolute left-0 top-0 h-full bg-gray-500 rounded-full"
                          style={{
                            width: `${Math.abs((stats.grossProfit / stats.winningTrades) / ((Math.abs(stats.grossProfit / stats.winningTrades) + Math.abs(stats.grossLoss / stats.losingTrades)))) * 100}%`,
                            transition: 'width 0.3s ease-in-out'
                          }}
                        />
                        <div
                          className="absolute right-0 top-0 h-full bg-gray-200 rounded-full"
                          style={{
                            width: `${Math.abs((stats.grossLoss / stats.losingTrades) / ((Math.abs(stats.grossProfit / stats.winningTrades) + Math.abs(stats.grossLoss / stats.losingTrades)))) * 100}%`,
                            transition: 'width 0.3s ease-in-out'
                          }}
                        />
                      </div>
                    </div>
                    <div className="group-hover:translate-x-[2px] sm:group-hover:translate-x-[4px] transition-transform duration-200">
                      <div className="text-[10px] sm:text-xs text-slate-400">Avg Loss</div>
                      <div className="text-sm sm:text-base md:text-lg font-bold text-gray-300">
                        {formatCurrency(-stats.grossLoss / stats.losingTrades)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border transition-all duration-500 hover:shadow-2xl hover:shadow-emerald-500/10 group overflow-hidden bg-gray-100 dark:!bg-[#0a0a0a] border-gray-200 dark:border-slate-700/50 hover:border-emerald-500/30 shadow-lg shadow-emerald-500/5 hover:shadow-emerald-500/20 relative active:scale-[0.98] touch-manipulation">
            <div className="absolute inset-0 overflow-hidden opacity-10 group-hover:opacity-20 transition-opacity duration-300">
              <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path
                  d={stats.strategyPerformance >= 0
                    ? "M0,100 L10,80 L20,85 L30,70 L40,75 L50,60 L60,50 L70,40 L80,30 L90,20 L100,0"
                    : "M0,0 L10,20 L20,15 L30,30 L40,25 L50,40 L60,50 L70,60 L80,70 L90,80 L100,100"
                  }
                  stroke={stats.strategyPerformance >= 100000
                    ? "#F59E0B"
                    : stats.strategyPerformance >= 0
                      ? "#10B981"
                      : "#EF4444"}
                  strokeWidth="3"
                  fill="none"
                  className="transition-all duration-500"
                />
              </svg>
            </div>
            <CardHeader className="pb-1 sm:pb-2 group-hover:bg-emerald-500/10 transition-colors duration-300 py-2 sm:py-3 px-4 sm:px-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors duration-300">
                  <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                </div>
                Total P&L
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3 sm:pb-4 px-4 sm:px-6">
              {isLoading ? (
                <Skeleton className="h-6 sm:h-8 w-14 sm:w-20" />
              ) : (
                <div className={`text-lg sm:text-xl md:text-4xl font-bold group-hover:scale-105 origin-left transition-transform duration-200 flex items-center gap-1 ${stats.strategyPerformance >= 100000
                  ? 'text-amber-400'
                  : stats.strategyPerformance >= 0
                    ? 'text-emerald-400'
                    : 'text-red-400'
                  }`}>
                  {formatCurrency(stats.strategyPerformance)}
                  {!isLoading && stats.strategyPerformance > 0 ?
                    <ChevronUp className={`h-3 w-3 sm:h-4 sm:w-4 ${stats.strategyPerformance >= 100000 ? 'text-amber-400' : 'text-green-400'}`} /> :
                    stats.strategyPerformance < 0 ?
                      <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 text-red-400" /> : null
                  }
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border transition-all duration-500 hover:shadow-2xl hover:shadow-gray-200/10 group overflow-hidden bg-gray-100 dark:!bg-[#0a0a0a] border-gray-200 dark:border-slate-700/50 hover:border-gray-200/30 shadow-lg shadow-gray-200/5 hover:shadow-gray-200/20 active:scale-[0.98] touch-manipulation">
            <CardHeader className="pb-1 sm:pb-2 group-hover:bg-gray-200/10 transition-colors duration-300 py-2 sm:py-3 px-4 sm:px-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gray-200/10 group-hover:bg-gray-200/20 transition-colors duration-300">
                  <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                </div>
                Profit Factor
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3 sm:pb-4 px-4 sm:px-6">
              {isLoading ? (
                <Skeleton className="h-6 sm:h-8 w-14 sm:w-20" />
              ) : (
                <div className="flex flex-col">
                  <div className={`text-lg sm:text-xl md:text-2xl font-bold group-hover:scale-105 origin-left transition-transform duration-200 flex items-center gap-1 ${stats.performanceByDuration >= 1 ? 'text-gray-300' : 'text-red-400'}`}>
                    {formatProfitFactor(stats.performanceByDuration)}
                    {!isLoading && stats.performanceByDuration >= 1 ?
                      <ChevronUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-400" /> :
                      stats.performanceByDuration < 1 ?
                        <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 text-red-400" /> : null
                    }
                  </div>

                  {/* Small pie chart */}
                  {!isLoading && stats.grossProfit !== undefined && stats.grossLoss !== undefined && (
                    <div className="h-[60px] sm:h-[90px] mt-1 sm:mt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Gross Profit', value: stats.grossProfit || 0 },
                              { name: 'Gross Loss', value: stats.grossLoss || 0 }
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={25}
                            outerRadius={45}
                            paddingAngle={4}
                            dataKey="value"
                            stroke="none"
                          >
                            <Cell fill="#6B7280" /> {/* Gray for gross profit */}
                            <Cell fill="#D1D5DB" /> {/* Light Gray for gross loss */}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6 md:mb-8 transition-all duration-500 ${animateRatio ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <Card className="rounded-xl border transition-all duration-500 hover:shadow-2xl hover:shadow-gray-500/10 group overflow-hidden bg-gray-100 dark:!bg-[#0a0a0a] border-gray-200 dark:border-slate-700/50 hover:border-gray-500/30 shadow-lg shadow-gray-500/5 hover:shadow-gray-500/20">
            <CardHeader className="pb-1 sm:pb-2 group-hover:bg-gray-500/10 transition-colors duration-300 py-2 sm:py-3 px-4 sm:px-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gray-500/10 group-hover:bg-gray-500/20 transition-colors duration-300">
                  <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                </div>
                Win/Loss Ratio
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3 sm:pb-4 px-4 sm:px-6">
              {isLoading ? (
                <Skeleton className="h-6 sm:h-8 w-14 sm:w-20" />
              ) : (
                <div className="flex flex-col space-y-3 sm:space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="group-hover:translate-x-[-2px] sm:group-hover:translate-x-[-4px] transition-transform duration-200">
                      <div className="text-[10px] sm:text-xs text-slate-400">Winning Trades</div>
                      <div className="text-base sm:text-lg md:text-xl font-bold text-gray-400">
                        {stats.winningTrades}
                      </div>
                    </div>
                    <div className="flex flex-col items-center justify-center px-1 sm:px-4 w-full max-w-[100px] sm:max-w-[200px]">
                      <div className="w-full h-2 sm:h-3 rounded-full bg-slate-700/50 overflow-hidden relative">
                        <div
                          className="absolute left-0 top-0 h-full bg-gray-500 rounded-full"
                          style={{
                            width: `${(stats.winningTrades / (stats.winningTrades + stats.losingTrades)) * 100}%`,
                            transition: 'width 0.3s ease-in-out'
                          }}
                        />
                        <div
                          className="absolute right-0 top-0 h-full bg-gray-200 rounded-full"
                          style={{
                            width: `${(stats.losingTrades / (stats.winningTrades + stats.losingTrades)) * 100}%`,
                            transition: 'width 0.3s ease-in-out'
                          }}
                        />
                      </div>
                    </div>
                    <div className="group-hover:translate-x-[2px] sm:group-hover:translate-x-[4px] transition-transform duration-200">
                      <div className="text-[10px] sm:text-xs text-slate-400">Losing Trades</div>
                      <div className="text-base sm:text-lg md:text-xl font-bold text-gray-300">
                        {stats.losingTrades}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-1 sm:pt-2">
                    <div className="group-hover:translate-x-[-2px] sm:group-hover:translate-x-[-4px] transition-transform duration-200">
                      <div className="text-[10px] sm:text-xs text-slate-400">Winning Days</div>
                      <div className="text-sm sm:text-base md:text-lg font-bold text-gray-400">
                        {currentPeriodPnL.monthlyPnL?.filter(day => day.pnl > 0).length || 0}
                      </div>
                    </div>
                    <div className="flex flex-col items-center justify-center px-1 sm:px-4 w-full max-w-[100px] sm:max-w-[200px] relative group/days">
                      <div className="w-full h-2 sm:h-3 rounded-full bg-slate-700/50 overflow-hidden relative">
                        <div
                          className="absolute left-0 top-0 h-full bg-gray-500 rounded-full"
                          style={{
                            width: `${((currentPeriodPnL.monthlyPnL?.filter(day => day.pnl > 0).length || 0) / (currentPeriodPnL.monthlyPnL?.filter(day => day.pnl !== 0).length || 1)) * 100}%`,
                            transition: 'width 0.3s ease-in-out'
                          }}
                        />
                        <div
                          className="absolute right-0 top-0 h-full bg-gray-200 rounded-full"
                          style={{
                            width: `${((currentPeriodPnL.monthlyPnL?.filter(day => day.pnl < 0).length || 0) / (currentPeriodPnL.monthlyPnL?.filter(day => day.pnl !== 0).length || 1)) * 100}%`,
                            transition: 'width 0.3s ease-in-out'
                          }}
                        />
                      </div>
                      <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-slate-900/95 dark:bg-slate-900/95 text-white px-2 py-1 rounded-md text-[10px] sm:text-sm opacity-0 group-hover/days:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                        <span className="text-gray-400 font-medium">{currentPeriodPnL.monthlyPnL?.filter(day => day.pnl > 0).length || 0} winning</span>
                        {" / "}
                        <span className="text-gray-300 font-medium">{currentPeriodPnL.monthlyPnL?.filter(day => day.pnl < 0).length || 0} losing</span>
                        {" days"}
                      </div>
                    </div>
                    <div className="group-hover:translate-x-[2px] sm:group-hover:translate-x-[4px] transition-transform duration-200">
                      <div className="text-[10px] sm:text-xs text-slate-400">Losing Days</div>
                      <div className="text-sm sm:text-base md:text-lg font-bold text-gray-300">
                        {currentPeriodPnL.monthlyPnL?.filter(day => day.pnl < 0).length || 0}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border transition-all duration-500 hover:shadow-2xl hover:shadow-purple-500/10 group overflow-hidden bg-gray-100 dark:!bg-[#0a0a0a] border-gray-200 dark:border-slate-700/50 hover:border-purple-500/30 shadow-lg shadow-purple-500/5 hover:shadow-purple-500/20">
            <CardHeader className="pb-1 sm:pb-2 group-hover:bg-purple-500/10 transition-colors duration-300 py-2 sm:py-3 px-4 sm:px-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors duration-300">
                  <div className="w-3 h-3 rounded-full bg-purple-500 shadow-[0_0_8px_2px_rgba(168,85,247,0.6)]"></div>
                </div>
                Best & Worst Trades
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3 sm:pb-4 px-4 sm:px-6">
              {isLoading ? (
                <Skeleton className="h-6 sm:h-8 w-14 sm:w-20" />
              ) : (
                <div className="flex flex-col space-y-3 sm:space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="group-hover:translate-x-[-2px] sm:group-hover:translate-x-[-4px] transition-transform duration-200">
                      <div className="text-[10px] sm:text-xs text-slate-400">Largest Win</div>
                      <div className="text-sm sm:text-base md:text-xl font-bold text-gray-400">
                        {formatCurrency(stats.largestWin)}
                      </div>
                    </div>
                    <div className="group-hover:translate-x-[2px] sm:group-hover:translate-x-[4px] transition-transform duration-200">
                      <div className="text-[10px] sm:text-xs text-slate-400">Largest Loss</div>
                      <div className="text-sm sm:text-base md:text-xl font-bold text-gray-300">
                        {formatCurrency(-stats.largestLoss)}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-center items-end gap-3 sm:gap-4">
                    <div className="w-8 sm:w-12 h-16 sm:h-24 bg-slate-700/50 rounded-t-lg relative overflow-hidden">
                      <div
                        className="absolute bottom-0 w-full bg-gray-500 rounded-t-lg transition-all duration-300 group-hover:opacity-90"
                        style={{
                          height: `${(stats.largestWin / Math.max(Math.abs(stats.largestWin), Math.abs(stats.largestLoss))) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="w-8 sm:w-12 h-16 sm:h-24 bg-slate-700/50 rounded-t-lg relative overflow-hidden">
                      <div
                        className="absolute bottom-0 w-full bg-gray-200 rounded-t-lg transition-all duration-300 group-hover:opacity-90"
                        style={{
                          height: `${(Math.abs(stats.largestLoss) / Math.max(Math.abs(stats.largestWin), Math.abs(stats.largestLoss))) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className={`grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-4 sm:mb-6 transition-all duration-500 ${animatePeriod ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <div className="flex flex-col gap-4 sm:gap-6 h-full">
            <Card className="rounded-xl border transition-all duration-500 hover:shadow-2xl hover:shadow-gray-200/10 group overflow-hidden bg-gray-100 dark:!bg-[#0a0a0a] border-gray-200 dark:border-slate-700/50 hover:border-gray-200/30 shadow-lg shadow-gray-200/5 hover:shadow-gray-200/20" style={{ height: 'calc(40% - 8px)' }}>
              <CardHeader className="pb-1 sm:pb-2 group-hover:bg-gray-200/10 transition-colors duration-300 py-2 sm:py-3 px-4 sm:px-6">
                <CardTitle className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-gray-200/10 group-hover:bg-gray-200/20 transition-colors duration-300">
                    <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                  </div>
                  Period Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="py-0 px-3 sm:px-6">
                <div className="space-y-2">
                  <div className="group/item transition-all duration-300 hover:translate-x-1">
                    <div className="text-[10px] sm:text-xs text-slate-400 mb-0.5 sm:mb-1">Daily P&L</div>
                    {isLoading ? (
                      <Skeleton className="h-6 sm:h-8 w-20 sm:w-28" />
                    ) : (
                      <>
                        <div className={`text-base sm:text-lg md:text-xl font-bold flex items-center gap-1 ${currentPeriodPnL.currentDayPnL >= 0 ? 'text-gray-400' : 'text-gray-300'}`}>
                          {formatCurrency(currentPeriodPnL.currentDayPnL)}
                          {currentPeriodPnL.currentDayPnL > 0 ?
                            <ChevronUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-400" /> :
                            currentPeriodPnL.currentDayPnL < 0 ?
                              <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 text-red-400" /> : null
                          }
                        </div>
                        <div className="w-full h-1 sm:h-1.5 bg-slate-700/50 rounded-full mt-0.5 sm:mt-1 overflow-hidden">
                          {currentPeriodPnL.currentDayPnL !== 0 && (
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${currentPeriodPnL.currentDayPnL >= 0 ? 'bg-gray-500' : 'bg-gray-200'}`}
                              style={{
                                width: `${Math.min(Math.abs(currentPeriodPnL.currentDayPnL) / Math.max(Math.abs(currentPeriodPnL.currentWeekPnL), Math.abs(currentPeriodPnL.currentMonthPnL)) * 100, 100)}%`,
                                marginLeft: currentPeriodPnL.currentDayPnL < 0 ? 'auto' : 0,
                                marginRight: currentPeriodPnL.currentDayPnL < 0 ? 0 : 'auto',
                              }}
                            />
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="group/item transition-all duration-300 hover:translate-x-1">
                    <div className="text-[10px] sm:text-xs text-slate-400 mb-0.5 sm:mb-1">Weekly P&L</div>
                    {isLoading ? (
                      <Skeleton className="h-6 sm:h-8 w-20 sm:w-28" />
                    ) : (
                      <>
                        <div className={`text-base sm:text-lg md:text-xl font-bold flex items-center gap-1 ${currentPeriodPnL.currentWeekPnL >= 0 ? 'text-gray-400' : 'text-gray-300'}`}>
                          {formatCurrency(currentPeriodPnL.currentWeekPnL)}
                          {currentPeriodPnL.currentWeekPnL > 0 ?
                            <ChevronUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-400" /> :
                            currentPeriodPnL.currentWeekPnL < 0 ?
                              <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 text-red-400" /> : null
                          }
                        </div>
                        <div className="w-full h-1 sm:h-1.5 bg-slate-700/50 rounded-full mt-0.5 sm:mt-1 overflow-hidden">
                          {currentPeriodPnL.currentWeekPnL !== 0 && (
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${currentPeriodPnL.currentWeekPnL >= 0 ? 'bg-gray-500' : 'bg-gray-200'}`}
                              style={{
                                width: `${Math.min(Math.abs(currentPeriodPnL.currentWeekPnL) / Math.max(Math.abs(currentPeriodPnL.currentDayPnL), Math.abs(currentPeriodPnL.currentWeekPnL), Math.abs(currentPeriodPnL.currentMonthPnL)) * 100, 100)}%`,
                                marginLeft: currentPeriodPnL.currentWeekPnL < 0 ? 'auto' : 0,
                                marginRight: currentPeriodPnL.currentWeekPnL < 0 ? 0 : 'auto',
                              }}
                            />
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="group/item transition-all duration-300 hover:translate-x-1">
                    <div className="text-[10px] sm:text-xs text-slate-400 mb-0.5 sm:mb-1">Monthly P&L</div>
                    {isLoading ? (
                      <Skeleton className="h-6 sm:h-8 w-20 sm:w-28" />
                    ) : (
                      <>
                        <div className={`text-base sm:text-lg md:text-xl font-bold flex items-center gap-1 ${currentPeriodPnL.currentMonthPnL >= 0 ? 'text-gray-400' : 'text-gray-300'}`}>
                          {formatCurrency(currentPeriodPnL.currentMonthPnL)}
                          {currentPeriodPnL.currentMonthPnL > 0 ?
                            <ChevronUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-400" /> :
                            currentPeriodPnL.currentMonthPnL < 0 ?
                              <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 text-red-400" /> : null
                          }
                        </div>
                        <div className="w-full h-1 sm:h-1.5 bg-slate-700/50 rounded-full mt-0.5 sm:mt-1 overflow-hidden">
                          {currentPeriodPnL.currentMonthPnL !== 0 && (
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${currentPeriodPnL.currentMonthPnL >= 0 ? 'bg-gray-500' : 'bg-gray-200'}`}
                              style={{
                                width: `${Math.min(Math.abs(currentPeriodPnL.currentMonthPnL) / Math.max(Math.abs(currentPeriodPnL.currentDayPnL), Math.abs(currentPeriodPnL.currentWeekPnL), Math.abs(currentPeriodPnL.currentMonthPnL)) * 100, 100)}%`,
                                marginLeft: currentPeriodPnL.currentMonthPnL < 0 ? 'auto' : 0,
                                marginRight: currentPeriodPnL.currentMonthPnL < 0 ? 0 : 'auto',
                              }}
                            />
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div style={{ height: 'calc(60% - 8px)' }} className="touch-manipulation">
              <div className="rounded-xl border transition-all duration-500 hover:shadow-2xl hover:shadow-teal-500/10 group overflow-hidden bg-transparent dark:bg-gradient-to-br dark:from-slate-900/50 dark:to-slate-800/30 border-gray-200 dark:border-slate-700/50 hover:border-teal-500/30 shadow-lg shadow-teal-500/5 hover:shadow-teal-500/20 backdrop-blur-sm h-full">
                <TodayPnLChart />
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 touch-manipulation">
            <div className="h-full">
              <PnLCalendar onPeriodPnLUpdate={handlePeriodPnLUpdate} />
            </div>
          </div>
        </div>

        {/* Crypto Analytics Section */}
        <div className="space-y-8">
          <BitcoinOnChainDashboard />
        </div>

        {/* Institutional Analytics Section */}
        <div className="space-y-8">
          <InstitutionalMetrics
            totalPnL={stats.strategyPerformance}
            totalTrades={stats.totalTrades}
            winRate={stats.winRate}
            largestWin={stats.largestWin}
            largestLoss={stats.largestLoss}
            grossProfit={stats.grossProfit || 0}
            grossLoss={stats.grossLoss || 0}
          />

          <PortfolioHeatmap trades={trades} />
        </div>


        {/* Charts Section - Properly Spaced Layout */}
        <div className={`transition-all duration-500 ${animateCharts ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          {/* Main Charts Grid - Properly Spaced Single Column */}
          <div className="space-y-8">
            {/* Cumulative P&L */}
            <div className="w-full">
              {isLoading ? (
                <div className="flex items-center justify-center h-[400px] bg-gradient-to-br from-slate-900/50 to-slate-800/30 border border-slate-700/50 rounded-xl">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <CumulativePnLChart trades={trades} />
              )}
            </div>

            {/* Drawdown Chart */}
            <div className="w-full">
              {isLoading ? (
                <div className="flex items-center justify-center h-[500px] bg-gradient-to-br from-slate-900/50 to-slate-800/30 border border-slate-700/50 rounded-xl">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <DrawdownChart trades={trades} />
              )}
            </div>

            {/* Daily P&L */}
            <div className="w-full">
              {isLoading ? (
                <div className="flex items-center justify-center h-[600px] bg-gradient-to-br from-slate-900/50 to-slate-800/30 border border-slate-700/50 rounded-xl">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <DailyPnLBarChartAnalytics />
              )}
            </div>

            {/* Profit Factor Distribution */}
            <div className="w-full">
              {isLoading ? (
                <div className="flex items-center justify-center h-[500px] bg-gradient-to-br from-slate-900/50 to-slate-800/30 border border-slate-700/50 rounded-xl">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <ProfitFactorChart trades={trades} />
              )}
            </div>

            {/* Win/Loss Distribution Chart */}
            <div className="w-full">
              {isLoading ? (
                <div className="flex items-center justify-center h-[600px] bg-gradient-to-br from-slate-900/50 to-slate-800/30 border border-slate-700/50 rounded-xl">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <WinLossDistributionChartAnalytics />
              )}
            </div>
          </div>

          {/* Trading Fees Management */}
          <Card
            className="rounded-xl border transition-all duration-500 hover:shadow-2xl hover:shadow-rose-500/10 group overflow-hidden border-gray-200 dark:border-slate-700/50 hover:border-rose-500/30 shadow-lg shadow-rose-500/5 hover:shadow-rose-500/20 mb-8"
            style={{
              backgroundColor: theme === 'dark' ? '#0a0a0a' : 'rgb(243 244 246)'
            }}
          >
            <CardHeader className="group-hover:bg-rose-500/10 transition-colors duration-300 px-6 pt-6">
              <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <div className="p-2 rounded-lg bg-rose-500/10 group-hover:bg-rose-500/20 transition-colors duration-300">
                  <div className="w-4 h-4 rounded-full bg-rose-400"></div>
                </div>
                Trading Fees Management
              </CardTitle>
              <p className="text-sm text-gray-600 dark:text-slate-400 mt-2">
                Add and manage additional trading fees that may not be included in your broker's CSV export
              </p>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <TradingFeesManager onFeesUpdated={fetchStats} />
            </CardContent>
          </Card>
        </div>
      </div>
    </ErrorBoundary>
  );
} 