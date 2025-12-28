import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useTheme } from '@/components/ThemeProvider';
import { PerformanceByDurationChart } from '@/components/charts/PerformanceByDurationChart';
import { WinLossChart } from '@/components/charts/WinLossChart';
import { TradeDurationPnLChart } from '@/components/charts/TradeDurationPnLChart';
import { MetricsComparisonChart } from '@/components/analytics/MetricsComparisonChart';
import { ProfitFactorChart } from '@/components/charts/ProfitFactorChart';
import { WinRateChart } from '@/components/charts/WinRateChart';
import { DrawdownPnLChart } from '@/components/charts/DrawdownPnLChart';
import { TradingBubbleMap } from '@/components/charts/TradingBubbleMap';
import { TradingScatterPlot } from '@/components/charts/TradingScatterPlot';
import { TradingDotChart } from '@/components/charts/TradingDotChart';
import { useToast } from '@/components/ui/use-toast';
import { ProfitFactorBarChart } from '@/components/charts/ProfitFactorBarChart';
import { WinLossDistributionChart } from '@/components/charts/WinLossDistributionChart';
import { AverageWinLossChart } from '@/components/charts/AverageWinLossChart';
import { MonthlyWinLossBarChart } from '@/components/charts/MonthlyWinLossBarChart';
import { MonthlyWinLossAreaChart } from '@/components/charts/MonthlyWinLossAreaChart';
import { WinRateAreaChart } from '@/components/charts/WinRateAreaChart';
import SharpeRatioScatterPlot from '@/components/charts/SharpeRatioScatterPlot';
import SharpeSortinoBarChart from '@/components/charts/SharpeSortinoBarChart';
import ExpectancyByTypeBarChart from '@/components/charts/ExpectancyByTypeBarChart';
import RollingExpectancyLineChart from '@/components/charts/RollingExpectancyLineChart';
import TradeFrequencyHistogram from '@/components/charts/TradeFrequencyHistogram';
import { DailyPnLChart } from '@/components/charts/DailyPnLChart';

export default function Performance() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trades, setTrades] = useState<any[]>([]);
  const [allTrades, setAllTrades] = useState<any[]>([]);
  const [tradeTypeFilter, setTradeTypeFilter] = useState<'all' | 'futures' | 'solana'>('all');
  const [isFetching, setIsFetching] = useState(false);
  const { toast } = useToast();
  const supabase = createClient();

  const fetchData = async () => {
    // Prevent multiple simultaneous requests
    if (isFetching) {
      console.log('Performance fetchData already in progress, skipping...');
      return;
    }

    setIsFetching(true);
    try {
      setRefreshing(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('No authenticated user found');
        return;
      }

      // Fetch futures trades
      const { data: tradesData, error: tradesError } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .order('entry_date', { ascending: true });

      if (tradesError) {
        throw tradesError;
      }

      // Fetch Solana DEX trades
      const { data: dexTradesData, error: dexTradesError } = await supabase
        .from('dex_trades')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: true });

      // Don't throw on dex_trades error - table might not exist or have no data
      if (dexTradesError) {
        console.warn('Error fetching DEX trades:', dexTradesError);
      }

      // Combine trades and tag them by type
      const futuresTrades = (tradesData || []).map(trade => ({
        ...trade,
        trade_type: 'futures' as const,
        // Map futures trade fields to common format
        entry_date: trade.entry_date || trade.created_at,
        pnl: trade.pnl || 0,
        symbol: trade.symbol || 'N/A'
      }));

      // Map DEX trades to common format
      const solanaTrades = (dexTradesData || []).map(trade => ({
        ...trade,
        trade_type: 'solana' as const,
        // Map DEX trade fields to common format
        entry_date: trade.timestamp || trade.created_at,
        pnl: (trade.amount_out || 0) - (trade.amount_in || 0), // Simple PnL calculation
        symbol: `${trade.token_in || 'N/A'}/${trade.token_out || 'N/A'}`,
        // Preserve DEX-specific fields
        dex: trade.dex,
        token_in: trade.token_in,
        token_out: trade.token_out,
        amount_in: trade.amount_in,
        amount_out: trade.amount_out
      }));

      // Combine and sort by date
      const combinedTrades = [...futuresTrades, ...solanaTrades].sort((a, b) => {
        const dateA = new Date(a.entry_date || 0).getTime();
        const dateB = new Date(b.entry_date || 0).getTime();
        return dateA - dateB;
      });

      setAllTrades(combinedTrades);

      // Apply filter
      let filteredTrades = combinedTrades;
      if (tradeTypeFilter === 'futures') {
        filteredTrades = futuresTrades;
      } else if (tradeTypeFilter === 'solana') {
        filteredTrades = solanaTrades;
      }
      setTrades(filteredTrades);

      toast({
        title: "Data refreshed",
        description: "Performance metrics have been updated",
      });
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast({
        title: "Refresh failed",
        description: "Failed to update performance metrics",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
      setLoading(false);
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Update filtered trades when filter changes
  useEffect(() => {
    if (tradeTypeFilter === 'all') {
      setTrades(allTrades);
    } else if (tradeTypeFilter === 'futures') {
      setTrades(allTrades.filter(t => t.trade_type === 'futures'));
    } else if (tradeTypeFilter === 'solana') {
      setTrades(allTrades.filter(t => t.trade_type === 'solana'));
    }
  }, [tradeTypeFilter, allTrades]);

  if (loading) {
    return (
      <div className="container mx-auto py-6 md:py-8 px-4 md:px-6">
        <LoadingSpinner
          message="Loading performance data..."
          subMessage="Please wait while we fetch your trading performance metrics"
        />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="w-full max-w-none py-4 md:py-6 px-2 md:px-4 space-y-4 md:space-y-6">
        <div className="flex flex-col md:flex-row md:justify-end md:items-center px-2 gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setTradeTypeFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${tradeTypeFilter === 'all'
                ? 'bg-neutral-700 text-white border border-neutral-600'
                : 'bg-neutral-900 text-neutral-400 border border-neutral-800 hover:bg-neutral-800 hover:text-neutral-300'
                }`}
            >
              All Trades ({allTrades.length})
            </button>
            <button
              onClick={() => setTradeTypeFilter('futures')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${tradeTypeFilter === 'futures'
                ? 'bg-neutral-700 text-white border border-neutral-600'
                : 'bg-neutral-900 text-neutral-400 border border-neutral-800 hover:bg-neutral-800 hover:text-neutral-300'
                }`}
            >
              Futures ({allTrades.filter(t => t.trade_type === 'futures').length})
            </button>
            <button
              onClick={() => setTradeTypeFilter('solana')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${tradeTypeFilter === 'solana'
                ? 'bg-neutral-700 text-white border border-neutral-600'
                : 'bg-neutral-900 text-neutral-400 border border-neutral-800 hover:bg-neutral-800 hover:text-neutral-300'
                }`}
            >
              Solana ({allTrades.filter(t => t.trade_type === 'solana').length})
            </button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 mt-8 mb-6">
          <div className="h-[500px] mb-8 p-4 rounded-xl border border-neutral-800" style={{ backgroundColor: '#0a0a0a', animation: 'fadeIn 0.5s ease forwards', animationDelay: '0ms' }}>
            <MetricsComparisonChart trades={trades} showCard={false} />
          </div>

          <div className="h-[500px] mb-8 p-4 rounded-xl border border-neutral-800" style={{ backgroundColor: '#0a0a0a', animation: 'fadeIn 0.5s ease forwards', animationDelay: '100ms' }}>
            <DailyPnLChart trades={trades} limitMonths={3} showCard={false} />
          </div>
        </div>

        {/* Sharpe/Sortino Ratio Section */}
        <div className="grid gap-6 md:grid-cols-2 mt-8 mb-6">
          <div className="h-[500px] mb-8 p-4 rounded-xl border border-neutral-800" style={{ backgroundColor: '#0a0a0a', animation: 'fadeIn 0.5s ease forwards', animationDelay: '200ms' }}>
            <SharpeRatioScatterPlot trades={trades} riskFreeRate={0} showCard={false} />
          </div>
          <div className="h-[500px] mb-8 p-4 rounded-xl border border-neutral-800" style={{ backgroundColor: '#0a0a0a', animation: 'fadeIn 0.5s ease forwards', animationDelay: '300ms' }}>
            <SharpeSortinoBarChart trades={trades} riskFreeRate={0} showCard={false} />
          </div>
        </div>

        {/* Trade Frequency / Consistency Section */}
        <div className="grid gap-6 md:grid-cols-2 mt-8 mb-6">
          <div className="h-[500px] mb-8 p-4 rounded-xl border border-neutral-800" style={{ backgroundColor: '#0a0a0a', animation: 'fadeIn 0.5s ease forwards', animationDelay: '400ms' }}>
            <TradeFrequencyHistogram trades={trades} showCard={false} />
          </div>
          <div className="h-[500px] mb-8 p-4 rounded-xl border border-neutral-800" style={{ backgroundColor: '#0a0a0a', animation: 'fadeIn 0.5s ease forwards', animationDelay: '500ms' }}>
            <RollingExpectancyLineChart trades={trades} windowSize={20} showCard={false} />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 mt-8 mb-6">
          <div className="h-[500px] mb-8 p-4 rounded-xl border border-neutral-800" style={{ backgroundColor: '#0a0a0a', animation: 'fadeIn 0.5s ease forwards', animationDelay: '600ms' }}>
            <WinLossChart showCard={false} />
          </div>

          <div className="h-[500px] mb-8 p-4 rounded-xl border border-neutral-800" style={{ backgroundColor: '#0a0a0a', animation: 'fadeIn 0.5s ease forwards', animationDelay: '700ms' }}>
            <TradeDurationPnLChart trades={trades} showCard={false} />
          </div>
        </div>

        {/* Win Rate Charts */}
        <div className="grid gap-8 md:grid-cols-2 mt-8 mb-6">
          <div className="h-[500px] mb-8 p-4 rounded-xl border border-neutral-800" style={{ backgroundColor: '#0a0a0a', animation: 'fadeIn 0.5s ease forwards', animationDelay: '800ms' }}>
            <WinRateChart trades={trades} showCard={false} />
          </div>

          <div className="h-[500px] mb-8 p-4 rounded-xl border border-neutral-800" style={{ backgroundColor: '#0a0a0a', animation: 'fadeIn 0.5s ease forwards', animationDelay: '900ms' }}>
            <WinRateAreaChart trades={trades} showCard={false} />
          </div>
        </div>

        {/* Profit Factor Charts */}
        <div className="grid gap-8 md:grid-cols-2 mt-8 mb-6">
          <div className="h-[500px] mb-8 p-4 rounded-xl border border-neutral-800" style={{ backgroundColor: '#0a0a0a', animation: 'fadeIn 0.5s ease forwards', animationDelay: '1000ms' }}>
            <ProfitFactorChart trades={trades} showCard={false} />
          </div>

          <div className="h-[500px] mb-8 p-4 rounded-xl border border-neutral-800" style={{ backgroundColor: '#0a0a0a', animation: 'fadeIn 0.5s ease forwards', animationDelay: '1100ms' }}>
            <ProfitFactorBarChart trades={trades} showCard={false} />
          </div>
        </div>

        {/* Drawdown and PnL Chart */}
        <div className="h-[500px] mt-8 mb-8 p-4 rounded-xl border border-neutral-800" style={{ backgroundColor: '#0a0a0a', animation: 'fadeIn 0.5s ease forwards', animationDelay: '1200ms' }}>
          <DrawdownPnLChart trades={trades} showCard={false} />
        </div>

        {/* Trading Time Analysis */}
        <div className="grid gap-8 md:grid-cols-2 mt-8 mb-6">
          <div className="h-[500px] mb-8 p-4 rounded-xl border border-neutral-800" style={{ backgroundColor: '#0a0a0a', animation: 'fadeIn 0.5s ease forwards', animationDelay: '1300ms' }}>
            <TradingBubbleMap trades={trades} showCard={false} />
          </div>

          <div className="h-[500px] mb-8 p-4 rounded-xl border border-neutral-800" style={{ backgroundColor: '#0a0a0a', animation: 'fadeIn 0.5s ease forwards', animationDelay: '1400ms' }}>
            <TradingScatterPlot trades={trades} showCard={false} />
          </div>
        </div>

        {/* PnL Flow Analysis */}
        <div className="h-[500px] mt-8 mb-8 p-4 rounded-xl border border-neutral-800" style={{ backgroundColor: '#0a0a0a', animation: 'fadeIn 0.5s ease forwards', animationDelay: '1500ms' }}>
          <TradingDotChart trades={trades} showCard={false} />
        </div>

        {/* Win/Loss Distribution Analysis */}
        <div className="h-[500px] mt-8 mb-8 p-4 rounded-xl border border-neutral-800" style={{ backgroundColor: '#0a0a0a', animation: 'fadeIn 0.5s ease forwards', animationDelay: '1600ms' }}>
          <WinLossDistributionChart trades={trades} showCard={false} />
        </div>

        {/* Average Win/Loss Analysis */}
        <div className="h-[500px] mt-8 mb-8 p-4 rounded-xl border border-neutral-800" style={{ backgroundColor: '#0a0a0a', animation: 'fadeIn 0.5s ease forwards', animationDelay: '1700ms' }}>
          <AverageWinLossChart trades={trades} showCard={false} />
        </div>

        {/* Win/Loss Analysis */}
        <div className="grid gap-8 md:grid-cols-2 mt-8 mb-6">
          <div className="h-[500px] mb-8 p-4 rounded-xl border border-neutral-800" style={{ backgroundColor: '#0a0a0a', animation: 'fadeIn 0.5s ease forwards', animationDelay: '1800ms' }}>
            <MonthlyWinLossBarChart trades={trades} showCard={false} />
          </div>

          <div className="h-[500px] mb-8 p-4 rounded-xl border border-neutral-800" style={{ backgroundColor: '#0a0a0a', animation: 'fadeIn 0.5s ease forwards', animationDelay: '1900ms' }}>
            <MonthlyWinLossAreaChart trades={trades} showCard={false} />
          </div>
        </div>

        {/* Add a custom style tag for animations */}
        <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

        {/* Bottom spacing */}
        <div className="h-16"></div>
      </div>
    </ErrorBoundary>
  );
} 