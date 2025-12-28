import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { createClient } from './supabase/client';
import { parseDexTrades, fetchWalletTransactions, type ParsedDexTrade } from './solana-dex-parser';

export interface CopyTradeResult {
  success: boolean;
  copyTradeId?: string;
  txHash?: string;
  error?: string;
}

export interface CopyTradeNotification {
  masterWallet: string;
  masterTraderLabel: string;
  trade: ParsedDexTrade;
  suggestedAmount: number;
  copyTradeId: string;
}

/**
 * Monitor master trader wallets for new trades
 */
export async function monitorMasterTraderWallets(
  connection: Connection,
  userId: string
): Promise<CopyTradeNotification[]> {
  const supabase = createClient();
  const notifications: CopyTradeNotification[] = [];

  try {
    // Get user's followed traders with copy trading enabled
    const { data: followedTraders, error: followError } = await supabase
      .from('master_trader_followers')
      .select(`
        *,
        master_traders (*)
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('copy_trading_enabled', true);

    if (followError || !followedTraders) {
      return notifications;
    }

    // Get user's copy settings
    const { data: settings } = await supabase
      .from('copy_trading_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const copySettings = settings || {
      max_copy_amount_per_trade: 1000,
      position_size_percentage: 10,
    };

    // Check each master trader for new trades
    for (const follower of followedTraders) {
      const masterTrader = follower.master_traders;
      if (!masterTrader) continue;

      try {
        // Fetch recent transactions (check last 5 minutes)
        const transactions = await fetchWalletTransactions(
          connection,
          masterTrader.wallet_address,
          10
        );

        // Parse DEX trades
        const trades = await parseDexTrades(transactions, masterTrader.wallet_address);

        // Filter to only trades in last 5 minutes
        const recentTrades = trades.filter(trade => {
          const tradeTime = new Date(trade.timestamp).getTime();
          const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
          return tradeTime > fiveMinutesAgo;
        });

        // Create copy trade records for new trades
        for (const trade of recentTrades) {
          // Check if we've already created a copy trade for this transaction
          const { data: existing } = await supabase
            .from('copy_trades')
            .select('id')
            .eq('user_id', userId)
            .eq('source_tx_hash', trade.txHash)
            .single();

          if (existing) continue;

          // Calculate suggested copy amount based on settings
          const suggestedAmount = Math.min(
            trade.amountIn * (copySettings.position_size_percentage / 100),
            copySettings.max_copy_amount_per_trade
          );

          // Create copy trade record
          const { data: copyTrade, error: insertError } = await supabase
            .from('copy_trades')
            .insert({
              user_id: userId,
              master_trader_id: masterTrader.id,
              master_wallet: masterTrader.wallet_address,
              source_tx_hash: trade.txHash,
              token_in: trade.tokenIn,
              token_out: trade.tokenOut,
              amount_in: trade.amountIn,
              amount_out: trade.amountOut,
              suggested_amount_in: suggestedAmount,
              execution_mode: follower.copy_mode,
              status: 'pending',
              slippage_tolerance: copySettings.slippage_tolerance,
              max_price_impact: copySettings.max_price_impact,
            })
            .select()
            .single();

          if (!insertError && copyTrade) {
            const notification = {
              masterWallet: masterTrader.wallet_address,
              masterTraderLabel: masterTrader.label,
              trade,
              suggestedAmount,
              copyTradeId: copyTrade.id,
            };
            
            notifications.push(notification);
            
            // Create notification in database if notifications table exists
            try {
              await supabase
                .from('notifications')
                .insert({
                  user_id: userId,
                  type: 'copy_trade',
                  title: `New Trade from ${masterTrader.label}`,
                  message: `${masterTrader.label} executed a trade: ${trade.tokenIn} → ${trade.tokenOut}`,
                  data: {
                    copy_trade_id: copyTrade.id,
                    master_wallet: masterTrader.wallet_address,
                    trade_details: {
                      token_in: trade.tokenIn,
                      token_out: trade.tokenOut,
                      amount_in: trade.amountIn,
                      amount_out: trade.amountOut,
                      tx_hash: trade.txHash
                    }
                  },
                  read: false
                });
            } catch (notifError: any) {
              // Suppress errors if notifications table doesn't exist
              if (notifError?.code !== '42P01' && 
                  notifError?.code !== 'PGRST202' && 
                  notifError?.status !== 404 &&
                  !notifError?.message?.includes('does not exist') &&
                  !notifError?.message?.includes('404')) {
                console.error('Error creating notification:', notifError);
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error monitoring wallet ${masterTrader.wallet_address}:`, error);
      }
    }

    return notifications;
  } catch (error) {
    console.error('Error monitoring master traders:', error);
    return notifications;
  }
}

/**
 * Calculate position size based on user's balance and settings
 */
export async function calculatePositionSize(
  connection: Connection,
  userPublicKey: PublicKey,
  tradeAmount: number,
  positionSizePercentage: number,
  maxAmountPerTrade: number
): Promise<number> {
  try {
    // Get user's SOL balance
    const balance = await connection.getBalance(userPublicKey);
    const solBalance = balance / 1e9; // Convert lamports to SOL

    // Calculate position size as percentage of balance
    const positionSize = Math.min(
      solBalance * (positionSizePercentage / 100),
      maxAmountPerTrade,
      tradeAmount // Don't exceed the master trader's trade size
    );

    return positionSize;
  } catch (error) {
    console.error('Error calculating position size:', error);
    return 0;
  }
}

/**
 * Generate transaction instructions for copy trade
 * Note: This is a simplified version. In production, you would:
 * 1. Use Jupiter Aggregator API to get the best route
 * 2. Build the transaction with proper slippage and price impact checks
 * 3. Handle token accounts, approvals, etc.
 */
export async function generateCopyTradeTransaction(
  connection: Connection,
  userPublicKey: PublicKey,
  copyTradeId: string,
  tokenIn: string,
  tokenOut: string,
  amountIn: number,
  slippageTolerance: number
): Promise<Transaction | null> {
  try {
    // This is a placeholder for the actual implementation
    // In production, you would:
    
    // 1. Call Jupiter API to get swap route
    // const route = await getJupiterRoute(tokenIn, tokenOut, amountIn, slippageTolerance);
    
    // 2. Get transaction instructions from Jupiter
    // const { instructions } = await getJupiterSwapInstructions(route, userPublicKey);
    
    // 3. Build transaction
    // const transaction = new Transaction();
    // instructions.forEach(ix => transaction.add(ix));
    
    // 4. Set recent blockhash
    // const { blockhash } = await connection.getLatestBlockhash();
    // transaction.recentBlockhash = blockhash;
    // transaction.feePayer = userPublicKey;
    
    // For now, return null to indicate this needs implementation
    console.warn('Copy trade transaction generation not yet implemented');
    console.log('Would generate transaction for:', {
      copyTradeId,
      tokenIn,
      tokenOut,
      amountIn,
      slippageTolerance,
    });
    
    return null;
  } catch (error) {
    console.error('Error generating copy trade transaction:', error);
    return null;
  }
}

/**
 * Execute a copy trade (manual confirmation required)
 */
export async function executeCopyTrade(
  connection: Connection,
  userPublicKey: PublicKey,
  copyTradeId: string,
  signTransaction: (tx: Transaction) => Promise<Transaction>
): Promise<CopyTradeResult> {
  const supabase = createClient();

  try {
    // Get copy trade details
    const { data: copyTrade, error: fetchError } = await supabase
      .from('copy_trades')
      .select('*')
      .eq('id', copyTradeId)
      .single();

    if (fetchError || !copyTrade) {
      return { success: false, error: 'Copy trade not found' };
    }

    if (copyTrade.status !== 'pending') {
      return { success: false, error: 'Copy trade is no longer pending' };
    }

    // Generate transaction
    const transaction = await generateCopyTradeTransaction(
      connection,
      userPublicKey,
      copyTradeId,
      copyTrade.token_in,
      copyTrade.token_out,
      copyTrade.suggested_amount_in,
      copyTrade.slippage_tolerance
    );

    if (!transaction) {
      return { 
        success: false, 
        error: 'Transaction generation not yet implemented. This feature is coming soon!' 
      };
    }

    // Sign transaction
    const signedTx = await signTransaction(transaction);

    // Send transaction
    const signature = await connection.sendRawTransaction(signedTx.serialize());

    // Confirm transaction
    await connection.confirmTransaction(signature);

    // Update copy trade record
    await supabase
      .from('copy_trades')
      .update({
        status: 'executed',
        user_tx_hash: signature,
        executed_at: new Date().toISOString(),
      })
      .eq('id', copyTradeId);

    return {
      success: true,
      copyTradeId,
      txHash: signature,
    };
  } catch (error: any) {
    console.error('Error executing copy trade:', error);

    // Update copy trade with error
    await supabase
      .from('copy_trades')
      .update({
        status: 'failed',
        error_message: error.message || 'Unknown error',
      })
      .eq('id', copyTradeId);

    return {
      success: false,
      error: error.message || 'Failed to execute copy trade',
    };
  }
}

/**
 * Cancel a pending copy trade
 */
export async function cancelCopyTrade(copyTradeId: string): Promise<boolean> {
  const supabase = createClient();

  try {
    const { error } = await supabase
      .from('copy_trades')
      .update({ status: 'cancelled' })
      .eq('id', copyTradeId)
      .eq('status', 'pending');

    return !error;
  } catch (error) {
    console.error('Error cancelling copy trade:', error);
    return false;
  }
}

/**
 * Get pending copy trades for user
 */
export async function getPendingCopyTrades(userId: string) {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('copy_trades')
      .select(`
        *,
        master_traders (
          label,
          wallet_address
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error fetching pending copy trades:', error);
    return [];
  }
}

/**
 * Get copy trade history for user
 */
export async function getCopyTradeHistory(userId: string, limit: number = 50) {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('copy_trades')
      .select(`
        *,
        master_traders (
          label,
          wallet_address
        )
      `)
      .eq('user_id', userId)
      .in('status', ['executed', 'failed', 'cancelled'])
      .order('executed_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error fetching copy trade history:', error);
    return [];
  }
}

/**
 * Start monitoring loop (call this in a useEffect or worker)
 */
export function startCopyTradingMonitor(
  connection: Connection,
  userId: string,
  onNewTrade: (notification: CopyTradeNotification) => void,
  intervalMs: number = 30000 // 30 seconds
): () => void {
  let isRunning = true;

  const monitor = async () => {
    while (isRunning) {
      try {
        const notifications = await monitorMasterTraderWallets(connection, userId);
        notifications.forEach(notification => onNewTrade(notification));
      } catch (error) {
        console.error('Monitor error:', error);
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  };

  // Start monitoring
  monitor();

  // Return cleanup function
  return () => {
    isRunning = false;
  };
}

