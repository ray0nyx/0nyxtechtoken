import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LeaderboardEntry {
  id: string;
  trader_name: string;
  monthly_pnl: number;
  rank: number;
}

export function LeaderboardTable() {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState("");

  useEffect(() => {
    console.log("LeaderboardTable component mounted");
    fetchLeaderboardData();
    
    // Set current month name
    const now = new Date();
    setCurrentMonth(now.toLocaleString('default', { month: 'long', year: 'numeric' }));
  }, []);

  const fetchLeaderboardData = async () => {
    console.log("Fetching leaderboard data...");
    setIsLoading(true);
    setError(null);
    
    try {
      console.log("Calling Supabase RPC...");
      const { data, error } = await supabase.rpc('get_monthly_leaderboard');
      console.log("RPC result:", { data, error });
      
      if (error) {
        console.error("Error from RPC:", error);
        throw error;
      }
      
      if (data && Array.isArray(data)) {
        console.log("Data received from function:", data);
        // Format the data to ensure number types
        const formattedData = data.map((entry: any) => ({
          id: entry.id,
          trader_name: entry.trader_name,
          monthly_pnl: Number(entry.monthly_pnl),
          rank: Number(entry.rank)
        }));
        
        console.log("Formatted data:", formattedData);
        setLeaderboardData(formattedData);
      } else {
        console.error("No data array returned:", data);
        // If no data is returned, try the fallback approach
        await fetchLeaderboardDataFallback();
      }
    } catch (err: any) {
      console.error("Error fetching leaderboard data:", err);
      // Try fallback approach if the RPC fails
      await fetchLeaderboardDataFallback();
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Add a fallback method to get data directly from trades table
  const fetchLeaderboardDataFallback = async () => {
    console.log("Using fallback query to fetch leaderboard data");
    try {
      // Try direct SQL query
      const { data: queryData, error: queryError } = await supabase.from('trades')
        .select(`
          profiles!trades_user_id_fkey (
            id,
            username
          ),
          pnl,
          date
        `)
        .gte('date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());
      
      if (queryError) throw queryError;
      
      console.log("Fallback query raw data:", queryData);
      
      // Process the query data to format it
      const processedData = queryData.reduce((acc: Record<string, any>, trade) => {
        const userId = trade.profiles?.id;
        if (!userId) return acc;
        
        const name = trade.profiles.username || 'Anonymous Trader';
        
        if (!acc[userId]) {
          acc[userId] = {
            id: userId,
            trader_name: name,
            monthly_pnl: 0
          };
        }
        
        const pnl = Number(trade.pnl || 0);
        acc[userId].monthly_pnl += pnl;
        
        return acc;
      }, {});
      
      // Convert to array and sort
      const formattedData = Object.values(processedData)
        .sort((a: any, b: any) => b.monthly_pnl - a.monthly_pnl)
        .map((entry: any, index) => ({
          ...entry,
          rank: index + 1,
          monthly_pnl: Number(entry.monthly_pnl)
        }))
        .slice(0, 100); // Limit to top 100
      
      console.log("Processed fallback data:", formattedData);
      setLeaderboardData(formattedData as LeaderboardEntry[]);
    } catch (err: any) {
      console.error("Error in fallback method:", err);
      setError(err.message || "Failed to fetch leaderboard data");
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    // Clear any component state before refreshing
    setLeaderboardData([]);
    setError(null);
    
    // Add a small delay to ensure UI changes are visible
    setTimeout(() => {
      fetchLeaderboardData();
    }, 100);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Function to get badge/color based on rank
  const getRankBadgeClass = (rank: number) => {
    if (rank === 1) return "bg-yellow-500 text-black";
    if (rank === 2) return "bg-gray-300 text-black";
    if (rank === 3) return "bg-amber-600 text-black";
    return "bg-blue-600 text-white";
  };

  // Add useEffect cleanup
  useEffect(() => {
    return () => {
      // Cleanup function to clear any cached data when component unmounts
      setLeaderboardData([]);
      setIsLoading(false);
      setError(null);
    };
  }, []);

  return (
    <Card className="w-full shadow-lg rounded-xl">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xl font-bold">Top Traders - {currentMonth}</CardTitle>
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading || isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[250px]" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-red-500 p-4 text-center">
            Error: {error}
          </div>
        ) : leaderboardData.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground">
            No trading data available for this month yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Rank</TableHead>
                  <TableHead>Trader</TableHead>
                  <TableHead className="text-right">Monthly P&L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboardData.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${getRankBadgeClass(entry.rank)}`}>
                        {entry.rank}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{entry.trader_name}</TableCell>
                    <TableCell className={`text-right font-bold ${
                      entry.rank === 1 ? 'text-yellow-500' : 
                      entry.rank === 2 ? 'text-green-500' : 
                      entry.monthly_pnl >= 0 ? 'text-blue-500' : 'text-fuchsia-500'
                    }`}>
                      {formatCurrency(entry.monthly_pnl)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 