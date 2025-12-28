/**
 * Helius Transaction Parser
 * 
 * Parses Helius transactionSubscribe responses to extract pump.fun token data.
 * Handles account key extraction and log message validation.
 */

export interface ParsedPumpTransaction {
    mint: string;
    bondingCurve: string;
    creator: string;
    signature: string;
    slot: number;
    timestamp: number;
}

export interface TokenEvent {
    mint: string;
    name: string;
    symbol: string;
    image: string;
    mcap: number;
    liquidity: number;
    bondingCurve: string;
    creator: string;
    signature: string;
    createdAt: number;
    timeAgo: string;
}

// Pump.fun Program ID
export const PUMP_FUN_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';

// Initial bonding curve parameters
const VIRTUAL_SOL_RESERVES = 30; // SOL
const INITIAL_TOKEN_SUPPLY = 1_000_000_000; // 1B tokens
const SOL_PRICE_USD = 200; // Approximate SOL price

/**
 * DataParser - Utility class for parsing Helius transaction data
 */
export class DataParser {
    /**
     * Check if transaction is a pump.fun token creation
     */
    static isTokenCreation(transaction: any): boolean {
        const logs = transaction?.meta?.logMessages || [];
        return logs.some((log: string) =>
            log.includes('Instruction: Create') ||
            log.includes('Program log: Instruction: Create')
        );
    }

    /**
     * Extract mint address from transaction (Index 0 in accountKeys)
     */
    static extractMintAddress(transaction: any): string | null {
        try {
            const accountKeys = transaction?.transaction?.message?.accountKeys;
            if (!accountKeys || accountKeys.length === 0) return null;

            // Account Index 0 is typically the mint
            const mintAccount = accountKeys[0];
            return typeof mintAccount === 'string'
                ? mintAccount
                : mintAccount?.pubkey || null;
        } catch (e) {
            console.error('Error extracting mint:', e);
            return null;
        }
    }

    /**
     * Extract bonding curve address from transaction (Index 2 in accountKeys)
     */
    static extractBondingCurve(transaction: any): string | null {
        try {
            const accountKeys = transaction?.transaction?.message?.accountKeys;
            if (!accountKeys || accountKeys.length < 3) return null;

            // Account Index 2 is typically the bonding curve
            const bondingCurveAccount = accountKeys[2];
            return typeof bondingCurveAccount === 'string'
                ? bondingCurveAccount
                : bondingCurveAccount?.pubkey || null;
        } catch (e) {
            console.error('Error extracting bonding curve:', e);
            return null;
        }
    }

    /**
     * Extract creator (signer) from transaction
     */
    static extractCreator(transaction: any): string | null {
        try {
            const accountKeys = transaction?.transaction?.message?.accountKeys;
            if (!accountKeys) return null;

            // Find the first signer
            for (const account of accountKeys) {
                if (typeof account === 'object' && account.signer) {
                    return account.pubkey;
                }
            }

            // Fallback to first account
            return typeof accountKeys[0] === 'string'
                ? accountKeys[0]
                : accountKeys[0]?.pubkey || null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Parse a full Helius transaction notification
     */
    static parseTransaction(notification: any): ParsedPumpTransaction | null {
        try {
            const transaction = notification?.params?.result || notification?.result;
            if (!transaction) return null;

            // Validate it's a token creation
            if (!this.isTokenCreation(transaction)) {
                return null;
            }

            const mint = this.extractMintAddress(transaction);
            const bondingCurve = this.extractBondingCurve(transaction);
            const creator = this.extractCreator(transaction);
            const signature = transaction?.signature || notification?.params?.result?.signature;

            if (!mint) {
                console.warn('Could not extract mint address from transaction');
                return null;
            }

            return {
                mint,
                bondingCurve: bondingCurve || '',
                creator: creator || '',
                signature: signature || '',
                slot: transaction?.slot || 0,
                timestamp: Date.now(),
            };
        } catch (e) {
            console.error('Error parsing transaction:', e);
            return null;
        }
    }

    /**
     * Calculate initial market cap based on bonding curve
     */
    static calculateInitialMcap(): number {
        // Initial MC = (Virtual SOL / Total Supply) * Total Supply * SOL Price
        // Simplified: Virtual SOL * SOL Price
        return VIRTUAL_SOL_RESERVES * SOL_PRICE_USD;
    }

    /**
     * Calculate initial liquidity
     */
    static calculateInitialLiquidity(): number {
        return VIRTUAL_SOL_RESERVES * SOL_PRICE_USD;
    }

    /**
     * Format time ago string
     */
    static formatTimeAgo(timestamp: number): string {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);

        if (seconds < 5) return 'just now';
        if (seconds < 60) return `${seconds}s ago`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    }
}

/**
 * Helius DAS API client for metadata enrichment
 */
export class HeliusMetadataFetcher {
    private apiKey: string;
    private baseUrl: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
        this.baseUrl = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
    }

    /**
     * Fetch token metadata using Helius DAS API (getAsset)
     */
    async getAssetMetadata(mint: string): Promise<{
        name: string;
        symbol: string;
        image: string;
    }> {
        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 'metadata-' + mint,
                    method: 'getAsset',
                    params: { id: mint },
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const content = data?.result?.content;

            return {
                name: content?.metadata?.name || 'Unknown Token',
                symbol: content?.metadata?.symbol || '???',
                image: content?.links?.image || content?.files?.[0]?.uri || '',
            };
        } catch (e) {
            console.warn('Failed to fetch metadata for', mint, e);
            // Return defaults - metadata may not be available immediately
            return {
                name: 'New Token',
                symbol: '???',
                image: '',
            };
        }
    }

    /**
     * Fetch metadata with retry for newly created tokens
     */
    async getAssetMetadataWithRetry(
        mint: string,
        retries: number = 3,
        delayMs: number = 1000
    ): Promise<{ name: string; symbol: string; image: string }> {
        for (let i = 0; i < retries; i++) {
            const metadata = await this.getAssetMetadata(mint);

            // If we got real data, return it
            if (metadata.name !== 'New Token' && metadata.symbol !== '???') {
                return metadata;
            }

            // Wait before retry
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1)));
            }
        }

        // Return whatever we have after retries
        return this.getAssetMetadata(mint);
    }
}
