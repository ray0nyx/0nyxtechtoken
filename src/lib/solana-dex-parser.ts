import { Connection, PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js';

// Known DEX program IDs
const DEX_PROGRAM_IDS = {
  jupiter: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
  jupiterV6: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
  raydium: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  raydiumV4: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  orca: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
  meteora: 'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB',
  pumpfun: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
};

const SOL_MINT = 'So11111111111111111111111111111111111111112';

export interface ParsedDexTrade {
  dex: 'jupiter' | 'raydium' | 'orca' | 'meteora' | 'pumpfun';
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  amountOut: number;
  priceImpact?: number;
  slippage?: number;
  fee?: number;
  timestamp: string;
  txHash: string;
  wallet: string;
}

export interface TokenMetadata {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

/**
 * Fetch recent transactions for a wallet address
 */
export async function fetchWalletTransactions(
  connection: Connection,
  walletAddress: string,
  limit: number = 50
): Promise<ParsedTransactionWithMeta[]> {
  try {
    const publicKey = new PublicKey(walletAddress);

    // Get transaction signatures
    const signatures = await connection.getSignaturesForAddress(publicKey, { limit });

    // Fetch full transaction data
    const transactions: (ParsedTransactionWithMeta | null)[] = [];

    // Batch fetch to avoid rate limits (10 at a time)
    for (let i = 0; i < signatures.length; i += 10) {
      const batch = signatures.slice(i, i + 10);
      const batchTxs = await Promise.all(
        batch.map(sig =>
          connection.getParsedTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0
          })
        )
      );
      transactions.push(...batchTxs);

      // Small delay to avoid rate limiting
      if (i + 10 < signatures.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return transactions.filter((tx): tx is ParsedTransactionWithMeta => tx !== null);
  } catch (error) {
    console.error('Error fetching wallet transactions:', error);
    throw new Error('Failed to fetch wallet transactions');
  }
}

/**
 * Identify which DEX a transaction used
 */
function identifyDex(transaction: ParsedTransactionWithMeta): 'jupiter' | 'raydium' | 'orca' | 'meteora' | 'pumpfun' | null {
  const accountKeys = transaction.transaction.message.accountKeys.map(key => key.pubkey.toString());

  if (accountKeys.includes(DEX_PROGRAM_IDS.jupiter) || accountKeys.includes(DEX_PROGRAM_IDS.jupiterV6)) {
    return 'jupiter';
  }
  if (accountKeys.includes(DEX_PROGRAM_IDS.raydium) || accountKeys.includes(DEX_PROGRAM_IDS.raydiumV4)) {
    return 'raydium';
  }
  if (accountKeys.includes(DEX_PROGRAM_IDS.orca)) {
    return 'orca';
  }
  if (accountKeys.includes(DEX_PROGRAM_IDS.meteora)) {
    return 'meteora';
  }
  if (accountKeys.includes(DEX_PROGRAM_IDS.pumpfun)) {
    return 'pumpfun';
  }

  return null;
}

/**
 * Parse token transfer information from transaction
 */
function parseTokenTransfers(transaction: ParsedTransactionWithMeta, walletAddress: string): {
  tokenIn?: string;
  tokenOut?: string;
  amountIn?: number;
  amountOut?: number;
} | null {
  try {
    const preTokenBalances = transaction.meta?.preTokenBalances || [];
    const postTokenBalances = transaction.meta?.postTokenBalances || [];
    const preBalances = transaction.meta?.preBalances || [];
    const postBalances = transaction.meta?.postBalances || [];
    const accountKeys = transaction.transaction.message.accountKeys.map(k => k.pubkey.toString());

    const walletIndex = accountKeys.indexOf(walletAddress);
    if (walletIndex === -1) return null;

    let tokenIn: string | undefined;
    let tokenOut: string | undefined;
    let amountIn: number | undefined;
    let amountOut: number | undefined;

    // 1. Process SPL Token changes
    for (const pre of preTokenBalances) {
      // Find matching post balance by index and owner
      const post = postTokenBalances.find(p => p.accountIndex === pre.accountIndex);
      if (!post) continue;

      // Check if this token account belongs to the wallet (some parsers don't include owner)
      // or if the account index matches the wallet's associated token account
      const preAmount = pre.uiTokenAmount.uiAmount || 0;
      const postAmount = post.uiTokenAmount.uiAmount || 0;
      const diff = postAmount - preAmount;

      if (diff < -0.000000001) {
        tokenIn = pre.mint;
        amountIn = Math.abs(diff);
      } else if (diff > 0.000000001) {
        tokenOut = post.mint;
        amountOut = diff;
      }
    }

    // 2. Process Native SOL change if one side is missing
    if ((!tokenIn || !tokenOut) && walletIndex !== -1) {
      const preSol = preBalances[walletIndex] / 1e9;
      const postSol = postBalances[walletIndex] / 1e9;
      const diffSol = postSol - preSol;
      const fee = (transaction.meta?.fee || 0) / 1e9;

      // Adjust for fee if it was a decrease
      const netDiff = diffSol + (diffSol < 0 ? fee : 0);

      if (netDiff < -0.00001) {
        tokenIn = SOL_MINT;
        amountIn = Math.abs(netDiff);
      } else if (netDiff > 0.00001) {
        tokenOut = SOL_MINT;
        amountOut = netDiff;
      }
    }

    // Final Validation
    if (tokenIn && tokenOut && amountIn && amountOut && tokenIn !== tokenOut) {
      return { tokenIn, tokenOut, amountIn, amountOut };
    }

    return null;
  } catch (error) {
    console.error('Error parsing token transfers:', error);
    return null;
  }
}

/**
 * Parse DEX trades from transactions
 */
export async function parseDexTrades(
  transactions: ParsedTransactionWithMeta[],
  walletAddress: string
): Promise<ParsedDexTrade[]> {
  const trades: ParsedDexTrade[] = [];

  for (const tx of transactions) {
    // Skip failed transactions
    if (tx.meta?.err) continue;

    // Identify DEX
    const dex = identifyDex(tx);
    if (!dex) continue;

    // Parse token transfers
    const transfers = parseTokenTransfers(tx, walletAddress);
    if (!transfers || !transfers.tokenIn || !transfers.tokenOut) {
      console.log(`No valid token transfers found in tx ${tx.transaction.signatures[0]} for ${dex}`);
      continue;
    }

    // Calculate fee (from transaction fee)
    const fee = (tx.meta?.fee || 0) / 1e9; // Convert lamports to SOL

    // Get timestamp
    const timestamp = tx.blockTime
      ? new Date(tx.blockTime * 1000).toISOString()
      : new Date().toISOString();

    trades.push({
      dex,
      tokenIn: transfers.tokenIn,
      tokenOut: transfers.tokenOut,
      amountIn: transfers.amountIn || 0,
      amountOut: transfers.amountOut || 0,
      fee,
      timestamp,
      txHash: tx.transaction.signatures[0],
      wallet: walletAddress,
    });
  }

  return trades;
}

/**
 * Fetch token metadata from Solana RPC
 */
export async function fetchTokenMetadata(
  connection: Connection,
  mintAddress: string
): Promise<TokenMetadata | null> {
  try {
    const mint = new PublicKey(mintAddress);
    const info = await connection.getParsedAccountInfo(mint);

    if (!info.value || !('parsed' in info.value.data)) {
      return null;
    }

    const parsed = info.value.data.parsed;

    // Try to get token name and symbol from metadata (this is basic, would need Metaplex for full metadata)
    return {
      address: mintAddress,
      symbol: mintAddress.substring(0, 4).toUpperCase(), // Fallback
      name: 'Unknown Token',
      decimals: parsed.info?.decimals || 9,
    };
  } catch (error) {
    console.error('Error fetching token metadata:', error);
    return null;
  }
}

/**
 * Import DEX trades from connected wallet
 */
export async function importDexTradesFromWallet(
  connection: Connection,
  walletAddress: string,
  limit: number = 50
): Promise<ParsedDexTrade[]> {
  try {
    // Fetch transactions
    const transactions = await fetchWalletTransactions(connection, walletAddress, limit);

    // Parse DEX trades
    const trades = await parseDexTrades(transactions, walletAddress);

    return trades;
  } catch (error) {
    console.error('Error importing DEX trades:', error);
    throw error;
  }
}

/**
 * Calculate trade metrics from DEX trades
 */
export function calculateDexMetrics(trades: ParsedDexTrade[]) {
  if (trades.length === 0) {
    return {
      totalVolume: 0,
      totalTrades: 0,
      avgSlippage: 0,
      totalFees: 0,
      dexBreakdown: {},
    };
  }

  const totalVolume = trades.reduce((sum, t) => sum + t.amountIn, 0);
  const totalFees = trades.reduce((sum, t) => sum + (t.fee || 0), 0);
  const avgSlippage = trades.reduce((sum, t) => sum + (t.slippage || 0), 0) / trades.length;

  const dexBreakdown: Record<string, number> = {};
  trades.forEach(trade => {
    dexBreakdown[trade.dex] = (dexBreakdown[trade.dex] || 0) + 1;
  });

  return {
    totalVolume,
    totalTrades: trades.length,
    avgSlippage,
    totalFees,
    dexBreakdown,
  };
}

