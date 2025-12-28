export interface NormalizedTrade {
  id: string;
  userId: string;
  connectionId: string;
  exchangeTradeId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  fee: number;
  feeCurrency: string;
  executedAt: Date;
  exchangeTimestamp: Date;
  platform: string;
  orderId: string;
  positionId?: string;
  rawData?: Record<string, any>;
}

export interface ExchangeTradeData {
  id: string;
  symbol: string;
  side: string;
  amount: number;
  price: number;
  fee: { cost: number; currency: string };
  timestamp: number;
  orderId: string;
  // Exchange-specific fields
  [key: string]: any;
}

export interface ExchangeConnection {
  id: string;
  userId: string;
  exchangeName: string;
  connectionType: 'api_key' | 'oauth2';
  isActive: boolean;
  lastSyncAt?: Date;
  syncStatus: 'connected' | 'disconnected' | 'error' | 'syncing';
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncSession {
  id: string;
  connectionId: string;
  startedAt: Date;
  completedAt?: Date;
  syncType: 'historical' | 'realtime' | 'manual';
  tradesSynced: number;
  tradesUpdated: number;
  syncDuration?: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
}

export interface SyncAuditLog {
  id: string;
  userId: string;
  connectionId?: string;
  action: string;
  details: Record<string, any>;
  timestamp: Date;
}

export interface AccountInfo {
  id: string;
  balances: Array<{
    currency: string;
    free: number;
    used: number;
    total: number;
  }>;
  permissions: string[];
  limits: Record<string, any>;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  details?: Record<string, any>;
}

export interface ExchangeAdapter {
  authenticate(credentials: any): Promise<boolean>;
  subscribeToTrades(symbols: string[]): Promise<WebSocket>;
  fetchHistoricalTrades(startDate: Date, endDate: Date): Promise<NormalizedTrade[]>;
  getAccountInfo(): Promise<AccountInfo>;
  validateCredentials(): Promise<ValidationResult>;
}

export interface CryptoSyncConfig {
  exchanges: string[];
  symbols: string[];
  syncInterval: number;
  maxRetries: number;
  batchSize: number;
}

export interface SyncHealthStatus {
  connection: ExchangeConnection;
  lastTrade?: NormalizedTrade;
  syncHealth: 'healthy' | 'degraded' | 'disconnected';
  queueDepth: number;
  throughput: number;
  errorRate: number;
  lastUpdate: Date;
}
