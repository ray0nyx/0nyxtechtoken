/**
 * Strategy Builder Component
 * Advanced strategy builder for institutional backtester
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { StablePythonEditor } from '@/components/editor/StablePythonEditor';
import { pythonCompiler } from '@/lib/services/pythonCompiler';
import { 
  Play, 
  Save, 
  Code, 
  Settings, 
  TrendingUp,
  DollarSign,
  Calendar,
  Target,
  Zap
} from 'lucide-react';

interface StrategyBuilderProps {
  onBacktestCreated: (backtest: any) => void;
}

export function StrategyBuilder({ onBacktestCreated }: StrategyBuilderProps) {
  const { toast } = useToast();
  
  // Form state
  const [strategy, setStrategy] = useState({
    name: '',
    description: '',
    code: '',
    symbols: ['BTC/USDT', 'ETH/USDT'],
    startDate: '2023-01-01',
    endDate: '2024-01-01',
    initialCapital: 1000000,
    timeframe: '1h',
    exchanges: ['binance'],
    rebalanceFrequency: 'daily',
    transactionCosts: 0.001,
    slippage: 0.0005,
    maxPositions: 10,
    riskFreeRate: 0.02,
    benchmark: 'BTC/USDT',
    warmupPeriod: 30,
    maxDrawdownLimit: 0.2,
    positionSizing: 'equal'
  });
  
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState('strategy');
  
  const handleInputChange = (field: string, value: any) => {
    setStrategy(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCodeCompile = async (code: string) => {
    try {
      const result = await pythonCompiler.compileCode(code);
      return result;
    } catch (error) {
      console.error('Compilation error:', error);
      return {
        success: false,
        errors: ['Compilation failed'],
        warnings: []
      };
    }
  };

  const handleCodeRun = async (code: string) => {
    try {
      const result = await pythonCompiler.executeCode(code);
      if (result.success) {
        toast({
          title: 'Strategy Executed',
          description: result.output,
        });
      } else {
        toast({
          title: 'Execution Failed',
          description: result.error,
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Execution error:', error);
      toast({
        title: 'Execution Error',
        description: 'An error occurred during strategy execution',
        variant: 'destructive'
      });
    }
  };

  const loadTemplate = () => {
    const template = pythonCompiler.generateTemplate();
    setStrategy(prev => ({
      ...prev,
      code: template
    }));
  };
  
  const handleSymbolsChange = (value: string) => {
    const symbols = value.split(',').map(s => s.trim()).filter(s => s);
    setStrategy(prev => ({
      ...prev,
      symbols
    }));
  };
  
  const runBacktest = async () => {
    if (!strategy.name || !strategy.code) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a strategy name and code.',
        variant: 'destructive'
      });
      return;
    }
    
    setIsRunning(true);
    
    try {
      const response = await fetch('/api/institutional/backtest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(strategy),
      });
      
      if (!response.ok) {
        throw new Error('Failed to start backtest');
      }
      
      const result = await response.json();
      
      onBacktestCreated({
        id: result.job_id,
        name: strategy.name,
        status: 'pending',
        progress: 0,
        created_at: new Date().toISOString()
      });
      
      toast({
        title: 'Backtest Started',
        description: `Backtest "${strategy.name}" has been queued for execution.`,
      });
      
    } catch (error) {
      console.error('Error starting backtest:', error);
      toast({
        title: 'Error',
        description: 'Failed to start backtest. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsRunning(false);
    }
  };
  
  const saveStrategy = () => {
    // TODO: Implement strategy saving
    toast({
      title: 'Strategy Saved',
      description: 'Strategy has been saved to your library.',
    });
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Strategy Builder
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Create and test advanced trading strategies
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            onClick={saveStrategy}
            className="border-cyan-200 text-cyan-700 hover:bg-cyan-50 dark:border-cyan-800 dark:text-cyan-400 dark:hover:bg-cyan-900/20"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Strategy
          </Button>
          
          <Button
            onClick={runBacktest}
            disabled={isRunning}
            className="bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 text-white border-0"
          >
            {isRunning ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Running...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run Backtest
              </>
            )}
          </Button>
        </div>
      </div>
      
      {/* Strategy Form */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="strategy" className="flex items-center space-x-2">
            <Code className="w-4 h-4" />
            <span>Strategy</span>
          </TabsTrigger>
          <TabsTrigger value="parameters" className="flex items-center space-x-2">
            <Settings className="w-4 h-4" />
            <span>Parameters</span>
          </TabsTrigger>
          <TabsTrigger value="risk" className="flex items-center space-x-2">
            <Target className="w-4 h-4" />
            <span>Risk</span>
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex items-center space-x-2">
            <Zap className="w-4 h-4" />
            <span>Advanced</span>
          </TabsTrigger>
        </TabsList>
        
        {/* Strategy Tab */}
        <TabsContent value="strategy" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Code className="w-5 h-5 text-cyan-600" />
                  <span>Strategy Details</span>
                </CardTitle>
                <CardDescription>
                  Basic information about your strategy
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">Strategy Name</Label>
                  <Input
                    id="name"
                    value={strategy.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="e.g., Momentum Strategy"
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={strategy.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Describe your strategy..."
                    className="mt-1"
                    rows={3}
                  />
                </div>
                
                <div>
                  <Label htmlFor="symbols">Trading Symbols</Label>
                  <Input
                    id="symbols"
                    value={strategy.symbols.join(', ')}
                    onChange={(e) => handleSymbolsChange(e.target.value)}
                    placeholder="BTC/USDT, ETH/USDT, ADA/USDT"
                    className="mt-1"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Separate multiple symbols with commas
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-cyan-600" />
                  <span>Backtest Period</span>
                </CardTitle>
                <CardDescription>
                  Set the time period for your backtest
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={strategy.startDate}
                    onChange={(e) => handleInputChange('startDate', e.target.value)}
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={strategy.endDate}
                    onChange={(e) => handleInputChange('endDate', e.target.value)}
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="timeframe">Data Timeframe</Label>
                  <Select value={strategy.timeframe} onValueChange={(value) => handleInputChange('timeframe', value)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1m">1 Minute</SelectItem>
                      <SelectItem value="5m">5 Minutes</SelectItem>
                      <SelectItem value="15m">15 Minutes</SelectItem>
                      <SelectItem value="30m">30 Minutes</SelectItem>
                      <SelectItem value="1h">1 Hour</SelectItem>
                      <SelectItem value="4h">4 Hours</SelectItem>
                      <SelectItem value="1d">1 Day</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Strategy Code */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Python Strategy Code
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Write your backtesting strategy using Python and QuantConnect Lean framework
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadTemplate}
                  className="flex items-center space-x-1"
                >
                  <Code className="w-4 h-4" />
                  <span>Load Template</span>
                </Button>
              </div>
            </div>
            
            <StablePythonEditor
              value={strategy.code}
              onChange={(code) => handleInputChange('code', code)}
              onCompile={handleCodeCompile}
              onRun={handleCodeRun}
              height="500px"
            />
          </div>
        </TabsContent>
        
        {/* Parameters Tab */}
        <TabsContent value="parameters" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <DollarSign className="w-5 h-5 text-cyan-600" />
                  <span>Capital & Costs</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="initialCapital">Initial Capital</Label>
                  <Input
                    id="initialCapital"
                    type="number"
                    value={strategy.initialCapital}
                    onChange={(e) => handleInputChange('initialCapital', parseFloat(e.target.value))}
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="transactionCosts">Transaction Costs (%)</Label>
                  <Input
                    id="transactionCosts"
                    type="number"
                    step="0.001"
                    value={strategy.transactionCosts}
                    onChange={(e) => handleInputChange('transactionCosts', parseFloat(e.target.value))}
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="slippage">Slippage (%)</Label>
                  <Input
                    id="slippage"
                    type="number"
                    step="0.001"
                    value={strategy.slippage}
                    onChange={(e) => handleInputChange('slippage', parseFloat(e.target.value))}
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-cyan-600" />
                  <span>Strategy Settings</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="rebalanceFrequency">Rebalance Frequency</Label>
                  <Select value={strategy.rebalanceFrequency} onValueChange={(value) => handleInputChange('rebalanceFrequency', value)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minute">Every Minute</SelectItem>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="maxPositions">Max Positions</Label>
                  <Input
                    id="maxPositions"
                    type="number"
                    value={strategy.maxPositions}
                    onChange={(e) => handleInputChange('maxPositions', parseInt(e.target.value))}
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="benchmark">Benchmark</Label>
                  <Input
                    id="benchmark"
                    value={strategy.benchmark}
                    onChange={(e) => handleInputChange('benchmark', e.target.value)}
                    placeholder="BTC/USDT"
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Risk Tab */}
        <TabsContent value="risk" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="w-5 h-5 text-cyan-600" />
                <span>Risk Management</span>
              </CardTitle>
              <CardDescription>
                Configure risk management parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="maxDrawdownLimit">Max Drawdown Limit (%)</Label>
                  <Input
                    id="maxDrawdownLimit"
                    type="number"
                    step="0.01"
                    value={strategy.maxDrawdownLimit}
                    onChange={(e) => handleInputChange('maxDrawdownLimit', parseFloat(e.target.value))}
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="warmupPeriod">Warmup Period (Days)</Label>
                  <Input
                    id="warmupPeriod"
                    type="number"
                    value={strategy.warmupPeriod}
                    onChange={(e) => handleInputChange('warmupPeriod', parseInt(e.target.value))}
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="riskFreeRate">Risk-Free Rate (%)</Label>
                  <Input
                    id="riskFreeRate"
                    type="number"
                    step="0.001"
                    value={strategy.riskFreeRate}
                    onChange={(e) => handleInputChange('riskFreeRate', parseFloat(e.target.value))}
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="positionSizing">Position Sizing</Label>
                  <Select value={strategy.positionSizing} onValueChange={(value) => handleInputChange('positionSizing', value)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equal">Equal Weight</SelectItem>
                      <SelectItem value="volatility">Volatility Adjusted</SelectItem>
                      <SelectItem value="momentum">Momentum Based</SelectItem>
                      <SelectItem value="risk_parity">Risk Parity</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Advanced Tab */}
        <TabsContent value="advanced" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="w-5 h-5 text-cyan-600" />
                <span>Advanced Settings</span>
              </CardTitle>
              <CardDescription>
                Advanced configuration options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="exchanges">Data Exchanges</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {['binance', 'coinbase', 'kraken', 'bybit', 'okx'].map((exchange) => (
                    <Badge
                      key={exchange}
                      variant={strategy.exchanges.includes(exchange) ? "default" : "outline"}
                      className={`cursor-pointer ${
                        strategy.exchanges.includes(exchange)
                          ? 'bg-cyan-100 text-cyan-700 border-cyan-200'
                          : 'border-gray-300'
                      }`}
                      onClick={() => {
                        const exchanges = strategy.exchanges.includes(exchange)
                          ? strategy.exchanges.filter(e => e !== exchange)
                          : [...strategy.exchanges, exchange];
                        handleInputChange('exchanges', exchanges);
                      }}
                    >
                      {exchange}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
