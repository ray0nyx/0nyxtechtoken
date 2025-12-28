import { useState, useEffect } from 'react';
import { offlineSync } from '@/lib/offline-sync';

type SyncStatus = 'idle' | 'syncing' | 'error';

export function useOfflineSync() {
  const [isOffline, setIsOffline] = useState(false);
  const [pendingOps, setPendingOps] = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Initialize state
    setIsOffline(!navigator.onLine);
    setPendingOps(offlineSync.getPendingOperationsCount());
    setSyncStatus(offlineSync.getStatus());
    setIsInitialized(true);

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Update pending operations count and sync status
    const unsubscribe = offlineSync.onSyncStatusChange((status, count) => {
      setSyncStatus(status);
      setPendingOps(count);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  return {
    isOffline,
    pendingOps,
    syncStatus,
    isInitialized,
    manualSync: offlineSync.manualSync,
  };
} 