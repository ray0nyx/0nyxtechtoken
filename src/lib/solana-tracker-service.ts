/**
 * Solana Tracker API Service
 * 
 * Fetches wallet PNL and win rate data from Solana Tracker API
 * API Documentation: https://docs.solanatracker.io
 */

const SOLANA_TRACKER_API_KEY = import.meta.env.VITE_SOLANA_TRACKER_API_KEY || '0a90b196-029f-4f91-9626-ac406d0cc892';
const SOLANA_TRACKER_BASE_URL = 'https://data.solanatracker.io';

export interface SolanaTrackerPnLSummary {
    realized: number;       // Realized PnL in USD (not SOL!)
    unrealized: number;     // Unrealized PnL in USD
    total: number;          // Total PnL (realized + unrealized) in USD
    totalInvested: number;  // Total USD invested
    totalWins: number;      // Number of winning trades
    totalLosses: number;    // Number of losing trades
    averageBuyAmount: number;
    winPercentage: number;  // Win rate as percentage (0-100)
    lossPercentage: number;
    neutralPercentage: number;
}

export interface SolanaTrackerTokenPnL {
    mint: string;
    symbol?: string;
    name?: string;
    realized: number;
    unrealized: number;
    total: number;
    invested: number;
    averageBuyPrice: number;
    currentPrice: number;
    holdings: number;
}

export interface SolanaTrackerWalletPnL {
    tokens: Record<string, SolanaTrackerTokenPnL>;
    summary: SolanaTrackerPnLSummary;
    pnl_since: number; // Timestamp in milliseconds
}

/**
 * Fetch PNL data for a wallet from Solana Tracker
 */
export async function fetchWalletPnL(walletAddress: string): Promise<SolanaTrackerWalletPnL | null> {
    try {
        console.log(`[SolanaTracker] Fetching PnL for ${walletAddress}`);

        const response = await fetch(`${SOLANA_TRACKER_BASE_URL}/pnl/${walletAddress}`, {
            headers: {
                'x-api-key': SOLANA_TRACKER_API_KEY,
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            console.error(`[SolanaTracker] API error: ${response.status} ${response.statusText}`);
            return null;
        }

        const data: SolanaTrackerWalletPnL = await response.json();
        console.log(`[SolanaTracker] PnL for ${walletAddress}: Total=${data.summary.total.toFixed(4)} SOL, WinRate=${data.summary.winPercentage}%`);

        return data;
    } catch (error) {
        console.error(`[SolanaTracker] Failed to fetch PnL for ${walletAddress}:`, error);
        return null;
    }
}

/**
 * Calculate total SOL spent/earned from PnL data
 * Positive = earned, Negative = spent
 */
export function calculateNetSol(pnlData: SolanaTrackerWalletPnL): {
    totalSpent: number;
    totalEarned: number;
    netSol: number;
} {
    const { summary } = pnlData;

    // Total invested represents SOL spent on buys
    const totalSpent = summary.totalInvested;

    // Total realized represents SOL earned from sells
    const totalEarned = summary.realized + summary.totalInvested;

    // Net SOL is the total PnL
    const netSol = summary.total;

    return {
        totalSpent,
        totalEarned,
        netSol,
    };
}

/**
 * Fetch and format wallet metrics for display
 */
export async function fetchWalletMetrics(walletAddress: string): Promise<{
    pnlSol: number;
    pnlUsd: number;
    winRate: number;
    totalTrades: number;
    netSol: number;
    totalInvested: number;
} | null> {
    const pnlData = await fetchWalletPnL(walletAddress);

    if (!pnlData) {
        return null;
    }

    const { summary } = pnlData;
    const solPrice = 200; // TODO: Get real SOL price

    return {
        pnlSol: summary.total,
        pnlUsd: summary.total * solPrice,
        winRate: summary.winPercentage,
        totalTrades: summary.totalWins + summary.totalLosses,
        netSol: summary.total,
        totalInvested: summary.totalInvested,
    };
}

// ... (existing exports)

export interface SolanaTrackerTrade {
    tx: string;
    from: string;
    to: string;
    token: {
        mint: string;
        symbol: string;
        decimals: number;
        image: string;
    };
    amount: number;
    price: number;
    volume: number;
    time: number;
    type: 'buy' | 'sell';
    maker: string;
}

/**
 * Fetch wallet trades from Solana Tracker
 */
export async function fetchWalletTrades(walletAddress: string): Promise<SolanaTrackerTrade[]> {
    try {
        const response = await fetch(`${SOLANA_TRACKER_BASE_URL}/wallet/${walletAddress}/trades`, {
            headers: {
                'x-api-key': SOLANA_TRACKER_API_KEY,
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            console.error(`[SolanaTracker] Failed to fetch trades: ${response.status}`);
            return [];
        }

        const data = await response.json();
        const trades = Array.isArray(data) ? data : (data.trades || []);

        if (trades.length > 0) {
            console.log('[SolanaTracker] Sample trade:', trades[0]);
        }

        return trades.map((t: any) => {
            // Determine if it's a buy or sell based on the wallet address
            // Note: In Sol Tracker, sometimes 'maker' is the wallet, sometimes it's 'from'.
            const isBuy = t.to && t.to.address === walletAddress;

            // Intelligent token extraction
            // We want the token that ISN'T SOL or USDC, usually.
            const fromToken = t.from?.token;
            const toToken = t.to?.token;

            let targetToken = fromToken || {};
            let amount = t.from?.amount || 0;

            // If fromToken is SOL/USDC and toToken is something else, use toToken (it's a BUY)
            if (fromToken?.symbol === 'SOL' || fromToken?.symbol === 'USDC') {
                if (toToken?.symbol && toToken.symbol !== 'SOL' && toToken.symbol !== 'USDC') {
                    targetToken = toToken;
                    amount = t.to?.amount || 0;
                }
            }
            // If toToken is SOL/USDC and fromToken is something else, keep fromToken (it's a SELL)
            else if (toToken?.symbol === 'SOL' || toToken?.symbol === 'USDC') {
                if (fromToken?.symbol && fromToken.symbol !== 'SOL' && fromToken.symbol !== 'USDC') {
                    targetToken = fromToken;
                    amount = t.from?.amount || 0;
                }
            }
            // Fallback: if we still don't have a good symbol, try to find one that exists
            if (!targetToken.symbol || targetToken.symbol === '???') {
                if (toToken?.symbol && toToken.symbol !== 'SOL') targetToken = toToken;
            }

            return {
                ...t,
                volume: typeof t.volume === 'object' ? (t.volume.usd || t.volume.value || 0) : (t.volume || 0),
                amount: amount || t.amount || 0,
                token: {
                    symbol: targetToken.symbol || '???',
                    mint: targetToken.mint || '',
                    image: targetToken.image || ''
                },
                time: t.time || t.timestamp || Math.floor(Date.now() / 1000),
                maker: walletAddress,
                type: isBuy ? 'buy' : 'sell',
                tx: t.tx || t.signature || t.transactionId || ''
            };
        });
    } catch (error) {
        console.error('[SolanaTracker] Error fetching trades:', error);
        return [];
    }
}

export default {
    fetchWalletPnL,
    fetchWalletMetrics,
    fetchWalletTrades,
    calculateNetSol,
};
