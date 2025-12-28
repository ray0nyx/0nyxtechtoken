import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useTheme } from '@/components/ThemeProvider';
import { cn } from '@/lib/utils';
import {
  Calendar,
  DollarSign,
  Save,
  ChevronRight,
  ChevronLeft,
  Search,
  Plus,
  Trash2,
  Edit,
  Loader2,
  X,
  Circle,
  TrendingUp,
  FileText,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@/lib/supabase/client';
import TiptapEditor, { TiptapEditorRef } from '@/components/editor/TiptapEditor';
import { DatePicker } from '@/components/ui/date-picker';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';

interface ImageUpload {
  id: string;
  url: string;
  name: string;
  size: number;
  createdAt: string;
}

interface JournalNote {
  id: string;
  user_id: string;
  date: string;
  note_content: string;
  pnl?: number;
  created_at: string;
  updated_at: string;
  emotion?: string;
  tags?: string[];
  images?: ImageUpload[];
}

// Add the JournalEntryPnLChart component
const JournalEntryPnLChart = ({ date, theme }: { date: string; theme: string }) => {
  const [chartData, setChartData] = useState<{ date: string; pnl: number; cumulativePnL: number; displayDate: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  // Safety check for theme
  const currentTheme = theme || 'light';

  const fetchTrades = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      console.log('Fetching trades for date:', date);

      // First, let's check what trades exist around this date
      const { data: allTrades, error: allTradesError } = await supabase
        .from('trades')
        .select('entry_date, exit_date, date, pnl')
        .eq('user_id', user.id)
        .order('exit_date', { ascending: true });

      console.log('All trades found:', allTrades?.map(t => ({
        entry: t.entry_date,
        exit: t.exit_date,
        date: t.date,
        pnl: t.pnl
      })));

      // Try to find trades that match our date in any field
      let matchingTrades = allTrades?.filter(trade =>
        trade.date === date ||
        trade.entry_date === date ||
        trade.exit_date === date
      ) || [];

      console.log('Matching trades found:', matchingTrades);

      if (matchingTrades.length === 0) {
        console.log('No trades found for date:', date);
        setChartData([]);
        return;
      }

      // Process trade data and calculate cumulative PnL throughout the day
      let cumulativePnL = 0;
      const sortedTrades = matchingTrades
        .sort((a, b) => {
          const aDate = new Date(a.exit_date || a.entry_date || a.date);
          const bDate = new Date(b.exit_date || b.entry_date || b.date);
          return aDate.getTime() - bDate.getTime();
        });

      // Create a starting point at the beginning of the day
      const startOfDay = new Date(date);
      startOfDay.setHours(9, 30, 0, 0); // Market open at 9:30 AM

      const processedData = [
        // Add starting point
        {
          date: startOfDay.toISOString(),
          displayDate: format(startOfDay, 'h:mm a'),
          pnl: 0,
          cumulativePnL: 0
        },
        // Add actual trades
        ...sortedTrades.map((trade) => {
          const dateToUse = trade.exit_date || trade.entry_date || trade.date;
          const displayDate = format(parseISO(dateToUse), 'h:mm a');
          const pnlValue = parseFloat(trade.pnl?.toString() || '0');
          cumulativePnL += pnlValue;

          console.log('Processing trade:', {
            dateToUse,
            displayDate,
            pnl: pnlValue,
            cumulativePnL
          });

          return {
            date: dateToUse,
            displayDate,
            pnl: pnlValue,
            cumulativePnL
          };
        })
      ];

      // If there's only one trade, add an end point at market close
      if (sortedTrades.length === 1) {
        const endOfDay = new Date(date);
        endOfDay.setHours(16, 0, 0, 0); // Market close at 4:00 PM
        processedData.push({
          date: endOfDay.toISOString(),
          displayDate: format(endOfDay, 'h:mm a'),
          pnl: cumulativePnL,
          cumulativePnL: cumulativePnL
        });
      }

      console.log('Final processed chart data:', processedData);
      setChartData(processedData);
    } catch (error) {
      console.error('Error fetching trades for journal PnL chart:', error);
      setChartData([]);
    } finally {
      setIsLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  const getLastCumulativePnL = () => {
    if (!chartData || chartData.length === 0) return 0;
    return chartData[chartData.length - 1]?.cumulativePnL || 0;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground">
        No trading data available for this day
      </div>
    );
  }

  return (
    <Card
      className="w-full mt-4 border-slate-700/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:shadow-blue-500/10"
      style={{
        backgroundColor: currentTheme === 'dark' ? '#0a0a0a' : 'rgb(243 244 246)',
        backgroundImage: currentTheme === 'dark' ? 'linear-gradient(to bottom right, #0a0a0a, #111111)' : 'none'
      }}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2 bg-blue-500/10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-500/20">
            <TrendingUp className="h-4 w-4 text-blue-400" />
          </div>
          <CardTitle
            className="text-base"
            style={{ color: currentTheme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
          >
            Daily P&L
          </CardTitle>
        </div>
        <div className={`text-base font-semibold ${getLastCumulativePnL() >= 0 ? 'text-blue-400' : 'text-purple-400'}`}>
          {formatCurrency(getLastCumulativePnL())}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
            >
              <defs>
                <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={getLastCumulativePnL() >= 0 ? '#a3a3a3' : '#525252'}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor={getLastCumulativePnL() >= 0 ? '#a3a3a3' : '#525252'}
                    stopOpacity={0.05}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.1} />
              <XAxis
                dataKey="displayDate"
                stroke="#666"
                fontSize={12}
                tickMargin={5}
                angle={-45}
                textAnchor="end"
                height={40}
              />
              <YAxis
                type="number"
                tickFormatter={formatCurrency}
                stroke="#666"
                fontSize={12}
                axisLine={false}
                tickLine={false}
                padding={{ top: 10, bottom: 10 }}
              />
              <RechartsTooltip
                formatter={(value: number) => [
                  <span style={{ color: getLastCumulativePnL() >= 0 ? '#a3a3a3' : '#525252', fontWeight: 'bold' }}>
                    {formatCurrency(value || 0)}
                  </span>,
                  'Daily P&L'
                ]}
                labelFormatter={(label) => label as string}
                contentStyle={{
                  backgroundColor: 'rgba(10, 10, 10, 0.95)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                  color: '#fff',
                  backdropFilter: 'blur(10px)'
                }}
                cursor={{ stroke: 'rgba(255, 255, 255, 0.1)', strokeWidth: 1 }}
                animationDuration={300}
              />
              <Area
                type="monotone"
                dataKey="cumulativePnL"
                stroke={getLastCumulativePnL() >= 0 ? '#a3a3a3' : '#525252'}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: getLastCumulativePnL() >= 0 ? '#d4d4d4' : '#404040', strokeWidth: 2, fill: '#fff' }}
                fill="url(#colorPnl)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

// Update the full content dialog in JournalEntryCard to include the chart
const JournalEntryCard = ({ entry, onSelect, onDelete, theme }: { entry: JournalNote; onSelect: (id: string) => void; onDelete: (id: string) => void; theme: string }) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showFullContent, setShowFullContent] = useState(false);

  // Safety check for theme
  const currentTheme = theme || 'light';

  const handleDelete = async () => {
    setIsDeleting(true);
    await onDelete(entry.id);
    setShowDeleteDialog(false);
    setIsDeleting(false);
  };

  return (
    <>
      <Card
        className="mb-4 border-slate-700/50 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group overflow-hidden hover:shadow-purple-500/10"
        onClick={() => setShowFullContent(true)}
        style={{
          backgroundColor: currentTheme === 'dark' ? '#0a0a0a' : 'rgb(243 244 246)',
          backgroundImage: currentTheme === 'dark' ? 'linear-gradient(to bottom right, #0a0a0a, #111111)' : 'none'
        }}
      >
        <CardHeader className="pb-2 bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors duration-300">
          <div className="flex justify-between items-center">
            <CardTitle
              className="text-base font-medium flex items-center"
              style={{ color: currentTheme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
            >
              <Calendar className="h-3.5 w-3.5 mr-2 text-purple-400" />
              {format(new Date(entry.created_at), 'h:mm a')}
            </CardTitle>
            <div className="flex space-x-1 opacity-70 group-hover:opacity-100 transition-opacity duration-300">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(entry.id);
                }}
                className="h-7 w-7 p-0 rounded-full hover:bg-neutral-700/30 hover:text-neutral-100"
              >
                <Edit className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-400 transition-colors duration-200" />
                <span className="sr-only">Edit</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteDialog(true);
                }}
                className="h-7 w-7 p-0 rounded-full hover:bg-red-500/20 hover:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5 text-slate-400 group-hover:text-red-400 transition-colors duration-200" />
                <span className="sr-only">Delete</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-2 sm:px-4 py-3">
          <div className="prose prose-sm max-w-none prose-invert">
            {entry.note_content ? (
              <div dangerouslySetInnerHTML={{ __html: entry.note_content.substring(0, 150) + (entry.note_content.length > 150 ? '...' : '') }} />
            ) : (
              <p
                className="italic"
                style={{ color: currentTheme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
              >
                No content
              </p>
            )}
          </div>
          {entry.images && entry.images.length > 0 && (
            <div
              className="mt-2 flex items-center text-xs"
              style={{ color: currentTheme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
            >
              <DollarSign className="h-3 w-3 mr-1" /> {entry.images.length} {entry.images.length === 1 ? 'image' : 'images'} attached
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full content dialog */}
      <Dialog open={showFullContent} onOpenChange={setShowFullContent}>
        <DialogContent>
          <div className="animate-in fade-in-50 zoom-in-95 duration-200">
            <DialogHeader className="border-b pb-2">
              <DialogTitle>
                <div className="text-xl flex items-center">
                  <Calendar className="h-5 w-5 mr-2 text-primary" />
                  {format(new Date(entry.created_at), 'MMMM d, yyyy h:mm a')}
                </div>
              </DialogTitle>
              <DialogDescription>
                <div className="text-sm flex items-center justify-between">
                  <span>View your complete journal entry below</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowFullContent(false);
                      onSelect(entry.id);
                    }}
                    className="h-8 mt-2 hover:shadow-sm transition-all duration-200"
                  >
                    <Edit className="h-3.5 w-3.5 mr-1.5" /> Edit Entry
                  </Button>
                </div>
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-6 max-h-[70vh] overflow-y-auto pr-2">
              <div className="prose prose-sm max-w-none">
                {entry.note_content ? (
                  <div dangerouslySetInnerHTML={{ __html: entry.note_content }} />
                ) : (
                  <p className="text-muted-foreground italic">No content</p>
                )}
              </div>
              {entry.images && entry.images.length > 0 && (
                <div className="mt-4 border-t pt-4">
                  <h3 className="text-sm font-medium mb-2">Images</h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {entry.images.map((image) => (
                      <a
                        key={image.id}
                        href={image.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="border rounded-md overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 aspect-video"
                      >
                        <img
                          src={image.url}
                          alt={image.name}
                          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              <JournalEntryPnLChart date={entry.date} theme={currentTheme} />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <div className="animate-in fade-in-50 zoom-in-95 duration-200">
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete your
                journal entry and remove it from our servers.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="transition-all duration-200 hover:shadow-sm">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className={cn(
                  "bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all duration-200 hover:shadow-sm",
                  isDeleting && "opacity-70 cursor-not-allowed"
                )}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

// Add the Editor component
const Editor = ({ value, onValueChange, placeholder }: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
}) => {
  const editorRef = useRef<TiptapEditorRef>(null);

  return (
    <TiptapEditor
      ref={editorRef}
      content={value}
      onChange={onValueChange}
      placeholder={placeholder}
      className="min-h-[300px]"
      editorClassName="min-h-[250px]"
      autofocus={true}
    />
  );
};

export default function Journal() {
  const { theme } = useTheme();

  // Safety check for theme
  const currentTheme = theme || 'light';
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedEntryId, setSelectedEntryId] = useState<string>('');
  const [editorContent, setEditorContent] = useState('');
  const [journalEntriesForDate, setJournalEntriesForDate] = useState<JournalNote[]>([]);
  const [allJournalEntries, setAllJournalEntries] = useState<JournalNote[]>([]);
  const [entriesForSelectedDate, setEntriesForSelectedDate] = useState(0);
  const [dailyPnL, setDailyPnL] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLoadingEntries, setIsLoadingEntries] = useState(true);
  const [uploadedImages, setUploadedImages] = useState<ImageUpload[]>([]);
  const [editorKey, setEditorKey] = useState<number>(0);
  const { toast } = useToast();
  const editorRef = useRef<TiptapEditorRef>(null);
  const supabase = createClient();

  // Helper function to reset editor state
  const resetEditor = useCallback(() => {
    // First clear the content
    setEditorContent('');
    setSelectedEntryId('');
    setUploadedImages([]);

    // Force editor recreation by updating key
    // This ensures a clean state with no conflicts from previous content
    setEditorKey(prev => prev + 1);

    // If editor exists, try to clear it directly
    if (editorRef.current) {
      try {
        editorRef.current.clearContent();
      } catch (e) {
        console.warn('Could not reset editor directly:', e);
      }
    }
  }, []);

  const validateDate = (date: string): boolean => {
    const dateObj = new Date(date);
    return dateObj instanceof Date && !isNaN(dateObj.getTime());
  };

  const loadAllJournalEntries = useCallback(async () => {
    try {
      setIsLoadingEntries(true);
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError) {
        console.error('Authentication error:', authError);
        toast({
          title: "Authentication Error",
          description: authError.message || "Failed to authenticate user",
          variant: "destructive",
        });
        return;
      }

      if (!user) {
        console.error('No authenticated user found');
        setAllJournalEntries([]);
        return;
      }

      console.log('Fetching journal entries for user:', user.id);
      const { data, error } = await supabase
        .from('journal_notes')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching journal entries:', error);
        throw error;
      }

      console.log('Fetched journal entries:', data?.length || 0);
      setAllJournalEntries(data || []);
    } catch (error: any) {
      console.error('Error loading journal entries:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load journal entries",
        variant: "destructive",
      });
      setAllJournalEntries([]);
    } finally {
      setIsLoadingEntries(false);
    }
  }, [toast]);

  const loadJournalEntriesForDate = async (date: string) => {
    console.log(`Loading journal entries for date: ${date}`);
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { data, error } = await supabase
        .from('journal_notes')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', date)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setJournalEntriesForDate(data || []);

      // Get the count directly instead of calling countEntriesForSelectedDate
      setEntriesForSelectedDate(data?.length || 0);

      // Get the PnL data directly instead of calling loadDailyPnL
      const { data: pnlData, error: pnlError } = await supabase
        .from('trades')
        .select('net_pnl')
        .eq('user_id', user.id)
        .eq('entry_date', date);

      if (!pnlError) {
        const totalPnL = pnlData?.reduce((sum: number, trade: { net_pnl: number | null }) =>
          sum + (trade.net_pnl || 0), 0) ?? 0;
        setDailyPnL(totalPnL);
      }

      console.log(`Loaded ${data?.length || 0} journal entries for date: ${date}`);
    } catch (error: any) {
      console.error('Error loading journal entries for date:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load journal entries",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadJournalEntry = useCallback(async () => {
    if (!selectedEntryId) {
      resetEditor();
      return;
    }

    console.log(`Loading journal entry with ID: ${selectedEntryId}`);
    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from('journal_notes')
        .select('*')
        .eq('id', selectedEntryId)
        .single();

      if (error) throw error;

      if (data) {
        setEditorContent(data.note_content || '');
        setSelectedDate(data.date);
        console.log(`Loaded journal entry: ${data.id}`);
      } else {
        resetEditor();
        console.log('No journal entry found with the selected ID');
      }
    } catch (error: any) {
      console.error('Error loading journal entry:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load journal entry",
        variant: "destructive",
      });
      resetEditor();
    } finally {
      setIsLoading(false);
    }
  }, [selectedEntryId, resetEditor, toast]);

  const loadDailyPnL = useCallback(async () => {
    if (!validateDate(selectedDate)) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('trades')
        .select('net_pnl')
        .eq('user_id', user.id)
        .eq('entry_date', selectedDate);

      if (error) throw error;

      const totalPnL = data?.reduce((sum: number, trade: { net_pnl: number | null }) => sum + (trade.net_pnl || 0), 0) ?? 0;
      setDailyPnL(totalPnL);
    } catch (error) {
      console.error('Error loading daily PnL:', error);
      setDailyPnL(null);
    }
  }, [selectedDate, validateDate]);

  const countEntriesForSelectedDate = useCallback(async () => {
    if (!validateDate(selectedDate)) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('journal_notes')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', selectedDate);

      if (error) throw error;

      setEntriesForSelectedDate(data?.length || 0);
    } catch (error) {
      console.error('Error counting entries:', error);
      setEntriesForSelectedDate(0);
    }
  }, [selectedDate, validateDate]);

  // Load data when date changes
  useEffect(() => {
    if (selectedDate) {
      console.log(`Date changed to: ${selectedDate}`);
      loadJournalEntriesForDate(selectedDate);
    }
  }, [selectedDate]);

  // Initial data load when component mounts
  useEffect(() => {
    const initialLoad = async () => {
      setIsLoading(true);
      try {
        console.log('Starting initial data load');

        // Check authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        console.log('[Journal] Initial load - user:', user);
        if (authError || !user) {
          console.error('Authentication error or no user found:', authError);
          return;
        }

        // Load all journal entries for the calendar
        await loadAllJournalEntries();

        // Load entries for today's date
        const today = format(new Date(), 'yyyy-MM-dd');
        setSelectedDate(today);
        await loadJournalEntriesForDate(today);

        console.log('Initial data load completed');
      } catch (error) {
        console.error('Error in initial data load:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initialLoad();
  }, []);

  // Filter entries based on search term
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setAllJournalEntries(journalEntriesForDate);
    } else {
      const filtered = journalEntriesForDate.filter(entry =>
        entry.note_content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (entry.tags && entry.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))) ||
        (entry.emotion && entry.emotion.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setAllJournalEntries(filtered);
    }
  }, [searchTerm, journalEntriesForDate]);

  const groupedEntries = allJournalEntries.reduce((groups, entry) => {
    const date = parseISO(entry.date);
    const monthYear = format(date, 'MMMM yyyy');

    if (!groups[monthYear]) {
      groups[monthYear] = [];
    }

    groups[monthYear].push(entry);
    return groups;
  }, {} as Record<string, JournalNote[]>);

  const handleEntryClick = useCallback((entry: JournalNote) => {
    setSelectedDate(entry.date);
    resetEditor();

    // Apply content after a brief delay to ensure smooth editor reset
    setTimeout(() => {
      setEditorContent(entry.note_content || '');
      setSelectedEntryId(entry.id);
      if (entry.pnl !== null && entry.pnl !== undefined) {
        setDailyPnL(entry.pnl);
      }
      if (entry.images && Array.isArray(entry.images)) {
        setUploadedImages(entry.images);
      } else {
        setUploadedImages([]);
      }
    }, 50);
  }, [resetEditor]);

  const handleImageUpload = async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.setAttribute('type', 'file');
      input.setAttribute('accept', 'image/*');

      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) {
          reject(new Error('No file selected'));
          return;
        }

        try {
          if (file.size > 5 * 1024 * 1024) {
            toast({
              title: "File too large",
              description: "Images must be less than 5MB",
              variant: "destructive",
            });
            reject(new Error('File too large'));
            return;
          }

          toast({
            title: "Uploading image...",
            description: "Your image is being uploaded",
          });

          const { data: { user }, error: authError } = await supabase.auth.getUser();

          if (authError) {
            console.error('Authentication error during image upload:', authError);
            toast({
              title: "Authentication Error",
              description: authError.message || "Failed to authenticate user",
              variant: "destructive",
            });
            reject(authError);
            return;
          }

          if (!user) {
            const noUserError = new Error('No authenticated user found');
            console.error(noUserError);
            toast({
              title: "Authentication Error",
              description: "No authenticated user found",
              variant: "destructive",
            });
            reject(noUserError);
            return;
          }

          console.log('Uploading image for user:', user.id);
          const fileExt = file.name.split('.').pop();
          const fileName = `${uuidv4()}.${fileExt}`;
          const filePath = `${user.id}/journal-images/${fileName}`;

          console.log('Uploading to path:', filePath);
          const { data, error } = await supabase.storage
            .from('journal-images')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: false
            });

          if (error) {
            console.error('Storage upload error:', error);
            throw error;
          }

          console.log('Upload successful, getting public URL');
          const { data: { publicUrl } } = supabase.storage
            .from('journal-images')
            .getPublicUrl(filePath);

          console.log('Public URL:', publicUrl);
          const newImage: ImageUpload = {
            id: fileName,
            url: publicUrl,
            name: file.name,
            size: file.size,
            createdAt: new Date().toISOString()
          };

          setUploadedImages(prev => [...prev, newImage]);

          toast({
            title: "Image uploaded",
            description: "Image successfully added to your journal",
          });

          resolve(publicUrl);
        } catch (error) {
          console.error('Image upload error:', error);
          toast({
            title: "Upload Failed",
            description: error instanceof Error ? error.message : "Failed to upload image",
            variant: "destructive",
          });
          reject(error);
        }
      });

      input.click();
    });
  };

  const handleContentChange = useCallback((value: string) => {
    // Ensure we never set undefined or null as content
    if (typeof value === 'string') {
      setEditorContent(value);
    } else {
      console.warn('Non-string value received in handleContentChange:', value);
      setEditorContent('');
    }
  }, []);

  // Force focus on the editor when it's mounted or key changes
  useEffect(() => {
    if (isLoading) return; // Don't try to focus while loading

    const timer = setTimeout(() => {
      if (editorRef.current) {
        try {
          const editor = editorRef.current.getEditor();
          if (editor) {
            editor.commands.focus();
          }
        } catch (e) {
          console.warn('Could not focus editor:', e);
        }
      }
    }, 300); // Increased timeout for more reliability

    return () => clearTimeout(timer);
  }, [editorKey, isLoading]);

  const saveJournalEntry = async () => {
    if (!validateDate(selectedDate)) {
      toast({
        title: "Invalid Date",
        description: "Please select a valid date",
        variant: "destructive",
      });
      return;
    }

    if (!editorContent.trim()) {
      toast({
        title: "Empty Entry",
        description: "Please add some content to your journal entry",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      console.log('[Journal] saveJournalEntry - user:', user);
      if (!user) {
        toast({
          title: 'No authenticated user',
          description: 'You must be logged in to save a journal entry.',
          variant: 'destructive',
        });
        throw new Error('No authenticated user');
      }
      if (selectedEntryId) {
        console.log('[Journal] Updating journal_notes', { selectedEntryId, userId: user.id });
        const { error } = await supabase
          .from('journal_notes')
          .update({
            note_content: editorContent,
            pnl: dailyPnL ?? null,
            images: uploadedImages,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedEntryId)
          .eq('user_id', user.id);
        if (error) {
          console.error('[Journal] Update error:', error);
          throw error;
        }
        console.log('[Journal] Update success');
        toast({ title: 'Success', description: 'Journal entry updated successfully' });
      } else {
        console.log('[Journal] Inserting new journal_notes', { userId: user.id, selectedDate });
        const { data: existingEntries, error: countError } = await supabase
          .from('journal_notes')
          .select('id')
          .eq('user_id', user.id)
          .eq('date', selectedDate);
        if (countError) {
          console.error('[Journal] Count error:', countError);
          throw countError;
        }
        if (existingEntries && existingEntries.length >= 10) {
          toast({ title: 'Limit Reached', description: 'You can create a maximum of 10 journal entries per day', variant: 'destructive' });
          return;
        }
        const timestamp = new Date().toISOString();
        const journalData = {
          user_id: user.id,
          date: selectedDate,
          note_content: editorContent,
          pnl: dailyPnL ?? null,
          images: uploadedImages,
          created_at: timestamp,
          updated_at: timestamp
        };
        const result = await supabase
          .from('journal_notes')
          .insert(journalData)
          .select()
          .single();
        if (result.error) {
          console.error('[Journal] Insert error:', result.error);
          throw result.error;
        }
        setSelectedEntryId(result.data.id);
        console.log('[Journal] Insert success', result.data);
        toast({ title: 'Success', description: 'New journal entry saved successfully' });
        if (confirm('Would you like to create another new entry?')) {
          resetEditor();
        }
      }
      // Fetch updated entries
      console.log('[Journal] Fetching updated journal_notes after save');
      const { data: updatedEntries, error: entriesError } = await supabase
        .from('journal_notes')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (entriesError) {
        console.error('[Journal] Fetch updated entries error:', entriesError);
      } else {
        console.log('[Journal] Updated entries:', updatedEntries);
        setAllJournalEntries(updatedEntries);
      }
      // Update the count directly
      const { data: countData, error: newCountError } = await supabase
        .from('journal_notes')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', selectedDate);
      if (newCountError) {
        console.error('[Journal] Fetch count error:', newCountError);
      } else {
        console.log('[Journal] Updated count for selected date:', countData?.length);
        setEntriesForSelectedDate(countData?.length || 0);
      }
      // Ensure the latest entries for the selected date are loaded and displayed
      console.log('[Journal] Calling loadJournalEntriesForDate after save');
      await loadJournalEntriesForDate(selectedDate);
    } catch (error: any) {
      console.error('[Journal] Error saving journal entry:', error);
      toast({ title: 'Error', description: error.message || 'Failed to save journal entry', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    if (validateDate(newDate)) {
      setSelectedDate(newDate);
    } else {
      toast({
        title: "Invalid Date",
        description: "Please select a valid date",
        variant: "destructive",
      });
    }
  };

  const createNewEntry = async () => {
    const today = new Date();
    const todayFormatted = format(today, 'yyyy-MM-dd');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { data: todayEntries, error: countError } = await supabase
        .from('journal_notes')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', todayFormatted);

      if (countError) throw countError;

      if (todayEntries && todayEntries.length >= 10) {
        toast({
          title: "Limit Reached",
          description: "You can create a maximum of 10 journal entries per day",
          variant: "destructive",
        });
        return;
      }

      setSelectedDate(todayFormatted);
      resetEditor();
      setDailyPnL(null);

      toast({
        title: "New Entry",
        description: "Created a new blank journal entry for today",
      });

      // Get the PnL data directly instead of calling loadDailyPnL
      const { data: pnlData, error: pnlError } = await supabase
        .from('trades')
        .select('net_pnl')
        .eq('user_id', user.id)
        .eq('entry_date', todayFormatted);

      if (!pnlError) {
        const totalPnL = pnlData?.reduce((sum: number, trade: { net_pnl: number | null }) =>
          sum + (trade.net_pnl || 0), 0) ?? 0;
        setDailyPnL(totalPnL);
      }

      // Get the count directly instead of calling countEntriesForSelectedDate
      const { data: countData, error: newCountError } = await supabase
        .from('journal_notes')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', todayFormatted);

      if (!newCountError) {
        setEntriesForSelectedDate(countData?.length || 0);
      }
    } catch (error: any) {
      console.error('Error checking entry limit:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create new entry",
        variant: "destructive",
      });
    }
  };

  const deleteJournalEntry = async (entryId: string) => {
    if (!entryId) return;

    // Removed window.confirm since we're using AlertDialog now
    setIsLoading(true);
    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from('journal_notes')
        .delete()
        .eq('id', entryId);

      if (error) throw error;

      toast({
        title: "Entry Deleted",
        description: "Journal entry has been deleted successfully",
      });

      // Update the journal entries list without triggering a full reload
      if (selectedDate) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No authenticated user');

        // Get updated entries for the selected date
        const { data: updatedEntries, error: entriesError } = await supabase
          .from('journal_notes')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', selectedDate)
          .order('created_at', { ascending: false });

        if (entriesError) throw entriesError;

        setJournalEntriesForDate(updatedEntries || []);
        setEntriesForSelectedDate(updatedEntries?.length || 0);
      }

      // Update all journal entries for the calendar
      await loadAllJournalEntries();

      // Reset the editor if the deleted entry was the selected one
      if (entryId === selectedEntryId) {
        resetEditor();
        setShowDeleteDialog(false); // Close the dialog if we're deleting the currently selected entry
      }
    } catch (error: any) {
      console.error('Error deleting journal entry:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete journal entry",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full max-w-none py-8 px-2">
      <div className="flex flex-col space-y-8">
        <div className="flex flex-col md:flex-row justify-end items-start md:items-center gap-6">
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              onClick={() => navigate('/app/journal/all-entries')}
              className="transition-all duration-300 hover:shadow-lg border-neutral-700/50 bg-neutral-800/30 hover:bg-neutral-700/50 text-white hover:text-white"
            >
              <FileText className="mr-2 h-4 w-4" /> All Journal Entries
            </Button>

            <DatePicker
              date={selectedDate ? parseISO(selectedDate) : undefined}
              onSelect={(date) => setSelectedDate(format(date, 'yyyy-MM-dd'))}
              className="shadow-sm transition-all duration-300 hover:shadow-lg"
            />

            <Button
              onClick={createNewEntry}
              className="transition-all duration-300 hover:shadow-lg bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700"
            >
              <Plus className="mr-2 h-4 w-4" /> New Entry
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="flex flex-col items-center space-y-6">
              <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-slate-700 border-t-purple-500"></div>
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
              </div>
              <div className="text-center">
                <p
                  className="text-lg font-medium animate-pulse"
                  style={{ color: currentTheme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
                >
                  Loading journal entries...
                </p>
                <p
                  className="text-sm mt-1"
                  style={{ color: currentTheme === 'dark' ? 'rgb(100 116 139)' : 'rgb(75 85 99)' }}
                >
                  Please wait while we fetch your journal data
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {/* Journal entries list */}
            <div className="md:col-span-1 space-y-6">
              <Card
                className="border-slate-700/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:shadow-purple-500/10 overflow-hidden"
                style={{
                  backgroundColor: currentTheme === 'dark' ? '#0a0a0a' : 'rgb(243 244 246)',
                  backgroundImage: currentTheme === 'dark' ? 'linear-gradient(to bottom right, #0a0a0a, #111111)' : 'none'
                }}
              >
                <CardHeader className="bg-purple-500/10 pb-3">
                  <div className="flex justify-between items-center">
                    <CardTitle
                      className="text-lg font-medium flex items-center gap-2"
                      style={{ color: currentTheme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
                    >
                      <div className="p-1.5 rounded-lg bg-purple-500/20">
                        <FileText className="h-4 w-4 text-purple-400" />
                      </div>
                      Journal Entries
                    </CardTitle>
                    <div className="flex items-center px-3 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-full text-sm font-medium text-slate-300">
                      <Calendar className="h-3.5 w-3.5 mr-1.5 text-purple-400" />
                      {format(parseISO(selectedDate || '2023-01-01'), 'MMM d, yyyy')}
                    </div>
                  </div>
                  <CardDescription className="flex items-center mt-2">
                    <span
                      className="flex-1"
                      style={{ color: currentTheme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
                    >
                      {entriesForSelectedDate} {entriesForSelectedDate === 1 ? 'entry' : 'entries'}
                    </span>
                    {dailyPnL !== null && dailyPnL !== 0 && (
                      <span className="px-3 py-1 rounded-full text-sm font-bold bg-neutral-800 text-neutral-300 border border-neutral-700 transition-all duration-300 hover:scale-105 shadow-sm">
                        {dailyPnL >= 0 ? '+' : ''}{dailyPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-2 sm:px-4 py-4">
                  {journalEntriesForDate.length > 0 ? (
                    <div className="space-y-4">
                      {journalEntriesForDate.map((entry, index) => (
                        <div
                          key={entry.id}
                          className="animate-in fade-in slide-in-from-bottom-2"
                          style={{ animationDelay: `${index * 50}ms`, animationDuration: '300ms' }}
                        >
                          <JournalEntryCard
                            entry={entry}
                            onSelect={(id) => {
                              setSelectedEntryId(id);
                              loadJournalEntry();
                            }}
                            onDelete={deleteJournalEntry}
                            theme={currentTheme}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      className="text-center py-12 rounded-xl border-2 border-dashed border-slate-700/50"
                      style={{
                        backgroundColor: currentTheme === 'dark' ? '#050505' : 'rgb(249 250 251)',
                      }}
                    >
                      <div className="animate-in fade-in duration-700 flex flex-col items-center">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center mb-4 border border-purple-500/30">
                          <Circle className="h-8 w-8 text-purple-400" />
                        </div>
                        <h3
                          className="mt-2 text-lg font-semibold"
                          style={{ color: currentTheme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
                        >
                          No entries
                        </h3>
                        <p
                          className="mt-2 text-sm max-w-xs mx-auto"
                          style={{ color: currentTheme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
                        >
                          You don't have any journal entries for this date. Create your first entry to start journaling.
                        </p>
                        <Button
                          onClick={createNewEntry}
                          className="mt-6 shadow-lg transition-all duration-300 hover:shadow-xl bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700"
                          size="sm"
                        >
                          <Plus className="mr-2 h-4 w-4" /> Create New Entry
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {journalEntriesForDate.length > 0 && (
                <JournalEntryPnLChart date={selectedDate} theme={currentTheme} />
              )}
            </div>

            {/* Editor section */}
            <div className="md:col-span-2">
              <Card
                className="border-slate-700/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:shadow-blue-500/10 overflow-hidden"
                style={{
                  backgroundColor: currentTheme === 'dark' ? '#0a0a0a' : 'rgb(243 244 246)',
                  backgroundImage: currentTheme === 'dark' ? 'linear-gradient(to bottom right, #0a0a0a, #111111)' : 'none'
                }}
              >
                <CardHeader className="bg-blue-500/10 pb-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle
                        className="text-lg font-medium group flex items-center"
                        style={{ color: currentTheme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
                      >
                        <div className="p-1.5 rounded-lg bg-blue-500/20 mr-3">
                          <Edit className="h-4 w-4 text-blue-400" />
                        </div>
                        <span>{selectedEntryId ? 'Edit Journal Entry' : 'New Journal Entry'}</span>
                      </CardTitle>
                      <CardDescription
                        className="mt-2"
                        style={{ color: currentTheme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
                      >
                        {selectedDate ? (
                          <span className="inline-flex items-center">
                            <Calendar className="h-3.5 w-3.5 mr-1.5 text-blue-400" />
                            {format(parseISO(selectedDate), 'MMMM d, yyyy')}
                          </span>
                        ) : 'Select a date'}
                      </CardDescription>
                    </div>

                    <div className="flex space-x-3">
                      {selectedEntryId && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowDeleteDialog(true);
                          }}
                          className="text-red-400 border-red-500/30 hover:bg-red-500/20 hover:text-red-300 transition-colors duration-200 bg-red-500/10"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </Button>
                      )}

                      <Button
                        onClick={saveJournalEntry}
                        disabled={!selectedDate || isSaving}
                        className="shadow-lg transition-all duration-300 hover:shadow-xl bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700"
                        size="sm"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" /> Save
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-2 sm:px-4 py-4">
                  <div className="space-y-4">
                    <div
                      className="border border-slate-700/50 rounded-xl overflow-hidden shadow-lg transition-all duration-300 hover:shadow-xl focus-within:shadow-xl"
                      style={{
                        backgroundColor: currentTheme === 'dark' ? '#050505' : 'rgb(249 250 251)',
                      }}
                    >
                      <Editor
                        value={editorContent}
                        onValueChange={handleContentChange}
                        placeholder="Write your trading journal entry here..."
                      />
                    </div>
                    {uploadedImages.length > 0 && (
                      <div className="mt-4">
                        <h3 className="text-sm font-medium mb-2">Uploaded Images</h3>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                          {uploadedImages.map((image) => (
                            <div key={image.id} className="relative group overflow-hidden rounded-md border">
                              <img
                                src={image.url}
                                alt={image.name}
                                className="w-full h-20 object-cover transition-transform duration-300 group-hover:scale-110"
                              />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-white hover:bg-white/20 h-8 w-8 p-0 rounded-full"
                                  onClick={() => {
                                    // Add functionality to remove image if needed
                                    console.log('Would remove image:', image.id);
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Main Delete confirmation dialog for editor view */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <div className="animate-in fade-in-50 zoom-in-95 duration-200">
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete your
                journal entry and remove it from our servers.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="transition-all duration-200 hover:shadow-sm">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteJournalEntry(selectedEntryId)}
                disabled={isDeleting}
                className={cn(
                  "bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all duration-200 hover:shadow-sm",
                  isDeleting && "opacity-70 cursor-not-allowed"
                )}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 