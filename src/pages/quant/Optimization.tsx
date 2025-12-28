import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import OptimizationPanel from '@/components/quant/OptimizationPanel';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
} from 'recharts';

interface OptimizationResult {
  sharpeRatio: number;
  totalReturn: number;
  maxDrawdown: number;
  parameter1: number;
  parameter2: number;
}

export default function Optimization() {
  const [parameters, setParameters] = useState([
    { name: 'Lookback Period', min: 5, max: 50, step: 5, current: 20 },
    { name: 'Threshold', min: 0.01, max: 0.1, step: 0.01, current: 0.05 },
    { name: 'Position Size', min: 0.1, max: 1.0, step: 0.1, current: 0.5 },
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<OptimizationResult[]>([]);

  const handleParameterChange = (name: string, value: number) => {
    setParameters(
      parameters.map((p) => (p.name === name ? { ...p, current: value } : p))
    );
  };

  const handleRunOptimization = async () => {
    setIsRunning(true);
    // Simulate optimization run
    // TODO: Replace with actual optimization API call
    setTimeout(() => {
      const mockResults: OptimizationResult[] = [];
      for (let i = 0; i < 50; i++) {
        mockResults.push({
          sharpeRatio: Math.random() * 3,
          totalReturn: Math.random() * 50,
          maxDrawdown: -(Math.random() * 20),
          parameter1: Math.random() * 45 + 5,
          parameter2: Math.random() * 0.09 + 0.01,
        });
      }
      setResults(mockResults);
      setIsRunning(false);
    }, 2000);
  };

  return (
    <div className="p-6 space-y-6 h-full">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Optimization</h1>
        <p className="text-[#9ca3af] mt-1">Find optimal parameters for your strategies</p>
      </div>

      {/* Two Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[600px]">
        {/* Left Panel - Controls */}
        <div className="lg:col-span-1">
          <OptimizationPanel
            parameters={parameters}
            onParameterChange={handleParameterChange}
            onRunOptimization={handleRunOptimization}
            isRunning={isRunning}
          />
        </div>

        {/* Right Panel - Results */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-[#1a1f2e] border-[#1f2937]">
            <CardHeader>
              <CardTitle className="text-white">Optimization Results</CardTitle>
            </CardHeader>
            <CardContent>
              {results.length > 0 ? (
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis
                        type="number"
                        dataKey="parameter1"
                        name="Lookback Period"
                        stroke="#6b7280"
                        label={{ value: 'Lookback Period', position: 'insideBottom', offset: -5, fill: '#9ca3af' }}
                      />
                      <YAxis
                        type="number"
                        dataKey="parameter2"
                        name="Threshold"
                        stroke="#6b7280"
                        label={{ value: 'Threshold', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
                      />
                      <ZAxis
                        type="number"
                        dataKey="sharpeRatio"
                        range={[50, 500]}
                        name="Sharpe Ratio"
                      />
                      <Tooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        contentStyle={{
                          backgroundColor: '#1a1f2e',
                          border: '1px solid #1f2937',
                          borderRadius: '8px',
                        }}
                        labelStyle={{ color: '#9ca3af' }}
                      />
                      <Scatter
                        name="Results"
                        data={results}
                        fill="#0ea5e9"
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[400px] flex items-center justify-center text-[#6b7280]">
                  <p>Run optimization to see results</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Best Results Table */}
          {results.length > 0 && (
            <Card className="bg-[#1a1f2e] border-[#1f2937]">
              <CardHeader>
                <CardTitle className="text-white">Top 5 Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {results
                    .sort((a, b) => b.sharpeRatio - a.sharpeRatio)
                    .slice(0, 5)
                    .map((result, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 rounded-lg bg-[#0f1419] border border-[#1f2937]"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-lg bg-[#0ea5e9]/20 flex items-center justify-center text-[#0ea5e9] font-bold">
                            {index + 1}
                          </div>
                          <div>
                            <p className="text-sm text-white">
                              Lookback: {result.parameter1.toFixed(0)}, Threshold:{' '}
                              {result.parameter2.toFixed(3)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-xs text-[#6b7280]">Sharpe</p>
                            <p className="text-sm font-medium text-white">
                              {result.sharpeRatio.toFixed(2)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-[#6b7280]">Return</p>
                            <p className="text-sm font-medium text-[#10b981]">
                              +{result.totalReturn.toFixed(2)}%
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-[#6b7280]">Drawdown</p>
                            <p className="text-sm font-medium text-[#ef4444]">
                              {result.maxDrawdown.toFixed(2)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

