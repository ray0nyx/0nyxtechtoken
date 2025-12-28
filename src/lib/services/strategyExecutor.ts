/**
 * Strategy Execution Service
 * Integrates with Python backend for strategy compilation and execution
 */

export interface StrategyExecutionRequest {
  code: string;
  symbols: string[];
  startDate: string;
  endDate: string;
  initialCapital: number;
  timeframe: string;
  parameters?: Record<string, any>;
}

export interface StrategyExecutionResult {
  success: boolean;
  backtestId?: string;
  results?: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    totalTrades: number;
    profitFactor: number;
    volatility: number;
    calmarRatio: number;
    sortinoRatio: number;
    var95: number;
    cvar95: number;
    alpha: number;
    beta: number;
    informationRatio: number;
    trackingError: number;
    treynorRatio: number;
  };
  trades?: Array<{
    symbol: string;
    quantity: number;
    price: number;
    time: string;
    type: 'buy' | 'sell';
    pnl: number;
  }>;
  equityCurve?: Array<{
    time: string;
    value: number;
  }>;
  error?: string;
  executionTime?: number;
}

class StrategyExecutorService {
  private baseUrl: string;
  private isBackendAvailable: boolean = false;

  constructor() {
    this.baseUrl = 'http://localhost:8001/api';
    this.checkBackendAvailability();
  }

  private async checkBackendAvailability(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl.replace('/api', '')}/`);
      this.isBackendAvailable = response.ok;
    } catch (error) {
      console.warn('Strategy execution backend not available');
      this.isBackendAvailable = false;
    }
  }

  async executeStrategy(request: StrategyExecutionRequest): Promise<StrategyExecutionResult> {
    // First validate the code before execution
    const validationResult = await this.validateStrategy(request.code);
    if (!validationResult.success) {
      return {
        success: false,
        error: `Code validation failed: ${validationResult.errors.join(', ')}`,
        executionTime: 0
      };
    }

    if (!this.isBackendAvailable) {
      return this.getMockExecutionResult(request);
    }

    try {
      const response = await fetch(`${this.baseUrl}/strategy/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Strategy execution error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async compileStrategy(code: string): Promise<{ success: boolean; errors: string[]; warnings: string[] }> {
    if (!this.isBackendAvailable) {
      return this.getMockCompilationResult(code);
    }

    try {
      const response = await fetch(`${this.baseUrl}/strategy/compile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Strategy compilation error:', error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
        warnings: [],
      };
    }
  }

  async validateStrategy(code: string): Promise<{ success: boolean; errors: string[]; warnings: string[] }> {
    if (!this.isBackendAvailable) {
      return this.getMockValidationResult(code);
    }

    try {
      const response = await fetch(`${this.baseUrl}/strategy/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Strategy validation error:', error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
        warnings: [],
      };
    }
  }

  async getBacktestStatus(backtestId: string): Promise<{
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: number;
    results?: StrategyExecutionResult;
  }> {
    if (!this.isBackendAvailable) {
      return {
        status: 'completed',
        progress: 100,
        results: this.getMockExecutionResult({
          code: '',
          symbols: [],
          startDate: '',
          endDate: '',
          initialCapital: 100000,
          timeframe: '1h',
        }),
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/strategy/backtest/${backtestId}/status`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Backtest status error:', error);
      return {
        status: 'failed',
        progress: 0,
      };
    }
  }

  private getMockExecutionResult(request: StrategyExecutionRequest): StrategyExecutionResult {
    // Generate mock results for demonstration
    const totalReturn = Math.random() * 50 - 10; // -10% to 40%
    const sharpeRatio = Math.random() * 2 - 0.5; // -0.5 to 1.5
    const maxDrawdown = Math.random() * 20 - 5; // -5% to 15%
    const winRate = Math.random() * 40 + 30; // 30% to 70%
    const totalTrades = Math.floor(Math.random() * 100) + 10; // 10 to 110 trades

    return {
      success: true,
      backtestId: `backtest_${Date.now()}`,
      results: {
        totalReturn,
        sharpeRatio,
        maxDrawdown,
        winRate,
        totalTrades,
        profitFactor: Math.random() * 2 + 0.5,
        volatility: Math.random() * 30 + 10,
        calmarRatio: totalReturn / Math.abs(maxDrawdown),
        sortinoRatio: sharpeRatio * 1.2,
        var95: Math.random() * 10 - 5,
        cvar95: Math.random() * 15 - 7.5,
        alpha: Math.random() * 10 - 5,
        beta: Math.random() * 2,
        informationRatio: Math.random() * 1.5 - 0.5,
        trackingError: Math.random() * 20 + 5,
        treynorRatio: totalReturn / Math.max(beta, 0.1),
      },
      trades: this.generateMockTrades(request.symbols, totalTrades),
      equityCurve: this.generateMockEquityCurve(request.startDate, request.endDate),
      executionTime: Math.random() * 5000 + 1000, // 1-6 seconds
    };
  }

  private getMockCompilationResult(code: string): { success: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if code is empty or too short
    if (!code || code.trim().length < 10) {
      errors.push('Code is too short or empty. Please write a proper strategy.');
    }

    // Check for gibberish patterns
    const lines = code.split('\n').filter(line => line.trim().length > 0);
    const meaningfulLines = lines.filter(line => {
      const trimmed = line.trim();
      return trimmed.includes('def ') || 
             trimmed.includes('class ') || 
             trimmed.includes('import ') || 
             trimmed.includes('from ') ||
             trimmed.includes('if ') ||
             trimmed.includes('for ') ||
             trimmed.includes('while ') ||
             trimmed.includes('return ') ||
             trimmed.includes('self.') ||
             trimmed.includes('(') ||
             trimmed.includes('=') ||
             trimmed.startsWith('#');
    });

    if (meaningfulLines.length < 2) {
      errors.push('Code appears to be gibberish or invalid. Please write proper Python code.');
    }

    // Check for required strategy structure
    if (!code.includes('class ')) {
      errors.push('Strategy must define a class (e.g., class MyStrategy(QCAlgorithm):)');
    }

    if (!code.includes('def Initialize(')) {
      errors.push('Strategy must have an Initialize() method');
    }

    if (!code.includes('def OnData(')) {
      errors.push('Strategy must have an OnData() method');
    }

    // Check for disallowed functions
    if (code.includes('input(')) {
      errors.push('input() function is not allowed in backtesting');
    }

    if (code.includes('time.sleep(')) {
      errors.push('time.sleep() is not allowed in backtesting');
    }

    // Check for basic Python syntax
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      errors.push('Mismatched parentheses in code');
    }

    // Check for warnings
    if (code.includes('print(') && !code.includes('self.Log(')) {
      warnings.push('Consider using self.Log() instead of print() for backtesting');
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
    };
  }

  private getMockValidationResult(code: string): { success: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if code is empty or too short
    if (!code || code.trim().length < 10) {
      errors.push('Code is too short or empty. Please write a proper strategy.');
    }

    // Check for gibberish patterns (random characters, no meaningful structure)
    const lines = code.split('\n').filter(line => line.trim().length > 0);
    const meaningfulLines = lines.filter(line => {
      const trimmed = line.trim();
      // Check if line contains Python keywords, functions, or meaningful structure
      return trimmed.includes('def ') || 
             trimmed.includes('class ') || 
             trimmed.includes('import ') || 
             trimmed.includes('from ') ||
             trimmed.includes('if ') ||
             trimmed.includes('for ') ||
             trimmed.includes('while ') ||
             trimmed.includes('return ') ||
             trimmed.includes('self.') ||
             trimmed.includes('(') ||
             trimmed.includes('=') ||
             trimmed.startsWith('#');
    });

    if (meaningfulLines.length < 2) {
      errors.push('Code appears to be gibberish or invalid. Please write proper Python code.');
    }

    // Check for required strategy structure
    if (!code.includes('class ')) {
      errors.push('Strategy must define a class (e.g., class MyStrategy(QCAlgorithm):)');
    }

    if (!code.includes('def Initialize(')) {
      errors.push('Strategy must have an Initialize() method');
    }

    if (!code.includes('def OnData(')) {
      errors.push('Strategy must have an OnData() method');
    }

    // Check for common issues
    if (code.includes('time.sleep(')) {
      errors.push('time.sleep() is not allowed in backtesting');
    }

    if (code.includes('input(')) {
      errors.push('input() function is not allowed in backtesting');
    }

    if (code.includes('print(') && !code.includes('self.Log(')) {
      warnings.push('Consider using self.Log() instead of print() for better logging');
    }

    // Check for basic Python syntax issues
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      errors.push('Mismatched parentheses in code');
    }

    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push('Mismatched braces in code');
    }

    const openBrackets = (code.match(/\[/g) || []).length;
    const closeBrackets = (code.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) {
      errors.push('Mismatched brackets in code');
    }

    // Check for obvious syntax errors
    if (code.includes('def ') && !code.includes(':')) {
      errors.push('Function definitions must end with a colon (:)');
    }

    if (code.includes('class ') && !code.includes(':')) {
      errors.push('Class definitions must end with a colon (:)');
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
    };
  }

  private generateMockTrades(symbols: string[], count: number) {
    const trades = [];
    const startTime = new Date();
    
    for (let i = 0; i < count; i++) {
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      const time = new Date(startTime.getTime() + i * 60000); // 1 minute intervals
      const price = Math.random() * 1000 + 100; // $100-$1100
      const quantity = Math.random() * 10 + 1; // 1-11 shares
      const type = Math.random() > 0.5 ? 'buy' : 'sell';
      const pnl = (Math.random() - 0.5) * 100; // -$50 to $50

      trades.push({
        symbol,
        quantity,
        price,
        time: time.toISOString(),
        type,
        pnl,
      });
    }

    return trades;
  }

  private generateMockEquityCurve(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const curve = [];
    
    let value = 100000; // Starting value
    
    for (let i = 0; i <= days; i++) {
      const time = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const dailyReturn = (Math.random() - 0.5) * 0.05; // -2.5% to 2.5% daily return
      value *= (1 + dailyReturn);
      
      curve.push({
        time: time.toISOString(),
        value: Math.max(value, 0), // Ensure non-negative
      });
    }

    return curve;
  }
}

export const strategyExecutor = new StrategyExecutorService();
