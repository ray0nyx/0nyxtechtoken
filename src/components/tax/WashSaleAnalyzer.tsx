import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  Calendar, 
  DollarSign, 
  TrendingDown,
  Info,
  RefreshCw
} from 'lucide-react';

interface Trade {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  price: number;
  pnl: number;
  date: string;
  type: 'buy' | 'sell';
}

interface WashSale {
  symbol: string;
  lossTrade: Trade;
  repurchaseTrade: Trade;
  disallowedLoss: number;
  daysBetween: number;
  adjustedBasis: number;
}

interface WashSaleAnalyzerProps {
  trades: Trade[];
}

export function WashSaleAnalyzer({ trades }: WashSaleAnalyzerProps) {
  const [washSales, setWashSales] = useState<WashSale[]>([]);
  const [totalDisallowedLoss, setTotalDisallowedLoss] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    analyzeWashSales();
  }, [trades]);

  const analyzeWashSales = () => {
    setLoading(true);
    
    // Sort trades by date
    const sortedTrades = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const washSaleList: WashSale[] = [];
    let totalDisallowed = 0;

    // Find wash sales
    for (let i = 0; i < sortedTrades.length; i++) {
      const trade = sortedTrades[i];
      
      // Only check sell trades with losses
      if (trade.type === 'sell' && trade.pnl < 0) {
        const sellDate = new Date(trade.date);
        const washSalePeriod = new Date(sellDate);
        washSalePeriod.setDate(washSalePeriod.getDate() + 30);
        
        // Look for repurchase within 30 days
        for (let j = i + 1; j < sortedTrades.length; j++) {
          const repurchaseTrade = sortedTrades[j];
          const repurchaseDate = new Date(repurchaseTrade.date);
          
          if (
            repurchaseTrade.symbol === trade.symbol &&
            repurchaseTrade.type === 'buy' &&
            repurchaseTrade.side === trade.side &&
            repurchaseDate <= washSalePeriod &&
            repurchaseDate > sellDate
          ) {
            const daysBetween = Math.ceil((repurchaseDate.getTime() - sellDate.getTime()) / (1000 * 60 * 60 * 24));
            const disallowedLoss = Math.abs(trade.pnl);
            const adjustedBasis = repurchaseTrade.price + (disallowedLoss / repurchaseTrade.quantity);
            
            washSaleList.push({
              symbol: trade.symbol,
              lossTrade: trade,
              repurchaseTrade: repurchaseTrade,
              disallowedLoss,
              daysBetween,
              adjustedBasis
            });
            
            totalDisallowed += disallowedLoss;
            break; // Only consider first repurchase
          }
        }
      }
    }
    
    setWashSales(washSaleList);
    setTotalDisallowedLoss(totalDisallowed);
    setLoading(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getSeverityColor = (daysBetween: number) => {
    if (daysBetween <= 7) return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
    if (daysBetween <= 14) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
    if (daysBetween <= 21) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
    return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5" />
              Wash Sale Analyzer
            </CardTitle>
            <CardDescription>
              Identifies wash sales and calculates disallowed losses
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={analyzeWashSales}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-500">
              {washSales.length}
            </div>
            <div className="text-sm text-muted-foreground">Wash Sales Found</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-500">
              {formatCurrency(totalDisallowedLoss)}
            </div>
            <div className="text-sm text-muted-foreground">Total Disallowed Loss</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-500">
              {trades.length}
            </div>
            <div className="text-sm text-muted-foreground">Total Trades</div>
          </div>
        </div>

        {/* Wash Sale Rules Info */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Wash Sale Rule:</strong> If you sell a security at a loss and buy the same or substantially identical security within 30 days before or after the sale, the loss is disallowed for tax purposes. The disallowed loss is added to the cost basis of the repurchased security.
          </AlertDescription>
        </Alert>

        {/* Wash Sales List */}
        {washSales.length > 0 ? (
          <div className="space-y-4">
            <h3 className="font-medium">Detected Wash Sales</h3>
            {washSales.map((washSale, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center text-sm font-medium text-red-600">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium">{washSale.symbol}</div>
                      <div className="text-sm text-muted-foreground">
                        {washSale.side} position
                      </div>
                    </div>
                  </div>
                  <Badge className={getSeverityColor(washSale.daysBetween)}>
                    {washSale.daysBetween} days
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-red-600">Loss Trade</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Date:</span>
                        <span>{formatDate(washSale.lossTrade.date)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Price:</span>
                        <span>{formatCurrency(washSale.lossTrade.price)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Quantity:</span>
                        <span>{washSale.lossTrade.quantity}</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span>Loss:</span>
                        <span className="text-red-500">{formatCurrency(washSale.lossTrade.pnl)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-green-600">Repurchase Trade</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Date:</span>
                        <span>{formatDate(washSale.repurchaseTrade.date)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Price:</span>
                        <span>{formatCurrency(washSale.repurchaseTrade.price)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Quantity:</span>
                        <span>{washSale.repurchaseTrade.quantity}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Days Between:</span>
                        <span>{washSale.daysBetween}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Disallowed Loss:</span>
                      <span className="font-medium text-red-500">
                        {formatCurrency(washSale.disallowedLoss)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Adjusted Basis:</span>
                      <span className="font-medium text-blue-500">
                        {formatCurrency(washSale.adjustedBasis)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <TrendingDown className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No wash sales detected</p>
            <p className="text-sm text-muted-foreground mt-2">
              Great! Your trading pattern doesn't trigger wash sale rules.
            </p>
          </div>
        )}

        {/* Recommendations */}
        {washSales.length > 0 && (
          <div className="border-t pt-4">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Recommendations
            </h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• Wait at least 31 days before repurchasing the same security</p>
              <p>• Consider buying a similar but not identical security</p>
              <p>• The disallowed loss will be added to your cost basis for future tax calculations</p>
              <p>• Keep detailed records of all wash sale adjustments</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
