import { Strategy } from "@/types/trade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Lightbulb } from "lucide-react";

interface StrategyPerformanceProps {
  strategies: Strategy[];
}

const StrategyPerformance = ({ strategies }: StrategyPerformanceProps) => {
  const sortedStrategies = [...strategies]
    .filter(strategy => strategy.trades > 0)
    .sort((a, b) => b.profitFactor - a.profitFactor);

  return (
    <Card className="animate-fade-in">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center">
          <Lightbulb className="h-5 w-5 text-primary mr-2" />
          Strategy Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sortedStrategies.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground">
              No strategy data available
            </div>
          ) : (
            sortedStrategies.map((strategy) => (
              <div key={strategy.id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm">{strategy.name}</div>
                  <div className="text-sm text-muted-foreground">{strategy.trades} trades</div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="text-muted-foreground">Win Rate</div>
                  <div className={`font-medium ${getWinRateColorClass(strategy.winRate)}`}>
                    {strategy.winRate}%
                  </div>
                </div>
                <Progress
                  value={strategy.winRate}
                  className={`h-2 ${getProgressColorClass(strategy.winRate)}`}
                />
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const getWinRateColorClass = (winRate: number): string => {
  if (winRate >= 65) return "text-green-600";
  if (winRate >= 50) return "text-amber-600";
  return "text-destructive";
};

const getProgressColorClass = (winRate: number): string => {
  if (winRate >= 65) return "bg-green-600";
  if (winRate >= 50) return "bg-amber-600";
  return "bg-destructive";
};

export default StrategyPerformance;
