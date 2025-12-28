import { supabase } from '@/lib/supabase';

export interface TradeAnalytics {
  id: string;
  symbol: string;
  position: string;
  entry_date: string;
  exit_date: string;
  entry_price: number;
  exit_price: number;
  quantity: number;
  pnl: number;
  strategy: string | null;
  broker: string;
  notes: string | null;
  tags: string[] | null;
  fees: number | null;
  buyFillId: string | null;
  sellFillId: string | null;
  buyPrice: number | null;
  sellPrice: number | null;
  boughtTimestamp: string | null;
  soldTimestamp: string | null;
  duration: number | null;
}

export async function fetchTradeAnalytics(userId: string): Promise<TradeAnalytics[]> {
  const { data, error } = await supabase
    .from('trades')
    .select(`
      id,
      symbol,
      position,
      entry_date,
      exit_date,
      entry_price,
      exit_price,
      quantity,
      pnl,
      strategy,
      broker,
      notes,
      tags,
      fees,
      buyFillId,
      sellFillId,
      buyPrice,
      sellPrice,
      boughtTimestamp,
      soldTimestamp,
      duration
    `)
    .eq('user_id', userId)
    .order('entry_date', { ascending: false });

  if (error) {
    console.error('Error fetching trade analytics:', error);
    throw new Error(`Failed to fetch trade analytics: ${error.message}`);
  }

  return data || [];
}

export function calculateDurationMetrics(trades: TradeAnalytics[]) {
  if (!trades || trades.length === 0) {
    return {
      averageDuration: 0,
      shortestTrade: 0,
      longestTrade: 0,
      durationDistribution: []
    };
  }

  // Filter trades with valid duration
  const tradesWithDuration = trades.filter(trade => trade.duration !== null && trade.duration > 0);
  
  if (tradesWithDuration.length === 0) {
    return {
      averageDuration: 0,
      shortestTrade: 0,
      longestTrade: 0,
      durationDistribution: []
    };
  }

  // Calculate metrics
  const durations = tradesWithDuration.map(trade => trade.duration || 0);
  const totalDuration = durations.reduce((sum, duration) => sum + duration, 0);
  const averageDuration = totalDuration / durations.length;
  const shortestTrade = Math.min(...durations);
  const longestTrade = Math.max(...durations);

  // Create duration distribution (in minutes)
  const durationRanges = [
    { label: '< 1 min', count: 0 },
    { label: '1-5 mins', count: 0 },
    { label: '5-15 mins', count: 0 },
    { label: '15-30 mins', count: 0 },
    { label: '30-60 mins', count: 0 },
    { label: '1-4 hours', count: 0 },
    { label: '4+ hours', count: 0 }
  ];

  durations.forEach(duration => {
    const durationMinutes = duration / 60;
    
    if (durationMinutes < 1) {
      durationRanges[0].count++;
    } else if (durationMinutes < 5) {
      durationRanges[1].count++;
    } else if (durationMinutes < 15) {
      durationRanges[2].count++;
    } else if (durationMinutes < 30) {
      durationRanges[3].count++;
    } else if (durationMinutes < 60) {
      durationRanges[4].count++;
    } else if (durationMinutes < 240) {
      durationRanges[5].count++;
    } else {
      durationRanges[6].count++;
    }
  });

  return {
    averageDuration,
    shortestTrade,
    longestTrade,
    durationDistribution: durationRanges
  };
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === 0) {
    return 'N/A';
  }
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${remainingSeconds}s`;
  }
} 