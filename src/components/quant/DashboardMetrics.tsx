import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Activity, FileCode } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ElementType;
  subtitle?: string;
}

function MetricCard({ title, value, change, icon: Icon, subtitle }: MetricCardProps) {
  const isPositive = change !== undefined && change >= 0;
  
  return (
    <Card className="bg-[#1a1f2e] border-[#1f2937]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-[#9ca3af]">{title}</CardTitle>
        <Icon className="h-4 w-4 text-[#6b7280]" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-white">{value}</div>
        {change !== undefined && (
          <p className={cn(
            "text-xs mt-1 flex items-center gap-1",
            isPositive ? "text-[#10b981]" : "text-[#ef4444]"
          )}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {isPositive ? '+' : ''}{change.toFixed(2)}%
          </p>
        )}
        {subtitle && (
          <p className="text-xs text-[#6b7280] mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

interface DashboardMetricsProps {
  portfolioValue: number;
  portfolioChange: number;
  activeAlgorithms: number;
  recentBacktests: number;
  sharpeRatio: number;
  totalReturn: number;
  maxDrawdown: number;
}

export default function DashboardMetrics({
  portfolioValue,
  portfolioChange,
  activeAlgorithms,
  recentBacktests,
  sharpeRatio,
  totalReturn,
  maxDrawdown,
}: DashboardMetricsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Portfolio Value"
        value={`$${portfolioValue.toLocaleString()}`}
        change={portfolioChange}
        icon={Activity}
        subtitle="Total equity"
      />
      <MetricCard
        title="Active Algorithms"
        value={activeAlgorithms}
        icon={FileCode}
        subtitle="Currently running"
      />
      <MetricCard
        title="Sharpe Ratio"
        value={sharpeRatio.toFixed(2)}
        icon={TrendingUp}
        subtitle="Risk-adjusted return"
      />
      <MetricCard
        title="Total Return"
        value={`${totalReturn.toFixed(2)}%`}
        change={totalReturn}
        icon={TrendingUp}
        subtitle="All-time performance"
      />
    </div>
  );
}

