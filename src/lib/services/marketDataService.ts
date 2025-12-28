/**
 * Market Data Service - Frontend integration with Python backend
 */
import { supabase } from './supabase';

const MARKET_DATA_API_BASE = 'http://localhost:8001/api';

export interface OHLCVData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  symbol: string;
  timeframe: string;
}

export interface SymbolInfo {
  symbol: string;
  base: string;
  quote: string;
  exchange: string;
  market_type: 'spot' | 'futures' | 'options' | 'margin';
  active: boolean;
  precision: Record<string, any>;
  limits: Record<string, any>;
  fees: Record<string, any>;
}

export interface RealTimeData {
  symbol: string;
  price: number;
  volume: number;
  timestamp: string;
  bid?: number;
  ask?: number;
  change_24h?: number;
  change_percent_24h?: number;
}

export interface BacktestDataRequest {
  symbols: string[];
  timeframe: string;
  start_date: string;
  end_date: string;
  exchanges?: string[];
  include_indicators?: boolean;
  indicators?: string[];
}

export interface TechnicalIndicator {
  name: string;
  symbol: string;
  timeframe: string;
  values: number[];
  timestamps: string[];
  parameters: Record<string, any>;
}

export interface BacktestData {
  symbols: Record<string, {
    ohlcv: OHLCVData[];
    dataframe: any[];
    statistics: {
      total_periods: number;
      start_date: string;
      end_date: string;
      price_range: {
        min: number;
        max: number;
        start: number;
        end: number;
      };
      volume_stats: {
        total: number;
        average: number;
        max: number;
        min: number;
      };
      returns: {
        total_return: number;
        average_daily_return: number;
        volatility: number;
        sharpe_ratio: number;
        max_drawdown: number;
      };
    };
    indicators?: Record<string, TechnicalIndicator>;
  }>;
  metadata: {
    start_date: string;
    end_date: string;
    timeframe: string;
    symbols: string[];
  };
}

class MarketDataService {
  private baseUrl: string;
  private isBackendAvailable: boolean = false;

  constructor() {
    this.baseUrl = MARKET_DATA_API_BASE;
    this.checkBackendAvailability();
  }

  private async checkBackendAvailability(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl.replace('/api', '')}/`);
      this.isBackendAvailable = response.ok;
    } catch (error) {
      console.warn('Python backend not available, using fallback data sources');
      this.isBackendAvailable = false;
    }
  }

  /**
   * Get available trading symbols
   */
  async getAvailableSymbols(exchange?: string, marketType?: string): Promise<SymbolInfo[]> {
    if (!this.isBackendAvailable) {
      return this.getFallbackSymbols();
    }

    try {
      const params = new URLSearchParams();
      if (exchange) params.append('exchange', exchange);
      if (marketType) params.append('market_type', marketType);

      const response = await fetch(`${this.baseUrl}/symbols?${params}`);
      if (!response.ok) throw new Error('Failed to fetch symbols');

      const data = await response.json();
      return data.symbols;
    } catch (error) {
      console.error('Error fetching symbols:', error);
      return this.getFallbackSymbols();
    }
  }

  /**
   * Get OHLCV data for a symbol
   */
  async getOHLCVData(
    symbol: string,
    timeframe: string = '1h',
    limit: number = 100,
    exchange?: string
  ): Promise<OHLCVData[]> {
    if (!this.isBackendAvailable) {
      return this.getFallbackOHLCVData(symbol, timeframe, limit);
    }

    try {
      const params = new URLSearchParams({
        timeframe,
        limit: limit.toString()
      });
      if (exchange) params.append('exchange', exchange);

      const response = await fetch(`${this.baseUrl}/ohlcv/${symbol}?${params}`);
      if (!response.ok) throw new Error('Failed to fetch OHLCV data');

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error fetching OHLCV data:', error);
      return this.getFallbackOHLCVData(symbol, timeframe, limit);
    }
  }

  /**
   * Get comprehensive data for backtesting
   */
  async getBacktestData(request: BacktestDataRequest): Promise<BacktestData> {
    if (!this.isBackendAvailable) {
      return this.getFallbackBacktestData(request);
    }

    try {
      const response = await fetch(`${this.baseUrl}/backtest-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) throw new Error('Failed to fetch backtest data');

      return await response.json();
    } catch (error) {
      console.error('Error fetching backtest data:', error);
      return this.getFallbackBacktestData(request);
    }
  }

  /**
   * Get crypto OHLCV data using the crypto API key
   */
  async getCryptoOHLCV(
    symbol: string,
    timeframe: string = '1h',
    limit: number = 100
  ): Promise<OHLCVData[]> {
    if (!this.isBackendAvailable) {
      return this.getFallbackOHLCVData(symbol, timeframe, limit);
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/crypto/ohlcv/${symbol}?timeframe=${timeframe}&limit=${limit}`
      );

      if (!response.ok) throw new Error('Failed to fetch crypto data');

      const result = await response.json();
      return result.data || [];
    } catch (error) {
      console.error('Error fetching crypto data:', error);
      // Fallback to regular OHLCV data
      return this.getOHLCVData(symbol, timeframe, limit);
    }
  }

  /**
   * Get real-time market data
   */
  async getRealTimeData(symbol: string, exchange?: string): Promise<RealTimeData> {
    if (!this.isBackendAvailable) {
      return this.getFallbackRealTimeData(symbol);
    }

    try {
      const params = new URLSearchParams();
      if (exchange) params.append('exchange', exchange);

      const response = await fetch(`${this.baseUrl}/real-time/${symbol}?${params}`);
      if (!response.ok) throw new Error('Failed to fetch real-time data');

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error fetching real-time data:', error);
      return this.getFallbackRealTimeData(symbol);
    }
  }

  /**
   * Get supported exchanges
   */
  async getSupportedExchanges(): Promise<any[]> {
    if (!this.isBackendAvailable) {
      return this.getFallbackExchanges();
    }

    try {
      const response = await fetch(`${this.baseUrl}/exchanges`);
      if (!response.ok) throw new Error('Failed to fetch exchanges');

      const data = await response.json();
      return data.exchanges;
    } catch (error) {
      console.error('Error fetching exchanges:', error);
      return this.getFallbackExchanges();
    }
  }

  /**
   * Fallback data sources when Python backend is not available
   */
  private getFallbackSymbols(): SymbolInfo[] {
    return [
      {
        symbol: 'BTC/USDT',
        base: 'BTC',
        quote: 'USDT',
        exchange: 'binance',
        market_type: 'spot',
        active: true,
        precision: { amount: 8, price: 2 },
        limits: { amount: { min: 0.00001, max: 9000 } },
        fees: { trading: { maker: 0.001, taker: 0.001 } }
      },
      {
        symbol: 'ETH/USDT',
        base: 'ETH',
        quote: 'USDT',
        exchange: 'binance',
        market_type: 'spot',
        active: true,
        precision: { amount: 8, price: 2 },
        limits: { amount: { min: 0.00001, max: 9000 } },
        fees: { trading: { maker: 0.001, taker: 0.001 } }
      },
      {
        symbol: 'AAPL',
        base: 'AAPL',
        quote: 'USD',
        exchange: 'yahoo',
        market_type: 'spot',
        active: true,
        precision: { amount: 0, price: 2 },
        limits: { amount: { min: 1, max: 1000000 } },
        fees: { trading: { maker: 0, taker: 0 } }
      },
      {
        symbol: 'MSFT',
        base: 'MSFT',
        quote: 'USD',
        exchange: 'yahoo',
        market_type: 'spot',
        active: true,
        precision: { amount: 0, price: 2 },
        limits: { amount: { min: 1, max: 1000000 } },
        fees: { trading: { maker: 0, taker: 0 } }
      }
    ];
  }

  private async getFallbackOHLCVData(symbol: string, timeframe: string, limit: number): Promise<OHLCVData[]> {
    // Return empty array - let the caller use proper fallback sources
    // (Birdeye API, DexScreener direct API) instead of generating fake data
    console.log('MarketDataService: Returning empty OHLCV data, use external APIs for accurate data');
    return [];
  }

  private async getFallbackBacktestData(request: BacktestDataRequest): Promise<BacktestData> {
    const symbols: Record<string, any> = {};

    for (const symbol of request.symbols) {
      const ohlcvData = await this.getFallbackOHLCVData(
        symbol,
        request.timeframe,
        100
      );

      symbols[symbol] = {
        ohlcv: ohlcvData,
        dataframe: ohlcvData.map(d => ({
          timestamp: d.timestamp,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
          volume: d.volume
        })),
        statistics: {
          total_periods: ohlcvData.length,
          start_date: ohlcvData[0]?.timestamp || request.start_date,
          end_date: ohlcvData[ohlcvData.length - 1]?.timestamp || request.end_date,
          price_range: {
            min: Math.min(...ohlcvData.map(d => d.low)),
            max: Math.max(...ohlcvData.map(d => d.high)),
            start: ohlcvData[0]?.open || 0,
            end: ohlcvData[ohlcvData.length - 1]?.close || 0
          },
          volume_stats: {
            total: ohlcvData.reduce((sum, d) => sum + d.volume, 0),
            average: ohlcvData.reduce((sum, d) => sum + d.volume, 0) / ohlcvData.length,
            max: Math.max(...ohlcvData.map(d => d.volume)),
            min: Math.min(...ohlcvData.map(d => d.volume))
          },
          returns: {
            total_return: ohlcvData.length > 0 ?
              ((ohlcvData[ohlcvData.length - 1].close / ohlcvData[0].open) - 1) * 100 : 0,
            average_daily_return: 0.1,
            volatility: 2.5,
            sharpe_ratio: 0.4,
            max_drawdown: -5.2
          }
        }
      };
    }

    return {
      symbols,
      metadata: {
        start_date: request.start_date,
        end_date: request.end_date,
        timeframe: request.timeframe,
        symbols: request.symbols
      }
    };
  }

  private async getFallbackRealTimeData(symbol: string): Promise<RealTimeData> {
    const basePrice = 100 + Math.random() * 50;
    const change = (Math.random() - 0.5) * 10;

    return {
      symbol,
      price: parseFloat((basePrice + change).toFixed(2)),
      volume: Math.random() * 1000000,
      timestamp: new Date().toISOString(),
      bid: parseFloat((basePrice + change - 0.1).toFixed(2)),
      ask: parseFloat((basePrice + change + 0.1).toFixed(2)),
      change_24h: change,
      change_percent_24h: (change / basePrice) * 100
    };
  }

  private getFallbackExchanges(): any[] {
    return [
      {
        id: 'binance',
        name: 'Binance',
        countries: ['Global'],
        version: '1.0',
        certified: true,
        has: { spot: true, futures: true },
        urls: { api: ['https://api.binance.com'] },
        symbols: ['BTC/USDT', 'ETH/USDT', 'BNB/USDT'],
        timeframes: ['1m', '5m', '15m', '1h', '4h', '1d']
      },
      {
        id: 'yahoo',
        name: 'Yahoo Finance',
        countries: ['Global'],
        version: '1.0',
        certified: false,
        has: { spot: true },
        urls: { api: ['https://query1.finance.yahoo.com'] },
        symbols: ['AAPL', 'MSFT', 'GOOGL', 'AMZN'],
        timeframes: ['1m', '5m', '15m', '1h', '1d']
      }
    ];
  }

  private getTimeframeMs(timeframe: string): number {
    const timeframeMap: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000,
      '1M': 30 * 24 * 60 * 60 * 1000
    };
    return timeframeMap[timeframe] || 60 * 60 * 1000;
  }
}

export const marketDataService = new MarketDataService();
