import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
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

const AMOUNT_PRESETS = [0.01, 0.1, 0.5, 1];
const SLIPPAGE_PRESETS = [0.5, 1, 2, 5]; // Percentage
const SL_PRESETS = [5, 10, 15, 25]; // Stop loss percentages
const TP_PRESETS = [25, 50, 100, 200]; // Take profit percentages

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
  const [amount, setAmount] = useState<string>('0.1');
  const [limitPrice, setLimitPrice] = useState<string>('');
  const [slippage, setSlippage] = useState<number>(1); // 1%
  const [customSlippage, setCustomSlippage] = useState<string>('');

  // Stop Loss & Take Profit
  const [enableStopLoss, setEnableStopLoss] = useState(false);
  const [stopLossPercent, setStopLossPercent] = useState<number>(10);
  const [enableTakeProfit, setEnableTakeProfit] = useState(false);
  const [takeProfitPercent, setTakeProfitPercent] = useState<number>(50);

  // Snipe settings
  const [antiMev, setAntiMev] = useState(true);
  const [autoSell, setAutoSell] = useState(false);
  const [autoSellPercent, setAutoSellPercent] = useState<number>(100);

  const [advancedStrategy, setAdvancedStrategy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTokenInfo, setShowTokenInfo] = useState(true);

  // Real-time quote updates
  const tokenAddress = useTradingStore((state) => state.tokenAddress);
  const amountLamports = parseFloat(amount || '0') * 1e9; // Convert SOL to lamports
  const { quote, isQuoteValid } = useJupiterPrefetch(
    tokenAddress || null,
    amountLamports,
    Math.round((customSlippage ? parseFloat(customSlippage) : slippage) * 100) // Convert % to bps
  );

  // Slippage analysis
  const [slippageAnalysis, setSlippageAnalysis] = useState<{
    priceImpact: number;
    warning?: string;
    isHighImpact: boolean;
  } | null>(null);

  useEffect(() => {
    if (quote && amountLamports > 0) {
      const analysis = SlippageHandler.analyzeSlippage(
        quote,
        parseFloat(amount || '0') * (currentPrice || 150), // USD value
        undefined // liquidityInfo would come from backend
      );

      setSlippageAnalysis({
        priceImpact: analysis.priceImpactPct,
        warning: analysis.warning,
        isHighImpact: analysis.isHighImpact,
      });
    }
  }, [quote, amount, currentPrice]);

  // Trading stats
  const [stats, setStats] = useState({
    bought: 0,
    sold: 0,
    holding: 0,
    pnl: 0,
    pnlPercent: 0
  });

  // Token info stats
  const [tokenInfo, setTokenInfo] = useState({
    top10H: 14.56,
    devH: 2.92,
    snipersH: 2.92,
    insiders: 8.83,
    bundlers: 1.39,
    lpBurned: 100,
    holders: 24846,
    proTraders: 415,
    dexPaid: true
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
      const effectiveSlippage = customSlippage ? parseFloat(customSlippage) : slippage;

      const order: TradingOrder = {
        pair,
        side,
        orderType,
        amount: parseFloat(amount),
        price: orderType === 'limit' ? parseFloat(limitPrice) : undefined,
        slippageBps: Math.round(effectiveSlippage * 100), // Convert % to bps
        stopLossPercent: enableStopLoss ? stopLossPercent : undefined,
        takeProfitPercent: enableTakeProfit ? takeProfitPercent : undefined,
        antiMev: orderType === 'snipe' ? antiMev : undefined,
        autoSell: orderType === 'snipe' ? autoSell : undefined,
        autoSellPercent: orderType === 'snipe' && autoSell ? autoSellPercent : undefined,
      };

      if (onOrderSubmit) {
        await onOrderSubmit(order);
      }

      toast({
        title: 'Order Submitted',
        description: `${side.toUpperCase()} ${amount} SOL @ ${effectiveSlippage}% slippage`,
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
      {/* Buy/Sell Tabs */}
      <div className={cn("p-1 m-2 rounded-lg flex", isDark ? "bg-[#111111] border border-neutral-800" : "bg-gray-100")}>
        <button
          onClick={() => setSide('buy')}
          className={cn(
            "flex-1 py-2 text-sm font-semibold transition-all rounded-md",
            isBuy
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              : isDark
                ? "text-neutral-500 hover:text-gray-300"
                : "text-gray-600 hover:text-gray-900"
          )}
        >
          BUY
        </button>
        <button
          onClick={() => setSide('sell')}
          className={cn(
            "flex-1 py-2 text-sm font-medium transition-all rounded-md",
            !isBuy
              ? "bg-red-500/10 text-red-400 border border-red-500/20"
              : isDark
                ? "text-neutral-500 hover:text-gray-300"
                : "text-gray-600 hover:text-gray-900"
          )}
        >
          SELL
        </button>
      </div>

      {/* Order Type Tabs */}
      <div className="flex items-center gap-1 p-2 border-b border-neutral-800">
        {(['market', 'limit', 'snipe', 'advanced'] as OrderType[]).map((type) => (
          <button
            key={type}
            onClick={() => setOrderType(type)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize",
              orderType === type
                ? type === 'snipe'
                  ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                  : isDark
                    ? "bg-neutral-800 text-gray-200 border border-neutral-700"
                    : "bg-gray-200 text-gray-900"
                : isDark
                  ? "text-neutral-500 hover:text-gray-300"
                  : "text-gray-600 hover:text-gray-900"
            )}
          >
            {type === 'advanced' ? 'SL/TP' : type === 'snipe' ? '⚡ Snipe' : type}
          </button>
        ))}
      </div>

      {/* Amount Section */}
      <div className="p-3 space-y-3 overflow-y-auto flex-1">
        {/* Amount Label */}
        <div className="flex items-center justify-between">
          <span className={cn(
            "text-[10px] uppercase font-semibold tracking-wide",
            isDark ? "text-neutral-500" : "text-gray-600"
          )}>PAY</span>
          <span className={cn(
            "text-xs",
            isDark ? "text-gray-300" : "text-gray-600"
          )}>{currentPrice ? `$${(parseFloat(amount || '0') * currentPrice).toFixed(2)}` : '—'}</span>
        </div>

        {/* Amount Presets */}
        <div className="grid grid-cols-4 gap-2">
          {AMOUNT_PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => handlePresetAmount(preset)}
              className={cn(
                "py-2 text-xs font-medium rounded-md transition-colors border",
                amount === preset.toString()
                  ? isBuy
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-red-500/10 text-red-400 border-red-500/30"
                  : isDark
                    ? "bg-[#0a0a0a] text-neutral-400 hover:text-gray-200 border-neutral-800 hover:border-neutral-600"
                    : "bg-gray-50 text-gray-600 hover:text-gray-900 border-gray-200"
              )}
            >
              {preset}
            </button>
          ))}
        </div>

        {/* Custom Amount Input */}
        <div className="flex items-center gap-1">
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className={cn(
              "flex-1 text-left rounded-md",
              isDark
                ? "bg-[#0a0a0a] border-neutral-800 text-gray-200 placeholder:text-neutral-600"
                : "bg-white border-gray-200 text-gray-900"
            )}
          />
          <div className="flex items-center gap-2 pl-3">
            <span className={cn("text-sm font-medium", isDark ? "text-neutral-400" : "text-gray-600")}>SOL</span>
            <div className="w-5 h-5 rounded-full bg-blue-500"></div>
          </div>
        </div>

        {/* Real-time Quote Display */}
        {quote && isQuoteValid && (
          <div className={cn(
            "p-2 rounded-md border",
            isDark ? "bg-[#111111] border-neutral-800" : "bg-gray-50 border-gray-200"
          )}>
            <div className="flex items-center justify-between text-xs">
              <span className={isDark ? "text-neutral-500" : "text-gray-600"}>Expected Output:</span>
              <span className={cn("font-medium", isDark ? "text-gray-300" : "text-gray-700")}>
                {((parseFloat(quote.outAmount) / 1e9) * (currentPrice || 0)).toFixed(4)} {tokenSymbol}
              </span>
            </div>
            {slippageAnalysis && slippageAnalysis.priceImpact > 0 && (
              <div className={cn(
                "text-xs mt-1",
                slippageAnalysis.isHighImpact ? "text-red-400" : "text-yellow-400"
              )}>
                Price Impact: {slippageAnalysis.priceImpact.toFixed(2)}%
                {slippageAnalysis.warning && (
                  <div className="text-xs mt-0.5 opacity-75">{slippageAnalysis.warning}</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Slippage Section */}
        <div className="space-y-2 pt-2 border-t border-neutral-800">
          <div className="flex items-center justify-between">
            <span className={cn(
              "text-[10px] uppercase font-semibold tracking-wide",
              isDark ? "text-neutral-500" : "text-gray-600"
            )}>SLIPPAGE TOLERANCE</span>
            <span className={cn(
              "text-xs",
              isDark ? "text-neutral-400" : "text-gray-600"
            )}>ETH</span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {SLIPPAGE_PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => { setSlippage(preset); setCustomSlippage(''); }}
                className={cn(
                  "py-1.5 text-xs font-medium rounded-md transition-colors border",
                  slippage === preset && !customSlippage
                    ? isBuy
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : "bg-red-500/10 text-red-400 border-red-500/30"
                    : isDark
                      ? "bg-[#0a0a0a] text-neutral-400 hover:text-gray-200 border-neutral-800 hover:border-neutral-600"
                      : "bg-gray-50 text-gray-600 border border-gray-200"
                )}
              >
                {preset}%
              </button>
            ))}
          </div>

          <Input
            type="number"
            value={customSlippage}
            onChange={(e) => setCustomSlippage(e.target.value)}
            placeholder="Auto"
            className={cn(
              "text-xs h-8 rounded-md",
              isDark
                ? "bg-[#0a0a0a] border-neutral-800 text-gray-200 placeholder:text-neutral-600"
                : "bg-white border-gray-200"
            )}
          />
        </div>

        {/* Limit Price (for Limit orders) */}
        {orderType === 'limit' && (
          <div className="space-y-2 pt-2 border-t border-[#1f2937]">
            <span className={cn(
              "text-xs font-medium",
              isDark ? "text-gray-400" : "text-gray-600"
            )}>LIMIT PRICE</span>
            <Input
              type="number"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              placeholder={currentPrice ? currentPrice.toString() : "0.00"}
              className={cn(
                "text-right",
                isDark
                  ? "bg-[#1a1f2e] border-[#1f2937] text-white"
                  : "bg-white border-gray-200"
              )}
            />
            <div className="flex gap-1">
              <button
                onClick={() => setLimitPrice((currentPrice * 0.95).toString())}
                className={cn("flex-1 py-1 text-xs rounded", isDark ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-600")}
              >-5%</button>
              <button
                onClick={() => setLimitPrice((currentPrice * 0.98).toString())}
                className={cn("flex-1 py-1 text-xs rounded", isDark ? "bg-red-500/10 text-red-300" : "bg-red-50 text-red-500")}
              >-2%</button>
              <button
                onClick={() => setLimitPrice(currentPrice.toString())}
                className={cn("flex-1 py-1 text-xs rounded", isDark ? "bg-gray-700 text-white" : "bg-gray-200 text-gray-800")}
              >Market</button>
              <button
                onClick={() => setLimitPrice((currentPrice * 1.02).toString())}
                className={cn("flex-1 py-1 text-xs rounded", isDark ? "bg-emerald-500/10 text-emerald-300" : "bg-green-50 text-green-500")}
              >+2%</button>
              <button
                onClick={() => setLimitPrice((currentPrice * 1.05).toString())}
                className={cn("flex-1 py-1 text-xs rounded", isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-green-100 text-green-600")}
              >+5%</button>
            </div>
          </div>
        )}

        {/* Snipe Settings */}
        {orderType === 'snipe' && (
          <div className="space-y-3 pt-2 border-t border-[#1f2937]">
            <div className="flex items-center justify-between">
              <span className={cn("text-xs font-medium", isDark ? "text-purple-400" : "text-purple-600")}>
                ⚡ SNIPE MODE
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="anti-mev"
                checked={antiMev}
                onCheckedChange={(checked) => setAntiMev(checked as boolean)}
              />
              <label htmlFor="anti-mev" className={cn("text-xs cursor-pointer", isDark ? "text-gray-400" : "text-gray-600")}>
                🛡️ Anti-MEV Protection
              </label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="auto-sell"
                checked={autoSell}
                onCheckedChange={(checked) => setAutoSell(checked as boolean)}
              />
              <label htmlFor="auto-sell" className={cn("text-xs cursor-pointer", isDark ? "text-gray-400" : "text-gray-600")}>
                📈 Auto-Sell at Profit
              </label>
            </div>

            {autoSell && (
              <div className="grid grid-cols-4 gap-1">
                {[50, 100, 200, 500].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setAutoSellPercent(pct)}
                    className={cn(
                      "py-1.5 text-xs rounded",
                      autoSellPercent === pct
                        ? "bg-purple-500/20 text-purple-400 border border-purple-500/50"
                        : isDark ? "bg-[#1a1f2e] text-gray-400 border border-[#1f2937]" : "bg-gray-50 text-gray-600 border border-gray-200"
                    )}
                  >
                    +{pct}%
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Stop Loss / Take Profit (Advanced tab) */}
        {orderType === 'advanced' && (
          <div className="space-y-3 pt-2 border-t border-[#1f2937]">
            {/* Stop Loss */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="enable-sl"
                  checked={enableStopLoss}
                  onCheckedChange={(checked) => setEnableStopLoss(checked as boolean)}
                />
                <label htmlFor="enable-sl" className={cn("text-xs font-medium cursor-pointer", isDark ? "text-red-400" : "text-red-600")}>
                  🛑 Stop Loss
                </label>
              </div>

              {enableStopLoss && (
                <div className="grid grid-cols-4 gap-1">
                  {SL_PRESETS.map((pct) => (
                    <button
                      key={pct}
                      onClick={() => setStopLossPercent(pct)}
                      className={cn(
                        "py-1.5 text-xs rounded",
                        stopLossPercent === pct
                          ? "bg-red-500/20 text-red-400 border border-red-500/50"
                          : isDark ? "bg-[#1a1f2e] text-gray-400 border border-[#1f2937]" : "bg-gray-50 text-gray-600 border border-gray-200"
                      )}
                    >
                      -{pct}%
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Take Profit */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="enable-tp"
                  checked={enableTakeProfit}
                  onCheckedChange={(checked) => setEnableTakeProfit(checked as boolean)}
                />
                <label htmlFor="enable-tp" className={cn("text-xs font-medium cursor-pointer", isDark ? "text-emerald-400" : "text-emerald-600")}>
                  🎯 Take Profit
                </label>
              </div>

              {enableTakeProfit && (
                <div className="grid grid-cols-4 gap-1">
                  {TP_PRESETS.map((pct) => (
                    <button
                      key={pct}
                      onClick={() => setTakeProfitPercent(pct)}
                      className={cn(
                        "py-1.5 text-xs rounded",
                        takeProfitPercent === pct
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                          : isDark ? "bg-[#1a1f2e] text-gray-400 border border-[#1f2937]" : "bg-gray-50 text-gray-600 border border-gray-200"
                      )}
                    >
                      +{pct}%
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !connected}
          variant="ghost"
          className={cn(
            "w-full py-6 text-base font-semibold rounded-lg",
            isBuy
              ? "bg-emerald-600 text-white hover:bg-emerald-700 border-0"
              : "bg-red-600 text-white hover:bg-red-700 border-0"
          )}
        >
          {isSubmitting ? 'Processing...' : `${isBuy ? 'Buy' : 'Sell'} ${tokenSymbol}`}
        </Button>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-2 pt-2">
          <div className="text-center">
            <div className={cn("text-xs", isDark ? "text-gray-500" : "text-gray-400")}>Bought</div>
            <div className={cn("text-sm font-medium", isDark ? "text-white" : "text-gray-900")}>
              <span className="text-emerald-400">≡</span> {stats.bought}
            </div>
          </div>
          <div className="text-center">
            <div className={cn("text-xs", isDark ? "text-gray-500" : "text-gray-400")}>Sold</div>
            <div className={cn("text-sm font-medium", isDark ? "text-white" : "text-gray-900")}>
              <span className="text-red-400">≡</span> {stats.sold}
            </div>
          </div>
          <div className="text-center">
            <div className={cn("text-xs", isDark ? "text-gray-500" : "text-gray-400")}>Holding</div>
            <div className={cn("text-sm font-medium", isDark ? "text-white" : "text-gray-900")}>
              <span className="text-gray-400">≡</span> {stats.holding}
            </div>
          </div>
          <div className="text-center">
            <div className={cn("text-xs", isDark ? "text-gray-500" : "text-gray-400")}>PnL ⓘ</div>
            <div className={cn("text-sm font-medium", stats.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
              <span className="text-gray-400">≡</span> +{stats.pnl} (+{stats.pnlPercent}%)
            </div>
          </div>
        </div>

        {/* Preset Buttons */}
        <div className="flex items-center gap-2 pt-2">
          {['PRESET 1', 'PRESET 2', 'PRESET 3'].map((preset, i) => (
            <button
              key={preset}
              className={cn(
                "flex-1 py-2 text-xs font-medium rounded transition-colors",
                i === 0
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                  : isDark
                    ? "bg-[#1a1f2e] text-gray-400 border border-[#1f2937]"
                    : "bg-gray-50 text-gray-600 border border-gray-200"
              )}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Token Info Section */}
      <div className="mt-auto border-t border-[#1f2937]">
        <button
          onClick={() => setShowTokenInfo(!showTokenInfo)}
          className={cn(
            "w-full flex items-center justify-between px-3 py-2",
            isDark ? "text-gray-300 hover:bg-[#1a1f2e]" : "text-gray-700 hover:bg-gray-50"
          )}
        >
          <span className="text-sm font-medium">Token Info</span>
          {showTokenInfo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showTokenInfo && (
          <div className="px-3 pb-3 space-y-2">
            {/* Token Stats Grid */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className={cn("block", isDark ? "text-gray-500" : "text-gray-400")}>Top 10 H.</span>
                <span className="text-emerald-400">▲ {tokenInfo.top10H}%</span>
              </div>
              <div>
                <span className={cn("block", isDark ? "text-gray-500" : "text-gray-400")}>Dev H.</span>
                <span className="text-emerald-400">▲ {tokenInfo.devH}%</span>
              </div>
              <div>
                <span className={cn("block", isDark ? "text-gray-500" : "text-gray-400")}>Snipers H.</span>
                <span className="text-emerald-400">▲ {tokenInfo.snipersH}%</span>
              </div>
              <div>
                <span className={cn("block", isDark ? "text-gray-500" : "text-gray-400")}>Insiders</span>
                <span className="text-emerald-400">⊘ {tokenInfo.insiders}%</span>
              </div>
              <div>
                <span className={cn("block", isDark ? "text-gray-500" : "text-gray-400")}>Bundlers</span>
                <span className="text-emerald-400">⊘ {tokenInfo.bundlers}%</span>
              </div>
              <div>
                <span className={cn("block", isDark ? "text-gray-500" : "text-gray-400")}>L.P. Burned</span>
                <span className="text-emerald-400">⊘ {tokenInfo.lpBurned}%</span>
              </div>
            </div>

            {/* Bottom Stats */}
            <div className="flex items-center justify-between pt-2 text-xs border-t border-[#1f2937]">
              <div className="flex items-center gap-4">
                <div>
                  <span className={cn(isDark ? "text-gray-500" : "text-gray-400")}>⊘ </span>
                  <span className={isDark ? "text-white" : "text-gray-900"}>{tokenInfo.holders.toLocaleString()}</span>
                </div>
                <div>
                  <span className={cn(isDark ? "text-gray-500" : "text-gray-400")}>⊘ </span>
                  <span className={isDark ? "text-white" : "text-gray-900"}>{tokenInfo.proTraders}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className={cn(
                  "px-1.5 py-0.5 rounded text-xs",
                  tokenInfo.dexPaid
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-red-500/20 text-red-400"
                )}>
                  ⊘ {tokenInfo.dexPaid ? 'Paid' : 'Not Paid'}
                </span>
              </div>
            </div>

            {/* Contract Address */}
            <div className={cn(
              "text-xs pt-2 truncate",
              isDark ? "text-gray-500" : "text-gray-400"
            )}>
              CA: C2omVhcv3DYv...pump
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
