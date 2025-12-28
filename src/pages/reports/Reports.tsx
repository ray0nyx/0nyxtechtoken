import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { RefreshCw, TrendingUp, TrendingDown, DollarSign, Calendar, BarChart2, Zap, Clock, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';
import { useToast } from '@/components/ui/use-toast';
import { useTheme } from '@/components/ThemeProvider';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CumulativePnLChart } from '@/components/analytics/CumulativePnLChart';
import CumulativePnLChartReports from '@/components/analytics/CumulativePnLChartReports';
import { DrawdownChart } from '@/components/analytics/DrawdownChart';
import * as XLSX from 'xlsx';

interface TradeStats {
  totalPnL: number;
  averageDailyVolume: number;
  averageWinningTrade: number;
  averageLosingTrade: number;
  totalNumberOfTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakEvenTrades: number;
  loggedDays: number;
  winningDays: number;
  losingDays: number;
  breakEvenDays: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  maxConsecutiveWinningDays: number;
  maxConsecutiveLosingDays: number;
  averageDailyPnL: number;
  averageWinningDayPnL: number;
  averageLosingDayPnL: number;
  largestProfitableDay: number;
  largestLosingDay: number;
  totalCommissions: number;
  totalFees: number;
  totalSwap: number;
  largestProfit: number;
  largestLoss: number;
  averageHoldTimeAll: number;
  averageHoldTimeWinning: number;
  averageHoldTimeLoosing: number;
  averageTradePnL: number;
  profitFactor: number;
  maxDrawdown: number;
  maxDrawdownPercentage: number;
  averageDrawdown: number;
  averageDrawdownPercentage: number;
  tradeExpectancy: number;
  filteredTrades?: any[]; // Optional property to hold filtered trades for other components
}

const DEFAULT_STATS: TradeStats = {
  totalPnL: 0,
  averageDailyVolume: 0,
  averageWinningTrade: 0,
  averageLosingTrade: 0,
  totalNumberOfTrades: 0,
  winningTrades: 0,
  losingTrades: 0,
  breakEvenTrades: 0,
  loggedDays: 0,
  winningDays: 0,
  losingDays: 0,
  breakEvenDays: 0,
  maxConsecutiveWins: 0,
  maxConsecutiveLosses: 0,
  maxConsecutiveWinningDays: 0,
  maxConsecutiveLosingDays: 0,
  averageDailyPnL: 0,
  averageWinningDayPnL: 0,
  averageLosingDayPnL: 0,
  largestProfitableDay: 0,
  largestLosingDay: 0,
  totalCommissions: 0,
  totalFees: 0,
  totalSwap: 0,
  largestProfit: 0,
  largestLoss: 0,
  averageHoldTimeAll: 0,
  averageHoldTimeWinning: 0,
  averageHoldTimeLoosing: 0,
  averageTradePnL: 0,
  profitFactor: 0,
  maxDrawdown: 0,
  maxDrawdownPercentage: 0,
  averageDrawdown: 0,
  averageDrawdownPercentage: 0,
  tradeExpectancy: 0
};

export default function Reports() {
  const { toast } = useToast();
  const { theme } = useTheme();
  const [stats, setStats] = useState<TradeStats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState('all'); // 'all', 'monthly', 'weekly', 'daily'
  const supabase = createClient();

  useEffect(() => {
    fetchTradeStats();
  }, [period]);

  const fetchTradeStats = async () => {
    let timeoutId: NodeJS.Timeout | null = null;
    
    try {
      setLoading(true);
      setError(null);
      setRefreshing(true);
      
      // Add timeout to prevent infinite loading
      timeoutId = setTimeout(() => {
        setLoading(false);
        setRefreshing(false);
        toast({
          title: "Timeout",
          description: "Loading took too long. Please try again.",
          variant: "destructive",
        });
      }, 10000); // 10 second timeout
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        clearTimeout(timeoutId);
        throw new Error("No authenticated user");
      }
      
      // Try to call the Supabase function to get stats
      try {
        const { data: statsData, error: statsError } = await supabase.rpc('get_user_trade_stats', {
          p_user_id: user.id,
          p_period: period
        });
        
        if (statsError) {
          console.error("Error fetching trade stats:", statsError);
          // Check if it's the specific duration_seconds error
          if (statsError.message && statsError.message.includes('duration_seconds')) {
            console.log("Falling back to client-side calculation due to missing duration_seconds column");
            throw new Error('Using fallback calculation');
          } else {
            throw statsError;
          }
        }
        
        // If we get trade stats back, format them correctly
        if (statsData && typeof statsData === 'object') {
          // Format and transform the raw stats
          const formattedStats: TradeStats = {
            totalPnL: statsData.total_pnl || 0,
            averageDailyVolume: statsData.avg_daily_volume || 0,
            averageWinningTrade: statsData.avg_winning_trade || 0,
            averageLosingTrade: statsData.avg_losing_trade || 0,
            totalNumberOfTrades: statsData.total_trades || 0,
            winningTrades: statsData.winning_trades || 0,
            losingTrades: statsData.losing_trades || 0,
            breakEvenTrades: statsData.break_even_trades || 0,
            loggedDays: statsData.logged_days || 0,
            winningDays: statsData.winning_days || 0,
            losingDays: statsData.losing_days || 0,
            breakEvenDays: statsData.break_even_days || 0,
            maxConsecutiveWins: statsData.max_consecutive_wins || 0,
            maxConsecutiveLosses: statsData.max_consecutive_losses || 0,
            maxConsecutiveWinningDays: statsData.max_consecutive_winning_days || 0,
            maxConsecutiveLosingDays: statsData.max_consecutive_losing_days || 0,
            averageDailyPnL: statsData.avg_daily_pnl || 0,
            averageWinningDayPnL: statsData.avg_winning_day_pnl || 0,
            averageLosingDayPnL: statsData.avg_losing_day_pnl || 0,
            largestProfitableDay: statsData.largest_profitable_day || 0,
            largestLosingDay: statsData.largest_losing_day || 0,
            totalCommissions: statsData.total_commissions || 0,
            totalFees: statsData.total_fees || 0,
            totalSwap: statsData.total_swap || 0,
            largestProfit: statsData.largest_profit || 0,
            largestLoss: statsData.largest_loss || 0,
            averageHoldTimeAll: statsData.avg_hold_time_all || 0,
            averageHoldTimeWinning: statsData.avg_hold_time_winning || 0,
            averageHoldTimeLoosing: statsData.avg_hold_time_losing || 0,
            averageTradePnL: statsData.avg_trade_pnl || 0,
            profitFactor: statsData.profit_factor || 0,
            maxDrawdown: statsData.max_drawdown || 0,
            maxDrawdownPercentage: statsData.max_drawdown_percentage || 0,
            averageDrawdown: statsData.avg_drawdown || 0,
            averageDrawdownPercentage: statsData.avg_drawdown_percentage || 0,
            tradeExpectancy: statsData.trade_expectancy || 0
          };
          
          setStats(formattedStats);
          return; // Exit early since we have the stats
        }
      } catch (functionError) {
        console.log("Falling back to client-side calculation:", functionError);
        // Continue to fallback calculation
      }
      
      // If we reach here, either the RPC function failed or returned no data
      console.log("Using fallback client-side calculation for trade statistics");
      
      // Fetch all user trades
      const { data: trades, error: tradesError } = await supabase
        .from("trades")
        .select("*")
        .eq("user_id", user.id)
        .order("entry_date", { ascending: true }); // Important: order by date ascending for drawdown calculation
      
      if (tradesError) {
        console.error("Error fetching trades:", tradesError);
        throw tradesError;
      }
      
      
      if (!trades || trades.length === 0) {
        // No trades yet, just return default empty stats
        setStats(DEFAULT_STATS);
        return;
      }
      
      // Apply period filtering to trades
      // Filter trades based on selected period
      const filteredTrades = trades.filter(trade => {
        const tradeDate = new Date(trade.entry_date);
        const now = new Date();
        
        switch(period) {
          case 'daily':
            // Today only
            return tradeDate.setHours(0,0,0,0) === now.setHours(0,0,0,0);
          case 'weekly':
            // Last 7 days
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            return tradeDate >= oneWeekAgo;
          case 'monthly':
            // Last 30 days
            const oneMonthAgo = new Date();
            oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
            return tradeDate >= oneMonthAgo;
          case 'all':
          default:
            // All trades
            return true;
        }
      });
      
      if (filteredTrades.length === 0) {
        // No trades in selected period
        setStats({
          ...DEFAULT_STATS,
          // Keep the original trade count for reference
          totalNumberOfTrades: trades.length
        });
        setLoading(false);
        setRefreshing(false);
        return;
      }
      
      // Calculate basic stats from filtered trades
      const totalPnL = filteredTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
      const winningTrades = filteredTrades.filter(trade => (trade.pnl || 0) > 0);
      const losingTrades = filteredTrades.filter(trade => (trade.pnl || 0) < 0);
      const breakEvenTrades = filteredTrades.filter(trade => (trade.pnl || 0) === 0);
      
      
      // Calculate average winning and losing trades
      const avgWinningTrade = winningTrades.length > 0
        ? winningTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0) / winningTrades.length
        : 0;
      
      const avgLosingTrade = losingTrades.length > 0
        ? losingTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0) / losingTrades.length
        : 0;
      
      // Calculate profit factor
      const grossProfit = winningTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
      const grossLoss = Math.abs(losingTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0));
      const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
      
      // Get unique trading days within filtered period
      const tradingDays = [...new Set(filteredTrades.map(trade => {
        // Convert to YYYY-MM-DD format for grouping
        const date = new Date(trade.entry_date);
        return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
      }))];
      
      // Group trades by day for day-based metrics
      const tradesByDay = tradingDays.map(day => {
        const dayTrades = filteredTrades.filter(trade => {
          const date = new Date(trade.entry_date);
          const tradeDay = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
          return tradeDay === day;
        });
        
        const dayPnL = dayTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
        return { day, trades: dayTrades, pnl: dayPnL };
      });
      
      // Calculate day-based metrics
      const winningDays = tradesByDay.filter(day => day.pnl > 0).length;
      const losingDays = tradesByDay.filter(day => day.pnl < 0).length;
      const breakEvenDays = tradesByDay.filter(day => day.pnl === 0).length;
      
      // Calculate average daily PnL
      const avgDailyPnL = tradingDays.length > 0 
        ? totalPnL / tradingDays.length 
        : 0;
      
      // Calculate largest profit and loss
      const largestProfit = winningTrades.length > 0 
        ? Math.max(...winningTrades.map(trade => trade.pnl || 0)) 
        : 0;
      
      const largestLoss = losingTrades.length > 0 
        ? Math.min(...losingTrades.map(trade => trade.pnl || 0)) 
        : 0;
      
      // Calculate drawdown metrics
      let maxDrawdown = 0;
      let maxDrawdownPercentage = 0;
      let allDrawdowns: number[] = [];
      
      // Calculate running account balance and identify drawdowns
      let runningBalance = 0;
      let peak = 0;
      let trough = 0;
      
      // This will track the historical peaks and troughs to calculate drawdowns
      for (let i = 0; i < filteredTrades.length; i++) {
        const tradePnL = filteredTrades[i].pnl || 0;
        runningBalance += tradePnL;
        
        // Update peak if we reach a new high
        if (runningBalance > peak) {
          peak = runningBalance;
          // Reset trough when we hit a new peak
          trough = peak;
        }
        // Update trough if we go lower
        else if (runningBalance < trough) {
          trough = runningBalance;
          
          // Calculate drawdown only if we have a valid peak (not zero)
          if (peak > 0) {
            const drawdownAmount = peak - trough;
            const drawdownPercentage = (drawdownAmount / peak) * 100;
            
            // Update max drawdown if this one is larger
            if (drawdownAmount > maxDrawdown) {
              maxDrawdown = drawdownAmount;
              maxDrawdownPercentage = drawdownPercentage;
            }
            
            // Add this drawdown to our collection for averaging
            if (drawdownPercentage > 0) {
              allDrawdowns.push(drawdownPercentage);
            }
          }
        }
      }
      
      // Calculate average drawdown percentage
      const avgDrawdownPercentage = allDrawdowns.length > 0
        ? allDrawdowns.reduce((sum, percentage) => sum + percentage, 0) / allDrawdowns.length
        : 0;
        
      // Calculate average drawdown amount (as currency)
      const avgDrawdown = avgDrawdownPercentage > 0 && totalPnL > 0
        ? (avgDrawdownPercentage / 100) * totalPnL
        : 0;
      
      // Calculate hold times more robustly from trade data
      let avgHoldTimeAll = 0;
      let avgHoldTimeWinning = 0;
      let avgHoldTimeLoosing = 0;
      
      try {
        // Log one of the trades to debug
        if (filteredTrades.length > 0) {
          console.log("Sample trade for duration calculation:", filteredTrades[0]);
        }

        // Check all possible duration fields
        const calculateDuration = (trade: any): number => {
          // Try various field formats
          if (trade.duration) {
            // If it's a string like '00:05:30' (HH:MM:SS)
            if (typeof trade.duration === 'string' && trade.duration.includes(':')) {
              const parts = trade.duration.split(':');
              if (parts.length === 3) {
                const hours = parseInt(parts[0], 10);
                const minutes = parseInt(parts[1], 10);
                const seconds = parseInt(parts[2], 10);
                return (hours * 60) + minutes + (seconds / 60);
              }
              return 0;
            }
            
            // If it's a numeric type representing seconds
            if (typeof trade.duration === 'number') {
              return trade.duration / 60; // Convert seconds to minutes
            }
            
            // If it's a string containing a number
            if (typeof trade.duration === 'string') {
              return parseFloat(trade.duration) / 60;
            }
          }

          // Try to calculate from entry/exit timestamps if present
          if (trade.entry_date && trade.exit_date) {
            const entryDate = new Date(trade.entry_date);
            const exitDate = new Date(trade.exit_date);
            if (!isNaN(entryDate.getTime()) && !isNaN(exitDate.getTime())) {
              const durationMs = exitDate.getTime() - entryDate.getTime();
              return durationMs / (1000 * 60); // Convert ms to minutes
            }
          }
          
          // Try other potential duration field names
          if (trade.tradeduration) {
            return typeof trade.tradeduration === 'number' 
              ? trade.tradeduration / 60 
              : parseFloat(String(trade.tradeduration)) / 60;
          }

          // Try boughtTimestamp and soldTimestamp if available
          if (trade.boughtTimestamp && trade.soldTimestamp) {
            const boughtTime = new Date(trade.boughtTimestamp);
            const soldTime = new Date(trade.soldTimestamp);
            if (!isNaN(boughtTime.getTime()) && !isNaN(soldTime.getTime())) {
              const durationMs = soldTime.getTime() - boughtTime.getTime();
              return durationMs / (1000 * 60); // Convert ms to minutes
            }
          }
          
          return 0; // Default if no duration data found
        };
        
        // Calculate for all trades
        const validDurations = filteredTrades
          .map(calculateDuration)
          .filter(duration => duration > 0);
          
        if (validDurations.length > 0) {
          avgHoldTimeAll = validDurations.reduce((sum, duration) => sum + duration, 0) / validDurations.length;
          
          // For winning trades
          const winningDurations = winningTrades
            .map(calculateDuration)
            .filter(duration => duration > 0);
            
          if (winningDurations.length > 0) {
            avgHoldTimeWinning = winningDurations.reduce((sum, duration) => sum + duration, 0) / winningDurations.length;
          }
          
          // For losing trades
          const losingDurations = losingTrades
            .map(calculateDuration)
            .filter(duration => duration > 0);
            
          if (losingDurations.length > 0) {
            avgHoldTimeLoosing = losingDurations.reduce((sum, duration) => sum + duration, 0) / losingDurations.length;
          }
          
          console.log("Calculated hold times:", {
            avgHoldTimeAll,
            avgHoldTimeWinning,
            avgHoldTimeLoosing,
            validDurations: validDurations.length,
            winningDurations: winningDurations?.length,
            losingDurations: losingDurations?.length
          });
        } else {
          console.log("No valid durations found in trades");
        }
      } catch (durationError) {
        console.warn("Error calculating duration metrics:", durationError);
        // Continue without duration metrics
      }
      
      // Calculate average daily volume
      const avgDailyVolume = tradingDays.length > 0 ? filteredTrades.length / tradingDays.length : 0;
      
      // Calculate max consecutive wins/losses
      let currentWinStreak = 0;
      let currentLoseStreak = 0;
      let maxConsecutiveWins = 0;
      let maxConsecutiveLosses = 0;
      
      // Process trades chronologically for streaks
      for (const trade of filteredTrades) {
        const pnl = trade.pnl || 0;
        
        if (pnl > 0) {
          // This is a winning trade
          currentWinStreak++;
          currentLoseStreak = 0;
          maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWinStreak);
        } else if (pnl < 0) {
          // This is a losing trade
          currentLoseStreak++;
          currentWinStreak = 0;
          maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLoseStreak);
        } else {
          // Break-even trade, reset both streaks
          currentWinStreak = 0;
          currentLoseStreak = 0;
        }
      }
      
      // Calculate max consecutive winning/losing days
      let currentWinDayStreak = 0;
      let currentLoseDayStreak = 0;
      let maxConsecutiveWinningDays = 0;
      let maxConsecutiveLosingDays = 0;
      
      // Process days chronologically
      // First sort tradesByDay by date
      const sortedTradesByDay = [...tradesByDay].sort((a, b) => {
        const dateA = new Date(String(a.day));
        const dateB = new Date(String(b.day));
        return dateA.getTime() - dateB.getTime();
      });
      
      for (const dayData of sortedTradesByDay) {
        if (dayData.pnl > 0) {
          // Winning day
          currentWinDayStreak++;
          currentLoseDayStreak = 0;
          maxConsecutiveWinningDays = Math.max(maxConsecutiveWinningDays, currentWinDayStreak);
        } else if (dayData.pnl < 0) {
          // Losing day
          currentLoseDayStreak++;
          currentWinDayStreak = 0;
          maxConsecutiveLosingDays = Math.max(maxConsecutiveLosingDays, currentLoseDayStreak);
        } else {
          // Break-even day, reset both streaks
          currentWinDayStreak = 0;
          currentLoseDayStreak = 0;
        }
      }
      
      // Build stats object manually
      const calculatedStats: TradeStats = {
        ...DEFAULT_STATS,
        totalPnL,
        totalNumberOfTrades: filteredTrades.length,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        breakEvenTrades: breakEvenTrades.length,
        averageWinningTrade: avgWinningTrade,
        averageLosingTrade: avgLosingTrade,
        profitFactor,
        loggedDays: tradingDays.length,
        winningDays,
        losingDays,
        breakEvenDays,
        maxConsecutiveWins,
        maxConsecutiveLosses,
        maxConsecutiveWinningDays,
        maxConsecutiveLosingDays,
        averageDailyPnL: avgDailyPnL,
        largestProfit,
        largestLoss,
        averageTradePnL: filteredTrades.length > 0 ? totalPnL / filteredTrades.length : 0,
        averageDailyVolume: avgDailyVolume,
        averageHoldTimeAll: avgHoldTimeAll,
        averageHoldTimeWinning: avgHoldTimeWinning,
        averageHoldTimeLoosing: avgHoldTimeLoosing,
        maxDrawdown: maxDrawdown,
        maxDrawdownPercentage: maxDrawdownPercentage,
        averageDrawdown: avgDrawdown,
        averageDrawdownPercentage: avgDrawdownPercentage,
        // Calculate winning day PnL and losing day PnL
        averageWinningDayPnL: winningDays > 0 
          ? tradesByDay
            .filter(day => day.pnl > 0)
            .reduce((sum, day) => sum + day.pnl, 0) / winningDays
          : 0,
        averageLosingDayPnL: losingDays > 0 
          ? tradesByDay
            .filter(day => day.pnl < 0)
            .reduce((sum, day) => sum + day.pnl, 0) / losingDays
          : 0,
        largestProfitableDay: winningDays > 0
          ? Math.max(...tradesByDay
              .filter(day => day.pnl > 0)
              .map(day => day.pnl))
          : 0,
        largestLosingDay: losingDays > 0
          ? Math.min(...tradesByDay
              .filter(day => day.pnl < 0)
              .map(day => day.pnl))
          : 0,
        // Calculate trade expectancy
        tradeExpectancy: (winningTrades.length / Math.max(filteredTrades.length, 1)) * avgWinningTrade +
                         (losingTrades.length / Math.max(filteredTrades.length, 1)) * avgLosingTrade
      };
      
      setStats({
        ...calculatedStats,
        filteredTrades // Add the filtered trades to the stats object for use in other components
      });
    } catch (err) {
      console.error("Error fetching trade stats:", err);
      setError("Failed to load trade statistics. Please try again later.");
      toast({
        title: "Error",
        description: "Failed to load trade statistics. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  // Format minutes into "X minutes", "X hours", etc. or "N/A" if 0 or undefined
  const formatMinutes = (minutes: number): string => {
    if (!minutes || isNaN(minutes)) return 'N/A';
    
    // Format time appropriately based on duration
    if (minutes < 1) {
      // Less than a minute, show in seconds
      const seconds = Math.round(minutes * 60);
      return `${seconds} sec${seconds !== 1 ? 's' : ''}`;
    } else if (minutes < 60) {
      // Less than an hour, show in minutes
      const roundedMinutes = Math.round(minutes);
      return `${roundedMinutes} min${roundedMinutes !== 1 ? 's' : ''}`;
    } else {
      // More than an hour, show in hours and minutes
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = Math.round(minutes % 60);
      if (remainingMinutes === 0) {
        return `${hours} hr${hours !== 1 ? 's' : ''}`;
      } else {
        return `${hours}h ${remainingMinutes}m`;
      }
    }
  };

  // Format percentage
  const formatPercentage = (value: number): string => {
    if (value === null || value === undefined || isNaN(value)) return '0.0%';
    return `${value.toFixed(1)}%`;
  };

  // Handle refresh button click
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchTradeStats();
      
      toast({
        title: "Success",
        description: "Reports data refreshed successfully",
      });
    } catch (error) {
      console.error('Error refreshing reports data:', error);
      // The error notification is already handled in fetchTradeStats
    }
  };

  // Handle exporting data to Excel
  const exportToExcel = async () => {
    try {
      // Use the imported XLSX directly
      const wb = XLSX.utils.book_new();
      
      // Format period for the filename
      const periodLabel = {
        all: 'All-Time',
        monthly: 'Last-30-Days',
        weekly: 'Last-7-Days',
        daily: 'Today'
      }[period];

      // Get current date for filename
      const dateStr = new Date().toISOString().split('T')[0];
      
      // Create worksheet with general trading stats
      const mainStats = [
        ['Trading Report', `${periodLabel} (Generated on ${dateStr})`],
        [''],
        ['Summary Statistics', ''],
        ['Total P&L', stats.totalPnL],
        ['Total Trades', stats.totalNumberOfTrades],
        ['Winning Trades', stats.winningTrades],
        ['Losing Trades', stats.losingTrades],
        ['Win Rate %', stats.totalNumberOfTrades > 0 
          ? ((stats.winningTrades / stats.totalNumberOfTrades) * 100).toFixed(1) + '%' 
          : '0%'],
        ['Profit Factor', stats.profitFactor],
        ['Average Trade P&L', stats.averageTradePnL],
        [''],
        ['Daily Statistics', ''],
        ['Trading Days', stats.loggedDays],
        ['Winning Days', stats.winningDays],
        ['Losing Days', stats.losingDays],
        ['Average Daily P&L', stats.averageDailyPnL],
        ['Largest Winning Day', stats.largestProfitableDay],
        ['Largest Losing Day', stats.largestLosingDay],
        [''],
        ['Drawdown Statistics', ''],
        ['Maximum Drawdown', stats.maxDrawdown],
        ['Maximum Drawdown %', stats.maxDrawdownPercentage.toFixed(1) + '%'],
        ['Average Drawdown', stats.averageDrawdown],
        ['Average Drawdown %', stats.averageDrawdownPercentage.toFixed(1) + '%'],
        [''],
        ['Hold Time Statistics', ''],
        ['Average Hold Time (All)', stats.averageHoldTimeAll],
        ['Average Hold Time (Winners)', stats.averageHoldTimeWinning],
        ['Average Hold Time (Losers)', stats.averageHoldTimeLoosing],
      ];

      // Add the summary statistics worksheet
      const wsMain = XLSX.utils.aoa_to_sheet(mainStats);
      XLSX.utils.book_append_sheet(wb, wsMain, 'Trading Summary');
      
      // If there are filtered trades available, add them as a separate sheet
      if (stats.filteredTrades && stats.filteredTrades.length > 0) {
        // Get trade data (filtering out unnecessary properties)
        const tradeData = stats.filteredTrades.map(trade => {
          // Select only the properties we want to export
          const { 
            symbol, 
            entry_date, 
            exit_date, 
            entry_price, 
            exit_price, 
            quantity, 
            pnl, 
            commissions, 
            direction, 
            strategy,
            notes
          } = trade;
          
          return {
            Symbol: symbol,
            'Entry Date': entry_date,
            'Exit Date': exit_date,
            'Entry Price': entry_price,
            'Exit Price': exit_price,
            Quantity: quantity,
            PnL: pnl,
            Commissions: commissions,
            Direction: direction,
            Strategy: strategy,
            Notes: notes
          };
        });

        // Add the trade details worksheet
        const wsTrades = XLSX.utils.json_to_sheet(tradeData);
        XLSX.utils.book_append_sheet(wb, wsTrades, 'Trade Details');
      }
      
      // Write the workbook and trigger download
      XLSX.writeFile(wb, `0nyx-Trading-Report-${periodLabel}-${dateStr}.xlsx`);
      
      // Show success notification
      toast({
        title: "Export Successful",
        description: `Your ${periodLabel} trading report has been downloaded.`,
      });
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast({
        title: "Export Failed",
        description: "Failed to generate Excel report. Please try again later.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="w-full max-w-none py-6 md:py-8 space-y-6 md:space-y-8 px-2">
      {/* Header with title and controls */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20">
            <BarChart2 className="h-8 w-8 text-purple-400" />
          </div>
          <div>
            <h1 
              className="text-3xl md:text-4xl font-bold text-purple-500"
            >
          Trading Reports
        </h1>
            <p 
              className="mt-1"
              style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
            >
              Comprehensive trading performance analysis
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <div 
            className="flex items-center gap-1 rounded-lg p-1 border border-slate-700/50"
            style={{
              backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
            }}
          >
            <Button 
              variant={period === 'all' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setPeriod('all')}
              className={`text-xs md:text-sm min-h-[36px] md:min-h-0 ${
                period === 'all' 
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white' 
                  : 'hover:bg-slate-700/50'
              }`}
              style={{
                color: period === 'all' ? 'white' : theme === 'dark' ? 'rgb(203 213 225)' : 'rgb(55 65 81)',
              }}
              onMouseEnter={(e) => {
                if (period !== 'all') {
                  e.currentTarget.style.color = theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)';
                }
              }}
              onMouseLeave={(e) => {
                if (period !== 'all') {
                  e.currentTarget.style.color = theme === 'dark' ? 'rgb(203 213 225)' : 'rgb(55 65 81)';
                }
              }}
            >
              All Time
            </Button>
            <Button 
              variant={period === 'monthly' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setPeriod('monthly')}
              className={`text-xs md:text-sm min-h-[36px] md:min-h-0 ${
                period === 'monthly' 
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white' 
                  : 'hover:bg-slate-700/50'
              }`}
              style={{
                color: period === 'monthly' ? 'white' : theme === 'dark' ? 'rgb(203 213 225)' : 'rgb(55 65 81)',
              }}
              onMouseEnter={(e) => {
                if (period !== 'monthly') {
                  e.currentTarget.style.color = theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)';
                }
              }}
              onMouseLeave={(e) => {
                if (period !== 'monthly') {
                  e.currentTarget.style.color = theme === 'dark' ? 'rgb(203 213 225)' : 'rgb(55 65 81)';
                }
              }}
            >
              Monthly
            </Button>
            <Button 
              variant={period === 'weekly' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setPeriod('weekly')}
              className={`text-xs md:text-sm min-h-[36px] md:min-h-0 ${
                period === 'weekly' 
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white' 
                  : 'hover:bg-slate-700/50'
              }`}
              style={{
                color: period === 'weekly' ? 'white' : theme === 'dark' ? 'rgb(203 213 225)' : 'rgb(55 65 81)',
              }}
              onMouseEnter={(e) => {
                if (period !== 'weekly') {
                  e.currentTarget.style.color = theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)';
                }
              }}
              onMouseLeave={(e) => {
                if (period !== 'weekly') {
                  e.currentTarget.style.color = theme === 'dark' ? 'rgb(203 213 225)' : 'rgb(55 65 81)';
                }
              }}
            >
              Weekly
            </Button>
            <Button 
              variant={period === 'daily' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setPeriod('daily')}
              className={`text-xs md:text-sm min-h-[36px] md:min-h-0 ${
                period === 'daily' 
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white' 
                  : 'hover:bg-slate-700/50'
              }`}
              style={{
                color: period === 'daily' ? 'white' : theme === 'dark' ? 'rgb(203 213 225)' : 'rgb(55 65 81)',
              }}
              onMouseEnter={(e) => {
                if (period !== 'daily') {
                  e.currentTarget.style.color = theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)';
                }
              }}
              onMouseLeave={(e) => {
                if (period !== 'daily') {
                  e.currentTarget.style.color = theme === 'dark' ? 'rgb(203 213 225)' : 'rgb(55 65 81)';
                }
              }}
            >
              Daily
            </Button>
          </div>
          <Button 
            onClick={handleRefresh} 
            disabled={refreshing || loading}
            variant="outline"
            className="items-center gap-2 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20 border-slate-700/50 hover:bg-slate-700/50 min-h-[36px] md:min-h-0"
            style={{
              backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
              color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)';
            }}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={exportToExcel}
            disabled={loading || stats.totalNumberOfTrades === 0}
            variant="outline"
            className="items-center gap-2 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20 border-slate-700/50 hover:bg-slate-700/50 min-h-[36px] md:min-h-0"
            style={{
              backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
              color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)';
            }}
          >
            <Download className="h-4 w-4" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Main stats grid */}
      {loading ? (
        <LoadingSpinner 
          message="Loading your trading statistics..." 
          subMessage="Please wait while we analyze your trading data"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Total P&L Card */}
          <Card 
            className="w-full mb-8 overflow-hidden border border-gray-200 dark:border-slate-700/50 hover:border-blue-500/30 dark:hover:border-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-500 group backdrop-blur-sm"
            style={{
              backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)',
              backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-4 px-6 pt-6">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors duration-300">
                    <DollarSign className="h-5 w-5 text-blue-400 dark:text-blue-400" />
                  </div>
                  <CardTitle 
                    className="text-lg font-semibold"
                    style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
                  >
                  Total P&L
              </CardTitle>
                </div>
              </div>
              <div className={`text-3xl font-bold ${stats.totalPnL >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-purple-600 dark:text-purple-400'}`}>
                  {formatCurrency(stats.totalPnL)}
              </div>
            </CardHeader>
          </Card>

          {/* Average Daily Volume */}
          <Card 
            className="w-full mb-8 overflow-hidden border border-slate-200/50 dark:border-slate-700/50 hover:border-emerald-500/30 dark:hover:border-emerald-500/30 hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-500 group backdrop-blur-sm"
            style={{
              backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)',
              backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-4 px-6 pt-6">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors duration-300">
                    <BarChart2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <CardTitle 
                    className="text-lg font-semibold"
                    style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
                  >
                  Average Daily Volume
              </CardTitle>
                </div>
              </div>
              <div className="text-3xl font-bold text-emerald-400">
                {stats.averageDailyVolume.toFixed(2)}
              </div>
            </CardHeader>
          </Card>

          {/* Average Winning Trade */}
          <Card 
            className="w-full mb-8 overflow-hidden border border-gray-200 dark:border-slate-700/50 hover:border-blue-500/30 dark:hover:border-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-500 group backdrop-blur-sm"
            style={{
              backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)',
              backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-4 px-6 pt-6">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors duration-300">
                    <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <CardTitle 
                    className="text-lg font-semibold"
                    style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
                  >
                  Average Winning Trade
              </CardTitle>
                </div>
              </div>
              <div className="text-3xl font-bold text-blue-400">
                  {formatCurrency(stats.averageWinningTrade)}
              </div>
            </CardHeader>
          </Card>

          {/* Average Losing Trade */}
          <Card 
            className="w-full mb-8 overflow-hidden border border-slate-200/50 dark:border-slate-700/50 hover:border-purple-500/30 dark:hover:border-purple-500/30 hover:shadow-2xl hover:shadow-purple-500/10 transition-all duration-500 group backdrop-blur-sm"
            style={{
              backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)',
              backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-4 px-6 pt-6">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors duration-300">
                    <TrendingDown className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <CardTitle 
                    className="text-lg font-semibold"
                    style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
                  >
                  Average Losing Trade
                  </CardTitle>
                </div>
              </div>
              <div className="text-3xl font-bold text-purple-400">
                {formatCurrency(stats.averageLosingTrade)}
              </div>
            </CardHeader>
            <CardContent className="px-2 sm:px-4 py-4">
              {/* Data Visualization Bars */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span 
                    className="text-xs"
                    style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
                  >
                    Loss Distribution
                </span>
                  <span 
                    className="text-xs"
                    style={{ color: theme === 'dark' ? 'rgb(107 114 128)' : 'rgb(75 85 99)' }}
                  >
                    {stats.losingTrades} Losing Trades
                  </span>
                </div>
                
                {/* Visual Bar Chart - Loss Magnitude */}
                <div className="space-y-2">
                  <div 
                    className="flex h-4 rounded-lg overflow-hidden"
                    style={{
                      backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.5)' : 'rgb(229 231 235)',
                    }}
                  >
                    <div 
                      className="bg-gradient-to-r from-purple-600 to-purple-400 flex items-center justify-center transition-all duration-500"
                      style={{ 
                        width: stats.averageLosingTrade !== 0 ? `${Math.min(Math.abs(stats.averageLosingTrade) / 1000 * 100, 100)}%` : '0%' 
                      }}
                    >
                      {Math.abs(stats.averageLosingTrade) > 50 && (
                        <span className="text-xs font-bold text-white">
                  {formatCurrency(stats.averageLosingTrade)}
                </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Loss Scale Indicator */}
                  <div 
                    className="flex justify-between text-xs"
                    style={{ color: theme === 'dark' ? 'rgb(107 114 128)' : 'rgb(75 85 99)' }}
                  >
                    <span>$0</span>
                    <span>${Math.abs(stats.averageLosingTrade).toFixed(0)}</span>
                    <span>$1000+</span>
                  </div>
                </div>
                
                {/* Additional Metrics */}
                <div className="grid grid-cols-2 gap-3">
                  <div 
                    className="rounded-lg p-3 border border-slate-700/50"
                    style={{
                      backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                    }}
                  >
                    <p 
                      className="text-xs mb-1"
                      style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
                    >
                      Total Losses
                    </p>
                    <p className="text-lg font-bold text-purple-400">
                      {formatCurrency(stats.losingTrades * stats.averageLosingTrade)}
                    </p>
                  </div>
                  <div 
                    className="rounded-lg p-3 border border-slate-700/50"
                    style={{
                      backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                    }}
                  >
                    <p 
                      className="text-xs mb-1"
                      style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
                    >
                      Loss Rate
                    </p>
                    <p className="text-lg font-bold text-purple-400">
                      {stats.totalNumberOfTrades > 0 ? ((stats.losingTrades / stats.totalNumberOfTrades) * 100).toFixed(1) : 0}%
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Number of Trades */}
          <Card 
            className="w-full mb-8 overflow-hidden border border-slate-200/50 dark:border-slate-700/50 hover:border-cyan-500/30 dark:hover:border-cyan-500/30 hover:shadow-2xl hover:shadow-cyan-500/10 transition-all duration-500 group backdrop-blur-sm"
            style={{
              backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)',
              backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-4 px-6 pt-6">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors duration-300">
                    <BarChart2 className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Total Number of Trades</CardTitle>
                </div>
              </div>
              <div className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">
                {stats.totalNumberOfTrades}
              </div>
            </CardHeader>
            <CardContent className="px-2 sm:px-4 py-4">
              {/* Data Visualization Bars */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span 
                    className="text-xs"
                    style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
                  >
                    Trade Distribution
                  </span>
                  <span 
                    className="text-xs"
                    style={{ color: theme === 'dark' ? 'rgb(107 114 128)' : 'rgb(75 85 99)' }}
                  >
                    {stats.loggedDays > 0 ? (stats.totalNumberOfTrades / stats.loggedDays).toFixed(1) : 0} trades/day
                  </span>
                </div>
                
                {/* Visual Bar Chart - Trade Breakdown */}
                <div 
                  className="flex h-6 rounded-lg overflow-hidden"
                  style={{
                    backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.5)' : 'rgb(229 231 235)',
                  }}
                >
                  {/* Winning Trades Bar */}
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-blue-400 flex items-center justify-center transition-all duration-500"
                    style={{ 
                      width: stats.totalNumberOfTrades > 0 ? `${(stats.winningTrades / stats.totalNumberOfTrades) * 100}%` : '0%' 
                    }}
                  >
                    {stats.winningTrades > 0 && (
                      <span className="text-xs font-bold text-white">
                        {stats.winningTrades}
                      </span>
                    )}
                  </div>
                  
                  {/* Losing Trades Bar */}
                  <div 
                    className="bg-gradient-to-r from-purple-500 to-purple-400 flex items-center justify-center transition-all duration-500"
                    style={{ 
                      width: stats.totalNumberOfTrades > 0 ? `${(stats.losingTrades / stats.totalNumberOfTrades) * 100}%` : '0%' 
                    }}
                  >
                    {stats.losingTrades > 0 && (
                      <span className="text-xs font-bold text-white">
                        {stats.losingTrades}
                      </span>
                    )}
                  </div>
                  
                  {/* Break Even Trades Bar */}
                  <div 
                    className="bg-gradient-to-r from-slate-500 to-slate-400 flex items-center justify-center transition-all duration-500"
                    style={{ 
                      width: stats.totalNumberOfTrades > 0 ? `${(stats.breakEvenTrades / stats.totalNumberOfTrades) * 100}%` : '0%' 
                    }}
                  >
                    {stats.breakEvenTrades > 0 && (
                      <span className="text-xs font-bold text-white">
                        {stats.breakEvenTrades}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Additional Metrics */}
                <div className="grid grid-cols-3 gap-3">
                  <div 
                    className="rounded-lg p-3 border border-slate-700/50"
                    style={{
                      backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                    }}
                  >
                    <p 
                      className="text-xs mb-1"
                      style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
                    >
                      Winning
                    </p>
                    <p className="text-lg font-bold text-blue-400">{stats.winningTrades}</p>
                  </div>
                  <div 
                    className="rounded-lg p-3 border border-slate-700/50"
                    style={{
                      backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                    }}
                  >
                    <p 
                      className="text-xs mb-1"
                      style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
                    >
                      Losing
                    </p>
                    <p className="text-lg font-bold text-purple-400">{stats.losingTrades}</p>
                  </div>
                  <div 
                    className="rounded-lg p-3 border border-slate-700/50"
                    style={{
                      backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                    }}
                  >
                    <p 
                      className="text-xs mb-1"
                      style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
                    >
                      Break Even
                    </p>
                    <p className="text-lg font-bold text-slate-400">{stats.breakEvenTrades}</p>
                  </div>
                </div>
                
                {/* Legend */}
                <div className="flex justify-between text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                    <span className="text-slate-400">Wins</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                    <span className="text-slate-400">Losses</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                    <span className="text-slate-400">Break Even</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Win/Loss Ratio */}
          <Card 
            className="w-full mb-8 overflow-hidden border border-slate-200/50 dark:border-slate-700/50 hover:border-yellow-500/30 dark:hover:border-yellow-500/30 hover:shadow-2xl hover:shadow-yellow-500/10 transition-all duration-500 group backdrop-blur-sm"
            style={{
              backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)',
              backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-4 px-6 pt-6">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-yellow-500/10 group-hover:bg-yellow-500/20 transition-colors duration-300">
                    <Zap className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Win/Loss Rate</CardTitle>
                </div>
              </div>
              <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                  {stats.winningTrades} / {stats.losingTrades}
              </div>
            </CardHeader>
            <CardContent className="px-2 sm:px-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div 
                  className="rounded-lg p-4 border border-slate-700/50"
                  style={{
                    backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                  }}
                >
                  <p className="text-xs text-slate-400 mb-2">Win Rate</p>
                  <p className="text-2xl font-bold text-blue-400">
                    {stats.totalNumberOfTrades > 0 
                      ? ((stats.winningTrades / stats.totalNumberOfTrades) * 100).toFixed(1) 
                      : 0}%
                  </p>
                </div>
                <div 
                  className="rounded-lg p-4 border border-slate-700/50"
                  style={{
                    backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                  }}
                >
                  <p className="text-xs text-slate-400 mb-2">Break Even</p>
                  <p className="text-2xl font-bold text-slate-400">
                    {stats.breakEvenTrades}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Trading Days */}
          <Card 
            className="w-full mb-8 overflow-hidden border border-slate-200/50 dark:border-slate-700/50 hover:border-indigo-500/30 dark:hover:border-indigo-500/30 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-500 group backdrop-blur-sm"
            style={{
              backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)',
              backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-4 px-6 pt-6">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-indigo-500/10 group-hover:bg-indigo-500/20 transition-colors duration-300">
                    <Calendar className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Total Trading Days</CardTitle>
                </div>
              </div>
              <div className="text-3xl font-bold text-indigo-400">
                {stats.loggedDays}
              </div>
            </CardHeader>
            <CardContent className="px-2 sm:px-4 py-4">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div 
                  className="rounded-lg p-4 border border-slate-700/50"
                  style={{
                    backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                  }}
                >
                  <p className="text-xs text-slate-400 mb-2">Winning Days</p>
                  <p className="text-2xl font-bold text-blue-400">{stats.winningDays}</p>
                </div>
                <div 
                  className="rounded-lg p-4 border border-slate-700/50"
                  style={{
                    backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                  }}
                >
                  <p className="text-xs text-slate-400 mb-2">Losing Days</p>
                  <p className="text-2xl font-bold text-purple-400">{stats.losingDays}</p>
                </div>
                <div 
                  className="rounded-lg p-4 border border-slate-700/50"
                  style={{
                    backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                  }}
                >
                  <p className="text-xs text-slate-400 mb-2">Break Even</p>
                  <p className="text-2xl font-bold text-slate-400">{stats.breakEvenDays}</p>
                </div>
              </div>
              
              {/* Data Visualization Bars */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Day Distribution</span>
                  <span className="text-xs text-slate-500">
                    {stats.loggedDays > 0 ? ((stats.winningDays / stats.loggedDays) * 100).toFixed(1) : 0}% Win Rate
                  </span>
                </div>
                
                {/* Visual Bar Chart */}
                <div 
                  className="flex h-6 rounded-lg overflow-hidden"
                  style={{
                    backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.5)' : 'rgb(229 231 235)',
                  }}
                >
                  {/* Winning Days Bar */}
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-blue-400 flex items-center justify-center transition-all duration-500"
                    style={{ 
                      width: stats.loggedDays > 0 ? `${(stats.winningDays / stats.loggedDays) * 100}%` : '0%' 
                    }}
                  >
                    {stats.winningDays > 0 && (
                      <span className="text-xs font-bold text-white">
                        {stats.winningDays}
                      </span>
                    )}
                  </div>
                  
                  {/* Losing Days Bar */}
                  <div 
                    className="bg-gradient-to-r from-purple-500 to-purple-400 flex items-center justify-center transition-all duration-500"
                    style={{ 
                      width: stats.loggedDays > 0 ? `${(stats.losingDays / stats.loggedDays) * 100}%` : '0%' 
                    }}
                  >
                    {stats.losingDays > 0 && (
                      <span className="text-xs font-bold text-white">
                        {stats.losingDays}
                      </span>
                    )}
                  </div>
                  
                  {/* Break Even Days Bar */}
                  <div 
                    className="bg-gradient-to-r from-slate-500 to-slate-400 flex items-center justify-center transition-all duration-500"
                    style={{ 
                      width: stats.loggedDays > 0 ? `${(stats.breakEvenDays / stats.loggedDays) * 100}%` : '0%' 
                    }}
                  >
                    {stats.breakEvenDays > 0 && (
                      <span className="text-xs font-bold text-white">
                        {stats.breakEvenDays}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Legend */}
                <div className="flex justify-between text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                    <span className="text-slate-400">Wins</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                    <span className="text-slate-400">Losses</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                    <span className="text-slate-400">Break Even</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Max Consecutive Stats */}
          <Card 
            className="w-full mb-8 overflow-hidden border border-gray-200 dark:border-slate-700/50 hover:border-blue-500/30 dark:hover:border-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-500 group backdrop-blur-sm"
            style={{
              backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)',
              backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-4 px-6 pt-6">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors duration-300">
                    <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Consecutive Stats</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-2 sm:px-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div 
                  className="rounded-lg p-4 border border-slate-700/50"
                  style={{
                    backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                  }}
                >
                  <p className="text-xs text-slate-400 mb-2">Max Consecutive Wins</p>
                  <p className="text-2xl font-bold text-blue-400">{stats.maxConsecutiveWins}</p>
                </div>
                <div 
                  className="rounded-lg p-4 border border-slate-700/50"
                  style={{
                    backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                  }}
                >
                  <p className="text-xs text-slate-400 mb-2">Max Consecutive Losses</p>
                  <p className="text-2xl font-bold text-purple-400">{stats.maxConsecutiveLosses}</p>
                </div>
                <div 
                  className="rounded-lg p-4 border border-slate-700/50"
                  style={{
                    backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                  }}
                >
                  <p className="text-xs text-slate-400 mb-2">Max Consecutive Winning Days</p>
                  <p className="text-2xl font-bold text-blue-400">{stats.maxConsecutiveWinningDays}</p>
                </div>
                <div 
                  className="rounded-lg p-4 border border-slate-700/50"
                  style={{
                    backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                  }}
                >
                  <p className="text-xs text-slate-400 mb-2">Max Consecutive Losing Days</p>
                  <p className="text-2xl font-bold text-purple-400">{stats.maxConsecutiveLosingDays}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Daily P&L Stats */}
          <Card 
            className="w-full mb-8 overflow-hidden border border-slate-200/50 dark:border-slate-700/50 hover:border-emerald-500/30 dark:hover:border-emerald-500/30 hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-500 group backdrop-blur-sm"
            style={{
              backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)',
              backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-4 px-6 pt-6">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors duration-300">
                    <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Daily P&L Stats</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-2 sm:px-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div 
                  className="rounded-lg p-4 border border-slate-700/50"
                  style={{
                    backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                  }}
                >
                  <p className="text-xs text-slate-400 mb-2">Average Daily P&L</p>
                  <p className={`text-2xl font-bold ${stats.averageDailyPnL >= 0 ? 'text-blue-400' : 'text-purple-400'}`}>
                    {formatCurrency(stats.averageDailyPnL)}
                  </p>
                </div>
                <div 
                  className="rounded-lg p-4 border border-slate-700/50"
                  style={{
                    backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                  }}
                >
                  <p className="text-xs text-slate-400 mb-2">Average Winning Day</p>
                  <p className="text-2xl font-bold text-blue-400">
                    {formatCurrency(stats.averageWinningDayPnL)}
                  </p>
                </div>
                <div 
                  className="rounded-lg p-4 border border-slate-700/50"
                  style={{
                    backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                  }}
                >
                  <p className="text-xs text-slate-400 mb-2">Average Losing Day</p>
                  <p className="text-2xl font-bold text-purple-400">
                    {formatCurrency(stats.averageLosingDayPnL)}
                  </p>
                </div>
                <div 
                  className="rounded-lg p-4 border border-slate-700/50"
                  style={{
                    backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                  }}
                >
                  <p className="text-xs text-slate-400 mb-2">Largest Profit Day</p>
                  <p className="text-2xl font-bold text-blue-400">
                    {formatCurrency(stats.largestProfitableDay)}
                  </p>
                </div>
                <div 
                  className="rounded-lg p-4 border border-slate-700/50 col-span-2"
                  style={{
                    backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                  }}
                >
                  <p className="text-xs text-slate-400 mb-2">Largest Loss Day</p>
                  <p className="text-2xl font-bold text-purple-400">
                    {formatCurrency(stats.largestLosingDay)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cumulative P&L Chart */}
          <Card 
            className="border border-gray-200 dark:border-slate-700/50 hover:shadow-lg hover:scale-[1.01] hover:shadow-purple-500/10 hover:border-purple-500/30 transition-all duration-300 lg:col-span-2 flex flex-col"
            style={{
              backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)',
              backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
            }}
          >
            <CardHeader className="pb-2 flex-shrink-0">
              <div className="flex items-center justify-between">
              <CardTitle 
                className="flex items-center gap-2 text-xl"
                style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
              >
                <TrendingUp className="h-5 w-5 text-blue-500" />
                Cumulative P&L Chart
              </CardTitle>
                {stats.filteredTrades && stats.filteredTrades.length > 0 && (() => {
                  const currentValue = stats.totalPnL;
                  const isPositive = currentValue > 0;
                  const isNegative = currentValue < 0;
                  
                  return (
                    <div className="flex items-center gap-2">
                      <div 
                        className="text-sm"
                        style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
                      >
                        Total P&L:
                      </div>
                      <div className={`text-lg font-bold ${isPositive ? 'text-blue-400' : 'text-purple-400'}`}>
                        {formatCurrency(currentValue)}
                      </div>
                      <div className={`text-sm font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`} style={{ filter: 'url(#glowText)' }}>
                        {isPositive ? '(Profitable)' : isNegative ? '(Loss)' : '(Break Even)'}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-0 flex-1 min-h-0">
              <div className="h-full w-full" style={{ minHeight: '1200px' }}>
                <CumulativePnLChartReports trades={stats.filteredTrades} />
              </div>
            </CardContent>
          </Card>

          {/* Advanced Profitability Metrics Card */}
          <Card 
            className="w-full mb-8 overflow-hidden border border-slate-200/50 dark:border-slate-700/50 hover:border-emerald-500/30 dark:hover:border-emerald-500/30 hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-500 group backdrop-blur-sm lg:col-span-1"
            style={{
              backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)',
              backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-4 px-6 pt-6">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors duration-300">
                    <BarChart2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Advanced Profitability Metrics</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-2 sm:px-4 py-4">
              <div className="grid grid-cols-1 gap-6">
                {/* Core Profitability Metrics */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-emerald-400 mb-3">Core Metrics</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div 
                      className="rounded-lg p-3 border border-slate-700/50 dark:border-slate-700/50 border-slate-200/50"
                      style={{
                        backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                      }}
                    >
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Profit Factor</p>
                      <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{stats.profitFactor.toFixed(2)}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-500">Gross Profit / Gross Loss</p>
                    </div>
                    
                    <div 
                      className="rounded-lg p-3 border border-slate-700/50 dark:border-slate-700/50 border-slate-200/50"
                      style={{
                        backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                      }}
                    >
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Win Rate</p>
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {stats.totalNumberOfTrades > 0 ? ((stats.winningTrades / stats.totalNumberOfTrades) * 100).toFixed(1) : 0}%
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-500">Winning Trades %</p>
                </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div 
                      className="rounded-lg p-3 border border-slate-700/50 dark:border-slate-700/50 border-slate-200/50"
                      style={{
                        backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                      }}
                    >
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Average Trade</p>
                      <p className={`text-lg font-bold ${stats.averageTradePnL >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-purple-600 dark:text-purple-400'}`}>
                    {formatCurrency(stats.averageTradePnL)}
                  </p>
                      <p className="text-xs text-slate-500 dark:text-slate-500">Avg P&L per Trade</p>
                </div>
                    
                    <div 
                      className="rounded-lg p-3 border border-slate-700/50 dark:border-slate-700/50 border-slate-200/50"
                      style={{
                        backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                      }}
                    >
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Trade Expectancy</p>
                      <p className={`text-lg font-bold ${stats.tradeExpectancy >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-purple-600 dark:text-purple-400'}`}>
                    {formatCurrency(stats.tradeExpectancy)}
                  </p>
                      <p className="text-xs text-slate-500 dark:text-slate-500">Expected Value</p>
                </div>
                  </div>
                </div>

                {/* Risk Metrics */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-purple-400 mb-3">Risk Analysis</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div 
                    className="rounded-lg p-3 border border-slate-700/50"
                    style={{
                      backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                    }}
                  >
                      <p className="text-xs text-slate-400 mb-1">Max Drawdown</p>
                      <p className="text-lg font-bold text-red-400">{formatCurrency(stats.maxDrawdown)}</p>
                      <p className="text-xs text-slate-500">Largest Loss</p>
                    </div>
                    
                    <div 
                    className="rounded-lg p-3 border border-slate-700/50"
                    style={{
                      backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                    }}
                  >
                      <p className="text-xs text-slate-400 mb-1">Max DD %</p>
                      <p className="text-lg font-bold text-red-400">{stats.maxDrawdownPercentage.toFixed(1)}%</p>
                      <p className="text-xs text-slate-500">Peak to Trough</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div 
                    className="rounded-lg p-3 border border-slate-700/50"
                    style={{
                      backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                    }}
                  >
                      <p className="text-xs text-slate-400 mb-1">Avg Drawdown</p>
                      <p className="text-lg font-bold text-orange-400">{formatCurrency(stats.averageDrawdown)}</p>
                      <p className="text-xs text-slate-500">Average Loss</p>
                    </div>
                    
                    <div 
                    className="rounded-lg p-3 border border-slate-700/50"
                    style={{
                      backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                    }}
                  >
                      <p className="text-xs text-slate-400 mb-1">Avg DD %</p>
                      <p className="text-lg font-bold text-orange-400">{stats.averageDrawdownPercentage.toFixed(1)}%</p>
                      <p className="text-xs text-slate-500">Average Loss %</p>
                    </div>
                  </div>
                </div>

                {/* Performance Metrics */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-blue-400 mb-3">Performance</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div 
                    className="rounded-lg p-3 border border-slate-700/50"
                    style={{
                      backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                    }}
                  >
                      <p className="text-xs text-slate-400 mb-1">Largest Win</p>
                      <p className="text-lg font-bold text-green-400">{formatCurrency(stats.largestProfit)}</p>
                      <p className="text-xs text-slate-500">Best Trade</p>
                    </div>
                    
                    <div 
                    className="rounded-lg p-3 border border-slate-700/50"
                    style={{
                      backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                    }}
                  >
                      <p className="text-xs text-slate-400 mb-1">Largest Loss</p>
                      <p className="text-lg font-bold text-red-400">{formatCurrency(stats.largestLoss)}</p>
                      <p className="text-xs text-slate-500">Worst Trade</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div 
                    className="rounded-lg p-3 border border-slate-700/50"
                    style={{
                      backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                    }}
                  >
                      <p className="text-xs text-slate-400 mb-1">Avg Win</p>
                      <p className="text-lg font-bold text-green-400">{formatCurrency(stats.averageWinningTrade)}</p>
                      <p className="text-xs text-slate-500">Per Winning Trade</p>
                    </div>
                    
                    <div 
                    className="rounded-lg p-3 border border-slate-700/50"
                    style={{
                      backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                    }}
                  >
                      <p className="text-xs text-slate-400 mb-1">Avg Loss</p>
                      <p className="text-lg font-bold text-red-400">{formatCurrency(stats.averageLosingTrade)}</p>
                      <p className="text-xs text-slate-500">Per Losing Trade</p>
                    </div>
                  </div>
                </div>

                {/* Cost Analysis */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-yellow-400 mb-3">Cost Analysis</h4>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div 
                    className="rounded-lg p-3 border border-slate-700/50"
                    style={{
                      backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                    }}
                  >
                      <p className="text-xs text-slate-400 mb-1">Total Expenses</p>
                      <p className="text-lg font-bold text-yellow-400">
                    {formatCurrency(stats.totalCommissions + stats.totalFees + stats.totalSwap)}
                  </p>
                      <p className="text-xs text-slate-500">Commissions + Fees + Swaps</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Average Hold Times */}
          <Card 
            className="w-full mb-8 overflow-hidden border border-slate-200/50 dark:border-slate-700/50 hover:border-cyan-500/30 dark:hover:border-cyan-500/30 hover:shadow-2xl hover:shadow-cyan-500/10 transition-all duration-500 group backdrop-blur-sm"
            style={{
              backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)',
              backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-4 px-6 pt-6">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors duration-300">
                    <Clock className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Average Hold Times</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-2 sm:px-4 py-4">
              <div className="space-y-4">
                <div 
                  className="rounded-lg p-4 border border-slate-700/50"
                  style={{
                    backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                  }}
                >
                  <p className="text-xs text-slate-400 mb-2">All Trades</p>
                  <p className="text-2xl font-bold text-cyan-400">
                    {formatMinutes(stats.averageHoldTimeAll)}
                  </p>
                </div>
                <div 
                  className="rounded-lg p-4 border border-slate-700/50"
                  style={{
                    backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                  }}
                >
                  <p className="text-xs text-slate-400 mb-2">Winning Trades</p>
                  <p className="text-2xl font-bold text-blue-400">
                    {formatMinutes(stats.averageHoldTimeWinning)}
                  </p>
                </div>
                <div 
                  className="rounded-lg p-4 border border-slate-700/50"
                  style={{
                    backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                  }}
                >
                  <p className="text-xs text-slate-400 mb-2">Losing Trades</p>
                  <p className="text-2xl font-bold text-purple-400">
                    {formatMinutes(stats.averageHoldTimeLoosing)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>


          {/* Drawdown Chart */}
          <Card 
            className="border border-gray-200 dark:border-slate-700/50 hover:shadow-lg hover:scale-[1.01] hover:shadow-purple-500/10 hover:border-purple-500/30 transition-all duration-300 lg:col-span-2 flex flex-col"
            style={{
              backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)',
              backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
            }}
          >
            <CardHeader className="pb-2 flex-shrink-0">
              <div className="flex items-center justify-between">
              <CardTitle 
                className="flex items-center gap-2 text-xl"
                style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
              >
                <TrendingDown className="h-5 w-5 text-purple-500" />
                Drawdown Chart
              </CardTitle>
                {stats.filteredTrades && stats.filteredTrades.length > 0 && (() => {
                  // Show max drawdown percentage (this is already calculated in stats.maxDrawdownPercentage)
                  const maxDrawdown = stats.maxDrawdown;
                  const maxDrawdownPercentage = stats.maxDrawdownPercentage;
                  
                  return (
                    <div className="flex items-center gap-2">
                      <div 
                        className="text-sm"
                        style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
                      >
                        Max Drawdown:
                </div>
                      <div className="text-lg font-bold text-purple-400">
                        {formatCurrency(maxDrawdown)}
                </div>
                      <div className="text-sm font-medium text-red-400" style={{ filter: 'url(#glowText)' }}>
                        ({maxDrawdownPercentage.toFixed(1)}%)
                </div>
                </div>
                  );
                })()}
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-0 flex-1 min-h-0">
              <div className="h-full w-full" style={{ minHeight: '500px' }}>
                <DrawdownChart trades={stats.filteredTrades} showCard={false} />
              </div>
            </CardContent>
          </Card>

        </div>
      )}

      {/* Add SVG filters for glow effects */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <filter id="glowText" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
      </svg>

      {/* Add a custom style tag for animations */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease forwards;
        }
      `}</style>
    </div>
  );
} 
