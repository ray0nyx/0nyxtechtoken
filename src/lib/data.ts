import { Trade, Performance, Strategy } from '@/types/trade';

const currentDate = new Date();
const yesterday = new Date(currentDate);
yesterday.setDate(currentDate.getDate() - 1);

export const mockTrades: Trade[] = [
  {
    id: "1",
    user_id: "mock-user",
    symbol: "AAPL",
    position: "long",
    date: currentDate,
    entry_date: yesterday,
    exit_date: currentDate,
    entry_price: 150.25,
    exit_price: 155.75,
    quantity: 100,
    pnl: 550,
    strategy: "Momentum",
    broker: "TradeZero",
    notes: "Strong earnings breakout",
    tags: ["momentum", "earnings"]
  },
  {
    id: "2",
    user_id: "mock-user",
    symbol: "TSLA",
    position: "short",
    date: currentDate,
    entry_date: yesterday,
    exit_date: currentDate,
    entry_price: 242.50,
    exit_price: 238.30,
    quantity: 50,
    pnl: 210,
    strategy: "Mean Reversion",
    broker: "Interactive Brokers",
    notes: "Overbought conditions",
    tags: ["mean-reversion", "technical"]
  }
];

export const mockPerformance: Performance = {
  winRate: 65,
  profitableTrades: 13,
  totalTrades: 20,
  profitFactor: 2.5,
  averageWin: 550,
  averageLoss: 220,
  largestWin: 1200,
  largestLoss: -450,
  netPnl: 4850,
  totalFees: 150
};

export const mockStrategies: Strategy[] = [
  {
    id: "1",
    name: "Momentum",
    trades: 12,
    winRate: 75,
    profitFactor: 3.2
  },
  {
    id: "2",
    name: "Mean Reversion",
    trades: 8,
    winRate: 62.5,
    profitFactor: 2.1
  }
];

export const getTradeById = (id: string): Trade | undefined => {
  return mockTrades.find(trade => trade.id === id);
};

interface StrategySummary {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnl: number;
  averagePnl: number;
}

export const getStrategySummary = (strategyName: string): StrategySummary => {
  const strategyTrades = mockTrades.filter(trade => trade.strategy === strategyName);
  const winningTrades = strategyTrades.filter(trade => trade.pnl > 0);
  const losingTrades = strategyTrades.filter(trade => trade.pnl < 0);
  
  const totalPnl = strategyTrades.reduce((sum, trade) => sum + trade.pnl, 0);
  const winRate = strategyTrades.length ? (winningTrades.length / strategyTrades.length) * 100 : 0;
  
  return {
    totalTrades: strategyTrades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate,
    totalPnl,
    averagePnl: strategyTrades.length ? totalPnl / strategyTrades.length : 0
  };
};
