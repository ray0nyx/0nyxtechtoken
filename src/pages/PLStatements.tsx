import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/DatePickerWithRange';
import { TaxReportingDashboard } from '@/components/tax/TaxReportingDashboard';
import { TradingFeesManager } from '@/components/fees/TradingFeesManager';
import { 
  FileText, 
  Download, 
  AlertTriangle, 
  CheckCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  RefreshCw
} from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { addDays } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useTheme } from '@/components/ThemeProvider';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface Trade {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  entry_price: number;
  exit_price: number;
  pnl: number;
  fees: number;
  date: string;
  entry_date: string;
  exit_date: string;
  strategy?: string;
  notes?: string;
}

interface TaxReport {
  year: number;
  totalRealizedGains: number;
  totalRealizedLosses: number;
  netCapitalGains: number;
  washSaleAdjustments: number;
  shortTermGains: number;
  longTermGains: number;
  totalFees: number;
  tradeCount: number;
}

interface PLStatement {
  period: string;
  totalRevenue: number;
  totalCosts: number;
  grossProfit: number;
  operatingExpenses: number;
  netProfit: number;
  tradeCount: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
}

export default function PLStatements() {
  const { theme } = useTheme();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [filteredTrades, setFilteredTrades] = useState<Trade[]>([]);
  const [taxReport, setTaxReport] = useState<TaxReport | null>(null);
  const [plStatement, setPLStatement] = useState<PLStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    // Set default range to show all trades (Feb 2025 to Sep 2025)
    const startDate = new Date('2025-02-01');
    const endDate = new Date('2025-09-30');
    return {
      from: startDate,
      to: endDate,
    };
  });
  const [showSensitiveData, setShowSensitiveData] = useState(false);
  const [isFiltered, setIsFiltered] = useState(false);
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    loadTrades();
  }, []);

  useEffect(() => {
    if (trades.length > 0) {
      // Always filter trades when trades or dateRange changes
      filterTrades();
    }
  }, [trades, dateRange]);

  useEffect(() => {
    if (trades.length > 0) {
      // Generate reports when trades or year changes
      // Use all trades initially, then filtered trades will be used when filtering is applied
      const tradesToUse = filteredTrades.length > 0 ? filteredTrades : trades;
      generateTaxReport(tradesToUse);
      generatePLStatement(tradesToUse);
    }
  }, [trades, selectedYear, filteredTrades]);

  const loadTrades = async () => {
    try {
      setLoading(true);
      
      // First check if user is authenticated
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error('User not authenticated:', userError);
        toast({
          title: "Authentication Error",
          description: "Please sign in to view your trading data.",
          variant: "destructive",
        });
        setTrades([]);
        return;
      }
      
      console.log('Loading trades for user:', user.id);
      
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .order('entry_date', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      console.log('Raw trades data from Supabase:', {
        count: data?.length || 0,
        sample: data?.slice(0, 3) || []
      });
      
      // Filter out any trades with invalid dates
      const validTrades = (data || []).filter(trade => {
        const entryDate = new Date(trade.entry_date);
        return !isNaN(entryDate.getTime());
      });
      
      console.log('Valid trades after filtering:', {
        count: validTrades.length,
        sample: validTrades.slice(0, 3)
      });
      
      setTrades(validTrades);
      
      // Initialize filtered trades with all trades
      setFilteredTrades(validTrades);
    } catch (error) {
      console.error('Error loading trades:', error);
      toast({
        title: "Error",
        description: "Failed to load trading data. Please try again.",
        variant: "destructive",
      });
      setTrades([]);
    } finally {
      setLoading(false);
    }
  };

  const filterTrades = () => {
    if (!dateRange?.from || !dateRange?.to) return;
    
    // Validate dates
    const fromDate = new Date(dateRange.from);
    const toDate = new Date(dateRange.to);
    
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      console.error('Invalid date range:', dateRange);
      return;
    }
    
    // Set time to start of day for fromDate and end of day for toDate
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);
    
    console.log('Filtering trades:', {
      totalTrades: trades.length,
      fromDate: fromDate.toISOString(),
      toDate: toDate.toISOString(),
      sampleTradeDates: trades.slice(0, 3).map(t => ({
        id: t.id,
        entry_date: t.entry_date,
        entryDateObj: new Date(t.entry_date).toISOString()
      }))
    });
    
    const filtered = trades.filter(trade => {
      const entryDate = new Date(trade.entry_date);
      if (isNaN(entryDate.getTime())) return false;
      return entryDate >= fromDate && entryDate <= toDate;
    });
    
    console.log('Filtered trades result:', {
      filteredCount: filtered.length,
      sampleFiltered: filtered.slice(0, 3).map(t => ({
        id: t.id,
        entry_date: t.entry_date,
        symbol: t.symbol
      }))
    });
    
    setFilteredTrades(filtered);
    setIsFiltered(true);
    
    // Regenerate P&L statement and tax report with filtered data
    generatePLStatement(filtered);
    generateTaxReport(filtered);
  };

  const generateTaxReport = (tradesToUse?: Trade[]) => {
    const tradesForTax = tradesToUse || trades;
    
    console.log('Generating tax report:', {
      tradesForTax: tradesForTax.length,
      selectedYear,
      sampleTrades: tradesForTax.slice(0, 3).map(t => ({
        id: t.id,
        symbol: t.symbol,
        pnl: t.pnl,
        entry_date: t.entry_date,
        year: new Date(t.entry_date).getFullYear()
      }))
    });
    
    const yearTrades = tradesForTax.filter(trade => 
      new Date(trade.entry_date).getFullYear() === selectedYear
    );

    console.log('Year trades for tax report:', {
      year: selectedYear,
      count: yearTrades.length,
      sample: yearTrades.slice(0, 3)
    });

    const realizedTrades = yearTrades.filter(trade => trade.exit_price > 0);
    const gains = realizedTrades.filter(trade => trade.pnl > 0);
    const losses = realizedTrades.filter(trade => trade.pnl < 0);

    const totalRealizedGains = gains.reduce((sum, trade) => sum + trade.pnl, 0);
    const totalRealizedLosses = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0));
    const netCapitalGains = totalRealizedGains - totalRealizedLosses;

    // Calculate wash sale adjustments (simplified)
    const washSaleAdjustments = calculateWashSales(realizedTrades);

    // Separate short-term vs long-term (simplified: < 1 year = short-term)
    const shortTermGains = gains.filter(trade => {
      const entryDate = new Date(trade.entry_date);
      const exitDate = new Date(trade.exit_date);
      const holdingPeriod = exitDate.getTime() - entryDate.getTime();
      return holdingPeriod < 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
    }).reduce((sum, trade) => sum + trade.pnl, 0);

    const longTermGains = totalRealizedGains - shortTermGains;
    const totalFees = realizedTrades.reduce((sum, trade) => sum + (trade.fees || 0), 0);

    const taxReport = {
      year: selectedYear,
      totalRealizedGains,
      totalRealizedLosses,
      netCapitalGains,
      washSaleAdjustments,
      shortTermGains,
      longTermGains,
      totalFees,
      tradeCount: realizedTrades.length
    };

    console.log('Generated tax report:', taxReport);
    setTaxReport(taxReport);
  };

  const calculateWashSales = (trades: Trade[]): number => {
    // Simplified wash sale calculation
    // In reality, this would be much more complex
    let washSaleAdjustments = 0;
    
    for (let i = 0; i < trades.length; i++) {
      const trade = trades[i];
      if (trade.pnl < 0) { // Loss
        // Look for repurchase within 30 days
        const repurchaseDate = new Date(trade.entry_date);
        repurchaseDate.setDate(repurchaseDate.getDate() + 30);
        
        const repurchase = trades.find(t => 
          t.symbol === trade.symbol && 
          t.side === trade.side &&
          new Date(t.entry_date) <= repurchaseDate &&
          new Date(t.entry_date) > new Date(trade.entry_date)
        );
        
        if (repurchase) {
          washSaleAdjustments += Math.abs(trade.pnl);
        }
      }
    }
    
    return washSaleAdjustments;
  };

  const generatePLStatement = async (tradesToUse?: Trade[]) => {
    const tradesForCalculation = tradesToUse || filteredTrades;
    
    console.log('Generating P&L statement:', {
      tradesForCalculation: tradesForCalculation.length,
      filteredTrades: filteredTrades.length,
      allTrades: trades.length,
      sampleTrades: tradesForCalculation.slice(0, 3).map(t => ({
        id: t.id,
        symbol: t.symbol,
        pnl: t.pnl,
        side: t.side
      }))
    });
    
    if (tradesForCalculation.length === 0) {
      console.log('No trades for P&L calculation');
      return;
    }

    // Get additional fees for the trades
    const tradeIds = tradesForCalculation.map(trade => trade.id);
    let additionalFees = 0;
    
    if (tradeIds.length > 0) {
      try {
        const { data: feesData, error: feesError } = await supabase
          .from('trading_fees')
          .select('amount')
          .in('trade_id', tradeIds);
        
        if (!feesError && feesData) {
          additionalFees = feesData.reduce((sum, fee) => sum + fee.amount, 0);
        }
      } catch (error) {
        console.error('Error loading additional fees:', error);
      }
    }

    const totalRevenue = tradesForCalculation
      .filter(trade => trade.pnl > 0)
      .reduce((sum, trade) => sum + trade.pnl, 0);
    
    const totalCosts = Math.abs(tradesForCalculation
      .filter(trade => trade.pnl < 0)
      .reduce((sum, trade) => sum + trade.pnl, 0));
    
    const grossProfit = totalRevenue - totalCosts;
    const tradeFees = tradesForCalculation.reduce((sum, trade) => sum + (trade.fees || 0), 0);
    const operatingExpenses = tradeFees + additionalFees;
    const netProfit = grossProfit - operatingExpenses;

    const winningTrades = tradesForCalculation.filter(trade => trade.pnl > 0);
    const winRate = (winningTrades.length / tradesForCalculation.length) * 100;
    const avgWin = winningTrades.length > 0 ? 
      winningTrades.reduce((sum, trade) => sum + trade.pnl, 0) / winningTrades.length : 0;
    const avgLoss = tradesForCalculation.filter(trade => trade.pnl < 0).length > 0 ?
      Math.abs(tradesForCalculation.filter(trade => trade.pnl < 0)
        .reduce((sum, trade) => sum + trade.pnl, 0)) / 
      tradesForCalculation.filter(trade => trade.pnl < 0).length : 0;

    const plStatement = {
      period: `${dateRange?.from?.toLocaleDateString()} - ${dateRange?.to?.toLocaleDateString()}`,
      totalRevenue,
      totalCosts,
      grossProfit,
      operatingExpenses,
      netProfit,
      tradeCount: tradesForCalculation.length, // Fixed: use tradesForCalculation instead of filteredTrades
      winRate,
      avgWin,
      avgLoss
    };

    console.log('Generated P&L statement:', plStatement);
    setPLStatement(plStatement);
  };

  const exportToCSV = (data: any[], filename: string) => {
    const csvContent = [
      Object.keys(data[0]).join(','),
      ...data.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportTaxReport = () => {
    if (!taxReport) return;
    
    const taxData = [{
      'Year': taxReport.year,
      'Total Realized Gains': taxReport.totalRealizedGains,
      'Total Realized Losses': taxReport.totalRealizedLosses,
      'Net Capital Gains': taxReport.netCapitalGains,
      'Wash Sale Adjustments': taxReport.washSaleAdjustments,
      'Short-term Gains': taxReport.shortTermGains,
      'Long-term Gains': taxReport.longTermGains,
      'Total Fees': taxReport.totalFees,
      'Trade Count': taxReport.tradeCount
    }];

    exportToCSV(taxData, `tax-report-${selectedYear}.csv`);
    toast({
      title: "Export Complete",
      description: "Tax report exported successfully",
    });
  };

  const exportPLStatement = () => {
    if (!plStatement) return;
    
    const plData = [{
      'Period': plStatement.period,
      'Total Revenue': plStatement.totalRevenue,
      'Total Costs': plStatement.totalCosts,
      'Gross Profit': plStatement.grossProfit,
      'Operating Expenses': plStatement.operatingExpenses,
      'Net Profit': plStatement.netProfit,
      'Trade Count': plStatement.tradeCount,
      'Win Rate (%)': plStatement.winRate,
      'Average Win': plStatement.avgWin,
      'Average Loss': plStatement.avgLoss
    }];

    exportToCSV(plData, `pl-statement-${dateRange?.from?.toISOString().split('T')[0]}.csv`);
    toast({
      title: "Export Complete",
      description: "P&L statement exported successfully",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="w-full max-w-none py-6 md:py-8 px-2">
        <LoadingSpinner 
          message="Loading trading data..." 
          subMessage="Please wait while we fetch your P&L statements and tax reports"
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-none py-6 md:py-8 space-y-6 md:space-y-8 px-2">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20">
            <FileText className="h-8 w-8 text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-purple-500">
              P&L Statements & Tax
            </h1>
            <p className="text-slate-400 mt-1">
              Generate comprehensive profit & loss statements and tax reports
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSensitiveData(!showSensitiveData)}
            className="flex items-center gap-2 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20 border-slate-700/50 bg-slate-800/30 hover:bg-slate-700/50 text-white hover:text-white"
          >
            {showSensitiveData ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {showSensitiveData ? 'Hide' : 'Show'} Sensitive Data
          </Button>
          <Button 
            onClick={loadTrades} 
            size="sm"
            className="flex items-center gap-2 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20 border-slate-700/50 bg-slate-800/30 hover:bg-slate-700/50 text-white hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Controls */}
      <Card 
        className="border-slate-700/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:shadow-blue-500/10 overflow-hidden"
        style={{ 
          backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)',
          backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
        }}
      >
        <CardHeader className="bg-blue-500/10">
          <CardTitle 
            className="flex items-center gap-2"
            style={{ color: theme === 'dark' ? 'white' : 'black' }}
          >
            <div className="p-1.5 rounded-lg bg-blue-500/20">
              <RefreshCw className="h-4 w-4 text-blue-400" />
            </div>
            Report Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Date Range</label>
              <DatePickerWithRange
                date={dateRange}
                setDate={setDateRange}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tax Year</label>
              <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Quick Actions</label>
              <div className="flex space-x-2">
                <Button 
                  size="sm" 
                  onClick={filterTrades} 
                  disabled={!dateRange?.from || !dateRange?.to}
                  variant={isFiltered ? "default" : "outline"}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {isFiltered ? "Apply Filter" : "Filter by Date"}
                </Button>
                {isFiltered && (
                  <Button 
                    size="sm" 
                    onClick={() => {
                      setFilteredTrades(trades);
                      setIsFiltered(false);
                      generatePLStatement(trades);
                      generateTaxReport(trades);
                    }}
                    variant="outline"
                  >
                    Clear Filter
                  </Button>
                )}
                <Button size="sm" onClick={exportTaxReport} disabled={!taxReport}>
                  <Download className="h-4 w-4 mr-2" />
                  Export Tax
                </Button>
                <Button size="sm" onClick={exportPLStatement} disabled={!plStatement}>
                  <Download className="h-4 w-4 mr-2" />
                  Export P&L
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="pl-statement" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="pl-statement">P&L Statement</TabsTrigger>
          <TabsTrigger value="tax-report">Tax Report</TabsTrigger>
          <TabsTrigger value="tax-dashboard">Tax Dashboard</TabsTrigger>
          <TabsTrigger value="fees-management">Fees Management</TabsTrigger>
          <TabsTrigger value="trade-details">Trade Details</TabsTrigger>
        </TabsList>

        {/* P&L Statement Tab */}
        <TabsContent value="pl-statement" className="space-y-6">
          {plStatement ? (
            <>
              {/* P&L Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card 
                  style={{ 
                    backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)',
                    backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
                  }}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                      Total Revenue
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-2 sm:px-3 py-4">
                    <div className="text-2xl font-bold text-blue-500">
                      {formatCurrency(plStatement.totalRevenue)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {plStatement.tradeCount} trades
                    </p>
                  </CardContent>
                </Card>

                <Card 
                  style={{ 
                    backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)',
                    backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
                  }}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-purple-500" />
                      Total Costs
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-2 sm:px-3 py-4">
                    <div className="text-2xl font-bold text-purple-500">
                      {formatCurrency(plStatement.totalCosts)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Losses
                    </p>
                  </CardContent>
                </Card>

                <Card 
                  style={{ 
                    backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)',
                    backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
                  }}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-blue-500" />
                      Gross Profit
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-2 sm:px-3 py-4">
                    <div className="text-2xl font-bold text-blue-500">
                      {formatCurrency(plStatement.grossProfit)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Revenue - Costs
                    </p>
                  </CardContent>
                </Card>

                <Card 
                  style={{ 
                    backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)',
                    backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
                  }}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-purple-500" />
                      Net Profit
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-2 sm:px-3 py-4">
                    <div className={`text-2xl font-bold ${plStatement.netProfit >= 0 ? 'text-blue-500' : 'text-purple-500'}`}>
                      {formatCurrency(plStatement.netProfit)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      After expenses
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed P&L Statement */}
              <Card 
                style={{ 
                  backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)',
                  backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
                }}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Profit & Loss Statement</CardTitle>
                    {isFiltered && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                        Filtered by Date Range
                      </Badge>
                    )}
                  </div>
                  <CardDescription>
                    Period: {plStatement.period}
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-2 sm:px-4 py-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <h4 className="font-medium">Revenue</h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span>Winning Trades</span>
                            <span className="text-blue-500">{formatCurrency(plStatement.totalRevenue)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-medium">Costs</h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span>Losing Trades</span>
                            <span className="text-purple-500">{formatCurrency(plStatement.totalCosts)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center py-2">
                        <span className="font-medium">Gross Profit</span>
                        <span className={`font-bold ${plStatement.grossProfit >= 0 ? 'text-blue-500' : 'text-purple-500'}`}>
                          {formatCurrency(plStatement.grossProfit)}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Operating Expenses (Fees)</span>
                        <span className="text-purple-500">{formatCurrency(plStatement.operatingExpenses)}</span>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center py-2">
                        <span className="font-bold text-lg">Net Profit</span>
                        <span className={`font-bold text-lg ${plStatement.netProfit >= 0 ? 'text-blue-500' : 'text-purple-500'}`}>
                          {formatCurrency(plStatement.netProfit)}
                        </span>
                      </div>
                    </div>

                    {/* Performance Metrics */}
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-3">Performance Metrics</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Win Rate</span>
                          <div className="font-medium">{plStatement.winRate.toFixed(1)}%</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Avg Win</span>
                          <div className="font-medium text-blue-500">{formatCurrency(plStatement.avgWin)}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Avg Loss</span>
                          <div className="font-medium text-purple-500">{formatCurrency(plStatement.avgLoss)}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total Trades</span>
                          <div className="font-medium">{plStatement.tradeCount}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card 
              style={{ 
                backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)',
                backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
              }}
            >
              <CardContent className="px-2 sm:px-4 py-4 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No trading data available for the selected period</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tax Report Tab */}
        <TabsContent value="tax-report" className="space-y-6">
          {taxReport ? (
            <>
              {/* Tax Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card 
                  style={{ 
                    backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)',
                    backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
                  }}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-blue-500">
                      Realized Gains
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-2 sm:px-3 py-4">
                    <div className="text-2xl font-bold text-blue-500">
                      {formatCurrency(taxReport.totalRealizedGains)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {selectedYear} gains
                    </p>
                  </CardContent>
                </Card>

                <Card 
                  style={{ 
                    backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)',
                    backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
                  }}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-purple-500">
                      Realized Losses
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-2 sm:px-3 py-4">
                    <div className="text-2xl font-bold text-purple-500">
                      {formatCurrency(taxReport.totalRealizedLosses)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {selectedYear} losses
                    </p>
                  </CardContent>
                </Card>

                <Card 
                  style={{ 
                    backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)',
                    backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
                  }}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-blue-500">
                      Net Capital Gains
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-2 sm:px-3 py-4">
                    <div className={`text-2xl font-bold ${taxReport.netCapitalGains >= 0 ? 'text-blue-500' : 'text-purple-500'}`}>
                      {formatCurrency(taxReport.netCapitalGains)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Taxable amount
                    </p>
                  </CardContent>
                </Card>

                <Card 
                  style={{ 
                    backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)',
                    backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
                  }}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-purple-600">
                      Wash Sale Adjustments
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-2 sm:px-3 py-4">
                    <div className="text-2xl font-bold text-purple-600">
                      {formatCurrency(taxReport.washSaleAdjustments)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Disallowed losses
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Tax Report */}
              <Card 
                style={{ 
                  backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)',
                  backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
                }}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Tax Report for {selectedYear}</CardTitle>
                    {isFiltered && (
                      <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400">
                        Filtered by Date Range
                      </Badge>
                    )}
                  </div>
                  <CardDescription>
                    Capital gains and losses for tax purposes
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-2 sm:px-4 py-4">
                  <div className="space-y-6">
                    {/* Capital Gains Summary */}
                    <div>
                      <h4 className="font-medium mb-3">Capital Gains Summary</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Short-term Capital Gains</span>
                          <span className="text-blue-500">{formatCurrency(taxReport.shortTermGains)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Long-term Capital Gains</span>
                          <span className="text-blue-500">{formatCurrency(taxReport.longTermGains)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Realized Gains</span>
                          <span className="text-blue-500 font-medium">{formatCurrency(taxReport.totalRealizedGains)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Realized Losses</span>
                          <span className="text-purple-500 font-medium">{formatCurrency(taxReport.totalRealizedLosses)}</span>
                        </div>
                        <div className="border-t pt-2">
                          <div className="flex justify-between font-bold">
                            <span>Net Capital Gains</span>
                            <span className={taxReport.netCapitalGains >= 0 ? 'text-blue-500' : 'text-purple-500'}>
                              {formatCurrency(taxReport.netCapitalGains)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Wash Sale Rules */}
                    <div>
                      <h4 className="font-medium mb-3">Wash Sale Adjustments</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Disallowed Losses (Wash Sales)</span>
                          <span className="text-purple-600">{formatCurrency(taxReport.washSaleAdjustments)}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Losses disallowed due to wash sale rule (repurchase within 30 days)
                        </p>
                      </div>
                    </div>

                    {/* Trading Expenses */}
                    <div>
                      <h4 className="font-medium mb-3">Trading Expenses</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Total Trading Fees</span>
                          <span className="text-purple-500">{formatCurrency(taxReport.totalFees)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Trades</span>
                          <span>{taxReport.tradeCount}</span>
                        </div>
                      </div>
                    </div>

                    {/* Tax Disclaimer */}
                    <div className="border-t pt-4">
                      <div className="flex items-start space-x-2">
                        <AlertTriangle className="h-5 w-5 text-purple-400 mt-0.5" />
                        <div className="text-sm text-muted-foreground">
                          <p className="font-medium text-purple-600 mb-1">Tax Disclaimer</p>
                          <p>
                            This report is for informational purposes only and should not be considered as tax advice. 
                            Please consult with a qualified tax professional for accurate tax preparation and filing. 
                            Tax laws and regulations may vary by jurisdiction and are subject to change.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card 
              style={{ 
                backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)',
                backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
              }}
            >
              <CardContent className="px-2 sm:px-4 py-4 text-center">
                <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No trading data available for {selectedYear}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tax Dashboard Tab */}
        <TabsContent value="tax-dashboard">
          <TaxReportingDashboard />
        </TabsContent>

        {/* Fees Management Tab */}
        <TabsContent value="fees-management">
          <TradingFeesManager onFeesUpdated={loadTrades} />
        </TabsContent>

        {/* Trade Details Tab */}
        <TabsContent value="trade-details" className="space-y-6">
          <Card 
            style={{ 
              backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)',
              backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
            }}
          >
            <CardHeader>
              <CardTitle>Trade Details</CardTitle>
              <CardDescription>
                {filteredTrades.length} trades in selected period
              </CardDescription>
            </CardHeader>
            <CardContent className="px-2 sm:px-4 py-4">
              {filteredTrades.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-500">
                        {filteredTrades.filter(t => t.pnl > 0).length}
                      </div>
                      <div className="text-sm text-muted-foreground">Winning Trades</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-500">
                        {filteredTrades.filter(t => t.pnl < 0).length}
                      </div>
                      <div className="text-sm text-muted-foreground">Losing Trades</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-500">
                        {formatCurrency(filteredTrades.reduce((sum, t) => sum + t.pnl, 0))}
                      </div>
                      <div className="text-sm text-muted-foreground">Total P&L</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {formatCurrency(filteredTrades.reduce((sum, t) => sum + (t.fees || 0), 0))}
                      </div>
                      <div className="text-sm text-muted-foreground">Total Fees</div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Date</th>
                          <th className="text-left p-2">Symbol</th>
                          <th className="text-left p-2">Side</th>
                          <th className="text-left p-2">Quantity</th>
                          <th className="text-left p-2">Entry Price</th>
                          <th className="text-left p-2">Exit Price</th>
                          <th className="text-left p-2">P&L</th>
                          <th className="text-left p-2">Fees</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTrades.map((trade) => (
                          <tr key={trade.id} className="border-b hover:bg-muted/50">
                            <td className="p-2">{new Date(trade.entry_date).toLocaleDateString()}</td>
                            <td className="p-2 font-medium">{trade.symbol}</td>
                            <td className="p-2">
                              <Badge variant={trade.side === 'long' ? 'default' : 'secondary'}>
                                {trade.side}
                              </Badge>
                            </td>
                            <td className="p-2">{trade.quantity}</td>
                            <td className="p-2">{formatCurrency(trade.entry_price)}</td>
                            <td className="p-2">{trade.exit_price ? formatCurrency(trade.exit_price) : 'N/A'}</td>
                            <td className={`p-2 font-medium ${trade.pnl >= 0 ? 'text-blue-500' : 'text-purple-500'}`}>
                              {formatCurrency(trade.pnl)}
                            </td>
                            <td className="p-2">{formatCurrency(trade.fees || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No trades found for the selected period</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
