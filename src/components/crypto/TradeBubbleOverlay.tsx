/**
 * Trade Bubble Overlay Component
 * 
 * Displays real-time trade bubbles on the chart with animations.
 * Similar to axiom.trade's trade visualization.
 * 
 * Features:
 * - Animated trade bubbles (buy/sell)
 * - Position based on trade price and time
 * - Fade out animation
 * - Trade size visualization
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTradingStore, type Trade } from '@/stores/useTradingStore';
import { cn } from '@/lib/utils';

interface TradeBubble {
  id: string;
  trade: Trade;
  x: number; // Chart X position (0-100%)
  y: number; // Chart Y position (0-100%)
  timestamp: number;
}

interface TradeBubbleOverlayProps {
  chartContainerRef: React.RefObject<HTMLDivElement>;
  chartWidth: number;
  chartHeight: number;
  priceRange: { min: number; max: number };
  timeRange: { start: number; end: number };
  className?: string;
}

export default function TradeBubbleOverlay({
  chartContainerRef,
  chartWidth,
  chartHeight,
  priceRange,
  timeRange,
  className,
}: TradeBubbleOverlayProps) {
  const recentTrades = useTradingStore((state) => state.recentTrades);
  const [bubbles, setBubbles] = useState<TradeBubble[]>([]);
  const bubblesRef = useRef<Map<string, TradeBubble>>(new Map());
  
  // Convert trades to bubbles
  useEffect(() => {
    if (recentTrades.length === 0 || chartWidth === 0 || chartHeight === 0) {
      return;
    }
    
    const newBubbles: TradeBubble[] = [];
    const now = Date.now();
    
    // Only show trades from last 30 seconds
    const recentTradesFiltered = recentTrades.filter(
      (trade) => now - trade.timestamp < 30_000
    );
    
    recentTradesFiltered.forEach((trade) => {
      // Calculate position based on time and price
      const timePercent = ((trade.timestamp - timeRange.start) / (timeRange.end - timeRange.start)) * 100;
      const pricePercent = ((trade.priceUsd - priceRange.min) / (priceRange.max - priceRange.min)) * 100;
      
      // Clamp to chart bounds
      const x = Math.max(0, Math.min(100, timePercent));
      const y = Math.max(0, Math.min(100, 100 - pricePercent)); // Invert Y (chart Y is top-down)
      
      const bubble: TradeBubble = {
        id: trade.signature,
        trade,
        x,
        y,
        timestamp: trade.timestamp,
      };
      
      // Only add if not already present
      if (!bubblesRef.current.has(trade.signature)) {
        newBubbles.push(bubble);
        bubblesRef.current.set(trade.signature, bubble);
      }
    });
    
    if (newBubbles.length > 0) {
      setBubbles((prev) => [...prev, ...newBubbles]);
    }
    
    // Remove old bubbles (older than 5 seconds)
    setBubbles((prev) =>
      prev.filter((bubble) => {
        const age = now - bubble.timestamp;
        if (age > 5000) {
          bubblesRef.current.delete(bubble.id);
          return false;
        }
        return true;
      })
    );
  }, [recentTrades, chartWidth, chartHeight, priceRange, timeRange]);
  
  return (
    <div
      className={cn('absolute inset-0 pointer-events-none z-10', className)}
      style={{ width: chartWidth, height: chartHeight }}
    >
      <AnimatePresence>
        {bubbles.map((bubble) => {
          const isBuy = bubble.trade.side === 'buy';
          const size = Math.min(8, Math.max(4, Math.log10(bubble.trade.amountSol + 1) * 2));
          
          return (
            <motion.div
              key={bubble.id}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute"
              style={{
                left: `${bubble.x}%`,
                top: `${bubble.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <motion.div
                className={cn(
                  'rounded-full border-2',
                  isBuy ? 'bg-green-500/20 border-green-500' : 'bg-red-500/20 border-red-500'
                )}
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                }}
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [1, 0.5, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeOut',
                }}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
