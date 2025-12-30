import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Edit, RefreshCw, ExternalLink, Wallet, Trash2, Zap, Timer, DollarSign, Shield } from 'lucide-react';
import { useJupiterPrefetch } from '@/lib/jupiter-prefetch-service';
import { useTradingStore } from '@/stores/useTradingStore';
import { SlippageHandler } from '@/lib/slippage-handler';
import type { JupiterQuote } from '@/stores/useTradingStore';
import { startAutoFee, analyzeMevRisk, calculateOptimalFees, type MevMode } from '@/lib/mev-protection-service';
import { fetchTokenSecurity, fetchTopHolders, fetchTokenOverview } from '@/lib/birdeye-websocket-service';

export interface TradingStats {
  bought: number;
  sold: number;
  holding: number;
  pnl: number;
  pnlPercent: number;
}

interface TradingPanelProps {
  pair: string;
  tokenSymbol?: string;
  tokenAddress?: string; // Token mint address for Birdeye API
  currentPrice?: number;
  tradingStats?: TradingStats;
  onOrderSubmit?: (order: TradingOrder) => Promise<void>;
  onLimitOrderChange?: (mc: string | undefined) => void;
  theme?: 'dark' | 'light';
  className?: string;
}

export type OrderType = 'market' | 'limit' | 'snipe' | 'advanced';
export type OrderSide = 'buy' | 'sell';

export interface TradingOrder {
  pair: string;
  side: OrderSide;
  orderType: OrderType;
  amount: number;
  price?: number;
  stopLossPrice?: number;
  stopLossPercent?: number;
  takeProfitPrice?: number;
  takeProfitPercent?: number;
  slippageBps: number;
  priorityFee?: number;
  bribeFee?: number;
  // MEV Protection settings
  mevMode?: 'off' | 'reduced';
  customRpcUrl?: string;
  // Snipe-specific
  snipeAmount?: number;
  antiMev?: boolean;
  autoSell?: boolean;

  autoSellPercent?: number;
  // Advanced Strategy
  advancedStrategy?: boolean;
  tpOrders?: { percent: number; amount: number }[];
  slOrders?: { percent: number; amount: number }[];
}

const DEFAULT_AMOUNT_PRESETS = [0.01, 0.1, 1, 10];

export default function TradingPanel({
  pair,
  tokenSymbol = 'TOKEN',
  tokenAddress,
  currentPrice = 0,
  tradingStats,
  onOrderSubmit,
  onLimitOrderChange,
  theme = 'dark',
  className,
}: TradingPanelProps) {
  const { connected, publicKey } = useWallet();
  const { toast } = useToast();
  const isDark = theme === 'dark';

  const [side, setSide] = useState<OrderSide>('buy');
  const [orderType, setOrderType] = useState<OrderType>('market');
  const [amount, setAmount] = useState<string>('0.0');
  const [limitPrice, setLimitPrice] = useState<string>('');

  // Real-time limit order preview (Market Cap)
  useEffect(() => {
    if (orderType === 'limit') {
      onLimitOrderChange?.(limitPrice || undefined);
    } else {
      onLimitOrderChange?.(undefined);
    }
  }, [limitPrice, orderType, onLimitOrderChange]);
  const [slippage, setSlippage] = useState<number>(20); // 20%
  const [mevProtection, setMevProtection] = useState<number>(0.001);
  const [priorityFee, setPriorityFee] = useState<number>(0.01);
  const [briberyOff, setBriberyOff] = useState<boolean>(true);

  // Advanced Trading Strategy
  const [advancedStrategy, setAdvancedStrategy] = useState(false);
  const [tpOrders, setTpOrders] = useState<{ percent: number; amount: number }[]>([]);
  const [slOrders, setSlOrders] = useState<{ percent: number; amount: number }[]>([]);
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Trading Settings Dropdown
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'buy' | 'sell'>('buy');
  const [showAutoFeeTooltip, setShowAutoFeeTooltip] = useState(false);

  // Editable amount presets
  const [amountPresets, setAmountPresets] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('trading_amount_presets');
      if (saved) return JSON.parse(saved);
    } catch (e) { }
    return DEFAULT_AMOUNT_PRESETS;
  });
  const [isEditingPresets, setIsEditingPresets] = useState(false);
  const [editingPresetIndex, setEditingPresetIndex] = useState<number | null>(null);
  const [isEditingAmount, setIsEditingAmount] = useState(false);

  // Separate settings for Buy and Sell - load from localStorage
  const [buySettings, setBuySettings] = useState(() => {
    try {
      const saved = localStorage.getItem('trading_buy_settings');
      if (saved) return JSON.parse(saved);
    } catch (e) { }
    return {
      slippage: '25',
      priorityFee: '0.04',
      bribeAmount: '0.005',
      maxFee: '0.1',
      autoFee: false,
    };
  });
  const [sellSettings, setSellSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('trading_sell_settings');
      if (saved) return JSON.parse(saved);
    } catch (e) { }
    return {
      slippage: '20',
      priorityFee: '0.01',
      bribeAmount: '0.002',
      maxFee: '0.1',
      autoFee: false,
    };
  });

  // Persist settings to localStorage
  useEffect(() => {
    localStorage.setItem('trading_buy_settings', JSON.stringify(buySettings));
  }, [buySettings]);

  useEffect(() => {
    localStorage.setItem('trading_sell_settings', JSON.stringify(sellSettings));
  }, [sellSettings]);

  // Get current settings based on active tab
  const currentSettings = settingsTab === 'buy' ? buySettings : sellSettings;
  const setCurrentSettings = settingsTab === 'buy' ? setBuySettings : setSellSettings;

  // Sync settingsTab with side when side changes (clicking Buy/Sell button)
  useEffect(() => {
    setSettingsTab(side);
  }, [side]);

  const [mevMode, setMevMode] = useState<'off' | 'reduced'>(() => {
    try {
      const saved = localStorage.getItem('trading_mev_mode');
      if (saved === 'off' || saved === 'reduced') return saved;
    } catch (e) { }
    return 'off';
  });
  const [rpcUrl, setRpcUrl] = useState(() => {
    try {
      return localStorage.getItem('trading_rpc_url') || '';
    } catch (e) { }
    return '';
  });
  const [showMevTooltip, setShowMevTooltip] = useState(false);

  // Persist MEV mode and RPC URL
  useEffect(() => {
    localStorage.setItem('trading_mev_mode', mevMode);
  }, [mevMode]);

  useEffect(() => {
    localStorage.setItem('trading_rpc_url', rpcUrl);
  }, [rpcUrl]);

  // Persist amount presets when saved (not during editing)
  useEffect(() => {
    if (!isEditingPresets) {
      localStorage.setItem('trading_amount_presets', JSON.stringify(amountPresets));
    }
  }, [amountPresets, isEditingPresets]);

  // Auto-fee integration: Update fees in real-time based on network conditions
  useEffect(() => {
    // Only run auto-fee when it's enabled for the current settings tab
    const activeSettings = settingsTab === 'buy' ? buySettings : sellSettings;
    const setActiveSettings = settingsTab === 'buy' ? setBuySettings : setSellSettings;

    if (!activeSettings.autoFee) return;

    const cleanup = startAutoFee(mevMode as MevMode, (fees) => {
      setActiveSettings(prev => ({
        ...prev,
        priorityFee: fees.priorityFee,
        bribeAmount: fees.bribeFee,
      }));
    });

    return cleanup;
  }, [settingsTab, buySettings.autoFee, sellSettings.autoFee, mevMode]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTokenInfo, setShowTokenInfo] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState(1);

  // Volume stats
  const [volumeStats, setVolumeStats] = useState({
    fiveMinVol: 6.04,
    buys: 591,
    buysUsd: 2.42,
    sells: 44,
    sellsUsd: 3.62,
    netVol: -1.21
  });

  // Token info stats - defaults to zero (populated via Birdeye API)
  const [tokenInfo, setTokenInfo] = useState({
    tax: 0,
    top10H: 0,
    devH: 0,
    snipersH: 0,
    insiders: 0,
    bundlers: 0,
    lpBurned: 0,
    holders: 0,
    dexPaid: false,
    contractAddress: '',
    deployerAddress: ''
  });

  // Fetch token info from Birdeye when tokenAddress changes
  useEffect(() => {
    if (!tokenAddress) {
      console.log('🔍 TradingPanel: No tokenAddress provided');
      return;
    }

    console.log('🔍 TradingPanel: Fetching token info for:', tokenAddress);

    const fetchData = async () => {
      try {
        // Fetch token security data
        console.log('🔒 Fetching token security...');
        const securityData = await fetchTokenSecurity(tokenAddress);
        console.log('🔒 Security data received:', securityData);

        // Fetch token overview for holders count
        console.log('📊 Fetching token overview...');
        const overviewData = await fetchTokenOverview(tokenAddress);
        console.log('📊 Overview data received:', overviewData);

        setTokenInfo(prev => ({
          ...prev,
          contractAddress: tokenAddress.length > 20
            ? `${tokenAddress.slice(0, 8)}...${tokenAddress.slice(-4)}`
            : tokenAddress,
          deployerAddress: securityData?.creatorAddress
            ? `${securityData.creatorAddress.slice(0, 6)}...${securityData.creatorAddress.slice(-4)}`
            : '',
          top10H: securityData?.top10HolderPercent || 0,
          lpBurned: securityData?.lpBurned || 0,
          tax: securityData?.transferFeeData?.transferFeeBasisPoints
            ? securityData.transferFeeData.transferFeeBasisPoints / 100
            : 0,
          // Holders from overview if available
          holders: (overviewData as any)?.holders || 0,
          // dexPaid: check if token has logo
          dexPaid: !!(overviewData?.logoURI),
        }));
        console.log('✅ Token info updated');
      } catch (error) {
        console.error('❌ Error fetching token info:', error);
      }
    };

    fetchData();
  }, [tokenAddress]);

  // Function to manually refresh token info
  const refreshTokenInfo = useCallback(async () => {
    if (!tokenAddress) return;
    console.log('🔄 Manually refreshing token info for:', tokenAddress);

    try {
      const securityData = await fetchTokenSecurity(tokenAddress);
      const overviewData = await fetchTokenOverview(tokenAddress);

      setTokenInfo(prev => ({
        ...prev,
        contractAddress: tokenAddress.length > 20
          ? `${tokenAddress.slice(0, 8)}...${tokenAddress.slice(-4)}`
          : tokenAddress,
        deployerAddress: securityData?.creatorAddress
          ? `${securityData.creatorAddress.slice(0, 6)}...${securityData.creatorAddress.slice(-4)}`
          : '',
        top10H: securityData?.top10HolderPercent || 0,
        lpBurned: securityData?.lpBurned || 0,
        tax: securityData?.transferFeeData?.transferFeeBasisPoints
          ? securityData.transferFeeData.transferFeeBasisPoints / 100
          : 0,
        holders: (overviewData as any)?.holders || 0,
        dexPaid: !!(overviewData?.logoURI),
      }));
      console.log('✅ Token info refreshed');
    } catch (error) {
      console.error('❌ Error refreshing token info:', error);
    }
  }, [tokenAddress]);

  const handlePresetAmount = (preset: number) => {
    setAmount(preset.toString());
  };

  const handleSubmit = async () => {
    if (!connected) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to place orders.',
        variant: 'destructive',
      });
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid amount.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Use the correct settings based on trade side
      const activeSettings = side === 'buy' ? buySettings : sellSettings;

      // Analyze MEV risk before submitting (for market orders)
      let useMevProtection = mevMode === 'reduced';
      if (orderType === 'market' && pair) {
        try {
          const tokenMint = pair.split('/')[0]; // Extract token mint from pair
          const mevAnalysis = await analyzeMevRisk({
            tokenMint,
            amountLamports: Math.round(parseFloat(amount) * 1e9),
            isBuy: side === 'buy',
          });

          // Show MEV recommendation toast
          if (!mevAnalysis.isSafe) {
            toast({
              title: `MEV Risk: ${mevAnalysis.riskLevel.toUpperCase()}`,
              description: mevAnalysis.recommendation,
              variant: mevAnalysis.riskLevel === 'critical' ? 'destructive' : 'default',
            });
            useMevProtection = mevAnalysis.useJitoBundle || mevMode === 'reduced';
          }
        } catch (e) {
          console.warn('MEV analysis failed, proceeding with current settings');
        }
      }

      const order: TradingOrder = {
        pair,
        side,
        orderType,
        amount: parseFloat(amount),
        price: orderType === 'limit' ? parseFloat(limitPrice) : undefined,
        slippageBps: Math.round(parseFloat(activeSettings.slippage) * 100),
        priorityFee: parseFloat(activeSettings.priorityFee) || 0,
        bribeFee: parseFloat(activeSettings.bribeAmount) || 0,
        mevMode: mevMode,
        customRpcUrl: rpcUrl || undefined,
        antiMev: useMevProtection,
        advancedStrategy: advancedStrategy,
        tpOrders: advancedStrategy ? tpOrders : undefined,
        slOrders: advancedStrategy ? slOrders : undefined,
      };

      if (onOrderSubmit) {
        await onOrderSubmit(order);
      }

      toast({
        title: 'Order Submitted',
        description: `${side.toUpperCase()} ${amount} SOL @ ${activeSettings.slippage}% slippage${useMevProtection ? ' (MEV Protected)' : ''}`,
      });
    } catch (error: any) {
      toast({
        title: 'Order Failed',
        description: error.message || 'Failed to submit order',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isBuy = side === 'buy';

  return (
    <div className={cn(
      "flex flex-col h-full",
      isDark ? "bg-[#0a0a0a]" : "bg-white",
      className
    )}>
      {/* Volume Stats Bar */}
      <div className="p-2 border-b border-neutral-800">
        <div className="grid grid-cols-4 gap-1 mb-1.5">
          <div className="text-center">
            <div className="text-[8px] text-neutral-500 uppercase">5m Vol</div>
            <div className="text-[10px] font-medium text-white pnl-font">${volumeStats.fiveMinVol}K</div>
          </div>
          <div className="text-center">
            <div className="text-[8px] text-neutral-500 uppercase">Buys</div>
            <div className="text-[10px] font-medium text-neutral-300">{volumeStats.buys}/${volumeStats.buysUsd}K</div>
          </div>
          <div className="text-center">
            <div className="text-[8px] text-neutral-500 uppercase">Sells</div>
            <div className="text-[10px] font-medium text-neutral-500">{volumeStats.sells}/${volumeStats.sellsUsd}K</div>
          </div>
          <div className="text-center">
            <div className="text-[8px] text-neutral-500 uppercase">Net Vol.</div>
            <div className={cn("text-[10px] font-medium", volumeStats.netVol >= 0 ? "text-neutral-300" : "text-neutral-500")}>
              {volumeStats.netVol >= 0 ? '+' : '-'}${Math.abs(volumeStats.netVol)}K
            </div>
          </div>
        </div>
        {/* Buy/Sell Progress Bar */}
        {(() => {
          const totalTrades = volumeStats.buys + volumeStats.sells;
          const buyPercent = totalTrades > 0 ? (volumeStats.buys / totalTrades) * 100 : 50;
          return (
            <div className="h-1.5 bg-neutral-700 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-neutral-300"
                style={{ width: `${buyPercent}%` }}
              />
              <div
                className="h-full bg-neutral-600"
                style={{ width: `${100 - buyPercent}%` }}
              />
            </div>
          );
        })()}
      </div>

      {/* Buy/Sell Toggle */}
      <div className="p-3">
        <div className="flex gap-2">
          <button
            onClick={() => setSide('buy')}
            className={cn(
              "flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all",
              isBuy
                ? "bg-neutral-600 text-white"
                : "bg-transparent text-neutral-500 hover:text-neutral-300"
            )}
          >
            Buy
          </button>
          <button
            onClick={() => setSide('sell')}
            className={cn(
              "flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all",
              !isBuy
                ? "bg-neutral-500 text-white"
                : "bg-transparent text-neutral-500 hover:text-neutral-300"
            )}
          >
            Sell
          </button>
          <button
            onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
            className="p-2.5 text-neutral-500 hover:text-neutral-300"
          >
            <ChevronDown className={cn("w-4 h-4 transition-transform", showSettingsDropdown && "rotate-180")} />
          </button>
        </div>
      </div>

      {/* Expandable Settings Panel */}
      {showSettingsDropdown && (
        <div className="mx-3 mb-3 bg-[#111111] border border-neutral-800 rounded-xl overflow-hidden">
          {/* Buy/Sell Settings Tabs */}
          <div className="flex border-b border-neutral-700">
            <button
              onClick={() => setSettingsTab('buy')}
              className={cn(
                "flex-1 py-2.5 text-sm font-medium transition-colors",
                settingsTab === 'buy'
                  ? "bg-emerald-600 text-white"
                  : "text-neutral-400 hover:text-white"
              )}
            >
              Buy settings
            </button>
            <button
              onClick={() => setSettingsTab('sell')}
              className={cn(
                "flex-1 py-2.5 text-sm font-medium transition-colors",
                settingsTab === 'sell'
                  ? "bg-neutral-600 text-white"
                  : "text-neutral-400 hover:text-white"
              )}
            >
              Sell settings
            </button>
          </div>

          {/* Settings Content */}
          <div className="p-3 space-y-3">
            {/* Slippage, Priority, Bribe Row */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[#0a0a0a] border border-neutral-700 rounded-lg p-2 flex flex-col items-center justify-center min-h-[60px]">
                <div className="flex items-baseline justify-center gap-0.5">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={currentSettings.slippage}
                    onChange={(e) => setCurrentSettings(prev => ({ ...prev, slippage: e.target.value }))}
                    className="w-10 bg-transparent text-white text-lg font-medium text-center border-none outline-none"
                  />
                  <span className="text-neutral-500 text-sm">%</span>
                </div>
                <div className="text-[9px] text-neutral-500 mt-1 tracking-wider">
                  SLIPPAGE
                </div>
              </div>
              <div className="bg-[#0a0a0a] border border-neutral-700 rounded-lg p-2 flex flex-col items-center justify-center min-h-[60px]">
                <input
                  type="text"
                  inputMode="decimal"
                  value={currentSettings.priorityFee}
                  onChange={(e) => setCurrentSettings(prev => ({ ...prev, priorityFee: e.target.value }))}
                  className="w-full bg-transparent text-white text-lg font-medium text-center border-none outline-none"
                />
                <div className="text-[9px] text-neutral-500 mt-1 tracking-wider">
                  PRIORITY
                </div>
              </div>
              <div className="bg-[#0a0a0a] border border-neutral-700 rounded-lg p-2 flex flex-col items-center justify-center min-h-[60px]">
                <input
                  type="text"
                  inputMode="decimal"
                  value={currentSettings.bribeAmount}
                  onChange={(e) => setCurrentSettings(prev => ({ ...prev, bribeAmount: e.target.value }))}
                  className="w-full bg-transparent text-white text-lg font-medium text-center border-none outline-none"
                />
                <div className="text-[9px] text-neutral-500 mt-1 tracking-wider">
                  BRIBE
                </div>
              </div>
            </div>

            {/* Auto Fee Row - Compact */}
            <div
              className="flex items-center gap-2 relative"
              onMouseEnter={() => setShowAutoFeeTooltip(true)}
              onMouseLeave={() => setShowAutoFeeTooltip(false)}
            >
              <button
                onClick={() => setCurrentSettings(prev => ({ ...prev, autoFee: !prev.autoFee }))}
                className={cn(
                  "w-4 h-4 rounded border-2 transition-colors flex-shrink-0",
                  currentSettings.autoFee
                    ? "bg-purple-500 border-purple-500"
                    : "border-neutral-600 bg-transparent"
                )}
              />
              <span className="text-xs text-neutral-300">Auto Fee</span>
              <div className="flex-1 bg-[#0a0a0a] border border-neutral-700 rounded-lg px-1.5 py-1 flex items-center gap-1">
                <span className="text-neutral-500 text-[10px]">MAX FEE</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={currentSettings.maxFee}
                  onChange={(e) => setCurrentSettings(prev => ({ ...prev, maxFee: e.target.value }))}
                  className="flex-1 bg-transparent text-white text-[10px] text-right border-none outline-none w-8"
                />
              </div>
              {/* Auto Fee Tooltip */}
              {showAutoFeeTooltip && (
                <div className="absolute bottom-full right-0 mb-2 w-64 bg-[#1a1a1a] border border-neutral-700 rounded-lg p-3 shadow-xl z-50">
                  <div className="text-xs text-neutral-300">
                    Automatically adjusts the priority and bribe fees in real time based on network conditions. Locked upon order creation for limit orders.
                  </div>
                </div>
              )}
            </div>

            {/* MEV Mode Row - Only Off and Red options */}
            <div className="flex items-center gap-2 relative">
              <span className="text-xs text-neutral-300">MEV Mode</span>
              <div
                className="relative cursor-pointer"
                onMouseEnter={() => setShowMevTooltip(true)}
                onMouseLeave={() => setShowMevTooltip(false)}
              >
                <svg className="w-3.5 h-3.5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <circle cx="12" cy="12" r="10" strokeWidth="2" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 16v-4m0-4h.01" />
                </svg>
                {/* MEV Tooltip */}
                {showMevTooltip && (
                  <div className="absolute bottom-full right-0 mb-2 w-64 bg-[#1a1a1a] border border-neutral-700 rounded-lg p-3 shadow-xl z-50">
                    <div className="space-y-3 text-xs">
                      <div>
                        <div className="text-white font-medium">Off</div>
                        <div className="text-neutral-400">Send trades as fast as possible to all Solana validators</div>
                      </div>
                      <div>
                        <div className="text-white font-medium">Reduced</div>
                        <div className="text-neutral-400">Avoid sending transactions to blacklisted validators to reduce chances of MEV attack</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 ml-auto">
                <button
                  onClick={() => setMevMode('off')}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-lg transition-colors",
                    mevMode === 'off'
                      ? "bg-red-500 text-white"
                      : "text-neutral-500 hover:text-white"
                  )}
                >
                  Off
                </button>
                <button
                  onClick={() => setMevMode('reduced')}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-lg transition-colors",
                    mevMode === 'reduced'
                      ? "bg-neutral-600 text-white"
                      : "text-neutral-500 hover:text-white"
                  )}
                >
                  Red.
                </button>
              </div>
            </div>

            {/* RPC Row */}
            <div className="bg-[#0a0a0a] border border-neutral-700 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-neutral-500 text-sm">RPC</span>
                <input
                  type="text"
                  value={rpcUrl}
                  onChange={(e) => setRpcUrl(e.target.value)}
                  className="flex-1 bg-transparent text-white text-sm border-none outline-none"
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Type Tabs */}
      <div className="flex items-center justify-between px-3 pb-2 border-b border-neutral-800">
        <div className="flex items-center gap-1">
          {(['market', 'limit'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setOrderType(type)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize",
                orderType === type
                  ? "text-white border-b-2 border-neutral-400"
                  : "text-neutral-500 hover:text-neutral-300"
              )}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Amount Section */}
      <div className="p-3 space-y-3 overflow-y-auto flex-1">
        {/* Amount Label & Input */}
        <div className="bg-[#111111] rounded-lg p-3 border border-neutral-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-400 uppercase font-semibold">Amount</span>
              {isEditingAmount ? (
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onBlur={() => setIsEditingAmount(false)}
                  onKeyDown={(e) => e.key === 'Enter' && setIsEditingAmount(false)}
                  autoFocus
                  className="bg-transparent text-white font-medium w-20 outline-none border-b border-neutral-500 focus:border-neutral-300 no-spinner"
                  step="0.001"
                  min="0"
                />
              ) : (
                <span
                  className="text-white font-medium cursor-pointer hover:text-neutral-300 transition-colors"
                  onClick={() => setIsEditingAmount(true)}
                  title="Click to edit amount"
                >
                  {amount}
                </span>
              )}
            </div>
            <img src="/images/solana.svg" alt="SOL" className="w-4 h-4" />
          </div>

          {/* Amount Presets */}
          <div className="flex items-center gap-2">
            {amountPresets.map((preset, index) => (
              isEditingPresets ? (
                <input
                  key={index}
                  type="number"
                  value={preset}
                  onChange={(e) => {
                    const newValue = parseFloat(e.target.value) || 0;
                    setAmountPresets(prev => {
                      const updated = [...prev];
                      updated[index] = newValue;
                      return updated;
                    });
                  }}
                  className="flex-1 py-2 text-xs font-medium rounded-md transition-colors border bg-[#0a0a0a] text-white border-neutral-600 text-center outline-none focus:border-neutral-400 no-spinner w-full"
                  step="0.01"
                  min="0"
                />
              ) : (
                <button
                  key={index}
                  onClick={() => handlePresetAmount(preset)}
                  className={cn(
                    "flex-1 py-2 text-xs font-medium rounded-md transition-colors border",
                    amount === preset.toString()
                      ? "bg-neutral-700 text-white border-neutral-600"
                      : "bg-[#0a0a0a] text-neutral-400 border-neutral-800 hover:border-neutral-600"
                  )}
                >
                  {preset}
                </button>
              )
            ))}
            <button
              onClick={() => setIsEditingPresets(!isEditingPresets)}
              className={cn(
                "p-2 border rounded-md transition-all duration-300",
                isEditingPresets
                  ? "text-white border-neutral-400 bg-neutral-700 animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.3)]"
                  : "text-neutral-500 hover:text-neutral-300 border-neutral-800 hover:border-neutral-600"
              )}
              title={isEditingPresets ? "Click to save presets" : "Click to edit presets"}
            >
              <Edit className={cn("w-3 h-3 transition-transform duration-300", isEditingPresets && "rotate-12")} />
            </button>
          </div>
        </div>

        {/* Quick Settings Row - Shows settings based on current trade side */}
        {(() => {
          const activeDisplaySettings = side === 'buy' ? buySettings : sellSettings;
          return (
            <div className="flex items-center gap-3 text-[10px] flex-wrap">
              <div
                className="flex items-center gap-0.5 cursor-pointer relative group"
                title="Slippage"
              >
                <Zap className="w-2.5 h-2.5 text-neutral-500" />
                <span className="text-white">{activeDisplaySettings.slippage}%</span>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-neutral-800 text-white text-[9px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  Slippage
                </div>
              </div>
              <span className="text-neutral-600">|</span>
              <div
                className="flex items-center gap-0.5 cursor-pointer relative group"
                title="Priority Fee"
              >
                <Timer className="w-2.5 h-2.5 text-neutral-500" />
                <span className="text-neutral-400">{activeDisplaySettings.priorityFee}</span>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-neutral-800 text-white text-[9px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  Priority Fee
                </div>
              </div>
              <span className="text-neutral-600">|</span>
              <div
                className="flex items-center gap-0.5 cursor-pointer relative group"
                title="Bribe Fee"
              >
                <DollarSign className="w-2.5 h-2.5 text-neutral-500" />
                <span className="text-neutral-400">{activeDisplaySettings.bribeAmount}</span>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-neutral-800 text-white text-[9px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  Bribe Fee
                </div>
              </div>
              <span className="text-neutral-600">|</span>
              <div
                className="flex items-center gap-0.5 cursor-pointer relative group"
                title="MEV Shield"
              >
                <Shield className="w-2.5 h-2.5 text-neutral-500" />
                <span className="text-neutral-400">{mevMode === 'reduced' ? 'On' : 'Off'}</span>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-neutral-800 text-white text-[9px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  MEV Shield
                </div>
              </div>
            </div>
          );
        })()}

        {/* Limit Price (for Limit orders) */}
        {orderType === 'limit' && (
          <div className="bg-[#111111] rounded-lg p-3 border border-neutral-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-neutral-400 uppercase font-semibold">Market Cap</span>
            </div>
            <Input
              type="number"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              placeholder="0"
              className="bg-[#0a0a0a] border-neutral-800 text-white text-right no-spinner"
            />
          </div>
        )}

        {/* Advanced Trading Strategy - Hidden in Limit Mode and for Sell orders */}
        {orderType !== 'limit' && side === 'buy' && (
          <div className="space-y-3">
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => setAdvancedStrategy(!advancedStrategy)}
            >
              {/* Custom filled checkbox without checkmark */}
              <div
                className={cn(
                  "w-4 h-4 rounded border-2 transition-colors",
                  advancedStrategy
                    ? "bg-purple-500 border-purple-500"
                    : "border-neutral-600 bg-transparent"
                )}
              />
              <span className="text-xs text-neutral-300">
                Advanced Trading Strategy
              </span>
            </div>


            {/* TP/SL Orders when enabled */}
            {advancedStrategy && (
              <div className="space-y-2 pl-1">
                {/* Take Profit Orders */}
                {tpOrders.map((order, index) => (
                  <div key={`tp-${index}`} className="flex items-center gap-2">
                    {/* Percent Input Card */}
                    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-[#111111] border border-neutral-800 rounded-lg flex-1 min-w-0">
                      <span className="text-emerald-400 text-xs">↑</span>
                      <span className="text-[10px] text-neutral-400 font-medium">TP</span>
                      <input
                        type="number"
                        value={order.percent}
                        onChange={(e) => {
                          const newOrders = [...tpOrders];
                          newOrders[index].percent = parseFloat(e.target.value) || 0;
                          setTpOrders(newOrders);
                        }}
                        className="w-full min-w-[30px] bg-transparent text-white text-xs text-center border-none outline-none no-spinner"
                        placeholder="0"
                      />
                      <span className="text-[10px] text-neutral-500">%</span>
                    </div>
                    {/* Amount Input Card */}
                    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-[#111111] border border-neutral-800 rounded-lg flex-1 min-w-0">
                      <span className="text-[10px] text-neutral-500">Amt</span>
                      <input
                        type="number"
                        value={order.amount}
                        onChange={(e) => {
                          const newOrders = [...tpOrders];
                          newOrders[index].amount = parseFloat(e.target.value) || 0;
                          setTpOrders(newOrders);
                        }}
                        className="w-full min-w-[30px] bg-transparent text-white text-xs text-center border-none outline-none no-spinner"
                        placeholder="0"
                      />
                      <span className="text-[10px] text-neutral-500">%</span>
                    </div>
                    <button
                      onClick={() => setTpOrders(tpOrders.filter((_, i) => i !== index))}
                      className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {/* Stop Loss Orders */}
                {slOrders.map((order, index) => (
                  <div key={`sl-${index}`} className="flex items-center gap-2">
                    {/* Percent Input Card */}
                    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-[#111111] border border-neutral-800 rounded-lg flex-1 min-w-0">
                      <span className="text-red-400 text-xs">↓</span>
                      <span className="text-[10px] text-neutral-400 font-medium">SL</span>
                      <input
                        type="number"
                        value={order.percent}
                        onChange={(e) => {
                          const newOrders = [...slOrders];
                          newOrders[index].percent = parseFloat(e.target.value) || 0;
                          setSlOrders(newOrders);
                        }}
                        className="w-full min-w-[30px] bg-transparent text-white text-xs text-center border-none outline-none no-spinner"
                        placeholder="0"
                      />
                      <span className="text-[10px] text-neutral-500">%</span>
                    </div>
                    {/* Amount Input Card */}
                    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-[#111111] border border-neutral-800 rounded-lg flex-1 min-w-0">
                      <span className="text-[10px] text-neutral-500">Amt</span>
                      <input
                        type="number"
                        value={order.amount}
                        onChange={(e) => {
                          const newOrders = [...slOrders];
                          newOrders[index].amount = parseFloat(e.target.value) || 0;
                          setSlOrders(newOrders);
                        }}
                        className="w-full min-w-[30px] bg-transparent text-white text-xs text-center border-none outline-none no-spinner"
                        placeholder="0"
                      />
                      <span className="text-[10px] text-neutral-500">%</span>
                    </div>
                    <button
                      onClick={() => setSlOrders(slOrders.filter((_, i) => i !== index))}
                      className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {/* Add Button with Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowAddMenu(!showAddMenu)}
                    className="flex items-center justify-between w-full px-3 py-2 text-purple-500 hover:bg-neutral-800 rounded-lg transition-colors"
                  >
                    <span className="text-sm font-medium">Add</span>
                    <span className="text-lg">+</span>
                  </button>

                  {/* Dropdown Menu */}
                  {showAddMenu && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#0a0a0a] border border-neutral-700 rounded-lg shadow-xl z-50 overflow-hidden">
                      <button
                        onClick={() => {
                          setTpOrders([...tpOrders, { percent: 0, amount: 0 }]);
                          setShowAddMenu(false);
                        }}
                        className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-neutral-800 transition-colors"
                      >
                        <span className="text-neutral-400">↑</span>
                        <span className="text-sm text-neutral-300">Take Profit</span>
                      </button>
                      <button
                        onClick={() => {
                          setSlOrders([...slOrders, { percent: 0, amount: 0 }]);
                          setShowAddMenu(false);
                        }}
                        className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-neutral-800 transition-colors"
                      >
                        <span className="text-neutral-500">↓</span>
                        <span className="text-sm text-neutral-300">Stop Loss</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !connected}
          variant="ghost"
          className={cn(
            "w-full py-6 text-base font-semibold rounded-full",
            isBuy
              ? "bg-neutral-600 text-white hover:bg-neutral-700"
              : "bg-neutral-500 text-white hover:bg-neutral-600"
          )}
        >
          {isSubmitting ? 'Processing...' : `${isBuy ? 'Buy' : 'Sell'} ${tokenSymbol}`}
        </Button>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-neutral-800">
          <div className="text-center">
            <div className="text-[10px] text-neutral-600 uppercase">Bought</div>
            <div className="text-sm font-medium text-neutral-500">
              <img src="/images/solana.svg" alt="SOL" className="w-3 h-3 inline-block mr-0.5" />
              {tradingStats?.bought && tradingStats.bought > 0 ? tradingStats.bought.toFixed(3) : '0'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-neutral-600 uppercase">Sold</div>
            <div className="text-sm font-medium text-neutral-500">
              <img src="/images/solana.svg" alt="SOL" className="w-3 h-3 inline-block mr-0.5" />
              {tradingStats?.sold && tradingStats.sold > 0 ? tradingStats.sold.toFixed(3) : '0'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-neutral-600 uppercase">Holding</div>
            <div className="text-sm font-medium text-white">
              <img src="/images/solana.svg" alt="SOL" className="w-3 h-3 inline-block mr-0.5" />
              {tradingStats?.holding && tradingStats.holding > 0 ? tradingStats.holding.toFixed(4) : '0'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-neutral-600 uppercase">PnL <span className="opacity-50">◉</span></div>
            <div className={cn(
              "text-sm font-medium pnl-font",
              (tradingStats?.pnl || 0) >= 0 ? "text-neutral-400" : "text-neutral-500"
            )}>
              <img src="/images/solana.svg" alt="SOL" className="w-3 h-3 inline-block mr-0.5" />
              {(tradingStats?.pnl || 0) === 0 ? '0' : `${(tradingStats?.pnl || 0) >= 0 ? '+' : ''}${tradingStats?.pnl.toFixed(3)}`}
              <div className="text-[10px] opacity-80 mt-[-2px]">
                ({(tradingStats?.pnlPercent || 0) === 0 ? '0' : `${(tradingStats?.pnlPercent || 0) >= 0 ? '+' : ''}${tradingStats?.pnlPercent.toFixed(1)}`}%)
              </div>
            </div>
          </div>
        </div>

        {/* Preset Tabs removed per user request */}
      </div>

      {/* Token Info Section */}
      <div className="border-t border-neutral-800">
        <div className="w-full flex items-center justify-between px-3 py-2 text-neutral-300">
          <button
            onClick={() => setShowTokenInfo(!showTokenInfo)}
            className="flex items-center gap-2 hover:bg-neutral-900 rounded px-2 py-1 -ml-2"
          >
            <span className="text-sm font-medium">Token Info</span>
            {showTokenInfo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              refreshTokenInfo();
            }}
            className="p-1 hover:bg-neutral-800 rounded transition-colors"
            title="Refresh token info"
          >
            <RefreshCw className="w-3 h-3 text-neutral-500 hover:text-neutral-300" />
          </button>
        </div>

        {showTokenInfo && (
          <div className="px-3 pb-3 space-y-3">
            {/* Tax Card - Full Width */}
            <div className="bg-[#111111] rounded-lg p-3 border border-neutral-800 text-center">
              <div className="text-neutral-400 text-sm font-medium">
                {tokenInfo.tax}%
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5">Tax (Buy/Sell)</div>
            </div>

            {/* Token Stats Grid - Row 1 */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[#111111] rounded-lg p-3 border border-neutral-800 text-center">
                <div className="text-neutral-500 text-sm font-medium">
                  {tokenInfo.devH}%
                </div>
                <div className="text-[10px] text-neutral-600 mt-0.5">Dev H.</div>
              </div>
              <div className="bg-[#111111] rounded-lg p-3 border border-neutral-800 text-center">
                <div className="text-neutral-400 text-sm font-medium">
                  {tokenInfo.top10H}%
                </div>
                <div className="text-[10px] text-neutral-600 mt-0.5">Top 10 H.</div>
              </div>
              <div className="bg-[#111111] rounded-lg p-3 border border-neutral-800 text-center">
                <div className="text-neutral-400 text-sm font-medium">
                  {tokenInfo.lpBurned}%
                </div>
                <div className="text-[10px] text-neutral-600 mt-0.5">LP Burned</div>
              </div>
            </div>

            {/* Token Stats Grid - Row 2 */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[#111111] rounded-lg p-3 border border-neutral-800 text-center">
                <div className="text-neutral-500 text-sm font-medium">
                  {tokenInfo.insiders}%
                </div>
                <div className="text-[10px] text-neutral-600 mt-0.5">Insiders</div>
              </div>
              <div className="bg-[#111111] rounded-lg p-3 border border-neutral-800 text-center">
                <div className="text-neutral-500 text-sm font-medium">
                  {tokenInfo.bundlers}%
                </div>
                <div className="text-[10px] text-neutral-600 mt-0.5">Bundlers</div>
              </div>
              <div className="bg-[#111111] rounded-lg p-3 border border-neutral-800 text-center">
                <div className="text-neutral-400 text-sm font-medium">
                  {tokenInfo.snipersH}%
                </div>
                <div className="text-[10px] text-neutral-600 mt-0.5">Snipers H.</div>
              </div>
            </div>

            {/* Bottom Stats Row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#111111] rounded-lg p-3 border border-neutral-800 text-center">
                <div className="text-white text-sm font-medium">
                  {tokenInfo.holders.toLocaleString()}
                </div>
                <div className="text-[10px] text-neutral-600 mt-0.5">Holders</div>
              </div>
              <div className="bg-[#111111] rounded-lg p-3 border border-neutral-800 text-center">
                <div className={cn(
                  "text-sm font-medium",
                  tokenInfo.dexPaid ? "text-neutral-400" : "text-neutral-600"
                )}>
                  <span className="text-neutral-500">◉</span> {tokenInfo.dexPaid ? 'Paid' : 'Not Paid'}
                </div>
                <div className="text-[10px] text-neutral-600 mt-0.5">Dex Paid</div>
              </div>
            </div>

            {/* Contract Address (CA) */}
            <div className="flex items-center justify-between bg-[#111111] rounded-lg p-3 border border-neutral-800">
              <div className="flex items-center gap-2">
                <span className="text-neutral-500 text-xs">◉</span>
                <span className="text-xs text-neutral-400">CA:</span>
                <span className="text-xs text-white font-mono">{tokenInfo.contractAddress}</span>
              </div>
              <ExternalLink className="w-3 h-3 text-neutral-500 cursor-pointer hover:text-neutral-300" />
            </div>

            {/* Deployer Address (DA) */}
            <div className="flex items-center justify-between bg-[#111111] rounded-lg p-3 border border-neutral-800">
              <div className="flex items-center gap-2">
                <span className="text-neutral-500 text-xs">◉</span>
                <span className="text-xs text-neutral-400">DA:</span>
                <span className="text-xs text-white font-mono">{tokenInfo.deployerAddress}</span>
              </div>
              <ExternalLink className="w-3 h-3 text-neutral-500 cursor-pointer hover:text-neutral-300" />
            </div>
          </div>
        )}
      </div>
    </div >
  );
}
