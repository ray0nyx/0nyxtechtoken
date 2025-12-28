import { restClient } from '@polygon.io/client-js';

export interface BacktestConfig {
  id: string;
  name: string;
  strategy: string;
  symbols: string[];
  startDate: string;
  endDate: string;
  timeframe: '1min' | '5min' | '15min' | '1hour' | '1day';
  initialCapital: number;
  positionSize: number;
  maxPositions: number;
  transactionCosts: number;
  slippage: number;
  riskFreeRate: number;
  benchmark: string;
  rebalanceFrequency: 'daily' | 'weekly' | 'monthly';
  stopLoss?: number;
  takeProfit?: number;
  maxDrawdown?: number;
}

export interface AdvancedBacktestResult {
  id: string;
  config: BacktestConfig;
  performance: {
    totalReturn: number;
    annualizedReturn: number;
    volatility: number;
    sharpeRatio: number;
    sortinoRatio: number;
    calmarRatio: number;
    maxDrawdown: number;
    maxDrawdownDuration: number;
    winRate: number;
    profitFactor: number;
    expectancy: number;
    var95: number;
    var99: number;
    expectedShortfall: number;
    beta: number;
    alpha: number;
    informationRatio: number;
    trackingError: number;
  };
  equityCurve: Array<{
    date: string;
    value: number;
    drawdown: number;
  }>;
  trades: Array<{
    symbol: string;
    entryDate: string;
    exitDate: string;
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    pnl: number;
    return: number;
    duration: number;
  }>;
  riskMetrics: {
    var95: number;
    var99: number;
    expectedShortfall: number;
    maxDrawdown: number;
    averageDrawdown: number;
    drawdownDuration: number;
    recoveryTime: number;
  };
  attribution: {
    sectorAllocation: Record<string, number>;
    factorExposure: Record<string, number>;
    alpha: number;
    beta: number;
    trackingError: number;
  };
  status: 'running' | 'completed' | 'failed' | 'paused';
  progress: number;
  startTime: string;
  endTime?: string;
  error?: string;
}

export class AdvancedBacktestingService {
  private static polygonClient = restClient(process.env.NEXT_PUBLIC_POLYGON_API_KEY);

  // Enhanced data fetching with multiple sources
  static async fetchMarketData(
    symbols: string[],
    startDate: string,
    endDate: string,
    timeframe: string
  ): Promise<any[]> {
    try {
      const dataPromises = symbols.map(async (symbol) => {
        const response = await this.polygonClient.stocks.aggregates(
          symbol,
          1,
          timeframe,
          startDate,
          endDate
        );
        return {
          symbol,
          data: response.results || []
        };
      });

      const results = await Promise.all(dataPromises);
      return results;
    } catch (error) {
      console.error('Error fetching market data:', error);
      throw error;
    }
  }

  // Walk-forward analysis
  static async runWalkForwardAnalysis(
    config: BacktestConfig,
    inSamplePeriod: number = 12, // months
    outOfSamplePeriod: number = 3, // months
    stepSize: number = 1 // months
  ): Promise<{
    periods: Array<{
      inSampleStart: string;
      inSampleEnd: string;
      outOfSampleStart: string;
      outOfSampleEnd: string;
      inSampleReturn: number;
      outOfSampleReturn: number;
      degradation: number;
      stability: number;
    }>;
    summary: {
      averageDegradation: number;
      stability: number;
      consistency: number;
    };
  }> {
    // Implementation for walk-forward analysis
    const periods = [];
    const startDate = new Date(config.startDate);
    const endDate = new Date(config.endDate);
    
    let currentDate = new Date(startDate);
    
    while (currentDate < endDate) {
      const inSampleStart = new Date(currentDate);
      const inSampleEnd = new Date(currentDate);
      inSampleEnd.setMonth(inSampleEnd.getMonth() + inSamplePeriod);
      
      const outOfSampleStart = new Date(inSampleEnd);
      const outOfSampleEnd = new Date(outOfSampleStart);
      outOfSampleEnd.setMonth(outOfSampleEnd.getMonth() + outOfSamplePeriod);
      
      if (outOfSampleEnd > endDate) break;
      
      // Run backtest for in-sample period
      const inSampleResult = await this.runBacktest({
        ...config,
        startDate: inSampleStart.toISOString().split('T')[0],
        endDate: inSampleEnd.toISOString().split('T')[0]
      });
      
      // Run backtest for out-of-sample period
      const outOfSampleResult = await this.runBacktest({
        ...config,
        startDate: outOfSampleStart.toISOString().split('T')[0],
        endDate: outOfSampleEnd.toISOString().split('T')[0]
      });
      
      const degradation = (inSampleResult.performance.annualizedReturn - 
                          outOfSampleResult.performance.annualizedReturn) / 
                         inSampleResult.performance.annualizedReturn;
      
      periods.push({
        inSampleStart: inSampleStart.toISOString().split('T')[0],
        inSampleEnd: inSampleEnd.toISOString().split('T')[0],
        outOfSampleStart: outOfSampleStart.toISOString().split('T')[0],
        outOfSampleEnd: outOfSampleEnd.toISOString().split('T')[0],
        inSampleReturn: inSampleResult.performance.annualizedReturn,
        outOfSampleReturn: outOfSampleResult.performance.annualizedReturn,
        degradation,
        stability: 1 - Math.abs(degradation)
      });
      
      currentDate.setMonth(currentDate.getMonth() + stepSize);
    }
    
    const averageDegradation = periods.reduce((sum, p) => sum + p.degradation, 0) / periods.length;
    const stability = periods.reduce((sum, p) => sum + p.stability, 0) / periods.length;
    const consistency = 1 - (periods.map(p => p.degradation).reduce((a, b) => a + Math.pow(b - averageDegradation, 2), 0) / periods.length);
    
    return {
      periods,
      summary: {
        averageDegradation,
        stability,
        consistency
      }
    };
  }

  // Monte Carlo simulation
  static async runMonteCarloSimulation(
    config: BacktestConfig,
    numSimulations: number = 1000
  ): Promise<{
    simulations: Array<{
      totalReturn: number;
      maxDrawdown: number;
      sharpeRatio: number;
      finalValue: number;
    }>;
    statistics: {
      meanReturn: number;
      medianReturn: number;
      stdReturn: number;
      percentiles: {
        p5: number;
        p25: number;
        p50: number;
        p75: number;
        p95: number;
      };
      probabilityOfLoss: number;
      expectedShortfall: number;
    };
  }> {
    // Implementation for Monte Carlo simulation
    const simulations = [];
    
    for (let i = 0; i < numSimulations; i++) {
      // Generate random walk based on historical returns
      const simulation = await this.generateRandomWalk(config);
      simulations.push(simulation);
    }
    
    const returns = simulations.map(s => s.totalReturn);
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const stdReturn = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length);
    
    const sortedReturns = returns.sort((a, b) => a - b);
    const percentiles = {
      p5: sortedReturns[Math.floor(sortedReturns.length * 0.05)],
      p25: sortedReturns[Math.floor(sortedReturns.length * 0.25)],
      p50: sortedReturns[Math.floor(sortedReturns.length * 0.5)],
      p75: sortedReturns[Math.floor(sortedReturns.length * 0.75)],
      p95: sortedReturns[Math.floor(sortedReturns.length * 0.95)]
    };
    
    const probabilityOfLoss = returns.filter(r => r < 0).length / returns.length;
    const negativeReturns = returns.filter(r => r < 0);
    const expectedShortfall = negativeReturns.length > 0 ? 
      negativeReturns.reduce((sum, r) => sum + r, 0) / negativeReturns.length : 0;
    
    return {
      simulations,
      statistics: {
        meanReturn,
        medianReturn: percentiles.p50,
        stdReturn,
        percentiles,
        probabilityOfLoss,
        expectedShortfall
      }
    };
  }

  // Risk management integration
  static async applyRiskManagement(
    config: BacktestConfig,
    riskLimits: {
      maxDrawdown: number;
      maxPositionSize: number;
      maxLeverage: number;
      varLimit: number;
      stopLoss: number;
      takeProfit: number;
    }
  ): Promise<{
    adjustedConfig: BacktestConfig;
    riskBreaches: string[];
    riskScore: number;
  }> {
    const riskBreaches = [];
    let riskScore = 0;

    // Check drawdown limits
    if (config.maxDrawdown && config.maxDrawdown > riskLimits.maxDrawdown) {
      riskBreaches.push(`Max drawdown limit exceeded: ${config.maxDrawdown * 100}% > ${riskLimits.maxDrawdown * 100}%`);
      riskScore += 30;
    }

    // Check position size limits
    if (config.positionSize > riskLimits.maxPositionSize) {
      riskBreaches.push(`Position size limit exceeded: ${config.positionSize * 100}% > ${riskLimits.maxPositionSize * 100}%`);
      riskScore += 25;
    }

    // Check leverage limits (assuming leverage is calculated from position size)
    const estimatedLeverage = config.positionSize * 10; // Rough estimation
    if (estimatedLeverage > riskLimits.maxLeverage) {
      riskBreaches.push(`Leverage limit exceeded: ${estimatedLeverage.toFixed(2)}x > ${riskLimits.maxLeverage}x`);
      riskScore += 20;
    }

    // Adjust config based on risk limits
    const adjustedConfig = {
      ...config,
      maxDrawdown: Math.min(config.maxDrawdown || 1, riskLimits.maxDrawdown),
      positionSize: Math.min(config.positionSize, riskLimits.maxPositionSize),
      stopLoss: riskLimits.stopLoss,
      takeProfit: riskLimits.takeProfit
    };

    return {
      adjustedConfig,
      riskBreaches,
      riskScore: Math.min(riskScore, 100)
    };
  }

  // Strategy optimization
  static async optimizeStrategy(
    baseConfig: BacktestConfig,
    parameters: Record<string, { min: number; max: number; step: number }>
  ): Promise<{
    bestConfig: BacktestConfig;
    bestPerformance: number;
    optimizationResults: Array<{
      config: BacktestConfig;
      performance: number;
      sharpeRatio: number;
      maxDrawdown: number;
    }>;
  }> {
    // Implementation for strategy optimization
    const optimizationResults = [];
    let bestPerformance = -Infinity;
    let bestConfig = baseConfig;
    
    // Grid search optimization
    const paramNames = Object.keys(parameters);
    const paramValues = paramNames.map(name => {
      const param = parameters[name];
      const values = [];
      for (let i = param.min; i <= param.max; i += param.step) {
        values.push(i);
      }
      return values;
    });
    
    // Generate all combinations
    const combinations = this.generateCombinations(paramValues);
    
    for (const combination of combinations) {
      const testConfig = { ...baseConfig };
      paramNames.forEach((name, index) => {
        testConfig[name] = combination[index];
      });
      
      const result = await this.runBacktest(testConfig);
      const performance = result.performance.sharpeRatio; // Use Sharpe ratio as optimization target
      
      optimizationResults.push({
        config: testConfig,
        performance,
        sharpeRatio: result.performance.sharpeRatio,
        maxDrawdown: result.performance.maxDrawdown
      });
      
      if (performance > bestPerformance) {
        bestPerformance = performance;
        bestConfig = testConfig;
      }
    }
    
    return {
      bestConfig,
      bestPerformance,
      optimizationResults
    };
  }

  // Core backtesting engine
  static async runBacktest(config: BacktestConfig): Promise<AdvancedBacktestResult> {
    try {
      // Fetch market data
      const marketData = await this.fetchMarketData(
        config.symbols,
        config.startDate,
        config.endDate,
        config.timeframe
      );
      
      // Initialize portfolio
      let portfolio = {
        cash: config.initialCapital,
        positions: new Map<string, number>(),
        equity: config.initialCapital
      };
      
      const trades = [];
      const equityCurve = [];
      
      // Process each time period
      for (let i = 0; i < marketData[0].data.length; i++) {
        const currentData = marketData.map(symbolData => ({
          symbol: symbolData.symbol,
          data: symbolData.data[i]
        }));
        
        // Execute strategy logic
        const signals = await this.generateSignals(currentData, config);
        
        // Execute trades based on signals
        for (const signal of signals) {
          if (signal.action === 'buy' && portfolio.cash > 0) {
            const quantity = Math.floor(portfolio.cash * config.positionSize / signal.price);
            if (quantity > 0) {
              portfolio.cash -= quantity * signal.price * (1 + config.transactionCosts);
              portfolio.positions.set(signal.symbol, (portfolio.positions.get(signal.symbol) || 0) + quantity);
              
              trades.push({
                symbol: signal.symbol,
                entryDate: new Date(signal.timestamp).toISOString(),
                entryPrice: signal.price,
                quantity,
                pnl: 0,
                return: 0,
                duration: 0
              });
            }
          } else if (signal.action === 'sell' && portfolio.positions.get(signal.symbol) > 0) {
            const quantity = portfolio.positions.get(signal.symbol);
            const proceeds = quantity * signal.price * (1 - config.transactionCosts);
            portfolio.cash += proceeds;
            portfolio.positions.set(signal.symbol, 0);
            
            // Update trade record
            const trade = trades.find(t => t.symbol === signal.symbol && t.exitDate === undefined);
            if (trade) {
              trade.exitDate = new Date(signal.timestamp).toISOString();
              trade.exitPrice = signal.price;
              trade.pnl = (signal.price - trade.entryPrice) * trade.quantity;
              trade.return = trade.pnl / (trade.entryPrice * trade.quantity);
              trade.duration = new Date(trade.exitDate).getTime() - new Date(trade.entryDate).getTime();
            }
          }
        }
        
        // Calculate portfolio value
        let portfolioValue = portfolio.cash;
        for (const [symbol, quantity] of portfolio.positions) {
          const currentPrice = currentData.find(d => d.symbol === symbol)?.data?.c || 0;
          portfolioValue += quantity * currentPrice;
        }
        
        portfolio.equity = portfolioValue;
        
        // Record equity curve
        equityCurve.push({
          date: new Date(currentData[0].data.t).toISOString(),
          value: portfolioValue,
          drawdown: 0 // Calculate drawdown
        });
      }
      
      // Calculate performance metrics
      const performance = this.calculatePerformanceMetrics(equityCurve, trades, config);
      
      return {
        id: config.id,
        config,
        performance,
        equityCurve,
        trades,
        riskMetrics: this.calculateRiskMetrics(equityCurve),
        attribution: this.calculateAttribution(trades, config),
        status: 'completed',
        progress: 100,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        id: config.id,
        config,
        performance: {} as any,
        equityCurve: [],
        trades: [],
        riskMetrics: {} as any,
        attribution: {} as any,
        status: 'failed',
        progress: 0,
        startTime: new Date().toISOString(),
        error: error.message
      };
    }
  }

  // Helper methods
  private static async generateSignals(data: any[], config: BacktestConfig): Promise<any[]> {
    // Implement your strategy logic here
    // This is where you'd add your trading signals
    return [];
  }

  private static calculatePerformanceMetrics(equityCurve: any[], trades: any[], config: BacktestConfig) {
    // Implementation for performance metrics calculation
    return {
      totalReturn: 0,
      annualizedReturn: 0,
      volatility: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      maxDrawdown: 0,
      maxDrawdownDuration: 0,
      winRate: 0,
      profitFactor: 0,
      expectancy: 0,
      var95: 0,
      var99: 0,
      expectedShortfall: 0,
      beta: 0,
      alpha: 0,
      informationRatio: 0,
      trackingError: 0
    };
  }

  private static calculateRiskMetrics(equityCurve: any[]) {
    if (equityCurve.length === 0) {
      return {
        var95: 0,
        var99: 0,
        expectedShortfall: 0,
        maxDrawdown: 0,
        averageDrawdown: 0,
        drawdownDuration: 0,
        recoveryTime: 0
      };
    }

    // Calculate daily returns
    const returns = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const dailyReturn = (equityCurve[i].value - equityCurve[i - 1].value) / equityCurve[i - 1].value;
      returns.push(dailyReturn);
    }

    // Calculate VaR (Value at Risk)
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const var95Index = Math.floor(sortedReturns.length * 0.05);
    const var99Index = Math.floor(sortedReturns.length * 0.01);
    const var95 = sortedReturns[var95Index] || 0;
    const var99 = sortedReturns[var99Index] || 0;

    // Calculate Expected Shortfall (Conditional VaR)
    const tailReturns = sortedReturns.slice(0, var95Index + 1);
    const expectedShortfall = tailReturns.length > 0 ? 
      tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length : 0;

    // Calculate drawdown metrics
    let maxDrawdown = 0;
    let currentDrawdown = 0;
    let drawdownStart = 0;
    let maxDrawdownDuration = 0;
    let currentDrawdownDuration = 0;
    let drawdowns = [];

    for (let i = 0; i < equityCurve.length; i++) {
      const peak = Math.max(...equityCurve.slice(0, i + 1).map(point => point.value));
      const currentValue = equityCurve[i].value;
      const drawdown = (peak - currentValue) / peak;
      
      if (drawdown > currentDrawdown) {
        currentDrawdown = drawdown;
        if (currentDrawdownDuration === 0) {
          drawdownStart = i;
        }
        currentDrawdownDuration++;
      } else {
        if (currentDrawdown > 0) {
          drawdowns.push({
            start: drawdownStart,
            end: i - 1,
            duration: currentDrawdownDuration,
            maxDrawdown: currentDrawdown
          });
        }
        currentDrawdown = 0;
        currentDrawdownDuration = 0;
      }
      
      maxDrawdown = Math.max(maxDrawdown, drawdown);
      maxDrawdownDuration = Math.max(maxDrawdownDuration, currentDrawdownDuration);
    }

    // Calculate average drawdown
    const averageDrawdown = drawdowns.length > 0 ? 
      drawdowns.reduce((sum, dd) => sum + dd.maxDrawdown, 0) / drawdowns.length : 0;

    // Calculate recovery time (average time to recover from drawdown)
    const recoveryTimes = drawdowns.map(dd => dd.duration);
    const recoveryTime = recoveryTimes.length > 0 ? 
      recoveryTimes.reduce((sum, time) => sum + time, 0) / recoveryTimes.length : 0;

    return {
      var95: Math.abs(var95) * 100, // Convert to percentage
      var99: Math.abs(var99) * 100,
      expectedShortfall: Math.abs(expectedShortfall) * 100,
      maxDrawdown: maxDrawdown * 100,
      averageDrawdown: averageDrawdown * 100,
      drawdownDuration: maxDrawdownDuration,
      recoveryTime: recoveryTime
    };
  }

  private static calculateAttribution(trades: any[], config: BacktestConfig) {
    // Implementation for attribution analysis
    return {
      sectorAllocation: {},
      factorExposure: {},
      alpha: 0,
      beta: 0,
      trackingError: 0
    };
  }

  private static generateCombinations(arrays: any[][]): any[][] {
    if (arrays.length === 0) return [[]];
    if (arrays.length === 1) return arrays[0].map(item => [item]);
    
    const result = [];
    const rest = this.generateCombinations(arrays.slice(1));
    
    for (const item of arrays[0]) {
      for (const combination of rest) {
        result.push([item, ...combination]);
      }
    }
    
    return result;
  }

  private static async generateRandomWalk(config: BacktestConfig): Promise<any> {
    // Implementation for random walk generation
    return {
      totalReturn: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      finalValue: 0
    };
  }
}
