import { PublicKey } from '@solana/web3.js';

export interface SIWSMessage {
  domain: string;
  address: string;
  statement?: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
}

/**
 * Construct a SIWS (Sign-In With Solana) message
 */
export function constructSIWSMessage(
  publicKey: string,
  nonce: string,
  domain?: string
): string {
  const now = new Date();
  const domainName = domain || window.location.hostname;
  const uri = window.location.origin;
  
  const message = `${domainName} wants you to sign in with your Solana account:
${publicKey}

URI: ${uri}
Version: 1
Chain ID: 1
Nonce: ${nonce}
Issued At: ${now.toISOString()}`;

  return message;
}

/**
 * Request a nonce from the backend
 */
export async function requestNonce(publicKey?: string): Promise<{ nonce: string; expiresAt: string }> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const response = await fetch(`${supabaseUrl}/functions/v1/siws-nonce`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ publicKey }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate nonce');
  }

  return await response.json();
}

/**
 * Verify SIWS signature with backend
 */
export async function verifySIWSSignature(
  publicKey: string,
  message: string,
  signature: Uint8Array,
  nonce: string,
  domain: string,
  timestamp: string
): Promise<{ token: string; user: any }> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  // Convert signature to base64 for transmission
  const signatureBase64 = btoa(
    String.fromCharCode(...signature)
  );

  const response = await fetch(`${supabaseUrl}/functions/v1/siws-verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      publicKey,
      message,
      signature: signatureBase64,
      nonce,
      domain,
      timestamp,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to verify signature');
  }

  return await response.json();
}

/**
 * Complete SIWS authentication flow
 */
export async function signInWithSolana(
  publicKey: PublicKey,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
): Promise<{ token: string; user: any }> {
  try {
    // 1. Request nonce
    const { nonce } = await requestNonce(publicKey.toBase58());

    // 2. Construct SIWS message
    const message = constructSIWSMessage(publicKey.toBase58(), nonce);
    const messageBytes = new TextEncoder().encode(message);

    // 3. Sign message with wallet
    const signature = await signMessage(messageBytes);

    // 4. Extract timestamp from message
    const timestampMatch = message.match(/Issued At: (.+)/);
    const timestamp = timestampMatch ? timestampMatch[1] : new Date().toISOString();

    // 5. Verify signature with backend
    const result = await verifySIWSSignature(
      publicKey.toBase58(),
      message,
      signature,
      nonce,
      window.location.hostname,
      timestamp
    );

    // 6. Store token
    if (result.token) {
      localStorage.setItem('siws_token', result.token);
      localStorage.setItem('siws_public_key', publicKey.toBase58());
    }

    return result;
  } catch (error) {
    console.error('SIWS authentication error:', error);
    throw error;
  }
}

/**
 * Get stored SIWS token
 */
export function getSIWSToken(): string | null {
  return localStorage.getItem('siws_token');
}

/**
 * Get stored SIWS public key
 */
export function getSIWSPublicKey(): string | null {
  return localStorage.getItem('siws_public_key');
}

/**
 * Clear SIWS authentication data
 */
export function clearSIWSAuth(): void {
  localStorage.removeItem('siws_token');
  localStorage.removeItem('siws_public_key');
}
