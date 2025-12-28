import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, TrendingUp, TrendingDown } from 'lucide-react';
import {
  LineChart,
  Line,
  ResponsiveContainer,
} from 'recharts';

export interface BacktestResult {
  id: string;
  name: string;
  sharpeRatio: number;
  totalReturn: number;
  drawdown: number;
  date: string;
  status: 'completed' | 'running' | 'failed';
  equityCurve?: { timestamp: string; equity: number }[] | { date: string; value: number }[];
}

interface BacktestResultsTableProps {
  results: BacktestResult[];
  onViewReport: (id: string) => void;
}

export default function BacktestResultsTable({
  results,
  onViewReport,
}: BacktestResultsTableProps) {
  const generateSparkline = (result: BacktestResult) => {
    if (result.equityCurve && result.equityCurve.length > 0) {
      // Handle both data formats: { timestamp, equity } or { date, value }
      const firstItem = result.equityCurve[0];
      if ('timestamp' in firstItem && 'equity' in firstItem) {
        // Convert { timestamp, equity } to { date, value }
        return result.equityCurve.map((point: any) => ({
          date: new Date(point.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          value: point.equity,
        }));
      } else {
        // Already in { date, value } format
        return result.equityCurve as { date: string; value: number }[];
      }
    }
    // Generate mock sparkline if not provided
    const data = [];
    const baseValue = 100;
    for (let i = 0; i < 20; i++) {
      data.push({
        date: i.toString(),
        value: baseValue + (result.totalReturn / 20) * i + (Math.random() - 0.5) * 5,
      });
    }
    return data;
  };

  const getStatusColor = (status: BacktestResult['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-[#10b981] text-white';
      case 'running':
        return 'bg-[#0ea5e9] text-white';
      case 'failed':
        return 'bg-[#ef4444] text-white';
      default:
        return 'bg-[#6b7280] text-white';
    }
  };

  return (
    <div className="space-y-3">
      {results.map((result) => {
        const sparklineData = generateSparkline(result);
        const isPositive = result.totalReturn >= 0;
        
        return (
          <div
            key={result.id}
            className="flex items-center justify-between p-4 rounded-lg bg-[#1a1f2e] border border-[#1f2937] hover:border-[#0ea5e9] transition-colors"
          >
            <div className="flex items-center gap-4 flex-1 min-w-0">
              {/* Sparkline */}
              <div className="w-24 h-12 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparklineData}>
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={isPositive ? '#10b981' : '#ef4444'}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Backtest Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-medium text-white truncate">{result.name}</h3>
                  <Badge className={getStatusColor(result.status)}>
                    {result.status}
                  </Badge>
                </div>
                <p className="text-xs text-[#6b7280]">
                  {new Date(result.date).toLocaleDateString()}
                </p>
              </div>

              {/* Metrics */}
              <div className="flex items-center gap-6 flex-shrink-0">
                <div className="text-right">
                  <p className="text-xs text-[#6b7280] mb-1">Sharpe Ratio</p>
                  <p className="text-sm font-medium text-white">{result.sharpeRatio.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#6b7280] mb-1">Total Return</p>
                  <div className="flex items-center gap-1">
                    {isPositive ? (
                      <TrendingUp className="w-3 h-3 text-[#10b981]" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-[#ef4444]" />
                    )}
                    <p
                      className={`text-sm font-medium ${
                        isPositive ? 'text-[#10b981]' : 'text-[#ef4444]'
                      }`}
                    >
                      {isPositive ? '+' : ''}
                      {result.totalReturn.toFixed(2)}%
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#6b7280] mb-1">Max Drawdown</p>
                  <p className="text-sm font-medium text-[#ef4444]">
                    {result.drawdown.toFixed(2)}%
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewReport(result.id)}
                  className="text-[#0ea5e9] hover:text-[#0284c7]"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Report
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

