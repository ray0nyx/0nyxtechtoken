/**
 * Real-time Data Sync Component
 * 
 * Ensures all backend changes are immediately reflected in the UI.
 * This component listens to WebSocket messages and updates the UI state accordingly.
 * 
 * Key feature: Backend changes → WebSocket → UI update (like axiom.trade)
 */

import { useEffect } from 'react';
import { useTradingStore } from '@/stores/useTradingStore';
import { useTradingWebSocket } from '@/lib/trading-websocket';
import { motion, AnimatePresence } from 'framer-motion';

interface RealtimeDataSyncProps {
  tokenAddress: string | null;
  timeframes?: string[];
}

export default function RealtimeDataSync({
  tokenAddress,
  timeframes = ['1m', '5m', '15m', '1h'],
}: RealtimeDataSyncProps) {
  const { isConnected, subscribe, unsubscribe } = useTradingWebSocket(tokenAddress || undefined, timeframes);
  
  // Subscribe to token when it changes
  useEffect(() => {
    if (tokenAddress && isConnected) {
      subscribe(tokenAddress, timeframes);
      
      return () => {
        unsubscribe(tokenAddress);
      };
    }
  }, [tokenAddress, isConnected, subscribe, unsubscribe, timeframes.join(',')]);
  
  // This component ensures WebSocket connection is maintained
  // All message handling and UI updates are done in trading-websocket.ts
  // which automatically updates the Zustand store, triggering React re-renders
  
  // Visual indicator for real-time connection status
  return (
    <AnimatePresence>
      {isConnected && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="fixed bottom-4 right-4 z-50 px-3 py-1.5 bg-green-500/20 border border-green-500/50 rounded-lg backdrop-blur-sm"
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-green-400 font-medium">Live</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
