import { Trade } from '@/types/trade';

export type BrokerType = 'tradezero' | 'interactive_brokers' | 'td_ameritrade' | 'robinhood' | 'tradovate';

interface BrokerConfig {
  apiKey?: string;
  secretKey?: string;
  accountId?: string;
  sandbox?: boolean;
  username?: string;
  password?: string;
}

interface TradovateCredentials {
  accessToken: string;
  mdAccessToken: string;
  expirationTime: number;
}

export class BrokerIntegrationService {
  private config: BrokerConfig;
  private brokerType: BrokerType;
  private tradovateCredentials?: TradovateCredentials;

  constructor(brokerType: BrokerType, config: BrokerConfig) {
    this.brokerType = brokerType;
    this.config = config;
  }

  async connect(): Promise<boolean> {
    try {
      switch (this.brokerType) {
        case 'tradezero':
          return await this.connectTradeZero();
        case 'interactive_brokers':
          return await this.connectIB();
        case 'td_ameritrade':
          return await this.connectTDA();
        case 'robinhood':
          return await this.connectRobinhood();
        case 'tradovate':
          return await this.connectTradovate();
        default:
          throw new Error('Unsupported broker');
      }
    } catch (error) {
      console.error('Failed to connect to broker:', error);
      throw error;
    }
  }

  async importTrades(startDate: Date, endDate: Date): Promise<Trade[]> {
    try {
      switch (this.brokerType) {
        case 'tradezero':
          return await this.importTradeZeroTrades(startDate, endDate);
        case 'interactive_brokers':
          return await this.importIBTrades(startDate, endDate);
        case 'td_ameritrade':
          return await this.importTDATrades(startDate, endDate);
        case 'robinhood':
          return await this.importRobinhoodTrades(startDate, endDate);
        case 'tradovate':
          return await this.importTradovateTrades(startDate, endDate);
        default:
          throw new Error('Unsupported broker');
      }
    } catch (error) {
      console.error('Failed to import trades:', error);
      throw error;
    }
  }

  private async connectTradovate(): Promise<boolean> {
    try {
      const response = await fetch('https://live.tradovate.com/v1/auth/accessTokenRequest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: this.config.username,
          password: this.config.password,
          appId: this.config.apiKey,
          appVersion: '1.0',
          cid: this.config.secretKey,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to connect to Tradovate');
      }

      const data = await response.json();
      this.tradovateCredentials = {
        accessToken: data.accessToken,
        mdAccessToken: data.mdAccessToken,
        expirationTime: Date.now() + (data.expiresIn * 1000),
      };

      return true;
    } catch (error) {
      console.error('Tradovate connection error:', error);
      throw error;
    }
  }

  private async importTradovateTrades(startDate: Date, endDate: Date): Promise<Trade[]> {
    if (!this.tradovateCredentials || Date.now() >= this.tradovateCredentials.expirationTime) {
      await this.connectTradovate();
    }

    try {
      const response = await fetch('https://live.tradovate.com/v1/position/list', {
        headers: {
          'Authorization': `Bearer ${this.tradovateCredentials?.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch Tradovate trades');
      }

      const positions = await response.json();
      
      // Transform Tradovate positions into our Trade format
      const trades: Trade[] = positions.map((position: any) => ({
        id: position.id.toString(),
        symbol: position.symbol,
        date: new Date(position.timestamp),
        type: position.side === 'Buy' ? 'buy' : 'sell',
        side: position.side === 'Buy' ? 'long' : 'short',
        quantity: position.size,
        price: position.price,
        fees: position.commission || 0,
        pnl: position.realizedPnl || 0,
        broker: 'tradovate',
        commission: position.commission || 0,
        execution: {
          time: new Date(position.timestamp),
          venue: position.venue || 'TRADOVATE',
          orderId: position.orderId.toString(),
        },
      }));

      return trades.filter(trade => 
        trade.date >= startDate && trade.date <= endDate
      );
    } catch (error) {
      console.error('Failed to import Tradovate trades:', error);
      throw error;
    }
  }

  private async connectTradeZero(): Promise<boolean> {
    // Implement TradeZero connection logic
    return true;
  }

  private async connectIB(): Promise<boolean> {
    // Implement Interactive Brokers connection logic
    return true;
  }

  private async connectTDA(): Promise<boolean> {
    // Implement TD Ameritrade connection logic
    return true;
  }

  private async connectRobinhood(): Promise<boolean> {
    // Implement Robinhood connection logic
    return true;
  }

  private async importTradeZeroTrades(start: Date, end: Date): Promise<Trade[]> {
    // Implement TradeZero trade import logic
    return [];
  }

  private async importIBTrades(start: Date, end: Date): Promise<Trade[]> {
    // Implement Interactive Brokers trade import logic
    return [];
  }

  private async importTDATrades(start: Date, end: Date): Promise<Trade[]> {
    // Implement TD Ameritrade trade import logic
    return [];
  }

  private async importRobinhoodTrades(start: Date, end: Date): Promise<Trade[]> {
    // Implement Robinhood trade import logic
    return [];
  }
} 