/**
 * Strategy Scoring Service
 * Automated strategy performance evaluation and scoring system
 */

import { createClient } from '@/lib/supabase/client';

export interface BacktestMetrics {
  totalReturn: number;
  annualReturn: number;
  volatility: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  maxDrawdownDuration: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  beta: number;
  alpha: number;
  informationRatio: number;
  trackingError: number;
  treynorRatio: number;
  jensenAlpha: number;
}

export interface StrategyScore {
  overallScore: number;
  returnScore: number;
  riskScore: number;
  consistencyScore: number;
  sharpeScore: number;
  drawdownScore: number;
  winRateScore: number;
  profitFactorScore: number;
  sampleSizeScore: number;
  calculationMethod: string;
  calculatedAt: Date;
}

export interface ScoringWeights {
  returnWeight: number;
  riskWeight: number;
  consistencyWeight: number;
  sharpeWeight: number;
  drawdownWeight: number;
  winRateWeight: number;
  profitFactorWeight: number;
  sampleSizeWeight: number;
}

export class StrategyScoringService {
  private supabase: any;
  private defaultWeights: ScoringWeights = {
    returnWeight: 0.25,
    riskWeight: 0.20,
    consistencyWeight: 0.15,
    sharpeWeight: 0.15,
    drawdownWeight: 0.10,
    winRateWeight: 0.08,
    profitFactorWeight: 0.05,
    sampleSizeWeight: 0.02
  };

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Calculate comprehensive strategy score
   */
  async calculateStrategyScore(
    strategyId: string,
    backtestJobId: string,
    customWeights?: Partial<ScoringWeights>
  ): Promise<StrategyScore> {
    try {
      // Get backtest results
      const { data: backtestResults, error } = await this.supabase
        .from('backtest_results')
        .select('*')
        .eq('backtest_job_id', backtestJobId)
        .single();

      if (error || !backtestResults) {
        throw new Error('Backtest results not found');
      }

      // Calculate individual scores
      const scores = this.calculateIndividualScores(backtestResults);
      
      // Apply weights
      const weights = { ...this.defaultWeights, ...customWeights };
      const overallScore = this.calculateOverallScore(scores, weights);

      // Store score in database
      const { error: insertError } = await this.supabase
        .from('strategy_scores')
        .upsert({
          strategy_id: strategyId,
          backtest_job_id: backtestJobId,
          overall_score: overallScore,
          return_score: scores.returnScore,
          risk_score: scores.riskScore,
          consistency_score: scores.consistencyScore,
          sharpe_score: scores.sharpeScore,
          drawdown_score: scores.drawdownScore,
          win_rate_score: scores.winRateScore,
          profit_factor_score: scores.profitFactorScore,
          sample_size_score: scores.sampleSizeScore,
          calculation_method: 'weighted_average',
          calculated_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('Failed to store strategy score:', insertError);
      }

      return {
        ...scores,
        overallScore,
        calculationMethod: 'weighted_average',
        calculatedAt: new Date()
      };

    } catch (error) {
      console.error('Failed to calculate strategy score:', error);
      throw error;
    }
  }

  /**
   * Calculate individual performance scores
   */
  private calculateIndividualScores(metrics: BacktestMetrics): Omit<StrategyScore, 'overallScore' | 'calculationMethod' | 'calculatedAt'> {
    return {
      returnScore: this.calculateReturnScore(metrics),
      riskScore: this.calculateRiskScore(metrics),
      consistencyScore: this.calculateConsistencyScore(metrics),
      sharpeScore: this.calculateSharpeScore(metrics),
      drawdownScore: this.calculateDrawdownScore(metrics),
      winRateScore: this.calculateWinRateScore(metrics),
      profitFactorScore: this.calculateProfitFactorScore(metrics),
      sampleSizeScore: this.calculateSampleSizeScore(metrics)
    };
  }

  /**
   * Calculate return-based score (0-100)
   */
  private calculateReturnScore(metrics: BacktestMetrics): number {
    const annualReturn = metrics.annualReturn || 0;
    
    // Score based on annual return with diminishing returns
    if (annualReturn >= 0.5) return 100; // 50%+ annual return
    if (annualReturn >= 0.3) return 90;  // 30%+ annual return
    if (annualReturn >= 0.2) return 80;  // 20%+ annual return
    if (annualReturn >= 0.1) return 70;  // 10%+ annual return
    if (annualReturn >= 0.05) return 60; // 5%+ annual return
    if (annualReturn >= 0) return 50;    // Positive return
    if (annualReturn >= -0.05) return 30; // Small loss
    if (annualReturn >= -0.1) return 20;  // Moderate loss
    if (annualReturn >= -0.2) return 10;  // Large loss
    return 0; // Very large loss
  }

  /**
   * Calculate risk-adjusted score (0-100)
   */
  private calculateRiskScore(metrics: BacktestMetrics): number {
    const volatility = metrics.volatility || 0;
    const maxDrawdown = Math.abs(metrics.maxDrawdown || 0);
    
    // Lower volatility and drawdown = higher score
    const volatilityScore = Math.max(0, 100 - (volatility * 200)); // Penalize high volatility
    const drawdownScore = Math.max(0, 100 - (maxDrawdown * 500)); // Penalize high drawdown
    
    return (volatilityScore + drawdownScore) / 2;
  }

  /**
   * Calculate consistency score (0-100)
   */
  private calculateConsistencyScore(metrics: BacktestMetrics): number {
    const winRate = metrics.winRate || 0;
    const profitFactor = metrics.profitFactor || 0;
    const consecutiveWins = metrics.consecutiveWins || 0;
    const consecutiveLosses = metrics.consecutiveLosses || 0;
    
    // Win rate score (0-50 points)
    const winRateScore = winRate * 50;
    
    // Profit factor score (0-30 points)
    const profitFactorScore = Math.min(30, (profitFactor - 1) * 15);
    
    // Consistency score (0-20 points) - penalize extreme streaks
    const maxStreak = Math.max(consecutiveWins, consecutiveLosses);
    const consistencyScore = Math.max(0, 20 - (maxStreak * 0.5));
    
    return winRateScore + profitFactorScore + consistencyScore;
  }

  /**
   * Calculate Sharpe ratio score (0-100)
   */
  private calculateSharpeScore(metrics: BacktestMetrics): number {
    const sharpeRatio = metrics.sharpeRatio || 0;
    
    if (sharpeRatio >= 2.0) return 100; // Excellent
    if (sharpeRatio >= 1.5) return 90;  // Very good
    if (sharpeRatio >= 1.0) return 80;  // Good
    if (sharpeRatio >= 0.5) return 60;  // Average
    if (sharpeRatio >= 0) return 40;    // Below average
    if (sharpeRatio >= -0.5) return 20; // Poor
    return 0; // Very poor
  }

  /**
   * Calculate drawdown score (0-100)
   */
  private calculateDrawdownScore(metrics: BacktestMetrics): number {
    const maxDrawdown = Math.abs(metrics.maxDrawdown || 0);
    const maxDrawdownDuration = metrics.maxDrawdownDuration || 0;
    
    // Drawdown magnitude score (0-70 points)
    let drawdownScore = 70;
    if (maxDrawdown > 0.5) drawdownScore = 0;      // 50%+ drawdown
    else if (maxDrawdown > 0.3) drawdownScore = 20; // 30%+ drawdown
    else if (maxDrawdown > 0.2) drawdownScore = 40; // 20%+ drawdown
    else if (maxDrawdown > 0.1) drawdownScore = 60; // 10%+ drawdown
    else if (maxDrawdown > 0.05) drawdownScore = 70; // 5%+ drawdown
    
    // Drawdown duration penalty (0-30 points)
    const durationPenalty = Math.min(30, maxDrawdownDuration * 0.1);
    drawdownScore -= durationPenalty;
    
    return Math.max(0, drawdownScore);
  }

  /**
   * Calculate win rate score (0-100)
   */
  private calculateWinRateScore(metrics: BacktestMetrics): number {
    const winRate = metrics.winRate || 0;
    
    // Win rate score with bonus for high win rates
    if (winRate >= 0.8) return 100; // 80%+ win rate
    if (winRate >= 0.7) return 90;  // 70%+ win rate
    if (winRate >= 0.6) return 80;  // 60%+ win rate
    if (winRate >= 0.5) return 70;  // 50%+ win rate
    if (winRate >= 0.4) return 60;  // 40%+ win rate
    if (winRate >= 0.3) return 50;  // 30%+ win rate
    if (winRate >= 0.2) return 30;  // 20%+ win rate
    return 10; // Very low win rate
  }

  /**
   * Calculate profit factor score (0-100)
   */
  private calculateProfitFactorScore(metrics: BacktestMetrics): number {
    const profitFactor = metrics.profitFactor || 0;
    
    if (profitFactor >= 3.0) return 100; // Excellent
    if (profitFactor >= 2.0) return 90;  // Very good
    if (profitFactor >= 1.5) return 80;  // Good
    if (profitFactor >= 1.2) return 70;  // Above average
    if (profitFactor >= 1.0) return 60;  // Break-even
    if (profitFactor >= 0.8) return 40;  // Below average
    if (profitFactor >= 0.5) return 20;  // Poor
    return 0; // Very poor
  }

  /**
   * Calculate sample size score (0-100)
   */
  private calculateSampleSizeScore(metrics: BacktestMetrics): number {
    const totalTrades = metrics.totalTrades || 0;
    
    // More trades = higher confidence = higher score
    if (totalTrades >= 1000) return 100; // Excellent sample size
    if (totalTrades >= 500) return 90;   // Very good sample size
    if (totalTrades >= 200) return 80;   // Good sample size
    if (totalTrades >= 100) return 70;   // Adequate sample size
    if (totalTrades >= 50) return 60;    // Minimum sample size
    if (totalTrades >= 20) return 40;    // Small sample size
    if (totalTrades >= 10) return 20;    // Very small sample size
    return 0; // Insufficient sample size
  }

  /**
   * Calculate overall weighted score
   */
  private calculateOverallScore(
    scores: Omit<StrategyScore, 'overallScore' | 'calculationMethod' | 'calculatedAt'>,
    weights: ScoringWeights
  ): number {
    return (
      scores.returnScore * weights.returnWeight +
      scores.riskScore * weights.riskWeight +
      scores.consistencyScore * weights.consistencyWeight +
      scores.sharpeScore * weights.sharpeWeight +
      scores.drawdownScore * weights.drawdownWeight +
      scores.winRateScore * weights.winRateWeight +
      scores.profitFactorScore * weights.profitFactorWeight +
      scores.sampleSizeScore * weights.sampleSizeWeight
    );
  }

  /**
   * Get strategy score by ID
   */
  async getStrategyScore(strategyId: string): Promise<StrategyScore | null> {
    try {
      const { data, error } = await this.supabase
        .from('strategy_scores')
        .select('*')
        .eq('strategy_id', strategyId)
        .order('calculated_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        overallScore: data.overall_score,
        returnScore: data.return_score,
        riskScore: data.risk_score,
        consistencyScore: data.consistency_score,
        sharpeScore: data.sharpe_score,
        drawdownScore: data.drawdown_score,
        winRateScore: data.win_rate_score,
        profitFactorScore: data.profit_factor_score,
        sampleSizeScore: data.sample_size_score,
        calculationMethod: data.calculation_method,
        calculatedAt: new Date(data.calculated_at)
      };
    } catch (error) {
      console.error('Failed to get strategy score:', error);
      return null;
    }
  }

  /**
   * Get top performing strategies
   */
  async getTopStrategies(limit: number = 10): Promise<Array<{ strategyId: string; score: StrategyScore }>> {
    try {
      const { data, error } = await this.supabase
        .from('strategy_scores')
        .select(`
          strategy_id,
          overall_score,
          return_score,
          risk_score,
          consistency_score,
          sharpe_score,
          drawdown_score,
          win_rate_score,
          profit_factor_score,
          sample_size_score,
          calculation_method,
          calculated_at
        `)
        .order('overall_score', { ascending: false })
        .limit(limit);

      if (error || !data) {
        return [];
      }

      return data.map(item => ({
        strategyId: item.strategy_id,
        score: {
          overallScore: item.overall_score,
          returnScore: item.return_score,
          riskScore: item.risk_score,
          consistencyScore: item.consistency_score,
          sharpeScore: item.sharpe_score,
          drawdownScore: item.drawdown_score,
          winRateScore: item.win_rate_score,
          profitFactorScore: item.profit_factor_score,
          sampleSizeScore: item.sample_size_score,
          calculationMethod: item.calculation_method,
          calculatedAt: new Date(item.calculated_at)
        }
      }));
    } catch (error) {
      console.error('Failed to get top strategies:', error);
      return [];
    }
  }

  /**
   * Update scoring weights
   */
  async updateScoringWeights(weights: Partial<ScoringWeights>): Promise<void> {
    try {
      // Store weights in database or configuration
      const { error } = await this.supabase
        .from('scoring_config')
        .upsert({
          id: 'default',
          weights: weights,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Failed to update scoring weights:', error);
      }
    } catch (error) {
      console.error('Failed to update scoring weights:', error);
    }
  }

  /**
   * Get scoring configuration
   */
  async getScoringWeights(): Promise<ScoringWeights> {
    try {
      const { data, error } = await this.supabase
        .from('scoring_config')
        .select('weights')
        .eq('id', 'default')
        .single();

      if (error || !data) {
        return this.defaultWeights;
      }

      return { ...this.defaultWeights, ...data.weights };
    } catch (error) {
      console.error('Failed to get scoring weights:', error);
      return this.defaultWeights;
    }
  }
}

// Export singleton instance
export const strategyScoringService = new StrategyScoringService();
