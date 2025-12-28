import { Connection } from '@solana/web3.js';
import { createClient } from './supabase/client';
import { parseDexTrades, fetchWalletTransactions, type ParsedDexTrade } from './solana-dex-parser';

export interface CopyTradeOpportunity {
  masterId: string;
  masterWallet: string;
  masterTrade: ParsedDexTrade;
  suggestedAmount: number;
  configId: string;
  userId: string;
}

/**
 * Monitor all active copy trading configurations for new trades
 */
export async function monitorCopyTradingConfigs(
  connection: Connection
): Promise<CopyTradeOpportunity[]> {
  const supabase = createClient();
  const opportunities: CopyTradeOpportunity[] = [];

  try {
    // Get all active copy trading configs
    const { data: configs, error: configError } = await supabase
      .from('copy_trading_config')
      .select('*')
      .eq('is_active', true);

    if (configError || !configs || configs.length === 0) {
      return opportunities;
    }

    // Group configs by master wallet to avoid duplicate fetches
    const configsByMaster = new Map<string, any[]>();
    configs.forEach(config => {
      if (!configsByMaster.has(config.master_wallet)) {
        configsByMaster.set(config.master_wallet, []);
      }
      configsByMaster.get(config.master_wallet)!.push(config);
    });

    // Check each master wallet for new trades
    for (const [masterWallet, masterConfigs] of configsByMaster.entries()) {
      try {
        // Fetch recent transactions (last 5 minutes worth)
        const transactions = await fetchWalletTransactions(connection, masterWallet, 10);
        
        // Parse DEX trades
        const trades = await parseDexTrades(transactions, masterWallet);

        // Filter to only very recent trades (last 5 minutes)
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        const recentTrades = trades.filter(trade => {
          const tradeTime = new Date(trade.timestamp).getTime();
          return tradeTime > fiveMinutesAgo;
        });

        // For each recent trade, check all configs for this master
        for (const trade of recentTrades) {
          for (const config of masterConfigs) {
            // Check if we've already created a pending trade for this
            const { data: existing } = await supabase
              .from('pending_copy_trades')
              .select('id')
              .eq('user_id', config.user_id)
              .eq('master_tx_hash', trade.txHash)
              .single();

            if (existing) continue;

            // Check token filters
            if (!shouldCopyTrade(trade, config)) {
              continue;
            }

            // Calculate suggested amount based on position sizing mode
            const suggestedAmount = calculatePositionSize(trade.amountIn, config);

            // Check daily limits
            const canTrade = await checkDailyLimits(config.user_id, config.id);
            if (!canTrade) continue;

            opportunities.push({
              masterId: config.id,
              masterWallet,
              masterTrade: trade,
              suggestedAmount,
              configId: config.id,
              userId: config.user_id,
            });
          }
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error monitoring wallet ${masterWallet}:`, error);
      }
    }

    return opportunities;
  } catch (error) {
    console.error('Error monitoring copy trading configs:', error);
    return opportunities;
  }
}

/**
 * Check if a trade should be copied based on filters
 */
function shouldCopyTrade(trade: ParsedDexTrade, config: any): boolean {
  // Check whitelist
  if (config.token_whitelist && config.token_whitelist.length > 0) {
    const inWhitelist = config.token_whitelist.includes(trade.tokenIn) || 
                       config.token_whitelist.includes(trade.tokenOut);
    if (!inWhitelist) return false;
  }

  // Check blacklist
  if (config.token_blacklist && config.token_blacklist.length > 0) {
    const inBlacklist = config.token_blacklist.includes(trade.tokenIn) || 
                       config.token_blacklist.includes(trade.tokenOut);
    if (inBlacklist) return false;
  }

  return true;
}

/**
 * Calculate position size based on config
 */
function calculatePositionSize(masterAmount: number, config: any): number {
  let amount = 0;

  switch (config.position_sizing_mode) {
    case 'fixed':
      amount = config.fixed_position_size || 0;
      break;
    
    case 'proportional':
      const percentage = config.proportional_percentage || 10;
      amount = masterAmount * (percentage / 100);
      break;
    
    case 'custom':
      // For custom mode, use proportional as fallback
      amount = masterAmount * 0.1;
      break;
    
    case 'kelly':
      // Simplified Kelly: use proportional with win rate adjustment
      // Real Kelly would need more historical data
      amount = masterAmount * 0.1;
      break;
    
    default:
      amount = masterAmount * 0.1;
  }

  // Apply max position size limit
  if (config.max_position_size) {
    amount = Math.min(amount, config.max_position_size);
  }

  // Don't exceed allocated capital
  if (config.allocated_capital) {
    amount = Math.min(amount, config.allocated_capital);
  }

  return amount;
}

/**
 * Check if user has exceeded daily limits
 */
async function checkDailyLimits(userId: string, configId: string): Promise<boolean> {
  const supabase = createClient();
  
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get config
    const { data: config } = await supabase
      .from('copy_trading_config')
      .select('max_daily_trades, max_daily_loss')
      .eq('id', configId)
      .single();

    if (!config) return false;

    // Count today's trades
    const { data: todayPositions } = await supabase
      .from('copy_trading_positions')
      .select('pnl')
      .eq('user_id', userId)
      .eq('config_id', configId)
      .gte('created_at', today.toISOString());

    const tradesCount = todayPositions?.length || 0;
    
    // Check trade count limit
    if (config.max_daily_trades && tradesCount >= config.max_daily_trades) {
      return false;
    }

    // Check daily loss limit
    if (config.max_daily_loss) {
      const todayPnL = todayPositions?.reduce((sum, p) => sum + (parseFloat(p.pnl) || 0), 0) || 0;
      if (todayPnL < -config.max_daily_loss) {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error checking daily limits:', error);
    return false;
  }
}

/**
 * Create pending copy trades from opportunities
 */
export async function createPendingCopyTrades(
  opportunities: CopyTradeOpportunity[]
): Promise<number> {
  const supabase = createClient();
  let created = 0;

  for (const opp of opportunities) {
    try {
      const { error } = await supabase
        .from('pending_copy_trades')
        .insert({
          user_id: opp.userId,
          config_id: opp.configId,
          master_wallet: opp.masterWallet,
          master_tx_hash: opp.masterTrade.txHash,
          token_in: opp.masterTrade.tokenIn,
          token_out: opp.masterTrade.tokenOut,
          suggested_amount_in: opp.suggestedAmount,
          priority: 5, // Default priority
          expires_at: new Date(Date.now() + (5 * 60 * 1000)).toISOString(),
          status: 'pending'
        });

      if (!error) {
        created++;
      }
    } catch (error) {
      console.error('Error creating pending trade:', error);
    }
  }

  return created;
}

/**
 * Auto-execute copy trades for configs with auto_execute enabled
 */
export async function autoExecuteCopyTrades(
  connection: Connection,
  signTransaction: (tx: any) => Promise<any>
): Promise<{ executed: number; failed: number }> {
  const supabase = createClient();
  let executed = 0;
  let failed = 0;

  try {
    // Get pending trades that should auto-execute
    const { data: pendingTrades, error } = await supabase
      .from('pending_copy_trades')
      .select(`
        *,
        copy_trading_config!inner(auto_execute, max_slippage, priority_fee)
      `)
      .eq('status', 'pending')
      .eq('copy_trading_config.auto_execute', true)
      .lt('expires_at', new Date(Date.now() + (4 * 60 * 1000)).toISOString()); // Not about to expire

    if (error || !pendingTrades || pendingTrades.length === 0) {
      return { executed, failed };
    }

    // This is a placeholder - actual execution would require Jupiter integration
    console.log(`Would auto-execute ${pendingTrades.length} pending trades`);
    
    // For now, just mark as requiring manual approval
    for (const trade of pendingTrades) {
      await supabase
        .from('pending_copy_trades')
        .update({ status: 'pending' })
        .eq('id', trade.id);
    }

    return { executed, failed };
  } catch (error) {
    console.error('Error auto-executing trades:', error);
    return { executed, failed };
  }
}

/**
 * Start monitoring loop
 */
export function startCopyTradingMonitor(
  connection: Connection,
  intervalMs: number = 30000
): () => void {
  let isRunning = true;
  let monitorCount = 0;

  const monitor = async () => {
    while (isRunning) {
      try {
        monitorCount++;
        console.log(`Copy trading monitor cycle #${monitorCount}`);
        
        // Find new trade opportunities
        const opportunities = await monitorCopyTradingConfigs(connection);
        
        if (opportunities.length > 0) {
          console.log(`Found ${opportunities.length} copy trade opportunities`);
          
          // Create pending trades
          const created = await createPendingCopyTrades(opportunities);
          console.log(`Created ${created} pending copy trades`);
        }

        // Clean up expired pending trades
        const supabase = createClient();
        await supabase.rpc('expire_old_pending_trades');

      } catch (error) {
        console.error('Monitor cycle error:', error);
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  };

  // Start monitoring in background
  monitor();

  // Return cleanup function
  return () => {
    isRunning = false;
    console.log('Copy trading monitor stopped');
  };
}


