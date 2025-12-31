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

export default {
    fetchWalletPnL,
    fetchWalletMetrics,
    calculateNetSol,
};
