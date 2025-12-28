import { Connection, PublicKey } from '@solana/web3.js';
import { createClient } from './supabase/client';
import { parseDexTrades, fetchWalletTransactions } from './solana-dex-parser';

export interface DiscoveredWallet {
  wallet_address: string;
  total_pnl: number;
  win_rate: number;
  total_trades: number;
  avg_trade_size: number;
  last_trade_date: string;
  consistency_score: number; // 0-100
  activity_score: number; // 0-100
}

/**
 * Analyze a wallet's trading performance
 */
export async function analyzeWalletPerformance(
  connection: Connection,
  walletAddress: string,
  limit: number = 100
): Promise<DiscoveredWallet | null> {
  try {
    // Fetch transactions
    const transactions = await fetchWalletTransactions(connection, walletAddress, limit);
    
    // Parse DEX trades
    const trades = await parseDexTrades(transactions, walletAddress);
    
    if (trades.length === 0) {
      return null;
    }
    
    // Calculate metrics
    let totalPnL = 0;
    let winningTrades = 0;
    const tradeSizes: number[] = [];
    
    // Simple P&L estimation based on price changes
    trades.forEach(trade => {
      const tradeValue = trade.amountIn;
      tradeSizes.push(tradeValue);
      
      // Estimate P&L (simplified - would need better price data for accuracy)
      const estimatedPnL = trade.amountOut - trade.amountIn;
      totalPnL += estimatedPnL;
      
      if (estimatedPnL > 0) {
        winningTrades++;
      }
    });
    
    const winRate = (winningTrades / trades.length) * 100;
    const avgTradeSize = tradeSizes.reduce((a, b) => a + b, 0) / tradeSizes.length;
    
    // Calculate consistency score (based on win rate and trade frequency)
    const consistency = Math.min(100, (winRate * 0.7) + (Math.min(trades.length / 100, 1) * 30));
    
    // Calculate activity score (based on recent trades)
    const recentTrades = trades.filter(t => {
      const tradeDate = new Date(t.timestamp);
      const daysSince = (Date.now() - tradeDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince <= 7;
    });
    const activityScore = Math.min(100, (recentTrades.length / trades.length) * 100);
    
    // Get last trade date
    const lastTrade = trades[0];
    
    return {
      wallet_address: walletAddress,
      total_pnl: totalPnL,
      win_rate: winRate,
      total_trades: trades.length,
      avg_trade_size: avgTradeSize,
      last_trade_date: lastTrade.timestamp,
      consistency_score: consistency,
      activity_score: activityScore,
    };
  } catch (error) {
    console.error(`Error analyzing wallet ${walletAddress}:`, error);
    return null;
  }
}

/**
 * Discover profitable wallets from a seed list
 * This would typically scan known DEX users or follow transaction graphs
 */
export async function discoverProfitableWallets(
  connection: Connection,
  seedWallets: string[],
  minWinRate: number = 70,
  minTrades: number = 50
): Promise<DiscoveredWallet[]> {
  const discovered: DiscoveredWallet[] = [];
  
  for (const walletAddress of seedWallets) {
    try {
      const analysis = await analyzeWalletPerformance(connection, walletAddress);
      
      if (analysis && 
          analysis.win_rate >= minWinRate && 
          analysis.total_trades >= minTrades) {
        discovered.push(analysis);
      }
      
      // Rate limit: small delay between analyses
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.warn(`Failed to analyze wallet ${walletAddress}:`, error);
      continue;
    }
  }
  
  // Sort by combination of win rate and total P&L
  return discovered.sort((a, b) => {
    const scoreA = a.win_rate * 0.5 + (a.total_pnl / 100000) * 0.5;
    const scoreB = b.win_rate * 0.5 + (b.total_pnl / 100000) * 0.5;
    return scoreB - scoreA;
  });
}

/**
 * Save discovered wallets to master_traders table
 */
export async function saveDiscoveredWallets(wallets: DiscoveredWallet[]): Promise<void> {
  const supabase = createClient();
  
  const records = wallets.map(wallet => ({
    wallet_address: wallet.wallet_address,
    label: `Wallet ${wallet.wallet_address.substring(0, 8)}...`,
    description: `Discovered profitable wallet with ${wallet.win_rate.toFixed(1)}% win rate`,
    tags: ['Discovered', wallet.win_rate >= 80 ? 'High Win Rate' : 'Profitable'],
    total_pnl: wallet.total_pnl,
    win_rate: wallet.win_rate,
    total_trades: wallet.total_trades,
    avg_trade_size: wallet.avg_trade_size,
    follower_count: 0,
    is_verified: false,
    is_curated: false,
    last_analyzed_at: new Date().toISOString(),
  }));
  
  const { error } = await supabase
    .from('master_traders')
    .upsert(records, {
      onConflict: 'wallet_address',
    });
  
  if (error) {
    console.error('Error saving discovered wallets:', error);
    throw error;
  }
}

/**
 * Update master trader metrics
 */
export async function updateMasterTraderMetrics(
  connection: Connection,
  walletAddress: string
): Promise<void> {
  const analysis = await analyzeWalletPerformance(connection, walletAddress);
  
  if (!analysis) {
    return;
  }
  
  const supabase = createClient();
  
  const { error } = await supabase
    .from('master_traders')
    .update({
      total_pnl: analysis.total_pnl,
      win_rate: analysis.win_rate,
      total_trades: analysis.total_trades,
      avg_trade_size: analysis.avg_trade_size,
      last_analyzed_at: new Date().toISOString(),
    })
    .eq('wallet_address', walletAddress);
  
  if (error) {
    console.error('Error updating master trader metrics:', error);
  }
}

