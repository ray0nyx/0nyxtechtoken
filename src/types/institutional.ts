// Institutional Trading Platform Types

export type AssetClass = 'equities' | 'fx' | 'commodities' | 'crypto' | 'fixed-income';

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  exchange?: string;
  currency: string;
  isActive: boolean;
  metadata?: Record<string, any>;
}

export interface MarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: string;
  bid?: number;
  ask?: number;
  spread?: number;
}

export interface RiskMetrics {
  var95: number; // Value at Risk 95%
  var99: number; // Value at Risk 99%
  expectedShortfall: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  calmarRatio: number;
  beta: number;
  volatility: number;
  skewness: number;
  kurtosis: number;
}

export interface PortfolioPosition {
  id: string;
  symbol: string;
  assetClass: AssetClass;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  weight: number; // Portfolio weight percentage
  riskMetrics: RiskMetrics;
}

export interface Portfolio {
  id: string;
  name: string;
  description?: string;
  positions: PortfolioPosition[];
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  riskMetrics: RiskMetrics;
  lastUpdated: string;
}

export interface HeatmapData {
  assetClass: AssetClass;
  sector?: string;
  region?: string;
  value: number;
  weight: number;
  risk: 'low' | 'medium' | 'high' | 'critical';
  color: string;
}

export interface ComplianceRecord {
  id: string;
  type: 'trade' | 'position' | 'risk' | 'compliance';
  action: string;
  description: string;
  userId: string;
  timestamp: string;
  metadata: Record<string, any>;
  immutable: boolean;
}

export interface RegulatoryReport {
  id: string;
  type: 'mifid-ii' | 'dodd-frank' | 'basel-iii' | 'custom';
  name: string;
  period: {
    start: string;
    end: string;
  };
  status: 'draft' | 'pending' | 'approved' | 'submitted';
  data: Record<string, any>;
  generatedAt: string;
  generatedBy: string;
}

export interface UserRole {
  id: string;
  name: string;
  permissions: string[];
  level: 'viewer' | 'trader' | 'analyst' | 'manager' | 'admin';
  description: string;
}

export interface AuditTrail {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  changes: Record<string, { from: any; to: any }>;
  userId: string;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  sessionId: string;
}

export interface MarketDataFeed {
  id: string;
  name: string;
  provider: 'bloomberg' | 'reuters' | 'refinitiv' | 'custom';
  assetClasses: AssetClass[];
  latency: number; // milliseconds
  isActive: boolean;
  lastUpdate: string;
}

export interface TradingSession {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  status: 'active' | 'paused' | 'closed';
  participants: string[];
  riskLimits: {
    maxPositionSize: number;
    maxDailyLoss: number;
    maxDrawdown: number;
  };
}

// Chart and Visualization Types
export interface ChartConfig {
  type: 'line' | 'candlestick' | 'bar' | 'heatmap' | 'scatter';
  timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w' | '1M';
  indicators: string[];
  overlays: string[];
  style: {
    theme: 'dark' | 'light';
    colors: Record<string, string>;
  };
}

export interface PerformanceMetrics {
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  calmarRatio: number;
  winRate: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  timestamp: string;
  requestId: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Real-time Data Types
export interface RealtimeUpdate {
  type: 'price' | 'volume' | 'trade' | 'order' | 'risk';
  symbol: string;
  data: any;
  timestamp: string;
}

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: string;
}
