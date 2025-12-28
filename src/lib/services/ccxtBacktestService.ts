/**
 * CCXT Backtest Service
 * Provides CCXT-based market data fetching for backtesting crypto strategies
 */

// Use dynamic import to avoid bundling issues with CCXT
let ccxt: any = null;

const loadCCXT = async () => {
  if (!ccxt) {
    try {
      ccxt = await import('ccxt');
    } catch (error) {
      console.error('Failed to load CCXT:', error);
      throw new Error('CCXT library failed to load. Please ensure it is installed.');
    }
  }
  return ccxt;
};

export interface CCXTBacktestConfig {
  exchange: string;
  symbol: string;
  timeframe: string;
  startDate: string;
  endDate: string;
  apiKey?: string;
  secret?: string;
  sandbox?: boolean;
}

export interface OHLCVData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class CCXTBacktestService {
  private exchanges: Map<string, any> = new Map();
  private supportedExchanges = ['kraken', 'binance', 'coinbasepro', 'bybit', 'okx'];

  /**
   * Initialize exchange connection
   */
  async initializeExchange(
    exchangeName: string,
    apiKey?: string,
    secret?: string,
    sandbox: boolean = false
  ): Promise<any> {
    const key = `${exchangeName}_${apiKey || 'public'}`;
    
    if (this.exchanges.has(key)) {
      return this.exchanges.get(key)!;
    }

    if (!this.supportedExchanges.includes(exchangeName.toLowerCase())) {
      throw new Error(`Exchange ${exchangeName} is not supported. Supported: ${this.supportedExchanges.join(', ')}`);
    }

    // Load CCXT dynamically
    const ccxtModule = await loadCCXT();

    const ExchangeClass = (ccxtModule as any).default?.[exchangeName.toLowerCase()] || 
                          (ccxtModule as any)[exchangeName.toLowerCase()] ||
                          (ccxtModule.default || ccxtModule)[exchangeName.toLowerCase()];
    
    if (!ExchangeClass) {
      throw new Error(`Exchange class ${exchangeName} not found in CCXT`);
    }

    const exchange = new ExchangeClass({
      apiKey,
      secret,
      sandbox,
      enableRateLimit: true,
      rateLimit: 1000,
    });

    this.exchanges.set(key, exchange);
    return exchange;
  }

  /**
   * Fetch historical OHLCV data
   */
  async fetchOHLCV(
    config: CCXTBacktestConfig
  ): Promise<OHLCVData[]> {
    try {
      // Load CCXT dynamically
      const ccxtModule = await loadCCXT();
      if (!ccxtModule) {
        throw new Error('CCXT library not available');
      }

      const exchange = await this.initializeExchange(
        config.exchange,
        config.apiKey,
        config.secret,
        config.sandbox || false
      );

      // Convert timeframe to CCXT format
      const timeframe = this.normalizeTimeframe(config.timeframe);
      
      // Fetch data
      const since = new Date(config.startDate).getTime();
      const until = new Date(config.endDate).getTime();
      
      let allData: OHLCVData[] = [];
      let currentSince = since;

      // CCXT has limits on how much data can be fetched at once
      // We need to paginate for large date ranges
      while (currentSince < until) {
        const data = await exchange.fetchOHLCV(
          config.symbol,
          timeframe,
          currentSince,
          undefined, // limit - let CCXT decide
          {}
        );

        if (!data || data.length === 0) {
          break;
        }

        allData = allData.concat(
          data.map(([timestamp, open, high, low, close, volume]) => ({
            timestamp,
            open,
            high,
            low,
            close,
            volume,
          }))
        );

        // Move to next batch (use last timestamp + 1)
        const lastTimestamp = data[data.length - 1][0];
        currentSince = lastTimestamp + 1;

        // Prevent infinite loops
        if (currentSince >= until) {
          break;
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, exchange.rateLimit));
      }

      // Remove duplicates and sort
      const uniqueData = Array.from(
        new Map(allData.map(item => [item.timestamp, item])).values()
      ).sort((a, b) => a.timestamp - b.timestamp);

      // Filter to date range
      return uniqueData.filter(
        item => item.timestamp >= since && item.timestamp <= until
      );
    } catch (error: any) {
      console.error('Error fetching OHLCV data:', error);
      throw new Error(`Failed to fetch data from ${config.exchange}: ${error.message}`);
    }
  }

  /**
   * Get available symbols for an exchange
   */
  async getAvailableSymbols(exchangeName: string): Promise<string[]> {
    try {
      const exchange = await this.initializeExchange(exchangeName);
      await exchange.loadMarkets();
      return exchange.symbols.filter(symbol => symbol.includes('/'));
    } catch (error: any) {
      console.error('Error fetching symbols:', error);
      return [];
    }
  }

  /**
   * Get exchange info
   */
  async getExchangeInfo(exchangeName: string) {
    try {
      // Load CCXT dynamically
      const ccxtModule = await loadCCXT();
      if (!ccxtModule) {
        throw new Error('CCXT library not available');
      }

      const exchange = await this.initializeExchange(exchangeName);
      await exchange.loadMarkets();
      return {
        name: exchange.name,
        countries: exchange.countries || [],
        urls: exchange.urls || {},
        version: exchange.version,
        rateLimit: exchange.rateLimit,
        has: exchange.has || {},
        timeframes: exchange.timeframes || {},
        symbols: exchange.symbols.length,
      };
    } catch (error: any) {
      console.error('Error fetching exchange info:', error);
      throw error;
    }
  }

  /**
   * Normalize timeframe to CCXT format
   */
  private normalizeTimeframe(timeframe: string): string {
    const mapping: Record<string, string> = {
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '30m': '30m',
      '1h': '1h',
      '4h': '4h',
      '1d': '1d',
      '1w': '1w',
      '1M': '1M',
    };

    return mapping[timeframe] || timeframe;
  }

  /**
   * Get supported exchanges
   */
  getSupportedExchanges(): string[] {
    return [...this.supportedExchanges];
  }
}

// Export singleton instance
export const ccxtBacktestService = new CCXTBacktestService();

