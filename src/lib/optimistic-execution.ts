/**
 * Optimistic Execution Service
 * 
 * Provides optimistic UI updates for trading operations with automatic
 * rollback on failure.
 * 
 * Features:
 * - Immediate UI feedback before transaction confirmation
 * - Automatic state rollback on failure
 * - Transaction tracking and confirmation
 * - Balance updates
 * - Order status management
 */

import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { useTradingStore, type PendingOrder, type JupiterQuote } from '@/stores/useTradingStore';
import { performSwap, getJupiterQuote, getJupiterSwapTransaction, executeJupiterSwap } from './jupiter-swap-service';
import { getSwapPriorityFee, type PriorityLevel } from './priority-fee-service';
import { getCachedJupiterQuote } from './jupiter-prefetch-service';
import { getBestRoute } from './liquidity-layer';
import type { RouteSelectionStrategy } from '@/types/jupiter';
import { validateTokenBeforeSwap } from './safety/safety-score';

// ============ Types ============

export interface ExecutionConfig {
  /** Priority level for fee estimation */
  priorityLevel?: PriorityLevel;
  /** Maximum slippage in basis points */
  slippageBps?: number;
  /** Whether to use cached quote if available */
  useCachedQuote?: boolean;
  /** Custom priority fee in lamports (overrides estimation) */
  customPriorityFee?: number;
  /** Timeout for confirmation in ms */
  confirmationTimeout?: number;
  /** Route selection strategy */
  routeStrategy?: RouteSelectionStrategy;
  /** Whether to compare multiple routes */
  compareRoutes?: boolean;
}

export interface ExecutionResult {
  success: boolean;
  orderId: string;
  txSignature?: string;
  error?: string;
  quote?: JupiterQuote;
  executionTime?: number;
}

export interface SwapParams {
  inputMint: string;
  outputMint: string;
  amount: number; // In smallest units (lamports for SOL)
  side: 'buy' | 'sell';
}

// ============ Configuration ============

const DEFAULT_SLIPPAGE_BPS = 50; // 0.5%
const DEFAULT_CONFIRMATION_TIMEOUT = 60_000; // 60 seconds
const SOL_MINT = 'So11111111111111111111111111111111111111112';

// ============ Optimistic Execution Class ============

class OptimisticExecutor {
  private connection: Connection | null = null;
  private signTransaction: ((tx: VersionedTransaction) => Promise<VersionedTransaction>) | null = null;
  private pendingExecutions: Map<string, {
    params: SwapParams;
    rollbackFn: () => void;
    startTime: number;
  }> = new Map();
  
  // ============ Configuration ============
  
  /**
   * Configure the executor with connection and wallet
   */
  configure(
    connection: Connection,
    signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>
  ): void {
    this.connection = connection;
    this.signTransaction = signTransaction;
  }
  
  /**
   * Check if executor is properly configured
   */
  isConfigured(): boolean {
    return this.connection !== null && this.signTransaction !== null;
  }
  
  // ============ Main Execution ============
  
  /**
   * Execute a swap with optimistic UI updates
   */
  async executeSwap(
    params: SwapParams,
    walletPublicKey: PublicKey,
    config: ExecutionConfig = {}
  ): Promise<ExecutionResult> {
    const {
      priorityLevel = 'medium',
      slippageBps = DEFAULT_SLIPPAGE_BPS,
      useCachedQuote = true,
      customPriorityFee,
      confirmationTimeout = DEFAULT_CONFIRMATION_TIMEOUT,
      routeStrategy = 'balanced',
      compareRoutes = false,
    } = config;
    
    if (!this.isConfigured()) {
      return {
        success: false,
        orderId: '',
        error: 'Executor not configured. Call configure() first.',
      };
    }
    
    const startTime = Date.now();
    const store = useTradingStore.getState();
    
    // Generate order ID
    const orderId = this.generateOrderId();
    
    // Create pending order
    const pendingOrder: PendingOrder = {
      id: orderId,
      type: 'market',
      side: params.side,
      amount: params.amount,
      status: 'pending',
      createdAt: Date.now(),
    };
    
    // 1. Add pending order to store (optimistic)
    store.addPendingOrder(pendingOrder);
    
    // 2. Apply optimistic balance change
    const optimisticChange = params.side === 'buy' ? -params.amount : params.amount;
    store.applyOptimisticBalance(optimisticChange);
    
    // Create rollback function
    const rollback = () => {
      store.updateOrderStatus(orderId, 'failed');
      store.rollbackOptimisticBalance();
    };
    
    // Track this execution
    this.pendingExecutions.set(orderId, {
      params,
      rollbackFn: rollback,
      startTime,
    });
    
    try {
      // 3. Get quote (use cached if available and fresh, or get best route)
      let quote: JupiterQuote | null = null;
      
      if (useCachedQuote) {
        quote = getCachedJupiterQuote(params.inputMint, params.outputMint, params.amount);
      }
      
      // If comparing routes, use liquidity layer to get best route
      if (!quote && compareRoutes) {
        try {
          const bestRoute = await getBestRoute(
            {
              inputMint: params.inputMint,
              outputMint: params.outputMint,
              amount: params.amount,
              slippageBps,
            },
            routeStrategy,
            true
          );
          
          if (bestRoute) {
            quote = bestRoute.quote as JupiterQuote;
          }
        } catch (error) {
          console.warn('[OptimisticExecution] Route comparison failed, falling back to simple quote:', error);
        }
      }
      
      // Fallback to simple quote if route comparison didn't work
      if (!quote) {
        quote = await getJupiterQuote(
          params.inputMint,
          params.outputMint,
          params.amount,
          slippageBps
        );
      }
      
      if (!quote) {
        throw new Error('Failed to get quote from Jupiter');
      }
      
      // Safety check: Validate token before execution
      const safetyCheck = await validateTokenBeforeSwap(params.outputMint);
      if (!safetyCheck.safe) {
        throw new Error(`Token safety check failed: ${safetyCheck.error || 'Unknown error'}`);
      }
      
      // Update order status
      store.updateOrderStatus(orderId, 'submitted');
      
      // 4. Get priority fee
      const priorityFee = customPriorityFee ?? await getSwapPriorityFee(priorityLevel);
      
      // 5. Get swap transaction
      const swapResult = await getJupiterSwapTransaction(quote, walletPublicKey, priorityFee);
      
      if (!swapResult) {
        throw new Error('Failed to get swap transaction from Jupiter');
      }
      
      // 5.5. Simulate transaction before execution (if backend available)
      try {
        const simResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8001'}/api/tx/simulate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transaction: swapResult.swapTransaction }),
        });
        
        if (simResponse.ok) {
          const simResult = await simResponse.json();
          if (!simResult.will_succeed) {
            throw new Error(simResult.error || 'Transaction simulation failed');
          }
          // Update compute units if simulation provided better estimate
          if (simResult.estimated_compute_units) {
            // Could re-fetch transaction with updated compute units
          }
        }
      } catch (simError) {
        // Simulation failed - log but continue (simulation is optional)
        console.warn('[OptimisticExecution] Simulation failed, proceeding anyway:', simError);
      }
      
      // 6. Sign and execute
      const txSignature = await executeJupiterSwap(
        this.connection!,
        swapResult.swapTransaction,
        this.signTransaction!
      );
      
      if (!txSignature) {
        throw new Error('Failed to execute swap transaction');
      }
      
      // 7. Confirm transaction
      const confirmed = await this.confirmTransaction(txSignature, confirmationTimeout);
      
      if (!confirmed) {
        throw new Error('Transaction confirmation timeout');
      }
      
      // 8. Success - update order status
      store.updateOrderStatus(orderId, 'filled', txSignature);
      
      // Clear from pending
      this.pendingExecutions.delete(orderId);
      
      const executionTime = Date.now() - startTime;
      console.log(`[OptimisticExecution] Swap executed in ${executionTime}ms`);
      
      return {
        success: true,
        orderId,
        txSignature,
        quote,
        executionTime,
      };
      
    } catch (error) {
      // Rollback on failure
      rollback();
      this.pendingExecutions.delete(orderId);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[OptimisticExecution] Swap failed:', errorMessage);
      
      store.updateOrderStatus(orderId, 'failed', undefined, errorMessage);
      
      return {
        success: false,
        orderId,
        error: errorMessage,
        executionTime: Date.now() - startTime,
      };
    }
  }
  
  /**
   * Execute a buy order (SOL -> Token)
   */
  async executeBuy(
    tokenMint: string,
    amountLamports: number,
    walletPublicKey: PublicKey,
    config?: ExecutionConfig
  ): Promise<ExecutionResult> {
    return this.executeSwap(
      {
        inputMint: SOL_MINT,
        outputMint: tokenMint,
        amount: amountLamports,
        side: 'buy',
      },
      walletPublicKey,
      config
    );
  }
  
  /**
   * Execute a sell order (Token -> SOL)
   */
  async executeSell(
    tokenMint: string,
    amountTokens: number,
    walletPublicKey: PublicKey,
    config?: ExecutionConfig
  ): Promise<ExecutionResult> {
    return this.executeSwap(
      {
        inputMint: tokenMint,
        outputMint: SOL_MINT,
        amount: amountTokens,
        side: 'sell',
      },
      walletPublicKey,
      config
    );
  }
  
  // ============ Transaction Confirmation ============
  
  private async confirmTransaction(
    signature: string,
    timeout: number
  ): Promise<boolean> {
    if (!this.connection) return false;
    
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const status = await this.connection.getSignatureStatus(signature);
        
        if (status?.value?.confirmationStatus === 'confirmed' ||
            status?.value?.confirmationStatus === 'finalized') {
          return true;
        }
        
        if (status?.value?.err) {
          console.error('[OptimisticExecution] Transaction error:', status.value.err);
          return false;
        }
        
        // Wait before next check
        await this.sleep(500);
        
      } catch (error) {
        console.warn('[OptimisticExecution] Confirmation check error:', error);
        await this.sleep(1000);
      }
    }
    
    return false;
  }
  
  // ============ Order Management ============
  
  /**
   * Cancel a pending order
   */
  cancelOrder(orderId: string): boolean {
    const pending = this.pendingExecutions.get(orderId);
    
    if (pending) {
      pending.rollbackFn();
      this.pendingExecutions.delete(orderId);
      useTradingStore.getState().updateOrderStatus(orderId, 'cancelled');
      return true;
    }
    
    return false;
  }
  
  /**
   * Get all pending order IDs
   */
  getPendingOrderIds(): string[] {
    return Array.from(this.pendingExecutions.keys());
  }
  
  /**
   * Check if an order is pending
   */
  isOrderPending(orderId: string): boolean {
    return this.pendingExecutions.has(orderId);
  }
  
  // ============ Utilities ============
  
  private generateOrderId(): string {
    return `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============ Singleton Instance ============

let executorInstance: OptimisticExecutor | null = null;

export function getOptimisticExecutor(): OptimisticExecutor {
  if (!executorInstance) {
    executorInstance = new OptimisticExecutor();
  }
  return executorInstance;
}

// ============ Convenience Functions ============

/**
 * Configure the optimistic executor
 */
export function configureOptimisticExecution(
  connection: Connection,
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>
): void {
  getOptimisticExecutor().configure(connection, signTransaction);
}

/**
 * Execute a buy with optimistic updates
 */
export async function optimisticBuy(
  tokenMint: string,
  amountLamports: number,
  walletPublicKey: PublicKey,
  config?: ExecutionConfig
): Promise<ExecutionResult> {
  return getOptimisticExecutor().executeBuy(
    tokenMint,
    amountLamports,
    walletPublicKey,
    config
  );
}

/**
 * Execute a sell with optimistic updates
 */
export async function optimisticSell(
  tokenMint: string,
  amountTokens: number,
  walletPublicKey: PublicKey,
  config?: ExecutionConfig
): Promise<ExecutionResult> {
  return getOptimisticExecutor().executeSell(
    tokenMint,
    amountTokens,
    walletPublicKey,
    config
  );
}

// ============ React Hook ============

import { useEffect, useCallback, useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';

export function useOptimisticExecution() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const executor = getOptimisticExecutor();
  
  const [isReady, setIsReady] = useState(false);
  
  // Configure executor when wallet connects
  useEffect(() => {
    if (connection && signTransaction) {
      executor.configure(connection, signTransaction);
      setIsReady(true);
    } else {
      setIsReady(false);
    }
  }, [connection, signTransaction]);
  
  const executeBuy = useCallback(async (
    tokenMint: string,
    amountLamports: number,
    config?: ExecutionConfig
  ): Promise<ExecutionResult> => {
    if (!publicKey) {
      return {
        success: false,
        orderId: '',
        error: 'Wallet not connected',
      };
    }
    
    return executor.executeBuy(tokenMint, amountLamports, publicKey, config);
  }, [publicKey]);
  
  const executeSell = useCallback(async (
    tokenMint: string,
    amountTokens: number,
    config?: ExecutionConfig
  ): Promise<ExecutionResult> => {
    if (!publicKey) {
      return {
        success: false,
        orderId: '',
        error: 'Wallet not connected',
      };
    }
    
    return executor.executeSell(tokenMint, amountTokens, publicKey, config);
  }, [publicKey]);
  
  const cancelOrder = useCallback((orderId: string) => {
    return executor.cancelOrder(orderId);
  }, []);
  
  return {
    isReady,
    executeBuy,
    executeSell,
    cancelOrder,
    getPendingOrderIds: () => executor.getPendingOrderIds(),
    isOrderPending: (id: string) => executor.isOrderPending(id),
  };
}

export default OptimisticExecutor;





