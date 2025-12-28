import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Play, 
  Pause, 
  RefreshCw, 
  Trash2, 
  AlertCircle,
  CheckCircle,
  Clock,
  Wifi,
  WifiOff
} from 'lucide-react';
import { ExchangeConnection, SyncSession } from '@/types/tradeSync';
import { cryptoSyncService } from '@/lib/services/cryptoSyncService';
import { credentialService } from '@/lib/services/credentialService';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';

export function SyncManagement() {
  const [connections, setConnections] = useState<ExchangeConnection[]>([]);
  const [syncSessions, setSyncSessions] = useState<SyncSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadConnections();
    loadSyncSessions();
  }, []);

  const loadConnections = async () => {
    try {
      const userConnections = await credentialService.getUserConnections();
      setConnections(userConnections);
    } catch (error) {
      console.error('Error loading connections:', error);
    }
  };

  const loadSyncSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('trade_sync_sessions')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const sessions: SyncSession[] = (data || []).map(session => ({
        id: session.id,
        connectionId: session.connection_id,
        startedAt: new Date(session.started_at),
        completedAt: session.completed_at ? new Date(session.completed_at) : undefined,
        syncType: session.sync_type,
        tradesSynced: session.trades_synced || 0,
        tradesUpdated: session.trades_updated || 0,
        syncDuration: session.sync_duration ? parseInt(session.sync_duration) : undefined,
        status: session.status
      }));

      setSyncSessions(sessions);
    } catch (error) {
      console.error('Error loading sync sessions:', error);
    }
  };

  const startSync = async (connectionId: string, type: 'historical' | 'realtime') => {
    setIsLoading(true);
    try {
      if (type === 'historical') {
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
        const endDate = new Date();
        await cryptoSyncService.syncHistoricalTrades(connectionId, startDate, endDate);
      } else {
        await cryptoSyncService.startRealtimeSync(connectionId, []);
      }
      
      // Refresh data
      await loadConnections();
      await loadSyncSessions();
    } catch (error) {
      console.error('Error starting sync:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const stopSync = async (connectionId: string) => {
    setIsLoading(true);
    try {
      await cryptoSyncService.stopRealtimeSync(connectionId);
      await loadConnections();
    } catch (error) {
      console.error('Error stopping sync:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteConnection = async (connectionId: string) => {
    if (!confirm('Are you sure you want to delete this connection?')) return;
    
    setIsLoading(true);
    try {
      await credentialService.deleteConnection(connectionId);
      await loadConnections();
    } catch (error) {
      console.error('Error deleting connection:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <Wifi className="h-4 w-4 text-green-500" />;
      case 'syncing':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'error':
        return <WifiOff className="h-4 w-4 text-red-500" />;
      default:
        return <WifiOff className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-800';
      case 'syncing':
        return 'bg-blue-100 text-blue-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSessionStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'running':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled':
        return <Pause className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Exchange Connections */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Wifi className="h-5 w-5" />
            <span>Exchange Connections</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {connections.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <WifiOff className="h-8 w-8 mx-auto mb-2" />
              <p>No connections yet</p>
              <p className="text-sm">Connect an exchange to start syncing trades</p>
            </div>
          ) : (
            <div className="space-y-3">
              {connections.map((connection) => (
                <div
                  key={connection.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(connection.syncStatus)}
                    <div>
                      <div className="font-medium capitalize">{connection.exchangeName}</div>
                      <div className="text-sm text-muted-foreground">
                        {connection.lastSyncAt 
                          ? `Last sync: ${format(connection.lastSyncAt, 'MMM dd, HH:mm')}`
                          : 'Never synced'
                        }
                      </div>
                      {connection.errorMessage && (
                        <div className="text-xs text-red-600 mt-1">
                          {connection.errorMessage}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Badge className={getStatusColor(connection.syncStatus)}>
                      {connection.syncStatus}
                    </Badge>
                    
                    <div className="flex space-x-1">
                      {connection.syncStatus === 'connected' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startSync(connection.id, 'historical')}
                            disabled={isLoading}
                          >
                            <Play className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startSync(connection.id, 'realtime')}
                            disabled={isLoading}
                          >
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                      
                      {connection.syncStatus === 'syncing' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => stopSync(connection.id)}
                          disabled={isLoading}
                        >
                          <Pause className="h-3 w-3" />
                        </Button>
                      )}
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteConnection(connection.id)}
                        disabled={isLoading}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <RefreshCw className="h-5 w-5" />
            <span>Sync Sessions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {syncSessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2" />
              <p>No sync sessions yet</p>
              <p className="text-sm">Start a sync to see session history</p>
            </div>
          ) : (
            <div className="space-y-3">
              {syncSessions.map((session) => (
                <div
                  key={session.id}
                  className="p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {getSessionStatusIcon(session.status)}
                      <span className="font-medium capitalize">{session.syncType} Sync</span>
                    </div>
                    <Badge variant="outline">
                      {session.status}
                    </Badge>
                  </div>
                  
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>
                      Started: {format(session.startedAt, 'MMM dd, HH:mm:ss')}
                    </div>
                    {session.completedAt && (
                      <div>
                        Completed: {format(session.completedAt, 'MMM dd, HH:mm:ss')}
                      </div>
                    )}
                    <div>
                      Trades: {session.tradesSynced} new, {session.tradesUpdated} updated
                    </div>
                    {session.syncDuration && (
                      <div>
                        Duration: {Math.round(session.syncDuration / 1000)}s
                      </div>
                    )}
                  </div>
                  
                  {session.status === 'running' && (
                    <div className="mt-2">
                      <Progress value={50} className="h-1" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
