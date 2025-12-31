import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, AlertCircle, RefreshCw, Wallet } from 'lucide-react';
import { SharePnLImage } from '@/components/trades/SharePnLImage';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useTheme } from '@/components/ThemeProvider';
import { Checkbox } from "@/components/ui/checkbox";
import type { CheckedState } from "@radix-ui/react-checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { processTradovateCSVContent, sendTradovateData } from '@/lib/tradovate-processor';
import { useUser } from '@/lib/UserContext';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { TopstepXUploadForm } from '@/components/trades/TopstepXUploadForm';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface Trade {
  id: string;
  user_id: string;
  account_id: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  exit_price: number;
  timestamp: string;
  exit_time: string;
  pnl: number;
  net_pnl: number;
  fees: number;
  trade_date: string;
  platform: string;
  notes: string;
  analytics: any;
  duration_seconds: number;
  extended_data: any;
  created_at: string;
  updated_at: string;
  entry_price?: number;
  entry_date?: string;
  exit_date?: string;
  boughtTimestamp?: string;
  soldTimestamp?: string;
}

interface Account {
  id: string;
  user_id: string;
  name: string;
  platform: string;
  starting_balance: number;
  current_balance: number;
  created_at: string;
  updated_at: string;
}

export default function Trades() {
  const { toast } = useToast();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { user } = useUser();
  const supabase = createClient();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tradeToDelete, setTradeToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastTrade, setLastTrade] = useState<Trade | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedTrades, setSelectedTrades] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [brokerFilter, setBrokerFilter] = useState<'all' | 'futures' | 'solana'>('all');

  useEffect(() => {
    fetchTrades();
  }, []);


  useEffect(() => {
    const fetchAccounts = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('accounts')
          .select('*')
          .eq('user_id', user.id);

        if (error) {
          throw error;
        }

        // Just set the selected account
        if (data && data.length > 0) {
          setSelectedAccount(data[0]);
        }
      } catch (error) {
        console.error('Error fetching accounts:', error);
      }
    };

    fetchAccounts();
  }, [user]);

  const fetchTrades = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      const { data, error } = await supabase
        .from("trades")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching trades:", error);
        throw error;
      }

      // Ensure data is an array even if null/undefined
      const tradesData = data || [];
      setTrades(tradesData);

      // Set the last trade for sharing
      if (tradesData.length > 0) {
        setLastTrade(tradesData[0]);
      } else {
        setLastTrade(null);
      }
    } catch (err) {
      console.error("Error fetching trades:", err);
      setError("Failed to load trades. Please try again later.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      // Call refresh_analytics_for_user to update analytics as well
      try {
        // @ts-ignore - Supabase RPC function
        const { error } = await supabase.rpc('refresh_analytics_for_user', {
          p_user_id: user.id
        });

        if (error) {
          console.error('Error refreshing analytics:', error);
          toast({
            title: "Error",
            description: "Failed to refresh analytics data",
            variant: "destructive",
          });
        }
      } catch (analyticsError) {
        console.error('Error refreshing analytics:', analyticsError);
        // Continue with trade refresh even if analytics refresh fails
      }

      // Fetch the updated trades
      await fetchTrades();

      toast({
        title: "Success",
        description: "Trades refreshed successfully",
      });
    } catch (error) {
      console.error('Error in handleRefresh:', error);
      toast({
        title: "Error",
        description: "Failed to refresh trades data",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const deleteTrade = async (id: string) => {
    try {
      setIsDeleting(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      let deleteSuccess = false;

      // First try to use our RPC function
      try {
        const { data, error } = await supabase.rpc('delete_trade_safely', {
          p_trade_id: id,
          p_user_id: user.id
        });

        if (error) {
          console.error("RPC delete failed:", error);
          // Don't throw, just log and fall back to direct delete
        } else if (data === true) {
          deleteSuccess = true;
        }
      } catch (rpcError) {
        console.error("RPC delete failed, falling back to direct delete:", rpcError);
        // Fall back to direct delete if RPC failed
      }

      // Fallback: direct delete if RPC didn't succeed
      if (!deleteSuccess) {
        try {
          const { error } = await supabase
            .from("trades")
            .delete()
            .match({ id: id, user_id: user.id });  // Use match to ensure we only delete user's own trades

          if (error) {
            // If there's an analytics error but the trade might have been deleted
            if (error.code === 'P0001' && error.message.includes('No metrics found')) {
              console.warn("Analytics error but trade may have been deleted:", error);
              // Check if the trade still exists
              const { data: checkData } = await supabase
                .from("trades")
                .select("id")
                .eq("id", id)
                .eq("user_id", user.id)
                .single();

              if (!checkData) {
                // Trade is gone, so deletion worked despite the error
                console.log("Trade was deleted successfully despite analytics error");
                deleteSuccess = true;
              } else {
                // Trade still exists, actual failure
                throw error;
              }
            } else {
              // Not an analytics error, must be a real failure
              console.error("Direct delete failed:", error);
              throw error;
            }
          } else {
            deleteSuccess = true;
          }
        } catch (directDeleteError: any) {
          // If it's not the "No metrics found" error, rethrow
          if (directDeleteError.code !== 'P0001' ||
            !directDeleteError.message?.includes('No metrics found')) {
            throw directDeleteError;
          }
          // Otherwise, continue as the trade might still have been deleted
          deleteSuccess = true;
        }
      }

      // Only update state if deletion was successful
      if (deleteSuccess) {
        // Remove the deleted trade from the state
        const updatedTrades = trades.filter(trade => trade.id !== id);
        setTrades(updatedTrades);

        // Update last trade if needed
        if (updatedTrades.length > 0) {
          setLastTrade(updatedTrades[0]);
        } else {
          setLastTrade(null);
        }

        // Clear selection if this trade was selected
        const newSelectedTrades = new Set(selectedTrades);
        newSelectedTrades.delete(id);
        setSelectedTrades(newSelectedTrades);

        toast({
          title: "Success",
          description: "Trade deleted successfully",
        });
      } else {
        throw new Error("Failed to delete trade");
      }

    } catch (err) {
      console.error("Error deleting trade:", err);
      toast({
        title: "Error",
        description: "Failed to delete trade. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setTradeToDelete(null);
    }
  };

  const handleTradovateUpload = async (file: File) => {
    if (!file) {
      toast({
        title: "No file selected",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(true);

      // Read the file content
      const fileContent = await file.text();

      console.log('File content preview:', fileContent.substring(0, 200) + '...');
      console.log('Processing Tradovate CSV file...');

      // Process the CSV file
      try {
        // Use the new function to process the CSV
        const processedTrades = processTradovateCSVContent(fileContent);
        console.log(`Successfully processed ${processedTrades.length} trades`);

        if (processedTrades.length === 0) {
          throw new Error('No valid trades found in the CSV file');
        }

        console.log('Sample processed trade:', processedTrades[0]);

        // Send the processed trades to the server
        if (user) {
          // Use the new function to send the data to the server
          const result = await sendTradovateData(
            user.id,
            selectedAccount?.id || null,
            processedTrades
          );

          console.log('Upload result:', result);

          // Refresh the trades
          await fetchTrades();

          // Update the UI
          toast({
            title: "Upload successful",
            description: `Processed ${processedTrades.length} trades`,
          });
        } else {
          throw new Error('User not authenticated');
        }
      } catch (error: any) {
        console.error('Error processing CSV:', error);

        // Check if this is a missing fields error
        if (error.message && error.message.includes('Missing required fields')) {
          toast({
            title: "CSV Format Error",
            description: "Your CSV is missing required fields. Please check that it contains columns for trade symbol, date, quantity, entry price and exit price.",
            variant: "destructive",
          });
        } else if (error.message && error.message.includes('invalid input syntax for type numeric')) {
          // Handle numeric format errors
          toast({
            title: "Invalid Number Format",
            description: "There are invalid numeric values in your CSV. Please ensure price and quantity fields contain valid numbers.",
            variant: "destructive",
          });
        } else {
          // Generic error
          toast({
            title: "Upload failed",
            description: error.message || "An error occurred while processing your CSV file",
            variant: "destructive",
          });
        }
      }
    } catch (error: any) {
      console.error('File reading error:', error);
      toast({
        title: "File error",
        description: "Could not read the file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  // Handle file selection 
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleTradovateUpload(file);
    }
  };

  // Trigger the file input click
  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleImportSuccess = () => {
    setShowImportDialog(false);
    // Refresh trades
    if (user) {
      fetchTrades();
    }
    toast({
      title: 'Success',
      description: 'Trades imported successfully!',
    });
  };

  const handleSelectAll = (checked: boolean | "indeterminate") => {
    if (checked === true) {
      const allIds = trades.map(trade => trade.id);
      setSelectedTrades(new Set(allIds));
    } else {
      setSelectedTrades(new Set());
    }
    setSelectAll(checked === true);
  };

  const handleSelectTrade = (checked: boolean | "indeterminate", id: string) => {
    const newSelectedTrades = new Set(selectedTrades);
    if (checked === true) {
      newSelectedTrades.add(id);
    } else {
      newSelectedTrades.delete(id);
    }
    setSelectedTrades(newSelectedTrades);
  };

  // Filter trades based on broker filter
  const filteredTrades = trades.filter(trade => {
    if (brokerFilter === 'all') return true;
    if (brokerFilter === 'solana') return trade.platform === 'solana' || (trade as any).broker === 'solana';
    if (brokerFilter === 'futures') return trade.platform !== 'solana' && (trade as any).broker !== 'solana';
    return true;
  });

  const deleteSelectedTrades = async () => {
    try {
      setIsDeleting(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      const selectedTradesArray = Array.from(selectedTrades);
      const successfullyDeletedTrades = new Set<string>();

      // Process deletions one by one to track which ones succeed
      for (const tradeId of selectedTradesArray) {
        try {
          let deleteSuccess = false;

          // Try RPC function first
          try {
            const { data, error } = await supabase.rpc('delete_trade_safely', {
              p_trade_id: tradeId,
              p_user_id: user.id
            });

            if (error) {
              console.error("RPC delete failed for trade:", tradeId, error);
            } else if (data === true) {
              deleteSuccess = true;
            }
          } catch (rpcError) {
            console.error("RPC delete failed for trade:", tradeId, rpcError);
          }

          // Fall back to direct delete if RPC didn't succeed
          if (!deleteSuccess) {
            try {
              const { error: directError } = await supabase
                .from("trades")
                .delete()
                .match({ id: tradeId, user_id: user.id });

              if (directError) {
                // Check if it's an analytics error but trade was deleted
                if (directError.code === 'P0001' && directError.message.includes('No metrics found')) {
                  // Check if trade still exists
                  const { data: checkData } = await supabase
                    .from("trades")
                    .select("id")
                    .eq("id", tradeId)
                    .eq("user_id", user.id)
                    .single();

                  if (!checkData) {
                    deleteSuccess = true;
                  }
                }

                if (!deleteSuccess) {
                  throw directError;
                }
              } else {
                deleteSuccess = true;
              }
            } catch (directDeleteError: any) {
              if (directDeleteError.code !== 'P0001' ||
                !directDeleteError.message?.includes('No metrics found')) {
                throw directDeleteError;
              }
              deleteSuccess = true;
            }
          }

          if (deleteSuccess) {
            successfullyDeletedTrades.add(tradeId);
          }

        } catch (error) {
          console.error(`Failed to delete trade ${tradeId}:`, error);
          // Continue with other trades even if one fails
        }
      }

      // Update trades list with only successfully deleted trades
      const remainingTrades = trades.filter(trade => !successfullyDeletedTrades.has(trade.id));
      setTrades(remainingTrades);

      // Clear selections for successfully deleted trades
      const newSelectedTrades = new Set(selectedTrades);
      successfullyDeletedTrades.forEach(tradeId => newSelectedTrades.delete(tradeId));
      setSelectedTrades(newSelectedTrades);
      setSelectAll(false);

      // Update last trade if needed
      if (remainingTrades.length > 0) {
        setLastTrade(remainingTrades[0]);
      } else {
        setLastTrade(null);
      }

      if (successfullyDeletedTrades.size > 0) {
        toast({
          title: "Success",
          description: `Successfully deleted ${successfullyDeletedTrades.size} trades`,
        });
      }

      if (successfullyDeletedTrades.size < selectedTradesArray.length) {
        toast({
          title: "Partial Success",
          description: `Deleted ${successfullyDeletedTrades.size} of ${selectedTradesArray.length} trades. Some trades could not be deleted.`,
          variant: "destructive",
        });
      }

    } catch (err) {
      console.error("Error deleting trades:", err);
      toast({
        title: "Error",
        description: "Failed to delete trades. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full max-w-none py-6 md:py-8 space-y-6 md:space-y-8 px-2">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-6">
        {/* Broker Filter Tabs */}
        <div className="flex items-center gap-2 bg-neutral-900 rounded-lg p-1">
          <button
            onClick={() => setBrokerFilter('all')}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors",
              brokerFilter === 'all'
                ? "bg-neutral-700 text-white"
                : "text-gray-400 hover:text-white"
            )}
          >
            All Trades
          </button>
          <button
            onClick={() => setBrokerFilter('futures')}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors",
              brokerFilter === 'futures'
                ? "bg-neutral-700 text-white"
                : "text-gray-400 hover:text-white"
            )}
          >
            Futures
          </button>
          <button
            onClick={() => setBrokerFilter('solana')}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2",
              brokerFilter === 'solana'
                ? "bg-purple-600 text-white"
                : "text-gray-400 hover:text-white"
            )}
          >
            <Wallet className="w-4 h-4" />
            Solana
          </button>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <SharePnLImage dailyPnL={lastTrade?.pnl || 0} buttonClassName="bg-none bg-neutral-800 hover:bg-neutral-700 text-gray-300 border border-neutral-700" />
          <Button
            onClick={() => navigate('/app/trades/add')}
            className="flex-1 md:flex-none items-center gap-2 transition-all duration-300 hover:shadow-lg bg-none bg-neutral-800 hover:bg-neutral-700 text-gray-300 border border-neutral-700 min-h-[44px] md:min-h-0"
          >
            <Plus className="h-4 w-4" />
            Add Trade
          </Button>
        </div>
      </div>


      {/* Add bulk delete controls when trades are selected */}
      {trades.length > 0 && (
        <div
          className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 md:p-6 rounded-xl border border-neutral-800 shadow-lg transition-all duration-300 gap-4 md:gap-0"
          style={{
            backgroundColor: theme === 'dark' ? '#0a0a0a' : 'rgb(243 244 246)',
            backgroundImage: 'none'
          }}
        >
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex items-center space-x-3">
              <Checkbox
                checked={selectAll}
                onCheckedChange={handleSelectAll as any}
                aria-label="Select all trades"
                className="w-5 h-5 md:w-4 md:h-4 data-[state=checked]:animate-pulse border-purple-500 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
              />
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-gray-900 dark:text-white">
                Select All Trades
              </label>
            </div>
          </div>
          {selectedTrades.size > 0 && (
            <div className="flex items-center gap-3 animate-fadeIn w-full md:w-auto">
              <div className="text-sm font-medium text-gray-600 dark:text-slate-400">
                {selectedTrades.size} {selectedTrades.size === 1 ? 'trade' : 'trades'} selected
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex items-center gap-2 transition-all duration-300 hover:scale-105 min-h-[44px] md:min-h-0 ml-auto bg-red-500/20 hover:bg-red-500/30 border-red-500/30 text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Selected
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="border-red-200 w-[95vw] md:w-full max-w-md mx-auto bg-slate-900 border-slate-700">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete {selectedTrades.size} selected trades.
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-col md:flex-row gap-2 md:gap-0">
                    <AlertDialogCancel className="min-h-[44px] md:min-h-0 bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={deleteSelectedTrades}
                      disabled={isDeleting}
                      className="bg-red-500 hover:bg-red-600 transition-colors min-h-[44px] md:min-h-0"
                    >
                      {isDeleting ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Deleting...
                        </>
                      ) : "Delete Selected"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-gradient-to-br from-red-900/20 to-red-800/10 border border-red-500/30 text-red-300 p-4 md:p-6 rounded-xl relative shadow-lg shadow-red-500/10 animate-fadeIn">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 mr-3 text-red-400" />
            <span className="font-medium">{error}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 hover:bg-red-500/20 border-red-500/30 text-red-300 hover:text-red-200 transition-colors duration-200 min-h-[44px] md:min-h-0"
            onClick={fetchTrades}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col justify-center items-center py-12 md:py-16 space-y-6">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-slate-700 border-t-gray-500"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-gray-300 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
          </div>
          <div className="text-center">
            <p className="text-gray-600 dark:text-slate-400 text-lg font-medium animate-pulse">Loading your trades...</p>
            <p className="text-gray-500 dark:text-slate-500 text-sm mt-1">Please wait while we fetch your trading data</p>
          </div>
        </div>
      ) : filteredTrades.length === 0 ? (
        <Card
          className="border-dashed border-neutral-800 shadow-lg hover:shadow-xl transition-all duration-300"
          style={{
            backgroundColor: theme === 'dark' ? '#0a0a0a' : 'rgb(243 244 246)',
            backgroundImage: 'none'
          }}
        >
          <CardContent className="flex flex-col items-center justify-center px-2 sm:px-4 py-12 md:py-16">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-500/20 to-gray-300/20 flex items-center justify-center mb-6 border border-gray-500/30">
              {brokerFilter === 'solana' ? (
                <Wallet className="h-10 w-10 text-purple-400" />
              ) : (
                <Plus className="h-10 w-10 text-gray-400" />
              )}
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {brokerFilter === 'solana'
                ? 'No Solana trades found'
                : brokerFilter === 'futures'
                  ? 'No futures trades found'
                  : 'No trades recorded yet'}
            </h3>
            <p className="mb-8 text-center text-gray-600 dark:text-slate-400 px-4 max-w-md">
              {brokerFilter === 'solana'
                ? 'Solana wallet trades sync automatically. Go to the Wallets page to add wallets.'
                : 'Start building your trading history by adding your first trade. Track your performance and analyze your strategies.'}
            </p>
            {brokerFilter === 'solana' ? (
              <Button
                onClick={() => navigate('/app/crypto/wallets')}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Wallet className="h-4 w-4" />
                Go to Wallets
              </Button>
            ) : (
              <Button
                onClick={() => navigate('/app/trades/add')}
                className="flex items-center gap-2 transition-all duration-300 hover:scale-105 hover:shadow-lg min-h-[44px] md:min-h-0 bg-none bg-neutral-800 hover:bg-neutral-700 text-gray-300 border border-neutral-700"
              >
                <Plus className="h-4 w-4" />
                Add Your First Trade
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:gap-6">
          {filteredTrades.map((trade, index) => (
            <Card
              key={trade.id.toString()}
              className={`border overflow-hidden transition-all duration-300 hover:shadow-xl ${selectedTrades.has(trade.id)
                ? 'border-gray-500/50'
                : 'border-neutral-800'
                }`}
              style={{
                animationDelay: `${index * 50}ms`,
                animation: 'fadeIn 0.5s ease forwards',
                backgroundColor: selectedTrades.has(trade.id)
                  ? theme === 'dark' ? 'rgb(107 114 128 / 0.1)' : 'rgb(107 114 128 / 0.05)'
                  : theme === 'dark' ? '#0a0a0a' : 'rgb(243 244 246)',
                backgroundImage: 'none'
              }}
            >
              <CardHeader className="pb-3 px-4 md:px-6 pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        checked={selectedTrades.has(trade.id)}
                        onCheckedChange={(checked: boolean | "indeterminate") => handleSelectTrade(checked, trade.id)}
                        aria-label={`Select trade ${trade.symbol}`}
                        className="w-5 h-5 md:w-4 md:h-4 border-purple-500 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                      />
                    </div>
                    <CardTitle className="font-bold flex items-center gap-3 text-lg md:text-xl text-gray-900 dark:text-white">
                      <div className={`h-3 w-3 rounded-full ${trade.side === 'long' ? 'bg-gray-500' : trade.side === 'short' ? 'bg-gray-300' : 'bg-slate-400'}`}></div>
                      {trade.symbol}
                    </CardTitle>
                  </div>
                  <span
                    className={`text-sm font-bold px-4 py-2 rounded-full pnl-font ${trade.pnl >= 0
                      ? "bg-green-500/20 text-green-400 border border-green-500/30"
                      : "bg-red-500/20 text-red-300 border border-red-500/30"
                      }`}
                  >
                    {formatCurrency(trade.pnl)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="px-2 sm:px-4 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 text-sm">
                  <div
                    className="p-4 rounded-xl border border-neutral-800"
                    style={{
                      backgroundColor: theme === 'dark' ? '#141414' : 'rgb(249 250 251)',
                    }}
                  >
                    <div className="flex justify-between items-center mb-3">
                      <p
                        className="font-medium"
                        style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
                      >
                        Entry
                      </p>
                      <div className={`px-3 py-1 rounded-full text-xs font-bold ${trade.side === 'long'
                        ? 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                        : trade.side === 'short'
                          ? 'bg-gray-300/20 text-gray-300 border border-gray-300/30'
                          : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                        }`}>
                        {trade.side === 'long' ? 'LONG' : trade.side === 'short' ? 'SHORT' : trade.side?.toUpperCase()}
                      </div>
                    </div>
                    <p
                      className="text-xl font-bold mb-2"
                      style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
                    >
                      {formatCurrency(trade.entry_price || trade.price || 0)}
                    </p>
                    <div className="flex justify-between items-center">
                      <span
                        className="text-xs"
                        style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
                      >
                        Quantity: {trade.quantity}
                      </span>
                      <span
                        className="text-xs"
                        style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
                      >
                        {new Date(trade.entry_date).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div
                    className="p-4 rounded-xl border border-neutral-800"
                    style={{
                      backgroundColor: theme === 'dark' ? '#141414' : 'rgb(249 250 251)',
                    }}
                  >
                    <p
                      className="font-medium mb-3"
                      style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
                    >
                      Exit
                    </p>
                    <p
                      className="text-xl font-bold mb-2"
                      style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
                    >
                      {formatCurrency(trade.exit_price || 0)}
                    </p>
                    <p
                      className="text-xs text-right"
                      style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
                    >
                      {trade.exit_date ? new Date(trade.exit_date).toLocaleString() : '-'}
                    </p>
                  </div>
                  {trade.platform && (
                    <div className="md:col-span-2 flex justify-between items-center px-4 pt-4 border-t border-neutral-800">
                      <div className="flex items-center gap-3">
                        <p
                          className="text-xs"
                          style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
                        >
                          Platform:
                        </p>
                        <p
                          className="text-xs font-medium px-3 py-1 rounded-full border border-neutral-700"
                          style={{
                            backgroundColor: theme === 'dark' ? '#1a1a1a' : 'rgb(243 244 246)',
                            color: theme === 'dark' ? 'rgb(203 213 225)' : 'rgb(55 65 81)',
                          }}
                        >
                          {trade.platform}
                        </p>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors min-h-[44px] md:min-h-0 p-2 rounded-lg"
                            onClick={() => setTradeToDelete(trade.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="w-[95vw] md:w-full max-w-md mx-auto bg-slate-900 border-slate-700">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete this trade
                              and remove it from your records.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="flex-col md:flex-row gap-2 md:gap-0">
                            <AlertDialogCancel
                              onClick={() => setTradeToDelete(null)}
                              className="min-h-[44px] md:min-h-0 bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700"
                            >
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => tradeToDelete && deleteTrade(tradeToDelete)}
                              disabled={isDeleting}
                              className="bg-red-500 hover:bg-red-600 transition-colors min-h-[44px] md:min-h-0"
                            >
                              {isDeleting ? (
                                <>
                                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                  Deleting...
                                </>
                              ) : "Delete"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )
      }

      {/* Add a custom style tag for animations */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease forwards;
        }
      `}</style>
    </div >
  );
} 