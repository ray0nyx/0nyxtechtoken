import { useState, useEffect } from 'react';
import { subscribeToTransactions } from '@/lib/helius-service';
import { analyzeTraderPerformance, TraderPerformanceMetrics } from '@/lib/trader-performance-tracker';
import { updateTraderLeaderboard } from '@/lib/trader-performance-tracker';
import { useConnection } from '@solana/wallet-adapter-react';

export function useRealTimeTraderMetrics(
    initialMetrics: any,
    walletAddress: string,
    isAnalyzing: boolean
) {
    const [metrics, setMetrics] = useState<any>(initialMetrics);
    const { connection } = useConnection();

    useEffect(() => {
        // Update local state if initialMetrics changes (e.g. from parent re-fetch)
        setMetrics(initialMetrics);
    }, [initialMetrics]);

    useEffect(() => {
        if (!walletAddress || isAnalyzing) return;

        // Subscribe to new transactions
        const unsubscribe = subscribeToTransactions(
            walletAddress,
            async (tx) => {
                console.log(`[RealTime] New trade detected for ${walletAddress}:`, tx.id);

                // Re-analyze performance when a new trade occurs
                // We use a small delay to ensure the transaction is fully confirmed and indexable if we were to fetch it
                // But since we have the tx from the subscription, we heavily rely on analyzeTraderPerformance fetching the full history including this new one
                try {
                    // Re-run analysis
                    const updatedMetrics = await analyzeTraderPerformance(connection, walletAddress, 1000);

                    if (updatedMetrics) {
                        console.log(`[RealTime] Updated metrics for ${walletAddress}:`, updatedMetrics);
                        setMetrics((prev: any) => ({
                            ...prev,
                            ...updatedMetrics
                        }));

                        // Persist to DB
                        updateTraderLeaderboard(updatedMetrics).catch(err =>
                            console.error('Failed to persist real-time update:', err)
                        );
                    }
                } catch (error) {
                    console.error('Error updating real-time metrics:', error);
                }
            },
            10000, // Poll every 10 seconds for new transactions
            'wallet' // Specify this is a wallet subscription
        );

        return () => {
            unsubscribe();
        };
    }, [walletAddress, isAnalyzing, connection]);

    return metrics;
}
