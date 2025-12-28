import { createClient } from '@/lib/supabase/client';

export interface BacktestResult {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startTime?: string;
  endTime?: string;
  metrics?: {
    sharpeRatio: number;
    totalReturn: number;
    maxDrawdown: number;
    winRate?: number;
    totalTrades?: number;
  };
  equityCurve?: { timestamp: string; equity: number }[];
}

export interface Algorithm {
  id: string;
  name: string;
  language: 'Python' | 'C#';
  status: 'Running' | 'Stopped' | 'Draft';
  createdAt: string;
  lastModified: string;
  description?: string;
  code?: string;
}

class QuantBacktesterService {
  private supabase = createClient();

  /**
   * Fetch all backtest results for the current user
   */
  async getBacktests(): Promise<BacktestResult[]> {
    try {
      // Try Supabase first
      const { data, error } = await this.supabase
        .from('quant_backtests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      // Handle 404 (table doesn't exist) gracefully
      if (error) {
        if (error.code === 'PGRST116' || error.status === 404 || error.code === '42P01') {
          // Table doesn't exist - return empty array silently
          return [];
        }
        // For other errors, continue to fallback
        throw error;
      }

      if (data && data.length > 0) {
        return data.map((bt: any) => ({
          id: bt.id,
          name: bt.name || `Backtest ${bt.id.slice(0, 8)}`,
          status: bt.status || 'completed',
          progress: bt.progress || 100,
          startTime: bt.created_at,
          endTime: bt.completed_at,
          metrics: bt.metrics ? {
            sharpeRatio: bt.metrics.sharpe_ratio || 0,
            totalReturn: bt.metrics.total_return || 0,
            maxDrawdown: bt.metrics.max_drawdown || 0,
            winRate: bt.metrics.win_rate,
            totalTrades: bt.metrics.total_trades,
          } : undefined,
          equityCurve: bt.equity_curve || [],
        }));
      }

      // Fallback: Try lean-service API
      const response = await fetch('/api/institutional/backtests');
      if (response.ok) {
        const apiData = await response.json();
        return apiData.map((bt: any) => ({
          id: bt.id || bt.job_id,
          name: bt.name || `Backtest ${bt.id?.slice(0, 8) || 'unknown'}`,
          status: bt.status || 'completed',
          progress: bt.progress || 100,
          startTime: bt.created_at,
          endTime: bt.completed_at,
          metrics: bt.results ? {
            sharpeRatio: bt.results.sharpe_ratio || 0,
            totalReturn: bt.results.total_return || 0,
            maxDrawdown: bt.results.max_drawdown || 0,
            winRate: bt.results.win_rate,
            totalTrades: bt.results.total_trades,
          } : undefined,
        }));
      }

      return [];
    } catch (error) {
      console.error('Error fetching backtests:', error);
      return [];
    }
  }

  /**
   * Fetch a single backtest by ID
   */
  async getBacktest(id: string): Promise<BacktestResult | null> {
    try {
      const { data, error } = await this.supabase
        .from('quant_backtests')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        return {
          id: data.id,
          name: data.name || `Backtest ${data.id.slice(0, 8)}`,
          status: data.status || 'completed',
          progress: data.progress || 100,
          startTime: data.created_at,
          endTime: data.completed_at,
          metrics: data.metrics ? {
            sharpeRatio: data.metrics.sharpe_ratio || 0,
            totalReturn: data.metrics.total_return || 0,
            maxDrawdown: data.metrics.max_drawdown || 0,
            winRate: data.metrics.win_rate,
            totalTrades: data.metrics.total_trades,
          } : undefined,
          equityCurve: data.equity_curve || [],
        };
      }

      return null;
    } catch (error) {
      console.error('Error fetching backtest:', error);
      return null;
    }
  }

  /**
   * Fetch all algorithms for the current user
   */
  async getAlgorithms(): Promise<Algorithm[]> {
    try {
      // Try Supabase
      const { data, error } = await this.supabase
        .from('quant_algorithms')
        .select('*')
        .order('created_at', { ascending: false });

      // Handle 404 (table doesn't exist) or other errors gracefully
      if (error) {
        // If table doesn't exist (404) or RLS policy blocks access, return empty array
        if (error.code === 'PGRST116' || 
            error.status === 404 || 
            error.code === '42P01' ||
            error.message?.includes('relation') ||
            error.message?.includes('does not exist') ||
            error.message?.includes('Table not found')) {
          // Table doesn't exist - return empty array silently
          return [];
        }
        // For other errors, silently return empty array (don't log)
        return [];
      }

      // Check if data contains an error object (from our custom fetch)
      if (data && typeof data === 'object' && 'error' in data) {
        return [];
      }

      if (data && Array.isArray(data) && data.length > 0) {
        return data.map((alg: any) => ({
          id: alg.id,
          name: alg.name,
          language: (alg.language || 'Python') as 'Python' | 'C#',
          status: (alg.status || 'Draft') as 'Running' | 'Stopped' | 'Draft',
          createdAt: alg.created_at,
          lastModified: alg.updated_at || alg.created_at,
          description: alg.description,
          code: alg.code,
        }));
      }

      return [];
    } catch (error: any) {
      // Catch any unexpected errors and return empty array silently
      // Don't log anything - these are expected for missing tables
      return [];
    }
  }

  /**
   * Get dashboard summary metrics
   */
  async getDashboardMetrics(): Promise<{
    portfolioValue: number;
    portfolioChange: number;
    activeAlgorithms: number;
    recentBacktests: number;
    sharpeRatio: number;
    totalReturn: number;
    maxDrawdown: number;
  }> {
    try {
      const [algorithms, backtests] = await Promise.all([
        this.getAlgorithms(),
        this.getBacktests(),
      ]);

      const activeAlgorithms = algorithms.filter((a) => a.status === 'Running').length;
      const recentBacktests = backtests.filter((b) => {
        if (!b.startTime) return false;
        const daysAgo = (Date.now() - new Date(b.startTime).getTime()) / (1000 * 60 * 60 * 24);
        return daysAgo <= 30;
      }).length;

      // Calculate aggregate metrics from recent backtests
      const completedBacktests = backtests.filter((b) => b.status === 'completed' && b.metrics);
      const avgSharpe = completedBacktests.length > 0
        ? completedBacktests.reduce((sum, b) => sum + (b.metrics?.sharpeRatio || 0), 0) / completedBacktests.length
        : 0;
      const avgReturn = completedBacktests.length > 0
        ? completedBacktests.reduce((sum, b) => sum + (b.metrics?.totalReturn || 0), 0) / completedBacktests.length
        : 0;
      const worstDrawdown = completedBacktests.length > 0
        ? Math.min(...completedBacktests.map((b) => b.metrics?.maxDrawdown || 0))
        : 0;

      // Calculate portfolio value from equity curves
      let portfolioValue = 100000; // Default
      if (completedBacktests.length > 0) {
        const latestEquity = completedBacktests
          .map((b) => b.equityCurve?.[b.equityCurve.length - 1]?.equity)
          .filter((e): e is number => e !== undefined);
        if (latestEquity.length > 0) {
          portfolioValue = latestEquity.reduce((sum, e) => sum + e, 0) / latestEquity.length;
        }
      }

      return {
        portfolioValue,
        portfolioChange: avgReturn,
        activeAlgorithms,
        recentBacktests,
        sharpeRatio: avgSharpe,
        totalReturn: avgReturn,
        maxDrawdown: worstDrawdown,
      };
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
      return {
        portfolioValue: 100000,
        portfolioChange: 0,
        activeAlgorithms: 0,
        recentBacktests: 0,
        sharpeRatio: 0,
        totalReturn: 0,
        maxDrawdown: 0,
      };
    }
  }
}

export const quantBacktesterService = new QuantBacktesterService();

