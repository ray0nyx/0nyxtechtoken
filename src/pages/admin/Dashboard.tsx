import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  User, 
  ChevronUp, 
  ChevronDown, 
  BarChart2, 
  DollarSign,
  Clock 
} from "lucide-react";
import { getDashboardStats, type DashboardStats, type TimeFrame } from "@/services/adminService";

// Default stats object to use as initial state and fallback
const defaultStats: DashboardStats = {
  totalUsers: 0,
  activeUsers: 0,
  revenue: 0,
  revenueGrowth: 0,
  conversionRate: 0,
  newUsers: 0,
  userGrowth: 0,
  avgSessionTime: 0,
  retention: 0,
  pageViews: 0
};

export function AdminDashboard() {
  const [timeframe, setTimeframe] = useState<TimeFrame>("week");
  const [stats, setStats] = useState<DashboardStats>(defaultStats);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to update timeframe safely
  const handleTimeframeChange = useCallback((newTimeframe: TimeFrame) => {
    // Only update if it's different to avoid unnecessary rerenders
    if (newTimeframe !== timeframe) {
      setTimeframe(newTimeframe);
    }
  }, [timeframe]);

  // Fetch stats based on selected timeframe
  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const data = await getDashboardStats(timeframe);
        
        // Validate returned data with the expected interface
        if (data) {
          setStats(data);
        } else {
          throw new Error("No data returned from stats service");
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
        setError("Failed to load dashboard data. Please try again.");
        // Keep the old stats instead of resetting them
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [timeframe]);

  // Handle refresh button click
  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await getDashboardStats(timeframe);
      if (data) {
        setStats(data);
      } else {
        throw new Error("No data returned from stats service");
      }
    } catch (error) {
      console.error("Error refreshing stats:", error);
      setError("Failed to refresh dashboard data.");
    } finally {
      setIsLoading(false);
    }
  }, [timeframe]);

  // Format currency for display
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome to the Wagyu admin panel. Here's what's happening.
          </p>
        </div>
        <div className="flex gap-2">
          <Button>Export Data</Button>
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={isLoading}
          >
            {isLoading ? "Loading..." : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded" role="alert">
          <p>{error}</p>
        </div>
      )}

      {/* Time Range Selector */}
      <div className="flex justify-end mb-4">
        <div className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
          <button
            onClick={() => handleTimeframeChange("day")}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
              timeframe === "day" ? "bg-background text-foreground shadow-sm" : ""
            }`}
          >
            Day
          </button>
          <button
            onClick={() => handleTimeframeChange("week")}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
              timeframe === "week" ? "bg-background text-foreground shadow-sm" : ""
            }`}
          >
            Week
          </button>
          <button
            onClick={() => handleTimeframeChange("month")}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
              timeframe === "month" ? "bg-background text-foreground shadow-sm" : ""
            }`}
          >
            Month
          </button>
          <button
            onClick={() => handleTimeframeChange("year")}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
              timeframe === "year" ? "bg-background text-foreground shadow-sm" : ""
            }`}
          >
            Year
          </button>
        </div>
      </div>

      {/* Loading indicator for initial load */}
      {isLoading && !stats.totalUsers && (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      )}

      {/* Stats Grid - show even during refresh for better UX */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Users */}
        <Card className={isLoading ? "opacity-60" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Users
            </CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {stats.userGrowth >= 0 ? "+" : ""}{stats.userGrowth.toFixed(1)}% from last {timeframe}
            </p>
          </CardContent>
        </Card>

        {/* Active Users */}
        <Card className={isLoading ? "opacity-60" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Users
            </CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeUsers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalUsers > 0 ? ((stats.activeUsers / stats.totalUsers) * 100).toFixed(1) : 0}% of total users
            </p>
          </CardContent>
        </Card>

        {/* Revenue */}
        <Card className={isLoading ? "opacity-60" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.revenue)}
            </div>
            <div className={`flex items-center text-xs ${stats.revenueGrowth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {stats.revenueGrowth >= 0 ? (
                <ChevronUp className="mr-1 h-3 w-3" />
              ) : (
                <ChevronDown className="mr-1 h-3 w-3" />
              )}
              {Math.abs(stats.revenueGrowth || 0).toFixed(1)}% from last {timeframe}
            </div>
          </CardContent>
        </Card>

        {/* Conversion Rate */}
        <Card className={isLoading ? "opacity-60" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Conversion Rate
            </CardTitle>
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.conversionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              +0.3% from last {timeframe}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* New Users */}
        <Card className={isLoading ? "opacity-60" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              New Users
            </CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.newUsers.toLocaleString()}</div>
            <div className={`flex items-center text-xs ${stats.userGrowth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {stats.userGrowth >= 0 ? (
                <ChevronUp className="mr-1 h-3 w-3" />
              ) : (
                <ChevronDown className="mr-1 h-3 w-3" />
              )}
              {Math.abs(stats.userGrowth).toFixed(1)}% from last {timeframe}
            </div>
          </CardContent>
        </Card>

        {/* Average Session Time */}
        <Card className={isLoading ? "opacity-60" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avg. Session Time
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgSessionTime} min</div>
            <div className="flex items-center text-xs text-green-500">
              <ChevronUp className="mr-1 h-3 w-3" />
              1.2% from last {timeframe}
            </div>
          </CardContent>
        </Card>

        {/* User Retention */}
        <Card className={isLoading ? "opacity-60" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              User Retention
            </CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.retention.toFixed(1)}%</div>
            <div className="flex items-center text-xs text-green-500">
              <ChevronUp className="mr-1 h-3 w-3" />
              2.1% from last {timeframe}
            </div>
          </CardContent>
        </Card>

        {/* Page Views */}
        <Card className={isLoading ? "opacity-60" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Page Views
            </CardTitle>
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pageViews.toLocaleString()}</div>
            <div className="flex items-center text-xs text-red-500">
              <ChevronDown className="mr-1 h-3 w-3" />
              3.4% from last {timeframe}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Placeholder for charts and tables */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>User Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[300px] bg-muted/20 flex items-center justify-center">
              <BarChart2 className="h-8 w-8 text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Activity Chart</span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Revenue Trends</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[300px] bg-muted/20 flex items-center justify-center">
              <BarChart2 className="h-8 w-8 text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Revenue Chart</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 