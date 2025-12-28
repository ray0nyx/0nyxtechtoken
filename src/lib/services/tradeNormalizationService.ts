import { NormalizedTrade, ExchangeTradeData } from '@/types/tradeSync';

export class TradeNormalizationService {
  private static instance: TradeNormalizationService;

  static getInstance(): TradeNormalizationService {
    if (!TradeNormalizationService.instance) {
      TradeNormalizationService.instance = new TradeNormalizationService();
    }
    return TradeNormalizationService.instance;
  }

  /**
   * Normalize trade data from any exchange to unified format
   */
  normalizeTrade(
    exchange: string, 
    rawTrade: any, 
    userId: string, 
    connectionId: string
  ): NormalizedTrade {
    const normalizers = {
      'binance': this.normalizeBinanceTrade,
      'coinbase': this.normalizeCoinbaseTrade,
      'kraken': this.normalizeKrakenTrade,
      'kucoin': this.normalizeKuCoinTrade,
      'bybit': this.normalizeBybitTrade,
      'okx': this.normalizeOKXTrade,
      'bitget': this.normalizeBitgetTrade,
      'huobi': this.normalizeHuobiTrade,
      'gateio': this.normalizeGateIOTrade,
      'mexc': this.normalizeMEXCTrade,
    };

    const normalizer = normalizers[exchange as keyof typeof normalizers];
    if (!normalizer) {
      throw new Error(`No normalizer found for exchange: ${exchange}`);
    }

    return normalizer(rawTrade, userId, connectionId);
  }

  /**
   * Binance trade normalizer
   */
  private normalizeBinanceTrade(rawTrade: any, userId: string, connectionId: string): NormalizedTrade {
    return {
      id: rawTrade.id || rawTrade.orderId || rawTrade.tradeId,
      userId,
      connectionId,
      exchangeTradeId: rawTrade.id || rawTrade.orderId || rawTrade.tradeId,
      symbol: rawTrade.symbol,
      side: rawTrade.side === 'BUY' ? 'buy' : 'sell',
      quantity: parseFloat(rawTrade.qty || rawTrade.origQty || rawTrade.executedQty),
      price: parseFloat(rawTrade.price || rawTrade.avgPrice),
      fee: parseFloat(rawTrade.commission || 0),
      feeCurrency: rawTrade.commissionAsset || 'USDT',
      executedAt: new Date(rawTrade.time || rawTrade.timestamp),
      exchangeTimestamp: new Date(rawTrade.time || rawTrade.timestamp),
      platform: 'binance',
      orderId: rawTrade.orderId || rawTrade.orderListId,
      positionId: rawTrade.positionId,
      rawData: rawTrade
    };
  }

  /**
   * Coinbase Pro trade normalizer
   */
  private normalizeCoinbaseTrade(rawTrade: any, userId: string, connectionId: string): NormalizedTrade {
    return {
      id: rawTrade.trade_id || rawTrade.id,
      userId,
      connectionId,
      exchangeTradeId: rawTrade.trade_id || rawTrade.id,
      symbol: rawTrade.product_id,
      side: rawTrade.side === 'buy' ? 'buy' : 'sell',
      quantity: parseFloat(rawTrade.size),
      price: parseFloat(rawTrade.price),
      fee: parseFloat(rawTrade.fee || 0),
      feeCurrency: rawTrade.fee_currency || 'USD',
      executedAt: new Date(rawTrade.time),
      exchangeTimestamp: new Date(rawTrade.time),
      platform: 'coinbase',
      orderId: rawTrade.order_id,
      positionId: rawTrade.position_id,
      rawData: rawTrade
    };
  }

  /**
   * Kraken trade normalizer
   */
  private normalizeKrakenTrade(rawTrade: any, userId: string, connectionId: string): NormalizedTrade {
    return {
      id: rawTrade.txid || rawTrade.id,
      userId,
      connectionId,
      exchangeTradeId: rawTrade.txid || rawTrade.id,
      symbol: rawTrade.pair,
      side: rawTrade.type === 'buy' ? 'buy' : 'sell',
      quantity: parseFloat(rawTrade.vol),
      price: parseFloat(rawTrade.price),
      fee: parseFloat(rawTrade.fee || 0),
      feeCurrency: rawTrade.fee_currency || 'ZUSD',
      executedAt: new Date(parseFloat(rawTrade.time) * 1000),
      exchangeTimestamp: new Date(parseFloat(rawTrade.time) * 1000),
      platform: 'kraken',
      orderId: rawTrade.ordertxid,
      positionId: rawTrade.position_id,
      rawData: rawTrade
    };
  }

  /**
   * KuCoin trade normalizer
   */
  private normalizeKuCoinTrade(rawTrade: any, userId: string, connectionId: string): NormalizedTrade {
    return {
      id: rawTrade.tradeId || rawTrade.id,
      userId,
      connectionId,
      exchangeTradeId: rawTrade.tradeId || rawTrade.id,
      symbol: rawTrade.symbol,
      side: rawTrade.side === 'buy' ? 'buy' : 'sell',
      quantity: parseFloat(rawTrade.size),
      price: parseFloat(rawTrade.price),
      fee: parseFloat(rawTrade.fee || 0),
      feeCurrency: rawTrade.feeCurrency || 'USDT',
      executedAt: new Date(rawTrade.tradeCreatedAt || rawTrade.createdAt),
      exchangeTimestamp: new Date(rawTrade.tradeCreatedAt || rawTrade.createdAt),
      platform: 'kucoin',
      orderId: rawTrade.orderId,
      positionId: rawTrade.positionId,
      rawData: rawTrade
    };
  }

  /**
   * Bybit trade normalizer
   */
  private normalizeBybitTrade(rawTrade: any, userId: string, connectionId: string): NormalizedTrade {
    return {
      id: rawTrade.execId || rawTrade.id,
      userId,
      connectionId,
      exchangeTradeId: rawTrade.execId || rawTrade.id,
      symbol: rawTrade.symbol,
      side: rawTrade.side === 'Buy' ? 'buy' : 'sell',
      quantity: parseFloat(rawTrade.execQty),
      price: parseFloat(rawTrade.execPrice),
      fee: parseFloat(rawTrade.execFee || 0),
      feeCurrency: rawTrade.execFeeCurrency || 'USDT',
      executedAt: new Date(parseInt(rawTrade.execTime)),
      exchangeTimestamp: new Date(parseInt(rawTrade.execTime)),
      platform: 'bybit',
      orderId: rawTrade.orderId,
      positionId: rawTrade.positionId,
      rawData: rawTrade
    };
  }

  /**
   * OKX trade normalizer
   */
  private normalizeOKXTrade(rawTrade: any, userId: string, connectionId: string): NormalizedTrade {
    return {
      id: rawTrade.tradeId || rawTrade.id,
      userId,
      connectionId,
      exchangeTradeId: rawTrade.tradeId || rawTrade.id,
      symbol: rawTrade.instId,
      side: rawTrade.side === 'buy' ? 'buy' : 'sell',
      quantity: parseFloat(rawTrade.sz),
      price: parseFloat(rawTrade.px),
      fee: parseFloat(rawTrade.fee || 0),
      feeCurrency: rawTrade.feeCcy || 'USDT',
      executedAt: new Date(rawTrade.ts),
      exchangeTimestamp: new Date(rawTrade.ts),
      platform: 'okx',
      orderId: rawTrade.ordId,
      positionId: rawTrade.posId,
      rawData: rawTrade
    };
  }

  /**
   * Bitget trade normalizer
   */
  private normalizeBitgetTrade(rawTrade: any, userId: string, connectionId: string): NormalizedTrade {
    return {
      id: rawTrade.tradeId || rawTrade.id,
      userId,
      connectionId,
      exchangeTradeId: rawTrade.tradeId || rawTrade.id,
      symbol: rawTrade.symbol,
      side: rawTrade.side === 'buy' ? 'buy' : 'sell',
      quantity: parseFloat(rawTrade.size),
      price: parseFloat(rawTrade.price),
      fee: parseFloat(rawTrade.fee || 0),
      feeCurrency: rawTrade.feeCurrency || 'USDT',
      executedAt: new Date(rawTrade.timestamp),
      exchangeTimestamp: new Date(rawTrade.timestamp),
      platform: 'bitget',
      orderId: rawTrade.orderId,
      positionId: rawTrade.positionId,
      rawData: rawTrade
    };
  }

  /**
   * Huobi trade normalizer
   */
  private normalizeHuobiTrade(rawTrade: any, userId: string, connectionId: string): NormalizedTrade {
    return {
      id: rawTrade.tradeId || rawTrade.id,
      userId,
      connectionId,
      exchangeTradeId: rawTrade.tradeId || rawTrade.id,
      symbol: rawTrade.symbol,
      side: rawTrade.direction === 'buy' ? 'buy' : 'sell',
      quantity: parseFloat(rawTrade.amount),
      price: parseFloat(rawTrade.price),
      fee: parseFloat(rawTrade.fee || 0),
      feeCurrency: rawTrade.feeCurrency || 'USDT',
      executedAt: new Date(rawTrade.timestamp),
      exchangeTimestamp: new Date(rawTrade.timestamp),
      platform: 'huobi',
      orderId: rawTrade.orderId,
      positionId: rawTrade.positionId,
      rawData: rawTrade
    };
  }

  /**
   * Gate.io trade normalizer
   */
  private normalizeGateIOTrade(rawTrade: any, userId: string, connectionId: string): NormalizedTrade {
    return {
      id: rawTrade.id,
      userId,
      connectionId,
      exchangeTradeId: rawTrade.id,
      symbol: rawTrade.currency_pair,
      side: rawTrade.side === 'buy' ? 'buy' : 'sell',
      quantity: parseFloat(rawTrade.amount),
      price: parseFloat(rawTrade.price),
      fee: parseFloat(rawTrade.fee || 0),
      feeCurrency: rawTrade.feeCurrency || 'USDT',
      executedAt: new Date(rawTrade.create_time),
      exchangeTimestamp: new Date(rawTrade.create_time),
      platform: 'gateio',
      orderId: rawTrade.orderId,
      positionId: rawTrade.positionId,
      rawData: rawTrade
    };
  }

  /**
   * MEXC trade normalizer
   */
  private normalizeMEXCTrade(rawTrade: any, userId: string, connectionId: string): NormalizedTrade {
    return {
      id: rawTrade.id,
      userId,
      connectionId,
      exchangeTradeId: rawTrade.id,
      symbol: rawTrade.symbol,
      side: rawTrade.side === 'BUY' ? 'buy' : 'sell',
      quantity: parseFloat(rawTrade.quantity),
      price: parseFloat(rawTrade.price),
      fee: parseFloat(rawTrade.fee || 0),
      feeCurrency: rawTrade.feeCurrency || 'USDT',
      executedAt: new Date(rawTrade.timestamp),
      exchangeTimestamp: new Date(rawTrade.timestamp),
      platform: 'mexc',
      orderId: rawTrade.orderId,
      positionId: rawTrade.positionId,
      rawData: rawTrade
    };
  }

  /**
   * Validate normalized trade data
   */
  validateNormalizedTrade(trade: NormalizedTrade): boolean {
    const requiredFields = [
      'id', 'userId', 'connectionId', 'exchangeTradeId', 
      'symbol', 'side', 'quantity', 'price', 'executedAt'
    ];

    for (const field of requiredFields) {
      if (!trade[field as keyof NormalizedTrade]) {
        console.error(`Missing required field: ${field}`, trade);
        return false;
      }
    }

    if (trade.quantity <= 0) {
      console.error('Invalid quantity:', trade.quantity);
      return false;
    }

    if (trade.price <= 0) {
      console.error('Invalid price:', trade.price);
      return false;
    }

    if (!['buy', 'sell'].includes(trade.side)) {
      console.error('Invalid side:', trade.side);
      return false;
    }

    return true;
  }

  /**
   * Convert normalized trade to database format
   */
  toDatabaseFormat(trade: NormalizedTrade): any {
    return {
      user_id: trade.userId,
      connection_id: trade.connectionId,
      exchange_trade_id: trade.exchangeTradeId,
      symbol: trade.symbol,
      side: trade.side,
      quantity: trade.quantity,
      price: trade.price,
      fee: trade.fee,
      fee_currency: trade.feeCurrency,
      executed_at: trade.executedAt,
      exchange_timestamp: trade.exchangeTimestamp,
      platform: trade.platform,
      order_id: trade.orderId,
      position_id: trade.positionId,
      broker: trade.platform,
      timestamp: trade.executedAt,
      pnl: null, // Will be calculated later
      notes: `Synced from ${trade.platform}`,
      raw_data: trade.rawData
    };
  }
}

export const tradeNormalizationService = TradeNormalizationService.getInstance();
