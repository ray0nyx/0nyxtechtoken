import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Play, Settings } from 'lucide-react';

interface OptimizationParameter {
  name: string;
  min: number;
  max: number;
  step: number;
  current: number;
}

interface OptimizationPanelProps {
  parameters: OptimizationParameter[];
  onParameterChange: (name: string, value: number) => void;
  onRunOptimization: () => void;
  isRunning: boolean;
}

export default function OptimizationPanel({
  parameters,
  onParameterChange,
  onRunOptimization,
  isRunning,
}: OptimizationPanelProps) {
  return (
    <Card className="bg-[#1a1f2e] border-[#1f2937]">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Optimization Parameters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {parameters.map((param) => (
          <div key={param.name} className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-[#9ca3af]">{param.name}</Label>
              <span className="text-sm text-white font-mono">{param.current}</span>
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                min={param.min}
                max={param.max}
                step={param.step}
                value={param.current}
                onChange={(e) => onParameterChange(param.name, parseFloat(e.target.value))}
                className="bg-[#0f1419] border-[#1f2937] text-white"
              />
              <div className="flex flex-col gap-1 text-xs text-[#6b7280]">
                <span>Min: {param.min}</span>
                <span>Max: {param.max}</span>
              </div>
            </div>
            <input
              type="range"
              min={param.min}
              max={param.max}
              step={param.step}
              value={param.current}
              onChange={(e) => onParameterChange(param.name, parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        ))}
        <Button
          onClick={onRunOptimization}
          disabled={isRunning}
          className="w-full bg-[#0ea5e9] hover:bg-[#0284c7] text-white"
        >
          <Play className="w-4 h-4 mr-2" />
          {isRunning ? 'Running Optimization...' : 'Run Optimization'}
        </Button>
      </CardContent>
    </Card>
  );
}

