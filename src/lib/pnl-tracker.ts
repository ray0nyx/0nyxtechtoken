/**
 * Real-time PnL Tracking Service
 * 
 * Tracks positions and calculates unrealized PnL in real-time.
 * 
 * Features:
 * - Position tracking
 * - Unrealized PnL calculation
 * - Performance metrics
 * - Real-time updates
 */

import { useTradingStore, type Position } from '@/stores/useTradingStore';

// ============ PnL Calculator ============

export class PnLTracker {
  /**
   * Calculate unrealized PnL for a position
   */
  static calculateUnrealizedPnL(position: Position): {
    unrealizedPnl: number;
    unrealizedPnlPercent: number;
  } {
    const priceChange = position.currentPrice - position.avgEntryPrice;
    const unrealizedPnl = priceChange * position.amount;
    const unrealizedPnlPercent =
      position.avgEntryPrice > 0
        ? (priceChange / position.avgEntryPrice) * 100
        : 0;
    
    return {
      unrealizedPnl,
      unrealizedPnlPercent,
    };
  }
  
  /**
   * Update position with current price
   */
  static updatePositionPrice(
    position: Position,
    currentPrice: number
  ): Position {
    const pnl = this.calculateUnrealizedPnL({
      ...position,
      currentPrice,
    });
    
    return {
      ...position,
      currentPrice,
      unrealizedPnl: pnl.unrealizedPnl,
      unrealizedPnlPercent: pnl.unrealizedPnlPercent,
    };
  }
  
  /**
   * Calculate total portfolio PnL
   */
  static calculateTotalPnL(positions: Position[]): {
    totalPnL: number;
    totalPnLPercent: number;
    totalValue: number;
  } {
    let totalPnL = 0;
    let totalCost = 0;
    let totalValue = 0;
    
    positions.forEach((position) => {
      const cost = position.avgEntryPrice * position.amount;
      const value = position.currentPrice * position.amount;
      
      totalCost += cost;
      totalValue += value;
      totalPnL += position.unrealizedPnl;
    });
    
    const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;
    
    return {
      totalPnL,
      totalPnLPercent,
      totalValue,
    };
  }
  
  /**
   * Get performance metrics
   */
  static getPerformanceMetrics(positions: Position[]): {
    winRate: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    sharpeRatio: number; // Simplified
  } {
    const winningPositions = positions.filter((p) => p.unrealizedPnl > 0);
    const losingPositions = positions.filter((p) => p.unrealizedPnl < 0);
    
    const winRate =
      positions.length > 0
        ? (winningPositions.length / positions.length) * 100
        : 0;
    
    const avgWin =
      winningPositions.length > 0
        ? winningPositions.reduce((sum, p) => sum + p.unrealizedPnl, 0) /
          winningPositions.length
        : 0;
    
    const avgLoss =
      losingPositions.length > 0
        ? Math.abs(
            losingPositions.reduce((sum, p) => sum + p.unrealizedPnl, 0) /
              losingPositions.length
          )
        : 0;
    
    const totalWins = winningPositions.reduce(
      (sum, p) => sum + p.unrealizedPnl,
      0
    );
    const totalLosses = Math.abs(
      losingPositions.reduce((sum, p) => sum + p.unrealizedPnl, 0)
    );
    
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0;
    
    // Simplified Sharpe ratio (would need more data for accurate calculation)
    const sharpeRatio = 0; // Placeholder
    
    return {
      winRate,
      avgWin,
      avgLoss,
      profitFactor,
      sharpeRatio,
    };
  }
}

import { useEffect } from 'react';
import { useTradingStore } from '@/stores/useTradingStore';

/**
 * Hook to track PnL for current positions
 */
export function usePnLTracking() {
  const positions = useTradingStore((state) => state.positions);
  const currentPrice = useTradingStore((state) => state.currentPrice);
  
  // Update positions with current price
  useEffect(() => {
    if (positions.length === 0 || currentPrice === 0) return;
    
    const store = useTradingStore.getState();
    
    positions.forEach((position) => {
      const updated = PnLTracker.updatePositionPrice(position, currentPrice);
      store.updatePosition(updated);
    });
  }, [currentPrice, positions.length]);
  
  const totalPnL = PnLTracker.calculateTotalPnL(positions);
  const metrics = PnLTracker.getPerformanceMetrics(positions);
  
  return {
    positions,
    totalPnL,
    metrics,
  };
}
