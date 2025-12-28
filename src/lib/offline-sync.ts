import { createClient } from '@/lib/supabase/client';
import * as LZString from 'lz-string';

interface PendingOperation {
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  data: any;
  timestamp: number;
  version?: number;
}

type SyncStatus = 'idle' | 'syncing' | 'error';
type SyncCallback = (status: SyncStatus, pendingCount: number) => void;

class OfflineSyncService {
  private static instance: OfflineSyncService | null = null;
  private supabase = createClient();
  private isOnline: boolean;
  private syncInProgress = false;
  private syncCallbacks: Set<SyncCallback> = new Set();
  private status: SyncStatus = 'idle';
  private initialized = false;

  private constructor() {
    this.isOnline = typeof window !== 'undefined' ? window.navigator.onLine : true;
    if (typeof window !== 'undefined') {
      this.initialize();
    }
  }

  private initialize() {
    if (this.initialized) return;
    this.setupEventListeners();
    this.initialized = true;
  }

  public static getInstance(): OfflineSyncService {
    if (!OfflineSyncService.instance) {
      OfflineSyncService.instance = new OfflineSyncService();
    }
    return OfflineSyncService.instance;
  }

  private setupEventListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncPendingOperations();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.updateStatus('idle');
    });
  }

  public onSyncStatusChange(callback: SyncCallback) {
    this.syncCallbacks.add(callback);
    return () => this.syncCallbacks.delete(callback);
  }

  private updateStatus(status: SyncStatus) {
    this.status = status;
    const pendingCount = this.getPendingOperationsCount();
    this.syncCallbacks.forEach(callback => callback(status, pendingCount));
  }

  public async queueOperation(
    table: string,
    operation: 'insert' | 'update' | 'delete',
    data: any
  ): Promise<void> {
    // Get current version of the record if it exists
    let version = 1;
    if (operation !== 'insert' && data.id) {
      const { data: existingData } = await this.supabase
        .from(table)
        .select('version')
        .eq('id', data.id)
        .single();
      
      if (existingData) {
        version = existingData.version + 1;
      }
    }

    const pendingOp: PendingOperation = {
      id: crypto.randomUUID(),
      table,
      operation,
      data: { ...data, version },
      timestamp: Date.now(),
      version,
    };

    const pendingOps = this.getPendingOperations();
    pendingOps.push(pendingOp);
    this.savePendingOperations(pendingOps);

    if (this.isOnline) {
      await this.syncPendingOperations();
    }
  }

  private savePendingOperations(operations: PendingOperation[]): void {
    const compressed = LZString.compress(JSON.stringify(operations));
    localStorage.setItem('pendingOperations', compressed);
  }

  private getPendingOperations(): PendingOperation[] {
    const compressed = localStorage.getItem('pendingOperations');
    if (!compressed) return [];
    
    try {
      const decompressed = LZString.decompress(compressed);
      return decompressed ? JSON.parse(decompressed) : [];
    } catch (error) {
      console.error('Error decompressing pending operations:', error);
      return [];
    }
  }

  public async manualSync(): Promise<void> {
    if (!this.isOnline) {
      throw new Error('Cannot sync while offline');
    }
    return this.syncPendingOperations();
  }

  private async syncPendingOperations(): Promise<void> {
    if (this.syncInProgress || !this.isOnline) return;

    this.syncInProgress = true;
    this.updateStatus('syncing');
    const pendingOps = this.getPendingOperations();

    try {
      for (const op of pendingOps) {
        try {
          switch (op.operation) {
            case 'insert':
              await this.supabase.from(op.table).insert(op.data);
              break;

            case 'update': {
              // Check for conflicts
              const { data: currentData } = await this.supabase
                .from(op.table)
                .select('version')
                .eq('id', op.data.id)
                .single();

              if (currentData && currentData.version > (op.version || 1)) {
                // Conflict detected - fetch both versions
                const { data: serverData } = await this.supabase
                  .from(op.table)
                  .select('*')
                  .eq('id', op.data.id)
                  .single();

                // Merge changes (server wins on direct conflicts)
                const mergedData = this.mergeChanges(serverData, op.data);
                
                await this.supabase
                  .from(op.table)
                  .update({ ...mergedData, version: currentData.version + 1 })
                  .eq('id', op.data.id);
              } else {
                // No conflict - proceed with update
                await this.supabase
                  .from(op.table)
                  .update(op.data)
                  .eq('id', op.data.id);
              }
              break;
            }

            case 'delete':
              await this.supabase
                .from(op.table)
                .delete()
                .match({ id: op.data.id });
              break;
          }

          // Remove successful operation
          const remainingOps = this.getPendingOperations().filter(
            (pending) => pending.id !== op.id
          );
          this.savePendingOperations(remainingOps);
        } catch (error) {
          console.error(`Failed to sync operation: ${op.id}`, error);
          this.updateStatus('error');
          // Keep the operation in the queue for retry
        }
      }
      this.updateStatus('idle');
    } finally {
      this.syncInProgress = false;
    }
  }

  private mergeChanges(serverData: any, clientData: any): any {
    // Simple merge strategy: server wins on direct conflicts
    const merged = { ...clientData };
    
    // Preserve server timestamps
    if (serverData.updated_at) {
      merged.updated_at = serverData.updated_at;
    }
    
    // For arrays (like tags), combine both sets
    Object.keys(merged).forEach(key => {
      if (Array.isArray(merged[key]) && Array.isArray(serverData[key])) {
        merged[key] = [...new Set([...serverData[key], ...merged[key]])];
      }
    });

    return merged;
  }

  public getPendingOperationsCount(): number {
    // Ensure initialization on first count check
    if (!this.initialized && typeof window !== 'undefined') {
      this.initialize();
    }
    return this.getPendingOperations().length;
  }

  public isOffline(): boolean {
    // Ensure initialization on first check
    if (!this.initialized && typeof window !== 'undefined') {
      this.initialize();
    }
    return !this.isOnline;
  }

  public getStatus(): SyncStatus {
    // Ensure initialization on first status check
    if (!this.initialized && typeof window !== 'undefined') {
      this.initialize();
    }
    return this.status;
  }
}

// Create and export a single instance
let offlineSyncInstance: OfflineSyncService | null = null;

// Lazy initialization function
function getOfflineSync(): OfflineSyncService {
  if (!offlineSyncInstance) {
    offlineSyncInstance = OfflineSyncService.getInstance();
  }
  return offlineSyncInstance;
}

export const offlineSync = typeof window === 'undefined' 
  ? {
      getStatus: () => 'idle' as SyncStatus,
      isOffline: () => false,
      getPendingOperationsCount: () => 0,
      onSyncStatusChange: () => () => {},
      manualSync: async () => {},
      queueOperation: async () => {},
    }
  : getOfflineSync(); 