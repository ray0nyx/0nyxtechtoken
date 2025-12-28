import { createClient } from './supabase/client';

export interface AggregatedTrade {
  id: string;
  timestamp: string;
  source: 'dex' | 'cex';
  sourceName: string; // e.g., "Jupiter", "Binance"
  symbol?: string;
  tokenIn?: string;
  tokenOut?: string;
  amountIn: number;
  amountOut?: number;
  pnl?: number;
  side?: 'buy' | 'sell';
  wallet?: string;
  exchange?: string;
}

export interface PnLHistoryPoint {
  date: string;
  pnl: number;
  cumulativePnl: number;
}

export interface EquityPoint {
  date: string;
  equity: number;
}

export interface AggregatedCryptoStats {
  totalValue: number;
  totalPnL: number;
  winRate: number;
  totalTrades: number;
  avgTradeSize: number;
  recentTrades: AggregatedTrade[];
  pnlHistory: PnLHistoryPoint[];
  equityCurve: EquityPoint[];
}

/**
 * Fetch aggregated crypto data from all sources
 */
export async function fetchAggregatedCryptoData(userId: string): Promise<AggregatedCryptoStats> {
  const supabase = createClient();
  
  try {
    // Fetch DEX trades
    const { data: dexTrades, error: dexError } = await supabase
      .from('dex_trades')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false });

    if (dexError) {
      console.error('Error fetching DEX trades:', dexError);
    }

    // Fetch CEX trades (with defensive query structure)
    let cexTrades: any[] = [];
    try {
      // First, try to get trades with exchange_connection_id
      // Fetch trades and exchange data separately to avoid relationship ambiguity
      const { data: simpleData, error: simpleError } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', userId)
        .not('exchange_connection_id', 'is', null)
        .order('created_at', { ascending: false });

      if (!simpleError && simpleData && simpleData.length > 0) {
        // Fetch exchange names separately
        const exchangeIds = [...new Set(simpleData.map((t: any) => t.exchange_connection_id).filter(Boolean))];
        if (exchangeIds.length > 0) {
          const { data: exchangeData } = await supabase
            .from('user_exchange_connections')
            .select('id, exchange_name')
            .in('id', exchangeIds);

          // Map exchange names to trades
          const exchangeMap = new Map((exchangeData || []).map((e: any) => [e.id, e.exchange_name]));
          cexTrades = simpleData.map((trade: any) => ({
            ...trade,
            user_exchange_connections: trade.exchange_connection_id ? [{
              exchange_name: exchangeMap.get(trade.exchange_connection_id) || 'Unknown'
            }] : []
          }));
        } else {
          cexTrades = simpleData;
        }
      } else if (simpleError) {
        // If column doesn't exist, try query without the filter
        console.warn('CEX trades query failed (column may not exist):', simpleError);
        const { data: allTrades } = await supabase
          .from('trades')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(100);
        
        // Filter in memory for trades that might be CEX trades
        cexTrades = (allTrades || []).filter((trade: any) => 
          trade.broker || trade.exchange || trade.exchange_connection_id
        );
      }
    } catch (error) {
      console.warn('CEX trades fetch error:', error);
      // Return empty array on error - graceful degradation
      cexTrades = [];
    }

    // Process DEX trades
    const processedDexTrades: AggregatedTrade[] = (dexTrades || []).map(trade => {
      const amountIn = parseFloat(trade.amount_in) || 0;
      const amountOut = parseFloat(trade.amount_out) || 0;
      
      // Simple P&L calculation: If amount out > amount in, it's profitable
      // This is a simplified calculation. For accurate USD P&L, we'd need token prices
      const estimatedPnl = amountOut - amountIn;
      
      return {
        id: trade.id,
        timestamp: trade.timestamp,
        source: 'dex' as const,
        sourceName: getDexName(trade.dex),
        tokenIn: trade.token_in,
        tokenOut: trade.token_out,
        amountIn,
        amountOut,
        pnl: estimatedPnl,
        wallet: trade.wallet
      };
    });

    // Process CEX trades
    const processedCexTrades: AggregatedTrade[] = (cexTrades || []).map(trade => ({
      id: trade.id,
      timestamp: trade.created_at,
      source: 'cex' as const,
      sourceName: (trade.user_exchange_connections as any)?.exchange_name || 'Exchange',
      symbol: trade.symbol,
      amountIn: parseFloat(trade.quantity) * parseFloat(trade.entry_price),
      amountOut: trade.exit_price ? parseFloat(trade.quantity) * parseFloat(trade.exit_price) : undefined,
      pnl: trade.pnl ? parseFloat(trade.pnl) : undefined,
      side: trade.side,
      exchange: (trade.user_exchange_connections as any)?.exchange_name
    }));

    // Combine all trades
    const allTrades = [...processedDexTrades, ...processedCexTrades];
    
    // Sort by timestamp descending
    allTrades.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Calculate metrics
    const totalTrades = allTrades.length;
    
    // Calculate total P&L
    const totalPnL = allTrades.reduce((sum, trade) => {
      return sum + (trade.pnl || 0);
    }, 0);

    // Calculate win rate
    let winningTrades = 0;
    allTrades.forEach(trade => {
      if (trade.source === 'dex') {
        // For DEX, consider it a win if amount_out > amount_in
        if (trade.amountOut && trade.amountOut > trade.amountIn) {
          winningTrades++;
        }
      } else {
        // For CEX, check if pnl > 0
        if (trade.pnl && trade.pnl > 0) {
          winningTrades++;
        }
      }
    });
    
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    // Calculate average trade size
    const totalVolume = allTrades.reduce((sum, trade) => sum + trade.amountIn, 0);
    const avgTradeSize = totalTrades > 0 ? totalVolume / totalTrades : 0;

    // Calculate total portfolio value (simplified - would need current prices for accuracy)
    const totalValue = totalVolume + totalPnL;

    // Calculate P&L history
    const pnlHistory = calculatePnLHistory(allTrades);

    // Calculate equity curve
    const equityCurve = calculateEquityCurve(allTrades, 10000); // Starting capital of $10,000

    return {
      totalValue,
      totalPnL,
      winRate,
      totalTrades,
      avgTradeSize,
      recentTrades: allTrades.slice(0, 20), // Return top 20 recent trades
      pnlHistory,
      equityCurve
    };
  } catch (error) {
    console.error('Error fetching aggregated crypto data:', error);
    throw error;
  }
}

/**
 * Calculate P&L history over time
 */
function calculatePnLHistory(trades: AggregatedTrade[]): PnLHistoryPoint[] {
  if (trades.length === 0) {
    return [];
  }

  // Sort trades by timestamp ascending
  const sortedTrades = [...trades].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Group trades by date and calculate cumulative P&L
  const pnlByDate: Map<string, { pnl: number; cumulativePnl: number }> = new Map();
  let cumulativePnl = 0;

  sortedTrades.forEach(trade => {
    const date = new Date(trade.timestamp).toISOString().split('T')[0];
    const tradePnl = trade.pnl || 0;
    cumulativePnl += tradePnl;

    if (pnlByDate.has(date)) {
      const existing = pnlByDate.get(date)!;
      pnlByDate.set(date, {
        pnl: existing.pnl + tradePnl,
        cumulativePnl
      });
    } else {
      pnlByDate.set(date, {
        pnl: tradePnl,
        cumulativePnl
      });
    }
  });

  // Convert to array
  const history: PnLHistoryPoint[] = Array.from(pnlByDate.entries()).map(([date, data]) => ({
    date,
    pnl: data.pnl,
    cumulativePnl: data.cumulativePnl
  }));

  return history;
}

/**
 * Calculate equity curve over time
 */
function calculateEquityCurve(trades: AggregatedTrade[], startingCapital: number): EquityPoint[] {
  if (trades.length === 0) {
    return [{ date: 'Start', equity: startingCapital }];
  }

  // Sort trades by timestamp ascending
  const sortedTrades = [...trades].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  let equity = startingCapital;
  const curve: EquityPoint[] = [{ date: 'Start', equity: startingCapital }];

  sortedTrades.forEach(trade => {
    if (trade.pnl) {
      equity += trade.pnl;
      curve.push({
        date: new Date(trade.timestamp).toLocaleDateString(),
        equity: Math.max(0, equity) // Never go below 0
      });
    }
  });

  return curve;
}

/**
 * Get human-readable DEX name
 */
function getDexName(dex: string): string {
  const dexNames: Record<string, string> = {
    jupiter: 'Jupiter',
    raydium: 'Raydium',
    orca: 'Orca',
    meteora: 'Meteora'
  };
  return dexNames[dex.toLowerCase()] || dex;
}

/**
 * Format currency value
 */
export function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
}

/**
 * Format percentage
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Get color class based on value (positive/negative)
 */
export function getValueColorClass(value: number): string {
  if (value > 0) return 'text-emerald-400';
  if (value < 0) return 'text-red-400';
  return 'text-slate-400';
}

/**
 * Get win rate color based on percentage
 */
export function getWinRateColor(winRate: number): string {
  if (winRate >= 60) return '#10b981'; // green
  if (winRate >= 40) return '#f59e0b'; // yellow
  return '#ef4444'; // red
}

