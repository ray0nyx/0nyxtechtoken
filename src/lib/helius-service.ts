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

const HELIUS_API_KEY = import.meta.env.VITE_HELIUS_API_KEY || '730189a2-3b6f-40d9-be94-4061b26fe2ae';
const HELIUS_BASE_URL = 'https://api.helius.xyz/v0';
const SOL_MINT = '11111111111111111111111111111111';
const WSOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFW36Wy29zX2iPVvBf99t29675676i2m8tmGUvCByLx2n1';
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

function isSol(mint: string): boolean {
  if (!mint) return false;
  const m = mint.toLowerCase();
  return m === 'sol' ||
    m === SOL_MINT.toLowerCase() ||
    m === WSOL_MINT.toLowerCase() ||
    m === 'so11111111111111111111111111111111111111112';
}

function isMoney(mint: string): boolean {
  if (!mint) return false;
  const m = mint;
  return isSol(m) ||
    m === USDC_MINT ||
    m === USDT_MINT ||
    m === 'hz7zfYvUvCByLx2n1EPjFW36Wy29zX2iPVvBf99t2967' || // Jito SOL
    m === 'mSoLzYvUvCByLx2n1EPjFW36Wy29zX2iPVvBf99t2967'; // mSOL (example, check real)
}

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
    const solPrice = await getSolPrice().catch(() => 200);
    const response = await fetch(
      `${HELIUS_BASE_URL}/addresses/${tokenAddress}/transactions?api-key=${HELIUS_API_KEY}&limit=${limit}`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) {
      throw new Error(`Helius API error: ${response.status}`);
    }

    const transactions: any[] = await response.json();
    console.log(`[Helius] Fetched ${transactions.length} transactions for token ${tokenAddress}`);
    return parseEnhancedTransactions(transactions, tokenAddress, solPrice, true);
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
    const solPrice = await getSolPrice().catch(() => 200);
    const response = await fetch(
      `${HELIUS_BASE_URL}/addresses/${walletAddress}/transactions?api-key=${HELIUS_API_KEY}&limit=${limit}`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) {
      throw new Error(`Helius API error: ${response.status}`);
    }

    const transactions: any[] = await response.json();
    console.log(`[Helius] Fetched ${transactions.length} transactions for wallet ${walletAddress}`);
    if (transactions.length > 0) {
      console.log('[Helius] Sample transaction types:', transactions.slice(0, 5).map(t => t.type));
    }
    return parseEnhancedTransactions(transactions, walletAddress, solPrice);
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
  solPrice: number,
  isTokenFilter: boolean = false
): ParsedSwapTransaction[] {
  console.log(`[Helius] Parsing ${transactions.length} transactions for ${filterAddress} (TokenFilter: ${isTokenFilter})`);
  const swaps: ParsedSwapTransaction[] = [];
  let debugCount = 0;

  for (const tx of transactions) {
    const isDebug = debugCount < 3;
    if (isDebug) debugCount++;

    if (isDebug) console.log(`[HeliusDebug] Processing ${tx.signature}. Type: ${tx.type}, Source: ${tx.source}`);

    if (tx.status !== 'Success') {
      // console.log(`[Helius] Skipping failed transaction ${tx.signature}`);
      continue;
    }

    // 1. Try to use Helius's pre-parsed swap event
    const swapEvent = tx.events?.swap;
    if (swapEvent) {
      if (isDebug) console.log(`[HeliusDebug] Found swapEvent`, swapEvent);

      const nativeInput = swapEvent.nativeInput;
      const nativeOutput = swapEvent.nativeOutput;
      const tokenInputs = swapEvent.tokenInputs || [];
      const tokenOutputs = swapEvent.tokenOutputs || [];

      let moneyIn = nativeInput ? nativeInput.amount / 1e9 : 0;
      let moneyOut = nativeOutput ? nativeOutput.amount / 1e9 : 0;
      let moneyMint = nativeInput ? 'SOL' : (tokenInputs[0]?.mint || 'SOL');

      tokenInputs.forEach((ti: any) => {
        const amt = ti.tokenAmount || ti.rawTokenAmount?.tokenAmount || 0;
        if (isMoney(ti.mint)) {
          moneyIn += amt;
          moneyMint = ti.mint;
        }
      });
      tokenOutputs.forEach((to: any) => {
        const amt = to.tokenAmount || to.rawTokenAmount?.tokenAmount || 0;
        if (isMoney(to.mint)) {
          moneyOut += amt;
          moneyMint = to.mint;
        }
      });

      const assetIn = tokenInputs.find((ti: any) => !isMoney(ti.mint));
      const assetOut = tokenOutputs.find((to: any) => !isMoney(to.mint));

      if (isDebug) {
        console.log(`[HeliusDebug] MoneyIn: ${moneyIn}, MoneyOut: ${moneyOut}, AssetIn: ${assetIn?.mint}, AssetOut: ${assetOut?.mint}`);
      }

      if (assetIn || assetOut) {
        const isBuy = moneyIn > 0;
        const tokenAddress = isBuy ? (assetOut?.mint || '') : (assetIn?.mint || '');

        if (isDebug) console.log(`[HeliusDebug] IsBuy: ${isBuy}, TokenAddress: ${tokenAddress}`);

        if (tokenAddress && (!isTokenFilter || tokenAddress.toLowerCase() === filterAddress.toLowerCase())) {
          const isStable = moneyMint.toLowerCase().includes('usdc') || moneyMint.toLowerCase().includes('usdt');
          let solAmount = isBuy ? moneyIn : moneyOut;

          const effectiveSolPrice = solPrice > 0 ? solPrice : 150; // Fallback to avoid 0
          if (isStable) {
            solAmount = solAmount / effectiveSolPrice;
          }

          const tokenAmount = isBuy
            ? (assetOut?.tokenAmount || assetOut?.rawTokenAmount?.tokenAmount || 0)
            : (assetIn?.tokenAmount || assetIn?.rawTokenAmount?.tokenAmount || 0);

          if (tokenAmount > 0) {
            swaps.push({
              id: tx.signature,
              type: isBuy ? 'buy' : 'sell',
              tokenAddress,
              tokenAmount,
              solAmount: solAmount || 0,
              pricePerToken: solAmount > 0 ? solAmount / tokenAmount : 0,
              priceUsd: 0,
              maker: isTokenFilter ? (tx.feePayer || 'Unknown') : filterAddress,
              timestamp: tx.timestamp * 1000,
              txHash: tx.signature,
            });
            if (isDebug) console.log(`[HeliusDebug] Added SWAP: ${tx.signature}`);
            continue;
          } else {
            console.log(`[Helius] Parsed asset info but tokenAmount was 0 for ${tx.signature}`);
          }
        } else {
          if (isDebug) console.log(`[HeliusDebug] Token address mismatch or missing. TokenAddress: ${tokenAddress}, Filter: ${isTokenFilter ? filterAddress : 'NONE'}`);
        }
      } else {
        if (isDebug) console.log(`[HeliusDebug] No assetIn or assetOut identified.`);
      }
    } else {
      if (isDebug) console.log(`[HeliusDebug] No swapEvent found.`);
    }

    // 2. Fallback: Parse from token/native transfers
    const filterAddrLower = filterAddress.toLowerCase();
    const isDexSource = [
      'JUPITER', 'RAYDIUM', 'ORCA', 'METEORA', 'PHOENIX', 'WHIRLPOOL', 'PUMPFUN', 'ALDRIN', 'STEPN', 'SAROS', 'SABER'
    ].includes(tx.source?.toUpperCase());

    const tokenTransfer = isTokenFilter
      ? tx.tokenTransfers?.find((t: any) => t.mint.toLowerCase() === filterAddrLower)
      : tx.tokenTransfers?.find((t: any) =>
        (t.fromUserAccount || '').toLowerCase() === filterAddrLower ||
        (t.toUserAccount || '').toLowerCase() === filterAddrLower
      );

    if (tokenTransfer || isDexSource) {
      // ... (existing fallback logic)
      const otherTransfer = tx.tokenTransfers?.find((t: any) => isMoney(t.mint));
      const nativeTransfer = tx.nativeTransfers?.find((n: any) =>
        (n.fromUserAccount || '').toLowerCase() === filterAddrLower ||
        (n.toUserAccount || '').toLowerCase() === filterAddrLower
      );

      const activeTokenTransfer = tokenTransfer || tx.tokenTransfers?.find((t: any) => !isMoney(t.mint));

      if (activeTokenTransfer) {
        // ... (existing active transfer logic)
        const isOut = (activeTokenTransfer.fromUserAccount || '').toLowerCase() === filterAddrLower;
        let moneyAmount = otherTransfer
          ? (otherTransfer.tokenAmount || otherTransfer.rawTokenAmount?.tokenAmount || 0)
          : (nativeTransfer ? Math.abs(nativeTransfer.amount) / 1e9 : 0);

        const moneyMint = otherTransfer ? otherTransfer.mint : 'SOL';
        const isStable = moneyMint.toLowerCase().includes('usdc') || moneyMint.toLowerCase().includes('usdt');

        const effectiveSolPrice = solPrice > 0 ? solPrice : 150;
        if (isStable) {
          moneyAmount = moneyAmount / effectiveSolPrice;
        }

        const tokenAmount = activeTokenTransfer.tokenAmount || activeTokenTransfer.rawTokenAmount?.tokenAmount || 0;

        if (tokenAmount > 0 && moneyAmount > 0 && !isMoney(activeTokenTransfer.mint)) {
          swaps.push({
            id: tx.signature,
            type: isOut ? 'sell' : 'buy',
            tokenAddress: activeTokenTransfer.mint,
            tokenAmount,
            solAmount: moneyAmount,
            pricePerToken: moneyAmount / tokenAmount,
            priceUsd: 0,
            maker: filterAddress,
            timestamp: tx.timestamp * 1000,
            txHash: tx.signature,
          });
          continue;
        }
      }
    }

    // 3. Debug logging for missed swaps
    if (tx.type === 'SWAP' && !swaps.find(s => s.id === tx.signature)) {
      console.log(`[Helius] Missed SWAP detection for ${tx.signature}. Source: ${tx.source}.`, {
        events: tx.events,
        tokTransfers: tx.tokenTransfers?.length
      });
    }
  }

  return swaps.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Subscribe to real-time transactions using polling
 */
/**
 * Subscribe to real-time transactions using polling
 */
export function subscribeToTransactions(
  address: string,
  onTransaction: (tx: ParsedSwapTransaction) => void,
  intervalMs: number = 5000,
  type: 'token' | 'wallet' = 'token'
): () => void {
  let isActive = true;
  let lastTimestamp = Date.now();

  const poll = async () => {
    if (!isActive) return;

    try {
      // Use the correct fetcher based on type
      const transactions = type === 'wallet'
        ? await fetchWalletTrades(address, 10)
        : await fetchTokenTransactions(address, 10);

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
  // Try Jupiter first (primary)
  try {
    const response = await fetch(
      'https://price.jup.ag/v4/price?ids=So11111111111111111111111111111111111111112'
    );
    if (response.ok) {
      const data = await response.json();
      const price = data.data?.['So11111111111111111111111111111111111111112']?.price;
      if (price) return price;
    }
  } catch (error) {
    // console.debug('Jupiter price fetch failed:', error);
  }

  // Fallback 1: Try Birdeye via proxy
  try {
    const response = await fetch(`${import.meta.env.VITE_WAGYU_API_URL || 'http://localhost:8001'}/api/birdeye/price?address=So11111111111111111111111111111111111111112`);
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.data?.value) return data.data.value;
    }
  } catch (error) {
    // console.debug('Birdeye price fetch failed:', error);
  }

  // Fallback 2: CoinGecko (Public API, rate limited but good backup)
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    if (response.ok) {
      const data = await response.json();
      if (data.solana?.usd) {
        console.log('[getSolPrice] Fetched from CoinGecko:', data.solana.usd);
        return data.solana.usd;
      }
    }
  } catch (error) {
    console.warn('CoinGecko price fetch failed:', error);
  }

  throw new Error('Failed to fetch SOL price from all sources');
}
