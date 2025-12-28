import { supabase } from '@/lib/supabase';

export interface TradeData {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  pnl: number;
  created_at: string;
  strategy?: string;
  fees?: number;
}

export interface InstitutionalMetrics {
  totalAUM: number;
  activeStrategies: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  performance: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  var95: number;
  var99: number;
  expectedShortfall: number;
  volatility: number;
  beta: number;
  alpha: number;
  informationRatio: number;
  trackingError: number;
  winRate: number;
  profitFactor: number;
  expectancy: number;
  totalTrades: number;
  activeAlerts: number;
  lastUpdate: string;
}

export interface PositionRisk {
  symbol: string;
  position: number;
  marketValue: number;
  var: number;
  beta: number;
  weight: number;
  risk: 'low' | 'medium' | 'high' | 'critical';
  alerts: number;
}

export interface StrategyPerformance {
  name: string;
  type: string;
  allocation: number;
  performance: number;
  risk: number;
  status: 'active' | 'paused' | 'stopped';
  trades: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

export class InstitutionalService {
  // Calculate Value at Risk (VaR) using historical simulation
  static calculateVaR(returns: number[], confidenceLevel: number = 0.95): number {
    if (returns.length === 0) return 0;
    
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const index = Math.floor((1 - confidenceLevel) * sortedReturns.length);
    return sortedReturns[index] || 0;
  }

  // Calculate Expected Shortfall (Conditional VaR)
  static calculateExpectedShortfall(returns: number[], confidenceLevel: number = 0.95): number {
    if (returns.length === 0) return 0;
    
    const var95 = this.calculateVaR(returns, confidenceLevel);
    const tailReturns = returns.filter(r => r <= var95);
    
    if (tailReturns.length === 0) return var95;
    
    return tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length;
  }

  // Calculate Sharpe Ratio
  static calculateSharpeRatio(returns: number[], riskFreeRate: number = 0.02): number {
    if (returns.length === 0) return 0;
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return 0;
    
    return (avgReturn - riskFreeRate) / stdDev;
  }

  // Calculate Sortino Ratio
  static calculateSortinoRatio(returns: number[], riskFreeRate: number = 0.02): number {
    if (returns.length === 0) return 0;
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const negativeReturns = returns.filter(r => r < 0);
    
    if (negativeReturns.length === 0) return 0;
    
    const downsideVariance = negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length;
    const downsideDeviation = Math.sqrt(downsideVariance);
    
    if (downsideDeviation === 0) return 0;
    
    return (avgReturn - riskFreeRate) / downsideDeviation;
  }

  // Calculate Maximum Drawdown
  static calculateMaxDrawdown(returns: number[]): number {
    if (returns.length === 0) return 0;
    
    let peak = 0;
    let maxDrawdown = 0;
    let cumulative = 0;
    
    for (const ret of returns) {
      cumulative += ret;
      if (cumulative > peak) {
        peak = cumulative;
      }
      const drawdown = peak - cumulative;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    
    return maxDrawdown;
  }

  // Calculate Calmar Ratio
  static calculateCalmarRatio(returns: number[], maxDrawdown: number): number {
    if (maxDrawdown === 0) return 0;
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    return avgReturn / maxDrawdown;
  }

  // Calculate Volatility (Standard Deviation)
  static calculateVolatility(returns: number[]): number {
    if (returns.length === 0) return 0;
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  // Calculate Win Rate
  static calculateWinRate(trades: TradeData[]): number {
    if (trades.length === 0) return 0;
    
    const winningTrades = trades.filter(trade => trade.pnl > 0);
    return winningTrades.length / trades.length;
  }

  // Calculate Profit Factor
  static calculateProfitFactor(trades: TradeData[]): number {
    if (trades.length === 0) return 0;
    
    const grossProfit = trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(trades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0));
    
    if (grossLoss === 0) return grossProfit > 0 ? Infinity : 0;
    
    return grossProfit / grossLoss;
  }

  // Calculate Expectancy
  static calculateExpectancy(trades: TradeData[]): number {
    if (trades.length === 0) return 0;
    
    const winRate = this.calculateWinRate(trades);
    const avgWin = trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0) / trades.filter(t => t.pnl > 0).length || 0;
    const avgLoss = trades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0) / trades.filter(t => t.pnl < 0).length || 0;
    
    return (winRate * avgWin) + ((1 - winRate) * avgLoss);
  }

  // Calculate daily returns from trades
  static calculateDailyReturns(trades: TradeData[]): number[] {
    const dailyPnL: { [date: string]: number } = {};
    
    trades.forEach(trade => {
      const date = trade.created_at.split('T')[0];
      dailyPnL[date] = (dailyPnL[date] || 0) + trade.pnl;
    });
    
    const sortedDates = Object.keys(dailyPnL).sort();
    const returns: number[] = [];
    
    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = sortedDates[i - 1];
      const currDate = sortedDates[i];
      const prevPnL = dailyPnL[prevDate];
      const currPnL = dailyPnL[currDate];
      
      if (prevPnL !== 0) {
        returns.push((currPnL - prevPnL) / Math.abs(prevPnL));
      }
    }
    
    return returns;
  }

  // Determine risk level based on metrics
  static determineRiskLevel(metrics: Partial<InstitutionalMetrics>): 'low' | 'medium' | 'high' | 'critical' {
    const { sharpeRatio, maxDrawdown, var95, winRate } = metrics;
    
    let riskScore = 0;
    
    // Sharpe ratio scoring
    if (sharpeRatio < 0.5) riskScore += 3;
    else if (sharpeRatio < 1.0) riskScore += 2;
    else if (sharpeRatio < 1.5) riskScore += 1;
    
    // Max drawdown scoring
    if (maxDrawdown > 0.20) riskScore += 3;
    else if (maxDrawdown > 0.10) riskScore += 2;
    else if (maxDrawdown > 0.05) riskScore += 1;
    
    // VaR scoring (assuming negative values)
    if (var95 < -0.10) riskScore += 3;
    else if (var95 < -0.05) riskScore += 2;
    else if (var95 < -0.02) riskScore += 1;
    
    // Win rate scoring
    if (winRate < 0.40) riskScore += 2;
    else if (winRate < 0.50) riskScore += 1;
    
    if (riskScore >= 7) return 'critical';
    if (riskScore >= 5) return 'high';
    if (riskScore >= 3) return 'medium';
    return 'low';
  }

  // Get comprehensive institutional metrics
  static async getInstitutionalMetrics(userId: string): Promise<InstitutionalMetrics> {
    try {
      // Fetch user's trades
      const { data: trades, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const tradeData: TradeData[] = trades || [];
      
      if (tradeData.length === 0) {
        return {
          totalAUM: 0,
          activeStrategies: 0,
          riskLevel: 'low',
          performance: 0,
          sharpeRatio: 0,
          sortinoRatio: 0,
          calmarRatio: 0,
          maxDrawdown: 0,
          var95: 0,
          var99: 0,
          expectedShortfall: 0,
          volatility: 0,
          beta: 0,
          alpha: 0,
          informationRatio: 0,
          trackingError: 0,
          winRate: 0,
          profitFactor: 0,
          expectancy: 0,
          totalTrades: 0,
          activeAlerts: 0,
          lastUpdate: new Date().toISOString()
        };
      }

      // Calculate basic metrics
      const totalPnL = tradeData.reduce((sum, trade) => sum + trade.pnl, 0);
      const totalTrades = tradeData.length;
      const winRate = this.calculateWinRate(tradeData);
      const profitFactor = this.calculateProfitFactor(tradeData);
      const expectancy = this.calculateExpectancy(tradeData);

      // Calculate daily returns
      const dailyReturns = this.calculateDailyReturns(tradeData);
      
      // Calculate risk metrics
      const var95 = this.calculateVaR(dailyReturns, 0.95);
      const var99 = this.calculateVaR(dailyReturns, 0.99);
      const expectedShortfall = this.calculateExpectedShortfall(dailyReturns, 0.95);
      const maxDrawdown = this.calculateMaxDrawdown(dailyReturns);
      const volatility = this.calculateVolatility(dailyReturns);
      const sharpeRatio = this.calculateSharpeRatio(dailyReturns);
      const sortinoRatio = this.calculateSortinoRatio(dailyReturns);
      const calmarRatio = this.calculateCalmarRatio(dailyReturns, maxDrawdown);

      // Calculate performance metrics
      const performance = totalPnL > 0 ? (totalPnL / Math.abs(totalPnL)) * 100 : 0;
      
      // Calculate strategies (simplified - group by strategy field)
      const strategies = new Set(tradeData.map(t => t.strategy || 'default'));
      const activeStrategies = strategies.size;

      // Calculate AUM (simplified - sum of absolute trade values)
      const totalAUM = tradeData.reduce((sum, trade) => sum + Math.abs(trade.price * trade.quantity), 0);

      // Determine risk level
      const riskLevel = this.determineRiskLevel({
        sharpeRatio,
        maxDrawdown,
        var95,
        winRate
      });

      // Calculate active alerts (simplified)
      const activeAlerts = (var95 < -0.05 ? 1 : 0) + (maxDrawdown > 0.10 ? 1 : 0) + (winRate < 0.40 ? 1 : 0);

      return {
        totalAUM,
        activeStrategies,
        riskLevel,
        performance,
        sharpeRatio,
        sortinoRatio,
        calmarRatio,
        maxDrawdown,
        var95,
        var99,
        expectedShortfall,
        volatility,
        beta: 0, // Would need market data to calculate
        alpha: 0, // Would need market data to calculate
        informationRatio: 0, // Would need benchmark data to calculate
        trackingError: 0, // Would need benchmark data to calculate
        winRate,
        profitFactor,
        expectancy,
        totalTrades,
        activeAlerts,
        lastUpdate: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error calculating institutional metrics:', error);
      throw error;
    }
  }

  // Get position risk analysis
  static async getPositionRisk(userId: string): Promise<PositionRisk[]> {
    try {
      const { data: trades, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      const tradeData: TradeData[] = trades || [];
      
      // Group trades by symbol
      const positions: { [symbol: string]: TradeData[] } = {};
      tradeData.forEach(trade => {
        if (!positions[trade.symbol]) {
          positions[trade.symbol] = [];
        }
        positions[trade.symbol].push(trade);
      });

      // Calculate position metrics
      const positionRisks: PositionRisk[] = Object.entries(positions).map(([symbol, trades]) => {
        const totalQuantity = trades.reduce((sum, t) => sum + (t.side === 'buy' ? t.quantity : -t.quantity), 0);
        const totalValue = trades.reduce((sum, t) => sum + Math.abs(t.price * t.quantity), 0);
        const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
        
        // Calculate position VaR (simplified)
        const positionReturns = trades.map(t => t.pnl / Math.abs(t.price * t.quantity));
        const positionVar = this.calculateVaR(positionReturns, 0.95);
        
        // Determine risk level
        let risk: 'low' | 'medium' | 'high' | 'critical' = 'low';
        if (Math.abs(positionVar) > 0.10) risk = 'critical';
        else if (Math.abs(positionVar) > 0.05) risk = 'high';
        else if (Math.abs(positionVar) > 0.02) risk = 'medium';
        
        // Calculate alerts
        const alerts = (Math.abs(positionVar) > 0.05 ? 1 : 0) + (totalPnL < -totalValue * 0.1 ? 1 : 0);
        
        return {
          symbol,
          position: totalQuantity,
          marketValue: totalValue,
          var: positionVar,
          beta: 1.0, // Would need market data to calculate
          weight: 0, // Would need total portfolio value
          risk,
          alerts
        };
      });

      return positionRisks;

    } catch (error) {
      console.error('Error calculating position risk:', error);
      throw error;
    }
  }

  // Get strategy performance
  static async getStrategyPerformance(userId: string): Promise<StrategyPerformance[]> {
    try {
      const { data: trades, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      const tradeData: TradeData[] = trades || [];
      
      // Group trades by strategy
      const strategies: { [strategy: string]: TradeData[] } = {};
      tradeData.forEach(trade => {
        const strategy = trade.strategy || 'default';
        if (!strategies[strategy]) {
          strategies[strategy] = [];
        }
        strategies[strategy].push(trade);
      });

      // Calculate strategy metrics
      const strategyPerformance: StrategyPerformance[] = Object.entries(strategies).map(([strategy, trades]) => {
        const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
        const totalTrades = trades.length;
        const winRate = this.calculateWinRate(trades);
        const sharpeRatio = this.calculateSharpeRatio(trades.map(t => t.pnl));
        const maxDrawdown = this.calculateMaxDrawdown(trades.map(t => t.pnl));
        
        return {
          name: strategy,
          type: 'custom',
          allocation: 1.0 / Object.keys(strategies).length, // Equal allocation for now
          performance: totalPnL,
          risk: Math.abs(this.calculateVaR(trades.map(t => t.pnl), 0.95)),
          status: 'active',
          trades: totalTrades,
          winRate,
          sharpeRatio,
          maxDrawdown
        };
      });

      return strategyPerformance;

    } catch (error) {
      console.error('Error calculating strategy performance:', error);
      throw error;
    }
  }
}
