import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select,
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue
} from '@/components/ui/select';
import { 
  Shield, 
  AlertTriangle, 
  Target, 
  TrendingDown,
  BarChart3,
  LineChart,
  PieChart,
  Settings,
  Play,
  Pause,
  Square
} from 'lucide-react';

interface RiskLimits {
  maxDrawdown: number;
  maxPositionSize: number;
  maxLeverage: number;
  maxCorrelation: number;
  maxSectorExposure: number;
  maxSingleAssetExposure: number;
  stopLoss: number;
  takeProfit: number;
  varLimit: number;
  expectedShortfallLimit: number;
}

interface RiskMetrics {
  currentDrawdown: number;
  portfolioVar: number;
  expectedShortfall: number;
  maxDrawdown: number;
  correlationMatrix: number[][];
  sectorExposure: Record<string, number>;
  positionSizes: Record<string, number>;
  leverage: number;
  riskScore: number;
}

interface StressTestScenario {
  id: string;
  name: string;
  description: string;
  marketShock: number;
  sectorShocks: Record<string, number>;
  correlationIncrease: number;
  volatilityIncrease: number;
}

const STRESS_TEST_SCENARIOS: StressTestScenario[] = [
  {
    id: 'market_crash_2008',
    name: '2008 Financial Crisis',
    description: 'Simulate the 2008 financial crisis with 50% market decline',
    marketShock: -0.5,
    sectorShocks: {
      'Financial': -0.7,
      'Real Estate': -0.6,
      'Consumer Discretionary': -0.5
    },
    correlationIncrease: 0.3,
    volatilityIncrease: 2.0
  },
  {
    id: 'covid_crash_2020',
    name: 'COVID-19 Market Crash',
    description: 'Simulate the March 2020 market crash',
    marketShock: -0.35,
    sectorShocks: {
      'Travel': -0.8,
      'Energy': -0.6,
      'Technology': -0.2
    },
    correlationIncrease: 0.4,
    volatilityIncrease: 1.5
  },
  {
    id: 'dot_com_bubble',
    name: 'Dot-com Bubble Burst',
    description: 'Simulate the 2000-2002 tech bubble burst',
    marketShock: -0.4,
    sectorShocks: {
      'Technology': -0.8,
      'Telecommunications': -0.7
    },
    correlationIncrease: 0.2,
    volatilityIncrease: 1.8
  }
];

export const AdvancedRiskManager: React.FC = () => {
  const [riskLimits, setRiskLimits] = useState<RiskLimits>({
    maxDrawdown: 0.15,
    maxPositionSize: 0.1,
    maxLeverage: 2.0,
    maxCorrelation: 0.7,
    maxSectorExposure: 0.3,
    maxSingleAssetExposure: 0.05,
    stopLoss: 0.05,
    takeProfit: 0.15,
    varLimit: 0.02,
    expectedShortfallLimit: 0.03
  });

  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<StressTestScenario | null>(null);
  const [stressTestResults, setStressTestResults] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);

  const handleRiskLimitChange = (key: keyof RiskLimits, value: number) => {
    setRiskLimits(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const runStressTest = async () => {
    if (!selectedScenario) return;
    
    setIsRunning(true);
    try {
      // Simulate stress test calculation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const results = {
        scenario: selectedScenario,
        portfolioImpact: {
          totalReturn: -0.25,
          maxDrawdown: -0.35,
          var95: -0.08,
          expectedShortfall: -0.12
        },
        sectorImpacts: {
          'Technology': -0.15,
          'Financial': -0.22,
          'Healthcare': -0.08
        },
        riskBreaches: [
          'Max drawdown limit exceeded',
          'VaR limit exceeded',
          'Sector exposure limit exceeded'
        ]
      };
      
      setStressTestResults(results);
    } catch (error) {
      console.error('Error running stress test:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const calculateRiskScore = (metrics: RiskMetrics): number => {
    let score = 0;
    
    // Drawdown risk
    if (metrics.currentDrawdown > riskLimits.maxDrawdown) score += 30;
    else if (metrics.currentDrawdown > riskLimits.maxDrawdown * 0.8) score += 15;
    
    // VaR risk
    if (metrics.portfolioVar > riskLimits.varLimit) score += 25;
    else if (metrics.portfolioVar > riskLimits.varLimit * 0.8) score += 12;
    
    // Leverage risk
    if (metrics.leverage > riskLimits.maxLeverage) score += 20;
    else if (metrics.leverage > riskLimits.maxLeverage * 0.8) score += 10;
    
    // Correlation risk
    const maxCorrelation = Math.max(...metrics.correlationMatrix.flat());
    if (maxCorrelation > riskLimits.maxCorrelation) score += 15;
    else if (maxCorrelation > riskLimits.maxCorrelation * 0.8) score += 8;
    
    // Sector concentration risk
    const maxSectorExposure = Math.max(...Object.values(metrics.sectorExposure));
    if (maxSectorExposure > riskLimits.maxSectorExposure) score += 10;
    else if (maxSectorExposure > riskLimits.maxSectorExposure * 0.8) score += 5;
    
    return Math.min(score, 100);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Advanced Risk Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="limits" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="limits">Risk Limits</TabsTrigger>
              <TabsTrigger value="monitoring">Real-time Monitoring</TabsTrigger>
              <TabsTrigger value="stress">Stress Testing</TabsTrigger>
              <TabsTrigger value="alerts">Alerts</TabsTrigger>
            </TabsList>
            
            <TabsContent value="limits" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Portfolio Limits</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <Label>Max Drawdown: {riskLimits.maxDrawdown * 100}%</Label>
                      <Slider
                        value={[riskLimits.maxDrawdown * 100]}
                        onValueChange={([value]) => handleRiskLimitChange('maxDrawdown', value / 100)}
                        max={50}
                        min={1}
                        step={1}
                        className="mt-2"
                      />
                    </div>
                    
                    <div>
                      <Label>Max Position Size: {riskLimits.maxPositionSize * 100}%</Label>
                      <Slider
                        value={[riskLimits.maxPositionSize * 100]}
                        onValueChange={([value]) => handleRiskLimitChange('maxPositionSize', value / 100)}
                        max={50}
                        min={1}
                        step={1}
                        className="mt-2"
                      />
                    </div>
                    
                    <div>
                      <Label>Max Leverage: {riskLimits.maxLeverage}x</Label>
                      <Slider
                        value={[riskLimits.maxLeverage]}
                        onValueChange={([value]) => handleRiskLimitChange('maxLeverage', value)}
                        max={10}
                        min={1}
                        step={0.1}
                        className="mt-2"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Risk Metrics</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <Label>VaR Limit: {riskLimits.varLimit * 100}%</Label>
                      <Slider
                        value={[riskLimits.varLimit * 100]}
                        onValueChange={([value]) => handleRiskLimitChange('varLimit', value / 100)}
                        max={10}
                        min={0.1}
                        step={0.1}
                        className="mt-2"
                      />
                    </div>
                    
                    <div>
                      <Label>Stop Loss: {riskLimits.stopLoss * 100}%</Label>
                      <Slider
                        value={[riskLimits.stopLoss * 100]}
                        onValueChange={([value]) => handleRiskLimitChange('stopLoss', value / 100)}
                        max={20}
                        min={1}
                        step={1}
                        className="mt-2"
                      />
                    </div>
                    
                    <div>
                      <Label>Take Profit: {riskLimits.takeProfit * 100}%</Label>
                      <Slider
                        value={[riskLimits.takeProfit * 100]}
                        onValueChange={([value]) => handleRiskLimitChange('takeProfit', value / 100)}
                        max={50}
                        min={5}
                        step={1}
                        className="mt-2"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="monitoring" className="space-y-4">
              {riskMetrics ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-2xl font-bold text-red-600">
                            {riskMetrics.currentDrawdown.toFixed(2)}%
                          </div>
                          <div className="text-sm text-muted-foreground">Current Drawdown</div>
                        </div>
                        <AlertTriangle className="h-8 w-8 text-red-500" />
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-2xl font-bold text-orange-600">
                            {riskMetrics.portfolioVar.toFixed(2)}%
                          </div>
                          <div className="text-sm text-muted-foreground">Portfolio VaR</div>
                        </div>
                        <Shield className="h-8 w-8 text-orange-500" />
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-2xl font-bold text-blue-600">
                            {riskMetrics.leverage.toFixed(2)}x
                          </div>
                          <div className="text-sm text-muted-foreground">Leverage</div>
                        </div>
                        <Target className="h-8 w-8 text-blue-500" />
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-2xl font-bold text-purple-600">
                            {riskMetrics.riskScore}
                          </div>
                          <div className="text-sm text-muted-foreground">Risk Score</div>
                        </div>
                        <BarChart3 className="h-8 w-8 text-purple-500" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No risk metrics available. Start a backtest to see real-time risk monitoring.
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="stress" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label>Select Stress Test Scenario</Label>
                  <Select
                    value={selectedScenario?.id || ''}
                    onValueChange={(value) => {
                      const scenario = STRESS_TEST_SCENARIOS.find(s => s.id === value);
                      setSelectedScenario(scenario || null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a scenario" />
                    </SelectTrigger>
                    <SelectContent>
                      {STRESS_TEST_SCENARIOS.map((scenario) => (
                        <SelectItem key={scenario.id} value={scenario.id}>
                          {scenario.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {selectedScenario && (
                  <Card>
                    <CardHeader>
                      <CardTitle>{selectedScenario.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        {selectedScenario.description}
                      </p>
                      
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <Label>Market Shock: {selectedScenario.marketShock * 100}%</Label>
                        </div>
                        <div>
                          <Label>Volatility Increase: {selectedScenario.volatilityIncrease}x</Label>
                        </div>
                      </div>
                      
                      <Button 
                        onClick={runStressTest}
                        disabled={isRunning}
                        className="w-full"
                      >
                        {isRunning ? (
                          <>
                            <Pause className="h-4 w-4 mr-2" />
                            Running Stress Test...
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            Run Stress Test
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                )}
                
                {stressTestResults && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Stress Test Results</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-2xl font-bold text-red-600">
                              {stressTestResults.portfolioImpact.totalReturn.toFixed(2)}%
                            </div>
                            <div className="text-sm text-muted-foreground">Portfolio Impact</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-orange-600">
                              {stressTestResults.portfolioImpact.maxDrawdown.toFixed(2)}%
                            </div>
                            <div className="text-sm text-muted-foreground">Max Drawdown</div>
                          </div>
                        </div>
                        
                        {stressTestResults.riskBreaches.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-red-600 mb-2">Risk Limit Breaches:</h4>
                            <ul className="list-disc list-inside space-y-1">
                              {stressTestResults.riskBreaches.map((breach: string, index: number) => (
                                <li key={index} className="text-sm text-red-600">{breach}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="alerts" className="space-y-4">
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Risk alerts and notifications will be displayed here.</p>
                <p className="text-sm">Configure alerts in the risk limits section.</p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

