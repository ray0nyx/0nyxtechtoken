import { restClient } from '@polygon.io/client-js';

export interface DataSource {
  id: string;
  name: string;
  type: 'market' | 'fundamental' | 'alternative' | 'sentiment';
  provider: string;
  cost: 'free' | 'premium' | 'enterprise';
  latency: 'real-time' | 'delayed' | 'end-of-day';
  coverage: string[];
}

export interface MarketData {
  symbol: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
  trades?: number;
}

export interface FundamentalData {
  symbol: string;
  timestamp: number;
  marketCap: number;
  pe: number;
  pb: number;
  ps: number;
  debtToEquity: number;
  roe: number;
  roa: number;
  revenue: number;
  netIncome: number;
  eps: number;
  dividend: number;
  dividendYield: number;
}

export interface AlternativeData {
  symbol: string;
  timestamp: number;
  sentiment: number;
  newsCount: number;
  socialMentions: number;
  analystRatings: {
    buy: number;
    hold: number;
    sell: number;
  };
  insiderTrading: number;
  institutionalOwnership: number;
}

export interface EconomicData {
  indicator: string;
  timestamp: number;
  value: number;
  previous: number;
  forecast: number;
  impact: 'low' | 'medium' | 'high';
}

export class EnhancedDataService {
  private static polygonClient = restClient(process.env.NEXT_PUBLIC_POLYGON_API_KEY);
  
  // Available data sources
  static readonly DATA_SOURCES: DataSource[] = [
    {
      id: 'polygon_stocks',
      name: 'Polygon Stocks',
      type: 'market',
      provider: 'Polygon.io',
      cost: 'premium',
      latency: 'real-time',
      coverage: ['US Stocks', 'Options', 'Forex', 'Crypto']
    },
    {
      id: 'polygon_fundamentals',
      name: 'Polygon Fundamentals',
      type: 'fundamental',
      provider: 'Polygon.io',
      cost: 'premium',
      latency: 'end-of-day',
      coverage: ['US Stocks']
    },
    {
      id: 'alpha_vantage',
      name: 'Alpha Vantage',
      type: 'market',
      provider: 'Alpha Vantage',
      cost: 'free',
      latency: 'delayed',
      coverage: ['US Stocks', 'Forex', 'Crypto']
    },
    {
      id: 'quandl',
      name: 'Quandl',
      type: 'alternative',
      provider: 'Nasdaq',
      cost: 'premium',
      latency: 'end-of-day',
      coverage: ['Economic Data', 'Alternative Data']
    },
    {
      id: 'finnhub',
      name: 'Finnhub',
      type: 'sentiment',
      provider: 'Finnhub',
      cost: 'free',
      latency: 'real-time',
      coverage: ['News', 'Sentiment', 'Social Media']
    }
  ];

  // Enhanced market data fetching with multiple sources
  static async fetchMarketData(
    symbols: string[],
    startDate: string,
    endDate: string,
    timeframe: string,
    sources: string[] = ['polygon_stocks']
  ): Promise<MarketData[]> {
    try {
      const dataPromises = symbols.map(async (symbol) => {
        const symbolDataPromises = sources.map(async (source) => {
          switch (source) {
            case 'polygon_stocks':
              return await this.fetchPolygonData(symbol, startDate, endDate, timeframe);
            case 'alpha_vantage':
              return await this.fetchAlphaVantageData(symbol, startDate, endDate, timeframe);
            default:
              return [];
          }
        });
        
        const symbolData = await Promise.all(symbolDataPromises);
        return symbolData.flat();
      });

      const allData = await Promise.all(dataPromises);
      return allData.flat();
    } catch (error) {
      console.error('Error fetching market data:', error);
      throw error;
    }
  }

  // Fetch fundamental data
  static async fetchFundamentalData(
    symbols: string[],
    startDate: string,
    endDate: string
  ): Promise<FundamentalData[]> {
    try {
      const dataPromises = symbols.map(async (symbol) => {
        const response = await this.polygonClient.reference.tickerDetails(symbol);
        
        if (response.results) {
          const details = response.results;
          return {
            symbol,
            timestamp: Date.now(),
            marketCap: details.market_cap || 0,
            pe: details.pe_ratio || 0,
            pb: details.price_to_book || 0,
            ps: details.price_to_sales || 0,
            debtToEquity: details.debt_to_equity || 0,
            roe: details.roe || 0,
            roa: details.roe || 0, // Using ROE as proxy for ROA
            revenue: details.revenue || 0,
            netIncome: details.net_income || 0,
            eps: details.earnings_per_share || 0,
            dividend: details.dividend_yield || 0,
            dividendYield: details.dividend_yield || 0
          };
        }
        
        return null;
      });

      const results = await Promise.all(dataPromises);
      return results.filter(data => data !== null) as FundamentalData[];
    } catch (error) {
      console.error('Error fetching fundamental data:', error);
      throw error;
    }
  }

  // Fetch alternative data (sentiment, news, social media)
  static async fetchAlternativeData(
    symbols: string[],
    startDate: string,
    endDate: string
  ): Promise<AlternativeData[]> {
    try {
      const dataPromises = symbols.map(async (symbol) => {
        // Fetch news sentiment
        const newsResponse = await this.polygonClient.reference.tickerNews(symbol, {
          limit: 100,
          published_utc: startDate
        });

        // Calculate sentiment score from news
        let sentiment = 0;
        let newsCount = 0;
        
        if (newsResponse.results) {
          newsCount = newsResponse.results.length;
          // Simple sentiment calculation (in real implementation, use NLP)
          sentiment = newsResponse.results.reduce((sum, article) => {
            // This is a simplified sentiment calculation
            const title = article.title.toLowerCase();
            const positiveWords = ['up', 'gain', 'rise', 'bull', 'positive', 'growth'];
            const negativeWords = ['down', 'fall', 'drop', 'bear', 'negative', 'decline'];
            
            let score = 0;
            positiveWords.forEach(word => {
              if (title.includes(word)) score += 1;
            });
            negativeWords.forEach(word => {
              if (title.includes(word)) score -= 1;
            });
            
            return sum + (score / Math.max(positiveWords.length + negativeWords.length, 1));
          }, 0) / newsCount;
        }

        return {
          symbol,
          timestamp: Date.now(),
          sentiment: Math.max(-1, Math.min(1, sentiment)),
          newsCount,
          socialMentions: Math.floor(Math.random() * 1000), // Mock data
          analystRatings: {
            buy: Math.floor(Math.random() * 10),
            hold: Math.floor(Math.random() * 5),
            sell: Math.floor(Math.random() * 3)
          },
          insiderTrading: Math.random() * 1000000,
          institutionalOwnership: Math.random() * 100
        };
      });

      return await Promise.all(dataPromises);
    } catch (error) {
      console.error('Error fetching alternative data:', error);
      throw error;
    }
  }

  // Fetch economic indicators
  static async fetchEconomicData(
    indicators: string[],
    startDate: string,
    endDate: string
  ): Promise<EconomicData[]> {
    try {
      // Mock economic data (in real implementation, integrate with economic data providers)
      const economicIndicators = [
        'GDP',
        'CPI',
        'Unemployment Rate',
        'Federal Funds Rate',
        '10-Year Treasury Yield',
        'Dollar Index',
        'Oil Price',
        'Gold Price'
      ];

      return economicIndicators.map(indicator => ({
        indicator,
        timestamp: Date.now(),
        value: Math.random() * 100,
        previous: Math.random() * 100,
        forecast: Math.random() * 100,
        impact: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as 'low' | 'medium' | 'high'
      }));
    } catch (error) {
      console.error('Error fetching economic data:', error);
      throw error;
    }
  }

  // Data quality and validation
  static validateDataQuality(data: any[]): {
    completeness: number;
    accuracy: number;
    timeliness: number;
    consistency: number;
    overall: number;
  } {
    if (data.length === 0) {
      return {
        completeness: 0,
        accuracy: 0,
        timeliness: 0,
        consistency: 0,
        overall: 0
      };
    }

    // Check for missing values
    const requiredFields = ['symbol', 'timestamp', 'open', 'high', 'low', 'close', 'volume'];
    const completeness = data.reduce((sum, record) => {
      const missingFields = requiredFields.filter(field => !record[field]);
      return sum + (1 - missingFields.length / requiredFields.length);
    }, 0) / data.length;

    // Check for data accuracy (price relationships)
    const accuracy = data.reduce((sum, record) => {
      const { open, high, low, close } = record;
      const isValid = high >= Math.max(open, close) && low <= Math.min(open, close);
      return sum + (isValid ? 1 : 0);
    }, 0) / data.length;

    // Check for data timeliness
    const now = Date.now();
    const timeliness = data.reduce((sum, record) => {
      const age = (now - record.timestamp) / (1000 * 60 * 60 * 24); // Age in days
      return sum + Math.max(0, 1 - age / 30); // Penalty for data older than 30 days
    }, 0) / data.length;

    // Check for consistency (price changes)
    const consistency = data.reduce((sum, record, index) => {
      if (index === 0) return sum + 1;
      const prevRecord = data[index - 1];
      const priceChange = Math.abs(record.close - prevRecord.close) / prevRecord.close;
      return sum + (priceChange < 0.5 ? 1 : 0); // Penalty for large price changes
    }, 0) / data.length;

    const overall = (completeness + accuracy + timeliness + consistency) / 4;

    return {
      completeness: Math.round(completeness * 100),
      accuracy: Math.round(accuracy * 100),
      timeliness: Math.round(timeliness * 100),
      consistency: Math.round(consistency * 100),
      overall: Math.round(overall * 100)
    };
  }

  // Data preprocessing and cleaning
  static preprocessData(data: MarketData[]): MarketData[] {
    return data
      .filter(record => {
        // Remove records with invalid prices
        const { open, high, low, close, volume } = record;
        return open > 0 && high > 0 && low > 0 && close > 0 && volume > 0;
      })
      .filter(record => {
        // Remove outliers
        const { open, high, low, close } = record;
        return high >= Math.max(open, close) && low <= Math.min(open, close);
      })
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  // Private helper methods
  private static async fetchPolygonData(
    symbol: string,
    startDate: string,
    endDate: string,
    timeframe: string
  ): Promise<MarketData[]> {
    try {
      const response = await this.polygonClient.stocks.aggregates(
        symbol,
        1,
        timeframe,
        startDate,
        endDate
      );

      if (!response.results) return [];

      return response.results.map(bar => ({
        symbol,
        timestamp: bar.t / 1000,
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v,
        vwap: bar.vw,
        trades: bar.n
      }));
    } catch (error) {
      console.error(`Error fetching Polygon data for ${symbol}:`, error);
      return [];
    }
  }

  private static async fetchAlphaVantageData(
    symbol: string,
    startDate: string,
    endDate: string,
    timeframe: string
  ): Promise<MarketData[]> {
    // Mock implementation for Alpha Vantage
    // In real implementation, integrate with Alpha Vantage API
    return [];
  }
}
