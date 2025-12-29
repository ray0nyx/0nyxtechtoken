import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Pencil, RefreshCw, ExternalLink, Wallet } from 'lucide-react';
import { useJupiterPrefetch } from '@/lib/jupiter-prefetch-service';
import { useTradingStore } from '@/stores/useTradingStore';
import { SlippageHandler } from '@/lib/slippage-handler';
import type { JupiterQuote } from '@/stores/useTradingStore';

interface TradingPanelProps {
  pair: string;
  tokenSymbol?: string;
  currentPrice?: number;
  onOrderSubmit?: (order: TradingOrder) => Promise<void>;
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
  // Snipe-specific
  snipeAmount?: number;
  antiMev?: boolean;
  autoSell?: boolean;
  autoSellPercent?: number;
}

const AMOUNT_PRESETS = [0.01, 0.1, 1, 10];

export default function TradingPanel({
  pair,
  tokenSymbol = 'TOKEN',
  currentPrice = 0,
  onOrderSubmit,
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
  const [slippage, setSlippage] = useState<number>(20); // 20%
  const [mevProtection, setMevProtection] = useState<number>(0.001);
  const [priorityFee, setPriorityFee] = useState<number>(0.01);
  const [briberyOff, setBriberyOff] = useState<boolean>(true);

  // Advanced Trading Strategy
  const [advancedStrategy, setAdvancedStrategy] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTokenInfo, setShowTokenInfo] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState(1);

  // Trading stats
  const [stats, setStats] = useState({
    bought: 0,
    sold: 0,
    holding: 0,
    pnl: 0,
    pnlPercent: 0
  });

  // Volume stats
  const [volumeStats, setVolumeStats] = useState({
    fiveMinVol: 6.04,
    buys: 591,
    buysUsd: 2.42,
    sells: 44,
    sellsUsd: 3.62,
    netVol: -1.21
  });

  // Token info stats
  const [tokenInfo, setTokenInfo] = useState({
    top10H: 18.66,
    devH: 0,
    snipersH: 0.01,
    insiders: 10.39,
    bundlers: 11.03,
    lpBurned: 100,
    holders: 3311,
    proTraders: 296,
    dexPaid: true,
    contractAddress: '9V7jznWgdN6tjMa...pump'
  });

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
      const order: TradingOrder = {
        pair,
        side,
        orderType,
        amount: parseFloat(amount),
        price: orderType === 'limit' ? parseFloat(limitPrice) : undefined,
        slippageBps: Math.round(slippage * 100),
        antiMev: mevProtection > 0,
      };

      if (onOrderSubmit) {
        await onOrderSubmit(order);
      }

      toast({
        title: 'Order Submitted',
        description: `${side.toUpperCase()} ${amount} SOL @ ${slippage}% slippage`,
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
      <div className="grid grid-cols-4 gap-2 p-3 border-b border-neutral-800">
        <div className="text-center">
          <div className="text-[10px] text-neutral-500 uppercase">5m Vol</div>
          <div className="text-sm font-medium text-white">${volumeStats.fiveMinVol}K</div>
          <div className="h-1 bg-neutral-700 rounded-full mt-1">
            <div className="h-full bg-cyan-500 rounded-full" style={{ width: '70%' }}></div>
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-neutral-500 uppercase">Buys</div>
          <div className="text-sm font-medium text-neutral-400">{volumeStats.buys} / ${volumeStats.buysUsd}K</div>
          <div className="h-1 bg-neutral-700 rounded-full mt-1">
            <div className="h-full bg-neutral-500 rounded-full" style={{ width: '60%' }}></div>
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-neutral-500 uppercase">Sells</div>
          <div className="text-sm font-medium text-neutral-500">{volumeStats.sells} / ${volumeStats.sellsUsd}K</div>
          <div className="h-1 bg-neutral-700 rounded-full mt-1">
            <div className="h-full bg-neutral-400 rounded-full" style={{ width: '40%' }}></div>
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-neutral-500 uppercase">Net Vol.</div>
          <div className={cn("text-sm font-medium", volumeStats.netVol >= 0 ? "text-neutral-400" : "text-neutral-500")}>
            {volumeStats.netVol >= 0 ? '' : '-'}${Math.abs(volumeStats.netVol)}K
          </div>
          <div className="h-1 bg-neutral-700 rounded-full mt-1">
            <div className="h-full bg-neutral-500 rounded-full" style={{ width: '30%' }}></div>
          </div>
        </div>
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
          <button className="p-2.5 text-neutral-500 hover:text-neutral-300">
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Order Type Tabs */}
      <div className="flex items-center justify-between px-3 pb-2 border-b border-neutral-800">
        <div className="flex items-center gap-1">
          {(['market', 'limit', 'advanced'] as const).map((type) => (
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
              {type === 'advanced' ? 'Adv.' : type}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <Wallet className="w-3 h-3" />
          <span>3</span>
          <span className="text-neutral-600">≡</span>
          <span>0</span>
        </div>
      </div>

      {/* Amount Section */}
      <div className="p-3 space-y-3 overflow-y-auto flex-1">
        {/* Amount Label & Input */}
        <div className="bg-[#111111] rounded-lg p-3 border border-neutral-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-400 uppercase font-semibold">Amount</span>
              <span className="text-white font-medium">{amount}</span>
            </div>
            <div className="text-neutral-500">≡</div>
          </div>

          {/* Amount Presets */}
          <div className="flex items-center gap-2">
            {AMOUNT_PRESETS.map((preset) => (
              <button
                key={preset}
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
            ))}
            <button className="p-2 text-neutral-500 hover:text-neutral-300 border border-neutral-800 rounded-md">
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Quick Settings Row */}
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-[#111111] border border-neutral-800">
            <span className="text-neutral-500">✂</span>
            <span className="text-white">{slippage}%</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-[#111111] border border-neutral-800">
            <span className="text-neutral-500">⚡</span>
            <span className="text-neutral-400">{mevProtection}</span>
            <span className="text-yellow-500 text-[10px]">⚠</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-[#111111] border border-neutral-800">
            <span className="text-neutral-500">💬</span>
            <span className="text-neutral-400">{priorityFee}</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-[#111111] border border-neutral-800">
            <span className="text-neutral-500">⊘</span>
            <span className="text-neutral-400">{briberyOff ? 'Off' : 'On'}</span>
          </div>
        </div>

        {/* Limit Price (for Limit orders) */}
        {orderType === 'limit' && (
          <div className="bg-[#111111] rounded-lg p-3 border border-neutral-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-neutral-400 uppercase font-semibold">Limit Price</span>
            </div>
            <Input
              type="number"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              placeholder={currentPrice ? currentPrice.toString() : "0.00"}
              className="bg-[#0a0a0a] border-neutral-800 text-white text-right"
            />
          </div>
        )}

        {/* Advanced Trading Strategy */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="advanced-strategy"
            checked={advancedStrategy}
            onCheckedChange={(checked) => setAdvancedStrategy(checked as boolean)}
            className="border-neutral-600"
          />
          <label htmlFor="advanced-strategy" className="text-xs text-neutral-400 cursor-pointer">
            Advanced Trading Strategy
          </label>
        </div>

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
              <span className="text-neutral-600">≡</span> {stats.bought}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-neutral-600 uppercase">Sold</div>
            <div className="text-sm font-medium text-neutral-500">
              <span className="text-neutral-600">≡</span> {stats.sold}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-neutral-600 uppercase">Holding</div>
            <div className="text-sm font-medium text-white">
              <span className="text-neutral-600">≡</span> {stats.holding}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-neutral-600 uppercase">PnL <span className="opacity-50">◉</span></div>
            <div className={cn("text-sm font-medium", stats.pnl >= 0 ? "text-neutral-400" : "text-neutral-500")}>
              <span className="text-neutral-600">≡</span> +{stats.pnl} (+{stats.pnlPercent}%)
            </div>
          </div>
        </div>

        {/* Preset Tabs */}
        <div className="flex items-center gap-1 pt-2 border-t border-neutral-800">
          {[1, 2, 3].map((preset) => (
            <button
              key={preset}
              onClick={() => setSelectedPreset(preset)}
              className={cn(
                "flex-1 py-2 text-xs font-medium rounded-md transition-colors",
                selectedPreset === preset
                  ? "bg-neutral-700 text-cyan-400 border border-neutral-600"
                  : "text-neutral-500 hover:text-neutral-300"
              )}
            >
              PRESET {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Token Info Section */}
      <div className="border-t border-neutral-800">
        <button
          onClick={() => setShowTokenInfo(!showTokenInfo)}
          className="w-full flex items-center justify-between px-3 py-2 text-neutral-300 hover:bg-neutral-900"
        >
          <span className="text-sm font-medium">Token Info</span>
          <div className="flex items-center gap-2">
            <RefreshCw className="w-3 h-3 text-neutral-500" />
            {showTokenInfo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showTokenInfo && (
          <div className="px-3 pb-3 space-y-3">
            {/* Token Stats Grid - Row 1 */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[#111111] rounded-lg p-3 border border-neutral-800 text-center">
                <div className="text-neutral-400 text-sm font-medium">
                  <span className="text-neutral-500">👤</span> {tokenInfo.top10H}%
                </div>
                <div className="text-[10px] text-neutral-600 mt-0.5">Top 10 H.</div>
              </div>
              <div className="bg-[#111111] rounded-lg p-3 border border-neutral-800 text-center">
                <div className="text-neutral-500 text-sm font-medium">
                  <span className="text-neutral-600">🏠</span> {tokenInfo.devH}%
                </div>
                <div className="text-[10px] text-neutral-600 mt-0.5">Dev H.</div>
              </div>
              <div className="bg-[#111111] rounded-lg p-3 border border-neutral-800 text-center">
                <div className="text-neutral-400 text-sm font-medium">
                  <span className="text-neutral-500">⊕</span> {tokenInfo.snipersH}%
                </div>
                <div className="text-[10px] text-neutral-600 mt-0.5">Snipers H.</div>
              </div>
            </div>

            {/* Token Stats Grid - Row 2 */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[#111111] rounded-lg p-3 border border-neutral-800 text-center">
                <div className="text-neutral-500 text-sm font-medium">
                  <span className="text-neutral-600">⊘</span> {tokenInfo.insiders}%
                </div>
                <div className="text-[10px] text-neutral-600 mt-0.5">Insiders</div>
              </div>
              <div className="bg-[#111111] rounded-lg p-3 border border-neutral-800 text-center">
                <div className="text-neutral-500 text-sm font-medium">
                  <span className="text-neutral-600">📦</span> {tokenInfo.bundlers}%
                </div>
                <div className="text-[10px] text-neutral-600 mt-0.5">Bundlers</div>
              </div>
              <div className="bg-[#111111] rounded-lg p-3 border border-neutral-800 text-center">
                <div className="text-neutral-400 text-sm font-medium">
                  <span className="text-neutral-500">🔥</span> {tokenInfo.lpBurned}%
                </div>
                <div className="text-[10px] text-neutral-600 mt-0.5">LP Burned</div>
              </div>
            </div>

            {/* Bottom Stats Row */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[#111111] rounded-lg p-3 border border-neutral-800 text-center">
                <div className="text-white text-sm font-medium">
                  <span className="text-neutral-500">👥</span> {tokenInfo.holders.toLocaleString()}
                </div>
                <div className="text-[10px] text-neutral-600 mt-0.5">Holders</div>
              </div>
              <div className="bg-[#111111] rounded-lg p-3 border border-neutral-800 text-center">
                <div className="text-white text-sm font-medium">
                  <span className="text-neutral-500">🎯</span> {tokenInfo.proTraders}
                </div>
                <div className="text-[10px] text-neutral-600 mt-0.5">Pro Traders</div>
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

            {/* Contract Address */}
            <div className="flex items-center justify-between bg-[#111111] rounded-lg p-3 border border-neutral-800">
              <div className="flex items-center gap-2">
                <span className="text-neutral-500 text-xs">◉</span>
                <span className="text-xs text-neutral-400">CA:</span>
                <span className="text-xs text-white font-mono">{tokenInfo.contractAddress}</span>
              </div>
              <ExternalLink className="w-3 h-3 text-neutral-500 cursor-pointer hover:text-neutral-300" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
