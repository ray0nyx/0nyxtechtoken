/**
 * MEV Protection Service
 * 
 * Connects to the Rust backend's MEV protection API for:
 * - Sandwich attack risk analysis
 * - Priority fee recommendations
 * - Jito bundle tip accounts
 * - MEV protection advice
 */

const RUST_BACKEND_URL = import.meta.env.VITE_RUST_BACKEND_URL || 'http://localhost:8002';

// ============ Types ============

export interface MevAnalysisRequest {
    tokenMint: string;
    amountLamports: number;
    isBuy: boolean;
}

export interface MevAnalysisResponse {
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    isSafe: boolean;
    recommendation: string;
    useJitoBundle: boolean;
    useBloxroute: boolean;
    details?: string;
}

export interface TipAccountsResponse {
    accounts: string[];
    recommended: string;
}

export interface ProtectionAdvice {
    severity: string;
    advice: string;
    recommendedTipLamports: number;
}

export interface DynamicFeeEstimate {
    recommendedFeeLamports: number;
    minFeeLamports: number;
    maxFeeLamports: number;
    networkCongestion: number; // 0.0 to 1.0
}

export type MevMode = 'off' | 'reduced';

// ============ API Functions ============

/**
 * Analyze sandwich attack risk for a planned trade
 */
export async function analyzeMevRisk(request: MevAnalysisRequest): Promise<MevAnalysisResponse> {
    try {
        const response = await fetch(`${RUST_BACKEND_URL}/api/mev/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                token_mint: request.tokenMint,
                amount_lamports: request.amountLamports,
                is_buy: request.isBuy,
            }),
        });

        if (!response.ok) {
            console.warn('MEV analysis failed, using default safe response');
            return {
                riskLevel: 'low',
                isSafe: true,
                recommendation: 'MEV analysis unavailable, proceed with caution',
                useJitoBundle: false,
                useBloxroute: false,
            };
        }

        const data = await response.json();
        return {
            riskLevel: data.risk_level || 'low',
            isSafe: data.is_safe ?? true,
            recommendation: data.recommendation || '',
            useJitoBundle: data.use_jito_bundle ?? false,
            useBloxroute: data.use_bloxroute ?? false,
            details: data.details,
        };
    } catch (error) {
        console.error('MEV analysis error:', error);
        return {
            riskLevel: 'low',
            isSafe: true,
            recommendation: 'MEV service unavailable',
            useJitoBundle: false,
            useBloxroute: false,
        };
    }
}

/**
 * Get Jito tip accounts for protected bundle submission
 */
export async function getJitoTipAccounts(): Promise<TipAccountsResponse> {
    try {
        const response = await fetch(`${RUST_BACKEND_URL}/api/mev/tip-accounts`);

        if (!response.ok) {
            return {
                accounts: [],
                recommended: '',
            };
        }

        return await response.json();
    } catch (error) {
        console.error('Failed to get tip accounts:', error);
        return {
            accounts: [],
            recommended: '',
        };
    }
}

/**
 * Get MEV protection advice based on trade size and conditions
 */
export async function getMevProtectionAdvice(): Promise<ProtectionAdvice[]> {
    try {
        const response = await fetch(`${RUST_BACKEND_URL}/api/mev/protection-advice`);

        if (!response.ok) {
            return [];
        }

        return await response.json();
    } catch (error) {
        console.error('Failed to get protection advice:', error);
        return [];
    }
}

/**
 * Get dynamic priority fee estimate from network conditions
 */
export async function getDynamicFeeEstimate(): Promise<DynamicFeeEstimate | null> {
    try {
        // First try Rust backend
        const response = await fetch(`${RUST_BACKEND_URL}/api/priority-fee`);

        if (response.ok) {
            const data = await response.json();
            return {
                recommendedFeeLamports: data.recommended_fee_lamports || 10000,
                minFeeLamports: data.min_fee_lamports || 5000,
                maxFeeLamports: data.max_fee_lamports || 100000,
                networkCongestion: data.network_congestion || 0.5,
            };
        }

        // Fallback to reasonable defaults
        return {
            recommendedFeeLamports: 10000, // 0.00001 SOL
            minFeeLamports: 5000,
            maxFeeLamports: 100000,
            networkCongestion: 0.5,
        };
    } catch (error) {
        console.error('Failed to get dynamic fee:', error);
        return null;
    }
}

/**
 * Calculate optimal fees based on MEV mode and network conditions
 * @param mevMode - 'off' for fast submission, 'reduced' for MEV protection
 * @param tradeAmountSol - Trade amount in SOL
 * @returns Recommended priority and bribe fees in SOL
 */
export async function calculateOptimalFees(
    mevMode: MevMode,
    tradeAmountSol: number
): Promise<{ priorityFee: number; bribeFee: number }> {
    const dynamicFee = await getDynamicFeeEstimate();

    if (!dynamicFee) {
        // Fallback defaults
        return {
            priorityFee: mevMode === 'reduced' ? 0.001 : 0.0001,
            bribeFee: mevMode === 'reduced' ? 0.0005 : 0,
        };
    }

    // Convert lamports to SOL
    const baseFeeSol = dynamicFee.recommendedFeeLamports / 1e9;

    // Scale fees based on trade size
    const sizeFactor = Math.min(tradeAmountSol / 10, 2); // Cap at 2x for trades > 10 SOL

    if (mevMode === 'reduced') {
        // Higher fees for MEV protection
        return {
            priorityFee: baseFeeSol * (1 + dynamicFee.networkCongestion) * sizeFactor,
            bribeFee: baseFeeSol * 0.5 * sizeFactor, // Jito tip
        };
    } else {
        // Standard fees for fast submission
        return {
            priorityFee: baseFeeSol * (1 + dynamicFee.networkCongestion * 0.5) * sizeFactor,
            bribeFee: 0,
        };
    }
}

/**
 * Check if a trade should use MEV protection based on risk analysis
 */
export async function shouldUseMevProtection(
    tokenMint: string,
    amountSol: number,
    isBuy: boolean
): Promise<{ shouldProtect: boolean; recommendation: string }> {
    const analysis = await analyzeMevRisk({
        tokenMint,
        amountLamports: Math.round(amountSol * 1e9),
        isBuy,
    });

    return {
        shouldProtect: !analysis.isSafe || analysis.useJitoBundle,
        recommendation: analysis.recommendation,
    };
}

// ============ Auto Fee Service ============

let autoFeeInterval: ReturnType<typeof setInterval> | null = null;
let currentAutoFee: { priorityFee: number; bribeFee: number } | null = null;

/**
 * Start auto-fee updates based on network conditions
 * @param mevMode - Current MEV mode
 * @param onUpdate - Callback when fees update
 * @returns Cleanup function
 */
export function startAutoFee(
    mevMode: MevMode,
    onUpdate: (fees: { priorityFee: string; bribeFee: string }) => void
): () => void {
    // Initial fetch
    updateAutoFee(mevMode, onUpdate);

    // Update every 1 second for real-time network condition updates
    autoFeeInterval = setInterval(() => {
        updateAutoFee(mevMode, onUpdate);
    }, 1000);

    return () => {
        if (autoFeeInterval) {
            clearInterval(autoFeeInterval);
            autoFeeInterval = null;
        }
    };
}

async function updateAutoFee(
    mevMode: MevMode,
    onUpdate: (fees: { priorityFee: string; bribeFee: string }) => void
) {
    try {
        const fees = await calculateOptimalFees(mevMode, 1); // Use 1 SOL as baseline
        currentAutoFee = fees;
        onUpdate({
            priorityFee: fees.priorityFee.toFixed(6),
            bribeFee: fees.bribeFee.toFixed(6),
        });
    } catch (error) {
        console.error('Auto fee update failed:', error);
    }
}

/**
 * Get current auto-calculated fees
 */
export function getCurrentAutoFee(): { priorityFee: number; bribeFee: number } | null {
    return currentAutoFee;
}

export default {
    analyzeMevRisk,
    getJitoTipAccounts,
    getMevProtectionAdvice,
    getDynamicFeeEstimate,
    calculateOptimalFees,
    shouldUseMevProtection,
    startAutoFee,
    getCurrentAutoFee,
};
