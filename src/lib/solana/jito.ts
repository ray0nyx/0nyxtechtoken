import { Connection, Transaction, VersionedTransaction, PublicKey, SystemProgram } from '@solana/web3.js';
import { JitoClient } from 'jito-js-rpc';

// Jito configuration
const JITO_BLOCK_ENGINE_URL = 'https://mainnet.block-engine.jito.wtf';
const JITO_TIP_ACCOUNT = new PublicKey('96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyf9oe5KKyXQr');

export interface JitoBundleConfig {
  tipAmount?: number; // Amount in lamports to tip Jito validators
  skipPreflight?: boolean;
  maxRetries?: number;
  skipTipTransaction?: boolean; // Set to true if tip is already included in transactions
}

/**
 * Create a tip transaction for Jito validators
 */
export async function createTipTransaction(
  signerPublicKey: PublicKey,
  tipAmount: number,
  connection: Connection
): Promise<VersionedTransaction> {
  const tipTransaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: signerPublicKey,
      toPubkey: JITO_TIP_ACCOUNT,
      lamports: tipAmount,
    })
  );

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  tipTransaction.recentBlockhash = blockhash;
  tipTransaction.lastValidBlockHeight = lastValidBlockHeight;
  tipTransaction.feePayer = signerPublicKey;

  return new VersionedTransaction(tipTransaction.compileMessage());
}

/**
 * Create a Jito bundle from transactions
 * Jito bundles allow transactions to be executed together atomically
 */
export async function createJitoBundle(
  transactions: (Transaction | VersionedTransaction)[],
  connection: Connection,
  signerPublicKey: PublicKey,
  config: JitoBundleConfig = {}
): Promise<VersionedTransaction[]> {
  const { tipAmount = 10000, skipTipTransaction = false } = config;

  // Convert all transactions to VersionedTransaction if needed
  const versionedTransactions: VersionedTransaction[] = transactions.map(tx => {
    if (tx instanceof VersionedTransaction) {
      return tx;
    }
    // Convert legacy Transaction to VersionedTransaction
    return new VersionedTransaction(tx.compileMessage());
  });

  // Add tip transaction if needed
  // Tip transaction should be first in the bundle for best priority
  if (!skipTipTransaction && tipAmount > 0) {
    const tipTransaction = await createTipTransaction(signerPublicKey, tipAmount, connection);
    versionedTransactions.unshift(tipTransaction);
  }

  return versionedTransactions;
}

/**
 * Send transactions via Jito bundle using jito-js-rpc
 * This ensures transactions are executed together and helps avoid spam/MEV issues
 */
export async function sendJitoBundle(
  transactions: (Transaction | VersionedTransaction)[],
  connection: Connection,
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>,
  signerPublicKey: PublicKey,
  config: JitoBundleConfig = {}
): Promise<string[]> {
  try {
    // Create bundle with tip transaction
    const bundle = await createJitoBundle(transactions, connection, signerPublicKey, config);

    // Sign all transactions
    const signedBundle = await Promise.all(
      bundle.map(tx => signTransaction(tx))
    );

    // Serialize all transactions to base64 for Jito
    const serializedTransactions = signedBundle.map(tx => {
      return Buffer.from(tx.serialize()).toString('base64');
    });

    // Create Jito client
    const jitoClient = new JitoClient(connection, JITO_BLOCK_ENGINE_URL);

    // Send bundle using jito-js-rpc
    const response = await jitoClient.sendBundle({
      transactions: serializedTransactions,
      encoding: 'base64',
    });

    if (!response || response.error) {
      throw new Error(`Jito bundle send failed: ${response?.error || 'Unknown error'}`);
    }

    // Extract transaction signatures from the signed bundle
    const bundleIds: string[] = [];
    for (const signedTx of signedBundle) {
      // Get signature from signed transaction (first signature is the main one)
      if (signedTx.signatures && signedTx.signatures.length > 0) {
        // Convert signature from Uint8Array to base58 string
        // Solana signatures are 64 bytes
        const signatureBytes = signedTx.signatures[0];
        // Use bs58 for proper Solana signature encoding
        const bs58 = (await import('bs58')).default;
        const signature = bs58.encode(signatureBytes);
        bundleIds.push(signature);
      }
    }

    // Wait for confirmation on the regular RPC
    // Note: Jito bundles are confirmed when the bundle is included in a block
    // We check individual transaction confirmations as a fallback
    await Promise.all(
      bundleIds.map(async (sig) => {
        try {
          // Wait a bit for the bundle to be processed
          await new Promise(resolve => setTimeout(resolve, 1000));
          await connection.confirmTransaction(sig, 'confirmed');
        } catch (err) {
          console.warn(`Transaction ${sig} confirmation warning:`, err);
          // Don't throw - bundle might still be processing
        }
      })
    );

    return bundleIds;
  } catch (error) {
    console.error('Error sending Jito bundle:', error);
    // Fallback to regular transaction sending if Jito fails
    console.warn('Falling back to regular transaction sending');
    
    const fallbackIds: string[] = [];
    for (const tx of transactions) {
      try {
        const versionedTx = tx instanceof VersionedTransaction 
          ? tx 
          : new VersionedTransaction(tx.compileMessage());
        const signed = await signTransaction(versionedTx);
        const serialized = signed.serialize();
        const txid = await connection.sendRawTransaction(serialized, {
          skipPreflight: config.skipPreflight ?? false,
          maxRetries: config.maxRetries ?? 3,
        });
        fallbackIds.push(txid);
      } catch (err) {
        console.error('Error in fallback transaction:', err);
      }
    }
    
    return fallbackIds;
  }
}

/**
 * Get eligible tip accounts from Jito
 * This helps ensure your tip goes to an active validator
 */
export async function getJitoTipAccounts(connection: Connection): Promise<PublicKey[]> {
  try {
    const jitoClient = new JitoClient(connection, JITO_BLOCK_ENGINE_URL);
    const tipAccounts = await jitoClient.getTipAccounts();
    return tipAccounts.map(addr => new PublicKey(addr));
  } catch (error) {
    console.error('Error fetching Jito tip accounts:', error);
    // Return default tip account as fallback
    return [JITO_TIP_ACCOUNT];
  }
}

/**
 * Wrap a transaction function to use Jito bundles
 */
export function withJitoBundle<T extends any[]>(
  transactionFn: (...args: T) => Promise<Transaction | VersionedTransaction>,
  connection: Connection,
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>,
  signerPublicKey: PublicKey,
  config: JitoBundleConfig = {}
) {
  return async (...args: T): Promise<string[]> => {
    const transaction = await transactionFn(...args);
    return sendJitoBundle([transaction], connection, signTransaction, signerPublicKey, config);
  };
}

/**
 * Check if Jito is available and configured
 */
export function isJitoAvailable(): boolean {
  return !!JITO_BLOCK_ENGINE_URL;
}

/**
 * Get Jito tip account public key
 */
export function getJitoTipAccount(): PublicKey {
  return JITO_TIP_ACCOUNT;
}
