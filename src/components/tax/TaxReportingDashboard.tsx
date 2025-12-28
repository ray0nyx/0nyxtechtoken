import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  FileText, 
  Download, 
  Calculator, 
  AlertTriangle, 
  CheckCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Filter,
  RefreshCw,
  Eye,
  EyeOff,
  BarChart3,
  PieChart
} from 'lucide-react';
import { TaxCalculator } from './TaxCalculator';
import { WashSaleAnalyzer } from './WashSaleAnalyzer';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/use-toast';

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
  strategy?: string;
  notes?: string;
}

interface TaxSummary {
  year: number;
  totalRealizedGains: number;
  totalRealizedLosses: number;
  netCapitalGains: number;
  shortTermGains: number;
  longTermGains: number;
  shortTermLosses: number;
  longTermLosses: number;
  washSaleAdjustments: number;
  totalFees: number;
  tradeCount: number;
  effectiveTaxRate: number;
  estimatedTaxOwed: number;
}

export function TaxReportingDashboard() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [taxSummary, setTaxSummary] = useState<TaxSummary | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [showSensitiveData, setShowSensitiveData] = useState(false);
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    loadTrades();
  }, []);

  useEffect(() => {
    if (trades.length > 0) {
      generateTaxSummary();
    }
  }, [trades, selectedYear]);

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
      
      console.log('Loading trades for tax dashboard, user:', user.id);
      
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .order('entry_date', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      console.log('Raw trades data for tax dashboard:', {
        count: data?.length || 0,
        sample: data?.slice(0, 3) || []
      });
      
      // Filter out any trades with invalid dates
      const validTrades = (data || []).filter(trade => {
        const entryDate = new Date(trade.entry_date);
        return !isNaN(entryDate.getTime());
      });
      
      console.log('Valid trades for tax dashboard:', {
        count: validTrades.length,
        sample: validTrades.slice(0, 3)
      });
      
      setTrades(validTrades);
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

  const generateTaxSummary = async () => {
    const yearTrades = trades.filter(trade => 
      new Date(trade.entry_date).getFullYear() === selectedYear
    );

    // Get additional fees for the year's trades
    const tradeIds = yearTrades.map(trade => trade.id);
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

    const realizedTrades = yearTrades.filter(trade => trade.exit_price > 0);
    const gains = realizedTrades.filter(trade => trade.pnl > 0);
    const losses = realizedTrades.filter(trade => trade.pnl < 0);

    const totalRealizedGains = gains.reduce((sum, trade) => sum + trade.pnl, 0);
    const totalRealizedLosses = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0));
    const netCapitalGains = totalRealizedGains - totalRealizedLosses;

    // Separate short-term vs long-term (simplified: < 1 year = short-term)
    const shortTermGains = gains.filter(trade => {
      const holdingPeriod = new Date(trade.date).getTime() - new Date(trade.date).getTime();
      return holdingPeriod < 365 * 24 * 60 * 60 * 1000;
    }).reduce((sum, trade) => sum + trade.pnl, 0);

    const longTermGains = totalRealizedGains - shortTermGains;
    const shortTermLosses = losses.filter(trade => {
      const holdingPeriod = new Date(trade.date).getTime() - new Date(trade.date).getTime();
      return holdingPeriod < 365 * 24 * 60 * 60 * 1000;
    }).reduce((sum, trade) => sum + Math.abs(trade.pnl), 0);

    const longTermLosses = totalRealizedLosses - shortTermLosses;

    // Calculate wash sale adjustments
    const washSaleAdjustments = calculateWashSales(realizedTrades);
    const tradeFees = realizedTrades.reduce((sum, trade) => sum + (trade.fees || 0), 0);
    const totalFees = tradeFees + additionalFees;

    // Estimate tax (simplified)
    const estimatedTaxOwed = Math.max(0, netCapitalGains) * 0.20; // 20% for long-term
    const shortTermTax = Math.max(0, shortTermGains) * 0.22; // 22% for short-term
    const totalTax = estimatedTaxOwed + shortTermTax;
    const effectiveTaxRate = totalTax > 0 ? (totalTax / Math.max(netCapitalGains, 1)) * 100 : 0;

    setTaxSummary({
      year: selectedYear,
      totalRealizedGains,
      totalRealizedLosses,
      netCapitalGains,
      shortTermGains,
      longTermGains,
      shortTermLosses,
      longTermLosses,
      washSaleAdjustments,
      totalFees,
      tradeCount: realizedTrades.length,
      effectiveTaxRate,
      estimatedTaxOwed: totalTax
    });
  };

  const calculateWashSales = (trades: Trade[]): number => {
    let washSaleAdjustments = 0;
    
    for (let i = 0; i < trades.length; i++) {
      const trade = trades[i];
      if (trade.pnl < 0) {
        const repurchaseDate = new Date(trade.date);
        repurchaseDate.setDate(repurchaseDate.getDate() + 30);
        
        const repurchase = trades.find(t => 
          t.symbol === trade.symbol && 
          t.side === trade.side &&
          new Date(t.date) <= repurchaseDate &&
          new Date(t.date) > new Date(trade.date)
        );
        
        if (repurchase) {
          washSaleAdjustments += Math.abs(trade.pnl);
        }
      }
    }
    
    return washSaleAdjustments;
  };

  const exportTaxReport = () => {
    if (!taxSummary) return;
    
    const taxData = [{
      'Year': taxSummary.year,
      'Total Realized Gains': taxSummary.totalRealizedGains,
      'Total Realized Losses': taxSummary.totalRealizedLosses,
      'Net Capital Gains': taxSummary.netCapitalGains,
      'Short-term Gains': taxSummary.shortTermGains,
      'Long-term Gains': taxSummary.longTermGains,
      'Short-term Losses': taxSummary.shortTermLosses,
      'Long-term Losses': taxSummary.longTermLosses,
      'Wash Sale Adjustments': taxSummary.washSaleAdjustments,
      'Total Fees': taxSummary.totalFees,
      'Trade Count': taxSummary.tradeCount,
      'Estimated Tax Owed': taxSummary.estimatedTaxOwed,
      'Effective Tax Rate (%)': taxSummary.effectiveTaxRate
    }];

    const csvContent = [
      Object.keys(taxData[0]).join(','),
      ...taxData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tax-report-${selectedYear}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: "Tax report exported successfully",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading tax data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-blue-500">
            Tax Reporting Dashboard
          </h2>
          <p className="text-muted-foreground mt-2">
            Comprehensive tax analysis and reporting tools
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSensitiveData(!showSensitiveData)}
          >
            {showSensitiveData ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showSensitiveData ? 'Hide' : 'Show'} Sensitive Data
          </Button>
          <Button onClick={loadTrades} size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Year Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Tax Year Selection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
              <SelectTrigger className="w-32">
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
            <Button onClick={exportTaxReport} disabled={!taxSummary}>
              <Download className="h-4 w-4 mr-2" />
              Export Tax Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tax Summary Cards */}
      {taxSummary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-500">
                Total Gains
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">
                {formatCurrency(taxSummary.totalRealizedGains)}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedYear} realized gains
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-purple-500">
                Total Losses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-500">
                {formatCurrency(taxSummary.totalRealizedLosses)}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedYear} realized losses
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-500">
                Net Capital Gains
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${taxSummary.netCapitalGains >= 0 ? 'text-blue-500' : 'text-purple-500'}`}>
                {formatCurrency(taxSummary.netCapitalGains)}
              </div>
              <p className="text-xs text-muted-foreground">
                Taxable amount
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-purple-600">
                Estimated Tax
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {formatCurrency(taxSummary.estimatedTaxOwed)}
              </div>
              <p className="text-xs text-muted-foreground">
                {taxSummary.effectiveTaxRate.toFixed(1)}% effective rate
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="summary" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="calculator">Tax Calculator</TabsTrigger>
          <TabsTrigger value="wash-sales">Wash Sales</TabsTrigger>
          <TabsTrigger value="details">Trade Details</TabsTrigger>
        </TabsList>

        {/* Summary Tab */}
        <TabsContent value="summary" className="space-y-6">
          {taxSummary ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Capital Gains Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span>Short-term Gains</span>
                      <span className="text-blue-500">{formatCurrency(taxSummary.shortTermGains)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Long-term Gains</span>
                      <span className="text-blue-500">{formatCurrency(taxSummary.longTermGains)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Short-term Losses</span>
                      <span className="text-purple-500">{formatCurrency(taxSummary.shortTermLosses)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Long-term Losses</span>
                      <span className="text-purple-500">{formatCurrency(taxSummary.longTermLosses)}</span>
                    </div>
                    <div className="border-t pt-2">
                      <div className="flex justify-between font-bold">
                        <span>Net Capital Gains</span>
                        <span className={taxSummary.netCapitalGains >= 0 ? 'text-blue-500' : 'text-purple-500'}>
                          {formatCurrency(taxSummary.netCapitalGains)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Tax Adjustments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span>Wash Sale Adjustments</span>
                      <span className="text-purple-600">{formatCurrency(taxSummary.washSaleAdjustments)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Trading Fees</span>
                      <span className="text-purple-500">{formatCurrency(taxSummary.totalFees)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Trades</span>
                      <span>{taxSummary.tradeCount}</span>
                    </div>
                    <div className="border-t pt-2">
                      <div className="flex justify-between font-bold">
                        <span>Estimated Tax Owed</span>
                        <span className="text-purple-600">{formatCurrency(taxSummary.estimatedTaxOwed)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <Calculator className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No trading data available for {selectedYear}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tax Calculator Tab */}
        <TabsContent value="calculator">
          <TaxCalculator />
        </TabsContent>

        {/* Wash Sales Tab */}
        <TabsContent value="wash-sales">
          <WashSaleAnalyzer trades={trades} />
        </TabsContent>

        {/* Trade Details Tab */}
        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Trade Details for {selectedYear}</CardTitle>
              <CardDescription>
                {trades.filter(t => new Date(t.date).getFullYear() === selectedYear).length} trades
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                    {trades
                      .filter(trade => new Date(trade.date).getFullYear() === selectedYear)
                      .map((trade) => (
                        <tr key={trade.id} className="border-b hover:bg-muted/50">
                          <td className="p-2">{new Date(trade.date).toLocaleDateString()}</td>
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Tax Disclaimer */}
      <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10">
        <CardContent className="p-6">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="h-5 w-5 text-purple-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-purple-800 dark:text-purple-200 mb-2">
                Important Tax Disclaimer
              </p>
              <p className="text-purple-700 dark:text-purple-300">
                This tax reporting tool is for informational purposes only and should not be considered as professional tax advice. 
                Tax laws and regulations are complex and subject to change. Please consult with a qualified tax professional 
                or certified public accountant for accurate tax preparation and filing. The calculations provided are estimates 
                and may not reflect your actual tax liability.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
