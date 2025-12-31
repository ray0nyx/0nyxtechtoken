import { useState, useEffect } from 'react';
import { subscribeToTransactions } from '@/lib/helius-service';

/**
 * Real-time trader metrics hook
 * 
 * This hook subscribes to wallet transactions but does NOT override
 * PnL/netSol values since those come from Solana Tracker API.
 * It only updates trade count when new transactions are detected.
 */
export function useRealTimeTraderMetrics(
    initialMetrics: any,
    walletAddress: string,
    isAnalyzing: boolean
) {
    const [metrics, setMetrics] = useState<any>(initialMetrics);

    useEffect(() => {
        // Update local state if initialMetrics changes (e.g. from parent re-fetch)
        setMetrics(initialMetrics);
    }, [initialMetrics]);

    useEffect(() => {
        if (!walletAddress || isAnalyzing) return;

        // Subscribe to new transactions to detect activity
        const unsubscribe = subscribeToTransactions(
            walletAddress,
            async (tx) => {
                console.log(`[RealTime] New transaction detected for ${walletAddress}:`, tx.id);

                // Only increment trade count on new transactions
                // Do NOT override PnL/netSol values - those come from Solana Tracker API
                setMetrics((prev: any) => ({
                    ...prev,
                    total_trades: (prev.total_trades || 0) + 1,
                }));
            },
            10000, // Poll every 10 seconds for new transactions
            'wallet' // Specify this is a wallet subscription
        );

        return () => {
            unsubscribe();
        };
    }, [walletAddress, isAnalyzing]);

    return metrics;
}
