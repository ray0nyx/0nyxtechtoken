import { Connection, PublicKey } from '@solana/web3.js';
import { createClient } from './supabase/client';
import { parseDexTrades, fetchWalletTransactions } from './solana-dex-parser';

export interface TraderPerformanceMetrics {
  wallet_address: string;
  total_pnl: number;
  roi: number;
  win_rate: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  avg_trade_duration: string; // PostgreSQL interval format
  max_drawdown: number;
  sharpe_ratio: number | null;
  risk_score: number;
  consistency_score: number;
  avg_position_size: number;
  largest_win: number;
  largest_loss: number;
  pnl_24h: number;
  pnl_7d: number;
  pnl_30d: number;
  roi_24h: number;
  roi_7d: number;
  roi_30d: number;
  trades_24h: number;
  trades_7d: number;
  trades_30d: number;
  first_trade_at: string;
  last_trade_at: string;
}

/**
 * Analyze a wallet's trading performance
 */
export async function analyzeTraderPerformance(
  connection: Connection,
  walletAddress: string,
  transactionLimit: number = 200
): Promise<TraderPerformanceMetrics | null> {
  try {
    // Fetch transactions
    const transactions = await fetchWalletTransactions(connection, walletAddress, transactionLimit);
    
    // Parse DEX trades
    const trades = await parseDexTrades(transactions, walletAddress);
    
    if (trades.length === 0) {
      return null;
    }

    // Sort by timestamp
    trades.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Calculate basic metrics
    let totalPnL = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let largestWin = 0;
    let largestLoss = 0;
    const tradeSizes: number[] = [];
    const pnls: number[] = [];
    
    // Calculate P&L for each trade (simplified - assumes token amounts)
    trades.forEach(trade => {
      const pnl = trade.amountOut - trade.amountIn;
      pnls.push(pnl);
      totalPnL += pnl;
      tradeSizes.push(trade.amountIn);
      
      if (pnl > 0) {
        winningTrades++;
        largestWin = Math.max(largestWin, pnl);
      } else if (pnl < 0) {
        losingTrades++;
        largestLoss = Math.max(largestLoss, Math.abs(pnl));
      }
    });

    const totalTrades = trades.length;
    const winRate = (winningTrades / totalTrades) * 100;
    const avgPositionSize = tradeSizes.reduce((a, b) => a + b, 0) / tradeSizes.length;

    // Calculate ROI (assuming starting capital = first trade size * 10)
    const estimatedCapital = tradeSizes[0] * 10;
    const roi = (totalPnL / estimatedCapital) * 100;

    // Calculate time-based metrics
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

    const trades24h = trades.filter(t => new Date(t.timestamp).getTime() > oneDayAgo);
    const trades7d = trades.filter(t => new Date(t.timestamp).getTime() > sevenDaysAgo);
    const trades30d = trades.filter(t => new Date(t.timestamp).getTime() > thirtyDaysAgo);

    const pnl24h = trades24h.reduce((sum, t) => sum + (t.amountOut - t.amountIn), 0);
    const pnl7d = trades7d.reduce((sum, t) => sum + (t.amountOut - t.amountIn), 0);
    const pnl30d = trades30d.reduce((sum, t) => sum + (t.amountOut - t.amountIn), 0);

    const roi24h = estimatedCapital > 0 ? (pnl24h / estimatedCapital) * 100 : 0;
    const roi7d = estimatedCapital > 0 ? (pnl7d / estimatedCapital) * 100 : 0;
    const roi30d = estimatedCapital > 0 ? (pnl30d / estimatedCapital) * 100 : 0;

    // Calculate Sharpe Ratio (simplified)
    const avgReturn = pnls.reduce((a, b) => a + b, 0) / pnls.length;
    const variance = pnls.reduce((sum, pnl) => sum + Math.pow(pnl - avgReturn, 2), 0) / pnls.length;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : null; // Annualized

    // Calculate max drawdown
    let peak = 0;
    let maxDrawdown = 0;
    let cumulativePnL = 0;
    
    pnls.forEach(pnl => {
      cumulativePnL += pnl;
      peak = Math.max(peak, cumulativePnL);
      const drawdown = ((peak - cumulativePnL) / Math.max(peak, 1)) * 100;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    });

    // Calculate average trade duration
    let totalDurationMs = 0;
    for (let i = 1; i < trades.length; i++) {
      const duration = new Date(trades[i].timestamp).getTime() - new Date(trades[i - 1].timestamp).getTime();
      totalDurationMs += duration;
    }
    const avgDurationMs = trades.length > 1 ? totalDurationMs / (trades.length - 1) : 0;
    const avgDurationHours = Math.floor(avgDurationMs / (1000 * 60 * 60));
    const avgDurationInterval = `${avgDurationHours} hours`;

    // Calculate risk score (0-100, higher = riskier)
    const riskScore = Math.min(100, 
      (maxDrawdown * 0.4) + // Higher drawdown = higher risk
      ((100 - winRate) * 0.3) + // Lower win rate = higher risk
      ((avgPositionSize / estimatedCapital) * 100 * 0.3) // Larger positions = higher risk
    );

    // Calculate consistency score (0-100, higher = more consistent)
    const consistencyScore = Math.min(100,
      (winRate * 0.5) + // Higher win rate = more consistent
      (Math.min(totalTrades / 100, 1) * 20) + // More trades = more data = more consistent
      ((100 - (stdDev / avgPositionSize) * 100) * 0.3) // Lower volatility = more consistent
    );

    return {
      wallet_address: walletAddress,
      total_pnl: totalPnL,
      roi,
      win_rate: winRate,
      total_trades: totalTrades,
      winning_trades: winningTrades,
      losing_trades: losingTrades,
      avg_trade_duration: avgDurationInterval,
      max_drawdown: maxDrawdown,
      sharpe_ratio: sharpeRatio,
      risk_score: riskScore,
      consistency_score: consistencyScore,
      avg_position_size: avgPositionSize,
      largest_win: largestWin,
      largest_loss: largestLoss,
      pnl_24h,
      pnl_7d,
      pnl_30d,
      roi_24h,
      roi_7d,
      roi_30d,
      trades_24h: trades24h.length,
      trades_7d: trades7d.length,
      trades_30d: trades30d.length,
      first_trade_at: trades[0].timestamp,
      last_trade_at: trades[trades.length - 1].timestamp,
    };
  } catch (error) {
    console.error(`Error analyzing trader ${walletAddress}:`, error);
    return null;
  }
}

/**
 * Update leaderboard with trader performance
 */
export async function updateTraderLeaderboard(
  metrics: TraderPerformanceMetrics
): Promise<void> {
  const supabase = createClient();
  
  try {
    const { error } = await supabase
      .from('copy_trading_leaderboard')
      .upsert({
        wallet_address: metrics.wallet_address,
        blockchain: 'solana',
        total_pnl: metrics.total_pnl,
        roi: metrics.roi,
        win_rate: metrics.win_rate,
        total_trades: metrics.total_trades,
        winning_trades: metrics.winning_trades,
        losing_trades: metrics.losing_trades,
        avg_trade_duration: metrics.avg_trade_duration,
        max_drawdown: metrics.max_drawdown,
        sharpe_ratio: metrics.sharpe_ratio,
        risk_score: metrics.risk_score,
        consistency_score: metrics.consistency_score,
        avg_position_size: metrics.avg_position_size,
        largest_win: metrics.largest_win,
        largest_loss: metrics.largest_loss,
        pnl_24h: metrics.pnl_24h,
        pnl_7d: metrics.pnl_7d,
        pnl_30d: metrics.pnl_30d,
        roi_24h: metrics.roi_24h,
        roi_7d: metrics.roi_7d,
        roi_30d: metrics.roi_30d,
        trades_24h: metrics.trades_24h,
        trades_7d: metrics.trades_7d,
        trades_30d: metrics.trades_30d,
        first_trade_at: metrics.first_trade_at,
        last_trade_at: metrics.last_trade_at,
        last_analyzed_at: new Date().toISOString(),
        is_active: true,
      }, {
        onConflict: 'wallet_address'
      });

    if (error) throw error;
  } catch (error) {
    console.error('Error updating leaderboard:', error);
    throw error;
  }
}

/**
 * Analyze and update multiple traders
 */
export async function batchAnalyzeTraders(
  connection: Connection,
  walletAddresses: string[]
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const address of walletAddresses) {
    try {
      const metrics = await analyzeTraderPerformance(connection, address);
      if (metrics) {
        await updateTraderLeaderboard(metrics);
        success++;
      } else {
        failed++;
      }
      
      // Rate limit: small delay between analyses
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Failed to analyze ${address}:`, error);
      failed++;
    }
  }

  return { success, failed };
}

/**
 * Get top traders from leaderboard
 */
export async function getTopTraders(
  limit: number = 50,
  sortBy: 'roi' | 'total_pnl' | 'win_rate' | 'sharpe_ratio' = 'roi'
) {
  const supabase = createClient();
  
  try {
    const { data, error } = await supabase
      .from('copy_trading_leaderboard')
      .select('*')
      .eq('is_active', true)
      .eq('blockchain', 'solana')
      .order(sortBy, { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching top traders:', error);
    return [];
  }
}


