import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select,
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue
} from '@/components/ui/select';
import { 
  Code, 
  Play, 
  Save, 
  Download, 
  Upload,
  Settings,
  Target,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  LineChart,
  PieChart
} from 'lucide-react';
import { AdvancedBacktestingService, BacktestConfig } from '@/services/advancedBacktestingService';

interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  category: 'momentum' | 'mean_reversion' | 'arbitrage' | 'ml' | 'multi_factor';
  parameters: Record<string, any>;
  code: string;
}

const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    id: 'momentum_12_1',
    name: '12-Month Momentum with 1-Month Skip',
    description: 'Classic momentum strategy that ranks stocks by 12-month returns and skips the most recent month',
    category: 'momentum',
    parameters: {
      lookbackPeriod: 12,
      skipPeriod: 1,
      rebalanceFrequency: 'monthly',
      topN: 20
    },
    code: `
// Momentum Strategy Implementation
function generateSignals(data, config) {
  const signals = [];
  const lookback = config.lookbackPeriod;
  const skip = config.skipPeriod;
  
  for (let i = lookback + skip; i < data.length; i++) {
    const currentDate = data[i].date;
    const lookbackStart = i - lookback - skip;
    const lookbackEnd = i - skip;
    
    // Calculate returns for each symbol
    const returns = {};
    for (const symbol of config.symbols) {
      const symbolData = data.filter(d => d.symbol === symbol);
      if (symbolData.length >= lookback) {
        const startPrice = symbolData[lookbackStart].close;
        const endPrice = symbolData[lookbackEnd].close;
        returns[symbol] = (endPrice - startPrice) / startPrice;
      }
    }
    
    // Rank by returns and select top N
    const sortedReturns = Object.entries(returns)
      .sort(([,a], [,b]) => b - a)
      .slice(0, config.topN);
    
    // Generate buy signals for top performers
    for (const [symbol, return] of sortedReturns) {
      signals.push({
        symbol,
        action: 'buy',
        timestamp: currentDate,
        price: data[i].close,
        confidence: return
      });
    }
  }
  
  return signals;
}
    `
  },
  {
    id: 'mean_reversion_bollinger',
    name: 'Bollinger Bands Mean Reversion',
    description: 'Mean reversion strategy using Bollinger Bands for entry and exit signals',
    category: 'mean_reversion',
    parameters: {
      period: 20,
      stdDev: 2,
      rebalanceFrequency: 'daily'
    },
    code: `
// Mean Reversion Strategy Implementation
function generateSignals(data, config) {
  const signals = [];
  const period = config.period;
  const stdDev = config.stdDev;
  
  for (let i = period; i < data.length; i++) {
    const currentData = data.slice(i - period, i);
    const currentPrice = data[i].close;
    
    // Calculate Bollinger Bands
    const sma = currentData.reduce((sum, d) => sum + d.close, 0) / period;
    const variance = currentData.reduce((sum, d) => sum + Math.pow(d.close - sma, 2), 0) / period;
    const std = Math.sqrt(variance);
    
    const upperBand = sma + (stdDev * std);
    const lowerBand = sma - (stdDev * std);
    
    // Generate signals
    if (currentPrice <= lowerBand) {
      signals.push({
        symbol: data[i].symbol,
        action: 'buy',
        timestamp: data[i].date,
        price: currentPrice,
        confidence: (lowerBand - currentPrice) / std
      });
    } else if (currentPrice >= upperBand) {
      signals.push({
        symbol: data[i].symbol,
        action: 'sell',
        timestamp: data[i].date,
        price: currentPrice,
        confidence: (currentPrice - upperBand) / std
      });
    }
  }
  
  return signals;
}
    `
  },
  {
    id: 'ml_momentum',
    name: 'Machine Learning Momentum',
    description: 'ML-based momentum strategy using multiple features and ensemble methods',
    category: 'ml',
    parameters: {
      features: ['rsi', 'macd', 'bollinger', 'volume'],
      model: 'random_forest',
      lookback: 20,
      retrainFrequency: 'monthly'
    },
    code: `
// ML Momentum Strategy Implementation
function generateSignals(data, config) {
  const signals = [];
  
  // Feature engineering
  const features = extractFeatures(data, config.features);
  
  // Model prediction (simplified)
  for (let i = config.lookback; i < data.length; i++) {
    const currentFeatures = features.slice(i - config.lookback, i);
    const prediction = predictWithML(currentFeatures, config.model);
    
    if (prediction > 0.6) {
      signals.push({
        symbol: data[i].symbol,
        action: 'buy',
        timestamp: data[i].date,
        price: data[i].close,
        confidence: prediction
      });
    } else if (prediction < 0.4) {
      signals.push({
        symbol: data[i].symbol,
        action: 'sell',
        timestamp: data[i].date,
        price: data[i].close,
        confidence: 1 - prediction
      });
    }
  }
  
  return signals;
}

function extractFeatures(data, featureList) {
  // Implementation for feature extraction
  return data.map(d => ({
    rsi: calculateRSI(d.close, 14),
    macd: calculateMACD(d.close),
    bollinger: calculateBollingerBands(d.close, 20, 2),
    volume: d.volume
  }));
}
    `
  }
];

export const AdvancedStrategyBuilder: React.FC = () => {
  const [selectedTemplate, setSelectedTemplate] = useState<StrategyTemplate | null>(null);
  const [customCode, setCustomCode] = useState('');
  const [strategyName, setStrategyName] = useState('');
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any>(null);

  const handleTemplateSelect = (template: StrategyTemplate) => {
    setSelectedTemplate(template);
    setCustomCode(template.code);
    setParameters(template.parameters);
    setStrategyName(template.name);
  };

  const handleParameterChange = (key: string, value: any) => {
    setParameters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleRunBacktest = async () => {
    if (!selectedTemplate) return;
    
    setIsRunning(true);
    try {
      const config: BacktestConfig = {
        id: `strategy_${Date.now()}`,
        name: strategyName,
        strategy: selectedTemplate.name,
        symbols: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'],
        startDate: '2020-01-01',
        endDate: '2024-01-01',
        timeframe: '1day',
        initialCapital: 1000000,
        positionSize: 0.1,
        maxPositions: 20,
        transactionCosts: 0.001,
        slippage: 0.0005,
        riskFreeRate: 0.02,
        benchmark: 'SPY',
        rebalanceFrequency: 'monthly',
        ...parameters
      };

      const result = await AdvancedBacktestingService.runBacktest(config);
      setResults(result);
    } catch (error) {
      console.error('Error running backtest:', error);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Advanced Strategy Builder
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="templates" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="templates">Templates</TabsTrigger>
              <TabsTrigger value="custom">Custom Code</TabsTrigger>
              <TabsTrigger value="parameters">Parameters</TabsTrigger>
              <TabsTrigger value="results">Results</TabsTrigger>
            </TabsList>
            
            <TabsContent value="templates" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {STRATEGY_TEMPLATES.map((template) => (
                  <Card 
                    key={template.id}
                    className={`cursor-pointer transition-all ${
                      selectedTemplate?.id === template.id 
                        ? 'ring-2 ring-primary' 
                        : 'hover:shadow-md'
                    }`}
                    onClick={() => handleTemplateSelect(template)}
                  >
                    <CardHeader>
                      <CardTitle className="text-sm">{template.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground mb-2">
                        {template.description}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          template.category === 'momentum' ? 'bg-blue-100 text-blue-800' :
                          template.category === 'mean_reversion' ? 'bg-green-100 text-green-800' :
                          template.category === 'arbitrage' ? 'bg-purple-100 text-purple-800' :
                          template.category === 'ml' ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {template.category.replace('_', ' ')}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="custom" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="strategy-name">Strategy Name</Label>
                <Input
                  id="strategy-name"
                  value={strategyName}
                  onChange={(e) => setStrategyName(e.target.value)}
                  placeholder="Enter strategy name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="custom-code">Strategy Code</Label>
                <textarea
                  id="custom-code"
                  className="w-full h-96 p-3 border rounded-md font-mono text-sm"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value)}
                  placeholder="Enter your strategy code here..."
                />
              </div>
              
              <div className="flex gap-2">
                <Button onClick={() => setCustomCode('')}>
                  Clear
                </Button>
                <Button variant="outline">
                  <Save className="h-4 w-4 mr-2" />
                  Save Template
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="parameters" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedTemplate && Object.entries(selectedTemplate.parameters).map(([key, value]) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={key}>
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </Label>
                    {typeof value === 'number' ? (
                      <Input
                        id={key}
                        type="number"
                        value={parameters[key] || value}
                        onChange={(e) => handleParameterChange(key, parseFloat(e.target.value))}
                      />
                    ) : (
                      <Select
                        value={parameters[key] || value}
                        onValueChange={(val) => handleParameterChange(key, val)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.isArray(value) ? value.map(option => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          )) : (
                            <SelectItem value={value}>
                              {value}
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="results" className="space-y-4">
              {results ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-2xl font-bold text-green-600">
                          {results.performance.totalReturn.toFixed(2)}%
                        </div>
                        <div className="text-sm text-muted-foreground">Total Return</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-2xl font-bold text-blue-600">
                          {results.performance.sharpeRatio.toFixed(2)}
                        </div>
                        <div className="text-sm text-muted-foreground">Sharpe Ratio</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-2xl font-bold text-red-600">
                          {results.performance.maxDrawdown.toFixed(2)}%
                        </div>
                        <div className="text-sm text-muted-foreground">Max Drawdown</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-2xl font-bold text-purple-600">
                          {results.performance.winRate.toFixed(2)}%
                        </div>
                        <div className="text-sm text-muted-foreground">Win Rate</div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Export Results
                    </Button>
                    <Button variant="outline">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      View Charts
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No results yet. Run a backtest to see results.
                </div>
              )}
            </TabsContent>
          </Tabs>
          
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Import Strategy
            </Button>
            <Button 
              onClick={handleRunBacktest}
              disabled={!selectedTemplate || isRunning}
            >
              <Play className="h-4 w-4 mr-2" />
              {isRunning ? 'Running...' : 'Run Backtest'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

