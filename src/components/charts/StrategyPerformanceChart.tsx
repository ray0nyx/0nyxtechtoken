import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Zap, RefreshCw, ChevronUp, ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from '@/lib/supabase';
import { useToast } from "@/components/ui/use-toast";
import { format, parseISO } from 'date-fns';
import { useTheme } from '@/components/ThemeProvider';

interface Trade {
  entry_date: string;
  exit_price: number;
  entry_price: number;
}

interface StrategyPnL {
  month: string;  // Actually represents week
  pnl: number;
  date: Date;  // Store full date for sorting
}

export function StrategyPerformanceChart({ showCard = true }: { showCard?: boolean }) {
  const [data, setData] = useState<StrategyPnL[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const fetchData = async (forceRefresh = false) => {
    if (forceRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      const { data: trades, error } = await supabase
        .from('trades')
        .select('entry_date, exit_price, entry_price')
        .eq('user_id', user.id)
        .order('entry_date', { ascending: true });

      if (error) {
        console.error('Error fetching trades:', error);
        setData([]);
        if (forceRefresh) {
          toast({
            title: "Error",
            description: "Failed to refresh performance data.",
            variant: "destructive",
          });
        }
        return;
      }

      if (!trades || trades.length === 0) {
        setData([]);
        return;
      }

      const monthlyData = (trades as Trade[]).reduce((acc: Record<string, StrategyPnL>, trade) => {
        const date = parseISO(trade.entry_date);
        const weekKey = format(date, 'MMM d');
        
        if (!acc[weekKey]) {
          acc[weekKey] = {
            month: weekKey,
            pnl: 0,
            date: date
          };
        }

        acc[weekKey].pnl += trade.exit_price - trade.entry_price;
        return acc;
      }, {});

      const chartData = Object.values(monthlyData)
        .sort((a, b) => a.date.getTime() - b.date.getTime());
      setData(chartData);
      
      if (forceRefresh) {
        toast({
          title: "Chart Refreshed",
          description: "Performance data has been updated.",
        });
      }
    } catch (error) {
      console.error('Error fetching performance data:', error);
      setData([]);
      if (forceRefresh) {
        toast({
          title: "Error",
          description: "Failed to refresh performance data.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    fetchData(true);
  };

  // Calculate current metrics for trend indicator
  const currentPnl = data.length > 0 ? data[data.length - 1].pnl : 0;
  const previousPnl = data.length > 1 ? data[data.length - 2].pnl : 0;
  const percentageChange = previousPnl !== 0 ? ((currentPnl - previousPnl) / Math.abs(previousPnl)) * 100 : 0;

  // Theme-aware colors
  const textColor = isDark ? '#e2e8f0' : '#1e293b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  const axisColor = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const pnl = payload[0].value;
      return (
        <div className="bg-slate-900/95 dark:bg-white/95 border border-slate-700/50 dark:border-slate-300/50 rounded-lg shadow-lg p-3 backdrop-blur-sm">
          <p className="font-medium mb-1 text-white dark:text-slate-900">Week of {label}</p>
          <p className={`text-sm font-semibold ${pnl >= 0 ? 'text-blue-400 dark:text-blue-600' : 'text-purple-400 dark:text-purple-600'}`}>
            PnL: {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }).format(pnl)}
          </p>
        </div>
      );
    }
    return null;
  };

  const chartContent = (
    <div className="w-full h-full bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 20, right: 20, left: 20, bottom: 40 }}
        >
          <defs>
            <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
              <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.7} />
            </linearGradient>
            <linearGradient id="lossGradient" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#9333ea" stopOpacity={0.9} />
              <stop offset="95%" stopColor="#a855f7" stopOpacity={0.7} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis
            dataKey="month"
            angle={-45}
            textAnchor="end"
            height={50}
            interval={Math.ceil(data.length / 12)}
            tick={{ fontSize: 10, fill: textColor }}
            tickMargin={15}
            stroke={axisColor}
          />
          <YAxis
            tick={{ fontSize: 12, fill: textColor }}
            stroke={axisColor}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="pnl"
            shape={(props: any) => {
              const { payload, x, y, width, height } = props;
              const isProfit = payload.pnl >= 0;
              return (
                <rect
                  x={x}
                  y={isProfit ? y : y + height}
                  width={width}
                  height={Math.abs(height)}
                  fill={`url(#${isProfit ? 'profitGradient' : 'lossGradient'})`}
                  rx={4}
                  ry={4}
                />
              );
            }}
            barSize={40}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  if (!showCard) return chartContent;

  return (
    <Card className="shadow-lg hover:shadow-xl transition-all duration-300 hover:shadow-blue-500/10 overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-900 dark:to-slate-800 from-slate-50 to-slate-100">
      <CardHeader className="bg-blue-500/10 dark:bg-blue-500/20">
        <CardTitle className="text-white dark:text-slate-900 flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-500/20 dark:bg-blue-500/30">
            <Zap className="h-4 w-4 text-blue-400 dark:text-blue-600" />
          </div>
          Strategy Performance
          <div className="ml-auto flex items-center gap-2">
            <span className={`text-lg font-bold ${currentPnl >= 0 ? 'text-blue-400 dark:text-blue-600' : 'text-purple-400 dark:text-purple-600'}`}>
              ${currentPnl.toFixed(2)}
            </span>
            {percentageChange !== 0 && (
              <div className={`flex items-center gap-1 text-sm ${percentageChange > 0 ? 'text-emerald-400 dark:text-emerald-600' : 'text-red-400 dark:text-red-600'}`}>
                {percentageChange > 0 ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                <span>{Math.abs(percentageChange).toFixed(1)}%</span>
              </div>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {chartContent}
      </CardContent>
    </Card>
  );
} 