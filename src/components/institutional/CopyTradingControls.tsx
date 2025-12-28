/**
 * Copy Trading Controls Component
 * Manage copy trading sessions and settings
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { 
  Play, 
  Pause, 
  Square, 
  Settings,
  TrendingUp,
  Target,
  Shield,
  DollarSign,
  AlertTriangle
} from 'lucide-react';

interface CopyTradingControlsProps {
  backtests: any[];
  exchanges: any[];
  selectedBacktest: string | null;
}

export function CopyTradingControls({ backtests, exchanges, selectedBacktest }: CopyTradingControlsProps) {
  const { toast } = useToast();
  
  const [isActive, setIsActive] = useState(false);
  const [settings, setSettings] = useState({
    maxPositionSize: 0.1,
    maxDailyLoss: 0.05,
    maxSlippage: 0.001,
    copyPercentage: 100,
    selectedExchanges: [] as string[],
    riskManagement: true
  });
  
  const handleToggleCopyTrading = async () => {
    if (!selectedBacktest) {
      toast({
        title: 'No Backtest Selected',
        description: 'Please select a backtest to copy trade.',
        variant: 'destructive'
      });
      return;
    }
    
    if (settings.selectedExchanges.length === 0) {
      toast({
        title: 'No Exchanges Selected',
        description: 'Please select at least one exchange for copy trading.',
        variant: 'destructive'
      });
      return;
    }
    
    try {
      const response = await fetch('/api/institutional/copy-trading/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          backtestId: selectedBacktest,
          isActive: !isActive,
          settings
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to toggle copy trading');
      }
      
      setIsActive(!isActive);
      
      toast({
        title: isActive ? 'Copy Trading Stopped' : 'Copy Trading Started',
        description: isActive 
          ? 'Copy trading has been stopped successfully.'
          : 'Copy trading has been started successfully.',
      });
      
    } catch (error) {
      console.error('Error toggling copy trading:', error);
      toast({
        title: 'Error',
        description: 'Failed to toggle copy trading. Please try again.',
        variant: 'destructive'
      });
    }
  };
  
  const handleExchangeToggle = (exchangeId: string) => {
    setSettings(prev => ({
      ...prev,
      selectedExchanges: prev.selectedExchanges.includes(exchangeId)
        ? prev.selectedExchanges.filter(id => id !== exchangeId)
        : [...prev.selectedExchanges, exchangeId]
    }));
  };
  
  const handleSettingChange = (field: string, value: number | boolean) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const selectedBacktestData = backtests.find(b => b.id === selectedBacktest);
  const activeExchanges = exchanges.filter(e => e.is_active);
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Copy Trading Controls
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Automatically replicate your backtest trades across connected exchanges
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Copy Trading Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-cyan-600" />
              <span>Copy Trading Status</span>
            </CardTitle>
            <CardDescription>
              Current copy trading session status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedBacktestData ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {selectedBacktestData.name}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Selected backtest
                    </p>
                  </div>
                  <Badge className={isActive ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-700 border-gray-200'}>
                    {isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Copy Percentage</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {settings.copyPercentage}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Selected Exchanges</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {settings.selectedExchanges.length}
                    </p>
                  </div>
                </div>
                
                <Button
                  onClick={handleToggleCopyTrading}
                  disabled={settings.selectedExchanges.length === 0}
                  className={`w-full ${
                    isActive
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 text-white border-0'
                  }`}
                >
                  {isActive ? (
                    <>
                      <Square className="w-4 h-4 mr-2" />
                      Stop Copy Trading
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Start Copy Trading
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  No Backtest Selected
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Please select a backtest from the results tab to enable copy trading.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Risk Management Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-cyan-600" />
              <span>Risk Management</span>
            </CardTitle>
            <CardDescription>
              Configure risk limits for copy trading
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="maxPositionSize">Max Position Size (%)</Label>
              <Input
                id="maxPositionSize"
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={settings.maxPositionSize}
                onChange={(e) => handleSettingChange('maxPositionSize', parseFloat(e.target.value))}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Maximum position size as percentage of account balance
              </p>
            </div>
            
            <div>
              <Label htmlFor="maxDailyLoss">Max Daily Loss (%)</Label>
              <Input
                id="maxDailyLoss"
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={settings.maxDailyLoss}
                onChange={(e) => handleSettingChange('maxDailyLoss', parseFloat(e.target.value))}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Maximum daily loss before stopping copy trading
              </p>
            </div>
            
            <div>
              <Label htmlFor="maxSlippage">Max Slippage (%)</Label>
              <Input
                id="maxSlippage"
                type="number"
                step="0.001"
                min="0"
                max="0.01"
                value={settings.maxSlippage}
                onChange={(e) => handleSettingChange('maxSlippage', parseFloat(e.target.value))}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Maximum acceptable slippage per trade
              </p>
            </div>
            
            <div>
              <Label htmlFor="copyPercentage">Copy Percentage (%)</Label>
              <Input
                id="copyPercentage"
                type="number"
                step="1"
                min="1"
                max="100"
                value={settings.copyPercentage}
                onChange={(e) => handleSettingChange('copyPercentage', parseInt(e.target.value))}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Percentage of backtest position size to copy
              </p>
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="riskManagement">Enable Risk Management</Label>
              <Switch
                id="riskManagement"
                checked={settings.riskManagement}
                onCheckedChange={(checked) => handleSettingChange('riskManagement', checked)}
              />
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Exchange Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="w-5 h-5 text-cyan-600" />
            <span>Exchange Selection</span>
          </CardTitle>
          <CardDescription>
            Select which exchanges to copy trades to
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeExchanges.length === 0 ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No Active Exchanges
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Please link and activate at least one exchange to enable copy trading.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeExchanges.map((exchange) => (
                <div
                  key={exchange.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    settings.selectedExchanges.includes(exchange.id)
                      ? 'border-cyan-400 bg-cyan-50 dark:bg-cyan-900/20'
                      : 'border-gray-200 dark:border-gray-900 hover:border-gray-300'
                  }`}
                  onClick={() => handleExchangeToggle(exchange.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white capitalize">
                        {exchange.exchange_name}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Last sync: {new Date(exchange.last_sync_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 ${
                      settings.selectedExchanges.includes(exchange.id)
                        ? 'bg-cyan-500 border-cyan-500'
                        : 'border-gray-300'
                    }`}>
                      {settings.selectedExchanges.includes(exchange.id) && (
                        <div className="w-full h-full rounded-full bg-white scale-50"></div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Copy Trading Statistics */}
      {isActive && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-cyan-600" />
              <span>Copy Trading Statistics</span>
            </CardTitle>
            <CardDescription>
              Real-time performance metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">12</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Trades Copied</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">$2,450</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total P&L</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">85%</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Success Rate</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">0.3%</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Avg Slippage</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
