import { supabase } from '@/lib/supabase';

export interface Position {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  assetClass: string;
  sector?: string;
  country?: string;
  beta?: number;
  volatility?: number;
  createdAt: string;
}

export interface RiskMetrics {
  totalExposure: number;
  netExposure: number;
  grossExposure: number;
  leverage: number;
  maxDrawdown: number;
  currentDrawdown: number;
  var95: number; // Value at Risk 95%
  var99: number; // Value at Risk 99%
  expectedShortfall: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxLeverage: number;
  concentrationRisk: number;
  correlationRisk: number;
}

export interface StressTestResult {
  scenario: string;
  marketChange: number;
  portfolioImpact: number;
  individualImpacts: Array<{
    symbol: string;
    impact: number;
    percentage: number;
  }>;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface CorrelationMatrix {
  symbols: string[];
  correlations: number[][];
  averageCorrelation: number;
  maxCorrelation: number;
  diversificationRatio: number;
}

export interface DrawdownContribution {
  symbol: string;
  contribution: number;
  percentage: number;
  peakDate: string;
  troughDate: string;
  duration: number;
  recoveryDate?: string;
}

class RiskAnalyticsService {
  private async getCurrentPositions(): Promise<Position[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // Get active positions from trades
      const { data: trades, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .is('exit_date', null)
        .order('entry_date', { ascending: false });

      if (error) throw error;

      // Convert trades to positions
      return (trades || []).map(trade => ({
        id: trade.id,
        symbol: trade.symbol,
        side: trade.side,
        quantity: trade.quantity,
        entryPrice: trade.entry_price,
        currentPrice: trade.current_price || trade.entry_price,
        marketValue: Math.abs(trade.quantity * (trade.current_price || trade.entry_price)),
        unrealizedPnL: trade.unrealized_pnl || 0,
        assetClass: trade.asset_class || 'Unknown',
        sector: trade.sector,
        country: trade.country,
        beta: trade.beta,
        volatility: trade.volatility,
        createdAt: trade.created_at
      }));
    } catch (error) {
      console.error('Error fetching positions:', error);
      return [];
    }
  }

  async calculateRiskMetrics(): Promise<RiskMetrics> {
    const positions = await this.getCurrentPositions();
    
    if (positions.length === 0) {
      return this.getEmptyRiskMetrics();
    }

    const totalExposure = positions.reduce((sum, pos) => sum + pos.marketValue, 0);
    const longExposure = positions
      .filter(pos => pos.side === 'long')
      .reduce((sum, pos) => sum + pos.marketValue, 0);
    const shortExposure = positions
      .filter(pos => pos.side === 'short')
      .reduce((sum, pos) => sum + pos.marketValue, 0);
    
    const netExposure = longExposure - shortExposure;
    const grossExposure = longExposure + shortExposure;
    const leverage = grossExposure / Math.max(totalExposure, 1);

    // Calculate concentration risk (Herfindahl index)
    const concentrationRisk = this.calculateConcentrationRisk(positions);

    // Calculate correlation risk
    const correlationRisk = await this.calculateCorrelationRisk(positions);

    // Calculate VaR and Expected Shortfall
    const { var95, var99, expectedShortfall } = await this.calculateVaR(positions);

    // Calculate drawdown metrics
    const { maxDrawdown, currentDrawdown } = await this.calculateDrawdowns();

    // Calculate risk-adjusted returns
    const { sharpeRatio, sortinoRatio, calmarRatio } = await this.calculateRiskAdjustedReturns();

    return {
      totalExposure,
      netExposure,
      grossExposure,
      leverage,
      maxDrawdown,
      currentDrawdown,
      var95,
      var99,
      expectedShortfall,
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      maxLeverage: leverage,
      concentrationRisk,
      correlationRisk
    };
  }

  private calculateConcentrationRisk(positions: Position[]): number {
    const totalValue = positions.reduce((sum, pos) => sum + pos.marketValue, 0);
    if (totalValue === 0) return 0;

    const weights = positions.map(pos => pos.marketValue / totalValue);
    const herfindahlIndex = weights.reduce((sum, weight) => sum + weight * weight, 0);
    
    // Convert to percentage (0-100)
    return herfindahlIndex * 100;
  }

  private async calculateCorrelationRisk(positions: Position[]): Promise<number> {
    if (positions.length < 2) return 0;

    // For now, use a simplified correlation calculation
    // In a real implementation, you'd use historical price data
    const symbols = positions.map(pos => pos.symbol);
    const correlations = await this.calculateCorrelationMatrix(symbols);
    
    // Calculate average correlation (excluding diagonal)
    let sum = 0;
    let count = 0;
    for (let i = 0; i < correlations.correlations.length; i++) {
      for (let j = i + 1; j < correlations.correlations[i].length; j++) {
        sum += Math.abs(correlations.correlations[i][j]);
        count++;
      }
    }
    
    return count > 0 ? (sum / count) * 100 : 0;
  }

  private async calculateCorrelationMatrix(symbols: string[]): Promise<CorrelationMatrix> {
    // Simplified correlation calculation
    // In production, you'd fetch historical price data and calculate actual correlations
    const n = symbols.length;
    const correlations: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    
    // Fill diagonal with 1s
    for (let i = 0; i < n; i++) {
      correlations[i][i] = 1;
    }
    
    // Fill off-diagonal with random correlations (simplified)
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const correlation = Math.random() * 0.8 - 0.4; // Random correlation between -0.4 and 0.4
        correlations[i][j] = correlation;
        correlations[j][i] = correlation;
      }
    }

    const allCorrelations = correlations.flat().filter((_, i) => i % (n + 1) !== 0);
    const averageCorrelation = allCorrelations.reduce((sum, corr) => sum + Math.abs(corr), 0) / allCorrelations.length;
    const maxCorrelation = Math.max(...allCorrelations.map(Math.abs));
    const diversificationRatio = 1 / (1 + averageCorrelation);

    return {
      symbols,
      correlations,
      averageCorrelation,
      maxCorrelation,
      diversificationRatio
    };
  }

  private async calculateVaR(positions: Position[]): Promise<{ var95: number; var99: number; expectedShortfall: number }> {
    // Simplified VaR calculation using historical simulation
    // In production, you'd use actual historical returns
    
    const portfolioValue = positions.reduce((sum, pos) => sum + pos.marketValue, 0);
    if (portfolioValue === 0) return { var95: 0, var99: 0, expectedShortfall: 0 };

    // Simulate returns (in production, use actual historical data)
    const simulatedReturns = this.generateSimulatedReturns(positions, 1000);
    const sortedReturns = simulatedReturns.sort((a, b) => a - b);
    
    const var95 = Math.abs(sortedReturns[Math.floor(sortedReturns.length * 0.05)]);
    const var99 = Math.abs(sortedReturns[Math.floor(sortedReturns.length * 0.01)]);
    
    // Expected Shortfall (Conditional VaR)
    const tailReturns = sortedReturns.slice(0, Math.floor(sortedReturns.length * 0.05));
    const expectedShortfall = Math.abs(tailReturns.reduce((sum, ret) => sum + ret, 0) / tailReturns.length);

    return { var95, var99, expectedShortfall };
  }

  private generateSimulatedReturns(positions: Position[], numSimulations: number): number[] {
    // Simplified Monte Carlo simulation
    // In production, use actual historical volatility and correlation data
    const returns: number[] = [];
    
    for (let i = 0; i < numSimulations; i++) {
      let portfolioReturn = 0;
      
      positions.forEach(pos => {
        const weight = pos.marketValue / positions.reduce((sum, p) => sum + p.marketValue, 0);
        const volatility = pos.volatility || 0.2; // Default 20% volatility
        const randomReturn = (Math.random() - 0.5) * volatility * 2; // Normal distribution approximation
        portfolioReturn += weight * randomReturn;
      });
      
      returns.push(portfolioReturn);
    }
    
    return returns;
  }

  private async calculateDrawdowns(): Promise<{ maxDrawdown: number; currentDrawdown: number }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // Get historical portfolio values
      const { data: trades, error } = await supabase
        .from('trades')
        .select('entry_date, exit_date, net_pnl')
        .eq('user_id', user.id)
        .order('entry_date', { ascending: true });

      if (error) throw error;

      // Calculate cumulative P&L
      let cumulativePnL = 0;
      let peak = 0;
      let maxDrawdown = 0;
      let currentDrawdown = 0;

      for (const trade of trades || []) {
        cumulativePnL += trade.net_pnl || 0;
        
        if (cumulativePnL > peak) {
          peak = cumulativePnL;
        }
        
        const drawdown = peak - cumulativePnL;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
        
        // Current drawdown (from most recent peak)
        if (trade.exit_date === null) {
          currentDrawdown = drawdown;
        }
      }

      return {
        maxDrawdown: peak > 0 ? (maxDrawdown / peak) * 100 : 0,
        currentDrawdown: peak > 0 ? (currentDrawdown / peak) * 100 : 0
      };
    } catch (error) {
      console.error('Error calculating drawdowns:', error);
      return { maxDrawdown: 0, currentDrawdown: 0 };
    }
  }

  private async calculateRiskAdjustedReturns(): Promise<{ sharpeRatio: number; sortinoRatio: number; calmarRatio: number }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // Get historical returns
      const { data: trades, error } = await supabase
        .from('trades')
        .select('entry_date, net_pnl')
        .eq('user_id', user.id)
        .order('entry_date', { ascending: true });

      if (error) throw error;

      const returns = (trades || []).map(trade => trade.net_pnl || 0);
      if (returns.length === 0) return { sharpeRatio: 0, sortinoRatio: 0, calmarRatio: 0 };

      const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
      const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
      const stdDev = Math.sqrt(variance);
      
      // Downside deviation (only negative returns)
      const negativeReturns = returns.filter(ret => ret < 0);
      const downsideVariance = negativeReturns.length > 0 
        ? negativeReturns.reduce((sum, ret) => sum + Math.pow(ret, 2), 0) / negativeReturns.length
        : 0;
      const downsideDeviation = Math.sqrt(downsideVariance);

      const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;
      const sortinoRatio = downsideDeviation > 0 ? avgReturn / downsideDeviation : 0;
      
      // Calmar ratio (annual return / max drawdown)
      const { maxDrawdown } = await this.calculateDrawdowns();
      const calmarRatio = maxDrawdown > 0 ? (avgReturn * 12) / maxDrawdown : 0; // Assuming monthly data

      return { sharpeRatio, sortinoRatio, calmarRatio };
    } catch (error) {
      console.error('Error calculating risk-adjusted returns:', error);
      return { sharpeRatio: 0, sortinoRatio: 0, calmarRatio: 0 };
    }
  }

  async runStressTest(scenarios: Array<{ name: string; marketChange: number }>): Promise<StressTestResult[]> {
    const positions = await this.getCurrentPositions();
    const results: StressTestResult[] = [];

    for (const scenario of scenarios) {
      let portfolioImpact = 0;
      const individualImpacts: Array<{
        symbol: string;
        impact: number;
        percentage: number;
      }> = [];

      positions.forEach(pos => {
        // Calculate impact based on beta and market change
        const beta = pos.beta || 1.0;
        const positionImpact = pos.marketValue * (scenario.marketChange / 100) * beta;
        portfolioImpact += positionImpact;
        
        individualImpacts.push({
          symbol: pos.symbol,
          impact: positionImpact,
          percentage: pos.marketValue > 0 ? (positionImpact / pos.marketValue) * 100 : 0
        });
      });

      // Determine risk level based on impact
      const totalValue = positions.reduce((sum, pos) => sum + pos.marketValue, 0);
      const impactPercentage = totalValue > 0 ? Math.abs(portfolioImpact) / totalValue * 100 : 0;
      
      let riskLevel: 'low' | 'medium' | 'high' | 'critical';
      if (impactPercentage < 5) riskLevel = 'low';
      else if (impactPercentage < 15) riskLevel = 'medium';
      else if (impactPercentage < 30) riskLevel = 'high';
      else riskLevel = 'critical';

      results.push({
        scenario: scenario.name,
        marketChange: scenario.marketChange,
        portfolioImpact,
        individualImpacts: individualImpacts.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)),
        riskLevel
      });
    }

    return results;
  }

  async getDrawdownContributions(): Promise<DrawdownContribution[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // Get all trades grouped by symbol
      const { data: trades, error } = await supabase
        .from('trades')
        .select('symbol, entry_date, exit_date, net_pnl')
        .eq('user_id', user.id)
        .order('entry_date', { ascending: true });

      if (error) throw error;

      const symbolGroups = (trades || []).reduce((acc, trade) => {
        if (!acc[trade.symbol]) acc[trade.symbol] = [];
        acc[trade.symbol].push(trade);
        return acc;
      }, {} as Record<string, any[]>);

      const contributions: DrawdownContribution[] = [];

      Object.entries(symbolGroups).forEach(([symbol, symbolTrades]) => {
        let cumulativePnL = 0;
        let peak = 0;
        let maxDrawdown = 0;
        let peakDate = '';
        let troughDate = '';

        symbolTrades.forEach(trade => {
          cumulativePnL += trade.net_pnl || 0;
          
          if (cumulativePnL > peak) {
            peak = cumulativePnL;
            peakDate = trade.entry_date;
          }
          
          const drawdown = peak - cumulativePnL;
          if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
            troughDate = trade.entry_date;
          }
        });

        if (maxDrawdown > 0) {
          contributions.push({
            symbol,
            contribution: maxDrawdown,
            percentage: peak > 0 ? (maxDrawdown / peak) * 100 : 0,
            peakDate,
            troughDate,
            duration: this.calculateDuration(peakDate, troughDate)
          });
        }
      });

      return contributions.sort((a, b) => b.contribution - a.contribution);
    } catch (error) {
      console.error('Error calculating drawdown contributions:', error);
      return [];
    }
  }

  private calculateDuration(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }

  private getEmptyRiskMetrics(): RiskMetrics {
    return {
      totalExposure: 0,
      netExposure: 0,
      grossExposure: 0,
      leverage: 0,
      maxDrawdown: 0,
      currentDrawdown: 0,
      var95: 0,
      var99: 0,
      expectedShortfall: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      maxLeverage: 0,
      concentrationRisk: 0,
      correlationRisk: 0
    };
  }
}

export const riskAnalyticsService = new RiskAnalyticsService();
