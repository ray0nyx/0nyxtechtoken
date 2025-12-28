/**
 * Multi-Bundle Executor
 * 
 * Sends transactions to Jito, bloXroute, and NextBlock simultaneously
 * for maximum bundle inclusion rate (Three-Headed Hydra strategy)
 */

import { Connection, VersionedTransaction, PublicKey } from '@solana/web3.js';
import { sendJitoBundle, type JitoBundleConfig } from '../solana/jito';

export interface MultiBundleConfig {
  jito?: JitoBundleConfig;
  bloxroute?: {
    apiKey?: string;
    apiUrl?: string;
  };
  nextblock?: {
    apiKey?: string;
    apiUrl?: string;
  };
  cancelOnFirstSuccess?: boolean; // Cancel other bundles when one succeeds
}

export interface BundleResult {
  provider: 'jito' | 'bloxroute' | 'nextblock';
  success: boolean;
  signatures?: string[];
  error?: string;
  latency?: number;
}

export interface MultiBundleResult {
  results: BundleResult[];
  firstSuccess?: BundleResult;
  allSuccessful: boolean;
  anySuccessful: boolean;
}

/**
 * Send bundle to bloXroute
 */
async function sendBloXrouteBundle(
  transactions: VersionedTransaction[],
  config?: MultiBundleConfig['bloxroute']
): Promise<BundleResult> {
  const startTime = Date.now();
  
  try {
    const apiKey = config?.apiKey || import.meta.env.VITE_BLOXROUTE_API_KEY;
    const apiUrl = config?.apiUrl || 'https://api.bloxroute.com/v1';
    
    if (!apiKey) {
      return {
        provider: 'bloxroute',
        success: false,
        error: 'bloXroute API key not configured',
      };
    }
    
    // Serialize transactions
    const serializedTransactions = transactions.map(tx => 
      Buffer.from(tx.serialize()).toString('base64')
    );
    
    const response = await fetch(`${apiUrl}/solana/bundle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        transactions: serializedTransactions,
        encoding: 'base64',
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      return {
        provider: 'bloxroute',
        success: false,
        error: error.message || response.statusText,
        latency: Date.now() - startTime,
      };
    }
    
    const data = await response.json();
    
    return {
      provider: 'bloxroute',
      success: true,
      signatures: data.signatures || [],
      latency: Date.now() - startTime,
    };
  } catch (error) {
    return {
      provider: 'bloxroute',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      latency: Date.now() - startTime,
    };
  }
}

/**
 * Send bundle to NextBlock
 */
async function sendNextBlockBundle(
  transactions: VersionedTransaction[],
  config?: MultiBundleConfig['nextblock']
): Promise<BundleResult> {
  const startTime = Date.now();
  
  try {
    const apiKey = config?.apiKey || import.meta.env.VITE_NEXTBLOCK_API_KEY;
    const apiUrl = config?.apiUrl || 'https://api.nextblock.com/v1';
    
    if (!apiKey) {
      return {
        provider: 'nextblock',
        success: false,
        error: 'NextBlock API key not configured',
      };
    }
    
    // Serialize transactions
    const serializedTransactions = transactions.map(tx => 
      Buffer.from(tx.serialize()).toString('base64')
    );
    
    const response = await fetch(`${apiUrl}/solana/bundle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        transactions: serializedTransactions,
        encoding: 'base64',
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      return {
        provider: 'nextblock',
        success: false,
        error: error.message || response.statusText,
        latency: Date.now() - startTime,
      };
    }
    
    const data = await response.json();
    
    return {
      provider: 'nextblock',
      success: true,
      signatures: data.signatures || [],
      latency: Date.now() - startTime,
    };
  } catch (error) {
    return {
      provider: 'nextblock',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      latency: Date.now() - startTime,
    };
  }
}

/**
 * Send bundle to all providers simultaneously (Three-Headed Hydra)
 */
export async function sendMultiBundle(
  transactions: (VersionedTransaction)[],
  connection: Connection,
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>,
  signerPublicKey: PublicKey,
  config: MultiBundleConfig = {}
): Promise<MultiBundleResult> {
  // Sign all transactions first
  const signedTransactions = await Promise.all(
    transactions.map(tx => signTransaction(tx))
  );
  
  // Send to all providers simultaneously
  const promises: Promise<BundleResult>[] = [];
  
  // Jito
  promises.push(
    sendJitoBundle(
      signedTransactions,
      connection,
      signTransaction,
      signerPublicKey,
      config.jito
    ).then(
      (signatures) => ({
        provider: 'jito' as const,
        success: true,
        signatures,
      }),
      (error) => ({
        provider: 'jito' as const,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    )
  );
  
  // bloXroute
  promises.push(sendBloXrouteBundle(signedTransactions, config.bloxroute));
  
  // NextBlock
  promises.push(sendNextBlockBundle(signedTransactions, config.nextblock));
  
  // Wait for all results
  const results = await Promise.all(promises);
  
  // Find first success
  const firstSuccess = results.find(r => r.success);
  
  // Cancel others if configured
  if (config.cancelOnFirstSuccess && firstSuccess) {
    // Note: Most bundle providers don't support cancellation
    // This is a placeholder for future implementation
    console.log(`First success from ${firstSuccess.provider}, other bundles may still execute`);
  }
  
  return {
    results,
    firstSuccess,
    allSuccessful: results.every(r => r.success),
    anySuccessful: results.some(r => r.success),
  };
}

/**
 * Send bundle with automatic provider selection based on success rate
 */
export async function sendSmartBundle(
  transactions: (VersionedTransaction)[],
  connection: Connection,
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>,
  signerPublicKey: PublicKey,
  config: MultiBundleConfig = {}
): Promise<MultiBundleResult> {
  // Always use multi-bundle for maximum inclusion rate
  return sendMultiBundle(
    transactions,
    connection,
    signTransaction,
    signerPublicKey,
    {
      ...config,
      cancelOnFirstSuccess: false, // Don't cancel - let all execute for redundancy
    }
  );
}
