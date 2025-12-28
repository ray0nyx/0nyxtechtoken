/**
 * Kraken Authentication Component
 * Handles Kraken OAuth login and account management
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
  AlertTriangle
} from 'lucide-react';
import { krakenService, type KrakenAccount, type KrakenBalance } from '@/lib/services/krakenService';
import { useToast } from '@/components/ui/use-toast';

interface KrakenAuthProps {
  onAccountConnected?: (account: KrakenAccount) => void;
  onAccountDisconnected?: (accountId: string) => void;
}

export function KrakenAuth({ onAccountConnected, onAccountDisconnected }: KrakenAuthProps) {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<KrakenAccount[]>([]);
  const [balances, setBalances] = useState<Record<string, KrakenBalance[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setIsLoading(true);
      const userAccounts = await krakenService.getKrakenAccounts('current-user-id'); // You'll need to get actual user ID
      setAccounts(userAccounts);
      
      // Load balances for each account
      for (const account of userAccounts) {
        try {
          const accountBalances = await krakenService.getAccountBalance(account.id);
          setBalances(prev => ({ ...prev, [account.id]: accountBalances }));
        } catch (error) {
          console.error(`Error loading balance for account ${account.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load Kraken accounts',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      const authUrl = krakenService.generateAuthUrl();
      window.location.href = authUrl;
    } catch (error) {
      console.error('Error initiating Kraken connection:', error);
      toast({
        title: 'Error',
        description: 'Failed to initiate Kraken connection',
        variant: 'destructive'
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async (accountId: string) => {
    try {
      await krakenService.disconnectAccount(accountId);
      setAccounts(prev => prev.filter(acc => acc.id !== accountId));
      setBalances(prev => {
        const newBalances = { ...prev };
        delete newBalances[accountId];
        return newBalances;
      });
      
      onAccountDisconnected?.(accountId);
      
      toast({
        title: 'Account Disconnected',
        description: 'Kraken account has been disconnected successfully',
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

  const handleSyncTrades = async (accountId: string) => {
    try {
      setIsLoading(true);
      const result = await krakenService.syncTrades(accountId);
      
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

  const formatBalance = (balance: number) => {
    return balance.toFixed(8).replace(/\.?0+$/, '');
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Kraken Integration
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Connect your Kraken account for trade syncing and market data
          </p>
        </div>
        <Button
          onClick={handleConnect}
          disabled={isConnecting}
          className="rounded-xl"
        >
          {isConnecting ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <ExternalLink className="h-4 w-4 mr-2" />
          )}
          {isConnecting ? 'Connecting...' : 'Connect Kraken'}
        </Button>
      </div>

      {/* Connected Accounts */}
      {accounts.length > 0 && (
        <div className="space-y-4">
          <h4 className="font-medium text-slate-900 dark:text-white">
            Connected Accounts ({accounts.length})
          </h4>
          
          {accounts.map((account) => (
            <Card key={account.id} className="rounded-xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/20 rounded-xl flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        Kraken Account
                      </CardTitle>
                      <CardDescription>
                        ID: {account.kraken_user_id}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getStatusColor(account.is_active)}>
                      {account.is_active ? (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      ) : (
                        <XCircle className="h-3 w-3 mr-1" />
                      )}
                      {account.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnect(account.id)}
                      className="rounded-xl"
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-4">
                  {/* Account Info */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-600 dark:text-slate-400">Connected:</span>
                      <span className="ml-2 text-slate-900 dark:text-white">
                        {new Date(account.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-600 dark:text-slate-400">Permissions:</span>
                      <span className="ml-2 text-slate-900 dark:text-white">
                        {account.permissions.join(', ')}
                      </span>
                    </div>
                  </div>

                  {/* Account Balance */}
                  {balances[account.id] && (
                    <div>
                      <h5 className="font-medium text-slate-900 dark:text-white mb-2">
                        Account Balance
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {balances[account.id]
                          .filter(balance => balance.total > 0)
                          .slice(0, 6)
                          .map((balance) => (
                            <div
                              key={balance.asset}
                              className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded-lg"
                            >
                              <span className="text-sm font-medium text-slate-900 dark:text-white">
                                {balance.asset}
                              </span>
                              <span className="text-sm text-slate-600 dark:text-slate-400">
                                {formatBalance(balance.total)}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSyncTrades(account.id)}
                      disabled={isLoading}
                      className="rounded-xl"
                    >
                      <Activity className="h-4 w-4 mr-2" />
                      Sync Trades
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadAccounts()}
                      disabled={isLoading}
                      className="rounded-xl"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* No Accounts State */}
      {accounts.length === 0 && !isLoading && (
        <Card className="rounded-xl">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <DollarSign className="h-8 w-8 text-orange-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              No Kraken Accounts Connected
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
              Connect your Kraken account to sync trades, access market data, and enable copy trading features.
            </p>
            <Button onClick={handleConnect} disabled={isConnecting} className="rounded-xl">
              <ExternalLink className="h-4 w-4 mr-2" />
              Connect Kraken Account
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Benefits */}
      <Alert className="rounded-xl">
        <TrendingUp className="h-4 w-4" />
        <AlertDescription>
          <strong>Kraken Integration Benefits:</strong>
          <ul className="mt-2 space-y-1 text-sm">
            <li>• Automatic trade syncing from your Kraken account</li>
            <li>• Real-time market data for backtesting</li>
            <li>• Copy trading capabilities</li>
            <li>• Portfolio balance monitoring</li>
            <li>• Historical trade analysis</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}

