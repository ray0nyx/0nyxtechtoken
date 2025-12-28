/**
 * Crypto Exchange Sync Service
 * Implements broker sync for major cryptocurrency exchanges
 * Supports: Binance, Coinbase, Kraken, KuCoin, Bybit, OKX, Bitget, Huobi, Gate.io, MEXC
 */

import { createClient } from '@/lib/supabase/client';

// Types
export interface ExchangeCredentials {
  apiKey: string;
  apiSecret: string;
  passphrase?: string; // Required for some exchanges like Coinbase, KuCoin
  subaccount?: string; // Optional for exchanges with subaccounts
}

export interface ExchangeTrade {
  id: string;
  exchange: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  price: number;
  quantity: number;
  quoteQuantity: number;
  fee: number;
  feeCurrency: string;
  timestamp: Date;
  orderId: string;
  isMaker: boolean;
}

export interface ExchangeBalance {
  currency: string;
  available: number;
  locked: number;
  total: number;
}

export interface ExchangeConnection {
  id: string;
  userId: string;
  exchangeName: string;
  status: 'active' | 'disconnected' | 'error';
  lastSyncAt: Date | null;
  createdAt: Date;
}

// Exchange API endpoints
const EXCHANGE_ENDPOINTS = {
  binance: {
    baseUrl: 'https://api.binance.com',
    trades: '/api/v3/myTrades',
    account: '/api/v3/account',
    time: '/api/v3/time'
  },
  coinbase: {
    baseUrl: 'https://api.coinbase.com',
    trades: '/api/v3/brokerage/orders/historical/fills',
    accounts: '/api/v3/brokerage/accounts'
  },
  kraken: {
    baseUrl: 'https://api.kraken.com',
    trades: '/0/private/TradesHistory',
    balance: '/0/private/Balance'
  },
  kucoin: {
    baseUrl: 'https://api.kucoin.com',
    trades: '/api/v1/fills',
    accounts: '/api/v1/accounts'
  },
  bybit: {
    baseUrl: 'https://api.bybit.com',
    trades: '/v5/execution/list',
    wallet: '/v5/account/wallet-balance'
  },
  okx: {
    baseUrl: 'https://www.okx.com',
    trades: '/api/v5/trade/fills-history',
    balance: '/api/v5/account/balance'
  },
  bitget: {
    baseUrl: 'https://api.bitget.com',
    trades: '/api/mix/v1/order/fills',
    account: '/api/mix/v1/account/accounts'
  },
  huobi: {
    baseUrl: 'https://api.huobi.pro',
    trades: '/v1/order/matchresults',
    accounts: '/v1/account/accounts'
  },
  gateio: {
    baseUrl: 'https://api.gateio.ws',
    trades: '/api/v4/spot/my_trades',
    accounts: '/api/v4/spot/accounts'
  },
  mexc: {
    baseUrl: 'https://api.mexc.com',
    trades: '/api/v3/myTrades',
    account: '/api/v3/account'
  }
};

class CryptoExchangeService {
  private static instance: CryptoExchangeService;
  private supabase = createClient();

  private constructor() {}

  static getInstance(): CryptoExchangeService {
    if (!CryptoExchangeService.instance) {
      CryptoExchangeService.instance = new CryptoExchangeService();
    }
    return CryptoExchangeService.instance;
  }

  /**
   * Connect to an exchange with API credentials
   */
  async connectExchange(
    exchangeName: string,
    credentials: ExchangeCredentials,
    userId: string
  ): Promise<ExchangeConnection> {
    try {
      // Validate credentials by making a test API call
      const isValid = await this.validateCredentials(exchangeName, credentials);
      
      if (!isValid) {
        throw new Error('Invalid API credentials');
      }

      // Store encrypted credentials in database
      const { data, error } = await this.supabase
        .from('user_exchange_connections')
        .upsert({
          user_id: userId,
          exchange_name: exchangeName,
          api_key_encrypted: await this.encryptCredentials(credentials.apiKey),
          api_secret_encrypted: await this.encryptCredentials(credentials.apiSecret),
          passphrase_encrypted: credentials.passphrase 
            ? await this.encryptCredentials(credentials.passphrase) 
            : null,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,exchange_name'
        })
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        userId: data.user_id,
        exchangeName: data.exchange_name,
        status: data.status,
        lastSyncAt: data.last_sync_at ? new Date(data.last_sync_at) : null,
        createdAt: new Date(data.created_at)
      };
    } catch (error) {
      console.error('Error connecting exchange:', error);
      throw error;
    }
  }

  /**
   * Disconnect from an exchange
   */
  async disconnectExchange(connectionId: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('user_exchange_connections')
      .update({ 
        status: 'disconnected',
        api_key_encrypted: null,
        api_secret_encrypted: null,
        passphrase_encrypted: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', connectionId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  /**
   * Sync trades from an exchange
   */
  async syncTrades(
    connectionId: string,
    userId: string,
    options?: { startTime?: Date; endTime?: Date; symbol?: string }
  ): Promise<ExchangeTrade[]> {
    try {
      // Get connection details
      const { data: connection, error: connError } = await this.supabase
        .from('user_exchange_connections')
        .select('*')
        .eq('id', connectionId)
        .eq('user_id', userId)
        .single();

      if (connError || !connection) {
        throw new Error('Exchange connection not found');
      }

      if (connection.status !== 'active') {
        throw new Error('Exchange connection is not active');
      }

      // Decrypt credentials
      const credentials: ExchangeCredentials = {
        apiKey: await this.decryptCredentials(connection.api_key_encrypted),
        apiSecret: await this.decryptCredentials(connection.api_secret_encrypted),
        passphrase: connection.passphrase_encrypted 
          ? await this.decryptCredentials(connection.passphrase_encrypted)
          : undefined
      };

      // Fetch trades from exchange
      const trades = await this.fetchTradesFromExchange(
        connection.exchange_name,
        credentials,
        options
      );

      // Normalize and store trades
      const normalizedTrades = trades.map(trade => this.normalizeTradeForDatabase(trade, userId, connectionId));

      // Upsert trades to database
      if (normalizedTrades.length > 0) {
        const { error: insertError } = await this.supabase
          .from('trades')
          .upsert(normalizedTrades, {
            onConflict: 'broker_trade_id'
          });

        if (insertError) {
          console.error('Error inserting trades:', insertError);
        }
      }

      // Update last sync time
      await this.supabase
        .from('user_exchange_connections')
        .update({ 
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', connectionId);

      return trades;
    } catch (error) {
      console.error('Error syncing trades:', error);
      
      // Update connection status to error
      await this.supabase
        .from('user_exchange_connections')
        .update({ 
          status: 'error',
          updated_at: new Date().toISOString()
        })
        .eq('id', connectionId);

      throw error;
    }
  }

  /**
   * Get all connected exchanges for a user
   */
  async getConnectedExchanges(userId: string): Promise<ExchangeConnection[]> {
    const { data, error } = await this.supabase
      .from('user_exchange_connections')
      .select('id, user_id, exchange_name, status, last_sync_at, created_at')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) throw error;

    return (data || []).map(conn => ({
      id: conn.id,
      userId: conn.user_id,
      exchangeName: conn.exchange_name,
      status: conn.status,
      lastSyncAt: conn.last_sync_at ? new Date(conn.last_sync_at) : null,
      createdAt: new Date(conn.created_at)
    }));
  }

  /**
   * Fetch trades from a specific exchange
   */
  private async fetchTradesFromExchange(
    exchangeName: string,
    credentials: ExchangeCredentials,
    options?: { startTime?: Date; endTime?: Date; symbol?: string }
  ): Promise<ExchangeTrade[]> {
    switch (exchangeName.toLowerCase()) {
      case 'binance':
        return this.fetchBinanceTrades(credentials, options);
      case 'coinbase':
        return this.fetchCoinbaseTrades(credentials, options);
      case 'kraken':
        return this.fetchKrakenTrades(credentials, options);
      case 'kucoin':
        return this.fetchKuCoinTrades(credentials, options);
      case 'bybit':
        return this.fetchBybitTrades(credentials, options);
      case 'okx':
        return this.fetchOKXTrades(credentials, options);
      case 'bitget':
        return this.fetchBitgetTrades(credentials, options);
      case 'huobi':
        return this.fetchHuobiTrades(credentials, options);
      case 'gateio':
        return this.fetchGateioTrades(credentials, options);
      case 'mexc':
        return this.fetchMEXCTrades(credentials, options);
      default:
        throw new Error(`Unsupported exchange: ${exchangeName}`);
    }
  }

  /**
   * Binance API implementation
   */
  private async fetchBinanceTrades(
    credentials: ExchangeCredentials,
    options?: { startTime?: Date; endTime?: Date; symbol?: string }
  ): Promise<ExchangeTrade[]> {
    const { baseUrl, trades: tradesEndpoint } = EXCHANGE_ENDPOINTS.binance;
    const timestamp = Date.now();
    
    const params: Record<string, string> = {
      timestamp: timestamp.toString(),
      recvWindow: '5000'
    };

    if (options?.symbol) params.symbol = options.symbol;
    if (options?.startTime) params.startTime = options.startTime.getTime().toString();
    if (options?.endTime) params.endTime = options.endTime.getTime().toString();

    const queryString = new URLSearchParams(params).toString();
    const signature = await this.createHmacSignature(queryString, credentials.apiSecret);
    
    const response = await fetch(
      `${baseUrl}${tradesEndpoint}?${queryString}&signature=${signature}`,
      {
        headers: {
          'X-MBX-APIKEY': credentials.apiKey
        }
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Binance API error: ${error.msg || response.statusText}`);
    }

    const data = await response.json();
    
    return data.map((trade: any) => ({
      id: trade.id.toString(),
      exchange: 'binance',
      symbol: trade.symbol,
      side: trade.isBuyer ? 'buy' : 'sell',
      type: 'market', // Binance myTrades doesn't include order type
      price: parseFloat(trade.price),
      quantity: parseFloat(trade.qty),
      quoteQuantity: parseFloat(trade.quoteQty),
      fee: parseFloat(trade.commission),
      feeCurrency: trade.commissionAsset,
      timestamp: new Date(trade.time),
      orderId: trade.orderId.toString(),
      isMaker: trade.isMaker
    }));
  }

  /**
   * Coinbase API implementation
   */
  private async fetchCoinbaseTrades(
    credentials: ExchangeCredentials,
    options?: { startTime?: Date; endTime?: Date; symbol?: string }
  ): Promise<ExchangeTrade[]> {
    const { baseUrl, trades: tradesEndpoint } = EXCHANGE_ENDPOINTS.coinbase;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const method = 'GET';
    
    const params = new URLSearchParams();
    if (options?.startTime) params.append('start_date', options.startTime.toISOString());
    if (options?.endTime) params.append('end_date', options.endTime.toISOString());
    if (options?.symbol) params.append('product_id', options.symbol);

    const path = `${tradesEndpoint}${params.toString() ? '?' + params.toString() : ''}`;
    const message = timestamp + method + path;
    const signature = await this.createHmacSignature(message, credentials.apiSecret);

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'CB-ACCESS-KEY': credentials.apiKey,
        'CB-ACCESS-SIGN': signature,
        'CB-ACCESS-TIMESTAMP': timestamp,
        'CB-ACCESS-PASSPHRASE': credentials.passphrase || '',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Coinbase API error: ${error.message || response.statusText}`);
    }

    const data = await response.json();
    
    return (data.fills || []).map((fill: any) => ({
      id: fill.entry_id,
      exchange: 'coinbase',
      symbol: fill.product_id,
      side: fill.side.toLowerCase(),
      type: fill.order_type?.toLowerCase() || 'market',
      price: parseFloat(fill.price),
      quantity: parseFloat(fill.size),
      quoteQuantity: parseFloat(fill.price) * parseFloat(fill.size),
      fee: parseFloat(fill.commission || '0'),
      feeCurrency: fill.product_id.split('-')[1],
      timestamp: new Date(fill.trade_time),
      orderId: fill.order_id,
      isMaker: fill.liquidity === 'M'
    }));
  }

  /**
   * Kraken API implementation
   */
  private async fetchKrakenTrades(
    credentials: ExchangeCredentials,
    options?: { startTime?: Date; endTime?: Date }
  ): Promise<ExchangeTrade[]> {
    const { baseUrl, trades: tradesEndpoint } = EXCHANGE_ENDPOINTS.kraken;
    const nonce = Date.now().toString();
    
    const params: Record<string, string> = { nonce };
    if (options?.startTime) params.start = Math.floor(options.startTime.getTime() / 1000).toString();
    if (options?.endTime) params.end = Math.floor(options.endTime.getTime() / 1000).toString();

    const postData = new URLSearchParams(params).toString();
    const signature = await this.createKrakenSignature(tradesEndpoint, postData, nonce, credentials.apiSecret);

    const response = await fetch(`${baseUrl}${tradesEndpoint}`, {
      method: 'POST',
      headers: {
        'API-Key': credentials.apiKey,
        'API-Sign': signature,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: postData
    });

    if (!response.ok) {
      throw new Error(`Kraken API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error && data.error.length > 0) {
      throw new Error(`Kraken API error: ${data.error.join(', ')}`);
    }

    const trades = data.result?.trades || {};
    
    return Object.entries(trades).map(([id, trade]: [string, any]) => ({
      id,
      exchange: 'kraken',
      symbol: trade.pair,
      side: trade.type as 'buy' | 'sell',
      type: trade.ordertype as 'market' | 'limit',
      price: parseFloat(trade.price),
      quantity: parseFloat(trade.vol),
      quoteQuantity: parseFloat(trade.cost),
      fee: parseFloat(trade.fee),
      feeCurrency: 'USD', // Kraken uses USD for fees
      timestamp: new Date(trade.time * 1000),
      orderId: trade.ordertxid,
      isMaker: trade.maker
    }));
  }

  /**
   * KuCoin API implementation
   */
  private async fetchKuCoinTrades(
    credentials: ExchangeCredentials,
    options?: { startTime?: Date; endTime?: Date; symbol?: string }
  ): Promise<ExchangeTrade[]> {
    const { baseUrl, trades: tradesEndpoint } = EXCHANGE_ENDPOINTS.kucoin;
    const timestamp = Date.now().toString();
    
    const params = new URLSearchParams();
    if (options?.symbol) params.append('symbol', options.symbol);
    if (options?.startTime) params.append('startAt', options.startTime.getTime().toString());
    if (options?.endTime) params.append('endAt', options.endTime.getTime().toString());

    const path = `${tradesEndpoint}${params.toString() ? '?' + params.toString() : ''}`;
    const strToSign = timestamp + 'GET' + path;
    const signature = await this.createHmacSignature(strToSign, credentials.apiSecret);
    const passphrase = await this.createHmacSignature(credentials.passphrase || '', credentials.apiSecret);

    const response = await fetch(`${baseUrl}${path}`, {
      headers: {
        'KC-API-KEY': credentials.apiKey,
        'KC-API-SIGN': signature,
        'KC-API-TIMESTAMP': timestamp,
        'KC-API-PASSPHRASE': passphrase,
        'KC-API-KEY-VERSION': '2'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`KuCoin API error: ${error.msg || response.statusText}`);
    }

    const data = await response.json();
    
    return (data.data?.items || []).map((trade: any) => ({
      id: trade.tradeId,
      exchange: 'kucoin',
      symbol: trade.symbol,
      side: trade.side.toLowerCase(),
      type: trade.type?.toLowerCase() || 'market',
      price: parseFloat(trade.price),
      quantity: parseFloat(trade.size),
      quoteQuantity: parseFloat(trade.funds),
      fee: parseFloat(trade.fee),
      feeCurrency: trade.feeCurrency,
      timestamp: new Date(trade.createdAt),
      orderId: trade.orderId,
      isMaker: trade.liquidity === 'maker'
    }));
  }

  /**
   * Bybit API implementation
   */
  private async fetchBybitTrades(
    credentials: ExchangeCredentials,
    options?: { startTime?: Date; endTime?: Date; symbol?: string }
  ): Promise<ExchangeTrade[]> {
    const { baseUrl, trades: tradesEndpoint } = EXCHANGE_ENDPOINTS.bybit;
    const timestamp = Date.now().toString();
    const recvWindow = '5000';
    
    const params: Record<string, string> = {
      category: 'spot', // or 'linear' for futures
      limit: '100'
    };
    if (options?.symbol) params.symbol = options.symbol;
    if (options?.startTime) params.startTime = options.startTime.getTime().toString();
    if (options?.endTime) params.endTime = options.endTime.getTime().toString();

    const queryString = new URLSearchParams(params).toString();
    const signString = timestamp + credentials.apiKey + recvWindow + queryString;
    const signature = await this.createHmacSignature(signString, credentials.apiSecret);

    const response = await fetch(`${baseUrl}${tradesEndpoint}?${queryString}`, {
      headers: {
        'X-BAPI-API-KEY': credentials.apiKey,
        'X-BAPI-SIGN': signature,
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-RECV-WINDOW': recvWindow
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Bybit API error: ${error.retMsg || response.statusText}`);
    }

    const data = await response.json();
    
    return (data.result?.list || []).map((trade: any) => ({
      id: trade.execId,
      exchange: 'bybit',
      symbol: trade.symbol,
      side: trade.side.toLowerCase(),
      type: trade.orderType?.toLowerCase() || 'market',
      price: parseFloat(trade.execPrice),
      quantity: parseFloat(trade.execQty),
      quoteQuantity: parseFloat(trade.execValue),
      fee: parseFloat(trade.execFee),
      feeCurrency: trade.feeCurrency || 'USDT',
      timestamp: new Date(parseInt(trade.execTime)),
      orderId: trade.orderId,
      isMaker: trade.isMaker
    }));
  }

  /**
   * OKX API implementation
   */
  private async fetchOKXTrades(
    credentials: ExchangeCredentials,
    options?: { startTime?: Date; endTime?: Date; symbol?: string }
  ): Promise<ExchangeTrade[]> {
    const { baseUrl, trades: tradesEndpoint } = EXCHANGE_ENDPOINTS.okx;
    const timestamp = new Date().toISOString();
    
    const params = new URLSearchParams();
    params.append('instType', 'SPOT');
    if (options?.symbol) params.append('instId', options.symbol);
    if (options?.startTime) params.append('begin', options.startTime.getTime().toString());
    if (options?.endTime) params.append('end', options.endTime.getTime().toString());

    const path = `${tradesEndpoint}?${params.toString()}`;
    const signString = timestamp + 'GET' + path;
    const signature = await this.createHmacSignature(signString, credentials.apiSecret, 'base64');

    const response = await fetch(`${baseUrl}${path}`, {
      headers: {
        'OK-ACCESS-KEY': credentials.apiKey,
        'OK-ACCESS-SIGN': signature,
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': credentials.passphrase || ''
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OKX API error: ${error.msg || response.statusText}`);
    }

    const data = await response.json();
    
    return (data.data || []).map((trade: any) => ({
      id: trade.tradeId,
      exchange: 'okx',
      symbol: trade.instId,
      side: trade.side.toLowerCase(),
      type: trade.ordType?.toLowerCase() || 'market',
      price: parseFloat(trade.fillPx),
      quantity: parseFloat(trade.fillSz),
      quoteQuantity: parseFloat(trade.fillPx) * parseFloat(trade.fillSz),
      fee: parseFloat(trade.fee),
      feeCurrency: trade.feeCcy,
      timestamp: new Date(parseInt(trade.ts)),
      orderId: trade.ordId,
      isMaker: trade.execType === 'M'
    }));
  }

  /**
   * Bitget API implementation
   */
  private async fetchBitgetTrades(
    credentials: ExchangeCredentials,
    options?: { startTime?: Date; endTime?: Date; symbol?: string }
  ): Promise<ExchangeTrade[]> {
    const { baseUrl, trades: tradesEndpoint } = EXCHANGE_ENDPOINTS.bitget;
    const timestamp = Date.now().toString();
    
    const params: Record<string, string> = {
      productType: 'umcbl' // USDT-M futures
    };
    if (options?.symbol) params.symbol = options.symbol;
    if (options?.startTime) params.startTime = options.startTime.getTime().toString();
    if (options?.endTime) params.endTime = options.endTime.getTime().toString();

    const queryString = new URLSearchParams(params).toString();
    const path = `${tradesEndpoint}?${queryString}`;
    const signString = timestamp + 'GET' + path;
    const signature = await this.createHmacSignature(signString, credentials.apiSecret, 'base64');

    const response = await fetch(`${baseUrl}${path}`, {
      headers: {
        'ACCESS-KEY': credentials.apiKey,
        'ACCESS-SIGN': signature,
        'ACCESS-TIMESTAMP': timestamp,
        'ACCESS-PASSPHRASE': credentials.passphrase || '',
        'locale': 'en-US'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Bitget API error: ${error.msg || response.statusText}`);
    }

    const data = await response.json();
    
    return (data.data || []).map((trade: any) => ({
      id: trade.tradeId,
      exchange: 'bitget',
      symbol: trade.symbol,
      side: trade.side.toLowerCase(),
      type: 'market',
      price: parseFloat(trade.price),
      quantity: parseFloat(trade.sizeQty),
      quoteQuantity: parseFloat(trade.price) * parseFloat(trade.sizeQty),
      fee: parseFloat(trade.fee),
      feeCurrency: trade.feeCcy || 'USDT',
      timestamp: new Date(parseInt(trade.cTime)),
      orderId: trade.orderId,
      isMaker: trade.tradeSide === 'maker'
    }));
  }

  /**
   * Huobi API implementation
   */
  private async fetchHuobiTrades(
    credentials: ExchangeCredentials,
    options?: { startTime?: Date; endTime?: Date; symbol?: string }
  ): Promise<ExchangeTrade[]> {
    const { baseUrl, trades: tradesEndpoint } = EXCHANGE_ENDPOINTS.huobi;
    const timestamp = new Date().toISOString().split('.')[0];
    
    const params: Record<string, string> = {
      AccessKeyId: credentials.apiKey,
      SignatureMethod: 'HmacSHA256',
      SignatureVersion: '2',
      Timestamp: timestamp
    };
    if (options?.symbol) params.symbol = options.symbol.toLowerCase();
    if (options?.startTime) params['start-time'] = options.startTime.getTime().toString();
    if (options?.endTime) params['end-time'] = options.endTime.getTime().toString();

    const sortedParams = Object.keys(params).sort().map(key => `${key}=${encodeURIComponent(params[key])}`).join('&');
    const signString = `GET\napi.huobi.pro\n${tradesEndpoint}\n${sortedParams}`;
    const signature = await this.createHmacSignature(signString, credentials.apiSecret, 'base64');

    const response = await fetch(`${baseUrl}${tradesEndpoint}?${sortedParams}&Signature=${encodeURIComponent(signature)}`, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Huobi API error: ${error['err-msg'] || response.statusText}`);
    }

    const data = await response.json();
    
    return (data.data || []).map((trade: any) => ({
      id: trade['trade-id'].toString(),
      exchange: 'huobi',
      symbol: trade.symbol.toUpperCase(),
      side: trade.type.includes('buy') ? 'buy' : 'sell',
      type: trade.type.includes('market') ? 'market' : 'limit',
      price: parseFloat(trade.price),
      quantity: parseFloat(trade['filled-amount']),
      quoteQuantity: parseFloat(trade['filled-cash-amount']),
      fee: parseFloat(trade['filled-fees']),
      feeCurrency: trade['fee-currency']?.toUpperCase() || 'USDT',
      timestamp: new Date(trade['created-at']),
      orderId: trade['order-id'].toString(),
      isMaker: trade.role === 'maker'
    }));
  }

  /**
   * Gate.io API implementation
   */
  private async fetchGateioTrades(
    credentials: ExchangeCredentials,
    options?: { startTime?: Date; endTime?: Date; symbol?: string }
  ): Promise<ExchangeTrade[]> {
    const { baseUrl, trades: tradesEndpoint } = EXCHANGE_ENDPOINTS.gateio;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    
    const params = new URLSearchParams();
    if (options?.symbol) params.append('currency_pair', options.symbol);
    if (options?.startTime) params.append('from', Math.floor(options.startTime.getTime() / 1000).toString());
    if (options?.endTime) params.append('to', Math.floor(options.endTime.getTime() / 1000).toString());

    const queryString = params.toString();
    const path = `${tradesEndpoint}${queryString ? '?' + queryString : ''}`;
    const signString = `GET\n${path}\n${queryString}\n\n${timestamp}`;
    const signature = await this.createHmacSignature(signString, credentials.apiSecret);

    const response = await fetch(`${baseUrl}${path}`, {
      headers: {
        'KEY': credentials.apiKey,
        'SIGN': signature,
        'Timestamp': timestamp
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gate.io API error: ${error.message || response.statusText}`);
    }

    const data = await response.json();
    
    return (data || []).map((trade: any) => ({
      id: trade.id.toString(),
      exchange: 'gateio',
      symbol: trade.currency_pair,
      side: trade.side,
      type: trade.role === 'taker' ? 'market' : 'limit',
      price: parseFloat(trade.price),
      quantity: parseFloat(trade.amount),
      quoteQuantity: parseFloat(trade.price) * parseFloat(trade.amount),
      fee: parseFloat(trade.fee),
      feeCurrency: trade.fee_currency,
      timestamp: new Date(parseInt(trade.create_time) * 1000),
      orderId: trade.order_id,
      isMaker: trade.role === 'maker'
    }));
  }

  /**
   * MEXC API implementation
   */
  private async fetchMEXCTrades(
    credentials: ExchangeCredentials,
    options?: { startTime?: Date; endTime?: Date; symbol?: string }
  ): Promise<ExchangeTrade[]> {
    const { baseUrl, trades: tradesEndpoint } = EXCHANGE_ENDPOINTS.mexc;
    const timestamp = Date.now().toString();
    
    const params: Record<string, string> = {
      timestamp,
      recvWindow: '5000'
    };
    if (options?.symbol) params.symbol = options.symbol;
    if (options?.startTime) params.startTime = options.startTime.getTime().toString();
    if (options?.endTime) params.endTime = options.endTime.getTime().toString();

    const queryString = new URLSearchParams(params).toString();
    const signature = await this.createHmacSignature(queryString, credentials.apiSecret);

    const response = await fetch(`${baseUrl}${tradesEndpoint}?${queryString}&signature=${signature}`, {
      headers: {
        'X-MEXC-APIKEY': credentials.apiKey
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`MEXC API error: ${error.msg || response.statusText}`);
    }

    const data = await response.json();
    
    return (data || []).map((trade: any) => ({
      id: trade.id.toString(),
      exchange: 'mexc',
      symbol: trade.symbol,
      side: trade.isBuyer ? 'buy' : 'sell',
      type: 'market',
      price: parseFloat(trade.price),
      quantity: parseFloat(trade.qty),
      quoteQuantity: parseFloat(trade.quoteQty),
      fee: parseFloat(trade.commission),
      feeCurrency: trade.commissionAsset,
      timestamp: new Date(trade.time),
      orderId: trade.orderId.toString(),
      isMaker: trade.isMaker
    }));
  }

  /**
   * Validate exchange credentials
   */
  private async validateCredentials(exchangeName: string, credentials: ExchangeCredentials): Promise<boolean> {
    try {
      // Make a simple API call to validate credentials
      switch (exchangeName.toLowerCase()) {
        case 'binance': {
          const timestamp = Date.now();
          const queryString = `timestamp=${timestamp}&recvWindow=5000`;
          const signature = await this.createHmacSignature(queryString, credentials.apiSecret);
          const response = await fetch(
            `${EXCHANGE_ENDPOINTS.binance.baseUrl}${EXCHANGE_ENDPOINTS.binance.account}?${queryString}&signature=${signature}`,
            { headers: { 'X-MBX-APIKEY': credentials.apiKey } }
          );
          return response.ok;
        }
        // Add validation for other exchanges as needed
        default:
          // For other exchanges, assume valid if credentials are provided
          return !!(credentials.apiKey && credentials.apiSecret);
      }
    } catch (error) {
      console.error('Credential validation error:', error);
      return false;
    }
  }

  /**
   * Create HMAC signature
   */
  private async createHmacSignature(message: string, secret: string, encoding: 'hex' | 'base64' = 'hex'): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    
    if (encoding === 'base64') {
      return btoa(String.fromCharCode(...new Uint8Array(signature)));
    }
    
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Create Kraken-specific signature
   */
  private async createKrakenSignature(path: string, postData: string, nonce: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const decodedSecret = Uint8Array.from(atob(secret), c => c.charCodeAt(0));
    
    // SHA256 hash of nonce + postData
    const sha256Data = encoder.encode(nonce + postData);
    const sha256Hash = await crypto.subtle.digest('SHA-256', sha256Data);
    
    // Concatenate path + SHA256 hash
    const pathBytes = encoder.encode(path);
    const combined = new Uint8Array(pathBytes.length + sha256Hash.byteLength);
    combined.set(pathBytes);
    combined.set(new Uint8Array(sha256Hash), pathBytes.length);
    
    // HMAC-SHA512
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      decodedSecret,
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, combined);
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
  }

  /**
   * Encrypt credentials for storage
   */
  private async encryptCredentials(value: string): Promise<string> {
    // In production, use proper encryption with a key management service
    // For now, we'll use base64 encoding as a placeholder
    // TODO: Implement proper encryption with Supabase Vault or similar
    return btoa(value);
  }

  /**
   * Decrypt credentials from storage
   */
  private async decryptCredentials(encryptedValue: string): Promise<string> {
    // In production, use proper decryption
    // TODO: Implement proper decryption with Supabase Vault or similar
    return atob(encryptedValue);
  }

  /**
   * Normalize trade data for database storage
   */
  private normalizeTradeForDatabase(trade: ExchangeTrade, userId: string, connectionId: string): any {
    return {
      user_id: userId,
      broker_trade_id: `${trade.exchange}_${trade.id}`,
      symbol: trade.symbol,
      side: trade.side,
      entry_price: trade.price,
      quantity: trade.quantity,
      pnl: 0, // Calculate P&L separately
      fees: trade.fee,
      date: trade.timestamp.toISOString(),
      entry_date: trade.timestamp.toISOString(),
      exit_date: trade.timestamp.toISOString(),
      broker: trade.exchange,
      exchange_connection_id: connectionId,
      is_maker: trade.isMaker,
      order_type: trade.type,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const cryptoExchangeService = CryptoExchangeService.getInstance();








