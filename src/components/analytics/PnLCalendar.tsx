import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, RefreshCw, Plus, Edit, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { useTheme } from '@/components/ThemeProvider';
import { format, parseISO, isValid } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { v4 as uuidv4 } from 'uuid';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { getMonthPnL, formatDateToLocalISOString, DayPnL } from '@/lib/pnlData';


interface WeekPnL {
  weekStart: Date;
  weekEnd: Date;
  totalPnL: number;
  days: DayPnL[];
}

// New interface for current period P&L data
export interface PeriodPnLData {
  currentDayPnL: number;
  currentWeekPnL: number;
  currentMonthPnL: number;
  monthlyPnL?: DayPnL[];
}

interface JournalEntry {
  id: string;
  user_id: string;
  date: string;
  note_content: string;
  created_at: string;
  updated_at: string;
}

interface PnLCalendarProps {
  onPeriodPnLUpdate?: (data: PeriodPnLData) => void;
}

export function PnLCalendar({ onPeriodPnLUpdate }: PnLCalendarProps) {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(today);
  const [monthlyPnL, setMonthlyPnL] = useState<DayPnL[]>([]);
  const [weeklyPnL, setWeeklyPnL] = useState<WeekPnL[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const supabase = createClient();
  const { toast } = useToast();
  const { theme } = useTheme();

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDayData, setSelectedDayData] = useState<DayPnL | null>(null);
  const [journalEntries, setJournalEntries] = useState<any[]>([]);
  const [newEntryContent, setNewEntryContent] = useState('');
  const [chartData, setChartData] = useState<any[]>([]);
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [activeTab, setActiveTab] = useState("chart");
  const [tempEntryContent, setTempEntryContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingJournal, setIsLoadingJournal] = useState(false);


  // Get all days for the calendar grid (including padding days for previous/next months)
  const getCalendarDays = () => {
    const { firstDay, lastDay } = getDaysInMonth(currentDate);
    const result: (Date | null)[] = [];

    // Add days from previous month to fill the first week
    const firstDayOfWeek = firstDay.getDay(); // 0 is Sunday, 1 is Monday, etc.
    for (let i = 0; i < firstDayOfWeek; i++) {
      result.push(null);
    }

    // Add all days of the current month
    const totalDays = lastDay.getDate();
    for (let i = 1; i <= totalDays; i++) {
      result.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i));
    }

    // Add days from next month to fill the last week if needed
    const lastDayOfWeek = lastDay.getDay(); // 0 is Sunday, 6 is Saturday
    if (lastDayOfWeek < 6) {
      for (let i = lastDayOfWeek + 1; i <= 6; i++) {
        result.push(null);
      }
    }

    return result;
  };

  const getDaysInMonth = (date: Date) => {
    // Ensure we're working with dates in local time
    const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const year = localDate.getFullYear();
    const month = localDate.getMonth();
    // Create dates in local time zone (not UTC)
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    return { firstDay, lastDay };
  };

  const loadMonthlyPnL = async (forceRefresh = false) => {
    if (forceRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      // Get P&L data for the current month
      const monthData = await getMonthPnL(currentDate.getFullYear(), currentDate.getMonth());


      // Create array of all days in month with PnL
      const { firstDay, lastDay } = getDaysInMonth(currentDate);
      const allDays: DayPnL[] = [];
      const currentDay = new Date(firstDay);

      while (currentDay <= lastDay) {
        const dateStr = formatDateToLocalISOString(currentDay);
        const dayData = monthData.find(d => d.date === dateStr);
        const pnl = dayData?.pnl || 0;

        if (pnl !== 0) {
          console.log('PnLCalendar: Found P&L for date:', dateStr, 'P&L:', pnl);
        }

        allDays.push({
          date: dateStr,
          pnl: pnl
        });
        currentDay.setDate(currentDay.getDate() + 1);
      }

      // Add today's date if it's not in the current month
      const todayDate = new Date();
      const todayDateStr = formatDateToLocalISOString(todayDate);
      const isTodayInCurrentMonth = todayDate.getMonth() === currentDate.getMonth() &&
        todayDate.getFullYear() === currentDate.getFullYear();

      if (!isTodayInCurrentMonth) {
        const todayData = await getMonthPnL(todayDate.getFullYear(), todayDate.getMonth());
        const todayDayData = todayData.find(d => d.date === todayDateStr);
        if (todayDayData) {
          allDays.push({
            date: todayDateStr,
            pnl: todayDayData.pnl
          });
          console.log('PnLCalendar: Added today to allDays:', todayDateStr, 'pnl:', todayDayData.pnl);
        }
      }

      setMonthlyPnL(allDays);

      // Generate calendar grid
      const weeks: WeekPnL[] = [];
      const calendarStart = new Date(firstDay);
      const firstOfMonthDay = calendarStart.getDay();
      calendarStart.setDate(calendarStart.getDate() - firstOfMonthDay);

      const totalDays = lastDay.getDate() + firstOfMonthDay;
      const weeksNeeded = Math.ceil(totalDays / 7);

      for (let weekIndex = 0; weekIndex < weeksNeeded; weekIndex++) {
        const weekStart = new Date(calendarStart);
        weekStart.setDate(weekStart.getDate() + (weekIndex * 7));

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const weekDays: DayPnL[] = [];

        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
          const day = new Date(weekStart);
          day.setDate(day.getDate() + dayIndex);

          const dateStr = formatDateToLocalISOString(day);
          const isCurrentMonth = day.getMonth() === currentDate.getMonth() &&
            day.getFullYear() === currentDate.getFullYear();
          const isToday = day.toDateString() === today.toDateString();

          const dayData = allDays.find(d => d.date === dateStr);
          weekDays.push({
            date: dateStr,
            pnl: (isCurrentMonth || isToday) ? (dayData?.pnl || 0) : 0
          });
        }

        weeks.push({
          weekStart: weekStart,
          weekEnd: weekEnd,
          totalPnL: weekDays.reduce((sum, day) => sum + (day.pnl || 0), 0),
          days: weekDays
        });
      }

      setWeeklyPnL(weeks);

      // Calculate current day and week PnL
      const todayStr = formatDateToLocalISOString(today);
      console.log('PnLCalendar: Today string:', todayStr);
      console.log('PnLCalendar: All days:', allDays);
      const currentDayPnL = allDays.find(d => d.date === todayStr)?.pnl || 0;
      console.log('PnLCalendar: Found current day PnL:', currentDayPnL);

      const currentWeek = weeks.find(week => {
        const weekStartStr = formatDateToLocalISOString(week.weekStart);
        const weekEndStr = formatDateToLocalISOString(week.weekEnd);
        return todayStr >= weekStartStr && todayStr <= weekEndStr;
      });

      const currentWeekPnL = currentWeek?.totalPnL || 0;
      const monthlyTotal = allDays.reduce((sum, day) => sum + (day?.pnl || 0), 0);

      console.log('PnLCalendar: Today P&L:', currentDayPnL);
      console.log('PnLCalendar: Week P&L:', currentWeekPnL);
      console.log('PnLCalendar: Month P&L:', monthlyTotal);

      // Call the callback with current day and week PnL
      if (onPeriodPnLUpdate) {
        onPeriodPnLUpdate({
          currentDayPnL,
          currentWeekPnL,
          currentMonthPnL: monthlyTotal,
          monthlyPnL: allDays
        });
      }

      if (forceRefresh) {
        toast({
          title: "Calendar Refreshed",
          description: "P&L calendar data has been refreshed.",
        });
      }
    } catch (error) {
      console.error('Error loading monthly PnL:', error);
      setMonthlyPnL([]);
      setWeeklyPnL([]);
      if (forceRefresh) {
        toast({
          title: "Error",
          description: "Failed to refresh P&L calendar data.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadMonthlyPnL();
  }, [currentDate]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const handleRefresh = () => {
    loadMonthlyPnL(true);
  };

  const monthlyTotal = Array.isArray(monthlyPnL) ? monthlyPnL.reduce((sum, day) => sum + (day?.pnl || 0), 0) : 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      signDisplay: 'auto',
    }).format(amount || 0);
  };

  // New functions for handling day selection
  const handleDayClick = async (day: DayPnL) => {
    setSelectedDayData(day);
    setTempEntryContent('');

    // First open the dialog to prevent state changes causing re-renders
    setIsDialogOpen(true);

    // Don't reset activeTab here to preserve user's previous tab selection
    // when they click different days

    // Then load the data
    await loadJournalEntriesForDate(day.date);
    fetchDailyPnLChart(day.date);
  };

  const loadJournalEntriesForDate = async (date: string) => {
    if (!date) return;

    console.log('Loading journal entries for date:', date);
    setIsLoadingJournal(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { data, error } = await supabase
        .from('journal_notes')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', date)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Database error loading journal entries:', error);
        throw error;
      }

      console.log('Loaded journal entries:', data);
      setJournalEntries(data || []);
    } catch (error) {
      console.error('Error loading journal entries:', error);
      toast({
        title: "Error",
        description: "Failed to load journal entries",
        variant: "destructive"
      });
      setJournalEntries([]);
    } finally {
      setIsLoadingJournal(false);
    }
  };

  const fetchDailyPnLChart = async (date: string) => {
    setIsLoadingChart(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('trades')
        .select('entry_date, exit_date, date, pnl')
        .eq('user_id', user.id)
        .order('exit_date', { ascending: true });

      if (error) throw error;

      // Filter trades for this day
      const matchingTrades = data?.filter(trade =>
        trade.date === date ||
        trade.entry_date === date ||
        trade.exit_date === date
      ) || [];

      if (matchingTrades.length === 0) {
        setChartData([]);
        setIsLoadingChart(false);
        return;
      }

      // Process trade data
      let cumulativePnL = 0;
      const sortedTrades = matchingTrades.sort((a, b) => {
        const aDate = new Date(a.exit_date || a.entry_date || a.date);
        const bDate = new Date(b.exit_date || b.entry_date || b.date);
        return aDate.getTime() - bDate.getTime();
      });

      // Create starting point
      const startOfDay = new Date(date);
      startOfDay.setHours(9, 30, 0, 0);

      const processedData = [
        {
          date: startOfDay.toISOString(),
          displayDate: format(startOfDay, 'h:mm a'),
          pnl: 0,
          cumulativePnL: 0
        },
        ...sortedTrades.map((trade) => {
          const dateToUse = trade.exit_date || trade.entry_date || trade.date;
          const displayDate = format(parseISO(dateToUse), 'h:mm a');
          const pnlValue = parseFloat(trade.pnl?.toString() || '0');
          cumulativePnL += pnlValue;

          return {
            date: dateToUse,
            displayDate,
            pnl: pnlValue,
            cumulativePnL
          };
        })
      ];

      // Add end point if needed
      if (sortedTrades.length === 1) {
        const endOfDay = new Date(date);
        endOfDay.setHours(16, 0, 0, 0);
        processedData.push({
          date: endOfDay.toISOString(),
          displayDate: format(endOfDay, 'h:mm a'),
          pnl: cumulativePnL,
          cumulativePnL: cumulativePnL
        });
      }

      setChartData(processedData);
    } catch (error) {
      console.error('Error fetching daily PnL chart data:', error);
    } finally {
      setIsLoadingChart(false);
    }
  };

  const saveNewJournalEntry = async () => {
    console.log('saveNewJournalEntry called with:', { selectedDayData, tempEntryContent });

    if (!selectedDayData || !tempEntryContent.trim()) {
      console.log('Missing required data:', { selectedDayData: !!selectedDayData, tempEntryContent: tempEntryContent });
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const newEntry = {
        id: uuidv4(),
        user_id: user.id,
        date: selectedDayData.date,
        note_content: tempEntryContent,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('Inserting journal entry:', newEntry);

      const { error } = await supabase
        .from('journal_notes')
        .insert(newEntry);

      if (error) throw error;

      console.log('Journal entry saved successfully');

      toast({
        title: "Success",
        description: "Journal entry saved successfully",
      });

      // Add the new entry to the journalEntries state directly
      // This ensures the entry is displayed immediately without requiring a refresh
      setJournalEntries([newEntry, ...journalEntries]);

      // Clear the form
      setTempEntryContent('');
      setNewEntryContent('');
    } catch (error: any) {
      console.error('Error saving journal entry:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save journal entry",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const saveNewJournalEntryWithContent = async (content: string) => {
    console.log('saveNewJournalEntryWithContent called with:', { selectedDayData, content });

    if (!selectedDayData || !content.trim()) {
      console.log('Missing required data:', { selectedDayData: !!selectedDayData, content: content });
      toast({
        title: "Error",
        description: "Missing required data for journal entry",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No authenticated user');
        throw new Error('No authenticated user');
      }

      // Ensure the date is in the correct format for the database
      // selectedDayData.date is already in YYYY-MM-DD format from formatDateToLocalISOString
      const entryDate = selectedDayData.date; // Already in YYYY-MM-DD format
      console.log('Using entry date:', entryDate, 'from selectedDayData.date:', selectedDayData.date);

      const newEntry = {
        id: uuidv4(),
        user_id: user.id,
        date: entryDate,
        note_content: content,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('Inserting journal entry:', newEntry);

      const { data, error } = await supabase
        .from('journal_notes')
        .insert(newEntry)
        .select();

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      console.log('Journal entry saved successfully:', data);

      toast({
        title: "Success",
        description: "Journal entry saved successfully",
      });

      // Add the new entry to the journalEntries state directly
      // This ensures the entry is displayed immediately without requiring a refresh
      setJournalEntries([newEntry, ...journalEntries]);

      // Clear the form
      setTempEntryContent('');
      setNewEntryContent('');
    } catch (error: any) {
      console.error('Error saving journal entry:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save journal entry",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteJournalEntry = async (id: string) => {
    if (!selectedDayData) return;

    try {
      const { error } = await supabase
        .from('journal_notes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Journal entry deleted successfully",
      });

      // Refresh journal entries
      await loadJournalEntriesForDate(selectedDayData.date);
    } catch (error: any) {
      console.error('Error deleting journal entry:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete journal entry",
        variant: "destructive"
      });
    }
  };

  // Replace the DayDetailDialog component with a simpler implementation
  const DayDetailDialog = () => {
    const [localEntryContent, setLocalEntryContent] = useState('');
    const [activeView, setActiveView] = useState<'chart' | 'journal'>('chart');

    // Initialize local state when dialog opens
    useEffect(() => {
      if (isDialogOpen) {
        setLocalEntryContent(newEntryContent);
        setTempEntryContent('');
      } else {
        // Clear local content when dialog closes
        setLocalEntryContent('');
      }
    }, [isDialogOpen, newEntryContent]);

    // Sync back to parent state when saving
    const handleSaveEntry = async () => {
      if (!localEntryContent.trim()) {
        toast({
          title: "Error",
          description: "Please enter some content for your journal entry",
          variant: "destructive"
        });
        return;
      }

      // Update the temp content and save directly
      setTempEntryContent(localEntryContent);
      setNewEntryContent(localEntryContent);

      // Call saveNewJournalEntry with the content directly
      await saveNewJournalEntryWithContent(localEntryContent);

      // Clear the local content after successful save
      setLocalEntryContent('');

      // Refresh journal entries to ensure they show up
      if (selectedDayData) {
        await loadJournalEntriesForDate(selectedDayData.date);
      }
    };

    if (!isDialogOpen) return null;

    return (
      <div className="fixed inset-0 z-50">
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsDialogOpen(false)} />

        {/* Dialog */}
        <div
          className="absolute inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 rounded-xl shadow-2xl border border-slate-700/50 backdrop-blur-sm max-w-2xl w-full max-h-[90vh] flex flex-col"
          style={{
            backgroundColor: theme === 'dark' ? '#0a0a0a' : 'rgb(255 255 255)',
            backgroundImage: 'none'
          }}
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between">
            <div>
              <h2
                className="text-xl font-semibold"
                style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
              >
                {selectedDayData && format(parseISO(selectedDayData.date), 'EEEE, MMMM d, yyyy')}
              </h2>
              <p
                className="text-sm mt-1"
                style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
              >
                View your trades and journal entries for this day
              </p>
            </div>
            {selectedDayData && (
              <div className="flex items-center mt-6 sm:mt-8">
                <span
                  className="mr-2"
                  style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
                >
                  P&L:
                </span>
                <span className={`text-lg font-bold ${selectedDayData.pnl >= 0 ? 'text-gray-400' : 'text-gray-300'}`}>
                  {formatCurrency(selectedDayData.pnl)}
                </span>
              </div>
            )}
            <button
              onClick={() => setIsDialogOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-slate-700/50 transition-colors duration-200"
              style={{
                color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)';
              }}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-grow overflow-auto">
            {/* Tab Buttons */}
            <div className="flex mt-4 mx-6">
              <button
                onClick={() => setActiveTab('chart')}
                className={`px-4 py-2 rounded-l-lg font-medium transition-all duration-200 ${activeTab === 'chart'
                  ? 'bg-gray-500 text-white shadow-lg'
                  : 'hover:bg-slate-600/50'
                  }`}
                style={{
                  backgroundColor: activeTab === 'chart' ? 'rgb(59 130 246)' : theme === 'dark' ? 'rgb(30 41 59 / 0.5)' : 'rgb(243 244 246)',
                  color: activeTab === 'chart' ? 'white' : theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)',
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== 'chart') {
                    e.currentTarget.style.color = theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== 'chart') {
                    e.currentTarget.style.color = theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)';
                  }
                }}
              >
                Chart
              </button>
              <button
                onClick={() => setActiveTab('journal')}
                className={`px-4 py-2 rounded-r-lg font-medium transition-all duration-200 ${activeTab === 'journal'
                  ? 'bg-gray-300 text-white shadow-lg'
                  : 'hover:bg-slate-600/50'
                  }`}
                style={{
                  backgroundColor: activeTab === 'journal' ? 'rgb(147 51 234)' : theme === 'dark' ? 'rgb(30 41 59 / 0.5)' : 'rgb(243 244 246)',
                  color: activeTab === 'journal' ? 'white' : theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)',
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== 'journal') {
                    e.currentTarget.style.color = theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== 'journal') {
                    e.currentTarget.style.color = theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)';
                  }
                }}
              >
                Journal
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'chart' && (
                <div className="space-y-4">
                  {isLoadingChart ? (
                    <div
                      className="flex justify-center items-center h-[300px] rounded-xl"
                      style={{
                        backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                      }}
                    >
                      <div className="flex flex-col items-center gap-3">
                        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                        <span
                          style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
                        >
                          Loading chart data...
                        </span>
                      </div>
                    </div>
                  ) : chartData && chartData.length > 0 ? (
                    <div
                      className="h-[300px] w-full rounded-xl p-4"
                      style={{
                        backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                      }}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={chartData}
                          margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
                        >
                          <defs>
                            <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                              <stop
                                offset="5%"
                                stopColor="#9ca3af"
                                stopOpacity={0.3}
                              />
                              <stop
                                offset="95%"
                                stopColor="#9ca3af"
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="rgba(255, 255, 255, 0.1)"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="time"
                            tick={{ fill: '#94a3b8', fontSize: 12 }}
                            tickLine={{ stroke: '#475569' }}
                            axisLine={{ stroke: '#475569' }}
                          />
                          <YAxis
                            tick={{ fill: '#94a3b8', fontSize: 12 }}
                            tickLine={{ stroke: '#475569' }}
                            axisLine={{ stroke: '#475569' }}
                            tickFormatter={(value) => formatCurrency(value)}
                          />
                          <RechartsTooltip
                            formatter={(value: number) => [formatCurrency(value || 0), 'P&L']}
                            contentStyle={{
                              backgroundColor: 'rgba(15, 23, 42, 0.95)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              borderRadius: '12px',
                              color: '#fff',
                              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                              backdropFilter: 'blur(10px)'
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="cumulativePnL"
                            stroke="#9ca3af"
                            strokeWidth={2}
                            fill="url(#colorPnl)"
                            dot={false}
                            activeDot={{
                              r: 4,
                              stroke: "#9ca3af",
                              strokeWidth: 1,
                              fill: '#fff'
                            }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div
                      className="p-4 rounded-md text-center"
                      style={{
                        backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.5)' : 'rgb(249 250 251)',
                      }}
                    >
                      <p
                        style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
                      >
                        No trade data available for this day
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'journal' && (
                <div className="space-y-4">
                  {isLoadingJournal ? (
                    <div
                      className="flex justify-center items-center h-12 rounded-xl"
                      style={{
                        backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <RefreshCw className="h-6 w-6 animate-spin text-gray-300" />
                        <span
                          style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
                        >
                          Loading journal entries...
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {journalEntries.length > 0 ? (
                        <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
                          {journalEntries.map(entry => (
                            <div
                              key={entry.id}
                              className="p-4 rounded-xl border border-slate-700/50 backdrop-blur-sm"
                              style={{
                                backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                              }}
                            >
                              <div
                                className="prose prose-sm max-w-none"
                                style={{ color: theme === 'dark' ? 'rgb(203 213 225)' : 'rgb(55 65 81)' }}
                              >
                                <div dangerouslySetInnerHTML={{ __html: entry.note_content }} />
                              </div>
                              <div
                                className="text-xs mt-3 flex justify-between items-center"
                                style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
                              >
                                <span>Last updated: {format(new Date(entry.updated_at), 'MMM d, yyyy h:mm a')}</span>
                                <button
                                  onClick={() => deleteJournalEntry(entry.id)}
                                  className="text-red-400 hover:text-red-300 p-1 rounded-lg hover:bg-red-500/10 transition-colors duration-200"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div
                          className="text-center p-6 rounded-xl"
                          style={{
                            backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                            color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)',
                          }}
                        >
                          No journal entries for this day
                        </div>
                      )}

                      <div className="border-t border-slate-700/50 pt-4 mt-4">
                        <h3
                          className="text-sm font-medium mb-3"
                          style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
                        >
                          New Journal Entry
                        </h3>
                        <textarea
                          value={localEntryContent}
                          onChange={(e) => setLocalEntryContent(e.target.value)}
                          placeholder="Write your thoughts about this trading day..."
                          className="w-full min-h-[100px] p-3 text-sm rounded-xl border border-slate-700/50 resize-none focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-300/50 transition-all duration-200"
                          style={{
                            backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                            color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)',
                          }}
                        />
                        <Button
                          onClick={handleSaveEntry}
                          disabled={isSaving || !localEntryContent.trim()}
                          className="mt-3 w-full !bg-none !bg-gray-500 hover:!bg-gray-600 text-white border-gray-500 shadow-none transition-all duration-200"
                          size="sm"
                        >
                          {isSaving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                          Save Journal Entry
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card
      className="rounded-xl border transition-all duration-500 hover:shadow-2xl hover:shadow-gray-300/10 group overflow-hidden border-gray-200 dark:border-slate-700/50 hover:border-gray-300/30 dark:hover:border-gray-300/30 shadow-lg shadow-gray-300/5 hover:shadow-gray-300/20 h-full !bg-white dark:!bg-[#0a0a0a]"
      style={{
        backgroundColor: theme === 'dark' ? '#0a0a0a' : 'rgb(255, 255, 255)'
      }}
    >
      <CardHeader className="pb-2 group-hover:bg-gray-300/10 transition-colors duration-300 flex flex-row items-center justify-between px-6 pt-6">
        <CardTitle className="text-lg font-semibold text-white dark:text-white text-slate-900 flex items-center gap-2">
          <div className="p-2 rounded-lg bg-gray-300/10 group-hover:bg-gray-300/20 transition-colors duration-300">
            <CalendarIcon className="h-5 w-5 text-gray-300" />
          </div>
          P&L Calendar
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateMonth('prev')}
            className="h-5 w-5 p-0 rounded-full"
          >
            <ChevronLeft className="h-3 w-3" />
            <span className="sr-only">Previous month</span>
          </Button>
          <span className="text-[10px] font-medium px-1 text-foreground dark:text-white">
            {currentDate.toLocaleDateString('default', { month: 'long', year: 'numeric' })}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateMonth('next')}
            disabled={
              currentDate.getMonth() === today.getMonth() &&
              currentDate.getFullYear() === today.getFullYear()
            }
            className="h-5 w-5 p-0 rounded-full"
          >
            <ChevronRight className="h-3 w-3" />
            <span className="sr-only">Next month</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-5 w-5 p-0 rounded-full ml-1"
          >
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="sr-only">Refresh</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-2 px-2">
        {isLoading ? (
          <div className="flex justify-center items-center h-36">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-7 text-center">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
              <div key={i} className="text-[8px] text-muted-foreground font-medium py-1">
                {day}
              </div>
            ))}
            {weeklyPnL.map((week, i) => (
              <div key={i} className="contents">
                {week.days.map((day, j) => {
                  // Ensure we're parsing the date correctly
                  const dateParts = day.date.split('-').map(part => parseInt(part));
                  const date = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);

                  const isToday = date.getDate() === today.getDate() &&
                    date.getMonth() === today.getMonth() &&
                    date.getFullYear() === today.getFullYear();
                  const isCurrentMonth = date.getMonth() === currentDate.getMonth() &&
                    date.getFullYear() === currentDate.getFullYear();

                  // Gradient background for positive PnL - gray theme
                  const positiveGradient = day.pnl > 0
                    ? `linear-gradient(135deg, rgba(107, 114, 128, ${Math.min(0.15 + Math.abs(day.pnl) * 0.01, 0.3)}) 0%, rgba(75, 85, 99, ${Math.min(0.1 + Math.abs(day.pnl) * 0.005, 0.25)}) 100%)`
                    : '';

                  // Gradient background for negative PnL - light gray theme
                  const negativeGradient = day.pnl < 0
                    ? `linear-gradient(135deg, rgba(209, 213, 219, ${Math.min(0.15 + Math.abs(day.pnl) * 0.01, 0.3)}) 0%, rgba(156, 163, 175, ${Math.min(0.1 + Math.abs(day.pnl) * 0.005, 0.25)}) 100%)`
                    : '';

                  return (
                    <div
                      key={j}
                      className={cn(
                        "aspect-square p-[1px] relative hover:scale-[1.05] transition-all duration-200 cursor-pointer",
                        isToday && "font-bold",
                        !isCurrentMonth && "opacity-30"
                      )}
                      onClick={() => isCurrentMonth && handleDayClick(day)}
                    >
                      <div
                        className={cn(
                          "h-full w-full rounded-full flex flex-col items-center justify-start pt-[1px] overflow-hidden",
                          isToday && "bg-gray-300/20 border border-gray-300/30",
                          day.pnl !== 0 && "hover:shadow-sm transition-shadow duration-200",
                          day.pnl > 0 ? "bg-gray-500/15" : day.pnl < 0 ? "bg-gray-300/15" : "bg-slate-700/30"
                        )}
                        style={{
                          background: day.pnl > 0
                            ? positiveGradient
                            : day.pnl < 0
                              ? negativeGradient
                              : ""
                        }}
                      >
                        <div className={cn(
                          "text-[12px] font-extrabold text-white",
                          isToday && "text-gray-300"
                        )}>
                          {date.getDate()}
                        </div>
                        {day.pnl !== 0 && (
                          <div className={cn(
                            "text-[30px] font-black mt-0 leading-none tracking-tighter flex-grow flex items-center justify-center",
                            day.pnl > 0 ? "text-gray-400" : "text-gray-300"
                          )}>
                            ${Math.abs(day.pnl).toFixed(0)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Day Detail Dialog */}
      <DayDetailDialog />
    </Card>
  );
} 