import type { AggregatedTrade, EquityPoint } from './crypto-aggregation-service';

/**
 * Calculate ROI (Return on Investment) percentage
 */
export function calculateROI(totalValue: number, initialValue: number): number {
  if (initialValue === 0) return 0;
  return ((totalValue - initialValue) / initialValue) * 100;
}

/**
 * Calculate Profit Factor (Winning trades total / Losing trades total)
 */
export function calculateProfitFactor(trades: AggregatedTrade[]): number {
  const winningTrades = trades.filter(t => (t.pnl || 0) > 0);
  const losingTrades = trades.filter(t => (t.pnl || 0) < 0);
  
  const totalWins = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));
  
  if (totalLosses === 0) return totalWins > 0 ? Infinity : 0;
  return totalWins / totalLosses;
}

/**
 * Calculate Max Drawdown from equity curve
 */
export function calculateMaxDrawdown(equityCurve: EquityPoint[]): number {
  if (equityCurve.length === 0) return 0;
  
  let maxEquity = equityCurve[0].equity;
  let maxDrawdown = 0;
  
  for (const point of equityCurve) {
    if (point.equity > maxEquity) {
      maxEquity = point.equity;
    }
    const drawdown = ((maxEquity - point.equity) / maxEquity) * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  
  return maxDrawdown;
}

/**
 * Calculate Sharpe Ratio (risk-adjusted return)
 * Simplified version: (Average Return - Risk Free Rate) / Standard Deviation
 */
export function calculateSharpeRatio(
  returns: number[],
  riskFreeRate: number = 0.02 // 2% annual risk-free rate
): number {
  if (returns.length === 0) return 0;
  
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const excessReturn = avgReturn - riskFreeRate / 252; // Daily risk-free rate
  
  // Calculate standard deviation
  const variance = returns.reduce((sum, r) => {
    const diff = r - avgReturn;
    return sum + diff * diff;
  }, 0) / returns.length;
  
  const stdDev = Math.sqrt(variance);
  
  if (stdDev === 0) return 0;
  
  // Annualize Sharpe ratio
  return (excessReturn / stdDev) * Math.sqrt(252);
}

/**
 * Calculate Average Win and Loss
 */
export function calculateAverageWinLoss(trades: AggregatedTrade[]): {
  avgWin: number;
  avgLoss: number;
  winCount: number;
  lossCount: number;
} {
  const winningTrades = trades.filter(t => (t.pnl || 0) > 0);
  const losingTrades = trades.filter(t => (t.pnl || 0) < 0);
  
  const totalWins = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const totalLosses = losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  
  return {
    avgWin: winningTrades.length > 0 ? totalWins / winningTrades.length : 0,
    avgLoss: losingTrades.length > 0 ? totalLosses / losingTrades.length : 0,
    winCount: winningTrades.length,
    lossCount: losingTrades.length
  };
}

/**
 * Get Best and Worst Trades
 */
export function getBestWorstTrade(trades: AggregatedTrade[]): {
  best: AggregatedTrade | null;
  worst: AggregatedTrade | null;
} {
  if (trades.length === 0) {
    return { best: null, worst: null };
  }
  
  let best = trades[0];
  let worst = trades[0];
  
  for (const trade of trades) {
    const pnl = trade.pnl || 0;
    if (pnl > (best.pnl || 0)) {
      best = trade;
    }
    if (pnl < (worst.pnl || 0)) {
      worst = trade;
    }
  }
  
  return { best, worst };
}

/**
 * Format compact number (e.g., 1.2K, 3.4M)
 */
export function formatCompactNumber(value: number): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  
  if (absValue >= 1000000000) {
    return `${sign}${(absValue / 1000000000).toFixed(2)}B`;
  }
  if (absValue >= 1000000) {
    return `${sign}${(absValue / 1000000).toFixed(2)}M`;
  }
  if (absValue >= 1000) {
    return `${sign}${(absValue / 1000).toFixed(2)}K`;
  }
  return `${sign}${absValue.toFixed(2)}`;
}

/**
 * Calculate trade frequency (trades per day/week)
 */
export function calculateTradeFrequency(trades: AggregatedTrade[]): {
  perDay: number;
  perWeek: number;
  perMonth: number;
} {
  if (trades.length === 0) {
    return { perDay: 0, perWeek: 0, perMonth: 0 };
  }
  
  const sortedTrades = [...trades].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  const firstTrade = new Date(sortedTrades[0].timestamp);
  const lastTrade = new Date(sortedTrades[sortedTrades.length - 1].timestamp);
  const daysDiff = Math.max(1, (lastTrade.getTime() - firstTrade.getTime()) / (1000 * 60 * 60 * 24));
  
  return {
    perDay: trades.length / daysDiff,
    perWeek: (trades.length / daysDiff) * 7,
    perMonth: (trades.length / daysDiff) * 30
  };
}

/**
 * Calculate average hold time (in hours)
 */
export function calculateAverageHoldTime(trades: AggregatedTrade[]): number {
  // For DEX trades, we don't have entry/exit times, so we'll estimate based on trade frequency
  // For CEX trades, we could use entry_date and exit_date if available
  // For now, return 0 as we need more data structure
  return 0;
}

/**
 * Calculate volatility (standard deviation of returns)
 */
export function calculateVolatility(returns: number[]): number {
  if (returns.length === 0) return 0;
  
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => {
    const diff = r - avgReturn;
    return sum + diff * diff;
  }, 0) / returns.length;
  
  return Math.sqrt(variance) * Math.sqrt(252); // Annualized
}

/**
 * Calculate Value at Risk (VaR) at 95% confidence
 */
export function calculateVaR(returns: number[], confidence: number = 0.95): number {
  if (returns.length === 0) return 0;
  
  const sortedReturns = [...returns].sort((a, b) => a - b);
  const index = Math.floor((1 - confidence) * sortedReturns.length);
  
  return Math.abs(sortedReturns[index] || 0);
}

/**
 * Generate returns array from trades
 */
export function generateReturnsFromTrades(trades: AggregatedTrade[], initialCapital: number = 10000): number[] {
  let equity = initialCapital;
  const returns: number[] = [];
  
  const sortedTrades = [...trades].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  for (const trade of sortedTrades) {
    if (trade.pnl !== undefined) {
      const returnPct = (trade.pnl / equity) * 100;
      returns.push(returnPct);
      equity += trade.pnl;
    }
  }
  
  return returns;
}

