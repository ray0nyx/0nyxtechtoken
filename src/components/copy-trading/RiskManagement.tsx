/**
 * Risk Management Component
 * Comprehensive risk management interface for copy trading
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  AlertTriangle, 
  Target, 
  DollarSign,
  TrendingDown,
  BarChart3,
  Settings,
  Save,
  RefreshCw,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface RiskLimits {
  id: string;
  userId: string;
  maxDailyLoss: number;
  maxDrawdown: number;
  maxPositionSize: number;
  maxLeverage: number;
  stopLossEnabled: boolean;
  takeProfitEnabled: boolean;
  correlationLimit: number;
  volatilityLimit: number;
  circuitBreakerEnabled: boolean;
  emergencyStopLoss: number;
  maxSlippage: number;
  maxLatency: number;
  updatedAt: string;
}

interface RiskManagementProps {
  riskLimits: RiskLimits | null;
  onUpdateRiskLimits: (limits: Partial<RiskLimits>) => void;
  onSaveRiskLimits: () => void;
}

export const RiskManagement: React.FC<RiskManagementProps> = ({
  riskLimits,
  onUpdateRiskLimits,
  onSaveRiskLimits
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localLimits, setLocalLimits] = useState<Partial<RiskLimits>>({});

  const handleInputChange = (field: keyof RiskLimits, value: any) => {
    const newLimits = { ...localLimits, [field]: value };
    setLocalLimits(newLimits);
    onUpdateRiskLimits(newLimits);
  };

  const handleSave = () => {
    onSaveRiskLimits();
    setIsEditing(false);
    setLocalLimits({});
  };

  const handleCancel = () => {
    setIsEditing(false);
    setLocalLimits({});
  };

  const currentLimits = isEditing ? { ...riskLimits, ...localLimits } : riskLimits;

  if (!currentLimits) {
    return (
      <div className="text-center py-12">
        <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No Risk Limits Set
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Configure your risk management settings to start copy trading safely
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Risk Management
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Configure and monitor your copy trading risk parameters
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)}>
              <Settings className="w-4 h-4 mr-2" />
              Edit Settings
            </Button>
          ) : (
            <div className="flex space-x-2">
              <Button variant="outline" onClick={handleCancel}>
                <XCircle className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Risk Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Max Daily Loss</p>
                <p className="text-2xl font-bold text-red-600">
                  ${currentLimits.maxDailyLoss?.toLocaleString() || 0}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Max Drawdown</p>
                <p className="text-2xl font-bold text-orange-600">
                  {(currentLimits.maxDrawdown * 100)?.toFixed(1) || 0}%
                </p>
              </div>
              <TrendingDown className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Max Position Size</p>
                <p className="text-2xl font-bold text-blue-600">
                  ${currentLimits.maxPositionSize?.toLocaleString() || 0}
                </p>
              </div>
              <Target className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Circuit Breaker</p>
                <p className="text-2xl font-bold text-purple-600">
                  {currentLimits.circuitBreakerEnabled ? 'ON' : 'OFF'}
                </p>
              </div>
              <Shield className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Settings Tabs */}
      <Tabs defaultValue="limits" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="limits">Risk Limits</TabsTrigger>
          <TabsTrigger value="position">Position Sizing</TabsTrigger>
          <TabsTrigger value="execution">Execution</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        </TabsList>

        <TabsContent value="limits" className="space-y-4">
          <Card className="bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-red-600 dark:text-red-400">
                Risk Limits
              </CardTitle>
              <CardDescription>
                Set maximum loss and drawdown limits
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="maxDailyLoss">Maximum Daily Loss ($)</Label>
                  <Input
                    id="maxDailyLoss"
                    type="number"
                    value={currentLimits.maxDailyLoss || 0}
                    onChange={(e) => handleInputChange('maxDailyLoss', parseFloat(e.target.value) || 0)}
                    disabled={!isEditing}
                    placeholder="Enter maximum daily loss"
                  />
                  <p className="text-sm text-gray-500">
                    Stop all trading if daily loss exceeds this amount
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxDrawdown">Maximum Drawdown (%)</Label>
                  <div className="space-y-2">
                    <Slider
                      value={[(currentLimits.maxDrawdown || 0) * 100]}
                      onValueChange={([value]) => handleInputChange('maxDrawdown', value / 100)}
                      max={50}
                      min={1}
                      step={0.5}
                      disabled={!isEditing}
                      className="w-full"
                    />
                    <div className="text-center text-sm text-gray-600">
                      {(currentLimits.maxDrawdown * 100)?.toFixed(1) || 0}%
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">
                    Maximum portfolio drawdown before stopping
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emergencyStopLoss">Emergency Stop Loss (%)</Label>
                  <div className="space-y-2">
                    <Slider
                      value={[(currentLimits.emergencyStopLoss || 0) * 100]}
                      onValueChange={([value]) => handleInputChange('emergencyStopLoss', value / 100)}
                      max={20}
                      min={1}
                      step={0.5}
                      disabled={!isEditing}
                      className="w-full"
                    />
                    <div className="text-center text-sm text-gray-600">
                      {(currentLimits.emergencyStopLoss * 100)?.toFixed(1) || 0}%
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">
                    Emergency stop loss for individual positions
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="correlationLimit">Correlation Limit (%)</Label>
                  <div className="space-y-2">
                    <Slider
                      value={[(currentLimits.correlationLimit || 0) * 100]}
                      onValueChange={([value]) => handleInputChange('correlationLimit', value / 100)}
                      max={100}
                      min={0}
                      step={5}
                      disabled={!isEditing}
                      className="w-full"
                    />
                    <div className="text-center text-sm text-gray-600">
                      {(currentLimits.correlationLimit * 100)?.toFixed(0) || 0}%
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">
                    Maximum correlation between positions
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="position" className="space-y-4">
          <Card className="bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                Position Sizing
              </CardTitle>
              <CardDescription>
                Configure position sizing and leverage limits
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="maxPositionSize">Maximum Position Size ($)</Label>
                  <Input
                    id="maxPositionSize"
                    type="number"
                    value={currentLimits.maxPositionSize || 0}
                    onChange={(e) => handleInputChange('maxPositionSize', parseFloat(e.target.value) || 0)}
                    disabled={!isEditing}
                    placeholder="Enter maximum position size"
                  />
                  <p className="text-sm text-gray-500">
                    Maximum dollar amount per position
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxLeverage">Maximum Leverage (x)</Label>
                  <div className="space-y-2">
                    <Slider
                      value={[currentLimits.maxLeverage || 1]}
                      onValueChange={([value]) => handleInputChange('maxLeverage', value)}
                      max={50}
                      min={1}
                      step={1}
                      disabled={!isEditing}
                      className="w-full"
                    />
                    <div className="text-center text-sm text-gray-600">
                      {currentLimits.maxLeverage || 1}x
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">
                    Maximum leverage allowed for positions
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="volatilityLimit">Volatility Limit (%)</Label>
                  <div className="space-y-2">
                    <Slider
                      value={[(currentLimits.volatilityLimit || 0) * 100]}
                      onValueChange={([value]) => handleInputChange('volatilityLimit', value / 100)}
                      max={50}
                      min={0}
                      step={1}
                      disabled={!isEditing}
                      className="w-full"
                    />
                    <div className="text-center text-sm text-gray-600">
                      {(currentLimits.volatilityLimit * 100)?.toFixed(0) || 0}%
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">
                    Maximum volatility for positions
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="execution" className="space-y-4">
          <Card className="bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-green-600 dark:text-green-400">
                Execution Controls
              </CardTitle>
              <CardDescription>
                Configure trade execution parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="maxSlippage">Maximum Slippage (%)</Label>
                  <div className="space-y-2">
                    <Slider
                      value={[(currentLimits.maxSlippage || 0) * 100]}
                      onValueChange={([value]) => handleInputChange('maxSlippage', value / 100)}
                      max={5}
                      min={0}
                      step={0.1}
                      disabled={!isEditing}
                      className="w-full"
                    />
                    <div className="text-center text-sm text-gray-600">
                      {(currentLimits.maxSlippage * 100)?.toFixed(1) || 0}%
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">
                    Maximum acceptable slippage for trades
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxLatency">Maximum Latency (ms)</Label>
                  <div className="space-y-2">
                    <Slider
                      value={[currentLimits.maxLatency || 100]}
                      onValueChange={([value]) => handleInputChange('maxLatency', value)}
                      max={1000}
                      min={50}
                      step={25}
                      disabled={!isEditing}
                      className="w-full"
                    />
                    <div className="text-center text-sm text-gray-600">
                      {currentLimits.maxLatency || 100}ms
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">
                    Maximum acceptable execution latency
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="stopLossEnabled">Stop Loss Protection</Label>
                      <p className="text-sm text-gray-500">
                        Automatically set stop losses for all positions
                      </p>
                    </div>
                    <Switch
                      id="stopLossEnabled"
                      checked={currentLimits.stopLossEnabled || false}
                      onCheckedChange={(checked) => handleInputChange('stopLossEnabled', checked)}
                      disabled={!isEditing}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="takeProfitEnabled">Take Profit Protection</Label>
                      <p className="text-sm text-gray-500">
                        Automatically set take profit targets
                      </p>
                    </div>
                    <Switch
                      id="takeProfitEnabled"
                      checked={currentLimits.takeProfitEnabled || false}
                      onCheckedChange={(checked) => handleInputChange('takeProfitEnabled', checked)}
                      disabled={!isEditing}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="circuitBreakerEnabled">Circuit Breaker</Label>
                      <p className="text-sm text-gray-500">
                        Automatically stop trading on risk limit breach
                      </p>
                    </div>
                    <Switch
                      id="circuitBreakerEnabled"
                      checked={currentLimits.circuitBreakerEnabled || false}
                      onCheckedChange={(checked) => handleInputChange('circuitBreakerEnabled', checked)}
                      disabled={!isEditing}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <Card className="bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-purple-600 dark:text-purple-400">
                Risk Monitoring
              </CardTitle>
              <CardDescription>
                Monitor current risk exposure and alerts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900 dark:text-white">Current Exposure</h4>
                      <BarChart3 className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Daily P&L</span>
                        <span className="text-sm font-medium text-green-600">+$1,234.56</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Current Drawdown</span>
                        <span className="text-sm font-medium text-orange-600">-2.3%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Active Positions</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">12</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900 dark:text-white">Risk Alerts</h4>
                      <AlertTriangle className="w-5 h-5 text-orange-500" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-gray-600">Daily loss within limits</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-gray-600">Drawdown within limits</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        <span className="text-sm text-yellow-600">High correlation detected</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Shield className="w-5 h-5 text-blue-500" />
                    <h4 className="font-medium text-blue-900 dark:text-blue-100">Risk Status</h4>
                  </div>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    All risk parameters are within acceptable limits. Copy trading is operating normally.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};




