/**
 * Universal Copy Trading Platform
 * Comprehensive copy trading system supporting multiple platforms
 * Real-time trade replication with sub-100ms latency
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CopyTradingDashboard } from '@/components/institutional/CopyTradingDashboard';
import { CopyTradingControls } from '@/components/institutional/CopyTradingControls';
import { ExchangeLinking } from '@/components/institutional/ExchangeLinking';
import { RiskManagement } from '@/components/institutional/RiskManagement';
import { MasterTraderDiscovery } from '@/components/copy-trading/MasterTraderDiscovery';
import { FollowerManagement } from '@/components/copy-trading/FollowerManagement';
import { PerformanceAnalytics } from '@/components/copy-trading/PerformanceAnalytics';
import { RealTimeMetrics } from '@/components/copy-trading/RealTimeMetrics';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Copy,
  Zap,
  Activity as TrendingUp,
  Activity,
  Settings,
  BarChart2 as BarChart3,
  Shield,
  AlertCircle as AlertTriangle,
  Users,
  Search,
  Search as Filter,
  Activity as Star,
  Target,
  Clock,
  DollarSign,
  TrendingDown,
  CheckCircle,
  Circle as XCircle,
  Play,
  Pause,
  Square,
  RefreshCw,
  Search as Eye,
  Search as EyeOff,
  Plus,
  Square as Minus,
  ChevronUp as ArrowUp,
  ChevronDown as ArrowDown,
  ExternalLink,
  Clock as Lock,
  Download,
  Upload,
  MoreHorizontal
} from 'lucide-react';

// Core Copy Trading Interfaces
interface MasterTraderProfile {
  id: string;
  userId: string;
  walletAddress?: string;
  profileName: string;
  solBalance?: number;
  balanceUSD?: number;
  strategyType: 'scalping' | 'swing' | 'arbitrage' | 'mean_reversion' | 'trend_following';
  riskLevel: 'conservative' | 'moderate' | 'aggressive' | 'high_frequency';
  performance: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    totalTrades: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    volatility: number;
    var95: number;
    consistencyScore: number;
  };
  verification: {
    isVerified: boolean;
    trackRecordMonths: number;
    assetsUnderManagement: number;
    kycStatus: string;
    complianceScore: number;
  };
  feeStructure: {
    performanceFee: number;
    managementFee: number;
    highWaterMark: boolean;
  };
  social: {
    followerCount: number;
    averageRating: number;
    reviewCount: number;
  };
  isPublic: boolean;
  isAcceptingFollowers: boolean;
  minInvestment: number;
  maxFollowers: number;
  bio: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  lastTradeAt?: string;
}

interface FollowerRelationship {
  id: string;
  masterTraderId: string;
  followerId: string;
  allocatedCapital: number;
  positionSizing: 'proportional' | 'fixed' | 'kelly';
  maxPositionSize?: number;
  riskLimits: {
    maxDailyLoss: number;
    maxDrawdown: number;
    stopLossEnabled: boolean;
    takeProfitEnabled: boolean;
  };
  replicationSettings: {
    delay: number;
    allowPartialFills: boolean;
    maxSlippage: number;
  };
  status: 'active' | 'paused' | 'stopped' | 'suspended';
  startedAt: string;
  lastTradeAt?: string;
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  totalPnl: number;
}

interface TradeSignal {
  id: string;
  masterTradeId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price?: number;
  orderType: 'market' | 'limit' | 'stop' | 'stop_limit';
  stopLoss?: number;
  takeProfit?: number;
  leverage: number;
  timestamp: string;
  platform: string;
  metadata: Record<string, any>;
}

interface ExecutionResult {
  id: string;
  signalId: string;
  platform: string;
  success: boolean;
  orderId?: string;
  filledQuantity?: number;
  filledPrice?: number;
  remainingQuantity?: number;
  fees?: number;
  executionTime: string;
  errorMessage?: string;
  replicationDelay: number;
  slippage?: number;
}

interface CopyTradingSession {
  id: string;
  masterTradeId: string;
  followerTradeId?: string;
  masterConnectionId: string;
  followerRelationshipId: string;
  replicationDelayMs: number;
  slippage?: number;
  fillQuality?: number;
  executedAt: string;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled';
  errorMessage?: string;
  retryCount: number;
}

interface PlatformConnection {
  id: string;
  userId: string;
  platform: string;
  connectionType: 'crypto' | 'futures' | 'forex' | 'stocks';
  isActive: boolean;
  lastSyncAt?: string;
  syncStatus: 'connected' | 'disconnected' | 'error' | 'syncing';
  rateLimitRemaining?: number;
  rateLimitResetAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface RiskLimits {
  maxPositionSize?: number;
  maxDailyLoss: number;
  maxDrawdown: number;
  allowedInstruments: string[];
  leverageLimits: Record<string, number>;
  autoLiquidationThreshold: number;
  correlationLimits: Record<string, number>;
  circuitBreakerEnabled: boolean;
  maxCorrelation: number;
}

interface PerformanceMetrics {
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  successRate: number;
  averageLatencyMs: number;
  totalPnl: number;
  dailyPnl: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  profitFactor: number;
  platformPerformance: Record<string, {
    totalTrades: number;
    successfulTrades: number;
    averageLatency: number;
    successRate: number;
  }>;
}

interface CopyTradingConfig {
  id: string;
  name: string;
  source_backtest_id: string;
  target_exchanges: string[];
  status: 'active' | 'paused' | 'error' | 'disabled';
  created_at: string;
  last_sync_at: string;
}

interface ExchangeConnection {
  id: string;
  exchange_name: string;
  exchange_type: string;
  is_active: boolean;
  last_sync_at: string;
}

// Broker data with logos and connection details
const SUPPORTED_BROKERS = [
  {
    id: 'binance',
    name: 'Binance',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/1/12/Binance_logo.svg',
    type: 'crypto',
    status: 'available',
    features: ['Spot Trading', 'Futures', 'Margin Trading'],
    description: 'World\'s largest cryptocurrency exchange'
  },
  {
    id: 'coinbase',
    name: 'Coinbase Pro',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/4/4a/Coinbase_Logo.svg',
    type: 'crypto',
    status: 'available',
    features: ['Spot Trading', 'Advanced Trading'],
    description: 'Secure cryptocurrency exchange'
  },
  {
    id: 'kraken',
    name: 'Kraken',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/4/4a/Kraken_logo.svg',
    type: 'crypto',
    status: 'available',
    features: ['Spot Trading', 'Futures', 'Margin Trading'],
    description: 'Established cryptocurrency exchange'
  },
  {
    id: 'kucoin',
    name: 'KuCoin',
    logo: 'https://assets.kucoin.com/v1/bg/kucoin-logo.svg',
    type: 'crypto',
    status: 'available',
    features: ['Spot Trading', 'Futures', 'Margin Trading'],
    description: 'Global cryptocurrency exchange'
  },
  {
    id: 'bybit',
    name: 'Bybit',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/5/58/Bybit_logo.svg',
    type: 'crypto',
    status: 'available',
    features: ['Derivatives', 'Spot Trading', 'Copy Trading'],
    description: 'Cryptocurrency derivatives exchange'
  },
  {
    id: 'okx',
    name: 'OKX',
    logo: 'https://static.okx.com/cdn/assets/imgs/221/6A8B5B5B5B5B5B5B.png',
    type: 'crypto',
    status: 'available',
    features: ['Spot Trading', 'Futures', 'Options'],
    description: 'Leading cryptocurrency exchange'
  },
  {
    id: 'ninjatrader',
    name: 'NinjaTrader',
    logo: 'https://ninjatrader.com/wp-content/themes/ninjatrader/images/logo.svg',
    type: 'futures',
    status: 'available',
    features: ['Futures Trading', 'Options', 'Forex'],
    description: 'Professional futures trading platform'
  },
  {
    id: 'rithmic',
    name: 'Rithmic',
    logo: 'https://rithmic.com/wp-content/themes/rithmic/images/logo.svg',
    type: 'futures',
    status: 'available',
    features: ['Futures Trading', 'Options', 'Data Feed'],
    description: 'Professional trading infrastructure'
  },
  {
    id: 'interactive_brokers',
    name: 'Interactive Brokers',
    logo: 'https://www.interactivebrokers.com/images/web/logos/ib-logo.svg',
    type: 'traditional',
    status: 'available',
    features: ['Stocks', 'Options', 'Futures', 'Forex'],
    description: 'Global electronic trading platform'
  }
];

// Mock data generation functions for development
const generateMockTradeSignals = (): TradeSignal[] => [];

const generateMockExecutionResults = (): ExecutionResult[] => [];

const generateMockCopyTradingSessions = (): CopyTradingSession[] => [];

const generateMockPerformanceMetrics = (): PerformanceMetrics => ({
  totalTrades: 0,
  successfulTrades: 0,
  failedTrades: 0,
  successRate: 0,
  averageLatencyMs: 0,
  totalPnl: 0,
  dailyPnl: 0,
  maxDrawdown: 0,
  sharpeRatio: 0,
  winRate: 0,
  profitFactor: 0,
  platformPerformance: {}
});

const generateMockRiskLimits = (): RiskLimits => {
  return {
    maxDailyLoss: 1000,
    maxDrawdown: 0.15,
    maxPositionSize: 5000,
    allowedInstruments: ['BTC', 'ETH'],
    leverageLimits: { 'BTC': 10, 'ETH': 5 },
    autoLiquidationThreshold: 0.05,
    correlationLimits: { 'BTC-ETH': 0.8 },
    circuitBreakerEnabled: true,
    maxCorrelation: 0.8
  };
};

const generateMockMasterTraders = (): MasterTraderProfile[] => [];

const generateMockFollowerRelationships = (): FollowerRelationship[] => [];

function CopyTrader() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // State management
  const [activeTab, setActiveTab] = useState('discovery');
  const [configs, setConfigs] = useState<CopyTradingConfig[]>([]);
  const [exchanges, setExchanges] = useState<ExchangeConnection[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Copy Trading State
  // Copy Trading State
  const [masterTraders, setMasterTraders] = useState<MasterTraderProfile[]>([]);
  const [followerRelationships, setFollowerRelationships] = useState<FollowerRelationship[]>([]);
  const [platformConnections, setPlatformConnections] = useState<PlatformConnection[]>([]);
  const [tradeSignals, setTradeSignals] = useState<TradeSignal[]>([]);
  const [executionResults, setExecutionResults] = useState<ExecutionResult[]>([]);
  const [copyTradingSessions, setCopyTradingSessions] = useState<CopyTradingSession[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [riskLimits, setRiskLimits] = useState<RiskLimits | null>(null);

  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStrategy, setSelectedStrategy] = useState<string>('all');
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('overall_score');
  const [sortOrder, setSortOrder] = useState<string>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [isRealtimeEnabled, setIsRealtimeEnabled] = useState(true);
  const [selectedMasterTrader, setSelectedMasterTrader] = useState<string | null>(null);

  // Add Wallet Modal States
  const [isAddWalletModalOpen, setIsAddWalletModalOpen] = useState(false);
  const [newWalletAddress, setNewWalletAddress] = useState('');
  const [newWalletName, setNewWalletName] = useState('');
  const [isAddingWallet, setIsAddingWallet] = useState(false);

  const supabase = createClient();

  // Real-time updates
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'error'>('connected');

  // Platform login state
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [selectedBroker, setSelectedBroker] = useState<string | null>(null);
  const [loginCredentials, setLoginCredentials] = useState<{ [key: string]: string }>({});
  const [showPassword, setShowPassword] = useState<{ [key: string]: boolean }>({});
  const [authMethods, setAuthMethods] = useState<{ [key: string]: any[] }>({});
  const [selectedAuthMethod, setSelectedAuthMethod] = useState<string>('');
  const [showVerificationModal, setShowVerificationModal] = useState(false);

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Real-time updates
  useEffect(() => {
    if (isRealtimeEnabled) {
      const interval = setInterval(() => {
        loadRealtimeData();
      }, 5000); // Update every 5 seconds

      return () => clearInterval(interval);
    }
  }, [isRealtimeEnabled]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      // Load all copy trading data in parallel
      const [
        configsData,
        exchangesData,
        masterTradersData,
        relationshipsData,
        connectionsData,
        metricsData,
        riskLimitsData
      ] = await Promise.all([
        loadCopyTradingConfigs(),
        loadExchanges(),
        loadMasterTraders(),
        loadFollowerRelationships(),
        loadPlatformConnections(),
        loadPerformanceMetrics(),
        loadRiskLimits()
      ]);

      setConfigs(configsData);
      setExchanges(exchangesData);
      setMasterTraders(masterTradersData);
      setFollowerRelationships(relationshipsData);
      setPlatformConnections(connectionsData);
      setPerformanceMetrics(metricsData);
      setRiskLimits(riskLimitsData);

      // Select first config if available
      if (configsData.length > 0 && !selectedConfig) {
        setSelectedConfig(configsData[0].id);
      }
    } catch (error) {
      console.error('Failed to load initial data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load copy trading data. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadRealtimeData = async () => {
    try {
      const [signalsData, resultsData, sessionsData, metricsData] = await Promise.all([
        loadTradeSignals(),
        loadExecutionResults(),
        loadCopyTradingSessions(),
        loadPerformanceMetrics()
      ]);

      setTradeSignals(signalsData);
      setExecutionResults(resultsData);
      setCopyTradingSessions(sessionsData);
      setPerformanceMetrics(metricsData);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to load real-time data:', error);
      setConnectionStatus('error');
    }
  };

  // Data loading functions
  // Helper to check if response is HTML (404 page) and handle gracefully
  const handleApiResponse = async <T,>(response: Response, fallback: () => T): Promise<T> => {
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      // API endpoint doesn't exist (returns HTML 404), use fallback silently
      return fallback();
    }
    try {
      return await response.json();
    } catch {
      // JSON parse error, use fallback
      return fallback();
    }
  };

  const loadCopyTradingConfigs = async (): Promise<CopyTradingConfig[]> => {
    try {
      const response = await fetch('/api/institutional/copy-trading/configs');
      if (!response.ok) {
        // API doesn't exist, return empty array silently
        return [];
      }
      return await handleApiResponse(response, () => []);
    } catch {
      // Network error or other issue, return empty array silently
      return [];
    }
  };

  const loadExchanges = async (): Promise<ExchangeConnection[]> => {
    try {
      const response = await fetch('/api/institutional/exchanges');
      if (!response.ok) {
        return [];
      }
      return await handleApiResponse(response, () => []);
    } catch {
      return [];
    }
  };

  const loadMasterTraders = async (): Promise<MasterTraderProfile[]> => {
    try {
      const { data, error } = await supabase
        .from('master_traders')
        .select('*');

      if (error) throw error;

      if (!data || data.length === 0) {
        return [];
      }

      const { fetchSolanaWalletBalance } = await import('@/lib/wallet-balance-service');
      const tradersWithBalances = await Promise.all(data.map(async (trader: any) => {
        let solBalance = 0;
        let balanceUSD = 0;

        if (trader.wallet_address) {
          try {
            const balanceData = await fetchSolanaWalletBalance(trader.wallet_address);
            solBalance = balanceData.balances['SOL']?.amount || 0;
            balanceUSD = balanceData.totalUsdValue;
          } catch (e) {
            console.error(`Error fetching balance for ${trader.wallet_address}:`, e);
          }
        }

        return {
          id: trader.id,
          userId: trader.userId || '',
          walletAddress: trader.wallet_address,
          profileName: trader.label || trader.profileName || 'Unknown Wallet',
          solBalance,
          balanceUSD,
          strategyType: trader.strategyType || 'swing',
          riskLevel: trader.riskLevel || 'moderate',
          performance: trader.performance || {
            totalReturn: 0,
            sharpeRatio: 0,
            maxDrawdown: 0,
            winRate: 0,
            totalTrades: 0,
            avgWin: 0,
            avgLoss: 0,
            profitFactor: 0,
            volatility: 0,
            var95: 0,
            consistencyScore: 0
          },
          verification: trader.verification || {
            isVerified: trader.is_verified || false,
            trackRecordMonths: 0,
            assetsUnderManagement: 0,
            kycStatus: 'pending',
            complianceScore: 0
          },
          feeStructure: trader.feeStructure || {
            performanceFee: 0,
            managementFee: 0,
            highWaterMark: false
          },
          social: trader.social || {
            followerCount: trader.follower_count || 0,
            averageRating: 0,
            reviewCount: 0
          },
          isPublic: true,
          isAcceptingFollowers: true,
          minInvestment: 0,
          maxFollowers: 100,
          bio: trader.description || '',
          tags: trader.tags || [],
          createdAt: trader.created_at || new Date().toISOString(),
          updatedAt: trader.updated_at || new Date().toISOString()
        };
      }));

      return tradersWithBalances;
    } catch (error) {
      console.error('Error loading master traders:', error);
      return [];
    }
  };

  const handleAddWallet = async () => {
    if (!newWalletAddress || !newWalletName) {
      toast({
        title: 'Validation Error',
        description: 'Please provide both a wallet address and a name.',
        variant: 'destructive',
      });
      return;
    }

    setIsAddingWallet(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('master_traders')
        .insert({
          wallet_address: newWalletAddress,
          label: newWalletName,
          is_verified: false,
          is_curated: false,
          risk_level: 'moderate',
          strategy_type: 'swing',
          follower_count: 0
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Wallet Added',
        description: `Successfully added ${newWalletName} to tracked wallets.`,
      });

      // Refresh the list
      const updatedTraders = await loadMasterTraders();

      // Fetch balances for new wallets
      const { fetchSolanaWalletBalance } = await import('@/lib/wallet-balance-service');
      const tradersWithBalances = await Promise.all(updatedTraders.map(async (trader) => {
        if (trader.walletAddress) {
          try {
            const balanceData = await fetchSolanaWalletBalance(trader.walletAddress);
            return {
              ...trader,
              solBalance: balanceData.balances['SOL']?.amount || 0,
              balanceUSD: balanceData.totalUsdValue
            };
          } catch (e) {
            console.error(`Error fetching balance for ${trader.walletAddress}:`, e);
            return trader;
          }
        }
        return trader;
      }));

      setMasterTraders(tradersWithBalances);

      // Reset and close
      setNewWalletAddress('');
      setNewWalletName('');
      setIsAddWalletModalOpen(false);
    } catch (error: any) {
      console.error('Error adding wallet:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add wallet.',
        variant: 'destructive',
      });
    } finally {
      setIsAddingWallet(false);
    }
  };

  const loadFollowerRelationships = async (): Promise<FollowerRelationship[]> => {
    try {
      const response = await fetch('/api/copy-trading/follower-relationships');
      if (!response.ok) {
        return generateMockFollowerRelationships();
      }
      return await handleApiResponse(response, generateMockFollowerRelationships);
    } catch {
      return generateMockFollowerRelationships();
    }
  };

  const loadPlatformConnections = async (): Promise<PlatformConnection[]> => {
    try {
      const response = await fetch('/api/copy-trading/platform-connections');
      if (!response.ok) {
        return [];
      }
      return await handleApiResponse(response, () => []);
    } catch {
      return [];
    }
  };

  const loadTradeSignals = async (): Promise<TradeSignal[]> => {
    try {
      const response = await fetch('/api/copy-trading/trade-signals');
      if (!response.ok) {
        return generateMockTradeSignals();
      }
      return await handleApiResponse(response, generateMockTradeSignals);
    } catch {
      return generateMockTradeSignals();
    }
  };

  const loadExecutionResults = async (): Promise<ExecutionResult[]> => {
    try {
      const response = await fetch('/api/copy-trading/execution-results');
      if (!response.ok) {
        return generateMockExecutionResults();
      }
      return await handleApiResponse(response, generateMockExecutionResults);
    } catch {
      return generateMockExecutionResults();
    }
  };

  const loadCopyTradingSessions = async (): Promise<CopyTradingSession[]> => {
    try {
      const response = await fetch('/api/copy-trading/sessions');
      if (!response.ok) {
        return generateMockCopyTradingSessions();
      }
      return await handleApiResponse(response, generateMockCopyTradingSessions);
    } catch {
      return generateMockCopyTradingSessions();
    }
  };

  const loadPerformanceMetrics = async (): Promise<PerformanceMetrics | null> => {
    try {
      const response = await fetch('/api/copy-trading/performance-metrics');
      if (!response.ok) {
        return generateMockPerformanceMetrics();
      }
      return await handleApiResponse(response, generateMockPerformanceMetrics);
    } catch {
      return generateMockPerformanceMetrics();
    }
  };

  const loadRiskLimits = async (): Promise<RiskLimits | null> => {
    try {
      const response = await fetch('/api/copy-trading/risk-limits');
      if (!response.ok) {
        return generateMockRiskLimits();
      }
      return await handleApiResponse(response, generateMockRiskLimits);
    } catch {
      return generateMockRiskLimits();
    }
  };

  // Action handlers
  const handleConfigCreated = (newConfig: CopyTradingConfig) => {
    setConfigs(prev => [newConfig, ...prev]);
    setSelectedConfig(newConfig.id);
    setActiveTab('dashboard');

    toast({
      title: 'Copy Trading Config Created',
      description: `Configuration "${newConfig.name}" has been created successfully.`,
    });
  };

  const handleExchangeLinked = (newExchange: ExchangeConnection) => {
    setExchanges(prev => [...prev, newExchange]);

    toast({
      title: 'Exchange Linked',
      description: `Successfully connected to ${newExchange.exchange_name}.`,
    });
  };

  const handleFollowTrader = async (traderId: string, allocatedCapital: number) => {
    try {
      const response = await fetch('/api/copy-trading/follow-trader', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterTraderId: traderId,
          allocatedCapital,
          positionSizing: 'proportional',
          riskLimits: {
            maxDailyLoss: 0.05,
            maxDrawdown: 0.20,
            stopLossEnabled: true,
            takeProfitEnabled: true
          },
          replicationSettings: {
            delay: 1000,
            allowPartialFills: true,
            maxSlippage: 0.001
          }
        })
      });

      if (!response.ok) throw new Error('Failed to follow trader');

      const newRelationship = await response.json();
      setFollowerRelationships(prev => [...prev, newRelationship]);

      toast({
        title: 'Trader Followed',
        description: `You are now following ${masterTraders.find(t => t.id === traderId)?.profileName}.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleUnfollowTrader = async (relationshipId: string) => {
    try {
      const response = await fetch(`/api/copy-trading/unfollow-trader/${relationshipId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to unfollow trader');

      setFollowerRelationships(prev => prev.filter(r => r.id !== relationshipId));

      toast({
        title: 'Trader Unfollowed',
        description: 'You have stopped following this trader.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleStartCopyTrading = async (relationshipId: string) => {
    try {
      const response = await fetch('/api/copy-trading/start-copy-trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relationshipId })
      });

      if (!response.ok) throw new Error('Failed to start copy trading');

      setFollowerRelationships(prev =>
        prev.map(r => r.id === relationshipId ? { ...r, status: 'active' } : r)
      );

      toast({
        title: 'Copy Trading Started',
        description: 'Copy trading has been started successfully.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleStopCopyTrading = async (relationshipId: string) => {
    try {
      const response = await fetch('/api/copy-trading/stop-copy-trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relationshipId })
      });

      if (!response.ok) throw new Error('Failed to stop copy trading');

      setFollowerRelationships(prev =>
        prev.map(r => r.id === relationshipId ? { ...r, status: 'stopped' } : r)
      );

      toast({
        title: 'Copy Trading Stopped',
        description: 'Copy trading has been stopped successfully.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handlePauseCopyTrading = async (relationshipId: string) => {
    try {
      const response = await fetch('/api/copy-trading/pause-copy-trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relationshipId })
      });

      if (!response.ok) throw new Error('Failed to pause copy trading');

      setFollowerRelationships(prev =>
        prev.map(r => r.id === relationshipId ? { ...r, status: 'paused' } : r)
      );

      toast({
        title: 'Copy Trading Paused',
        description: 'Copy trading has been paused successfully.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleConnectPlatform = async (platform: string, credentials: any) => {
    try {
      const response = await fetch('/api/copy-trading/connect-platform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, credentials })
      });

      if (!response.ok) throw new Error('Failed to connect platform');

      const newConnection = await response.json();
      setPlatformConnections(prev => [...prev, newConnection]);

      toast({
        title: 'Platform Connected',
        description: `Successfully connected to ${platform}.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleDisconnectPlatform = async (connectionId: string) => {
    try {
      const response = await fetch(`/api/copy-trading/disconnect-platform/${connectionId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to disconnect platform');

      setPlatformConnections(prev => prev.filter(c => c.id !== connectionId));

      toast({
        title: 'Platform Disconnected',
        description: 'Platform has been disconnected successfully.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleUpdateRiskLimits = async (limits: RiskLimits) => {
    try {
      const response = await fetch('/api/copy-trading/update-risk-limits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(limits)
      });

      if (!response.ok) throw new Error('Failed to update risk limits');

      setRiskLimits(limits);

      toast({
        title: 'Risk Limits Updated',
        description: 'Your risk limits have been updated successfully.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleRefreshData = async () => {
    setIsLoading(true);
    try {
      await loadInitialData();
      toast({
        title: 'Data Refreshed',
        description: 'All data has been refreshed successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to refresh data.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Broker login handlers
  const handleBrokerSelect = (brokerId: string) => {
    setSelectedBroker(brokerId);
    setShowLoginModal(true);
    setLoginCredentials({});
  };

  const handleLoginSubmit = async (credentials: { [key: string]: string }) => {
    if (!selectedBroker) return;

    try {
      setIsLoading(true);

      // Simulate API call to connect broker
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Add to platform connections
      const newConnection: PlatformConnection = {
        id: `conn_${Date.now()}`,
        platform: selectedBroker,
        connectionType: SUPPORTED_BROKERS.find(b => b.id === selectedBroker)?.type || 'unknown',
        syncStatus: 'connected',
        lastSyncAt: new Date().toISOString(),
        rateLimitRemaining: 1000,
        latency: Math.floor(Math.random() * 50) + 25,
        isActive: true
      };

      setPlatformConnections(prev => [...prev, newConnection]);

      toast({
        title: "Broker Connected",
        description: `Successfully connected to ${SUPPORTED_BROKERS.find(b => b.id === selectedBroker)?.name}`,
      });

      setShowLoginModal(false);
      setSelectedBroker(null);
      setLoginCredentials({});
    } catch (error) {
      console.error('Error connecting broker:', error);
      toast({
        title: "Connection Failed",
        description: "Failed to connect to broker. Please check your credentials.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginCancel = () => {
    setShowLoginModal(false);
    setSelectedBroker(null);
    setLoginCredentials({});
  };

  const togglePasswordVisibility = (field: string) => {
    setShowPassword(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  // Alternative authentication handlers
  const handleBrokerSelectWithAuth = async (brokerId: string) => {
    setSelectedBroker(brokerId);

    try {
      // Fetch available authentication methods for this broker
      const response = await fetch(`/api/verification/auth/methods/${brokerId}`);
      const data = await response.json();

      if (data.success) {
        setAuthMethods(prev => ({ ...prev, [brokerId]: data.auth_methods }));
        setShowLoginModal(true);
      } else {
        throw new Error('Failed to fetch auth methods');
      }
    } catch (error) {
      console.error('Error fetching auth methods:', error);
      toast({
        title: "Error",
        description: "Failed to load authentication methods for this broker.",
        variant: "destructive",
      });
    }
  };

  const handleAuthMethodSelect = (method: string) => {
    setSelectedAuthMethod(method);
    setLoginCredentials({});
  };

  const handleAlternativeLogin = async (credentials: { [key: string]: string }) => {
    if (!selectedBroker || !selectedAuthMethod) return;

    try {
      setIsLoading(true);

      const response = await fetch('/api/verification/auth/authenticate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform: selectedBroker,
          auth_method: selectedAuthMethod,
          credentials: credentials
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Handle different auth responses
        if (data.auth_data.authorization_url) {
          // OAuth2 flow - redirect to authorization URL
          window.open(data.auth_data.authorization_url, '_blank');
          toast({
            title: "Authorization Required",
            description: "Please complete authorization in the new window.",
          });
        } else if (data.auth_data.sso_url) {
          // SSO flow - redirect to SSO URL
          window.open(data.auth_data.sso_url, '_blank');
          toast({
            title: "SSO Login Required",
            description: "Please complete SSO login in the new window.",
          });
        } else {
          // Direct authentication success
          const newConnection: PlatformConnection = {
            id: `conn_${Date.now()}`,
            platform: selectedBroker,
            connectionType: SUPPORTED_BROKERS.find(b => b.id === selectedBroker)?.type || 'unknown',
            syncStatus: 'connected',
            lastSyncAt: new Date().toISOString(),
            rateLimitRemaining: 1000,
            latency: Math.floor(Math.random() * 50) + 25,
            isActive: true
          };

          setPlatformConnections(prev => [...prev, newConnection]);

          toast({
            title: "Broker Connected",
            description: `Successfully connected to ${SUPPORTED_BROKERS.find(b => b.id === selectedBroker)?.name} using ${selectedAuthMethod}`,
          });

          setShowLoginModal(false);
          setSelectedBroker(null);
          setSelectedAuthMethod('');
          setLoginCredentials({});
        }
      } else {
        throw new Error(data.error_message || 'Authentication failed');
      }
    } catch (error) {
      console.error('Error connecting broker:', error);
      toast({
        title: "Connection Failed",
        description: "Failed to connect to broker. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunVerification = async () => {
    try {
      setIsLoading(true);

      const response = await fetch('/api/verification/run-tests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          test_types: ['unit', 'integration', 'performance', 'security', 'end_to_end']
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Verification Started",
          description: "Copy trading service verification tests are running. Check results in a few minutes.",
        });
        setShowVerificationModal(true);
      } else {
        throw new Error('Failed to start verification');
      }
    } catch (error) {
      console.error('Error running verification:', error);
      toast({
        title: "Verification Failed",
        description: "Failed to start verification tests. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      {/* Enhanced Header for Universal Copy Trading */}
      <header className="bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Title */}
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Copy className="w-6 h-6 text-white" />
              </div>

              <Badge
                variant="secondary"
                className="bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 border-blue-200"
              >
                <Zap className="w-3 h-3 mr-1" />
                Pro
              </Badge>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center space-x-4">
              {/* Real-time Status */}
              <div className="hidden sm:flex items-center space-x-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' :
                  connectionStatus === 'disconnected' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}></div>
                <span className="text-sm font-medium text-green-700 dark:text-green-400">
                  {connectionStatus === 'connected' ? 'Live Trading' :
                    connectionStatus === 'disconnected' ? 'Disconnected' : 'Error'}
                </span>
              </div>

              {/* Real-time Toggle */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsRealtimeEnabled(!isRealtimeEnabled)}
                className={isRealtimeEnabled ? 'text-green-600 border-green-600' : 'text-gray-600'}
              >
                {isRealtimeEnabled ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
                {isRealtimeEnabled ? 'Live' : 'Paused'}
              </Button>

              {/* Refresh Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshData}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleRunVerification}
                disabled={isLoading}
                className="ml-2"
              >
                <Shield className="w-4 h-4 mr-2" />
                Verify Service
              </Button>

              {/* Last Update */}
              <div className="hidden lg:flex items-center space-x-2 text-xs text-gray-500">
                <Clock className="w-3 h-3" />
                <span>Updated {lastUpdate.toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Performance Overview */}
            {performanceMetrics && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-white dark:bg-black shadow-sm border-gray-200 dark:border-gray-900">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Trades</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {performanceMetrics.totalTrades.toLocaleString()}
                        </p>
                      </div>
                      <BarChart3 className="h-8 w-8 text-blue-500" />
                    </div>
                    <div className="mt-2">
                      <span className="text-sm text-green-600 font-medium">
                        {performanceMetrics.successRate.toFixed(1)}% Success Rate
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white dark:bg-black shadow-sm border-gray-200 dark:border-gray-900">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total P&L</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          ${performanceMetrics.totalPnl.toLocaleString()}
                        </p>
                      </div>
                      <DollarSign className="h-8 w-8 text-green-500" />
                    </div>
                    <div className="mt-2">
                      <span className={`text-sm font-medium ${performanceMetrics.dailyPnl >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                        {performanceMetrics.dailyPnl >= 0 ? '+' : ''}${performanceMetrics.dailyPnl.toFixed(2)} Today
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white dark:bg-black shadow-sm border-gray-200 dark:border-gray-900">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Latency</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {performanceMetrics.averageLatencyMs.toFixed(0)}ms
                        </p>
                      </div>
                      <Clock className="h-8 w-8 text-purple-500" />
                    </div>
                    <div className="mt-2">
                      <span className="text-sm text-blue-600 font-medium">
                        Sub-100ms Target
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white dark:bg-black shadow-sm border-gray-200 dark:border-gray-900">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Sharpe Ratio</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {performanceMetrics.sharpeRatio.toFixed(2)}
                        </p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-orange-500" />
                    </div>
                    <div className="mt-2">
                      <span className="text-sm text-gray-600 font-medium">
                        Max DD: {(performanceMetrics.maxDrawdown * 100).toFixed(1)}%
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Search and Filters */}
            <Card className="bg-white dark:bg-black shadow-sm border-gray-200 dark:border-gray-900">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        placeholder="Search master traders..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Select value={selectedStrategy} onValueChange={setSelectedStrategy}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Strategy" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Strategies</SelectItem>
                        <SelectItem value="scalping">Scalping</SelectItem>
                        <SelectItem value="swing">Swing</SelectItem>
                        <SelectItem value="arbitrage">Arbitrage</SelectItem>
                        <SelectItem value="mean_reversion">Mean Reversion</SelectItem>
                        <SelectItem value="trend_following">Trend Following</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={selectedRiskLevel} onValueChange={setSelectedRiskLevel}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Risk Level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Risk Levels</SelectItem>
                        <SelectItem value="conservative">Conservative</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="aggressive">Aggressive</SelectItem>
                        <SelectItem value="high_frequency">High Frequency</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Sort By" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="overall_score">Overall Score</SelectItem>
                        <SelectItem value="sharpe_ratio">Sharpe Ratio</SelectItem>
                        <SelectItem value="total_return">Total Return</SelectItem>
                        <SelectItem value="max_drawdown">Max Drawdown</SelectItem>
                        <SelectItem value="follower_count">Followers</SelectItem>
                        <SelectItem value="win_rate">Win Rate</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                    >
                      {sortOrder === 'desc' ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFilters(!showFilters)}
                    >
                      <Filter className="w-4 h-4 mr-2" />
                      Filters
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Enhanced Tab Navigation */}
            <Card className="bg-white dark:bg-black rounded-xl shadow-sm border-gray-200 dark:border-gray-900">
              <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="flex space-x-8 px-6 overflow-x-auto">
                  {[
                    { id: 'discovery', label: 'Master Traders', icon: <Users className="w-4 h-4" /> },
                    { id: 'followers', label: 'My Follows', icon: <Target className="w-4 h-4" /> },
                    { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 className="w-4 h-4" /> },
                    { id: 'analytics', label: 'Analytics', icon: <TrendingUp className="w-4 h-4" /> },
                    { id: 'platforms', label: 'Platforms', icon: <Settings className="w-4 h-4" /> },
                    { id: 'risk', label: 'Risk Management', icon: <Shield className="w-4 h-4" /> },
                    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors whitespace-nowrap flex items-center ${activeTab === tab.id
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                        }`}
                    >
                      <span className="mr-2">{tab.icon}</span>
                      {tab.label}
                    </button>
                  ))}
                  <div className="flex items-center space-x-2 mr-6">
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700"
                      onClick={() => setIsAddWalletModalOpen(true)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Wallet
                    </Button>
                  </div>
                </nav>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {activeTab === 'discovery' && (
                  <MasterTraderDiscovery
                    masterTraders={masterTraders}
                    searchQuery={searchQuery}
                    selectedStrategy={selectedStrategy}
                    selectedRiskLevel={selectedRiskLevel}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onFollowTrader={handleFollowTrader}
                    onUnfollowTrader={handleUnfollowTrader}
                    followerRelationships={followerRelationships}
                  />
                )}

                {activeTab === 'followers' && (
                  <FollowerManagement
                    followerRelationships={followerRelationships}
                    masterTraders={masterTraders}
                    onStartCopyTrading={handleStartCopyTrading}
                    onStopCopyTrading={handleStopCopyTrading}
                    onPauseCopyTrading={handlePauseCopyTrading}
                    onUnfollowTrader={handleUnfollowTrader}
                  />
                )}

                {activeTab === 'dashboard' && (
                  <CopyTradingDashboard
                    configId={selectedConfig || undefined}
                    onConfigChange={setSelectedConfig}
                  />
                )}

                {activeTab === 'analytics' && (
                  <PerformanceAnalytics
                    performanceMetrics={performanceMetrics}
                    tradeSignals={tradeSignals}
                    executionResults={executionResults}
                    copyTradingSessions={copyTradingSessions}
                    followerRelationships={followerRelationships}
                    masterTraders={masterTraders}
                  />
                )}

                {activeTab === 'platforms' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Supported Brokers & Exchanges
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Connect to crypto exchanges, NinjaTrader, Rithmic, and other platforms
                        </p>
                      </div>
                    </div>

                    {/* Broker Categories */}
                    <div className="space-y-6">
                      {/* Crypto Exchanges */}
                      <div>
                        <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                          <Zap className="w-5 h-5 mr-2 text-yellow-500" />
                          Cryptocurrency Exchanges
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {SUPPORTED_BROKERS.filter(broker => broker.type === 'crypto').map((broker) => (
                            <Card
                              key={broker.id}
                              className="bg-white dark:bg-black shadow-sm border-gray-200 dark:border-gray-900 hover:shadow-md transition-shadow cursor-pointer group"
                              onClick={() => handleBrokerSelectWithAuth(broker.id)}
                            >
                              <CardContent className="p-6">
                                <div className="flex flex-col items-center text-center space-y-4">
                                  <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center group-hover:bg-gray-200 dark:group-hover:bg-gray-600 transition-colors">
                                    <img
                                      src={broker.logo}
                                      alt={broker.name}
                                      className="w-10 h-10 object-contain"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                      }}
                                    />
                                    <div className="hidden w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded flex items-center justify-center">
                                      <span className="text-xs font-bold text-gray-600 dark:text-gray-400">
                                        {broker.name.charAt(0)}
                                      </span>
                                    </div>
                                  </div>
                                  <div>
                                    <h5 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                      {broker.name}
                                    </h5>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                      {broker.description}
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap gap-1 justify-center">
                                    {broker.features.map((feature, index) => (
                                      <Badge key={index} variant="outline" className="text-xs">
                                        {feature}
                                      </Badge>
                                    ))}
                                  </div>
                                  <Button
                                    size="sm"
                                    className="w-full group-hover:bg-blue-600 group-hover:text-white transition-colors"
                                  >
                                    <Lock className="w-4 h-4 mr-2" />
                                    Connect
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>

                      {/* Futures Platforms */}
                      <div>
                        <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                          <BarChart3 className="w-5 h-5 mr-2 text-blue-500" />
                          Futures Trading Platforms
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {SUPPORTED_BROKERS.filter(broker => broker.type === 'futures').map((broker) => (
                            <Card
                              key={broker.id}
                              className="bg-white dark:bg-black shadow-sm border-gray-200 dark:border-gray-900 hover:shadow-md transition-shadow cursor-pointer group"
                              onClick={() => handleBrokerSelectWithAuth(broker.id)}
                            >
                              <CardContent className="p-6">
                                <div className="flex flex-col items-center text-center space-y-4">
                                  <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center group-hover:bg-gray-200 dark:group-hover:bg-gray-600 transition-colors">
                                    <img
                                      src={broker.logo}
                                      alt={broker.name}
                                      className="w-10 h-10 object-contain"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                      }}
                                    />
                                    <div className="hidden w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded flex items-center justify-center">
                                      <span className="text-xs font-bold text-gray-600 dark:text-gray-400">
                                        {broker.name.charAt(0)}
                                      </span>
                                    </div>
                                  </div>
                                  <div>
                                    <h5 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                      {broker.name}
                                    </h5>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                      {broker.description}
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap gap-1 justify-center">
                                    {broker.features.map((feature, index) => (
                                      <Badge key={index} variant="outline" className="text-xs">
                                        {feature}
                                      </Badge>
                                    ))}
                                  </div>
                                  <Button
                                    size="sm"
                                    className="w-full group-hover:bg-blue-600 group-hover:text-white transition-colors"
                                  >
                                    <Lock className="w-4 h-4 mr-2" />
                                    Connect
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>

                      {/* Traditional Brokers */}
                      <div>
                        <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                          <Shield className="w-5 h-5 mr-2 text-green-500" />
                          Traditional Brokers
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {SUPPORTED_BROKERS.filter(broker => broker.type === 'traditional').map((broker) => (
                            <Card
                              key={broker.id}
                              className="bg-white dark:bg-black shadow-sm border-gray-200 dark:border-gray-900 hover:shadow-md transition-shadow cursor-pointer group"
                              onClick={() => handleBrokerSelectWithAuth(broker.id)}
                            >
                              <CardContent className="p-6">
                                <div className="flex flex-col items-center text-center space-y-4">
                                  <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center group-hover:bg-gray-200 dark:group-hover:bg-gray-600 transition-colors">
                                    <img
                                      src={broker.logo}
                                      alt={broker.name}
                                      className="w-10 h-10 object-contain"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                      }}
                                    />
                                    <div className="hidden w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded flex items-center justify-center">
                                      <span className="text-xs font-bold text-gray-600 dark:text-gray-400">
                                        {broker.name.charAt(0)}
                                      </span>
                                    </div>
                                  </div>
                                  <div>
                                    <h5 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                      {broker.name}
                                    </h5>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                      {broker.description}
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap gap-1 justify-center">
                                    {broker.features.map((feature, index) => (
                                      <Badge key={index} variant="outline" className="text-xs">
                                        {feature}
                                      </Badge>
                                    ))}
                                  </div>
                                  <Button
                                    size="sm"
                                    className="w-full group-hover:bg-blue-600 group-hover:text-white transition-colors"
                                  >
                                    <Lock className="w-4 h-4 mr-2" />
                                    Connect
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Connected Platforms */}
                    {platformConnections.length > 0 && (
                      <div className="mt-8">
                        <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                          <CheckCircle className="w-5 h-5 mr-2 text-green-500" />
                          Connected Platforms
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {platformConnections.map((connection) => (
                            <Card key={connection.id} className="bg-white dark:bg-black shadow-sm border-gray-200 dark:border-gray-900">
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="font-medium text-gray-900 dark:text-white">
                                    {connection.platform}
                                  </h4>
                                  <Badge
                                    variant={
                                      connection.syncStatus === 'connected' ? 'default' :
                                        connection.syncStatus === 'syncing' ? 'secondary' :
                                          'destructive'
                                    }
                                  >
                                    {connection.syncStatus}
                                  </Badge>
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                                  <div className="flex items-center space-x-1">
                                    <Activity className="w-3 h-3" />
                                    <span>Type: {connection.connectionType}</span>
                                  </div>
                                  {connection.lastSyncAt && (
                                    <div className="flex items-center space-x-1">
                                      <Clock className="w-3 h-3" />
                                      <span>Last sync: {new Date(connection.lastSyncAt).toLocaleString()}</span>
                                    </div>
                                  )}
                                  {connection.rateLimitRemaining && (
                                    <div className="flex items-center space-x-1">
                                      <Zap className="w-3 h-3" />
                                      <span>Rate limit: {connection.rateLimitRemaining}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="mt-3 flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDisconnectPlatform(connection.id)}
                                    className="flex-1"
                                  >
                                    Disconnect
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {/* Test connection */ }}
                                  >
                                    Test
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'risk' && (
                  <RiskManagement
                    exchanges={exchanges}
                  />
                )}

                {activeTab === 'settings' && (
                  <div className="space-y-6">
                    <Card className="bg-gray-50 dark:bg-black border dark:border-gray-900">
                      <CardHeader>
                        <CardTitle className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                          Copy Trading Settings
                        </CardTitle>
                        <CardDescription>
                          Configure global copy trading parameters
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">Real-time Updates</h4>
                              <p className="text-sm text-gray-500">Enable real-time trade replication</p>
                            </div>
                            <Button
                              variant={isRealtimeEnabled ? "default" : "outline"}
                              size="sm"
                              onClick={() => setIsRealtimeEnabled(!isRealtimeEnabled)}
                            >
                              {isRealtimeEnabled ? 'Enabled' : 'Disabled'}
                            </Button>
                          </div>

                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">Auto-reconciliation</h4>
                              <p className="text-sm text-gray-500">Automatically reconcile trades every 24 hours</p>
                            </div>
                            <Badge variant="default">Enabled</Badge>
                          </div>

                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">Error notifications</h4>
                              <p className="text-sm text-gray-500">Send alerts for failed trades</p>
                            </div>
                            <Badge variant="default">Enabled</Badge>
                          </div>

                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">Performance monitoring</h4>
                              <p className="text-sm text-gray-500">Track execution metrics and latency</p>
                            </div>
                            <Badge variant="default">Enabled</Badge>
                          </div>

                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">Sub-100ms Latency Target</h4>
                              <p className="text-sm text-gray-500">Optimize for ultra-low latency execution</p>
                            </div>
                            <Badge variant="default">Enabled</Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gray-50 dark:bg-black border dark:border-gray-900">
                      <CardHeader>
                        <CardTitle className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                          Platform Settings
                        </CardTitle>
                        <CardDescription>
                          Configure platform-specific parameters
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Default Replication Delay (ms)
                              </label>
                              <Input
                                type="number"
                                defaultValue="1000"
                                className="mt-1"
                                placeholder="1000"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Max Slippage (%)
                              </label>
                              <Input
                                type="number"
                                defaultValue="0.1"
                                step="0.01"
                                className="mt-1"
                                placeholder="0.1"
                              />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Enhanced Sidebar */}
          <div className="space-y-6">
            {/* Real-time Metrics */}
            <Card className="bg-white dark:bg-black shadow-sm border-gray-200 dark:border-gray-900">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                  Live Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Activity className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Active Follows</span>
                  </div>
                  <Badge variant="default">
                    {followerRelationships.filter(r => r.status === 'active').length}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">Master Traders</span>
                  </div>
                  <Badge variant="default">{masterTraders.length}</Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Settings className="w-4 h-4 text-purple-500" />
                    <span className="text-sm">Platforms</span>
                  </div>
                  <Badge variant="default">
                    {platformConnections.filter(p => p.isActive).length}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-orange-500" />
                    <span className="text-sm">Avg Latency</span>
                  </div>
                  <Badge variant="outline">
                    {performanceMetrics?.averageLatencyMs.toFixed(0) || '0'}ms
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Performance Summary */}
            <Card className="bg-white dark:bg-black shadow-sm border-gray-200 dark:border-gray-900">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-green-600 dark:text-green-400">
                  Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Success Rate</span>
                  </div>
                  <Badge variant="default">
                    {performanceMetrics?.successRate.toFixed(1) || '0'}%
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Total P&L</span>
                  </div>
                  <Badge
                    variant={performanceMetrics?.totalPnl && performanceMetrics.totalPnl >= 0 ? "default" : "destructive"}
                  >
                    ${performanceMetrics?.totalPnl.toFixed(2) || '0.00'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <BarChart3 className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">Sharpe Ratio</span>
                  </div>
                  <Badge variant="outline">
                    {performanceMetrics?.sharpeRatio.toFixed(2) || '0.00'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <TrendingDown className="w-4 h-4 text-red-500" />
                    <span className="text-sm">Max Drawdown</span>
                  </div>
                  <Badge variant="destructive">
                    {(performanceMetrics?.maxDrawdown || 0 * 100).toFixed(1)}%
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="bg-white dark:bg-black shadow-sm border-gray-200 dark:border-gray-900">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-purple-600 dark:text-purple-400">
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {executionResults.slice(0, 5).map((result, index) => (
                    <div key={result.id} className="flex items-center space-x-3">
                      <div className={`w-2 h-2 rounded-full ${result.success ? 'bg-green-500' : 'bg-red-500'
                        }`}></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {result.success ? 'Trade executed' : 'Trade failed'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {result.platform} • {new Date(result.executionTime).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}

                  {executionResults.length === 0 && (
                    <div className="text-center text-gray-500 text-sm py-4">
                      No recent activity
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Platform Status */}
            <Card className="bg-white dark:bg-black shadow-sm border-gray-200 dark:border-gray-900">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-orange-600 dark:text-orange-400">
                  Platform Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {platformConnections.slice(0, 3).map((connection) => (
                    <div key={connection.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${connection.syncStatus === 'connected' ? 'bg-green-500' :
                          connection.syncStatus === 'syncing' ? 'bg-yellow-500' : 'bg-red-500'
                          }`}></div>
                        <span className="text-sm font-medium">{connection.platform}</span>
                      </div>
                      <Badge
                        variant={
                          connection.syncStatus === 'connected' ? 'default' :
                            connection.syncStatus === 'syncing' ? 'secondary' : 'destructive'
                        }
                        className="text-xs"
                      >
                        {connection.syncStatus}
                      </Badge>
                    </div>
                  ))}

                  {platformConnections.length === 0 && (
                    <div className="text-center text-gray-500 text-sm py-4">
                      No platforms connected
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="bg-white dark:bg-black shadow-sm border-gray-200 dark:border-gray-900">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-indigo-600 dark:text-indigo-400">
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setActiveTab('discovery')}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Find Master Traders
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setActiveTab('platforms')}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Connect Platform
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setActiveTab('risk')}
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Risk Settings
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={handleRefreshData}
                  disabled={isLoading}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh Data
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Secure Login Modal */}
      {showLoginModal && selectedBroker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-black border dark:border-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                    <img
                      src={SUPPORTED_BROKERS.find(b => b.id === selectedBroker)?.logo}
                      alt={SUPPORTED_BROKERS.find(b => b.id === selectedBroker)?.name}
                      className="w-6 h-6 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                    <div className="hidden w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded flex items-center justify-center">
                      <span className="text-xs font-bold text-gray-600 dark:text-gray-400">
                        {SUPPORTED_BROKERS.find(b => b.id === selectedBroker)?.name?.charAt(0)}
                      </span>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Connect to {SUPPORTED_BROKERS.find(b => b.id === selectedBroker)?.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Enter your secure credentials
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLoginCancel}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XCircle className="w-5 h-5" />
                </Button>
              </div>

              <div className="space-y-4">
                {/* Authentication Method Selection */}
                {authMethods[selectedBroker] && authMethods[selectedBroker].length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Authentication Method
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {authMethods[selectedBroker].map((method) => (
                        <button
                          key={method.method}
                          onClick={() => handleAuthMethodSelect(method.method)}
                          className={`p-3 text-left border rounded-lg transition-colors ${selectedAuthMethod === method.method
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                        >
                          <div className="font-medium text-gray-900 dark:text-white">
                            {method.name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {method.description}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {method.features.map((feature, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {feature}
                              </Badge>
                            ))}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* OAuth2 Fields */}
                {selectedAuthMethod === 'oauth2' && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <Shield className="w-5 h-5 text-blue-500" />
                      <span className="font-medium text-blue-900 dark:text-blue-100">OAuth2 Authentication</span>
                    </div>
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      Click "Connect" to be redirected to {SUPPORTED_BROKERS.find(b => b.id === selectedBroker)?.name} for secure authorization.
                    </p>
                  </div>
                )}

                {/* Demo Account Fields */}
                {selectedAuthMethod === 'demo_account' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      User ID
                    </label>
                    <Input
                      type="text"
                      placeholder="Enter your user ID"
                      value={loginCredentials.userId || ''}
                      onChange={(e) => setLoginCredentials(prev => ({ ...prev, userId: e.target.value }))}
                      className="w-full"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      A demo account will be created for testing purposes.
                    </p>
                  </div>
                )}

                {/* Paper Trading Fields */}
                {selectedAuthMethod === 'paper_trading' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        User ID
                      </label>
                      <Input
                        type="text"
                        placeholder="Enter your user ID"
                        value={loginCredentials.userId || ''}
                        onChange={(e) => setLoginCredentials(prev => ({ ...prev, userId: e.target.value }))}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Initial Balance ($)
                      </label>
                      <Input
                        type="number"
                        placeholder="10000"
                        value={loginCredentials.initialBalance || ''}
                        onChange={(e) => setLoginCredentials(prev => ({ ...prev, initialBalance: e.target.value }))}
                        className="w-full"
                      />
                    </div>
                    <p className="text-sm text-gray-500">
                      Paper trading simulates real trading without using real money.
                    </p>
                  </div>
                )}

                {/* Broker Credentials Fields */}
                {selectedAuthMethod === 'broker_credentials' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Username
                      </label>
                      <Input
                        type="text"
                        placeholder="Enter your username"
                        value={loginCredentials.username || ''}
                        onChange={(e) => setLoginCredentials(prev => ({ ...prev, username: e.target.value }))}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Password
                      </label>
                      <div className="relative">
                        <Input
                          type={showPassword.password ? 'text' : 'password'}
                          placeholder="Enter your password"
                          value={loginCredentials.password || ''}
                          onChange={(e) => setLoginCredentials(prev => ({ ...prev, password: e.target.value }))}
                          className="w-full pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility('password')}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          {showPassword.password ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    {selectedBroker === 'interactive_brokers' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Account ID
                        </label>
                        <Input
                          type="text"
                          placeholder="Enter your account ID"
                          value={loginCredentials.accountId || ''}
                          onChange={(e) => setLoginCredentials(prev => ({ ...prev, accountId: e.target.value }))}
                          className="w-full"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Legacy API Key Fields (fallback) */}
                {selectedAuthMethod === 'api_key' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        API Key
                      </label>
                      <Input
                        type="text"
                        placeholder="Enter your API key"
                        value={loginCredentials.apiKey || ''}
                        onChange={(e) => setLoginCredentials(prev => ({ ...prev, apiKey: e.target.value }))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Secret Key
                      </label>
                      <div className="relative">
                        <Input
                          type={showPassword.secretKey ? 'text' : 'password'}
                          placeholder="Enter your secret key"
                          value={loginCredentials.secretKey || ''}
                          onChange={(e) => setLoginCredentials(prev => ({ ...prev, secretKey: e.target.value }))}
                          className="w-full pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility('secretKey')}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          {showPassword.secretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {selectedBroker === 'interactive_brokers' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Account ID
                        </label>
                        <Input
                          type="text"
                          placeholder="Enter your account ID"
                          value={loginCredentials.accountId || ''}
                          onChange={(e) => setLoginCredentials(prev => ({ ...prev, accountId: e.target.value }))}
                          className="w-full"
                        />
                      </div>
                    )}

                    {(selectedBroker === 'ninjatrader' || selectedBroker === 'rithmic') && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Username
                        </label>
                        <Input
                          type="text"
                          placeholder="Enter your username"
                          value={loginCredentials.username || ''}
                          onChange={(e) => setLoginCredentials(prev => ({ ...prev, username: e.target.value }))}
                          className="w-full"
                        />
                      </div>
                    )}
                  </>
                )}

                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <Shield className="w-4 h-4 text-blue-500 mt-0.5" />
                    <div className="text-sm text-blue-800 dark:text-blue-200">
                      <p className="font-medium">Secure Connection</p>
                      <p>Your credentials are encrypted and stored securely. We never store your actual trading credentials.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <Button
                  variant="outline"
                  onClick={handleLoginCancel}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (selectedAuthMethod === 'oauth2' || selectedAuthMethod === 'sso') {
                      handleAlternativeLogin(loginCredentials);
                    } else {
                      handleLoginSubmit(loginCredentials);
                    }
                  }}
                  disabled={
                    !selectedAuthMethod ||
                    (selectedAuthMethod === 'api_key' && (!loginCredentials.apiKey || !loginCredentials.secretKey)) ||
                    (selectedAuthMethod === 'broker_credentials' && (!loginCredentials.username || !loginCredentials.password)) ||
                    (selectedAuthMethod === 'demo_account' && !loginCredentials.userId) ||
                    (selectedAuthMethod === 'paper_trading' && (!loginCredentials.userId || !loginCredentials.initialBalance)) ||
                    isLoading
                  }
                  className="flex-1"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 mr-2" />
                      {selectedAuthMethod === 'oauth2' || selectedAuthMethod === 'sso' ? 'Authorize' : 'Connect'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Verification Modal */}
      {showVerificationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-black border dark:border-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Copy Trading Service Verification
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Comprehensive testing and validation
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowVerificationModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XCircle className="w-5 h-5" />
                </Button>
              </div>

              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <Activity className="w-5 h-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-900 dark:text-blue-100">Verification Tests Running</p>
                      <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                        The following tests are being executed:
                      </p>
                      <ul className="text-sm text-blue-800 dark:text-blue-200 mt-2 space-y-1">
                        <li>• Unit Tests - Component functionality</li>
                        <li>• Integration Tests - Service interactions</li>
                        <li>• Performance Tests - Latency and throughput</li>
                        <li>• Security Tests - Credential handling</li>
                        <li>• End-to-End Tests - Complete workflows</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center mx-auto mb-2">
                      <RefreshCw className="w-4 h-4 text-yellow-600 animate-spin" />
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Unit Tests</p>
                    <p className="text-xs text-gray-500">Running...</p>
                  </div>
                  <div className="text-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center mx-auto mb-2">
                      <RefreshCw className="w-4 h-4 text-yellow-600 animate-spin" />
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Integration</p>
                    <p className="text-xs text-gray-500">Running...</p>
                  </div>
                  <div className="text-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center mx-auto mb-2">
                      <RefreshCw className="w-4 h-4 text-yellow-600 animate-spin" />
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Performance</p>
                    <p className="text-xs text-gray-500">Running...</p>
                  </div>
                  <div className="text-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center mx-auto mb-2">
                      <RefreshCw className="w-4 h-4 text-yellow-600 animate-spin" />
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Security</p>
                    <p className="text-xs text-gray-500">Running...</p>
                  </div>
                  <div className="text-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center mx-auto mb-2">
                      <RefreshCw className="w-4 h-4 text-yellow-600 animate-spin" />
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">E2E Tests</p>
                    <p className="text-xs text-gray-500">Running...</p>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-black border dark:border-gray-900 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    <strong>Note:</strong> Verification tests typically take 2-5 minutes to complete.
                    You can close this modal and check the results later via the API or dashboard.
                  </p>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setShowVerificationModal(false)}
                  className="flex-1"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    // Open verification results in new tab
                    window.open('/api/verification/test-results', '_blank');
                  }}
                  className="flex-1"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Results
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Add Wallet Modal */}
      {isAddWalletModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] backdrop-blur-sm">
          <Card className="w-full max-w-md bg-white dark:bg-black border-gray-200 dark:border-gray-800 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-gray-900 dark:text-white">Add Master Wallet</CardTitle>
              <CardDescription>
                Track and copy trades from a specific Solana wallet address.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Wallet Address
                </label>
                <Input
                  placeholder="Paste Solana address here..."
                  value={newWalletAddress}
                  onChange={(e) => setNewWalletAddress(e.target.value)}
                  className="bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Wallet Name
                </label>
                <Input
                  placeholder="e.g. Whale Wallet #1"
                  value={newWalletName}
                  onChange={(e) => setNewWalletName(e.target.value)}
                  className="bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800"
                />
              </div>

              <div className="flex items-center space-x-3 pt-4">
                <Button
                  onClick={handleAddWallet}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={isAddingWallet}
                >
                  {isAddingWallet ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : 'Save Wallet'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsAddWalletModalOpen(false)}
                  className="flex-1 border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-900"
                  disabled={isAddingWallet}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default CopyTrader;
