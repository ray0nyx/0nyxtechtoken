import { supabase } from '@/lib/supabase';

export interface MarketDataFeed {
  id: string;
  name: string;
  provider: 'Alpha Vantage' | 'IEX Cloud' | 'Yahoo Finance' | 'Polygon' | 'Quandl' | 'Custom';
  type: 'real-time' | 'delayed' | 'historical';
  symbols: string[];
  isActive: boolean;
  apiKey?: string;
  endpoint?: string;
  rateLimit: number;
  lastUpdate: string;
}

export interface RealTimeQuote {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume: number;
  timestamp: string;
  source: string;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  marketCap?: number;
  pe?: number;
  eps?: number;
  dividend?: number;
  yield?: number;
}

export interface AlternativeDataPoint {
  id: string;
  type: 'sentiment' | 'news' | 'satellite' | 'social' | 'economic' | 'weather' | 'satellite' | 'satellite';
  symbol: string;
  value: number;
  confidence: number;
  timestamp: string;
  source: string;
  metadata?: Record<string, any>;
}

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  summary: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  symbols: string[];
  publishedAt: string;
  source: string;
  url: string;
  impact: 'high' | 'medium' | 'low';
}

export interface EconomicIndicator {
  id: string;
  name: string;
  value: number;
  previousValue: number;
  forecast: number;
  unit: string;
  country: string;
  releaseDate: string;
  impact: 'high' | 'medium' | 'low';
  category: 'inflation' | 'employment' | 'gdp' | 'interest_rates' | 'trade' | 'other';
}

export class MarketDataService {
  private static wsConnections: Map<string, WebSocket> = new Map();
  private static subscriptions: Map<string, Set<string>> = new Map();

  // Initialize market data feeds
  static async initializeFeeds(): Promise<MarketDataFeed[]> {
    const feeds: MarketDataFeed[] = [
      {
        id: 'alpha_vantage',
        name: 'Alpha Vantage',
        provider: 'Alpha Vantage',
        type: 'real-time',
        symbols: ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN'],
        isActive: true,
        rateLimit: 5, // 5 calls per minute
        lastUpdate: new Date().toISOString()
      },
      {
        id: 'iex_cloud',
        name: 'IEX Cloud',
        provider: 'IEX Cloud',
        type: 'real-time',
        symbols: ['SPY', 'QQQ', 'IWM', 'VTI'],
        isActive: true,
        rateLimit: 100, // 100 calls per second
        lastUpdate: new Date().toISOString()
      },
      {
        id: 'yahoo_finance',
        name: 'Yahoo Finance',
        provider: 'Yahoo Finance',
        type: 'delayed',
        symbols: ['BTC-USD', 'ETH-USD', 'ADA-USD', 'SOL-USD'],
        isActive: true,
        rateLimit: 2000, // 2000 calls per hour
        lastUpdate: new Date().toISOString()
      }
    ];

    // Store feeds in database
    await this.storeFeeds(feeds);
    return feeds;
  }

  // Get real-time quote for a symbol
  static async getRealTimeQuote(symbol: string, source: string = 'alpha_vantage'): Promise<RealTimeQuote | null> {
    try {
      // Simulate real-time data fetch
      const mockQuote: RealTimeQuote = {
        symbol,
        price: Math.random() * 1000 + 100,
        bid: Math.random() * 1000 + 99,
        ask: Math.random() * 1000 + 101,
        volume: Math.floor(Math.random() * 1000000),
        timestamp: new Date().toISOString(),
        source,
        change: (Math.random() - 0.5) * 10,
        changePercent: (Math.random() - 0.5) * 5,
        high: Math.random() * 1000 + 105,
        low: Math.random() * 1000 + 95,
        open: Math.random() * 1000 + 100,
        previousClose: Math.random() * 1000 + 100,
        marketCap: Math.random() * 1000000000000,
        pe: Math.random() * 30 + 10,
        eps: Math.random() * 10 + 1,
        dividend: Math.random() * 5,
        yield: Math.random() * 3
      };

      // Store in database
      await this.storeQuote(mockQuote);
      
      return mockQuote;
    } catch (error) {
      console.error('Error fetching real-time quote:', error);
      return null;
    }
  }

  // Subscribe to real-time data stream
  static async subscribeToSymbol(symbol: string, callback: (quote: RealTimeQuote) => void): Promise<void> {
    // In a real implementation, this would establish WebSocket connections
    // For now, we'll simulate with intervals
    const interval = setInterval(async () => {
      const quote = await this.getRealTimeQuote(symbol);
      if (quote) {
        callback(quote);
      }
    }, 1000); // Update every second

    // Store subscription
    if (!this.subscriptions.has(symbol)) {
      this.subscriptions.set(symbol, new Set());
    }
    this.subscriptions.get(symbol)?.add(interval.toString());
  }

  // Unsubscribe from symbol
  static async unsubscribeFromSymbol(symbol: string): Promise<void> {
    const subscriptions = this.subscriptions.get(symbol);
    if (subscriptions) {
      subscriptions.forEach(intervalId => {
        clearInterval(parseInt(intervalId));
      });
      this.subscriptions.delete(symbol);
    }
  }

  // Get alternative data
  static async getAlternativeData(
    symbol: string,
    type: AlternativeDataPoint['type'],
    timeRange: string = '24h'
  ): Promise<AlternativeDataPoint[]> {
    try {
      // Simulate alternative data fetch
      const dataPoints: AlternativeDataPoint[] = [];
      const now = new Date();
      const hoursBack = timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 1;
      
      for (let i = 0; i < hoursBack; i++) {
        const timestamp = new Date(now.getTime() - (i * 60 * 60 * 1000));
        
        const dataPoint: AlternativeDataPoint = {
          id: `${type}_${symbol}_${timestamp.getTime()}`,
          type,
          symbol,
          value: Math.random() * 100,
          confidence: Math.random() * 0.5 + 0.5, // 0.5 to 1.0
          timestamp: timestamp.toISOString(),
          source: this.getSourceForType(type),
          metadata: {
            processed: true,
            quality: 'high'
          }
        };
        
        dataPoints.push(dataPoint);
      }
      
      // Store in database
      await this.storeAlternativeData(dataPoints);
      
      return dataPoints;
    } catch (error) {
      console.error('Error fetching alternative data:', error);
      return [];
    }
  }

  // Get news sentiment
  static async getNewsSentiment(symbol: string, timeRange: string = '24h'): Promise<NewsItem[]> {
    try {
      // Simulate news fetch
      const newsItems: NewsItem[] = [];
      const sentiments = ['positive', 'negative', 'neutral'];
      const sources = ['Reuters', 'Bloomberg', 'CNBC', 'Wall Street Journal', 'Financial Times'];
      
      for (let i = 0; i < 10; i++) {
        const sentiment = sentiments[Math.floor(Math.random() * sentiments.length)];
        const source = sources[Math.floor(Math.random() * sources.length)];
        
        const newsItem: NewsItem = {
          id: `news_${symbol}_${Date.now()}_${i}`,
          title: `${symbol} ${sentiment} news headline ${i + 1}`,
          content: `This is a ${sentiment} news article about ${symbol}...`,
          summary: `Summary of ${sentiment} news about ${symbol}`,
          sentiment: sentiment as 'positive' | 'negative' | 'neutral',
          confidence: Math.random() * 0.4 + 0.6, // 0.6 to 1.0
          symbols: [symbol],
          publishedAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
          source,
          url: `https://example.com/news/${symbol}/${i}`,
          impact: Math.random() > 0.7 ? 'high' : Math.random() > 0.4 ? 'medium' : 'low'
        };
        
        newsItems.push(newsItem);
      }
      
      // Store in database
      await this.storeNews(newsItems);
      
      return newsItems;
    } catch (error) {
      console.error('Error fetching news sentiment:', error);
      return [];
    }
  }

  // Get economic indicators
  static async getEconomicIndicators(country: string = 'US'): Promise<EconomicIndicator[]> {
    try {
      const indicators: EconomicIndicator[] = [
        {
          id: 'gdp_us',
          name: 'GDP Growth Rate',
          value: 2.1,
          previousValue: 1.9,
          forecast: 2.3,
          unit: '%',
          country: 'US',
          releaseDate: new Date().toISOString(),
          impact: 'high',
          category: 'gdp'
        },
        {
          id: 'inflation_us',
          name: 'Inflation Rate',
          value: 3.2,
          previousValue: 3.1,
          forecast: 3.0,
          unit: '%',
          country: 'US',
          releaseDate: new Date().toISOString(),
          impact: 'high',
          category: 'inflation'
        },
        {
          id: 'unemployment_us',
          name: 'Unemployment Rate',
          value: 3.8,
          previousValue: 3.9,
          forecast: 3.7,
          unit: '%',
          country: 'US',
          releaseDate: new Date().toISOString(),
          impact: 'medium',
          category: 'employment'
        },
        {
          id: 'fed_funds_rate',
          name: 'Federal Funds Rate',
          value: 5.25,
          previousValue: 5.0,
          forecast: 5.5,
          unit: '%',
          country: 'US',
          releaseDate: new Date().toISOString(),
          impact: 'high',
          category: 'interest_rates'
        }
      ];
      
      // Store in database
      await this.storeEconomicIndicators(indicators);
      
      return indicators;
    } catch (error) {
      console.error('Error fetching economic indicators:', error);
      return [];
    }
  }

  // Get market sentiment score
  static async getMarketSentiment(symbols: string[]): Promise<{
    overall: number;
    bySymbol: Record<string, number>;
    breakdown: {
      news: number;
      social: number;
      technical: number;
      fundamental: number;
    };
  }> {
    try {
      const sentimentScores: Record<string, number> = {};
      let totalSentiment = 0;
      
      for (const symbol of symbols) {
        // Get news sentiment
        const news = await this.getNewsSentiment(symbol, '24h');
        const newsSentiment = news.length > 0 ? 
          news.reduce((sum, item) => {
            const score = item.sentiment === 'positive' ? 1 : item.sentiment === 'negative' ? -1 : 0;
            return sum + (score * item.confidence);
          }, 0) / news.length : 0;
        
        // Get social sentiment (simulated)
        const socialSentiment = (Math.random() - 0.5) * 2; // -1 to 1
        
        // Get technical sentiment (simulated)
        const technicalSentiment = (Math.random() - 0.5) * 2; // -1 to 1
        
        // Get fundamental sentiment (simulated)
        const fundamentalSentiment = (Math.random() - 0.5) * 2; // -1 to 1
        
        // Weighted average
        const symbolSentiment = (
          newsSentiment * 0.4 +
          socialSentiment * 0.2 +
          technicalSentiment * 0.2 +
          fundamentalSentiment * 0.2
        );
        
        sentimentScores[symbol] = symbolSentiment;
        totalSentiment += symbolSentiment;
      }
      
      const overallSentiment = totalSentiment / symbols.length;
      
      return {
        overall: overallSentiment,
        bySymbol: sentimentScores,
        breakdown: {
          news: overallSentiment * 0.4,
          social: overallSentiment * 0.2,
          technical: overallSentiment * 0.2,
          fundamental: overallSentiment * 0.2
        }
      };
    } catch (error) {
      console.error('Error calculating market sentiment:', error);
      return {
        overall: 0,
        bySymbol: {},
        breakdown: { news: 0, social: 0, technical: 0, fundamental: 0 }
      };
    }
  }

  // Store data in database
  private static async storeFeeds(feeds: MarketDataFeed[]): Promise<void> {
    // Implementation would store feeds in database
    console.log('Storing market data feeds:', feeds.length);
  }

  private static async storeQuote(quote: RealTimeQuote): Promise<void> {
    // Implementation would store quote in database
    console.log('Storing quote for', quote.symbol);
  }

  private static async storeAlternativeData(data: AlternativeDataPoint[]): Promise<void> {
    // Implementation would store alternative data in database
    console.log('Storing alternative data:', data.length, 'points');
  }

  private static async storeNews(news: NewsItem[]): Promise<void> {
    // Implementation would store news in database
    console.log('Storing news items:', news.length);
  }

  private static async storeEconomicIndicators(indicators: EconomicIndicator[]): Promise<void> {
    // Implementation would store economic indicators in database
    console.log('Storing economic indicators:', indicators.length);
  }

  private static getSourceForType(type: AlternativeDataPoint['type']): string {
    const sources = {
      sentiment: 'Twitter API',
      news: 'News API',
      satellite: 'Satellite Data Provider',
      social: 'Social Media APIs',
      economic: 'Economic Data Provider',
      weather: 'Weather API'
    };
    
    return sources[type] || 'Unknown';
  }

  // Get historical data
  static async getHistoricalData(
    symbol: string,
    timeframe: '1m' | '5m' | '15m' | '1h' | '1d',
    period: string = '30d'
  ): Promise<RealTimeQuote[]> {
    try {
      // Simulate historical data fetch
      const data: RealTimeQuote[] = [];
      const now = new Date();
      const periods = this.getPeriodsForTimeframe(timeframe, period);
      
      for (let i = 0; i < periods; i++) {
        const timestamp = new Date(now.getTime() - (i * this.getIntervalMs(timeframe)));
        
        data.push({
          symbol,
          price: Math.random() * 1000 + 100,
          bid: Math.random() * 1000 + 99,
          ask: Math.random() * 1000 + 101,
          volume: Math.floor(Math.random() * 1000000),
          timestamp: timestamp.toISOString(),
          source: 'historical',
          change: (Math.random() - 0.5) * 10,
          changePercent: (Math.random() - 0.5) * 5,
          high: Math.random() * 1000 + 105,
          low: Math.random() * 1000 + 95,
          open: Math.random() * 1000 + 100,
          previousClose: Math.random() * 1000 + 100
        });
      }
      
      return data.reverse(); // Return in chronological order
    } catch (error) {
      console.error('Error fetching historical data:', error);
      return [];
    }
  }

  private static getPeriodsForTimeframe(timeframe: string, period: string): number {
    const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : 1;
    const timeframeMinutes = {
      '1m': 1,
      '5m': 5,
      '15m': 15,
      '1h': 60,
      '1d': 1440
    };
    
    return (periodDays * 24 * 60) / timeframeMinutes[timeframe as keyof typeof timeframeMinutes];
  }

  private static getIntervalMs(timeframe: string): number {
    const timeframeMs = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };
    
    return timeframeMs[timeframe as keyof typeof timeframeMs];
  }
}
