export interface DashboardTemplateConfig {
  showNetPnL: boolean;
  showTradeWinRate: boolean;
  showProfitFactor: boolean;
  showDayWinRate: boolean;
  showAvgWinLoss: boolean;
  showZellaScore: boolean;
  showCumulativePnL: boolean;
  showCalendar: boolean;
  showDrawdown: boolean;
  showTimePerformance: boolean;
  showDurationPerformance: boolean;
}

export interface DashboardTemplate {
  id: string;
  name: string;
  config: DashboardTemplateConfig;
} 