import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Play, Square, Settings } from 'lucide-react';

interface DeploymentPanelProps {
  selectedAlgorithm: string;
  onAlgorithmChange: (algorithm: string) => void;
  isDeployed: boolean;
  onDeploy: () => void;
  onStop: () => void;
  capital: number;
  onCapitalChange: (capital: number) => void;
  riskLevel: 'low' | 'medium' | 'high';
  onRiskLevelChange: (level: 'low' | 'medium' | 'high') => void;
  enableStopLoss: boolean;
  onStopLossToggle: (enabled: boolean) => void;
  stopLossPercent: number;
  onStopLossPercentChange: (percent: number) => void;
}

export default function DeploymentPanel({
  selectedAlgorithm,
  onAlgorithmChange,
  isDeployed,
  onDeploy,
  onStop,
  capital,
  onCapitalChange,
  riskLevel,
  onRiskLevelChange,
  enableStopLoss,
  onStopLossToggle,
  stopLossPercent,
  onStopLossPercentChange,
}: DeploymentPanelProps) {
  return (
    <Card className="bg-[#1a1f2e] border-[#1f2937]">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Deployment Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm text-[#9ca3af]">Algorithm</Label>
          <Select value={selectedAlgorithm} onValueChange={onAlgorithmChange}>
            <SelectTrigger className="bg-[#0f1419] border-[#1f2937] text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1f2e] border-[#1f2937]">
              <SelectItem value="mean-reversion">Mean Reversion Strategy</SelectItem>
              <SelectItem value="momentum">Momentum Trading Bot</SelectItem>
              <SelectItem value="grid">Grid Trading Bot</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm text-[#9ca3af]">Initial Capital</Label>
          <Input
            type="number"
            value={capital}
            onChange={(e) => onCapitalChange(parseFloat(e.target.value))}
            className="bg-[#0f1419] border-[#1f2937] text-white"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm text-[#9ca3af]">Risk Level</Label>
          <Select value={riskLevel} onValueChange={(v: any) => onRiskLevelChange(v)}>
            <SelectTrigger className="bg-[#0f1419] border-[#1f2937] text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1f2e] border-[#1f2937]">
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3 pt-4 border-t border-[#1f2937]">
          <div className="flex items-center justify-between">
            <Label className="text-sm text-[#9ca3af]">Enable Stop Loss</Label>
            <Switch
              checked={enableStopLoss}
              onCheckedChange={onStopLossToggle}
            />
          </div>
          {enableStopLoss && (
            <div className="space-y-2">
              <Label className="text-sm text-[#9ca3af]">Stop Loss (%)</Label>
              <Input
                type="number"
                value={stopLossPercent}
                onChange={(e) => onStopLossPercentChange(parseFloat(e.target.value))}
                className="bg-[#0f1419] border-[#1f2937] text-white"
              />
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-[#1f2937]">
          {!isDeployed ? (
            <Button
              onClick={onDeploy}
              className="w-full bg-[#10b981] hover:bg-[#059669] text-white"
            >
              <Play className="w-4 h-4 mr-2" />
              Deploy to Live Trading
            </Button>
          ) : (
            <Button
              onClick={onStop}
              className="w-full bg-[#ef4444] hover:bg-[#dc2626] text-white"
            >
              <Square className="w-4 h-4 mr-2" />
              Stop Deployment
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

