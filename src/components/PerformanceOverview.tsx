import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Performance } from "@/types/trade";
import { TrendingUp, TrendingDown, DollarSign, BarChart2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface PerformanceOverviewProps {
  performance: Performance;
}

const PerformanceOverview = ({ performance }: PerformanceOverviewProps) => {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-bold">Win Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{performance.winRate.toFixed(1)}%</div>
          <p className="text-xs text-muted-foreground">
            {performance.profitableTrades} of {performance.totalTrades} trades
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-bold">Net P&L</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${performance.netPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(performance.netPnl)}
          </div>
          <p className="text-xs text-muted-foreground">
            After fees & commissions
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-bold">Total Fees</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-muted-foreground">
            {formatCurrency(performance.totalFees)}
          </div>
          <p className="text-xs text-muted-foreground">
            Avg {formatCurrency(performance.totalFees / performance.totalTrades)} per trade
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-bold">Profit Factor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{performance.profitFactor.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">
            Gross profit / Gross loss
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

interface MetricCardProps {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  trend: "positive" | "negative" | "neutral";
}

const MetricCard = ({ title, value, description, icon, trend }: MetricCardProps) => {
  return (
    <Card className="overflow-hidden transition-all duration-200 hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {value}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {description}
        </p>
        {trend !== "neutral" && (
          <div className={`mt-2 inline-flex items-center text-xs ${
            trend === "positive" ? "text-secondary" : "text-destructive"
          }`}>
            {trend === "positive" ? (
              <>
                <TrendingUp className="h-3 w-3 mr-1" />
                <span>Good</span>
              </>
            ) : (
              <>
                <TrendingDown className="h-3 w-3 mr-1" />
                <span>Needs improvement</span>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PerformanceOverview;
