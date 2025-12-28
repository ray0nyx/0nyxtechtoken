import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import {
  Calendar,
  DollarSign,
  Save,
  Plus,
  Trash2,
  Edit,
  Loader2,
  X,
  Circle,
  TrendingUp,
  FileText,
  Settings,
  BarChart3,
  Brain,
  Target,
  Activity
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
import { supabase } from '@/lib/supabase';
import TiptapEditor, { TiptapEditorRef } from '@/components/editor/TiptapEditor';
import { DatePicker } from '@/components/ui/date-picker';
import { useNavigate } from 'react-router-dom';

// Import new components
import { MoodSelector } from '@/components/journal/MoodSelector';
import { TagInput } from '@/components/journal/TagInput';
import { TradingMetrics } from '@/components/journal/TradingMetrics';
import { JournalTemplates } from '@/components/journal/JournalTemplates';
import { EnhancedJournalEntryCard } from '@/components/journal/EnhancedJournalEntryCard';
import { JournalCalendar } from '@/components/journal/JournalCalendar';
import { JournalSearch } from '@/components/journal/JournalSearch';

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

export default function EnhancedJournal() {
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
  const [filteredEntries, setFilteredEntries] = useState<JournalNote[]>([]);
  const [entriesForSelectedDate, setEntriesForSelectedDate] = useState(0);
  const [dailyPnL, setDailyPnL] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLoadingEntries, setIsLoadingEntries] = useState(true);
  const [uploadedImages, setUploadedImages] = useState<ImageUpload[]>([]);
  const [editorKey, setEditorKey] = useState<number>(0);
  const [selectedMood, setSelectedMood] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const { toast } = useToast();
  const editorRef = useRef<TiptapEditorRef>(null);

  // Load all journal entries
  const loadAllJournalEntries = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: entries, error } = await supabase
        .from('journal_notes')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAllJournalEntries(entries || []);
      setFilteredEntries(entries || []);
    } catch (error) {
      console.error('Error loading journal entries:', error);
    }
  }, []);

  // Load journal entries for selected date
  const loadJournalEntriesForDate = useCallback(async (date: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: entries, error } = await supabase
        .from('journal_notes')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', date)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setJournalEntriesForDate(entries || []);
      setEntriesForSelectedDate(entries?.length || 0);
    } catch (error) {
      console.error('Error loading journal entries for date:', error);
    }
  }, []);

  // Load daily P&L
  const loadDailyPnL = useCallback(async (date: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: trades, error } = await supabase
        .from('trades')
        .select('net_pnl')
        .eq('user_id', user.id)
        .eq('entry_date', date);

      if (error) throw error;
      const totalPnL = trades?.reduce((sum, trade) => sum + (trade.net_pnl || 0), 0) ?? 0;
      setDailyPnL(totalPnL);
    } catch (error) {
      console.error('Error loading daily P&L:', error);
    }
  }, []);

  // Load selected journal entry
  const loadJournalEntry = useCallback(async () => {
    if (!selectedEntryId) return;

    try {
      const { data: entry, error } = await supabase
        .from('journal_notes')
        .select('*')
        .eq('id', selectedEntryId)
        .single();

      if (error) throw error;
      if (entry) {
        setEditorContent(entry.note_content || '');
        setSelectedMood(entry.emotion || '');
        setSelectedTags(entry.tags || []);
        setUploadedImages(entry.images || []);
      }
    } catch (error) {
      console.error('Error loading journal entry:', error);
    }
  }, [selectedEntryId]);

  // Reset editor
  const resetEditor = useCallback(() => {
    setEditorContent('');
    setSelectedEntryId('');
    setSelectedMood('');
    setSelectedTags([]);
    setUploadedImages([]);
    setEditorKey(prev => prev + 1);
    
    if (editorRef.current) {
      try {
        editorRef.current.clearContent();
      } catch (e) {
        console.warn('Could not reset editor directly:', e);
      }
    }
  }, []);

  // Save journal entry
  const saveJournalEntry = async () => {
    if (!selectedDate) return;

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const journalData = {
        user_id: user.id,
        date: selectedDate,
        note_content: editorContent,
        pnl: dailyPnL ?? null,
        emotion: selectedMood || null,
        tags: selectedTags.length > 0 ? selectedTags : null,
        images: uploadedImages,
        updated_at: new Date().toISOString()
      };

      if (selectedEntryId) {
        // Update existing entry
        const { error } = await supabase
          .from('journal_notes')
          .update(journalData)
          .eq('id', selectedEntryId);

        if (error) throw error;
        toast({ title: 'Success', description: 'Journal entry updated successfully' });
      } else {
        // Create new entry
        const { error } = await supabase
          .from('journal_notes')
          .insert([{ ...journalData, created_at: new Date().toISOString() }]);

        if (error) throw error;
        toast({ title: 'Success', description: 'New journal entry saved successfully' });
      }

      // Refresh data
      await loadAllJournalEntries();
      await loadJournalEntriesForDate(selectedDate);
    } catch (error: any) {
      console.error('Error saving journal entry:', error);
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to save journal entry', 
        variant: 'destructive' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete journal entry
  const deleteJournalEntry = async (entryId: string) => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('journal_notes')
        .delete()
        .eq('id', entryId);

      if (error) throw error;
      toast({ title: 'Entry Deleted', description: 'Journal entry has been deleted successfully' });

      await loadAllJournalEntries();
      await loadJournalEntriesForDate(selectedDate);
      
      if (entryId === selectedEntryId) {
        resetEditor();
        setShowDeleteDialog(false);
      }
    } catch (error: any) {
      console.error('Error deleting journal entry:', error);
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to delete journal entry', 
        variant: 'destructive' 
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle template selection
  const handleTemplateSelect = (template: any) => {
    setEditorContent(template.content);
    setSelectedTags(template.tags);
    setShowTemplates(false);
    toast({ title: 'Template Applied', description: `${template.name} template loaded` });
  };

  // Calculate trading metrics
  const tradingMetrics = useMemo(() => {
    const todayEntries = journalEntriesForDate;
    const totalTrades = todayEntries.length;
    const profitableTrades = todayEntries.filter(entry => (entry.pnl || 0) > 0).length;
    const winRate = totalTrades > 0 ? (profitableTrades / totalTrades) * 100 : 0;
    const avgWin = todayEntries.filter(e => (e.pnl || 0) > 0).reduce((sum, e) => sum + (e.pnl || 0), 0) / Math.max(profitableTrades, 1);
    const avgLoss = todayEntries.filter(e => (e.pnl || 0) < 0).reduce((sum, e) => sum + (e.pnl || 0), 0) / Math.max(totalTrades - profitableTrades, 1);
    
    return {
      winRate,
      totalTrades,
      avgWin: Math.abs(avgWin),
      avgLoss: Math.abs(avgLoss),
      profitFactor: avgLoss > 0 ? avgWin / avgLoss : 0
    };
  }, [journalEntriesForDate]);

  // Load data on mount and date change
  useEffect(() => {
    loadAllJournalEntries();
  }, [loadAllJournalEntries]);

  useEffect(() => {
    if (selectedDate) {
      loadJournalEntriesForDate(selectedDate);
      loadDailyPnL(selectedDate);
    }
  }, [selectedDate, loadJournalEntriesForDate, loadDailyPnL]);

  useEffect(() => {
    if (selectedEntryId) {
      loadJournalEntry();
    }
  }, [selectedEntryId, loadJournalEntry]);

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex flex-col space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-purple-500">
              Enhanced Trading
            </h1>
            <p className="text-muted-foreground">
              Track your trades, emotions, and performance with advanced analytics
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              onClick={() => navigate('/app/journal/all-entries')}
              className="transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <FileText className="mr-2 h-4 w-4" /> All Entries
            </Button>
            
            <Button
              variant="outline"
              onClick={() => setViewMode(viewMode === 'calendar' ? 'list' : 'calendar')}
              className="transition-all duration-200 shadow-sm hover:shadow-md"
            >
              {viewMode === 'calendar' ? <BarChart3 className="mr-2 h-4 w-4" /> : <Calendar className="mr-2 h-4 w-4" />}
              {viewMode === 'calendar' ? 'List View' : 'Calendar View'}
            </Button>
            
            <DatePicker
              date={selectedDate ? parseISO(selectedDate) : undefined}
              onSelect={(date) => setSelectedDate(format(date, 'yyyy-MM-dd'))}
              className="shadow-sm transition-all duration-200 hover:shadow"
            />
            
            <Button 
              onClick={() => {
                resetEditor();
                setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
              }}
              className="transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <Plus className="mr-2 h-4 w-4" /> New Entry
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Search and Filter */}
            <JournalSearch 
              entries={allJournalEntries}
              onFilteredEntries={setFilteredEntries}
            />

            {/* Calendar View */}
            {viewMode === 'calendar' && (
              <JournalCalendar
                entries={allJournalEntries}
                selectedDate={selectedDate}
                onDateSelect={setSelectedDate}
                onNewEntry={() => {
                  resetEditor();
                  setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
                }}
              />
            )}

            {/* Trading Metrics */}
            <TradingMetrics
              dailyPnL={dailyPnL}
              {...tradingMetrics}
            />
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3 space-y-6">
            {/* Journal Entries List */}
            <Card className="border shadow-sm transition-all duration-300 hover:shadow-md">
              <CardHeader className="bg-muted/30 pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg font-medium">Journal Entries</CardTitle>
                  <div className="flex items-center px-2 py-1 bg-background border rounded-full text-sm font-medium">
                    <Calendar className="h-3.5 w-3.5 mr-1 text-primary" />
                    {format(parseISO(selectedDate || '2023-01-01'), 'MMM d, yyyy')}
                  </div>
                </div>
                <CardDescription className="flex items-center mt-1">
                  <span className="flex-1">
                    {entriesForSelectedDate} {entriesForSelectedDate === 1 ? 'entry' : 'entries'}
                  </span>
                  {dailyPnL !== null && dailyPnL !== 0 && (
                    <span className={`px-2 py-0.5 rounded-md text-sm font-medium ${dailyPnL >= 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'} transition-all duration-300 hover:scale-105`}>
                      {dailyPnL >= 0 ? '+' : ''}{Math.abs(dailyPnL) >= 1 ? Math.round(dailyPnL) : dailyPnL.toFixed(2)}
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                {journalEntriesForDate.length > 0 ? (
                  <div className="space-y-4">
                    {journalEntriesForDate.map((entry, index) => (
                      <div 
                        key={entry.id}
                        className="animate-in fade-in slide-in-from-bottom-2"
                        style={{ animationDelay: `${index * 50}ms`, animationDuration: '300ms' }}
                      >
                        <EnhancedJournalEntryCard 
                          entry={entry} 
                          onSelect={(id) => {
                            setSelectedEntryId(id);
                          }} 
                          onDelete={deleteJournalEntry}
                          isSelected={selectedEntryId === entry.id}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/5">
                    <div className="animate-in fade-in duration-700 flex flex-col items-center">
                      <Circle className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
                      <h3 className="mt-4 text-lg font-semibold">No entries</h3>
                      <p className="mt-2 text-sm text-muted-foreground max-w-xs mx-auto">
                        You don't have any journal entries for this date. Create your first entry to start journaling.
                      </p>
                      <Button 
                        onClick={() => {
                          resetEditor();
                          setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
                        }} 
                        className="mt-6 shadow-sm transition-all duration-200 hover:shadow-md"
                        size="sm"
                      >
                        <Plus className="mr-2 h-4 w-4" /> Create New Entry
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Editor Section */}
            <Card className="border shadow-sm transition-all duration-300 hover:shadow-md">
              <CardHeader className="bg-muted/30 pb-3">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-lg font-medium group flex items-center">
                      <span className="mr-2">{selectedEntryId ? 'Edit Journal Entry' : 'New Journal Entry'}</span>
                      {selectedEntryId && (
                        <Edit className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors duration-200" />
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {selectedDate ? (
                        <span className="inline-flex items-center">
                          <Calendar className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                          {format(parseISO(selectedDate), 'MMMM d, yyyy')}
                        </span>
                      ) : 'Select a date'}
                    </CardDescription>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTemplates(!showTemplates)}
                    >
                      <FileText className="mr-2 h-4 w-4" /> Templates
                    </Button>
                    
                    {selectedEntryId && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowDeleteDialog(true)}
                        className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive/90 transition-colors duration-200"
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </Button>
                    )}
                    
                    <Button
                      onClick={saveJournalEntry}
                      disabled={!selectedDate || isSaving}
                      className="shadow-sm transition-all duration-200 hover:shadow-md"
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
              <CardContent className="p-4 space-y-6">
                {/* Templates */}
                {showTemplates && (
                  <JournalTemplates onTemplateSelect={handleTemplateSelect} />
                )}

                {/* Mood and Tags */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <MoodSelector
                    selectedMood={selectedMood}
                    onMoodSelect={setSelectedMood}
                  />
                  <TagInput
                    tags={selectedTags}
                    onTagsChange={setSelectedTags}
                  />
                </div>

                {/* Editor */}
                <div className="border rounded-md overflow-hidden shadow-sm transition-all duration-200 hover:shadow focus-within:shadow">
                  <TiptapEditor
                    key={editorKey}
                    ref={editorRef}
                    value={editorContent}
                    onValueChange={setEditorContent}
                    placeholder="Write your trading journal entry here..."
                    autofocus={true}
                  />
                </div>

                {/* Images */}
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
                                setUploadedImages(prev => prev.filter(img => img.id !== image.id));
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
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      {/* Delete Confirmation Dialog */}
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
