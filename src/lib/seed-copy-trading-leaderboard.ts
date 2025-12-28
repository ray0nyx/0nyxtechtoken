import { createClient } from './supabase/client';
import { CURATED_MASTER_TRADERS } from '@/data/curated-master-traders';

export async function seedCopyTradingLeaderboard() {
  const supabase = createClient();
  
  const now = new Date().toISOString();
  
  const leaderboardData = CURATED_MASTER_TRADERS.map(trader => ({
    wallet_address: trader.wallet_address,
    blockchain: 'solana', // Ensure exact match
    total_pnl: trader.estimated_metrics.pnl_30d || 0,
    roi: calculateROI(trader.estimated_metrics.pnl_30d || 0, trader.estimated_metrics.avg_trade_size || 10000),
    win_rate: trader.estimated_metrics.win_rate || 0,
    total_trades: trader.estimated_metrics.total_trades || 0,
    winning_trades: Math.floor((trader.estimated_metrics.total_trades || 0) * ((trader.estimated_metrics.win_rate || 0) / 100)),
    losing_trades: Math.floor((trader.estimated_metrics.total_trades || 0) * (1 - (trader.estimated_metrics.win_rate || 0) / 100)),
    avg_trade_duration: '12 hours', // Estimate
    max_drawdown: trader.risk_level === 'low' ? 8.5 : trader.risk_level === 'medium' ? 15.2 : 25.8,
    sharpe_ratio: trader.risk_level === 'low' ? 2.1 : trader.risk_level === 'medium' ? 1.5 : 0.9,
    risk_score: trader.risk_level === 'low' ? 25 : trader.risk_level === 'medium' ? 50 : 75,
    consistency_score: trader.estimated_metrics.win_rate || 50,
    avg_position_size: trader.estimated_metrics.avg_trade_size || 10000,
    largest_win: (trader.estimated_metrics.avg_trade_size || 10000) * 3,
    largest_loss: (trader.estimated_metrics.avg_trade_size || 10000) * 0.8,
    pnl_30d: trader.estimated_metrics.pnl_30d || 0,
    roi_30d: calculateROI(trader.estimated_metrics.pnl_30d || 0, trader.estimated_metrics.avg_trade_size || 10000),
    trades_30d: trader.estimated_metrics.total_trades || 0,
    is_active: true, // Ensure is_active is explicitly set to true
    is_verified: trader.is_verified,
    follower_count: trader.follower_count_estimate || 0,
    assets_under_copy: (trader.follower_count_estimate || 0) * 5000, // Estimate $5k per follower
    last_trade_at: now, // Add timestamp
    created_at: now, // Add timestamp
  }));

  const { error } = await supabase
    .from('copy_trading_leaderboard')
    .upsert(leaderboardData, {
      onConflict: 'wallet_address'
    });

  if (error) {
    console.error('Error seeding leaderboard:', error);
    throw error;
  }

  console.log(`✓ Seeded ${leaderboardData.length} traders to leaderboard`);
  return leaderboardData.length;
}

function calculateROI(pnl: number, avgTradeSize: number): number {
  const estimatedCapital = avgTradeSize * 10; // Assume capital is 10x average trade size
  if (estimatedCapital === 0) return 0;
  return (pnl / estimatedCapital) * 100;
}


