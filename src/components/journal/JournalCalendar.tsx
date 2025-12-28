import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Plus,
  FileText,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from 'date-fns';

interface JournalEntry {
  id: string;
  date: string;
  pnl?: number;
  emotion?: string;
  tags?: string[];
}

interface JournalCalendarProps {
  entries: JournalEntry[];
  selectedDate: string;
  onDateSelect: (date: string) => void;
  onNewEntry: () => void;
  className?: string;
}

export function JournalCalendar({ 
  entries, 
  selectedDate, 
  onDateSelect, 
  onNewEntry,
  className 
}: JournalCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Group entries by date
  const entriesByDate = useMemo(() => {
    const grouped: { [key: string]: JournalEntry[] } = {};
    entries.forEach(entry => {
      if (!grouped[entry.date]) {
        grouped[entry.date] = [];
      }
      grouped[entry.date].push(entry);
    });
    return grouped;
  }, [entries]);

  const getDateStats = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayEntries = entriesByDate[dateStr] || [];
    
    const totalPnL = dayEntries.reduce((sum, entry) => sum + (entry.pnl || 0), 0);
    const entryCount = dayEntries.length;
    const emotions = dayEntries.map(e => e.emotion).filter(Boolean);
    const tags = dayEntries.flatMap(e => e.tags || []);
    
    return {
      totalPnL,
      entryCount,
      emotions,
      tags,
      hasEntries: entryCount > 0
    };
  };

  const getDateColor = (date: Date) => {
    const stats = getDateStats(date);
    if (!stats.hasEntries) return 'text-muted-foreground';
    
    if (stats.totalPnL > 0) return 'text-green-600 dark:text-green-400';
    if (stats.totalPnL < 0) return 'text-red-600 dark:text-red-400';
    return 'text-blue-600 dark:text-blue-400';
  };

  const getDateBackground = (date: Date) => {
    const stats = getDateStats(date);
    if (!stats.hasEntries) return 'hover:bg-muted/50';
    
    if (stats.totalPnL > 0) return 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30';
    if (stats.totalPnL < 0) return 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30';
    return 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30';
  };

  const getIntensity = (date: Date) => {
    const stats = getDateStats(date);
    if (!stats.hasEntries) return 0;
    
    // Calculate intensity based on entry count and P&L magnitude
    const entryIntensity = Math.min(stats.entryCount / 5, 1); // Max 5 entries = full intensity
    const pnlIntensity = Math.min(Math.abs(stats.totalPnL) / 1000, 1); // Max $1000 = full intensity
    
    return Math.max(entryIntensity, pnlIntensity);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => 
      direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1)
    );
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  return (
    <Card className={cn("border shadow-sm", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium flex items-center">
            <CalendarIcon className="h-5 w-5 mr-2 text-primary" />
            Journal Calendar
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              className="text-xs"
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onNewEntry}
              className="text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              New
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Month Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateMonth('prev')}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <h3 className="text-lg font-semibold">
            {format(currentMonth, 'MMMM yyyy')}
          </h3>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateMonth('next')}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Calendar Grid */}
        <div className="space-y-2">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {daysInMonth.map((date, index) => {
              const stats = getDateStats(date);
              const intensity = getIntensity(date);
              const isSelected = isSameDay(date, new Date(selectedDate));
              const isCurrentDay = isToday(date);
              const isCurrentMonth = isSameMonth(date, currentMonth);
              
              return (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-12 p-1 flex flex-col items-center justify-center relative transition-all duration-200",
                    getDateBackground(date),
                    isSelected && "ring-2 ring-primary",
                    !isCurrentMonth && "opacity-30",
                    isCurrentDay && "font-bold"
                  )}
                  onClick={() => onDateSelect(format(date, 'yyyy-MM-dd'))}
                >
                  {/* Date Number */}
                  <span className={cn(
                    "text-sm font-medium",
                    getDateColor(date),
                    isCurrentDay && "text-primary"
                  )}>
                    {format(date, 'd')}
                  </span>
                  
                  {/* Entry Indicators */}
                  {stats.hasEntries && (
                    <div className="flex items-center space-x-1 mt-1">
                      {/* Entry Count */}
                      <Badge 
                        variant="secondary" 
                        className="h-4 px-1 text-xs"
                        style={{ 
                          opacity: 0.3 + (intensity * 0.7),
                          transform: `scale(${0.8 + (intensity * 0.2)})`
                        }}
                      >
                        {stats.entryCount}
                      </Badge>
                      
                      {/* P&L Indicator */}
                      {stats.totalPnL !== 0 && (
                        <div className={cn(
                          "w-1 h-1 rounded-full",
                          stats.totalPnL > 0 ? "bg-green-500" : "bg-red-500"
                        )} />
                      )}
                    </div>
                  )}
                  
                  {/* Intensity Overlay */}
                  {intensity > 0 && (
                    <div 
                      className={cn(
                        "absolute inset-0 rounded opacity-20",
                        stats.totalPnL > 0 ? "bg-green-500" : 
                        stats.totalPnL < 0 ? "bg-red-500" : "bg-blue-500"
                      )}
                      style={{ opacity: intensity * 0.2 }}
                    />
                  )}
                </Button>
              );
            })}
          </div>
        </div>
        
        {/* Legend */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span>Profitable</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-red-500 rounded-full" />
              <span>Loss</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              <span>Neutral</span>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <FileText className="h-3 w-3" />
            <span>Entries</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
