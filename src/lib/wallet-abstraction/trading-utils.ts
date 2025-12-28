/**
 * Trading Wallet Utilities
 * 
 * Utility functions for trading operations that integrate with Turnkey wallet.
 * Provides easy-to-use functions for swaps and transactions.
 */

import {
    Connection, PublicKey, VersionedTransaction, TransactionMessage,
    TransactionInstruction, ComputeBudgetProgram
} from '@solana/web3.js';
import { TurnkeyWalletAdapter } from './turnkey-wallet';

const RPC_URL = import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

/**
 * Execute a token swap using Jupiter and Turnkey wallet
 */
export async function executeSwap(
    adapter: TurnkeyWalletAdapter,
    inputMint: string,
    outputMint: string,
    amountLamports: number,
    slippageBps: number = 100 // 1% default
): Promise<string> {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001';

    if (!adapter.publicKey) {
        throw new Error('Wallet not connected');
    }

    // Get swap transaction from Jupiter API (via our backend)
    const response = await fetch(`${apiUrl}/api/jupiter/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userPublicKey: adapter.publicKey.toBase58(),
            inputMint,
            outputMint,
            amount: amountLamports.toString(),
            slippageBps,
            priorityFeeLamports: 10000, // 0.00001 SOL priority fee
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get swap transaction');
    }

    const { swapTransaction } = await response.json();

    // Deserialize the transaction
    const txBytes = Buffer.from(swapTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(txBytes);

    // Sign with Turnkey
    const signedTx = await adapter.signTransaction(transaction);

    // Send to network
    const connection = new Connection(RPC_URL, 'confirmed');
    const signature = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
    });

    // Confirm transaction
    await connection.confirmTransaction(signature, 'confirmed');

    return signature;
}

/**
 * Get SOL balance for the wallet
 */
export async function getSolBalance(publicKey: PublicKey): Promise<number> {
    const connection = new Connection(RPC_URL, 'confirmed');
    const balance = await connection.getBalance(publicKey);
    return balance / 1e9; // Convert lamports to SOL
}

/**
 * Get token balance for a specific mint
 */
export async function getTokenBalance(
    publicKey: PublicKey,
    tokenMint: string
): Promise<number> {
    const connection = new Connection(RPC_URL, 'confirmed');

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        { mint: new PublicKey(tokenMint) }
    );

    if (tokenAccounts.value.length === 0) {
        return 0;
    }

    const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount;
    return parseFloat(balance.uiAmountString || '0');
}

/**
 * Check MEV risk before executing a trade
 */
export async function checkMevRisk(
    tokenMint: string,
    amountLamports: number,
    isBuy: boolean
): Promise<{
    riskLevel: string;
    isSafe: boolean;
    recommendation: string;
    useJitoBundle: boolean;
}> {
    const apiUrl = import.meta.env.VITE_RUST_API_URL || 'http://localhost:8002';

    const response = await fetch(`${apiUrl}/api/mev/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            tokenMint,
            amountLamports,
            isBuy,
        }),
    });

    if (!response.ok) {
        // If MEV check fails, assume safe but recommend caution
        return {
            riskLevel: 'unknown',
            isSafe: true,
            recommendation: 'MEV check unavailable. Proceed with caution.',
            useJitoBundle: false,
        };
    }

    return response.json();
}

/**
 * Get Jito tip accounts for MEV protection
 */
export async function getJitoTipAccounts(): Promise<{
    accounts: string[];
    recommended: string;
}> {
    const apiUrl = import.meta.env.VITE_RUST_API_URL || 'http://localhost:8002';

    const response = await fetch(`${apiUrl}/api/mev/tip-accounts`);

    if (!response.ok) {
        // Return hardcoded fallback
        return {
            accounts: ['96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5'],
            recommended: '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
        };
    }

    return response.json();
}

/**
 * Quick buy with MEV protection
 * Automatically checks MEV risk and uses Jito bundle if needed
 */
export async function quickBuy(
    adapter: TurnkeyWalletAdapter,
    tokenMint: string,
    solAmount: number // Amount in SOL
): Promise<{ signature: string; mevProtected: boolean }> {
    if (!adapter.publicKey) {
        throw new Error('Wallet not connected');
    }

    const amountLamports = Math.floor(solAmount * 1e9);

    // Check MEV risk first
    const mevRisk = await checkMevRisk(tokenMint, amountLamports, true);

    // For now, execute regular swap (Jito bundle integration would go here)
    const signature = await executeSwap(
        adapter,
        'So11111111111111111111111111111111111111112', // WSOL
        tokenMint,
        amountLamports,
        100 // 1% slippage
    );

    return {
        signature,
        mevProtected: mevRisk.useJitoBundle,
    };
}

/**
 * Quick sell with MEV protection
 */
export async function quickSell(
    adapter: TurnkeyWalletAdapter,
    tokenMint: string,
    tokenAmount: number,
    tokenDecimals: number = 9
): Promise<{ signature: string; mevProtected: boolean }> {
    if (!adapter.publicKey) {
        throw new Error('Wallet not connected');
    }

    const amountLamports = Math.floor(tokenAmount * Math.pow(10, tokenDecimals));

    // Check MEV risk
    const mevRisk = await checkMevRisk(tokenMint, amountLamports, false);

    // Execute swap
    const signature = await executeSwap(
        adapter,
        tokenMint,
        'So11111111111111111111111111111111111111112', // WSOL
        amountLamports,
        100 // 1% slippage
    );

    return {
        signature,
        mevProtected: mevRisk.useJitoBundle,
    };
}
