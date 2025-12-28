/**
 * Signature Service
 * 
 * Handles backend signature requests for Turnkey wallets
 */

import { VersionedTransaction } from '@solana/web3.js';
import type { SignatureRequest, SignatureResponse } from './turnkey-service';

/**
 * Request transaction signature from backend
 * 
 * The backend will use Turnkey API to sign the transaction
 */
export async function requestTransactionSignature(
  walletId: string,
  organizationId: string,
  transaction: VersionedTransaction
): Promise<VersionedTransaction> {
  // Serialize transaction
  const serialized = transaction.serialize();
  const transactionBase64 = Buffer.from(serialized).toString('base64');
  
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001';
  
  const response = await fetch(`${apiUrl}/api/turnkey/sign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      walletId,
      organizationId,
      transaction: transactionBase64,
    } as SignatureRequest),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to get signature: ${error.message || response.statusText}`);
  }

  const signatureData: SignatureResponse = await response.json();
  
  // Deserialize signed transaction
  const signedBytes = Buffer.from(signatureData.signedTransaction, 'base64');
  return VersionedTransaction.deserialize(signedBytes);
}

/**
 * Check if signature service is available
 */
export async function isSignatureServiceAvailable(): Promise<boolean> {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001';
    const response = await fetch(`${apiUrl}/api/turnkey/health`, {
      method: 'GET',
    });
    return response.ok;
  } catch {
    return false;
  }
}
