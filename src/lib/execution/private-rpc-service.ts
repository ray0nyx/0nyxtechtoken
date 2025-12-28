/**
 * Private RPC Service
 * 
 * Provides private RPC endpoints for anti-MEV protection
 * Automatically uses private RPC for trades above threshold
 */

import { Connection, ConnectionConfig } from '@solana/web3.js';

export interface PrivateRPCConfig {
  url: string;
  apiKey?: string;
  thresholdUsd: number; // Use private RPC for trades above this amount
}

// Default private RPC providers
const DEFAULT_PRIVATE_RPC_PROVIDERS: PrivateRPCConfig[] = [
  {
    url: import.meta.env.VITE_PRIVATE_RPC_URL || '',
    apiKey: import.meta.env.VITE_PRIVATE_RPC_API_KEY,
    thresholdUsd: 500, // Use for trades >$500
  },
];

/**
 * Get private RPC connection for anti-MEV
 */
export function getPrivateRPCConnection(
  tradeAmountUsd: number,
  config?: ConnectionConfig
): Connection | null {
  // Find appropriate private RPC provider
  const provider = DEFAULT_PRIVATE_RPC_PROVIDERS.find(
    p => tradeAmountUsd >= p.thresholdUsd && p.url
  );
  
  if (!provider) {
    return null; // No private RPC available or trade too small
  }
  
  // Build connection URL with API key if needed
  let rpcUrl = provider.url;
  if (provider.apiKey) {
    const separator = rpcUrl.includes('?') ? '&' : '?';
    rpcUrl = `${rpcUrl}${separator}api-key=${provider.apiKey}`;
  }
  
  return new Connection(rpcUrl, config || {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000,
  });
}

/**
 * Check if trade should use private RPC
 */
export function shouldUsePrivateRPC(tradeAmountUsd: number): boolean {
  return DEFAULT_PRIVATE_RPC_PROVIDERS.some(
    p => tradeAmountUsd >= p.thresholdUsd && !!p.url
  );
}

/**
 * Get connection (private or public) based on trade amount
 */
export function getOptimalConnection(
  tradeAmountUsd: number,
  publicConnection: Connection,
  config?: ConnectionConfig
): Connection {
  const privateConnection = getPrivateRPCConnection(tradeAmountUsd, config);
  
  if (privateConnection) {
    console.log(`Using private RPC for trade: $${tradeAmountUsd} (anti-MEV)`);
    return privateConnection;
  }
  
  return publicConnection;
}
