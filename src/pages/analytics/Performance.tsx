import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CumulativePnLChart } from "@/components/analytics/CumulativePnLChart";
import { DailyPnLBarChart } from "@/components/analytics/DailyPnLBarChart";
import { DrawdownChart } from "@/components/analytics/DrawdownChart";
import { TodayPnLChart } from "@/components/analytics/TodayPnLChart";
import { PnLCalendar } from "@/components/analytics/PnLCalendar";
import { WinLossDistributionChart } from '@/components/charts/WinLossDistributionChart';
import { ProfitFactorChart } from '@/components/charts/ProfitFactorChart';
import { RiskAnalysisRadarChart } from '@/components/analytics/RiskAnalysisRadarChart';
import { LargeDailyPnLChart } from '@/components/charts/LargeDailyPnLChart';
import { TrendingUp, BarChart3, Calendar, Activity } from 'lucide-react';

export default function Performance() {
  const [trades, setTrades] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchTrades();
  }, []);

  const fetchTrades = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data: tradesData, error: tradesError } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .order('entry_date', { ascending: true });

      if (tradesError) {
        throw tradesError;
      }

      setTrades(tradesData || []);
    } catch (err) {
      console.error("Error fetching trades:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="px-4 md:px-6 py-6 md:py-8 space-y-6 md:space-y-8 max-w-[100vw] overflow-x-hidden">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-gray-100 dark:bg-gradient-to-br dark:from-blue-500/10 dark:to-purple-500/10 border border-gray-200 dark:border-blue-500/20">
          <TrendingUp className="h-8 w-8 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">Performance</h1>
          <p className="text-gray-600 dark:text-slate-400 mt-1">Comprehensive trading performance analysis</p>
        </div>
      </div>
      
      <div className="grid gap-6 md:gap-8">
        {/* Main Charts Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-[400px] w-full">
            <CumulativePnLChart trades={trades} showCard={false} />
          </div>
          <div className="h-[400px] w-full">
            <DrawdownChart trades={trades} showCard={false} />
          </div>
          <div className="h-[400px] w-full">
            <DailyPnLBarChart showCard={false} />
          </div>
          <div className="h-[400px] w-full">
            <ProfitFactorChart trades={trades} showCard={false} />
          </div>
        </div>

        {/* Risk Analysis and Distribution Charts */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-[400px]">
            <RiskAnalysisRadarChart trades={trades} showCard={false} />
          </div>
          <div className="h-[400px]">
            <WinLossDistributionChart trades={trades} showCard={false} />
          </div>
        </div>

        {/* Calendar and Today's P&L */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-[400px]">
            <PnLCalendar showCard={false} />
          </div>
          <div className="h-[400px]">
            <TodayPnLChart showCard={false} />
          </div>
        </div>

        {/* Large Daily P&L Chart - Takes up 2 cards worth of space */}
        <div className="col-span-full">
          <LargeDailyPnLChart />
        </div>
      </div>
    </div>
  );
}