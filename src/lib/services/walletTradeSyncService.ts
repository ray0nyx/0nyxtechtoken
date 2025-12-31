/**
 * Wallet Trade Sync Service
 * Fetches trades from tracked Solana wallets and syncs them to the trades table
 */

import { createClient } from '@/lib/supabase/client';
import { fetchWalletTrades, ParsedSwapTransaction, getSolPrice } from '@/lib/helius-service';

export interface SyncedTrade {
    id: string;
    user_id: string;
    account_id?: string;
    symbol: string;
    side: 'buy' | 'sell';
    quantity: number;
    price: number;
    entry_price: number;
    exit_price?: number;
    timestamp: string;
    entry_date: string;
    exit_date?: string;
    pnl?: number;
    net_pnl?: number;
    fees: number;
    broker: string;
    notes?: string;
    extended_data: {
        mint: string;
        txHash: string;
        maker: string;
        solAmount: number;
        priceUsd: number;
    };
}

export interface SyncResult {
    success: boolean;
    tradesAdded: number;
    tradesUpdated: number;
    tradesSkipped: number;
    errors: string[];
}

/**
 * Transform a Helius ParsedSwapTransaction to our Trade format
 */
function transformToTrade(
    tx: ParsedSwapTransaction,
    userId: string,
    walletAddress: string,
    tokenSymbol?: string
): SyncedTrade {
    const timestamp = new Date(tx.timestamp).toISOString();

    return {
        id: tx.id, // Use tx hash as ID for deduplication
        user_id: userId,
        account_id: walletAddress,
        symbol: tokenSymbol || tx.tokenAddress.slice(0, 8), // Use first 8 chars of mint if no symbol
        side: tx.type,
        quantity: tx.tokenAmount,
        price: tx.priceUsd,
        entry_price: tx.priceUsd,
        timestamp: timestamp,
        entry_date: timestamp,
        fees: tx.solAmount * 0.001, // Estimate ~0.1% fees
        broker: 'solana',
        extended_data: {
            mint: tx.tokenAddress,
            txHash: tx.txHash,
            maker: tx.maker,
            solAmount: tx.solAmount,
            priceUsd: tx.priceUsd,
        },
    };
}

/**
 * Fetch token symbol/name from the token mint address
 */
async function getTokenSymbol(mint: string): Promise<string | undefined> {
    try {
        // Try to fetch from Birdeye or Jupiter API
        const response = await fetch(`https://api.jup.ag/v1/tokens/${mint}`);
        if (response.ok) {
            const data = await response.json();
            return data.symbol;
        }
    } catch (e) {
        console.warn('Could not fetch token symbol for', mint);
    }
    return undefined;
}

/**
 * Calculate PnL for matched buy/sell pairs
 */
function calculatePnL(trades: SyncedTrade[]): SyncedTrade[] {
    // Group trades by token mint
    const tradesByToken = new Map<string, SyncedTrade[]>();

    trades.forEach(trade => {
        const mint = trade.extended_data.mint;
        if (!tradesByToken.has(mint)) {
            tradesByToken.set(mint, []);
        }
        tradesByToken.get(mint)!.push(trade);
    });

    // For each token, match buys with sells (FIFO)
    const processedTrades: SyncedTrade[] = [];

    tradesByToken.forEach((tokenTrades, mint) => {
        // Sort by timestamp
        tokenTrades.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        const buyQueue: SyncedTrade[] = [];

        tokenTrades.forEach(trade => {
            if (trade.side === 'buy') {
                buyQueue.push({ ...trade });
                processedTrades.push(trade);
            } else if (trade.side === 'sell') {
                // Match with oldest buy
                let remainingQty = trade.quantity;
                let totalCost = 0;

                while (remainingQty > 0 && buyQueue.length > 0) {
                    const buy = buyQueue[0];
                    const matchQty = Math.min(remainingQty, buy.quantity);
                    totalCost += matchQty * buy.price;
                    remainingQty -= matchQty;
                    buy.quantity -= matchQty;

                    if (buy.quantity <= 0) {
                        buyQueue.shift();
                    }
                }

                // Calculate PnL
                const sellValue = trade.quantity * trade.price;
                const costBasis = totalCost;
                const pnl = sellValue - costBasis;
                const netPnl = pnl - trade.fees;

                processedTrades.push({
                    ...trade,
                    pnl: pnl,
                    net_pnl: netPnl,
                });
            }
        });
    });

    return processedTrades;
}

/**
 * Sync trades from a single wallet
 */
export async function syncWalletTrades(
    walletAddress: string,
    userId: string,
    limit: number = 100
): Promise<SyncResult> {
    const supabase = createClient();
    const result: SyncResult = {
        success: false,
        tradesAdded: 0,
        tradesUpdated: 0,
        tradesSkipped: 0,
        errors: [],
    };

    try {
        // Fetch trades from Helius
        const heliusTrades = await fetchWalletTrades(walletAddress, limit);

        if (heliusTrades.length === 0) {
            result.success = true;
            return result;
        }

        // Transform to our format
        const trades: SyncedTrade[] = [];
        for (const tx of heliusTrades) {
            const symbol = await getTokenSymbol(tx.tokenAddress);
            trades.push(transformToTrade(tx, userId, walletAddress, symbol));
        }

        // Calculate PnL for matched pairs
        const tradesWithPnL = calculatePnL(trades);

        // Check for existing trades (by tx hash in extended_data)
        const txHashes = tradesWithPnL.map(t => t.extended_data.txHash);
        const { data: existingTrades, error: fetchError } = await supabase
            .from('trades')
            .select('extended_data')
            .eq('user_id', userId)
            .eq('broker', 'solana');

        if (fetchError) {
            result.errors.push(`Failed to check existing trades: ${fetchError.message}`);
            return result;
        }

        const existingTxHashes = new Set(
            existingTrades
                ?.filter(t => t.extended_data?.txHash)
                .map(t => t.extended_data.txHash) || []
        );

        // Filter out duplicates
        const newTrades = tradesWithPnL.filter(
            t => !existingTxHashes.has(t.extended_data.txHash)
        );

        result.tradesSkipped = tradesWithPnL.length - newTrades.length;

        if (newTrades.length === 0) {
            result.success = true;
            return result;
        }

        // Insert new trades
        const { error: insertError } = await supabase
            .from('trades')
            .insert(newTrades.map(t => ({
                user_id: t.user_id,
                account_id: t.account_id,
                symbol: t.symbol,
                side: t.side,
                quantity: t.quantity,
                price: t.price,
                entry_price: t.entry_price,
                exit_price: t.exit_price,
                timestamp: t.timestamp,
                entry_date: t.entry_date,
                exit_date: t.exit_date,
                pnl: t.pnl,
                net_pnl: t.net_pnl,
                fees: t.fees,
                broker: t.broker,
                notes: t.notes,
                extended_data: t.extended_data,
            })));

        if (insertError) {
            result.errors.push(`Failed to insert trades: ${insertError.message}`);
            return result;
        }

        result.tradesAdded = newTrades.length;
        result.success = true;

    } catch (error) {
        result.errors.push(`Sync failed: ${(error as Error).message}`);
    }

    return result;
}

/**
 * Sync trades from all tracked wallets for a user
 */
export async function syncAllTrackedWallets(userId: string): Promise<SyncResult> {
    const supabase = createClient();
    const aggregateResult: SyncResult = {
        success: true,
        tradesAdded: 0,
        tradesUpdated: 0,
        tradesSkipped: 0,
        errors: [],
    };

    try {
        // Fetch tracked wallets
        const { data: trackedWallets, error } = await supabase
            .from('wallet_tracking')
            .select('wallet_address')
            .eq('user_id', userId);

        if (error) {
            aggregateResult.errors.push(`Failed to fetch tracked wallets: ${error.message}`);
            aggregateResult.success = false;
            return aggregateResult;
        }

        if (!trackedWallets || trackedWallets.length === 0) {
            return aggregateResult;
        }

        // Sync each wallet
        for (const wallet of trackedWallets) {
            const result = await syncWalletTrades(wallet.wallet_address, userId);
            aggregateResult.tradesAdded += result.tradesAdded;
            aggregateResult.tradesUpdated += result.tradesUpdated;
            aggregateResult.tradesSkipped += result.tradesSkipped;
            aggregateResult.errors.push(...result.errors);

            if (!result.success) {
                aggregateResult.success = false;
            }
        }

    } catch (error) {
        aggregateResult.errors.push(`Sync all wallets failed: ${(error as Error).message}`);
        aggregateResult.success = false;
    }

    return aggregateResult;
}

/**
 * Get sync status for a user
 */
export async function getSyncStatus(userId: string): Promise<{
    lastSyncAt: string | null;
    totalSolanaTrades: number;
    trackedWalletsCount: number;
}> {
    const supabase = createClient();

    // Get total Solana trades
    const { count: tradesCount } = await supabase
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('broker', 'solana');

    // Get tracked wallets count
    const { count: walletsCount } = await supabase
        .from('wallet_tracking')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

    // Get most recent Solana trade timestamp
    const { data: recentTrade } = await supabase
        .from('trades')
        .select('timestamp')
        .eq('user_id', userId)
        .eq('broker', 'solana')
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

    return {
        lastSyncAt: recentTrade?.timestamp || null,
        totalSolanaTrades: tradesCount || 0,
        trackedWalletsCount: walletsCount || 0,
    };
}
