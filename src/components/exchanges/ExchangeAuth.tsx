/**
 * Unified Exchange Authentication Component
 * Handles OAuth authentication for multiple exchanges (Kraken, Coinbase)
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ExternalLink, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  TrendingUp,
  DollarSign,
  Activity,
  AlertTriangle,
  Zap
} from 'lucide-react';
import { krakenService, type KrakenAccount } from '@/lib/services/krakenService';
import { coinbaseService, type CoinbaseAccount } from '@/lib/services/coinbaseService';
import { useToast } from '@/components/ui/use-toast';

interface ExchangeAuthProps {
  onAccountConnected?: (exchange: string, account: any) => void;
  onAccountDisconnected?: (exchange: string, accountId: string) => void;
}

interface ExchangeConfig {
  name: string;
  icon: React.ReactNode;
  color: string;
  service: any;
  accounts: any[];
  loadAccounts: () => Promise<any[]>;
}

export function ExchangeAuth({ onAccountConnected, onAccountDisconnected }: ExchangeAuthProps) {
  const { toast } = useToast();
  const [krakenAccounts, setKrakenAccounts] = useState<KrakenAccount[]>([]);
  const [coinbaseAccounts, setCoinbaseAccounts] = useState<CoinbaseAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [connectingExchange, setConnectingExchange] = useState<string | null>(null);

  const exchanges: ExchangeConfig[] = [
    {
      name: 'Kraken',
      icon: <DollarSign className="h-5 w-5" />,
      color: 'orange',
      service: krakenService,
      accounts: krakenAccounts,
      loadAccounts: () => krakenService.getKrakenAccounts('current-user-id')
    },
    {
      name: 'Coinbase',
      icon: <Zap className="h-5 w-5" />,
      color: 'blue',
      service: coinbaseService,
      accounts: coinbaseAccounts,
      loadAccounts: () => coinbaseService.getCoinbaseAccounts('current-user-id')
    }
  ];

  useEffect(() => {
    loadAllAccounts();
  }, []);

  const loadAllAccounts = async () => {
    try {
      setIsLoading(true);
      const [kraken, coinbase] = await Promise.all([
        krakenService.getKrakenAccounts('current-user-id'),
        coinbaseService.getCoinbaseAccounts('current-user-id')
      ]);
      setKrakenAccounts(kraken);
      setCoinbaseAccounts(coinbase);
    } catch (error) {
      console.error('Error loading accounts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load exchange accounts',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async (exchange: ExchangeConfig) => {
    try {
      setConnectingExchange(exchange.name);
      const authUrl = exchange.service.generateAuthUrl();
      window.location.href = authUrl;
    } catch (error) {
      console.error(`Error initiating ${exchange.name} connection:`, error);
      toast({
        title: 'Error',
        description: `Failed to initiate ${exchange.name} connection`,
        variant: 'destructive'
      });
    } finally {
      setConnectingExchange(null);
    }
  };

  const handleDisconnect = async (exchange: ExchangeConfig, accountId: string) => {
    try {
      await exchange.service.disconnectAccount(accountId);
      
      if (exchange.name === 'Kraken') {
        setKrakenAccounts(prev => prev.filter(acc => acc.id !== accountId));
      } else if (exchange.name === 'Coinbase') {
        setCoinbaseAccounts(prev => prev.filter(acc => acc.id !== accountId));
      }
      
      onAccountDisconnected?.(exchange.name, accountId);
      
      toast({
        title: 'Account Disconnected',
        description: `${exchange.name} account has been disconnected successfully`,
      });
    } catch (error) {
      console.error('Error disconnecting account:', error);
      toast({
        title: 'Error',
        description: 'Failed to disconnect account',
        variant: 'destructive'
      });
    }
  };

  const handleSyncTrades = async (exchange: ExchangeConfig, accountId: string) => {
    try {
      setIsLoading(true);
      const result = await exchange.service.syncTrades(accountId);
      
      toast({
        title: 'Trades Synced',
        description: `Synced ${result.synced} trades (${result.new_trades} new, ${result.updated_trades} updated)`,
      });
    } catch (error) {
      console.error('Error syncing trades:', error);
      toast({
        title: 'Error',
        description: 'Failed to sync trades',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200';
  };

  const getExchangeColor = (color: string) => {
    const colors = {
      orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/20',
      blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/20'
    };
    return colors[color as keyof typeof colors] || 'bg-gray-100 text-gray-600';
  };

  const totalAccounts = krakenAccounts.length + coinbaseAccounts.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Exchange Integration
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Connect your exchange accounts for trade syncing and copy trading
          </p>
        </div>
        <Button
          onClick={loadAllAccounts}
          disabled={isLoading}
          variant="outline"
          className="rounded-xl"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Exchange Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {exchanges.map((exchange) => (
          <Card key={exchange.name} className="rounded-xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getExchangeColor(exchange.color)}`}>
                    {exchange.icon}
                  </div>
                  <div>
                    <CardTitle className="text-base">{exchange.name}</CardTitle>
                    <CardDescription>
                      {exchange.accounts.length} account{exchange.accounts.length !== 1 ? 's' : ''} connected
                    </CardDescription>
                  </div>
                </div>
                <Button
                  onClick={() => handleConnect(exchange)}
                  disabled={connectingExchange === exchange.name}
                  className="rounded-xl"
                >
                  {connectingExchange === exchange.name ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ExternalLink className="h-4 w-4 mr-2" />
                  )}
                  {connectingExchange === exchange.name ? 'Connecting...' : 'Connect'}
                </Button>
              </div>
            </CardHeader>
            
            <CardContent>
              {exchange.accounts.length > 0 ? (
                <div className="space-y-3">
                  {exchange.accounts.map((account) => (
                    <div key={account.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                          {account.is_active ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span className="text-sm font-medium text-slate-900 dark:text-white">
                            {account.kraken_user_id || account.coinbase_user_id}
                          </span>
                        </div>
                        <Badge className={getStatusColor(account.is_active)}>
                          {account.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSyncTrades(exchange, account.id)}
                          disabled={isLoading}
                          className="rounded-xl"
                        >
                          <Activity className="h-3 w-3 mr-1" />
                          Sync
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDisconnect(exchange, account.id)}
                          className="rounded-xl"
                        >
                          Disconnect
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className={`w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center ${getExchangeColor(exchange.color)}`}>
                    {exchange.icon}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                    No {exchange.name} accounts connected
                  </p>
                  <Button
                    onClick={() => handleConnect(exchange)}
                    disabled={connectingExchange === exchange.name}
                    size="sm"
                    className="rounded-xl"
                  >
                    Connect {exchange.name}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary Stats */}
      {totalAccounts > 0 && (
        <Card className="rounded-xl">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {totalAccounts}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Total Accounts
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {krakenAccounts.length}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Kraken Accounts
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {coinbaseAccounts.length}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Coinbase Accounts
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Benefits */}
      <Alert className="rounded-xl">
        <TrendingUp className="h-4 w-4" />
        <AlertDescription>
          <strong>Exchange Integration Benefits:</strong>
          <ul className="mt-2 space-y-1 text-sm">
            <li>• OAuth-only authentication for enhanced security</li>
            <li>• Automatic trade syncing from connected accounts</li>
            <li>• Real-time market data for backtesting</li>
            <li>• Copy trading capabilities across exchanges</li>
            <li>• Portfolio balance monitoring</li>
            <li>• Historical trade analysis</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}

