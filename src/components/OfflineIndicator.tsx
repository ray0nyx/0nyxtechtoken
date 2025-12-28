import { Wifi, WifiOff, Cloud, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useOfflineSync } from '@/providers/OfflineSyncProvider';

export function OfflineIndicator() {
  const { isOffline, pendingOps, syncStatus, manualSync } = useOfflineSync();
  const { toast } = useToast();

  const handleManualSync = async () => {
    if (isOffline) {
      toast({
        title: "Cannot sync",
        description: "You are currently offline",
        variant: "destructive",
      });
      return;
    }

    try {
      await manualSync();
      toast({
        title: "Sync complete",
        description: "All changes have been synchronized",
      });
    } catch (error) {
      toast({
        title: "Sync failed",
        description: "Failed to synchronize changes. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Don't render if no sync activity
  if (!isOffline && pendingOps === 0 && syncStatus === 'idle') return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2">
      <div className={`
        flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
        ${isOffline ? 'bg-yellow-500/10 text-yellow-500' : 
          syncStatus === 'error' ? 'bg-red-500/10 text-red-500' :
          'bg-blue-500/10 text-blue-500'}
      `}>
        {isOffline ? (
          <>
            <WifiOff className="h-4 w-4" />
            <span>Offline</span>
          </>
        ) : syncStatus === 'syncing' ? (
          <>
            <Cloud className="h-4 w-4 animate-pulse" />
            <span>Syncing {pendingOps} changes...</span>
          </>
        ) : syncStatus === 'error' ? (
          <>
            <AlertCircle className="h-4 w-4" />
            <span>Sync error</span>
          </>
        ) : pendingOps > 0 ? (
          <>
            <Cloud className="h-4 w-4" />
            <span>{pendingOps} pending changes</span>
          </>
        ) : (
          <>
            <Wifi className="h-4 w-4" />
            <span>Online</span>
          </>
        )}
      </div>

      {!isOffline && pendingOps > 0 && syncStatus !== 'syncing' && (
        <Button
          size="sm"
          variant="outline"
          className="flex items-center gap-2 rounded-full"
          onClick={handleManualSync}
        >
          <RefreshCw className="h-4 w-4" />
          Sync now
        </Button>
      )}
    </div>
  );
} 