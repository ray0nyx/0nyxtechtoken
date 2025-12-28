import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { createClient } from '@/lib/supabase/client';
import { TrendingUp, ChevronUp, ChevronDown } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { formatCurrency } from '@/lib/formatters';

interface DailyPnLData {
  date: string;
  pnl: number;
  formattedDate: string;
}

export function LargeDailyPnLChart() {
  const [data, setData] = useState<DailyPnLData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: trades, error } = await supabase
        .from('trades')
        .select('entry_date, exit_date, entry_price, exit_price, side')
        .eq('user_id', user.id)
        .order('entry_date', { ascending: true });

      if (error) throw error;

      // Group trades by date and calculate daily P&L
      const dailyPnLMap = new Map<string, number>();
      
      trades?.forEach(trade => {
        const entryDate = new Date(trade.entry_date).toISOString().split('T')[0];
        const exitDate = trade.exit_date ? new Date(trade.exit_date).toISOString().split('T')[0] : entryDate;
        
        const pnl = (trade.exit_price - trade.entry_price) * (trade.side === 'long' ? 1 : -1);
        
        // Add to entry date
        dailyPnLMap.set(entryDate, (dailyPnLMap.get(entryDate) || 0) + pnl);
        
        // If exit date is different, subtract from exit date (for closing trades)
        if (exitDate !== entryDate) {
          dailyPnLMap.set(exitDate, (dailyPnLMap.get(exitDate) || 0) - pnl);
        }
      });

      // Convert to array and sort by date
      const dailyData = Array.from(dailyPnLMap.entries())
        .map(([date, pnl]) => ({
          date,
          pnl,
          formattedDate: new Date(date).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          })
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setData(dailyData);
    } catch (error) {
      console.error('Error fetching daily P&L data:', error);
    } finally {
      setIsLoading(false);
    }
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
          <p className="font-medium mb-1 text-white dark:text-slate-900">{label}</p>
          <p className={`text-sm font-semibold ${pnl >= 0 ? 'text-blue-400 dark:text-blue-600' : 'text-purple-400 dark:text-purple-600'}`}>
            P&L: {formatCurrency(pnl)}
          </p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="w-full h-full bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-700 border-t-blue-500"></div>
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="w-full h-full bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center">
        <div className="text-slate-400 dark:text-slate-600">No trading data available</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-slate-900 rounded-xl">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <defs>
                {/* Glow filter for axis text */}
                <filter id="glowText" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.7} />
                </linearGradient>
                <linearGradient id="lossGradient" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="#9333ea" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                dataKey="formattedDate"
                angle={-45}
                textAnchor="end"
                height={80}
                interval={Math.ceil(data.length / 20)}
                tick={{ fontSize: 10, fill: '#10b981', filter: 'url(#glowText)' }}
                tickMargin={15}
                stroke="rgba(16, 185, 129, 0.6)"
              />
              <YAxis
                tickFormatter={(value) => formatCurrency(value)}
                tick={({ x, y, payload }: any) => {
                  const value = payload.value;
                  const color = value >= 0 ? '#3b82f6' : '#9333ea';
                  return (
                    <g transform={`translate(${x},${y})`}>
                      <text x={0} y={0} dy={4} textAnchor="end" fill={color} fontSize={12} filter="url(#glowText)">
                        {formatCurrency(value)}
                      </text>
                    </g>
                  );
                }}
                stroke={axisColor}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.pnl >= 0 ? "url(#profitGradient)" : "url(#lossGradient)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
    </div>
  );
}
