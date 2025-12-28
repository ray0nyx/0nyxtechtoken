/**
 * Kraken Copy Trading Component
 * Manages copy trading functionality with Kraken accounts
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Copy, 
  Play, 
  Pause, 
  Settings, 
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { krakenService, type KrakenAccount } from '@/lib/services/krakenService';
import { useToast } from '@/components/ui/use-toast';

interface CopyTradingConfig {
  id: string;
  kraken_account_id: string;
  is_enabled: boolean;
  copy_percentage: number;
  max_position_size: number;
  risk_level: 'low' | 'medium' | 'high';
  symbols: string[];
  created_at: string;
  updated_at: string;
}

interface KrakenCopyTradingProps {
  accounts: KrakenAccount[];
}

export function KrakenCopyTrading({ accounts }: KrakenCopyTradingProps) {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<CopyTradingConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string>('');

  useEffect(() => {
    loadCopyTradingConfigs();
  }, []);

  const loadCopyTradingConfigs = async () => {
    try {
      setIsLoading(true);
      // This would typically fetch from your API
      // For now, we'll create mock data
      const mockConfigs: CopyTradingConfig[] = accounts.map(account => ({
        id: `config-${account.id}`,
        kraken_account_id: account.id,
        is_enabled: false,
        copy_percentage: 10,
        max_position_size: 1000,
        risk_level: 'medium',
        symbols: ['BTC/USD', 'ETH/USD'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
      setConfigs(mockConfigs);
    } catch (error) {
      console.error('Error loading copy trading configs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load copy trading configurations',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleCopyTrading = async (configId: string, enabled: boolean) => {
    try {
      // Update the configuration
      setConfigs(prev => prev.map(config => 
        config.id === configId 
          ? { ...config, is_enabled: enabled }
          : config
      ));

      toast({
        title: enabled ? 'Copy Trading Enabled' : 'Copy Trading Disabled',
        description: `Copy trading has been ${enabled ? 'enabled' : 'disabled'} for this account`,
      });
    } catch (error) {
      console.error('Error toggling copy trading:', error);
      toast({
        title: 'Error',
        description: 'Failed to update copy trading settings',
        variant: 'destructive'
      });
    }
  };

  const handleUpdateConfig = async (configId: string, updates: Partial<CopyTradingConfig>) => {
    try {
      setConfigs(prev => prev.map(config => 
        config.id === configId 
          ? { ...config, ...updates, updated_at: new Date().toISOString() }
          : config
      ));

      toast({
        title: 'Configuration Updated',
        description: 'Copy trading configuration has been updated',
      });
    } catch (error) {
      console.error('Error updating config:', error);
      toast({
        title: 'Error',
        description: 'Failed to update configuration',
        variant: 'destructive'
      });
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'bg-green-100 text-green-700 border-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'high': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getAccountName = (accountId: string) => {
    const account = accounts.find(acc => acc.id === accountId);
    return account ? account.kraken_user_id : 'Unknown Account';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Kraken Copy Trading
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Automatically copy trades from your Kraken accounts
          </p>
        </div>
        <Button
          onClick={() => setSelectedAccount('')}
          className="rounded-xl"
        >
          <Settings className="h-4 w-4 mr-2" />
          Configure New
        </Button>
      </div>

      {/* No Accounts Alert */}
      {accounts.length === 0 && (
        <Alert className="rounded-xl">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No Kraken accounts connected. Please connect a Kraken account first to enable copy trading.
          </AlertDescription>
        </Alert>
      )}

      {/* Copy Trading Configurations */}
      {configs.length > 0 && (
        <div className="space-y-4">
          <h4 className="font-medium text-slate-900 dark:text-white">
            Copy Trading Configurations ({configs.length})
          </h4>
          
          {configs.map((config) => (
            <Card key={config.id} className="rounded-xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/20 rounded-xl flex items-center justify-center">
                      <Copy className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        {getAccountName(config.kraken_account_id)}
                      </CardTitle>
                      <CardDescription>
                        Copy {config.copy_percentage}% of trades • Max: ${config.max_position_size}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getRiskColor(config.risk_level)}>
                      {config.risk_level.toUpperCase()}
                    </Badge>
                    <Switch
                      checked={config.is_enabled}
                      onCheckedChange={(enabled) => handleToggleCopyTrading(config.id, enabled)}
                    />
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-4">
                  {/* Configuration Settings */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Copy Percentage
                      </label>
                      <div className="flex items-center space-x-2">
                        <Slider
                          value={[config.copy_percentage]}
                          onValueChange={([value]) => handleUpdateConfig(config.id, { copy_percentage: value })}
                          max={100}
                          step={1}
                          className="flex-1"
                        />
                        <span className="text-sm text-slate-600 dark:text-slate-400 w-12">
                          {config.copy_percentage}%
                        </span>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Max Position Size ($)
                      </label>
                      <div className="flex items-center space-x-2">
                        <Slider
                          value={[config.max_position_size]}
                          onValueChange={([value]) => handleUpdateConfig(config.id, { max_position_size: value })}
                          max={10000}
                          step={100}
                          className="flex-1"
                        />
                        <span className="text-sm text-slate-600 dark:text-slate-400 w-16">
                          ${config.max_position_size}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Risk Level */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Risk Level
                    </label>
                    <div className="flex space-x-2">
                      {(['low', 'medium', 'high'] as const).map((risk) => (
                        <Button
                          key={risk}
                          variant={config.risk_level === risk ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleUpdateConfig(config.id, { risk_level: risk })}
                          className="rounded-xl"
                        >
                          {risk.charAt(0).toUpperCase() + risk.slice(1)}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Symbols */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Trading Symbols
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {config.symbols.map((symbol) => (
                        <Badge key={symbol} variant="outline" className="rounded-xl">
                          {symbol}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <div className="flex items-center space-x-2">
                      {config.is_enabled ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-sm font-medium text-slate-900 dark:text-white">
                        {config.is_enabled ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      Last updated: {new Date(config.updated_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Benefits */}
      <Alert className="rounded-xl">
        <Activity className="h-4 w-4" />
        <AlertDescription>
          <strong>Copy Trading Benefits:</strong>
          <ul className="mt-2 space-y-1 text-sm">
            <li>• Automatically replicate successful trading strategies</li>
            <li>• Risk management with position size limits</li>
            <li>• Real-time trade execution</li>
            <li>• Customizable copy percentages</li>
            <li>• Multiple risk levels for different strategies</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}

