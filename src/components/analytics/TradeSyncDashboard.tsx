import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  TrendingUp,
  Activity,
  Settings
} from 'lucide-react';
import { ExchangeConnectionModal } from './ExchangeConnectionModal';
import { LiveTradeFeed } from './LiveTradeFeed';
import { SyncManagement } from './SyncManagement';
import { ExchangeConnection } from '@/types/tradeSync';
import { credentialService } from '@/lib/services/credentialService';
import { cryptoSyncService } from '@/lib/services/cryptoSyncService';

export function TradeSyncDashboard() {
  const [connections, setConnections] = useState<ExchangeConnection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showConnectionModal, setShowConnectionModal] = useState(false);

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    setIsLoading(true);
    try {
      const userConnections = await credentialService.getUserConnections();
      setConnections(userConnections);
    } catch (error) {
      console.error('Error loading connections:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectionAdded = (connectionId: string) => {
    loadConnections();
  };

  const getTotalConnections = () => connections.length;
  const getActiveConnections = () => connections.filter(conn => conn.syncStatus === 'connected').length;
  const getSyncingConnections = () => connections.filter(conn => conn.syncStatus === 'syncing').length;
  const getErrorConnections = () => connections.filter(conn => conn.syncStatus === 'error').length;

  const getHealthStatus = () => {
    const total = getTotalConnections();
    const active = getActiveConnections();
    const errors = getErrorConnections();

    if (total === 0) return { status: 'disconnected', color: 'text-gray-500' };
    if (errors === total) return { status: 'error', color: 'text-red-500' };
    if (active === total) return { status: 'healthy', color: 'text-green-500' };
    return { status: 'degraded', color: 'text-yellow-500' };
  };

  const healthStatus = getHealthStatus();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Trade Sync Dashboard</h2>
          <p className="text-muted-foreground">
            Connect your crypto exchanges and sync trades in real-time
          </p>
        </div>
        <Button onClick={() => setShowConnectionModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Connect Exchange
        </Button>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Wifi className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Total Connections</p>
                <p className="text-2xl font-bold">{getTotalConnections()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className={`h-4 w-4 rounded-full ${healthStatus.color.replace('text-', 'bg-')}`} />
              <div>
                <p className="text-sm font-medium">System Health</p>
                <p className="text-2xl font-bold capitalize">{healthStatus.status}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm font-medium">Active Sync</p>
                <p className="text-2xl font-bold">{getSyncingConnections()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <WifiOff className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-sm font-medium">Errors</p>
                <p className="text-2xl font-bold">{getErrorConnections()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      {connections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5" />
              <span>Quick Actions</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={loadConnections}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh Status
              </Button>
              
              {connections.some(conn => conn.syncStatus === 'connected') && (
                <Button
                  variant="outline"
                  onClick={() => {
                    // Start historical sync for all connected exchanges
                    connections
                      .filter(conn => conn.syncStatus === 'connected')
                      .forEach(conn => {
                        cryptoSyncService.syncHistoricalTrades(
                          conn.id,
                          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
                          new Date()
                        );
                      });
                  }}
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Sync All (7 days)
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="live-feed" className="space-y-4">
        <TabsList>
          <TabsTrigger value="live-feed" className="flex items-center space-x-2">
            <Activity className="h-4 w-4" />
            <span>Live Feed</span>
          </TabsTrigger>
          <TabsTrigger value="sync-management" className="flex items-center space-x-2">
            <Settings className="h-4 w-4" />
            <span>Sync Management</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="live-feed">
          <LiveTradeFeed 
            connections={connections} 
            onRefresh={loadConnections}
          />
        </TabsContent>

        <TabsContent value="sync-management">
          <SyncManagement />
        </TabsContent>
      </Tabs>

      {/* Connection Modal */}
      <ExchangeConnectionModal
        isOpen={showConnectionModal}
        onClose={() => setShowConnectionModal(false)}
        onConnectionAdded={handleConnectionAdded}
      />
    </div>
  );
}
