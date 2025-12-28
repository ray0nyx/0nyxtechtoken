/**
 * Priority Fee Estimation Service
 * 
 * Dynamically estimates optimal priority fees for Solana transactions
 * based on recent network conditions.
 * 
 * Features:
 * - Fetches recent prioritization fees from RPC
 * - Calculates percentile-based fees (p50, p75, p90)
 * - Caches estimates to reduce RPC calls
 * - Configurable fee caps
 */

import { Connection } from '@solana/web3.js';

// ============ Configuration ============

// Fee caps (in microlamports per compute unit)
const MIN_PRIORITY_FEE = 1_000; // 0.001 lamports per CU
const DEFAULT_PRIORITY_FEE = 10_000; // 0.01 lamports per CU
const MAX_PRIORITY_FEE = 1_000_000; // 1 lamport per CU (very high)
const ABSOLUTE_MAX_FEE_LAMPORTS = 10_000_000; // 0.01 SOL absolute max

// Cache duration
const CACHE_DURATION_MS = 5_000; // 5 seconds

// Priority levels (percentiles)
export type PriorityLevel = 'low' | 'medium' | 'high' | 'turbo';

const PRIORITY_PERCENTILES: Record<PriorityLevel, number> = {
  low: 25,
  medium: 50,
  high: 75,
  turbo: 90,
};

// Default compute units for different operations
export const COMPUTE_UNITS = {
  SIMPLE_TRANSFER: 200_000,
  TOKEN_TRANSFER: 300_000,
  JUPITER_SWAP: 400_000,
  COMPLEX_SWAP: 600_000,
  MAX: 1_400_000,
};

// ============ Types ============

export interface PriorityFeeEstimate {
  microLamportsPerCU: number;
  totalLamports: number;
  percentile: number;
  level: PriorityLevel;
  fetchedAt: number;
  sampleSize: number;
}

export interface PriorityFeeOptions {
  level?: PriorityLevel;
  computeUnits?: number;
  maxFeeLamports?: number;
}

interface CachedEstimates {
  fees: number[];
  fetchedAt: number;
  sampleSize: number;
}

// ============ Priority Fee Service Class ============

class PriorityFeeService {
  private connection: Connection | null = null;
  private cachedEstimates: CachedEstimates | null = null;
  private fetchPromise: Promise<number[]> | null = null;
  
  // ============ Configuration ============
  
  /**
   * Set the Solana connection
   */
  setConnection(connection: Connection): void {
    this.connection = connection;
    this.cachedEstimates = null;
  }
  
  /**
   * Get the current connection
   */
  getConnection(): Connection | null {
    return this.connection;
  }
  
  // ============ Fee Estimation ============
  
  /**
   * Estimate priority fee for a transaction
   */
  async estimatePriorityFee(options: PriorityFeeOptions = {}): Promise<PriorityFeeEstimate> {
    const {
      level = 'medium',
      computeUnits = COMPUTE_UNITS.JUPITER_SWAP,
      maxFeeLamports = ABSOLUTE_MAX_FEE_LAMPORTS,
    } = options;
    
    const fees = await this.getRecentFees();
    const percentile = PRIORITY_PERCENTILES[level];
    
    let microLamportsPerCU: number;
    
    if (fees.length === 0) {
      // No data - use default
      microLamportsPerCU = DEFAULT_PRIORITY_FEE;
    } else {
      // Calculate percentile
      const sortedFees = [...fees].sort((a, b) => a - b);
      const index = Math.floor(sortedFees.length * (percentile / 100));
      microLamportsPerCU = sortedFees[Math.min(index, sortedFees.length - 1)];
    }
    
    // Apply min/max bounds
    microLamportsPerCU = Math.max(MIN_PRIORITY_FEE, microLamportsPerCU);
    microLamportsPerCU = Math.min(MAX_PRIORITY_FEE, microLamportsPerCU);
    
    // Calculate total fee in lamports
    let totalLamports = Math.ceil((microLamportsPerCU * computeUnits) / 1_000_000);
    
    // Apply absolute max
    totalLamports = Math.min(totalLamports, maxFeeLamports);
    
    // Recalculate microLamportsPerCU if we hit the cap
    if (totalLamports === maxFeeLamports) {
      microLamportsPerCU = Math.floor((maxFeeLamports * 1_000_000) / computeUnits);
    }
    
    return {
      microLamportsPerCU,
      totalLamports,
      percentile,
      level,
      fetchedAt: this.cachedEstimates?.fetchedAt || Date.now(),
      sampleSize: fees.length,
    };
  }
  
  /**
   * Get all priority level estimates at once
   */
  async getAllEstimates(
    computeUnits: number = COMPUTE_UNITS.JUPITER_SWAP
  ): Promise<Record<PriorityLevel, PriorityFeeEstimate>> {
    const levels: PriorityLevel[] = ['low', 'medium', 'high', 'turbo'];
    
    const estimates: Record<PriorityLevel, PriorityFeeEstimate> = {} as any;
    
    for (const level of levels) {
      estimates[level] = await this.estimatePriorityFee({ level, computeUnits });
    }
    
    return estimates;
  }
  
  /**
   * Get recommended priority fee for Jupiter swap
   */
  async getJupiterSwapFee(level: PriorityLevel = 'medium'): Promise<number> {
    const estimate = await this.estimatePriorityFee({
      level,
      computeUnits: COMPUTE_UNITS.JUPITER_SWAP,
    });
    return estimate.totalLamports;
  }
  
  // ============ Data Fetching ============
  
  private async getRecentFees(): Promise<number[]> {
    // Check cache
    if (this.cachedEstimates && Date.now() - this.cachedEstimates.fetchedAt < CACHE_DURATION_MS) {
      return this.cachedEstimates.fees;
    }
    
    // Dedupe concurrent requests
    if (this.fetchPromise) {
      return this.fetchPromise;
    }
    
    this.fetchPromise = this.fetchRecentFees();
    
    try {
      const fees = await this.fetchPromise;
      this.cachedEstimates = {
        fees,
        fetchedAt: Date.now(),
        sampleSize: fees.length,
      };
      return fees;
    } finally {
      this.fetchPromise = null;
    }
  }
  
  private async fetchRecentFees(): Promise<number[]> {
    if (!this.connection) {
      console.warn('[PriorityFee] No connection set, using defaults');
      return [];
    }
    
    try {
      // Fetch recent prioritization fees
      // Note: This method may not be available on all RPC providers
      const recentFees = await this.connection.getRecentPrioritizationFees();
      
      if (!recentFees || recentFees.length === 0) {
        console.debug('[PriorityFee] No recent fees returned');
        return [];
      }
      
      // Extract fee values (filter out zero fees)
      const fees = recentFees
        .map(f => f.prioritizationFee)
        .filter(f => f > 0);
      
      console.debug(`[PriorityFee] Fetched ${fees.length} recent priority fees`);
      
      return fees;
      
    } catch (error) {
      console.error('[PriorityFee] Failed to fetch recent fees:', error);
      return [];
    }
  }
  
  // ============ Alternative Estimation ============
  
  /**
   * Estimate fee using Helius Priority Fee API (if available)
   */
  async estimateWithHelius(accountKeys?: string[]): Promise<number | null> {
    const heliusApiKey = import.meta.env.VITE_HELIUS_API_KEY;
    
    if (!heliusApiKey) {
      return null;
    }
    
    try {
      const response = await fetch(
        `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'priority-fee',
            method: 'getPriorityFeeEstimate',
            params: [
              {
                accountKeys: accountKeys || [],
                options: {
                  recommended: true,
                },
              },
            ],
          }),
        }
      );
      
      const data = await response.json();
      
      if (data.result?.priorityFeeEstimate) {
        return data.result.priorityFeeEstimate;
      }
      
      return null;
    } catch (error) {
      console.error('[PriorityFee] Helius API error:', error);
      return null;
    }
  }
  
  // ============ Cache Management ============
  
  /**
   * Clear cached estimates
   */
  clearCache(): void {
    this.cachedEstimates = null;
  }
  
  /**
   * Get cache status
   */
  getCacheStatus(): {
    isCached: boolean;
    age: number | null;
    sampleSize: number | null;
  } {
    if (!this.cachedEstimates) {
      return { isCached: false, age: null, sampleSize: null };
    }
    
    return {
      isCached: true,
      age: Date.now() - this.cachedEstimates.fetchedAt,
      sampleSize: this.cachedEstimates.sampleSize,
    };
  }
}

// ============ Singleton Instance ============

let serviceInstance: PriorityFeeService | null = null;

export function getPriorityFeeService(): PriorityFeeService {
  if (!serviceInstance) {
    serviceInstance = new PriorityFeeService();
  }
  return serviceInstance;
}

// ============ Convenience Functions ============

/**
 * Initialize the priority fee service with a connection
 */
export function initPriorityFeeService(connection: Connection): void {
  getPriorityFeeService().setConnection(connection);
}

/**
 * Get recommended priority fee for a Jupiter swap
 */
export async function getSwapPriorityFee(
  level: PriorityLevel = 'medium'
): Promise<number> {
  return getPriorityFeeService().getJupiterSwapFee(level);
}

/**
 * Estimate priority fee with full options
 */
export async function estimatePriorityFee(
  options?: PriorityFeeOptions
): Promise<PriorityFeeEstimate> {
  return getPriorityFeeService().estimatePriorityFee(options);
}

// ============ React Hook ============

import { useEffect, useState, useCallback } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';

export function usePriorityFee(
  level: PriorityLevel = 'medium',
  computeUnits: number = COMPUTE_UNITS.JUPITER_SWAP
) {
  const { connection } = useConnection();
  const service = getPriorityFeeService();
  
  const [estimate, setEstimate] = useState<PriorityFeeEstimate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Set connection
  useEffect(() => {
    if (connection) {
      service.setConnection(connection);
    }
  }, [connection]);
  
  // Fetch estimate
  const fetchEstimate = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await service.estimatePriorityFee({
        level,
        computeUnits,
      });
      setEstimate(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to estimate fee');
    } finally {
      setIsLoading(false);
    }
  }, [level, computeUnits]);
  
  // Fetch on mount and when params change
  useEffect(() => {
    fetchEstimate();
    
    // Refresh every 10 seconds
    const interval = setInterval(fetchEstimate, 10_000);
    
    return () => clearInterval(interval);
  }, [fetchEstimate]);
  
  return {
    estimate,
    isLoading,
    error,
    refresh: fetchEstimate,
    feeInSol: estimate ? estimate.totalLamports / 1e9 : null,
  };
}

/**
 * Hook to get all priority level estimates
 */
export function useAllPriorityFees(computeUnits: number = COMPUTE_UNITS.JUPITER_SWAP) {
  const { connection } = useConnection();
  const service = getPriorityFeeService();
  
  const [estimates, setEstimates] = useState<Record<PriorityLevel, PriorityFeeEstimate> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    if (connection) {
      service.setConnection(connection);
    }
  }, [connection]);
  
  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true);
      try {
        const result = await service.getAllEstimates(computeUnits);
        setEstimates(result);
      } catch (err) {
        console.error('Failed to fetch priority fees:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAll();
    const interval = setInterval(fetchAll, 10_000);
    
    return () => clearInterval(interval);
  }, [computeUnits]);
  
  return { estimates, isLoading };
}

export default PriorityFeeService;





