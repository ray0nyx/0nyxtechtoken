import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Zap,
  TrendingDown,
  AlertTriangle,
  Play,
  BarChart3,
  DollarSign,
  Percent,
  Activity
} from 'lucide-react';
import { riskAnalyticsService, StressTestResult } from '@/services/riskAnalyticsService';

interface StressTestCardProps {
  className?: string;
}

const STRESS_SCENARIOS = [
  { name: 'Market Crash (-20%)', marketChange: -20 },
  { name: 'Market Correction (-10%)', marketChange: -10 },
  { name: 'Market Drop (-5%)', marketChange: -5 },
  { name: 'Sector Rotation (-15%)', marketChange: -15 },
  { name: 'Interest Rate Shock (+2%)', marketChange: 2 },
  { name: 'Volatility Spike (+50%)', marketChange: -25 },
  { name: 'Black Swan (-30%)', marketChange: -30 },
  { name: 'Flash Crash (-15%)', marketChange: -15 }
];

const CUSTOM_SCENARIOS = [
  { name: 'Mild Correction', marketChange: -5 },
  { name: 'Moderate Drop', marketChange: -10 },
  { name: 'Severe Drop', marketChange: -20 },
  { name: 'Extreme Drop', marketChange: -30 }
];

export function StressTestCard({ className }: StressTestCardProps) {
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([]);
  const [customChange, setCustomChange] = useState<string>('-10');
  const [results, setResults] = useState<StressTestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runStressTest = async () => {
    if (selectedScenarios.length === 0) return;

    setIsRunning(true);
    try {
      const scenarios = selectedScenarios.map(name => {
        const scenario = STRESS_SCENARIOS.find(s => s.name === name);
        if (scenario) return scenario;
        
        // Handle custom scenario
        return {
          name: `Custom (${customChange}%)`,
          marketChange: parseFloat(customChange)
        };
      });

      const testResults = await riskAnalyticsService.runStressTest(scenarios);
      setResults(testResults);
    } catch (error) {
      console.error('Error running stress test:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const toggleScenario = (scenarioName: string) => {
    setSelectedScenarios(prev => 
      prev.includes(scenarioName) 
        ? prev.filter(name => name !== scenarioName)
        : [...prev, scenarioName]
    );
  };

  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return 'text-green-500 bg-green-100 dark:bg-green-900/20';
      case 'medium': return 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/20';
      case 'high': return 'text-orange-500 bg-orange-100 dark:bg-orange-900/20';
      case 'critical': return 'text-red-500 bg-red-100 dark:bg-red-900/20';
      default: return 'text-gray-500 bg-gray-100 dark:bg-gray-900/20';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  return (
    <Card className={cn("border shadow-sm bg-gray-100 dark:bg-card", className)}>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Zap className="h-5 w-5 mr-2 text-primary" />
          Stress Testing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Scenario Selection */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">Select Scenarios</h3>
          <div className="grid grid-cols-2 gap-2">
            {STRESS_SCENARIOS.map((scenario) => (
              <Button
                key={scenario.name}
                variant={selectedScenarios.includes(scenario.name) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleScenario(scenario.name)}
                className="justify-start text-xs"
              >
                <TrendingDown className="h-3 w-3 mr-2" />
                {scenario.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Custom Scenario */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Custom Scenario</h3>
          <div className="flex items-center space-x-2">
            <Select value={customChange} onValueChange={setCustomChange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CUSTOM_SCENARIOS.map((scenario) => (
                  <SelectItem key={scenario.marketChange} value={scenario.marketChange.toString()}>
                    {scenario.name} ({scenario.marketChange}%)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleScenario(`Custom (${customChange}%)`)}
              disabled={selectedScenarios.includes(`Custom (${customChange}%)`)}
            >
              Add
            </Button>
          </div>
        </div>

        {/* Run Test Button */}
        <Button
          onClick={runStressTest}
          disabled={selectedScenarios.length === 0 || isRunning}
          className="w-full"
        >
          {isRunning ? (
            <>
              <Activity className="h-4 w-4 mr-2 animate-spin" />
              Running Test...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Run Stress Test
            </>
          )}
        </Button>

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Test Results</h3>
            <div className="space-y-3">
              {results.map((result, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{result.scenario}</h4>
                    <Badge className={cn("text-xs", getRiskLevelColor(result.riskLevel))}>
                      {result.riskLevel.toUpperCase()}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">Market Change</div>
                      <div className="text-lg font-semibold">
                        {formatPercentage(result.marketChange)}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">Portfolio Impact</div>
                      <div className={cn(
                        "text-lg font-semibold",
                        result.portfolioImpact >= 0 ? "text-green-500" : "text-red-500"
                      )}>
                        {formatCurrency(result.portfolioImpact)}
                      </div>
                    </div>
                  </div>

                  {/* Impact Bar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Impact Severity</span>
                      <span>{Math.abs(result.portfolioImpact).toLocaleString()}</span>
                    </div>
                    <Progress 
                      value={Math.min(Math.abs(result.portfolioImpact) / 100000, 100)} 
                      className="h-2"
                    />
                  </div>

                  {/* Top Impacting Positions */}
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">
                      Top Impacting Positions
                    </div>
                    <div className="space-y-1">
                      {result.individualImpacts.slice(0, 3).map((impact, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="font-mono">{impact.symbol}</span>
                          <div className="flex items-center space-x-2">
                            <span className={cn(
                              impact.impact >= 0 ? "text-green-500" : "text-red-500"
                            )}>
                              {formatCurrency(impact.impact)}
                            </span>
                            <span className="text-muted-foreground">
                              ({formatPercentage(impact.percentage)})
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        {results.length > 0 && (
          <div className="border-t pt-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-500">
                  {results.filter(r => r.riskLevel === 'low').length}
                </div>
                <div className="text-xs text-muted-foreground">Low Risk</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-500">
                  {results.filter(r => r.riskLevel === 'medium').length}
                </div>
                <div className="text-xs text-muted-foreground">Medium Risk</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-500">
                  {results.filter(r => r.riskLevel === 'high' || r.riskLevel === 'critical').length}
                </div>
                <div className="text-xs text-muted-foreground">High Risk</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
