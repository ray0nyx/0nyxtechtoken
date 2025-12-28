/**
 * Helius API service for fetching real-time Solana transactions
 * https://docs.helius.dev/
 */

export interface HeliusTransaction {
  signature: string;
  timestamp: number;
  type: string;
  fee: number;
  status: 'Success' | 'Failed';
  source: string;
  tokenTransfers: {
    mint: string;
    fromUserAccount: string;
    toUserAccount: string;
    tokenAmount: number;
    tokenStandard: string;
  }[];
  nativeTransfers: {
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }[];
}

export interface ParsedSwapTransaction {
  id: string;
  type: 'buy' | 'sell';
  tokenAddress: string;
  tokenAmount: number;
  solAmount: number;
  pricePerToken: number;
  priceUsd: number;
  maker: string;
  timestamp: number;
  txHash: string;
}

const HELIUS_API_KEY = import.meta.env.VITE_HELIUS_API_KEY || '';
const HELIUS_BASE_URL = 'https://api.helius.xyz/v0';

// Cache for recent transactions to avoid duplicates
const recentTxCache = new Map<string, number>();
const CACHE_DURATION = 60000; // 1 minute

/**
 * Fetch recent transactions for a token address
 */
export async function fetchTokenTransactions(
  tokenAddress: string,
  limit: number = 20
): Promise<ParsedSwapTransaction[]> {
  if (!HELIUS_API_KEY) {
    console.warn('No Helius API key configured, skipping transaction fetch');
    return [];
  }

  try {
    const response = await fetch(
      `${HELIUS_BASE_URL}/addresses/${tokenAddress}/transactions?api-key=${HELIUS_API_KEY}&limit=${limit}`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) {
      throw new Error(`Helius API error: ${response.status}`);
    }

    const transactions: HeliusTransaction[] = await response.json();
    return parseSwapTransactions(transactions, tokenAddress);
  } catch (error) {
    console.error('Failed to fetch Helius transactions:', error);
    return [];
  }
}

/**
 * Parse raw Helius transactions into swap transactions
 */
function parseSwapTransactions(
  transactions: HeliusTransaction[],
  tokenAddress: string
): ParsedSwapTransaction[] {
  const swaps: ParsedSwapTransaction[] = [];
  const now = Date.now();

  // Clean old cache entries
  for (const [sig, timestamp] of recentTxCache.entries()) {
    if (now - timestamp > CACHE_DURATION) {
      recentTxCache.delete(sig);
    }
  }

  for (const tx of transactions) {
    // Skip if already processed
    if (recentTxCache.has(tx.signature)) continue;
    
    // Skip failed transactions
    if (tx.status !== 'Success') continue;

    // Look for token transfers involving our token
    const tokenTransfer = tx.tokenTransfers?.find(t => 
      t.mint.toLowerCase() === tokenAddress.toLowerCase()
    );

    if (tokenTransfer) {
      // Determine if it's a buy or sell based on native SOL movement
      const solTransfer = tx.nativeTransfers?.[0];
      const isBuy = solTransfer && solTransfer.amount > 0;
      
      const solAmount = solTransfer ? Math.abs(solTransfer.amount) / 1e9 : 0;
      const tokenAmount = tokenTransfer.tokenAmount;
      const pricePerToken = tokenAmount > 0 ? solAmount / tokenAmount : 0;

      swaps.push({
        id: tx.signature,
        type: isBuy ? 'buy' : 'sell',
        tokenAddress,
        tokenAmount,
        solAmount,
        pricePerToken,
        priceUsd: 0, // Will be calculated with current SOL price
        maker: tokenTransfer.fromUserAccount?.slice(0, 8) || 'Unknown',
        timestamp: tx.timestamp * 1000,
        txHash: tx.signature,
      });

      recentTxCache.set(tx.signature, now);
    }
  }

  return swaps.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Subscribe to real-time transactions using polling
 */
export function subscribeToTransactions(
  tokenAddress: string,
  onTransaction: (tx: ParsedSwapTransaction) => void,
  intervalMs: number = 5000
): () => void {
  let isActive = true;
  let lastTimestamp = Date.now();

  const poll = async () => {
    if (!isActive) return;

    try {
      const transactions = await fetchTokenTransactions(tokenAddress, 10);
      
      // Only emit new transactions
      for (const tx of transactions) {
        if (tx.timestamp > lastTimestamp) {
          onTransaction(tx);
        }
      }

      if (transactions.length > 0) {
        lastTimestamp = Math.max(...transactions.map(t => t.timestamp));
      }
    } catch (error) {
      console.warn('Transaction polling error:', error);
    }

    if (isActive) {
      setTimeout(poll, intervalMs);
    }
  };

  // Start polling
  poll();

  // Return cleanup function
  return () => {
    isActive = false;
  };
}

/**
 * Get current SOL price in USD (for converting transaction values)
 */
export async function getSolPrice(): Promise<number> {
  try {
    const response = await fetch(
      'https://price.jup.ag/v4/price?ids=So11111111111111111111111111111111111111112'
    );
    
    if (response.ok) {
      const data = await response.json();
      return data.data?.['So11111111111111111111111111111111111111112']?.price || 0;
    }
  } catch (error) {
    console.warn('Failed to fetch SOL price:', error);
  }
  
  return 0;
}
