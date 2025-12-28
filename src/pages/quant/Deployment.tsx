import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import DeploymentPanel from '@/components/quant/DeploymentPanel';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Activity, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
}

export default function Deployment() {
  const [selectedAlgorithm, setSelectedAlgorithm] = useState('mean-reversion');
  const [isDeployed, setIsDeployed] = useState(false);
  const [capital, setCapital] = useState(10000);
  const [riskLevel, setRiskLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [enableStopLoss, setEnableStopLoss] = useState(true);
  const [stopLossPercent, setStopLossPercent] = useState(5);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<'idle' | 'running' | 'stopped' | 'error'>('idle');

  useEffect(() => {
    if (isDeployed) {
      // Simulate log generation
      const interval = setInterval(() => {
        const levels: LogEntry['level'][] = ['info', 'success', 'warning'];
        const messages = [
          'Order executed: BUY 0.1 BTC at $45,230',
          'Position updated: +$125.50',
          'Stop loss check: Position safe',
          'Market data received: Latest price $45,280',
          'Strategy signal: HOLD',
        ];
        const newLog: LogEntry = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          level: levels[Math.floor(Math.random() * levels.length)],
          message: messages[Math.floor(Math.random() * messages.length)],
        };
        setLogs((prev) => [newLog, ...prev].slice(0, 100)); // Keep last 100 logs
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [isDeployed]);

  const handleDeploy = () => {
    setIsDeployed(true);
    setStatus('running');
    setLogs([
      {
        id: '1',
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Deployment started...',
      },
      {
        id: '2',
        timestamp: new Date().toISOString(),
        level: 'success',
        message: 'Algorithm loaded successfully',
      },
      {
        id: '3',
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Connecting to exchange...',
      },
    ]);
    // TODO: Call actual deployment API
  };

  const handleStop = () => {
    setIsDeployed(false);
    setStatus('stopped');
    setLogs((prev) => [
      {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        level: 'warning',
        message: 'Deployment stopped by user',
      },
      ...prev,
    ]);
    // TODO: Call actual stop API
  };

  const getLogIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-[#10b981]" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-[#f59e0b]" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-[#ef4444]" />;
      default:
        return <Activity className="w-4 h-4 text-[#0ea5e9]" />;
    }
  };

  const getLogColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'success':
        return 'text-[#10b981]';
      case 'warning':
        return 'text-[#f59e0b]';
      case 'error':
        return 'text-[#ef4444]';
      default:
        return 'text-[#0ea5e9]';
    }
  };

  return (
    <div className="p-6 space-y-6 h-full">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Deployment</h1>
        <p className="text-[#9ca3af] mt-1">Deploy and monitor live trading strategies</p>
      </div>

      {/* Two Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[600px]">
        {/* Left Panel - Settings */}
        <div className="lg:col-span-1">
          <DeploymentPanel
            selectedAlgorithm={selectedAlgorithm}
            onAlgorithmChange={setSelectedAlgorithm}
            isDeployed={isDeployed}
            onDeploy={handleDeploy}
            onStop={handleStop}
            capital={capital}
            onCapitalChange={setCapital}
            riskLevel={riskLevel}
            onRiskLevelChange={setRiskLevel}
            enableStopLoss={enableStopLoss}
            onStopLossToggle={setEnableStopLoss}
            stopLossPercent={stopLossPercent}
            onStopLossPercentChange={setStopLossPercent}
          />
        </div>

        {/* Right Panel - Logs */}
        <div className="lg:col-span-2">
          <Card className="bg-[#1a1f2e] border-[#1f2937] h-full flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">Deployment Logs</CardTitle>
                <Badge
                  className={
                    status === 'running'
                      ? 'bg-[#10b981] text-white'
                      : status === 'error'
                      ? 'bg-[#ef4444] text-white'
                      : 'bg-[#6b7280] text-white'
                  }
                >
                  {status === 'running' ? 'Running' : status === 'error' ? 'Error' : 'Idle'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  {logs.length > 0 ? (
                    logs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-start gap-3 p-3 rounded-lg bg-[#0f1419] border border-[#1f2937]"
                      >
                        {getLogIcon(log.level)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-[#6b7280] font-mono">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-xs border-0 ${getLogColor(log.level)}`}
                            >
                              {log.level.toUpperCase()}
                            </Badge>
                          </div>
                          <p className={`text-sm ${getLogColor(log.level)}`}>{log.message}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-[#6b7280]">
                      <p>No logs yet. Deploy a strategy to see activity.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

