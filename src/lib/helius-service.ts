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
const SOL_MINT = 'So11111111111111111111111111111111111111112';

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

    const transactions: any[] = await response.json();
    return parseEnhancedTransactions(transactions, tokenAddress, true);
  } catch (error) {
    console.error('Failed to fetch Helius transactions:', error);
    return [];
  }
}

/**
 * Fetch recent transactions for a wallet address
 */
export async function fetchWalletTrades(
  walletAddress: string,
  limit: number = 100
): Promise<ParsedSwapTransaction[]> {
  if (!HELIUS_API_KEY) {
    console.warn('No Helius API key configured, skipping wallet trade fetch');
    return [];
  }

  try {
    const response = await fetch(
      `${HELIUS_BASE_URL}/addresses/${walletAddress}/transactions?api-key=${HELIUS_API_KEY}&limit=${limit}`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) {
      throw new Error(`Helius API error: ${response.status}`);
    }

    const transactions: any[] = await response.json();
    return parseEnhancedTransactions(transactions, walletAddress);
  } catch (error) {
    console.error('Failed to fetch wallet trades from Helius:', error);
    return [];
  }
}

/**
 * Parse enhanced Helius transactions into swap transactions
 */
function parseEnhancedTransactions(
  transactions: any[],
  filterAddress: string,
  isTokenFilter: boolean = false
): ParsedSwapTransaction[] {
  const swaps: ParsedSwapTransaction[] = [];

  for (const tx of transactions) {
    if (tx.status !== 'Success') continue;

    // 1. Try to use Helius's pre-parsed swap event
    const swapEvent = tx.events?.swap;
    if (swapEvent) {
      const nativeInput = swapEvent.nativeInput;
      const nativeOutput = swapEvent.nativeOutput;
      const tokenInputs = swapEvent.tokenInputs || [];
      const tokenOutputs = swapEvent.tokenOutputs || [];

      const inputMint = nativeInput ? SOL_MINT : (tokenInputs[0]?.mint || '');
      const outputMint = nativeOutput ? SOL_MINT : (tokenOutputs[0]?.mint || '');

      const inputAmount = nativeInput
        ? nativeInput.amount / 1e9
        : (tokenInputs[0]?.rawTokenAmount?.tokenAmount || 0);

      const outputAmount = nativeOutput
        ? nativeOutput.amount / 1e9
        : (tokenOutputs[0]?.rawTokenAmount?.tokenAmount || 0);

      const isBuy = inputMint === SOL_MINT;
      const tokenAddress = isBuy ? outputMint : inputMint;

      // If filtering by token, ensure this swap involves that token
      if (isTokenFilter && tokenAddress.toLowerCase() !== filterAddress.toLowerCase()) {
        continue;
      }

      const solAmount = isBuy ? inputAmount : outputAmount;
      const tokenAmount = isBuy ? outputAmount : inputAmount;

      swaps.push({
        id: tx.signature,
        type: isBuy ? 'buy' : 'sell',
        tokenAddress,
        tokenAmount,
        solAmount,
        pricePerToken: tokenAmount > 0 ? solAmount / tokenAmount : 0,
        priceUsd: 0,
        maker: isTokenFilter ? (tx.feePayer || 'Unknown') : filterAddress,
        timestamp: tx.timestamp * 1000,
        txHash: tx.signature,
      });
      continue;
    }

    // 2. Fallback: Parse from token/native transfers (Critical for Pump.fun)
    // Use lowercase for ALL address comparisons to be safe
    const filterAddrLower = filterAddress.toLowerCase();

    const tokenTransfer = isTokenFilter
      ? tx.tokenTransfers?.find((t: any) => t.mint.toLowerCase() === filterAddrLower)
      : tx.tokenTransfers?.find((t: any) =>
        (t.fromUserAccount || '').toLowerCase() === filterAddrLower ||
        (t.toUserAccount || '').toLowerCase() === filterAddrLower
      );

    if (tokenTransfer) {
      const isOut = isTokenFilter
        ? (tokenTransfer.fromUserAccount || '').toLowerCase() === (tx.feePayer || '').toLowerCase() // Guessing for token filter
        : (tokenTransfer.fromUserAccount || '').toLowerCase() === filterAddrLower;

      const solTransfer = tx.nativeTransfers?.find((n: any) =>
        isOut
          ? (n.toUserAccount || '').toLowerCase() === (isTokenFilter ? (tx.feePayer || '').toLowerCase() : filterAddrLower)
          : (n.fromUserAccount || '').toLowerCase() === (isTokenFilter ? (tx.feePayer || '').toLowerCase() : filterAddrLower)
      );

      const solAmount = solTransfer ? Math.abs(solTransfer.amount) / 1e9 : 0;
      const tokenAmount = tokenTransfer.tokenAmount;

      swaps.push({
        id: tx.signature,
        type: isOut ? 'sell' : 'buy',
        tokenAddress: tokenTransfer.mint,
        tokenAmount,
        solAmount,
        pricePerToken: tokenAmount > 0 ? solAmount / tokenAmount : 0,
        priceUsd: 0,
        maker: isTokenFilter ? (tx.feePayer || 'Unknown') : filterAddress,
        timestamp: tx.timestamp * 1000,
        txHash: tx.signature,
      });
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
