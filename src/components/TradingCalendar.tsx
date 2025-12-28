import { useState, useEffect } from "react";
import {
  add,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  isEqual,
  isSameMonth,
  isToday,
  parse,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, Settings, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useCalendarStore } from "@/stores/useCalendarStore";

interface DayStats {
  netPnL: number;
  totalTrades: number;
  winRate: number;
  trades: any[];
}

interface WeekStats {
  netPnL: number;
  tradingDays: number;
}

interface CalendarDay {
  date: Date;
  stats?: DayStats;
}

interface TradingCalendarProps {
  compact?: boolean;
}

export function TradingCalendar({ compact = false }: TradingCalendarProps) {
  const { selectedDate, setSelectedDate } = useCalendarStore();
  const [currentDate, setCurrentDate] = useState(selectedDate);
  const [calendarData, setCalendarData] = useState<CalendarDay[]>([]);
  const [weekStats, setWeekStats] = useState<WeekStats[]>([]);
  const [monthlyStats, setMonthlyStats] = useState({ netPnL: 0, tradingDays: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({
    showWinRate: true,
    showTrades: true,
    showPnL: true,
    highlightWeekends: true,
  });
  const [hoveredDay, setHoveredDay] = useState<CalendarDay | null>(null);

  useEffect(() => {
    loadMonthData();
  }, [currentDate]);

  const loadMonthData = async () => {
    setIsLoading(true);
    try {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calendarStart = startOfWeek(monthStart);
      const calendarEnd = endOfWeek(monthEnd);

      const { data: trades, error } = await supabase
        .from('trades')
        .select('*')
        .gte('date', format(calendarStart, 'yyyy-MM-dd'))
        .lte('date', format(calendarEnd, 'yyyy-MM-dd'))
        .order('date', { ascending: true });

      if (error) throw error;

      // Group trades by date
      const tradesByDate = (trades || []).reduce((acc, trade) => {
        const date = trade.date.split('T')[0];
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(trade);
        return acc;
      }, {} as Record<string, any[]>);

      // Create calendar days with stats
      const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
      const calendarDays = days.map(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayTrades = tradesByDate[dateStr] || [];
        
        if (dayTrades.length === 0) {
          return { date };
        }

        const winners = dayTrades.filter(t => t.profit > 0);
        const netPnL = dayTrades.reduce((sum, t) => sum + (t.profit - t.commission), 0);

        return {
          date,
          stats: {
            netPnL,
            totalTrades: dayTrades.length,
            winRate: (winners.length / dayTrades.length) * 100,
            trades: dayTrades,
          },
        };
      });

      setCalendarData(calendarDays);

      // Calculate week stats
      const weeks: WeekStats[] = [];
      for (let i = 0; i < calendarDays.length; i += 7) {
        const weekDays = calendarDays.slice(i, i + 7);
        const weekStats = weekDays.reduce((acc, day) => {
          if (day.stats && isSameMonth(day.date, currentDate)) {
            acc.netPnL += day.stats.netPnL;
            acc.tradingDays += 1;
          }
          return acc;
        }, { netPnL: 0, tradingDays: 0 });
        weeks.push(weekStats);
      }
      setWeekStats(weeks);

      // Calculate monthly stats
      const monthStats = calendarDays.reduce((acc, day) => {
        if (day.stats && isSameMonth(day.date, currentDate)) {
          acc.netPnL += day.stats.netPnL;
          acc.tradingDays += 1;
        }
        return acc;
      }, { netPnL: 0, tradingDays: 0 });
      setMonthlyStats(monthStats);

    } catch (error) {
      console.error('Error loading calendar data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      signDisplay: 'always',
    }).format(amount);
  };

  const getColorClass = (pnl: number) => {
    if (pnl > 0) return "bg-green-900";
    if (pnl < 0) return "bg-red-900";
    return "bg-gray-900";
  };

  const previousMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1));
  };

  const nextMonth = () => {
    const nextMonthDate = add(currentDate, { months: 1 });
    
    // Check if next month would be in the future
    const today = new Date();
    const startOfCurrentMonth = startOfMonth(today);
    
    // Only allow navigating to current month or past months
    if (startOfMonth(nextMonthDate) <= startOfCurrentMonth) {
      setCurrentDate(nextMonthDate);
    }
  };

  const handleDayClick = (day: CalendarDay) => {
    // Only allow selecting today or past dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (day.date <= today) {
      setSelectedDate(day.date);
    }
  };

  const handleThisMonth = () => {
    setCurrentDate(new Date());
  };

  const renderDayTooltip = (day: CalendarDay) => {
    if (!day.stats) return null;

    return (
      <div className="space-y-2">
        <div className="font-semibold">
          {format(day.date, 'EEEE, MMMM d, yyyy')}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div className="text-gray-400">Net P&L:</div>
          <div className={day.stats.netPnL >= 0 ? "text-green-400" : "text-red-400"}>
            {formatCurrency(day.stats.netPnL)}
          </div>
          <div className="text-gray-400">Trades:</div>
          <div>{day.stats.totalTrades}</div>
          <div className="text-gray-400">Win Rate:</div>
          <div>{day.stats.winRate.toFixed(1)}%</div>
        </div>
        {day.stats.trades.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-700">
            <div className="text-sm font-semibold mb-1">Top Trades:</div>
            {day.stats.trades
              .sort((a, b) => (b.profit - b.commission) - (a.profit - a.commission))
              .slice(0, 3)
              .map((trade, i) => (
                <div key={i} className="text-xs flex justify-between">
                  <span>{trade.symbol}</span>
                  <span className={trade.profit - trade.commission >= 0 ? "text-green-400" : "text-red-400"}>
                    {formatCurrency(trade.profit - trade.commission)}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-[#121212] text-white">
      {/* Header */}
      <div className="flex justify-between items-center p-2 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={previousMonth} className="h-6 w-6">
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <h2 className="text-sm font-semibold">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={nextMonth} 
            className="h-6 w-6"
            disabled={isSameMonth(currentDate, new Date())}
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
        {!compact && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-400">Monthly:</span>
            <span className={cn(
              "font-semibold",
              monthlyStats.netPnL > 0 ? "text-green-500" : "text-red-500"
            )}>
              {formatCurrency(monthlyStats.netPnL)}
            </span>
            <span className="text-blue-500">{monthlyStats.tradingDays}d</span>
          </div>
        )}
      </div>

      {/* Calendar Grid */}
      <div className="p-2">
        <div className="grid grid-cols-7 gap-1">
          {/* Day headers */}
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
            <div key={day} className="text-center text-gray-400 text-xs py-1">
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {calendarData.map((day) => (
            <TooltipProvider key={day.date.toISOString()}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "h-8 w-8 p-0 font-normal rounded-full relative",
                      !isSameMonth(day.date, currentDate) && "text-gray-500",
                      isSameMonth(day.date, currentDate) && "text-white",
                      isEqual(day.date, selectedDate) && "bg-indigo-600",
                      isToday(day.date) && "border border-indigo-400",
                      day.date > new Date() && "text-gray-700 cursor-not-allowed",
                      settings.highlightWeekends && (getDay(day.date) === 0 || getDay(day.date) === 6) && "bg-gray-800/50",
                      day.stats && day.stats.netPnL > 0 && "after:absolute after:inset-1 after:rounded-full after:bg-green-900/30",
                      day.stats && day.stats.netPnL < 0 && "after:absolute after:inset-1 after:rounded-full after:bg-red-900/30",
                    )}
                    onClick={() => handleDayClick(day)}
                    disabled={day.date > new Date()}
                  >
                    <div className="flex flex-col h-full text-xs">
                      <div className="text-[10px]">{format(day.date, 'd')}</div>
                      {day.stats ? (
                        <div className="text-[10px] font-semibold mt-auto">
                          {formatCurrency(day.stats.netPnL)}
                        </div>
                      ) : (
                        <div className="flex-grow flex items-center justify-center text-[10px] text-gray-600">
                          -
                        </div>
                      )}
                    </div>
                  </div>
                </TooltipTrigger>
                {day.stats && (
                  <TooltipContent side="right" className="p-2">
                    <div className="space-y-1 text-xs">
                      <div className="font-semibold">
                        {format(day.date, 'EEEE, MMM d')}
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                        <div className="text-gray-400">P&L:</div>
                        <div className={day.stats.netPnL >= 0 ? "text-green-400" : "text-red-400"}>
                          {formatCurrency(day.stats.netPnL)}
                        </div>
                        <div className="text-gray-400">Trades:</div>
                        <div>{day.stats.totalTrades}</div>
                        <div className="text-gray-400">Win %:</div>
                        <div>{day.stats.winRate.toFixed(1)}%</div>
                      </div>
                    </div>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      </div>
    </div>
  );
} 