import { Connection, PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js';

// Known DEX program IDs
const DEX_PROGRAM_IDS = {
  jupiter: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
  jupiterV6: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
  raydium: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  raydiumV4: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  orca: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
  meteora: 'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB',
};

export interface ParsedDexTrade {
  dex: 'jupiter' | 'raydium' | 'orca' | 'meteora';
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
function identifyDex(transaction: ParsedTransactionWithMeta): 'jupiter' | 'raydium' | 'orca' | 'meteora' | null {
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
    const preBalances = transaction.meta?.preTokenBalances || [];
    const postBalances = transaction.meta?.postTokenBalances || [];
    
    const walletPubkey = walletAddress;
    
    let tokenIn: string | undefined;
    let tokenOut: string | undefined;
    let amountIn: number | undefined;
    let amountOut: number | undefined;
    
    // Find token changes for the wallet
    for (const preBalance of preBalances) {
      const postBalance = postBalances.find(
        pb => pb.accountIndex === preBalance.accountIndex
      );
      
      if (!postBalance) continue;
      
      const preAmount = preBalance.uiTokenAmount.uiAmount || 0;
      const postAmount = postBalance.uiTokenAmount.uiAmount || 0;
      const diff = postAmount - preAmount;
      
      if (diff < 0) {
        // Token was sent out
        tokenIn = preBalance.mint;
        amountIn = Math.abs(diff);
      } else if (diff > 0) {
        // Token was received
        tokenOut = postBalance.mint;
        amountOut = diff;
      }
    }
    
    if (tokenIn && tokenOut && amountIn && amountOut) {
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
    if (!transfers || !transfers.tokenIn || !transfers.tokenOut) continue;
    
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

