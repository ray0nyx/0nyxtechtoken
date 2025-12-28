/**
 * WagyuTech API Client
 * TypeScript client for WagyuTech API
 */

const WAGYU_API_BASE_URL = import.meta.env.VITE_WAGYU_API_URL || 'http://localhost:8002';

export interface WagyuApiConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface TokenData {
  symbol: string;
  name?: string;
  address: string;
  price: number;
  price_usd: number;
  change_24h: number;
  volume_24h: number;
  liquidity: number;
  market_cap?: number;
  fdv?: number;
  holders?: number;
  total_supply?: string;
  circulating_supply?: string;
  pair_address?: string;
  chain: string;
  dex?: string;
}

export interface PriceData {
  symbol: string;
  price: number;
  price_usd: number;
  change_24h: number;
  timestamp: string;
  source: string;
}

export interface OHLCVData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradingOrderRequest {
  pair_symbol: string;
  order_type: 'market' | 'limit' | 'stop_loss' | 'take_profit';
  side: 'buy' | 'sell';
  amount: number;
  price?: number;
  stop_price?: number;
  slippage_tolerance?: number;
  wallet_address?: string;
}

export interface TradingOrderResponse {
  order_id: string;
  status: string;
  pair_symbol: string;
  order_type: string;
  side: string;
  amount: number;
  executed_amount?: number;
  price?: number;
  fee_amount: number;
  fee_percentage: number;
  transaction_hash?: string;
  created_at: string;
}

export interface APIUsageStats {
  total_requests: number;
  requests_today: number;
  requests_this_hour: number;
  requests_remaining_this_hour: number;
  requests_remaining_today: number;
  tier: string;
  rate_limit_per_hour: number;
  rate_limit_per_minute: number;
}

export class WagyuApiClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: WagyuApiConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || WAGYU_API_BASE_URL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `API request failed: ${response.status}`);
    }

    return response.json();
  }

  // Token endpoints
  async searchTokens(query: string, limit: number = 50): Promise<TokenData[]> {
    const response = await this.request<{ tokens: TokenData[] }>(
      `/api/v1/tokens/search?q=${encodeURIComponent(query)}&limit=${limit}`
    );
    return response.tokens;
  }

  async getTokenData(symbol: string): Promise<TokenData> {
    return this.request<TokenData>(`/api/v1/tokens/${encodeURIComponent(symbol)}`);
  }

  async getTrendingTokens(limit: number = 20): Promise<TokenData[]> {
    return this.request<TokenData[]>(`/api/v1/tokens/trending?limit=${limit}`);
  }

  async getNewTokens(limit: number = 20): Promise<TokenData[]> {
    return this.request<TokenData[]>(`/api/v1/tokens/new?limit=${limit}`);
  }

  async getPrice(symbol: string): Promise<PriceData> {
    return this.request<PriceData>(`/api/v1/prices/${encodeURIComponent(symbol)}`);
  }

  async getOHLCV(
    symbol: string,
    timeframe: string = '1h',
    limit: number = 100
  ): Promise<{ symbol: string; timeframe: string; data: OHLCVData[] }> {
    return this.request(
      `/api/v1/ohlcv/${encodeURIComponent(symbol)}?timeframe=${timeframe}&limit=${limit}`
    );
  }

  async getLiquidity(symbol: string): Promise<any> {
    return this.request(`/api/v1/liquidity/${encodeURIComponent(symbol)}`);
  }

  async getAnalytics(symbol: string): Promise<any> {
    return this.request(`/api/v1/analytics/${encodeURIComponent(symbol)}`);
  }

  // Trading endpoints
  async executeMarketOrder(order: TradingOrderRequest): Promise<TradingOrderResponse> {
    return this.request<TradingOrderResponse>('/api/v1/trade/market', {
      method: 'POST',
      body: JSON.stringify(order),
    });
  }

  async createLimitOrder(order: TradingOrderRequest): Promise<TradingOrderResponse> {
    return this.request<TradingOrderResponse>('/api/v1/trade/limit', {
      method: 'POST',
      body: JSON.stringify(order),
    });
  }

  async getOrders(statusFilter?: string): Promise<TradingOrderResponse[]> {
    const url = statusFilter
      ? `/api/v1/trade/orders?status=${statusFilter}`
      : '/api/v1/trade/orders';
    return this.request<TradingOrderResponse[]>(url);
  }

  async cancelOrder(orderId: string): Promise<void> {
    await this.request(`/api/v1/trade/orders/${orderId}`, {
      method: 'DELETE',
    });
  }

  // Monitoring endpoints
  async subscribePumpFun(filters: Record<string, any>, webhookUrl?: string): Promise<any> {
    return this.request('/api/v1/monitor/pump-fun', {
      method: 'POST',
      body: JSON.stringify({
        subscription_type: 'pump_fun_migration',
        filters,
        webhook_url: webhookUrl,
      }),
    });
  }

  async subscribeSocial(filters: Record<string, any>, webhookUrl?: string): Promise<any> {
    return this.request('/api/v1/monitor/social', {
      method: 'POST',
      body: JSON.stringify({
        subscription_type: 'social_signal',
        filters,
        webhook_url: webhookUrl,
      }),
    });
  }

  async getMonitoringEvents(
    subscriptionId?: string,
    eventType?: string,
    limit: number = 50
  ): Promise<any[]> {
    const params = new URLSearchParams();
    if (subscriptionId) params.append('subscription_id', subscriptionId);
    if (eventType) params.append('event_type', eventType);
    params.append('limit', limit.toString());
    
    return this.request<any[]>(`/api/v1/monitor/events?${params.toString()}`);
  }

  // Billing endpoints
  async getUsageStats(): Promise<APIUsageStats> {
    return this.request<APIUsageStats>('/api/v1/billing/usage');
  }

  async getInvoices(): Promise<any> {
    return this.request('/api/v1/billing/invoice');
  }
}

// Helper function to create client instance
export function createWagyuApiClient(apiKey: string, baseUrl?: string): WagyuApiClient {
  return new WagyuApiClient({ apiKey, baseUrl });
}
