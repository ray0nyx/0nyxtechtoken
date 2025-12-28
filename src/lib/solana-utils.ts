import { Connection, PublicKey, ParsedAccountData } from '@solana/web3.js';
import { createClient } from './supabase/client';

// Solana RPC endpoints (using public endpoints, can be upgraded to Helius for production)
const SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com';
const SOLANA_DEVNET_URL = 'https://api.devnet.solana.com';

export interface SolanaWalletBalance {
  sol: number;
  usdValue: number;
}

export interface SolanaToken {
  mint: string;
  amount: number;
  decimals: number;
  usdValue?: number;
  symbol?: string;
  name?: string;
}

export interface SolanaWalletData {
  address: string;
  balance: SolanaWalletBalance;
  tokens: SolanaToken[];
  transactionCount: number;
  firstTransactionDate?: string;
  lastTransactionDate?: string;
}

export interface SolanaTransaction {
  signature: string;
  timestamp: number;
  type: 'transfer' | 'swap' | 'delegate' | 'other';
  amount?: number;
  from?: string;
  to?: string;
}

/**
 * Create a Solana connection
 */
export function createSolanaConnection(useDevnet = false): Connection {
  const rpcUrl = useDevnet ? SOLANA_DEVNET_URL : SOLANA_RPC_URL;
  return new Connection(rpcUrl, 'confirmed');
}

/**
 * Get SOL balance for a wallet address
 */
export async function getSolanaBalance(
  address: string,
  useDevnet = false
): Promise<SolanaWalletBalance> {
  try {
    const connection = createSolanaConnection(useDevnet);
    const publicKey = new PublicKey(address);
    const lamports = await connection.getBalance(publicKey);
    const sol = lamports / 1e9; // Convert lamports to SOL

    // Get SOL price (using a simple API, can be enhanced)
    const solPrice = await getSolPrice();
    const usdValue = sol * solPrice;

    return { sol, usdValue };
  } catch (error) {
    console.error('Error fetching SOL balance:', error);
    throw new Error(`Failed to fetch balance for ${address}`);
  }
}

/**
 * Get token balances for a wallet
 */
export async function getSolanaTokens(
  address: string,
  useDevnet = false
): Promise<SolanaToken[]> {
  try {
    const connection = createSolanaConnection(useDevnet);
    const publicKey = new PublicKey(address);
    
    // Get all token accounts
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
      programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
    });

    const tokens: SolanaToken[] = tokenAccounts.value.map((account) => {
      const parsedInfo = account.account.data.parsed.info;
      return {
        mint: parsedInfo.mint,
        amount: parsedInfo.tokenAmount.uiAmount || 0,
        decimals: parsedInfo.tokenAmount.decimals,
        symbol: undefined, // Will be fetched separately if needed
        name: undefined,
      };
    });

    return tokens;
  } catch (error) {
    console.error('Error fetching tokens:', error);
    return [];
  }
}

/**
 * Get transaction count for a wallet
 */
export async function getSolanaTransactionCount(
  address: string,
  useDevnet = false
): Promise<number> {
  try {
    const connection = createSolanaConnection(useDevnet);
    const publicKey = new PublicKey(address);
    
    // Get signature list (limited to recent transactions)
    const signatures = await connection.getSignaturesForAddress(publicKey, {
      limit: 1000,
    });

    return signatures.length;
  } catch (error) {
    console.error('Error fetching transaction count:', error);
    return 0;
  }
}

/**
 * Get comprehensive wallet data
 */
export async function getSolanaWalletData(
  address: string,
  useDevnet = false
): Promise<SolanaWalletData> {
  try {
    const [balance, tokens, transactionCount] = await Promise.all([
      getSolanaBalance(address, useDevnet),
      getSolanaTokens(address, useDevnet),
      getSolanaTransactionCount(address, useDevnet),
    ]);

    // Get transaction dates
    const connection = createSolanaConnection(useDevnet);
    const publicKey = new PublicKey(address);
    const signatures = await connection.getSignaturesForAddress(publicKey, {
      limit: 1,
    });

    const lastTransactionDate = signatures.length > 0
      ? new Date(signatures[0].blockTime! * 1000).toISOString()
      : undefined;

    return {
      address,
      balance,
      tokens,
      transactionCount,
      lastTransactionDate,
    };
  } catch (error) {
    console.error('Error fetching wallet data:', error);
    throw error;
  }
}

/**
 * Get SOL price in USD (using a simple API)
 * In production, use a more reliable price API
 */
async function getSolPrice(): Promise<number> {
  try {
    // Using CoinGecko API (free tier)
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
    );
    const data = await response.json();
    return data.solana?.usd || 100; // Fallback to $100 if API fails
  } catch (error) {
    console.error('Error fetching SOL price:', error);
    return 100; // Fallback price
  }
}

/**
 * Validate Solana wallet address
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Save wallet to user's tracking list
 */
export async function saveWalletToTracking(
  address: string,
  blockchain: 'solana' | 'bitcoin',
  label?: string
): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { error } = await supabase
    .from('wallet_tracking')
    .insert({
      user_id: user.id,
      wallet_address: address,
      blockchain,
      label: label || address.slice(0, 8) + '...',
      is_active: true,
    });

  if (error) {
    throw new Error(`Failed to save wallet: ${error.message}`);
  }
}

/**
 * Get user's tracked wallets
 */
export async function getUserTrackedWallets(
  blockchain?: 'solana' | 'bitcoin'
): Promise<Array<{
  id: string;
  wallet_address: string;
  blockchain: string;
  label: string | null;
  is_active: boolean;
  created_at: string;
}>> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  let query = supabase
    .from('wallet_tracking')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (blockchain) {
    query = query.eq('blockchain', blockchain);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching tracked wallets:', error);
    return [];
  }

  return data || [];
}

/**
 * Remove wallet from tracking
 */
export async function removeWalletFromTracking(walletId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('wallet_tracking')
    .delete()
    .eq('id', walletId);

  if (error) {
    throw new Error(`Failed to remove wallet: ${error.message}`);
  }
}

