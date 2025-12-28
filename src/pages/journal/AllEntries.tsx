import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  Calendar,
  ArrowLeft,
  Loader2,
  FileText,
  AlertCircle
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { useTheme } from '@/components/ThemeProvider';

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
  images?: any[];
}

export default function AllJournalEntries() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme } = useTheme();
  const [entries, setEntries] = useState<JournalNote[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<JournalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'pnl-desc' | 'pnl-asc'>('date-desc');
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        console.error("No active session found");
        setLoading(false);
        setError("Authentication error. Please sign in again.");
        return;
      }

      // Fetch journal entries directly using session user ID
      const { data: entriesData, error: entriesError } = await supabase
        .from("journal_notes")
        .select("*")
        .eq("user_id", session.user.id)
        .order("date", { ascending: false });

      if (entriesError) {
        console.error("Error fetching journal entries:", entriesError);
        setLoading(false);
        setError("Error fetching journal entries. Please try again.");
        return;
      }

      if (entriesData && entriesData.length > 0) {
        // Fetch all trades for the user to aggregate PnL by date
        const { data: tradesData, error: tradesError } = await supabase
          .from("trades")
          .select("entry_date, exit_date, date, net_pnl, pnl")
          .eq("user_id", session.user.id);

        console.log("Trades fetched for PnL aggregation:", tradesData?.length || 0);

        if (!tradesError && tradesData && tradesData.length > 0) {
          // Aggregate PnL by date (check entry_date, exit_date, and date fields)
          const pnlByDate: Record<string, number> = {};

          tradesData.forEach(trade => {
            // Try net_pnl first, then fall back to pnl
            const tradePnl = trade.net_pnl ?? trade.pnl ?? 0;

            // Add PnL to all relevant dates (entry, exit, and general date)
            const dates = [trade.entry_date, trade.exit_date, trade.date].filter(Boolean);
            dates.forEach(d => {
              if (d) {
                pnlByDate[d] = (pnlByDate[d] || 0) + tradePnl;
              }
            });
          });

          console.log("PnL by date aggregation:", pnlByDate);

          // Merge aggregated PnL into entries
          const entriesWithPnL = entriesData.map(entry => ({
            ...entry,
            pnl: pnlByDate[entry.date] ?? entry.pnl ?? 0
          }));

          console.log("Entries with PnL:", entriesWithPnL.map(e => ({ date: e.date, pnl: e.pnl })));

          setEntries(entriesWithPnL);
          setFilteredEntries(entriesWithPnL);
        } else {
          console.log("No trades found or error:", tradesError);
          setEntries(entriesData);
          setFilteredEntries(entriesData);
        }
      } else {
        setEntries([]);
        setFilteredEntries([]);
      }
      setLoading(false);
    } catch (error) {
      console.error("Unexpected error:", error);
      setLoading(false);
      setError("An unexpected error occurred. Please try again.");
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  // Handle search and filtering
  useEffect(() => {
    if (!entries.length) return;

    let result = [...entries];

    // Apply search term filtering
    if (searchTerm) {
      result = result.filter(entry =>
        entry.note_content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.date?.includes(searchTerm) ||
        (entry.tags && entry.tags.some(tag =>
          tag.toLowerCase().includes(searchTerm.toLowerCase())
        ))
      );
    }

    // Apply sorting
    switch (sortBy) {
      case 'date-desc':
        result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        break;
      case 'date-asc':
        result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        break;
      case 'pnl-desc':
        result.sort((a, b) => (b.pnl || 0) - (a.pnl || 0));
        break;
      case 'pnl-asc':
        result.sort((a, b) => (a.pnl || 0) - (b.pnl || 0));
        break;
    }

    setFilteredEntries(result);
  }, [entries, searchTerm, sortBy]);

  // Format date string
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';

    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'MMM d, yyyy') : 'Invalid Date';
  };

  // Strip HTML tags for preview
  const stripHtml = (html: string) => {
    if (!html) return '';
    return html.replace(/<[^>]*>?/gm, '');
  };

  // Navigate to journal page with specific entry
  const viewEntry = (date: string) => {
    navigate(`/app/journal`, { state: { selectedDate: date } });
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => navigate('/app/journal')}
            className="flex items-center transition-all duration-300 hover:shadow-lg border-neutral-700/50 hover:bg-neutral-700/50"
            style={{
              backgroundColor: theme === 'dark' ? '#050505' : 'rgb(243 244 246)',
              color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)',
            }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Journal
          </Button>
        </div>

        {error && (
          <div className="bg-gradient-to-br from-red-900/20 to-red-800/10 border border-red-500/30 text-red-300 p-4 md:p-6 rounded-xl relative shadow-lg shadow-red-500/10">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <h4
                className="font-semibold"
                style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
              >
                Error
              </h4>
            </div>
            <p className="mt-2 text-sm text-red-200">{error}</p>
          </div>
        )}

        <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4 md:items-center">
          <div className="flex w-full md:w-auto gap-3">
            <div className="relative flex-grow">
              <Search
                className="absolute left-3 top-3 h-4 w-4"
                style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
              />
              <Input
                type="search"
                placeholder="Search entries..."
                className="pl-10 w-full md:w-[300px] border-slate-700/50 focus:border-blue-500/50 focus:ring-blue-500/20"
                style={{
                  backgroundColor: theme === 'dark' ? '#050505' : 'rgb(249 250 251)',
                  color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)',
                }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="px-4 py-2 rounded-lg border border-slate-700/50 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-blue-500/20 h-10 w-[200px]"
              style={{
                backgroundColor: theme === 'dark' ? '#050505' : 'rgb(249 250 251)',
                color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)',
              }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="date-desc">Newest first</option>
              <option value="date-asc">Oldest first</option>
              <option value="pnl-desc">Highest P&L first</option>
              <option value="pnl-asc">Lowest P&L first</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64 rounded-xl bg-gradient-to-br from-slate-900/50 to-slate-800/30 border border-slate-700/50 shadow-lg">
            <div className="flex flex-col items-center space-y-6">
              <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-slate-700 border-t-purple-500"></div>
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
              </div>
              <div className="text-center">
                <p
                  className="text-lg font-medium animate-pulse"
                  style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
                >
                  Loading journal entries...
                </p>
                <p
                  className="text-sm mt-1"
                  style={{ color: theme === 'dark' ? 'rgb(100 116 139)' : 'rgb(75 85 99)' }}
                >
                  Please wait while we fetch your journal data
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div
              className="text-sm mb-4 px-4 py-2 rounded-lg border border-slate-700/50"
              style={{
                backgroundColor: theme === 'dark' ? '#050505' : 'rgb(249 250 251)',
                color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)',
              }}
            >
              Displaying {filteredEntries.length} of {entries.length} entries
            </div>

            {filteredEntries.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredEntries.map((entry, index) => (
                  <Card
                    key={entry.id}
                    className="border-neutral-800 hover:shadow-xl transition-all duration-300 cursor-pointer group animate-in fade-in-50"
                    style={{
                      animationDelay: `${index * 30}ms`,
                      backgroundColor: theme === 'dark' ? '#000000' : 'rgb(243 244 246)',
                      backgroundImage: 'none'
                    }}
                    onClick={() => viewEntry(entry.date)}
                  >
                    <CardHeader className="pb-2 bg-neutral-900/10 group-hover:bg-neutral-900/20 transition-colors duration-300 border-b border-neutral-800">
                      <div className="flex justify-between items-center">
                        <CardTitle
                          className="text-base font-medium flex items-center gap-2"
                          style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
                        >
                          <Calendar className="h-3.5 w-3.5 text-neutral-400" />
                          {formatDate(entry.date)}
                        </CardTitle>
                        {entry.pnl !== undefined && entry.pnl !== null && entry.pnl !== 0 ? (
                          <div className={`text-sm font-semibold px-3 py-1 rounded-full shadow-sm ${entry.pnl > 0
                            ? 'bg-green-900/30 text-green-400 border border-green-700/50'
                            : 'bg-red-900/30 text-red-400 border border-red-700/50'
                            }`}>
                            {entry.pnl >= 0 ? '+' : ''}{entry.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        ) : null}
                      </div>
                      <CardDescription
                        className="text-xs"
                        style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
                      >
                        {format(new Date(entry.created_at), 'h:mm a')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-3 pb-4">
                      <div className="prose prose-sm max-w-none line-clamp-3 prose-invert">
                        {stripHtml(entry.note_content).substring(0, 150)}
                        {stripHtml(entry.note_content).length > 150 && '...'}
                      </div>

                      {entry.tags && entry.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {entry.tags.slice(0, 3).map((tag, i) => (
                            <div
                              key={i}
                              className="px-2 py-0.5 rounded-full text-xs border border-slate-700/50"
                              style={{
                                backgroundColor: theme === 'dark' ? '#050505' : 'rgb(243 244 246)',
                                color: theme === 'dark' ? 'rgb(203 213 225)' : 'rgb(55 65 81)',
                              }}
                            >
                              {tag}
                            </div>
                          ))}
                          {entry.tags.length > 3 && (
                            <div
                              className="px-2 py-0.5 rounded-full text-xs border border-slate-700/50"
                              style={{
                                backgroundColor: theme === 'dark' ? '#050505' : 'rgb(243 244 246)',
                                color: theme === 'dark' ? 'rgb(203 213 225)' : 'rgb(55 65 81)',
                              }}
                            >
                              +{entry.tags.length - 3} more
                            </div>
                          )}
                        </div>
                      )}

                      {entry.images && entry.images.length > 0 && (
                        <div
                          className="mt-2 text-xs flex items-center"
                          style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
                        >
                          <FileText className="h-3 w-3 mr-1" />
                          {entry.images.length} {entry.images.length === 1 ? 'image' : 'images'}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="flex justify-center items-center h-64 rounded-xl bg-gradient-to-br from-slate-900/50 to-slate-800/30 border border-slate-700/50 shadow-lg">
                <div className="text-center space-y-6">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center mx-auto border border-purple-500/30">
                    <FileText className="h-8 w-8 text-purple-400" />
                  </div>
                  <div>
                    <h3
                      className="text-lg font-semibold"
                      style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
                    >
                      No journal entries found
                    </h3>
                    <p
                      className="text-sm max-w-md mt-2"
                      style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
                    >
                      {searchTerm
                        ? `No entries match your search "${searchTerm}". Try another search term.`
                        : "You haven't created any journal entries yet. Start journaling to track your trading progress."}
                    </p>
                  </div>
                  <div className="flex gap-3 justify-center">
                    {searchTerm && (
                      <Button
                        variant="outline"
                        onClick={() => setSearchTerm('')}
                        className="mt-2 border-neutral-700/50 hover:bg-neutral-700/50"
                        style={{
                          backgroundColor: theme === 'dark' ? '#050505' : 'rgb(243 244 246)',
                          color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)',
                        }}
                      >
                        Clear search
                      </Button>
                    )}
                    {!searchTerm && (
                      <Button
                        onClick={() => navigate('/app/journal')}
                        className="mt-2 bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 shadow-lg"
                      >
                        Create journal entry
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
} 