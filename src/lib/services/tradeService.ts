import { supabase } from '@/lib/supabase';
import { Trade, DatabaseTrade } from '@/types/trade';

export const tradeService = {
  async getTrades(options: {
    dateRange?: string;
    account?: string;
    page?: number;
    perPage?: number;
  } = {}) {
    const {
      dateRange = 'all',
      account = 'all',
      page = 1,
      perPage = 50
    } = options;

    let query = supabase
      .from('trades')
      .select('*', { count: 'exact' });

    // Apply date range filter
    if (dateRange !== 'all') {
      const now = new Date();
      let startDate = new Date();

      switch (dateRange) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
      }

      query = query.gte('open_date', startDate.toISOString());
    }

    // Apply account filter
    if (account !== 'all') {
      query = query.eq('user_id', account);
    }

    // Apply pagination
    const start = (page - 1) * perPage;
    query = query
      .order('open_date', { ascending: false })
      .range(start, start + perPage - 1);

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    const dbTrades = data as unknown as DatabaseTrade[];
    return {
      trades: dbTrades?.map(trade => ({
        id: trade.id,
        openDate: new Date(trade.open_date),
        symbol: trade.symbol,
        status: trade.net_pnl > 0 ? 'WIN' : 'LOSS',
        closeDate: new Date(trade.close_date),
        entryPrice: trade.entry_price,
        exitPrice: trade.exit_price,
        netPnL: trade.net_pnl,
        netROI: (trade.net_pnl / trade.entry_price) * 100,
        zellaInsights: trade.zella_insights,
        zellaScale: trade.zella_scale,
      })) as Trade[],
      total: count || 0,
    };
  },

  async getTradeStats() {
    const { data, error } = await supabase
      .from('trades')
      .select('net_pnl');

    if (error) {
      throw error;
    }

    const dbTrades = data as unknown as Pick<DatabaseTrade, 'net_pnl'>[];
    const winningTrades = dbTrades.filter(t => t.net_pnl > 0);
    const losingTrades = dbTrades.filter(t => t.net_pnl < 0);

    const totalWins = winningTrades.length;
    const totalLosses = losingTrades.length;
    const totalTrades = dbTrades.length;

    const totalProfits = winningTrades.reduce((sum, t) => sum + t.net_pnl, 0);
    const absoluteLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.net_pnl, 0));

    return {
      netPnL: dbTrades.reduce((sum, t) => sum + t.net_pnl, 0),
      profitFactor: absoluteLosses ? totalProfits / absoluteLosses : totalProfits || 0,
      winRate: totalTrades ? (totalWins / totalTrades) * 100 : 0,
      avgWinLoss: absoluteLosses ? totalProfits / absoluteLosses : 0,
      totalWins,
      totalLosses,
    };
  },
}; 