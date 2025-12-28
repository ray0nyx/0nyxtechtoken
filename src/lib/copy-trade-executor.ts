import { Connection, PublicKey, VersionedTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { createClient } from './supabase/client';
import { getJupiterQuote, getJupiterSwapTransaction, executeJupiterSwap } from './jupiter-swap-service';
import { requestTransactionSignature } from './wallet-abstraction/signature-service';
// Note: copy-trade-executor uses the backward-compatible functions from jupiter-swap-service
// which now use the SDK internally, so no changes needed here
// Also supports Turnkey wallets via signature-service

export interface CopyTradeExecutionResult {
  success: boolean;
  positionId?: string;
  txHash?: string;
  error?: string;
  executionDelayMs?: number;
}

/**
 * Execute a pending copy trade
 */
export async function executeCopyTrade(
  connection: Connection,
  userPublicKey: PublicKey,
  pendingTradeId: string,
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>
): Promise<CopyTradeExecutionResult> {
  const supabase = createClient();
  const startTime = Date.now();

  try {
    // Get pending trade details
    const { data: pendingTrade, error: fetchError } = await supabase
      .from('pending_copy_trades')
      .select(`
        *,
        copy_trading_config (*)
      `)
      .eq('id', pendingTradeId)
      .single();

    if (fetchError || !pendingTrade) {
      return { success: false, error: 'Pending trade not found' };
    }

    if (pendingTrade.status !== 'pending') {
      return { success: false, error: 'Trade is no longer pending' };
    }

    // Check if expired
    if (new Date(pendingTrade.expires_at) < new Date()) {
      await supabase
        .from('pending_copy_trades')
        .update({ status: 'expired' })
        .eq('id', pendingTradeId);
      return { success: false, error: 'Trade has expired' };
    }

    const config = pendingTrade.copy_trading_config;

    // Convert amount to lamports or token smallest unit
    const amountInSmallestUnit = Math.floor(pendingTrade.suggested_amount_in * LAMPORTS_PER_SOL);

    // Get quote from Jupiter
    const slippageBps = Math.floor((config.max_slippage || 1) * 100); // Convert % to basis points
    
    const quote = await getJupiterQuote(
      pendingTrade.token_in,
      pendingTrade.token_out,
      amountInSmallestUnit,
      slippageBps
    );

    if (!quote) {
      throw new Error('Failed to get swap quote from Jupiter');
    }

    // Check price impact
    if (quote.priceImpactPct > (config.max_price_impact || 5)) {
      throw new Error(`Price impact too high: ${quote.priceImpactPct}%`);
    }

    // Get swap transaction
    const priorityFeeLamports = config.priority_fee 
      ? Math.floor(config.priority_fee * LAMPORTS_PER_SOL)
      : undefined;

    const swapResult = await getJupiterSwapTransaction(
      quote,
      userPublicKey,
      priorityFeeLamports
    );

    if (!swapResult) {
      throw new Error('Failed to get swap transaction');
    }

    // Execute the swap
    const txHash = await executeJupiterSwap(
      connection,
      swapResult.swapTransaction,
      signTransaction
    );

    if (!txHash) {
      throw new Error('Failed to execute swap transaction');
    }

    const executionDelayMs = Date.now() - startTime;

    // Create position record
    const { data: position, error: positionError } = await supabase
      .from('copy_trading_positions')
      .insert({
        user_id: pendingTrade.user_id,
        config_id: pendingTrade.config_id,
        master_wallet: pendingTrade.master_wallet,
        master_tx_hash: pendingTrade.master_tx_hash,
        master_token_in: pendingTrade.token_in,
        master_token_out: pendingTrade.token_out,
        user_tx_hash: txHash,
        token_in: pendingTrade.token_in,
        token_out: pendingTrade.token_out,
        amount_in: pendingTrade.suggested_amount_in,
        amount_out: parseFloat(quote.outAmount) / LAMPORTS_PER_SOL,
        entry_price: parseFloat(quote.outAmount) / parseFloat(quote.inAmount),
        status: 'open',
        slippage_actual: quote.slippageBps / 100,
        price_impact_actual: quote.priceImpactPct,
        execution_delay_ms: executionDelayMs,
        opened_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (positionError) {
      console.error('Error creating position record:', positionError);
    }

    // Update pending trade status
    await supabase
      .from('pending_copy_trades')
      .update({ status: 'approved' })
      .eq('id', pendingTradeId);

    // Update config statistics
    await supabase
      .from('copy_trading_config')
      .update({
        total_copied_trades: (config.total_copied_trades || 0) + 1,
        successful_trades: (config.successful_trades || 0) + 1,
      })
      .eq('id', pendingTrade.config_id);

    return {
      success: true,
      positionId: position?.id,
      txHash,
      executionDelayMs,
    };
  } catch (error: any) {
    console.error('Error executing copy trade:', error);

    // Update pending trade as failed
    await supabase
      .from('pending_copy_trades')
      .update({ status: 'rejected' })
      .eq('id', pendingTradeId);

    // Update config statistics
    const { data: config } = await supabase
      .from('copy_trading_config')
      .select('failed_trades')
      .eq('id', pendingTradeId)
      .single();

    if (config) {
      await supabase
        .from('copy_trading_config')
        .update({
          failed_trades: (config.failed_trades || 0) + 1,
        })
        .eq('id', pendingTradeId);
    }

    return {
      success: false,
      error: error.message || 'Failed to execute copy trade',
    };
  }
}

/**
 * Reject/cancel a pending copy trade
 */
export async function rejectCopyTrade(pendingTradeId: string): Promise<boolean> {
  const supabase = createClient();

  try {
    const { error } = await supabase
      .from('pending_copy_trades')
      .update({ status: 'rejected' })
      .eq('id', pendingTradeId)
      .eq('status', 'pending');

    return !error;
  } catch (error) {
    console.error('Error rejecting copy trade:', error);
    return false;
  }
}

/**
 * Close an open position
 */
export async function closePosition(
  connection: Connection,
  userPublicKey: PublicKey,
  positionId: string,
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const supabase = createClient();

  try {
    // Get position details
    const { data: position, error: fetchError } = await supabase
      .from('copy_trading_positions')
      .select('*')
      .eq('id', positionId)
      .single();

    if (fetchError || !position) {
      return { success: false, error: 'Position not found' };
    }

    if (position.status !== 'open') {
      return { success: false, error: 'Position is not open' };
    }

    // Swap back (reverse the trade)
    const amountInSmallestUnit = Math.floor(position.amount_out * LAMPORTS_PER_SOL);

    const quote = await getJupiterQuote(
      position.token_out,
      position.token_in,
      amountInSmallestUnit,
      100 // 1% slippage for closing
    );

    if (!quote) {
      throw new Error('Failed to get closing quote');
    }

    const swapResult = await getJupiterSwapTransaction(quote, userPublicKey);
    if (!swapResult) {
      throw new Error('Failed to get closing transaction');
    }

    const txHash = await executeJupiterSwap(connection, swapResult.swapTransaction, signTransaction);
    if (!txHash) {
      throw new Error('Failed to execute closing transaction');
    }

    // Calculate P&L
    const exitAmount = parseFloat(quote.outAmount) / LAMPORTS_PER_SOL;
    const pnl = exitAmount - position.amount_in;
    const pnlPercentage = (pnl / position.amount_in) * 100;

    // Update position
    await supabase
      .from('copy_trading_positions')
      .update({
        status: 'closed',
        exit_price: parseFloat(quote.outAmount) / parseFloat(quote.inAmount),
        amount_out: exitAmount,
        pnl,
        pnl_percentage: pnlPercentage,
        closed_at: new Date().toISOString(),
      })
      .eq('id', positionId);

    return { success: true, txHash };
  } catch (error: any) {
    console.error('Error closing position:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check and trigger stop-loss for positions
 */
export async function checkStopLoss(
  connection: Connection,
  userPublicKey: PublicKey,
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>
): Promise<number> {
  const supabase = createClient();
  let triggered = 0;

  try {
    // Get open positions with stop-loss configured
    const { data: positions } = await supabase
      .from('copy_trading_positions')
      .select('*')
      .eq('status', 'open')
      .not('stop_loss_price', 'is', null);

    if (!positions || positions.length === 0) {
      return triggered;
    }

    // For each position, check current price vs stop-loss
    for (const position of positions) {
      try {
        // Get current quote to check price
        const amountInSmallestUnit = Math.floor(position.amount_out * LAMPORTS_PER_SOL);
        
        const quote = await getJupiterQuote(
          position.token_out,
          position.token_in,
          amountInSmallestUnit,
          100
        );

        if (!quote) continue;

        const currentPrice = parseFloat(quote.outAmount) / parseFloat(quote.inAmount);

        // Check if stop-loss triggered
        if (position.stop_loss_price && currentPrice <= position.stop_loss_price) {
          console.log(`Stop-loss triggered for position ${position.id}`);
          
          // Close the position
          const result = await closePosition(connection, userPublicKey, position.id, signTransaction);
          
          if (result.success) {
            // Mark as stop-loss triggered
            await supabase
              .from('copy_trading_positions')
              .update({ stop_loss_triggered: true })
              .eq('id', position.id);
            
            triggered++;
          }
        }
      } catch (error) {
        console.error(`Error checking stop-loss for position ${position.id}:`, error);
      }
    }

    return triggered;
  } catch (error) {
    console.error('Error checking stop-loss:', error);
    return triggered;
  }
}


