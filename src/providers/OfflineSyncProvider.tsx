import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { offlineSync } from '@/lib/offline-sync';

type SyncStatus = 'idle' | 'syncing' | 'error';

interface OfflineSyncContextType {
  isOffline: boolean;
  pendingOps: number;
  syncStatus: SyncStatus;
  manualSync: () => Promise<void>;
}

const OfflineSyncContext = createContext<OfflineSyncContextType | null>(null);

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
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

  // Don't render children until initialized
  if (!isInitialized) {
    return null;
  }

  return (
    <OfflineSyncContext.Provider
      value={{
        isOffline,
        pendingOps,
        syncStatus,
        manualSync: offlineSync.manualSync,
      }}
    >
      {children}
    </OfflineSyncContext.Provider>
  );
}

export function useOfflineSync() {
  const context = useContext(OfflineSyncContext);
  if (!context) {
    throw new Error('useOfflineSync must be used within an OfflineSyncProvider');
  }
  return context;
} 