import { supabase } from '@/lib/supabase';

export interface TradeData {
  id: string;
  user_id: string;
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  entry_price: number;
  exit_price: number;
  pnl: number;
  net_pnl: number;
  entry_date: string;
  exit_date: string;
  strategy?: string;
  asset_class?: string;
  created_at: string;
}

export interface AnalyticsData {
  totalPnL: number;
  dailyPnL: number;
  monthlyPnL: number;
  winRate: number;
  totalTrades: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio: number;
  tradesPerDay: number;
  monthlyReturn: number;
  volatility: number;
}

export interface TimeSeriesData {
  date: string;
  pnl: number;
  cumulativePnL: number;
  tradeCount: number;
  winRate: number;
}

export interface HeatmapData {
  x: string;
  y: string;
  value: number;
  count: number;
}

export interface StrategyPerformance {
  strategy: string;
  pnl: number;
  tradeCount: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
}

export interface AssetExposure {
  asset_class: string;
  exposure: number;
  pnl: number;
  tradeCount: number;
}

class AnalyticsService {
  private async getTrades(filters: any = {}): Promise<TradeData[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      let query = supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id);

      // Apply filters
      if (filters.startDate) {
        query = query.gte('entry_date', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('entry_date', filters.endDate);
      }
      if (filters.strategy) {
        query = query.eq('strategy', filters.strategy);
      }
      if (filters.assetClass) {
        query = query.eq('asset_class', filters.assetClass);
      }

      const { data, error } = await query.order('entry_date', { ascending: true });
      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching trades:', error);
      return [];
    }
  }

  async getKPIData(metric: string, filters: any = {}): Promise<{ current: number; previous?: number }> {
    const trades = await this.getTrades(filters);
    
    if (trades.length === 0) {
      return { current: 0 };
    }

    const currentPeriod = this.calculateMetric(trades, metric);
    
    // Calculate previous period for comparison
    const previousPeriod = this.getPreviousPeriod(filters);
    const previousTrades = await this.getTrades({
      ...filters,
      startDate: previousPeriod.start,
      endDate: previousPeriod.end
    });
    const previousValue = previousTrades.length > 0 ? this.calculateMetric(previousTrades, metric) : 0;

    return {
      current: currentPeriod,
      previous: previousValue
    };
  }

  private calculateMetric(trades: TradeData[], metric: string): number {
    switch (metric) {
      case 'total_pnl':
        return trades.reduce((sum, trade) => sum + (trade.net_pnl || 0), 0);
      
      case 'daily_pnl':
        const today = new Date().toISOString().split('T')[0];
        return trades
          .filter(trade => trade.entry_date === today)
          .reduce((sum, trade) => sum + (trade.net_pnl || 0), 0);
      
      case 'monthly_pnl':
        const thisMonth = new Date().toISOString().substring(0, 7);
        return trades
          .filter(trade => trade.entry_date.startsWith(thisMonth))
          .reduce((sum, trade) => sum + (trade.net_pnl || 0), 0);
      
      case 'win_rate':
        const winningTrades = trades.filter(trade => (trade.net_pnl || 0) > 0).length;
        return trades.length > 0 ? (winningTrades / trades.length) * 100 : 0;
      
      case 'total_trades':
        return trades.length;
      
      case 'avg_win':
        const wins = trades.filter(trade => (trade.net_pnl || 0) > 0);
        return wins.length > 0 ? wins.reduce((sum, trade) => sum + (trade.net_pnl || 0), 0) / wins.length : 0;
      
      case 'avg_loss':
        const losses = trades.filter(trade => (trade.net_pnl || 0) < 0);
        return losses.length > 0 ? losses.reduce((sum, trade) => sum + (trade.net_pnl || 0), 0) / losses.length : 0;
      
      case 'profit_factor':
        const totalWins = trades.filter(t => (t.net_pnl || 0) > 0).reduce((sum, t) => sum + (t.net_pnl || 0), 0);
        const totalLosses = Math.abs(trades.filter(t => (t.net_pnl || 0) < 0).reduce((sum, t) => sum + (t.net_pnl || 0), 0));
        return totalLosses > 0 ? totalWins / totalLosses : 0;
      
      case 'max_drawdown':
        return this.calculateMaxDrawdown(trades);
      
      case 'sharpe_ratio':
        return this.calculateSharpeRatio(trades);
      
      case 'trades_per_day':
        const days = this.getUniqueDays(trades);
        return days > 0 ? trades.length / days : 0;
      
      case 'volatility':
        return this.calculateVolatility(trades);
      
      default:
        return 0;
    }
  }

  private calculateMaxDrawdown(trades: TradeData[]): number {
    let peak = 0;
    let maxDrawdown = 0;
    let runningPnL = 0;

    for (const trade of trades) {
      runningPnL += trade.net_pnl || 0;
      if (runningPnL > peak) {
        peak = runningPnL;
      }
      const drawdown = peak - runningPnL;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return peak > 0 ? (maxDrawdown / peak) * 100 : 0;
  }

  private calculateSharpeRatio(trades: TradeData[]): number {
    if (trades.length < 2) return 0;

    const returns = trades.map(trade => trade.net_pnl || 0);
    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / (returns.length - 1);
    const stdDev = Math.sqrt(variance);

    return stdDev > 0 ? avgReturn / stdDev : 0;
  }

  private calculateVolatility(trades: TradeData[]): number {
    if (trades.length < 2) return 0;

    const returns = trades.map(trade => trade.net_pnl || 0);
    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / (returns.length - 1);
    
    return Math.sqrt(variance);
  }

  private getUniqueDays(trades: TradeData[]): number {
    const uniqueDays = new Set(trades.map(trade => trade.entry_date));
    return uniqueDays.size;
  }

  private getPreviousPeriod(filters: any): { start: string; end: string } {
    const { startDate, endDate } = filters;
    if (!startDate || !endDate) {
      // Default to previous 30 days
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
      };
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const duration = end.getTime() - start.getTime();
    
    return {
      start: new Date(start.getTime() - duration).toISOString().split('T')[0],
      end: startDate
    };
  }

  async getTimeSeriesData(filters: any = {}): Promise<TimeSeriesData[]> {
    const trades = await this.getTrades(filters);
    
    // Group trades by date
    const groupedTrades = trades.reduce((acc, trade) => {
      const date = trade.entry_date;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(trade);
      return acc;
    }, {} as Record<string, TradeData[]>);

    // Convert to time series data
    let cumulativePnL = 0;
    return Object.entries(groupedTrades)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, dayTrades]) => {
        const dayPnL = dayTrades.reduce((sum, trade) => sum + (trade.net_pnl || 0), 0);
        cumulativePnL += dayPnL;
        const winRate = dayTrades.length > 0 
          ? (dayTrades.filter(t => (t.net_pnl || 0) > 0).length / dayTrades.length) * 100 
          : 0;

        return {
          date,
          pnl: dayPnL,
          cumulativePnL,
          tradeCount: dayTrades.length,
          winRate
        };
      });
  }

  async getHeatmapData(type: string, filters: any = {}): Promise<HeatmapData[]> {
    const trades = await this.getTrades(filters);
    
    switch (type) {
      case 'hour_day':
        return this.getHourDayHeatmap(trades);
      case 'day_week':
        return this.getDayWeekHeatmap(trades);
      case 'month_year':
        return this.getMonthYearHeatmap(trades);
      case 'strategy_asset':
        return this.getStrategyAssetHeatmap(trades);
      default:
        return [];
    }
  }

  private getHourDayHeatmap(trades: TradeData[]): HeatmapData[] {
    const data: Record<string, { pnl: number; count: number }> = {};
    
    trades.forEach(trade => {
      const date = new Date(trade.entry_date);
      const hour = date.getHours();
      const dayOfWeek = date.getDay();
      const key = `${hour}-${dayOfWeek}`;
      
      if (!data[key]) {
        data[key] = { pnl: 0, count: 0 };
      }
      data[key].pnl += trade.net_pnl || 0;
      data[key].count += 1;
    });

    return Object.entries(data).map(([key, value]) => {
      const [hour, day] = key.split('-');
      return {
        x: hour,
        y: day,
        value: value.pnl,
        count: value.count
      };
    });
  }

  private getDayWeekHeatmap(trades: TradeData[]): HeatmapData[] {
    const data: Record<string, { pnl: number; count: number }> = {};
    
    trades.forEach(trade => {
      const date = new Date(trade.entry_date);
      const dayOfWeek = date.getDay();
      const week = this.getWeekNumber(date);
      const key = `${dayOfWeek}-${week}`;
      
      if (!data[key]) {
        data[key] = { pnl: 0, count: 0 };
      }
      data[key].pnl += trade.net_pnl || 0;
      data[key].count += 1;
    });

    return Object.entries(data).map(([key, value]) => {
      const [day, week] = key.split('-');
      return {
        x: day,
        y: week,
        value: value.pnl,
        count: value.count
      };
    });
  }

  private getMonthYearHeatmap(trades: TradeData[]): HeatmapData[] {
    const data: Record<string, { pnl: number; count: number }> = {};
    
    trades.forEach(trade => {
      const date = new Date(trade.entry_date);
      const month = date.getMonth();
      const year = date.getFullYear();
      const key = `${month}-${year}`;
      
      if (!data[key]) {
        data[key] = { pnl: 0, count: 0 };
      }
      data[key].pnl += trade.net_pnl || 0;
      data[key].count += 1;
    });

    return Object.entries(data).map(([key, value]) => {
      const [month, year] = key.split('-');
      return {
        x: month,
        y: year,
        value: value.pnl,
        count: value.count
      };
    });
  }

  private getStrategyAssetHeatmap(trades: TradeData[]): HeatmapData[] {
    const data: Record<string, { pnl: number; count: number }> = {};
    
    trades.forEach(trade => {
      const strategy = trade.strategy || 'Unknown';
      const asset = trade.asset_class || 'Unknown';
      const key = `${strategy}-${asset}`;
      
      if (!data[key]) {
        data[key] = { pnl: 0, count: 0 };
      }
      data[key].pnl += trade.net_pnl || 0;
      data[key].count += 1;
    });

    return Object.entries(data).map(([key, value]) => {
      const [strategy, asset] = key.split('-');
      return {
        x: strategy,
        y: asset,
        value: value.pnl,
        count: value.count
      };
    });
  }

  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  async getStrategyPerformance(filters: any = {}): Promise<StrategyPerformance[]> {
    const trades = await this.getTrades(filters);
    
    const strategyData: Record<string, TradeData[]> = {};
    trades.forEach(trade => {
      const strategy = trade.strategy || 'Unknown';
      if (!strategyData[strategy]) {
        strategyData[strategy] = [];
      }
      strategyData[strategy].push(trade);
    });

    return Object.entries(strategyData).map(([strategy, strategyTrades]) => {
      const pnl = strategyTrades.reduce((sum, trade) => sum + (trade.net_pnl || 0), 0);
      const wins = strategyTrades.filter(trade => (trade.net_pnl || 0) > 0);
      const losses = strategyTrades.filter(trade => (trade.net_pnl || 0) < 0);
      
      return {
        strategy,
        pnl,
        tradeCount: strategyTrades.length,
        winRate: strategyTrades.length > 0 ? (wins.length / strategyTrades.length) * 100 : 0,
        avgWin: wins.length > 0 ? wins.reduce((sum, trade) => sum + (trade.net_pnl || 0), 0) / wins.length : 0,
        avgLoss: losses.length > 0 ? losses.reduce((sum, trade) => sum + (trade.net_pnl || 0), 0) / losses.length : 0
      };
    });
  }

  async getAssetExposure(filters: any = {}): Promise<AssetExposure[]> {
    const trades = await this.getTrades(filters);
    
    const assetData: Record<string, { trades: TradeData[]; exposure: number }> = {};
    trades.forEach(trade => {
      const assetClass = trade.asset_class || 'Unknown';
      if (!assetData[assetClass]) {
        assetData[assetClass] = { trades: [], exposure: 0 };
      }
      assetData[assetClass].trades.push(trade);
      assetData[assetClass].exposure += Math.abs(trade.quantity * trade.entry_price);
    });

    return Object.entries(assetData).map(([assetClass, data]) => {
      const pnl = data.trades.reduce((sum, trade) => sum + (trade.net_pnl || 0), 0);
      
      return {
        asset_class: assetClass,
        exposure: data.exposure,
        pnl,
        tradeCount: data.trades.length
      };
    });
  }
}

export const analyticsService = new AnalyticsService();
