/**
 * Turnkey Wallet Wrapper
 * 
 * Wraps Turnkey wallet to work with Solana wallet adapter interface
 */

import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import { getTurnkeyService, type TurnkeyWallet } from './turnkey-service';

export interface TurnkeyWalletAdapter {
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signTransaction: (transaction: VersionedTransaction) => Promise<VersionedTransaction>;
  signAllTransactions: (transactions: VersionedTransaction[]) => Promise<VersionedTransaction[]>;
}

/**
 * Create a Turnkey wallet adapter
 */
export function createTurnkeyWalletAdapter(
  wallet: TurnkeyWallet
): TurnkeyWalletAdapter {
  const turnkeyService = getTurnkeyService();
  
  return {
    publicKey: wallet.publicKey,
    connected: true,
    connecting: false,
    
    async connect() {
      // Wallet is already connected via Turnkey
      // This is a no-op for Turnkey wallets
    },
    
    async disconnect() {
      // Turnkey wallets don't need explicit disconnection
      // But we can clear local state if needed
    },
    
    async signTransaction(transaction: VersionedTransaction): Promise<VersionedTransaction> {
      // Serialize transaction
      const serialized = transaction.serialize();
      const transactionBase64 = Buffer.from(serialized).toString('base64');
      
      // Request signature from backend
      const signatureResponse = await turnkeyService.requestSignature({
        walletId: wallet.walletId,
        organizationId: wallet.organizationId,
        transaction: transactionBase64,
      });
      
      // Deserialize signed transaction
      const signedBytes = Buffer.from(signatureResponse.signedTransaction, 'base64');
      return VersionedTransaction.deserialize(signedBytes);
    },
    
    async signAllTransactions(
      transactions: VersionedTransaction[]
    ): Promise<VersionedTransaction[]> {
      // Sign all transactions in parallel
      return Promise.all(
        transactions.map(tx => this.signTransaction(tx))
      );
    },
  };
}

/**
 * Get or create Turnkey wallet for a user
 */
export async function getOrCreateTurnkeyWallet(
  userId: string,
  userEmail: string
): Promise<TurnkeyWallet> {
  const turnkeyService = getTurnkeyService();
  
  // Check if wallet already exists in database
  // For now, we'll create a new one each time (in production, store in DB)
  const subOrg = await turnkeyService.createSubOrganization(userId, userEmail);
  
  return await turnkeyService.getWallet(subOrg.walletId, subOrg.subOrganizationId);
}
