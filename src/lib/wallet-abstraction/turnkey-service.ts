/**
 * Turnkey Wallet Abstraction Service
 * 
 * Provides non-custodial wallet management via Turnkey API.
 * Supports email-to-wallet onboarding and backend signature requests.
 */

import { PublicKey } from '@solana/web3.js';

export interface TurnkeyWallet {
  walletId: string;
  organizationId: string;
  address: string; // Solana address
  publicKey: PublicKey;
  createdAt: string;
}

export interface TurnkeySubOrganization {
  subOrganizationId: string;
  subOrganizationName: string;
  walletId: string;
  walletAddress: string;
}

export interface SignatureRequest {
  walletId: string;
  transaction: string; // Base64 encoded transaction
  organizationId: string;
}

export interface SignatureResponse {
  signature: string;
  signedTransaction: string;
}

/**
 * Turnkey API Client
 * 
 * Handles communication with Turnkey API for wallet operations
 */
export class TurnkeyService {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;
  private organizationId: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_TURNKEY_API_KEY || '';
    this.apiSecret = import.meta.env.VITE_TURNKEY_API_SECRET || '';
    this.baseUrl = import.meta.env.VITE_TURNKEY_API_URL || 'https://api.turnkey.com';
    this.organizationId = import.meta.env.VITE_TURNKEY_ORGANIZATION_ID || '';
  }

  /**
   * Create a sub-organization for a user
   */
  async createSubOrganization(
    userId: string,
    userEmail: string
  ): Promise<TurnkeySubOrganization> {
    const response = await fetch(`${this.baseUrl}/api/v1/sub-organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Turnkey-Api-Key': this.apiKey,
        'X-Turnkey-Api-Secret': this.apiSecret,
      },
      body: JSON.stringify({
        subOrganizationName: `Axiom-User-${userId}`,
        rootUsers: [
          {
            userName: userEmail,
            userEmail: userEmail,
            apiKeys: [],
            authenticators: [],
            oauthProviders: [],
          },
        ],
        rootQuorumThreshold: 1,
        wallet: {
          walletName: `Wallet-${userId}`,
          accounts: [
            {
              curve: 'CURVE_ED25519',
              pathFormat: 'PATH_FORMAT_BIP32',
              path: "m/44'/501'/0'/0'",
              addressFormat: 'ADDRESS_FORMAT_SOLANA',
            },
          ],
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create sub-organization: ${error.message || response.statusText}`);
    }

    const data = await response.json();
    
    // Extract wallet address from the response
    const walletAddress = data.wallet?.accounts?.[0]?.address || '';
    
    return {
      subOrganizationId: data.subOrganizationId,
      subOrganizationName: data.subOrganizationName,
      walletId: data.wallet?.walletId || '',
      walletAddress,
    };
  }

  /**
   * Get wallet information
   */
  async getWallet(walletId: string, organizationId: string): Promise<TurnkeyWallet> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/wallets/${walletId}?organizationId=${organizationId}`,
      {
        method: 'GET',
        headers: {
          'X-Turnkey-Api-Key': this.apiKey,
          'X-Turnkey-Api-Secret': this.apiSecret,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get wallet: ${response.statusText}`);
    }

    const data = await response.json();
    const address = data.wallet?.accounts?.[0]?.address || '';
    
    return {
      walletId: data.wallet?.walletId || walletId,
      organizationId,
      address,
      publicKey: new PublicKey(address),
      createdAt: data.wallet?.createdAt || new Date().toISOString(),
    };
  }

  /**
   * Request signature from backend (via API endpoint)
   * The backend will use Turnkey API to sign the transaction
   */
  async requestSignature(
    request: SignatureRequest
  ): Promise<SignatureResponse> {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001';
    
    const response = await fetch(`${apiUrl}/api/turnkey/sign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to get signature: ${error.message || response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Check if Turnkey is configured
   */
  isConfigured(): boolean {
    return !!(
      this.apiKey &&
      this.apiSecret &&
      this.organizationId &&
      this.baseUrl
    );
  }
}

// Singleton instance
let turnkeyServiceInstance: TurnkeyService | null = null;

/**
 * Get Turnkey service instance
 */
export function getTurnkeyService(): TurnkeyService {
  if (!turnkeyServiceInstance) {
    turnkeyServiceInstance = new TurnkeyService();
  }
  return turnkeyServiceInstance;
}
