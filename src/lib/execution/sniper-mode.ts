/**
 * Sniper Mode Execution
 * 
 * Ultra-fast execution for migration sniping (<200ms target)
 */

import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { sendMultiBundle, type MultiBundleConfig } from './multi-bundle-executor';
import { getOptimalConnection, shouldUsePrivateRPC } from './private-rpc-service';
import { getOptimalPriorityFee } from './dynamic-priority-fees';
import { getQuote, getSwapTransaction, executeSwap } from '../jupiter-sdk-service';
import type { QuoteOptions, SwapExecutionOptions } from '@/types/jupiter';
import { getBestRoute } from '../liquidity-layer';

export interface SniperModeConfig {
  targetLatencyMs: number; // Target execution time (default: 200ms)
  usePrivateRPC: boolean; // Always use private RPC for sniper mode
  useMultiBundle: boolean; // Use multi-bundle execution
  skipSimulation: boolean; // Skip transaction simulation for speed
  maxSlippageBps: number; // Maximum slippage tolerance
}

const DEFAULT_SNIPER_CONFIG: SniperModeConfig = {
  targetLatencyMs: 200,
  usePrivateRPC: true,
  useMultiBundle: true,
  skipSimulation: true,
  maxSlippageBps: 500, // 5% max slippage for sniper mode
};

export interface SniperExecutionResult {
  success: boolean;
  txSignature?: string;
  executionTime: number;
  quote?: any;
  error?: string;
}

/**
 * Execute swap in sniper mode (ultra-fast)
 */
export async function executeSniperSwap(
  connection: Connection,
  quoteOptions: QuoteOptions,
  swapOptions: Omit<SwapExecutionOptions, 'quote'>,
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>,
  config: Partial<SniperModeConfig> = {}
): Promise<SniperExecutionResult> {
  const startTime = Date.now();
  const sniperConfig = { ...DEFAULT_SNIPER_CONFIG, ...config };
  
  try {
    // Step 1: Get best route (fast, no comparison)
    const quote = await getQuote({
      ...quoteOptions,
      onlyDirectRoutes: false, // Allow multi-hop for best price
    });
    
    if (!quote) {
      return {
        success: false,
        executionTime: Date.now() - startTime,
        error: 'Failed to get quote',
      };
    }
    
    // Check slippage
    const priceImpact = parseFloat(quote.priceImpactPct || '0');
    if (priceImpact > (sniperConfig.maxSlippageBps / 100)) {
      return {
        success: false,
        executionTime: Date.now() - startTime,
        error: `Price impact too high: ${priceImpact}%`,
      };
    }
    
    // Step 2: Get optimal priority fee (fast)
    const priorityFee = await getOptimalPriorityFee(connection, 'high');
    
    // Step 3: Get swap transaction
    const swapResponse = await getSwapTransaction({
      ...swapOptions,
      quote,
      prioritizationFeeLamports: priorityFee,
    });
    
    if (!swapResponse) {
      return {
        success: false,
        executionTime: Date.now() - startTime,
        error: 'Failed to get swap transaction',
      };
    }
    
    // Step 4: Choose connection (private RPC if enabled)
    const tradeAmountUsd = parseFloat(quote.inAmount) / 1e9; // Approximate SOL value
    const executionConnection = sniperConfig.usePrivateRPC
      ? getOptimalConnection(tradeAmountUsd, connection) || connection
      : connection;
    
    // Step 5: Execute with multi-bundle if enabled
    if (sniperConfig.useMultiBundle) {
      // Deserialize transaction
      const txBytes = Buffer.from(swapResponse.swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(txBytes);
      
      // Sign
      const signedTx = await signTransaction(transaction);
      
      // Send via multi-bundle
      const bundleResult = await sendMultiBundle(
        [signedTx],
        executionConnection,
        signTransaction,
        signedTx.message.staticAccountKeys[0], // Fee payer
        {
          cancelOnFirstSuccess: true,
        }
      );
      
      if (bundleResult.firstSuccess) {
        const executionTime = Date.now() - startTime;
        
        if (executionTime > sniperConfig.targetLatencyMs) {
          console.warn(`Sniper mode execution took ${executionTime}ms (target: ${sniperConfig.targetLatencyMs}ms)`);
        }
        
        return {
          success: true,
          txSignature: bundleResult.firstSuccess.signatures?.[0],
          executionTime,
          quote,
        };
      }
      
      return {
        success: false,
        executionTime: Date.now() - startTime,
        error: 'All bundle providers failed',
      };
    } else {
      // Standard execution
      const txSignature = await executeSwap(
        executionConnection,
        swapResponse,
        signTransaction
      );
      
      const executionTime = Date.now() - startTime;
      
      return {
        success: !!txSignature,
        txSignature: txSignature || undefined,
        executionTime,
        quote,
        error: txSignature ? undefined : 'Failed to execute swap',
      };
    }
  } catch (error) {
    return {
      success: false,
      executionTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if sniper mode is available
 */
export function isSniperModeAvailable(): boolean {
  // Check if required services are configured
  const hasPrivateRPC = !!import.meta.env.VITE_PRIVATE_RPC_URL;
  const hasMultiBundle = true; // Always available (Jito is default)
  
  return hasPrivateRPC && hasMultiBundle;
}
