import { PublicKey } from '@solana/web3.js';
import { createClient } from './supabase/client';
import { fetchWalletTrades, getSolPrice } from './helius-service';

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
  connection: any, // Connection type no longer strictly needed for Helius but kept for compatibility
  walletAddress: string,
  transactionLimit: number = 200
): Promise<TraderPerformanceMetrics | null> {
  try {
    // Fetch trades from Helius (much more reliable enhanced transactions)
    const heliusApiKey = import.meta.env.VITE_HELIUS_API_KEY;
    console.log(`Analyzing trader ${walletAddress} via Helius... (API Key: ${heliusApiKey ? 'Configured' : 'MISSING'})`);
    const trades = await fetchWalletTrades(walletAddress, transactionLimit);
    console.log(`[Helius] Found ${trades.length} parsed trades for ${walletAddress}`);

    if (trades.length === 0) {
      console.log(`[Helius] No trades found for ${walletAddress}. This usually means Helius transactions don't match any trade patterns.`);
      return null;
    }

    // Sort by timestamp
    trades.sort((a, b) => a.timestamp - b.timestamp);

    // Calculate basic metrics
    let totalPnL = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let largestWin = 0;
    let largestLoss = 0;
    const tradeSizes: number[] = [];
    const pnls: number[] = [];

    // Calculate P&L by token to determine win rate
    const tokenStats = new Map<string, { buys: number, sells: number, buyVolume: number, sellVolume: number }>();

    trades.forEach(trade => {
      const stats = tokenStats.get(trade.tokenAddress) || { buys: 0, sells: 0, buyVolume: 0, sellVolume: 0 };

      if (trade.type === 'buy') {
        stats.buys++;
        stats.buyVolume += trade.solAmount;
        totalPnL -= trade.solAmount;
        tradeSizes.push(trade.solAmount);
      } else {
        stats.sells++;
        stats.sellVolume += trade.solAmount;
        totalPnL += trade.solAmount;
        tradeSizes.push(trade.solAmount);
      }

      tokenStats.set(trade.tokenAddress, stats);
    });

    console.log(`Token distribution for ${walletAddress}:`, Object.fromEntries(tokenStats));

    // Determine winning tokens (improved: use a slightly lower threshold for SOL dust)
    tokenStats.forEach((stats, token) => {
      const pnl = stats.sellVolume - stats.buyVolume;
      pnls.push(pnl);

      console.log(`Token ${token}: BuyVol=${stats.buyVolume.toFixed(4)}, SellVol=${stats.sellVolume.toFixed(4)}, PnL=${pnl.toFixed(4)}`);

      if (pnl > 0.001) { // Positive P&L in SOL (> 0.001 SOL)
        winningTrades++;
        largestWin = Math.max(largestWin, pnl);
      } else if (pnl < -0.001) {
        losingTrades++;
        largestLoss = Math.max(largestLoss, Math.abs(pnl));
      }
    });

    const totalTrades = trades.length;
    const winRate = tokenStats.size > 0 ? (winningTrades / tokenStats.size) * 100 : 0;
    const avgPositionSize = tradeSizes.reduce((a, b) => a + b, 0) / tradeSizes.length;

    // Convert metrics to USD
    // Convert metrics to USD
    const solPrice = await getSolPrice().catch(() => 0); // Default to 0 if all fetches fail
    const totalPnLUsd = totalPnL * solPrice;
    const avgPositionSizeUsd = avgPositionSize * solPrice;

    console.log(`Stats for ${walletAddress} (USD): Trades=${totalTrades}, Tokens=${tokenStats.size}, WinRate=${winRate.toFixed(2)}%, PnL=$${totalPnLUsd.toFixed(2)}`);

    // Log token P&Ls for debugging
    tokenStats.forEach((stats, token) => {
      const tokenPnl = (stats.sellVolume - stats.buyVolume) * solPrice;
      if (Math.abs(tokenPnl) > 0.1) {
        console.log(`  Token ${token.slice(0, 8)}... P&L: $${tokenPnl.toFixed(2)}`);
      }
    });

    // Calculate ROI (assuming starting capital is based on average position size in USD)
    // Using a more realistic capital estimate: max(avg size * 5, $500)
    const estimatedCapitalUsd = Math.max(avgPositionSizeUsd * 5, 500);
    const roi = (totalPnLUsd / estimatedCapitalUsd) * 100;

    // Calculate time-based metrics
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

    const trades24h = trades.filter(t => t.timestamp > oneDayAgo);
    const trades7d = trades.filter(t => t.timestamp > sevenDaysAgo);
    const trades30d = trades.filter(t => t.timestamp > thirtyDaysAgo);

    const pnl24hUsd = trades24h.reduce((sum, t) => sum + (t.type === 'sell' ? t.solAmount : -t.solAmount), 0) * solPrice;
    const pnl7dUsd = trades7d.reduce((sum, t) => sum + (t.type === 'sell' ? t.solAmount : -t.solAmount), 0) * solPrice;
    const pnl30dUsd = trades30d.reduce((sum, t) => sum + (t.type === 'sell' ? t.solAmount : -t.solAmount), 0) * solPrice;

    console.log(`P&L (30d) for ${walletAddress}: $${pnl30dUsd.toFixed(2)} based on ${trades30d.length} trades`);

    const roi24h = estimatedCapitalUsd > 0 ? (pnl24hUsd / (estimatedCapitalUsd / 10)) * 100 : 0;
    const roi7d = estimatedCapitalUsd > 0 ? (pnl7dUsd / (estimatedCapitalUsd / 10)) * 100 : 0;
    const roi30d = estimatedCapitalUsd > 0 ? (pnl30dUsd / (estimatedCapitalUsd / 10)) * 100 : 0;

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
      ((avgPositionSizeUsd / estimatedCapitalUsd) * 100 * 0.3) // Larger positions = higher risk
    );

    // Calculate consistency score (0-100, higher = more consistent)
    const consistencyScore = Math.min(100,
      (winRate * 0.5) + // Higher win rate = more consistent
      (Math.min(totalTrades / 100, 1) * 20) + // More trades = more data = more consistent
      ((100 - (stdDev / (avgPositionSizeUsd / solPrice)) * 100) * 0.3) // Lower volatility = more consistent (volatility is calculated on SOL PnL, so compare to SOL avg size)
    );

    return {
      wallet_address: walletAddress,
      total_pnl: totalPnLUsd,
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
      avg_position_size: avgPositionSizeUsd,
      largest_win: largestWin * solPrice,
      largest_loss: largestLoss * solPrice,
      pnl_24h: pnl24hUsd,
      pnl_7d: pnl7dUsd,
      pnl_30d: pnl30dUsd,
      roi_24h: roi24h,
      roi_7d: roi7d,
      roi_30d: roi30d,
      trades_24h: trades24h.length,
      trades_7d: trades7d.length,
      trades_30d: trades30d.length,
      first_trade_at: new Date(trades[0].timestamp).toISOString(),
      last_trade_at: new Date(trades[trades.length - 1].timestamp).toISOString(),
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

    if (error) {
      console.error('Error updating leaderboard in Supabase:', error);
      throw error;
    }
    console.log(`Successfully updated leaderboard for ${metrics.wallet_address}`);
  } catch (error) {
    throw error;
  }
}

/**
 * Analyze and update multiple traders
 */
export async function batchAnalyzeTraders(
  connection: any,
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


