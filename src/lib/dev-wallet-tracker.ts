/**
 * Dev Wallet Tracker
 * 
 * Identifies developer/creator wallets and tracks their activity.
 * 
 * Features:
 * - Creator detection from Pump.fun API
 * - Dev activity monitoring
 * - Insider heuristics (early buyers)
 * - Rug pull detection
 */

import { PumpFunCoin } from './pump-fun-service';

// ============ Types ============

export interface CreatorInfo {
  walletAddress: string;
  tokenAddress: string;
  holdings: number;
  holdingsPercent: number;
  totalPnL: number;
  recentActivity: 'buying' | 'selling' | 'holding' | 'unknown';
  lastActivityTime: number;
}

export interface InsiderInfo {
  walletAddress: string;
  tokenAddress: string;
  buyTime: number; // Time since token creation (ms)
  isEarlyBuyer: boolean; // Bought within 1 minute
  isStillHolding: boolean;
  currentHoldings: number;
  estimatedPnL: number;
}

export interface DevActivityAlert {
  type: 'rug_pull' | 'large_sell' | 'suspicious_activity';
  tokenAddress: string;
  creator: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
}

// ============ Dev Wallet Tracker ============

export class DevWalletTracker {
  private creatorCache: Map<string, CreatorInfo> = new Map();
  private insiderCache: Map<string, InsiderInfo[]> = new Map(); // token -> insiders
  
  /**
   * Get creator info for a token
   */
  async getCreatorInfo(tokenAddress: string, coinData?: PumpFunCoin): Promise<CreatorInfo | null> {
    // Check cache
    if (this.creatorCache.has(tokenAddress)) {
      return this.creatorCache.get(tokenAddress)!;
    }
    
    // Fetch from Pump.fun API if not provided
    if (!coinData) {
      const { fetchPumpFunCoinDetails } = await import('./pump-fun-service');
      coinData = await fetchPumpFunCoinDetails(tokenAddress);
    }
    
    if (!coinData || !coinData.creator) {
      return null;
    }
    
    const creatorInfo: CreatorInfo = {
      walletAddress: coinData.creator,
      tokenAddress,
      holdings: 0, // Would need to fetch from on-chain
      holdingsPercent: 0,
      totalPnL: 0,
      recentActivity: 'unknown',
      lastActivityTime: 0,
    };
    
    this.creatorCache.set(tokenAddress, creatorInfo);
    return creatorInfo;
  }
  
  /**
   * Track creator's swap activity
   */
  trackCreatorSwap(
    tokenAddress: string,
    creatorWallet: string,
    side: 'buy' | 'sell',
    amount: number,
    timestamp: number
  ): DevActivityAlert | null {
    const creator = this.creatorCache.get(tokenAddress);
    if (!creator || creator.walletAddress !== creatorWallet) {
      return null;
    }
    
    // Update activity
    creator.recentActivity = side === 'buy' ? 'buying' : 'selling';
    creator.lastActivityTime = timestamp;
    
    // Check for rug pull (creator selling > 50% of holdings)
    if (side === 'sell' && creator.holdings > 0) {
      const sellPercent = (amount / creator.holdings) * 100;
      if (sellPercent > 50) {
        return {
          type: 'rug_pull',
          tokenAddress,
          creator: creatorWallet,
          message: `Creator sold ${sellPercent.toFixed(1)}% of holdings - possible rug pull`,
          severity: 'critical',
          timestamp,
        };
      } else if (sellPercent > 25) {
        return {
          type: 'large_sell',
          tokenAddress,
          creator: creatorWallet,
          message: `Creator sold ${sellPercent.toFixed(1)}% of holdings`,
          severity: 'high',
          timestamp,
        };
      }
    }
    
    return null;
  }
  
  /**
   * Identify early buyers (insiders)
   */
  identifyInsiders(
    tokenAddress: string,
    creationTime: number,
    trades: Array<{ trader: string; timestamp: number; side: 'buy' | 'sell'; amount: number }>
  ): InsiderInfo[] {
    const insiders: InsiderInfo[] = [];
    const EARLY_BUYER_THRESHOLD_MS = 60_000; // 1 minute
    
    trades.forEach((trade) => {
      if (trade.side !== 'buy') return;
      
      const buyTime = trade.timestamp - creationTime;
      const isEarlyBuyer = buyTime < EARLY_BUYER_THRESHOLD_MS;
      
      // Check if still holding (simplified - would need on-chain check)
      const isStillHolding = true; // Would need to track sells
      
      insiders.push({
        walletAddress: trade.trader,
        tokenAddress,
        buyTime,
        isEarlyBuyer,
        isStillHolding,
        currentHoldings: trade.amount,
        estimatedPnL: 0, // Would calculate from current price
      });
    });
    
    this.insiderCache.set(tokenAddress, insiders);
    return insiders;
  }
  
  /**
   * Get insider concentration (percentage of supply held by early buyers)
   */
  getInsiderConcentration(tokenAddress: string): number {
    const insiders = this.insiderCache.get(tokenAddress) || [];
    const totalInsiderHoldings = insiders.reduce((sum, insider) => sum + insider.currentHoldings, 0);
    
    // Would need total supply to calculate percentage
    // For now, return relative concentration
    return insiders.length > 0 ? totalInsiderHoldings : 0;
  }
}

// Singleton instance
let devTrackerInstance: DevWalletTracker | null = null;

export function getDevWalletTracker(): DevWalletTracker {
  if (!devTrackerInstance) {
    devTrackerInstance = new DevWalletTracker();
  }
  return devTrackerInstance;
}
