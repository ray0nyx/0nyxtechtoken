/**
 * Data Service for Market Data Integration
 * Handles CCXT, yfinance, and other data sources for backtesting
 */

// Use dynamic import for CCXT to avoid bundling issues
let ccxt: any = null;
const loadCCXT = async () => {
  if (!ccxt) {
    try {
      ccxt = await import('ccxt');
    } catch (error) {
      console.error('Failed to load CCXT:', error);
      return null;
    }
  }
  return ccxt;
};

// Note: yfinance and Redis are server-side only, not used in browser
// import yfinance from 'yfinance';
// import Redis from 'ioredis';

export interface MarketDataRequest {
  symbols: string[];
  startDate: Date;
  endDate: Date;
  timeframe: string;
  exchanges?: string[];
  source?: 'ccxt' | 'yfinance' | 'polygon' | 'custom';
}

export interface OHLCVData {
  timestamp: Date;
  symbol: string;
  exchange: string;
  timeframe: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  tradeCount?: number;
  vwap?: number;
}

export interface DataSourceConfig {
  name: string;
  provider: string;
  config: any;
  isActive: boolean;
  rateLimitPerMinute: number;
}

export class DataService {
  private supabase: any;
  private redis: any; // Redis is server-side only
  private exchanges: Map<string, any> = new Map();
  private dataCache: Map<string, any> = new Map();
  private rateLimiters: Map<string, { count: number; resetTime: number }> = new Map();

  constructor() {
    // Initialize Supabase client (browser-side)
    try {
      this.supabase = createClient();
    } catch (error) {
      console.warn('Supabase client initialization failed (may be server-side):', error);
    }

    // Redis is server-side only - skip in browser
    // this.redis = new Redis({...});

    // Initialize exchanges asynchronously
    this.initializeExchanges();
  }

  private async initializeExchanges() {
    // Load CCXT dynamically
    const ccxtModule = await loadCCXT();
    if (!ccxtModule) {
      console.warn('CCXT not available - exchanges will be initialized on demand');
      return;
    }

    // Initialize CCXT exchanges
    const exchangeConfigs = [
      { name: 'binance', class: (ccxtModule.default || ccxtModule).binance },
      { name: 'coinbasepro', class: (ccxtModule.default || ccxtModule).coinbasepro },
      { name: 'kraken', class: (ccxtModule.default || ccxtModule).kraken },
      { name: 'bybit', class: (ccxtModule.default || ccxtModule).bybit },
      { name: 'okx', class: (ccxtModule.default || ccxtModule).okx },
    ];

    for (const config of exchangeConfigs) {
      try {
        if (config.class) {
          const exchange = new config.class({
            apiKey: undefined, // Use public data by default
            secret: undefined,
            sandbox: false,
            enableRateLimit: true,
            rateLimit: 1000, // 1 second
          });

          this.exchanges.set(config.name, exchange);
          console.log(`Initialized ${config.name} exchange`);
        }
      } catch (error) {
        console.error(`Failed to initialize ${config.name} exchange:`, error);
      }
    }
  }

  /**
   * Fetch market data from various sources
   */
  async fetchMarketData(request: MarketDataRequest): Promise<OHLCVData[]> {
    const cacheKey = this.generateCacheKey(request);
    
    // Check cache first (browser-side cache)
    const cachedData = this.dataCache.get(cacheKey);
    if (cachedData) {
      console.log(`Returning cached data for ${request.symbols.join(',')}`);
      return cachedData;
    }

    let data: OHLCVData[] = [];

    try {
      switch (request.source) {
        case 'ccxt':
          data = await this.fetchFromCCXT(request);
          break;
        case 'yfinance':
          // yfinance is server-side only
          throw new Error('yfinance is not available in browser. Use CCXT instead.');
        case 'polygon':
          // Polygon requires API key and is typically server-side
          throw new Error('Polygon data source requires server-side implementation.');
        default:
          // Try CCXT as default
          data = await this.fetchFromCCXT(request);
      }

      // Cache the data (browser-side)
      this.dataCache.set(cacheKey, data);
      
      // Clear cache after 1 hour
      setTimeout(() => {
        this.dataCache.delete(cacheKey);
      }, 3600 * 1000);

      return data;
    } catch (error: any) {
      console.error('Failed to fetch market data:', error);
      throw new Error(`Failed to fetch market data: ${error.message || error}`);
    }
  }

  /**
   * Fetch data from CCXT exchanges
   */
  private async fetchFromCCXT(request: MarketDataRequest): Promise<OHLCVData[]> {
    const allData: OHLCVData[] = [];
    const exchanges = request.exchanges || ['binance'];

    // Ensure CCXT is loaded
    const ccxtModule = await loadCCXT();
    if (!ccxtModule) {
      throw new Error('CCXT library not available');
    }

    for (const exchangeName of exchanges) {
      let exchange = this.exchanges.get(exchangeName);
      
      // Initialize exchange if not already initialized
      if (!exchange) {
        try {
          const ExchangeClass = (ccxtModule.default || ccxtModule)[exchangeName.toLowerCase()];
          if (ExchangeClass) {
            exchange = new ExchangeClass({
              enableRateLimit: true,
              rateLimit: 1000,
            });
            this.exchanges.set(exchangeName, exchange);
          }
        } catch (error) {
          console.warn(`Failed to initialize ${exchangeName} exchange:`, error);
          continue;
        }
      }
      
      if (!exchange) {
        console.warn(`Exchange ${exchangeName} not available`);
        continue;
      }

      // Check rate limit
      if (!(await this.checkRateLimit(exchangeName))) {
        console.warn(`Rate limit exceeded for ${exchangeName}`);
        continue;
      }

      for (const symbol of request.symbols) {
        try {
          const ohlcv = await exchange.fetchOHLCV(
            symbol,
            request.timeframe,
            request.startDate.getTime(),
            undefined,
            { limit: 1000 }
          );

          const symbolData = ohlcv.map(candle => ({
            timestamp: new Date(candle[0]),
            symbol,
            exchange: exchangeName,
            timeframe: request.timeframe,
            open: candle[1],
            high: candle[2],
            low: candle[3],
            close: candle[4],
            volume: candle[5],
            tradeCount: candle[6] || 0,
            vwap: candle[7] || undefined,
          }));

          allData.push(...symbolData);
          console.log(`Fetched ${symbolData.length} candles for ${symbol} from ${exchangeName}`);

        } catch (error) {
          console.error(`Failed to fetch ${symbol} from ${exchangeName}:`, error);
        }
      }
    }

    return allData;
  }

  /**
   * Fetch data from Yahoo Finance
   */
  private async fetchFromYFinance(request: MarketDataRequest): Promise<OHLCVData[]> {
    const allData: OHLCVData[] = [];

    for (const symbol of request.symbols) {
      try {
        const ticker = yfinance.ticker(symbol);
        const data = await ticker.history({
          start: request.startDate,
          end: request.endDate,
          interval: this.convertTimeframe(request.timeframe),
        });

        const symbolData = data.map((row: any) => ({
          timestamp: new Date(row.Date),
          symbol,
          exchange: 'yahoo',
          timeframe: request.timeframe,
          open: row.Open,
          high: row.High,
          low: row.Low,
          close: row.Close,
          volume: row.Volume,
          tradeCount: 0,
          vwap: undefined,
        }));

        allData.push(...symbolData);
        console.log(`Fetched ${symbolData.length} candles for ${symbol} from Yahoo Finance`);

      } catch (error) {
        console.error(`Failed to fetch ${symbol} from Yahoo Finance:`, error);
      }
    }

    return allData;
  }

  /**
   * Fetch data from Polygon API
   */
  private async fetchFromPolygon(request: MarketDataRequest): Promise<OHLCVData[]> {
    const allData: OHLCVData[] = [];
    const apiKey = process.env.POLYGON_API_KEY;

    if (!apiKey) {
      throw new Error('Polygon API key not configured');
    }

    for (const symbol of request.symbols) {
      try {
        const timespan = this.convertTimeframeToPolygon(request.timeframe);
        const multiplier = this.getPolygonMultiplier(request.timeframe);
        
        const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${request.startDate.toISOString().split('T')[0]}/${request.endDate.toISOString().split('T')[0]}?apikey=${apiKey}`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK' && data.results) {
          const symbolData = data.results.map((candle: any) => ({
            timestamp: new Date(candle.t),
            symbol,
            exchange: 'polygon',
            timeframe: request.timeframe,
            open: candle.o,
            high: candle.h,
            low: candle.l,
            close: candle.c,
            volume: candle.v,
            tradeCount: candle.n || 0,
            vwap: candle.vw || undefined,
          }));

          allData.push(...symbolData);
          console.log(`Fetched ${symbolData.length} candles for ${symbol} from Polygon`);
        }

      } catch (error) {
        console.error(`Failed to fetch ${symbol} from Polygon:`, error);
      }
    }

    return allData;
  }

  /**
   * Fetch data from multiple sources and merge
   */
  private async fetchFromMultipleSources(request: MarketDataRequest): Promise<OHLCVData[]> {
    const sources = ['ccxt', 'yfinance'];
    const allData: OHLCVData[] = [];

    for (const source of sources) {
      try {
        const sourceData = await this.fetchMarketData({ ...request, source: source as any });
        allData.push(...sourceData);
      } catch (error) {
        console.error(`Failed to fetch from ${source}:`, error);
      }
    }

    // Remove duplicates and sort by timestamp
    const uniqueData = this.removeDuplicateData(allData);
    return uniqueData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Store market data in database (browser-side - optional)
   */
  private async storeMarketData(data: OHLCVData[]): Promise<void> {
    // This is optional - can be implemented if market_data table exists
    if (!this.supabase) return;
    
    try {
      const batchSize = 1000;
      const batches = this.chunkArray(data, batchSize);

      for (const batch of batches) {
        const { error } = await this.supabase
          .from('market_data')
          .upsert(batch.map(item => ({
            timestamp: item.timestamp.toISOString(),
            symbol: item.symbol,
            exchange: item.exchange,
            timeframe: item.timeframe,
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close,
            volume: item.volume,
            trade_count: item.tradeCount,
            vwap: item.vwap,
          })), {
            onConflict: 'timestamp,symbol,exchange,timeframe'
          });

        if (error) {
          console.warn('Failed to store market data (table may not exist):', error);
        }
      }

      console.log(`Stored ${data.length} market data points`);
    } catch (error) {
      console.warn('Failed to store market data:', error);
    }
  }

  /**
   * Get cached data (browser-side cache)
   */
  private async getCachedData(key: string): Promise<OHLCVData[] | null> {
    // Use browser-side cache instead of Redis
    try {
      const cached = sessionStorage.getItem(`market_data_${key}`);
      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      console.error('Failed to get cached data:', error);
      return null;
    }
  }

  /**
   * Cache data (browser-side cache)
   */
  private async cacheData(key: string, data: OHLCVData[], ttl: number): Promise<void> {
    try {
      sessionStorage.setItem(`market_data_${key}`, JSON.stringify(data));
      // Note: sessionStorage doesn't support TTL, but it clears on tab close
    } catch (error) {
      console.error('Failed to cache data:', error);
    }
  }

  /**
   * Generate cache key for request
   */
  private generateCacheKey(request: MarketDataRequest): string {
    const symbols = request.symbols.sort().join(',');
    const exchanges = (request.exchanges || ['default']).sort().join(',');
    return `market_data:${request.source || 'multi'}:${symbols}:${exchanges}:${request.timeframe}:${request.startDate.getTime()}:${request.endDate.getTime()}`;
  }

  /**
   * Check rate limit for exchange
   */
  private async checkRateLimit(exchangeName: string): Promise<boolean> {
    const now = Date.now();
    const limiter = this.rateLimiters.get(exchangeName);

    if (!limiter || now > limiter.resetTime) {
      this.rateLimiters.set(exchangeName, {
        count: 1,
        resetTime: now + 60000, // Reset every minute
      });
      return true;
    }

    if (limiter.count >= 60) { // 60 requests per minute
      return false;
    }

    limiter.count++;
    return true;
  }

  /**
   * Convert timeframe to yfinance format
   */
  private convertTimeframe(timeframe: string): string {
    const mapping: { [key: string]: string } = {
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '30m': '30m',
      '1h': '1h',
      '4h': '4h',
      '1d': '1d',
      '1w': '1wk',
      '1M': '1mo',
    };
    return mapping[timeframe] || '1d';
  }

  /**
   * Convert timeframe to Polygon format
   */
  private convertTimeframeToPolygon(timeframe: string): string {
    const mapping: { [key: string]: string } = {
      '1m': 'minute',
      '5m': 'minute',
      '15m': 'minute',
      '30m': 'minute',
      '1h': 'hour',
      '4h': 'hour',
      '1d': 'day',
      '1w': 'week',
      '1M': 'month',
    };
    return mapping[timeframe] || 'day';
  }

  /**
   * Get Polygon multiplier for timeframe
   */
  private getPolygonMultiplier(timeframe: string): number {
    const mapping: { [key: string]: number } = {
      '1m': 1,
      '5m': 5,
      '15m': 15,
      '30m': 30,
      '1h': 1,
      '4h': 4,
      '1d': 1,
      '1w': 1,
      '1M': 1,
    };
    return mapping[timeframe] || 1;
  }

  /**
   * Remove duplicate data points
   */
  private removeDuplicateData(data: OHLCVData[]): OHLCVData[] {
    const seen = new Set();
    return data.filter(item => {
      const key = `${item.symbol}-${item.exchange}-${item.timestamp.getTime()}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Get available symbols from exchange
   */
  async getAvailableSymbols(exchangeName: string): Promise<string[]> {
    try {
      // Ensure CCXT is loaded
      const ccxtModule = await loadCCXT();
      if (!ccxtModule) {
        throw new Error('CCXT library not available');
      }

      let exchange = this.exchanges.get(exchangeName);
      
      // Initialize exchange if not already initialized
      if (!exchange) {
        const ExchangeClass = (ccxtModule.default || ccxtModule)[exchangeName.toLowerCase()];
        if (ExchangeClass) {
          exchange = new ExchangeClass({
            enableRateLimit: true,
            rateLimit: 1000,
          });
          this.exchanges.set(exchangeName, exchange);
        }
      }

      if (!exchange) {
        throw new Error(`Exchange ${exchangeName} not available`);
      }

      const markets = await exchange.loadMarkets();
      return Object.keys(markets);
    } catch (error) {
      console.error(`Failed to get symbols from ${exchangeName}:`, error);
      return [];
    }
  }

  /**
   * Get exchange info
   */
  async getExchangeInfo(exchangeName: string): Promise<any> {
    try {
      const exchange = this.exchanges.get(exchangeName);
      if (!exchange) {
        throw new Error(`Exchange ${exchangeName} not available`);
      }

      return {
        name: exchange.name,
        countries: exchange.countries,
        rateLimit: exchange.rateLimit,
        has: exchange.has,
        markets: Object.keys(exchange.markets).length,
      };
    } catch (error) {
      console.error(`Failed to get exchange info for ${exchangeName}:`, error);
      return null;
    }
  }

  /**
   * Get real-time price
   */
  async getRealTimePrice(symbol: string, exchangeName: string = 'binance'): Promise<number | null> {
    try {
      const exchange = this.exchanges.get(exchangeName);
      if (!exchange) {
        throw new Error(`Exchange ${exchangeName} not available`);
      }

      const ticker = await exchange.fetchTicker(symbol);
      return ticker.last || null;
    } catch (error) {
      console.error(`Failed to get real-time price for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    await this.redis.quit();
  }
}

// Export singleton instance
export const dataService = new DataService();
