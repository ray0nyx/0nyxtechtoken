/**
 * Risk Management Component
 * Advanced risk management controls for institutional trading
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { 
  Shield, 
  AlertTriangle, 
  Target, 
  DollarSign,
  TrendingDown,
  Clock,
  Settings,
  Save
} from 'lucide-react';

interface RiskManagementProps {
  exchanges: any[];
}

export function RiskManagement({ exchanges }: RiskManagementProps) {
  const { toast } = useToast();
  
  const [riskSettings, setRiskSettings] = useState({
    // Portfolio-level risk limits
    maxPortfolioDrawdown: 0.15,
    maxDailyLoss: 0.05,
    maxWeeklyLoss: 0.10,
    maxMonthlyLoss: 0.20,
    
    // Position-level risk limits
    maxPositionSize: 0.10,
    maxSectorExposure: 0.30,
    maxCorrelationExposure: 0.50,
    
    // Trading limits
    maxTradesPerDay: 50,
    maxTradesPerHour: 10,
    maxSlippage: 0.001,
    maxCommission: 0.002,
    
    // Advanced risk controls
    enableStopLoss: true,
    enableTakeProfit: true,
    enableTrailingStop: false,
    enablePositionSizing: true,
    enableCorrelationFilter: true,
    enableVolatilityFilter: true,
    
    // Exchange-specific limits
    exchangeLimits: exchanges.reduce((acc, exchange) => ({
      ...acc,
      [exchange.id]: {
        maxDailyVolume: 10000,
        maxPositionSize: 0.05,
        enabled: true
      }
    }), {})
  });
  
  const handleSettingChange = (field: string, value: number | boolean) => {
    setRiskSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const handleExchangeLimitChange = (exchangeId: string, field: string, value: number | boolean) => {
    setRiskSettings(prev => ({
      ...prev,
      exchangeLimits: {
        ...prev.exchangeLimits,
        [exchangeId]: {
          ...prev.exchangeLimits[exchangeId],
          [field]: value
        }
      }
    }));
  };
  
  const saveRiskSettings = async () => {
    try {
      const response = await fetch('/api/institutional/risk-management/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(riskSettings),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save risk settings');
      }
      
      toast({
        title: 'Risk Settings Saved',
        description: 'Your risk management settings have been saved successfully.',
      });
      
    } catch (error) {
      console.error('Error saving risk settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save risk settings. Please try again.',
        variant: 'destructive'
      });
    }
  };
  
  const getRiskLevel = (value: number, thresholds: { low: number; medium: number; high: number }) => {
    if (value <= thresholds.low) return { level: 'Low', color: 'bg-green-100 text-green-700 border-green-200' };
    if (value <= thresholds.medium) return { level: 'Medium', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
    return { level: 'High', color: 'bg-red-100 text-red-700 border-red-200' };
  };
  
  const portfolioRiskLevel = getRiskLevel(riskSettings.maxPortfolioDrawdown, { low: 0.10, medium: 0.20, high: 0.30 });
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Risk Management
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Configure advanced risk controls for your institutional trading
        </p>
      </div>
      
      {/* Risk Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-cyan-600" />
            <span>Risk Overview</span>
          </CardTitle>
          <CardDescription>
            Current risk profile and limits
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {riskSettings.maxPortfolioDrawdown * 100}%
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Max Drawdown</p>
              <Badge className={portfolioRiskLevel.color}>
                {portfolioRiskLevel.level} Risk
              </Badge>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {riskSettings.maxPositionSize * 100}%
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Max Position</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {riskSettings.maxDailyLoss * 100}%
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Daily Loss Limit</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {riskSettings.maxTradesPerDay}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Max Trades/Day</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Portfolio Risk Limits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingDown className="w-5 h-5 text-cyan-600" />
              <span>Portfolio Risk Limits</span>
            </CardTitle>
            <CardDescription>
              Set maximum loss limits for your portfolio
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="maxPortfolioDrawdown">Max Portfolio Drawdown (%)</Label>
              <Input
                id="maxPortfolioDrawdown"
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={riskSettings.maxPortfolioDrawdown}
                onChange={(e) => handleSettingChange('maxPortfolioDrawdown', parseFloat(e.target.value))}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="maxDailyLoss">Max Daily Loss (%)</Label>
              <Input
                id="maxDailyLoss"
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={riskSettings.maxDailyLoss}
                onChange={(e) => handleSettingChange('maxDailyLoss', parseFloat(e.target.value))}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="maxWeeklyLoss">Max Weekly Loss (%)</Label>
              <Input
                id="maxWeeklyLoss"
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={riskSettings.maxWeeklyLoss}
                onChange={(e) => handleSettingChange('maxWeeklyLoss', parseFloat(e.target.value))}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="maxMonthlyLoss">Max Monthly Loss (%)</Label>
              <Input
                id="maxMonthlyLoss"
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={riskSettings.maxMonthlyLoss}
                onChange={(e) => handleSettingChange('maxMonthlyLoss', parseFloat(e.target.value))}
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>
        
        {/* Position Risk Limits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="w-5 h-5 text-cyan-600" />
              <span>Position Risk Limits</span>
            </CardTitle>
            <CardDescription>
              Control individual position sizes and exposure
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
                value={riskSettings.maxPositionSize}
                onChange={(e) => handleSettingChange('maxPositionSize', parseFloat(e.target.value))}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="maxSectorExposure">Max Sector Exposure (%)</Label>
              <Input
                id="maxSectorExposure"
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={riskSettings.maxSectorExposure}
                onChange={(e) => handleSettingChange('maxSectorExposure', parseFloat(e.target.value))}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="maxCorrelationExposure">Max Correlation Exposure (%)</Label>
              <Input
                id="maxCorrelationExposure"
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={riskSettings.maxCorrelationExposure}
                onChange={(e) => handleSettingChange('maxCorrelationExposure', parseFloat(e.target.value))}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="maxTradesPerDay">Max Trades Per Day</Label>
              <Input
                id="maxTradesPerDay"
                type="number"
                min="1"
                max="1000"
                value={riskSettings.maxTradesPerDay}
                onChange={(e) => handleSettingChange('maxTradesPerDay', parseInt(e.target.value))}
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Advanced Risk Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-cyan-600" />
            <span>Advanced Risk Controls</span>
          </CardTitle>
          <CardDescription>
            Enable additional risk management features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="enableStopLoss">Stop Loss</Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Automatically close positions at loss threshold
                  </p>
                </div>
                <Switch
                  id="enableStopLoss"
                  checked={riskSettings.enableStopLoss}
                  onCheckedChange={(checked) => handleSettingChange('enableStopLoss', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="enableTakeProfit">Take Profit</Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Automatically close positions at profit target
                  </p>
                </div>
                <Switch
                  id="enableTakeProfit"
                  checked={riskSettings.enableTakeProfit}
                  onCheckedChange={(checked) => handleSettingChange('enableTakeProfit', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="enableTrailingStop">Trailing Stop</Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Dynamic stop loss that follows price movement
                  </p>
                </div>
                <Switch
                  id="enableTrailingStop"
                  checked={riskSettings.enableTrailingStop}
                  onCheckedChange={(checked) => handleSettingChange('enableTrailingStop', checked)}
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="enablePositionSizing">Position Sizing</Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Automatically calculate position sizes based on risk
                  </p>
                </div>
                <Switch
                  id="enablePositionSizing"
                  checked={riskSettings.enablePositionSizing}
                  onCheckedChange={(checked) => handleSettingChange('enablePositionSizing', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="enableCorrelationFilter">Correlation Filter</Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Prevent highly correlated positions
                  </p>
                </div>
                <Switch
                  id="enableCorrelationFilter"
                  checked={riskSettings.enableCorrelationFilter}
                  onCheckedChange={(checked) => handleSettingChange('enableCorrelationFilter', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="enableVolatilityFilter">Volatility Filter</Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Adjust position sizes based on volatility
                  </p>
                </div>
                <Switch
                  id="enableVolatilityFilter"
                  checked={riskSettings.enableVolatilityFilter}
                  onCheckedChange={(checked) => handleSettingChange('enableVolatilityFilter', checked)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Exchange-Specific Limits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <DollarSign className="w-5 h-5 text-cyan-600" />
            <span>Exchange-Specific Limits</span>
          </CardTitle>
          <CardDescription>
            Set individual risk limits for each connected exchange
          </CardDescription>
        </CardHeader>
        <CardContent>
          {exchanges.length === 0 ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No Exchanges Connected
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Connect exchanges to set individual risk limits.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {exchanges.map((exchange) => (
                <div
                  key={exchange.id}
                  className="p-4 border border-gray-200 dark:border-gray-900 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white capitalize">
                        {exchange.exchange_name}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Exchange-specific risk limits
                      </p>
                    </div>
                    <Switch
                      checked={riskSettings.exchangeLimits[exchange.id]?.enabled || false}
                      onCheckedChange={(checked) => handleExchangeLimitChange(exchange.id, 'enabled', checked)}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`${exchange.id}-maxDailyVolume`}>Max Daily Volume ($)</Label>
                      <Input
                        id={`${exchange.id}-maxDailyVolume`}
                        type="number"
                        min="0"
                        value={riskSettings.exchangeLimits[exchange.id]?.maxDailyVolume || 0}
                        onChange={(e) => handleExchangeLimitChange(exchange.id, 'maxDailyVolume', parseFloat(e.target.value))}
                        className="mt-1"
                        disabled={!riskSettings.exchangeLimits[exchange.id]?.enabled}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor={`${exchange.id}-maxPositionSize`}>Max Position Size (%)</Label>
                      <Input
                        id={`${exchange.id}-maxPositionSize`}
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        value={riskSettings.exchangeLimits[exchange.id]?.maxPositionSize || 0}
                        onChange={(e) => handleExchangeLimitChange(exchange.id, 'maxPositionSize', parseFloat(e.target.value))}
                        className="mt-1"
                        disabled={!riskSettings.exchangeLimits[exchange.id]?.enabled}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={saveRiskSettings}
          className="bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 text-white border-0"
        >
          <Save className="w-4 h-4 mr-2" />
          Save Risk Settings
        </Button>
      </div>
    </div>
  );
}
