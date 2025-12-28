import { cn } from "@/lib/utils";

interface TradingCalendarCellProps {
  date: Date;
  trades: number;
  pnl: number;
  winRate: number;
  isCurrentMonth: boolean;
}

export function TradingCalendarCell({
  date,
  trades,
  pnl,
  winRate,
  isCurrentMonth,
}: TradingCalendarCellProps) {
  const isPositive = pnl > 0;
  const intensity = Math.min(Math.abs(pnl) / 1000, 1); // Normalize PnL for color intensity

  return (
    <div
      className={cn(
        "aspect-square p-2 rounded-lg transition-colors",
        isCurrentMonth ? "opacity-100" : "opacity-30",
        trades === 0 && "bg-muted",
        trades > 0 && isPositive && `bg-green-500/${Math.round(intensity * 100)}`,
        trades > 0 && !isPositive && `bg-red-500/${Math.round(intensity * 100)}`,
      )}
    >
      <div className="flex flex-col h-full">
        <span className="text-sm font-medium">{date.getDate()}</span>
        {trades > 0 && (
          <>
            <span className={cn(
              "text-sm font-bold",
              isPositive ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"
            )}>
              ${pnl.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
            <div className="mt-auto text-xs">
              <span className="text-muted-foreground">{trades} trades</span>
              <span className="text-muted-foreground ml-1">
                ({Math.round(winRate)}%)
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
} 