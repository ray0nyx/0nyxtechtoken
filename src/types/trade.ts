export interface Trade {
  id: string;
  user_id: string;
  symbol: string;
  position: 'long' | 'short';
  entry_date: string;
  exit_date: string;
  entry_price: number;
  exit_price: number;
  quantity: number;
  pnl: number;
  strategy: string;
  broker: string;
  notes?: string;
  tags?: string[];
  fees?: number;
  commission?: number;
  created_at?: string;
  updated_at?: string;
}

export interface TradeFormData {
  symbol: string;
  position: 'long' | 'short';
  entry_date: string;
  exit_date: string;
  entry_price: number;
  exit_price: number;
  quantity: number;
  strategy: string;
  broker: string;
  notes?: string;
  tags?: string;
  fees?: number;
  commission?: number;
}

export interface DatabaseTrade {
  id: string;
  user_id: string;
  symbol: string;
  open_date: string;
  close_date: string;
  entry_price: number;
  exit_price: number;
  net_pnl: number;
  zella_insights?: string;
  zella_scale?: number;
  created_at: string;
  updated_at: string;
}

export type TradeInput = Omit<Trade, 'id' | 'created_at' | 'updated_at'>;

export interface TradeWithDates extends Omit<Trade, 'entry_date' | 'exit_date'> {
  date: Date;
  entry_date: Date;
  exit_date: Date;
}

export interface Performance {
  winRate: number;
  profitableTrades: number;
  totalTrades: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  netPnl: number;      // Added for net profit/loss after fees
  totalFees: number;   // Added for total fees and commissions
}

export interface Strategy {
  id: string;
  name: string;
  trades: number;
  winRate: number;
  profitFactor: number;
} 