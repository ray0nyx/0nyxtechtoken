import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, TrendingUp, Shield, Zap, DollarSign, Target, Play, Pause, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface LeaderboardTrader {
  id: string;
  wallet_address: string;
  total_pnl: number;
  roi: number;
  win_rate: number;
  total_trades: number;
  max_drawdown: number;
  risk_score: number;
  follower_count: number;
}

interface CopyTraderSetupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trader: LeaderboardTrader | null;
}

export default function CopyTraderSetup({ open, onOpenChange, trader }: CopyTraderSetupProps) {
  const supabase = createClient();
  const { toast } = useToast();

  // Configuration state
  const [allocatedCapital, setAllocatedCapital] = useState<number>(100);
  const [positionSizingMode, setPositionSizingMode] = useState<'fixed' | 'proportional' | 'custom' | 'kelly'>('proportional');
  const [fixedPositionSize, setFixedPositionSize] = useState<number>(10);
  const [proportionalPercentage, setProportionalPercentage] = useState<number>(10);
  const [maxPositionSize, setMaxPositionSize] = useState<number>(50);
  const [maxSlippage, setMaxSlippage] = useState<number>(1.0);
  const [maxPriceImpact, setMaxPriceImpact] = useState<number>(3.0);
  const [stopLossPercentage, setStopLossPercentage] = useState<number>(0);
  const [takeProfitPercentage, setTakeProfitPercentage] = useState<number>(0);
  const [maxDailyLoss, setMaxDailyLoss] = useState<number>(0);
  const [maxDailyTrades, setMaxDailyTrades] = useState<number>(20);
  const [tokenWhitelist, setTokenWhitelist] = useState<string>('');
  const [tokenBlacklist, setTokenBlacklist] = useState<string>('');
  const [minLiquidity, setMinLiquidity] = useState<number>(0);
  const [autoExecute, setAutoExecute] = useState(false);
  const [priorityFee, setPriorityFee] = useState<number>(0.000005);

  const [saving, setSaving] = useState(false);
  const [existingConfigId, setExistingConfigId] = useState<string | null>(null);

  useEffect(() => {
    if (open && trader) {
      loadExistingConfig();
    }
  }, [open, trader]);

  const loadExistingConfig = async () => {
    if (!trader) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('copy_trading_config')
        .select('*')
        .eq('user_id', user.id)
        .eq('master_wallet', trader.wallet_address)
        .maybeSingle(); // Use maybeSingle instead of single to handle no results gracefully

      if (data) {
        setExistingConfigId(data.id);
        setAllocatedCapital(parseFloat(data.allocated_capital) || 100);
        setPositionSizingMode(data.position_sizing_mode || 'proportional');
        setFixedPositionSize(parseFloat(data.fixed_position_size) || 10);
        setProportionalPercentage(parseFloat(data.proportional_percentage) || 10);
        setMaxPositionSize(parseFloat(data.max_position_size) || 50);
        setMaxSlippage(parseFloat(data.max_slippage) || 1.0);
        setMaxPriceImpact(parseFloat(data.max_price_impact) || 3.0);
        setStopLossPercentage(parseFloat(data.stop_loss_percentage) || 0);
        setTakeProfitPercentage(parseFloat(data.take_profit_percentage) || 0);
        setMaxDailyLoss(parseFloat(data.max_daily_loss) || 0);
        setMaxDailyTrades(data.max_daily_trades || 20);
        setTokenWhitelist(data.token_whitelist?.join('\n') || '');
        setTokenBlacklist(data.token_blacklist?.join('\n') || '');
        setMinLiquidity(parseFloat(data.min_liquidity) || 0);
        setAutoExecute(data.auto_execute || false);
        setPriorityFee(parseFloat(data.priority_fee) || 0.000005);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  const handleSave = async (activate: boolean = false) => {
    if (!trader) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const configData = {
        user_id: user.id,
        master_wallet: trader.wallet_address,
        allocated_capital: allocatedCapital,
        position_sizing_mode: positionSizingMode,
        fixed_position_size: positionSizingMode === 'fixed' ? fixedPositionSize : null,
        proportional_percentage: positionSizingMode === 'proportional' ? proportionalPercentage : null,
        max_position_size: maxPositionSize,
        max_slippage: maxSlippage,
        max_price_impact: maxPriceImpact,
        stop_loss_percentage: stopLossPercentage > 0 ? stopLossPercentage : null,
        take_profit_percentage: takeProfitPercentage > 0 ? takeProfitPercentage : null,
        max_daily_loss: maxDailyLoss > 0 ? maxDailyLoss : null,
        max_daily_trades: maxDailyTrades,
        token_whitelist: tokenWhitelist.trim() ? tokenWhitelist.split('\n').filter(t => t.trim()) : [],
        token_blacklist: tokenBlacklist.trim() ? tokenBlacklist.split('\n').filter(t => t.trim()) : [],
        min_liquidity: minLiquidity > 0 ? minLiquidity : null,
        auto_execute: autoExecute,
        priority_fee: priorityFee,
        is_active: activate,
      };

      if (existingConfigId) {
        const { error } = await supabase
          .from('copy_trading_config')
          .update(configData)
          .eq('id', existingConfigId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('copy_trading_config')
          .insert(configData);

        if (error) throw error;
      }

      toast({
        title: 'Success',
        description: activate ? 'Copy trading activated!' : 'Configuration saved',
      });

      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving config:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save configuration',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!trader) return null;

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-2xl text-white flex items-center gap-2">
            <Zap className="w-6 h-6 text-emerald-400" />
            Copy Trading Setup
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Configure settings to copy trades from{' '}
            <span className="font-mono text-white">{truncateAddress(trader.wallet_address)}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Trader Quick Stats */}
        <div className="grid grid-cols-4 gap-3 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <div>
            <p className="text-xs text-slate-400 mb-1">ROI</p>
            <p className={`text-lg font-bold ${(trader.roi ?? 0) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {(trader.roi ?? 0) > 0 ? '+' : ''}{((trader.roi ?? 0)).toFixed(2)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Win Rate</p>
            <p className="text-lg font-bold text-white">{((trader.win_rate ?? 0)).toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Max Drawdown</p>
            <p className="text-lg font-bold text-red-400">{((trader.max_drawdown ?? 0)).toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Followers</p>
            <p className="text-lg font-bold text-white">{trader.follower_count ?? 0}</p>
          </div>
        </div>

        <Tabs defaultValue="position" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-slate-800">
            <TabsTrigger value="position">Position Sizing</TabsTrigger>
            <TabsTrigger value="risk">Risk Management</TabsTrigger>
            <TabsTrigger value="tokens">Token Filters</TabsTrigger>
          </TabsList>

          {/* Position Sizing Tab */}
          <TabsContent value="position" className="space-y-4">
            <div className="space-y-4">
              {/* Allocated Capital */}
              <div>
                <Label className="text-white flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  Allocated Capital (USD)
                </Label>
                <Input
                  type="number"
                  value={allocatedCapital}
                  onChange={(e) => setAllocatedCapital(parseFloat(e.target.value) || 0)}
                  className="bg-slate-800 border-slate-700 text-white"
                  min="0"
                  step="10"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Total amount you want to allocate for copying this trader
                </p>
              </div>

              {/* Position Sizing Mode */}
              <div>
                <Label className="text-white mb-2 block">Position Sizing Mode</Label>
                <Select value={positionSizingMode} onValueChange={(value: any) => setPositionSizingMode(value)}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="proportional">Proportional (% of master's position)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount per Trade</SelectItem>
                    <SelectItem value="custom">Custom (Manual Approval)</SelectItem>
                    <SelectItem value="kelly">Kelly Criterion (Risk-Adjusted)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Mode-specific settings */}
              {positionSizingMode === 'fixed' && (
                <div>
                  <Label className="text-white mb-2 block">Fixed Position Size (USD)</Label>
                  <Input
                    type="number"
                    value={fixedPositionSize}
                    onChange={(e) => setFixedPositionSize(parseFloat(e.target.value) || 0)}
                    className="bg-slate-800 border-slate-700 text-white"
                    min="1"
                  />
                </div>
              )}

              {positionSizingMode === 'proportional' && (
                <div>
                  <Label className="text-white mb-2 block">
                    Proportional Percentage: {proportionalPercentage}%
                  </Label>
                  <Slider
                    value={[proportionalPercentage]}
                    onValueChange={(value) => setProportionalPercentage(value[0])}
                    max={100}
                    step={1}
                    className="py-4"
                  />
                  <p className="text-xs text-slate-400">
                    You'll copy {proportionalPercentage}% of the master trader's position size
                  </p>
                </div>
              )}

              {/* Max Position Size */}
              <div>
                <Label className="text-white mb-2 block">Maximum Position Size (USD)</Label>
                <Input
                  type="number"
                  value={maxPositionSize}
                  onChange={(e) => setMaxPositionSize(parseFloat(e.target.value) || 0)}
                  className="bg-slate-800 border-slate-700 text-white"
                  min="0"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Cap on any single position (0 for no limit)
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Risk Management Tab */}
          <TabsContent value="risk" className="space-y-4">
            <div className="space-y-4">
              {/* Slippage Tolerance */}
              <div>
                <Label className="text-white mb-2 block">
                  Max Slippage: {maxSlippage}%
                </Label>
                <Slider
                  value={[maxSlippage]}
                  onValueChange={(value) => setMaxSlippage(value[0])}
                  max={5}
                  step={0.1}
                  className="py-4"
                />
              </div>

              {/* Price Impact */}
              <div>
                <Label className="text-white mb-2 block">
                  Max Price Impact: {maxPriceImpact}%
                </Label>
                <Slider
                  value={[maxPriceImpact]}
                  onValueChange={(value) => setMaxPriceImpact(value[0])}
                  max={10}
                  step={0.5}
                  className="py-4"
                />
              </div>

              {/* Stop Loss */}
              <div>
                <Label className="text-white mb-2 block">Stop Loss % (Optional)</Label>
                <Input
                  type="number"
                  value={stopLossPercentage}
                  onChange={(e) => setStopLossPercentage(parseFloat(e.target.value) || 0)}
                  placeholder="e.g. 10 for -10%"
                  className="bg-slate-800 border-slate-700 text-white"
                  min="0"
                  max="100"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Automatically close positions at this loss % (0 = disabled)
                </p>
              </div>

              {/* Take Profit */}
              <div>
                <Label className="text-white mb-2 block">Take Profit % (Optional)</Label>
                <Input
                  type="number"
                  value={takeProfitPercentage}
                  onChange={(e) => setTakeProfitPercentage(parseFloat(e.target.value) || 0)}
                  placeholder="e.g. 50 for +50%"
                  className="bg-slate-800 border-slate-700 text-white"
                  min="0"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Automatically close positions at this profit % (0 = disabled)
                </p>
              </div>

              {/* Daily Limits */}
              <div>
                <Label className="text-white mb-2 block">Max Daily Trades</Label>
                <Input
                  type="number"
                  value={maxDailyTrades}
                  onChange={(e) => setMaxDailyTrades(parseInt(e.target.value) || 0)}
                  className="bg-slate-800 border-slate-700 text-white"
                  min="1"
                />
              </div>

              <div>
                <Label className="text-white mb-2 block">Max Daily Loss (USD, Optional)</Label>
                <Input
                  type="number"
                  value={maxDailyLoss}
                  onChange={(e) => setMaxDailyLoss(parseFloat(e.target.value) || 0)}
                  placeholder="0 = no limit"
                  className="bg-slate-800 border-slate-700 text-white"
                  min="0"
                />
              </div>
            </div>
          </TabsContent>

          {/* Token Filters Tab */}
          <TabsContent value="tokens" className="space-y-4">
            <div className="space-y-4">
              {/* Token Whitelist */}
              <div>
                <Label className="text-white mb-2 block">Token Whitelist (Optional)</Label>
                <textarea
                  value={tokenWhitelist}
                  onChange={(e) => setTokenWhitelist(e.target.value)}
                  placeholder="One token address per line&#10;Leave empty to copy all tokens"
                  className="w-full h-24 px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white text-sm resize-none"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Only copy trades involving these tokens
                </p>
              </div>

              {/* Token Blacklist */}
              <div>
                <Label className="text-white mb-2 block">Token Blacklist (Optional)</Label>
                <textarea
                  value={tokenBlacklist}
                  onChange={(e) => setTokenBlacklist(e.target.value)}
                  placeholder="One token address per line&#10;These tokens will never be copied"
                  className="w-full h-24 px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white text-sm resize-none"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Never copy trades involving these tokens
                </p>
              </div>

              {/* Min Liquidity */}
              <div>
                <Label className="text-white mb-2 block">Minimum Liquidity (USD, Optional)</Label>
                <Input
                  type="number"
                  value={minLiquidity}
                  onChange={(e) => setMinLiquidity(parseFloat(e.target.value) || 0)}
                  placeholder="0 = no minimum"
                  className="bg-slate-800 border-slate-700 text-white"
                  min="0"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Only copy trades in pools with at least this much liquidity
                </p>
              </div>

              {/* Auto Execute */}
              <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                <div>
                  <Label className="text-white flex items-center gap-2 mb-1">
                    <Zap className="w-4 h-4 text-amber-400" />
                    Auto-Execute Trades
                  </Label>
                  <p className="text-xs text-slate-400">
                    Trades execute automatically without confirmation
                  </p>
                </div>
                <Switch
                  checked={autoExecute}
                  onCheckedChange={setAutoExecute}
                />
              </div>

              {/* Priority Fee */}
              <div>
                <Label className="text-white mb-2 block">Priority Fee (SOL)</Label>
                <Input
                  type="number"
                  value={priorityFee}
                  onChange={(e) => setPriorityFee(parseFloat(e.target.value) || 0)}
                  className="bg-slate-800 border-slate-700 text-white"
                  step="0.000001"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Higher fee = faster execution (recommended: 0.000005 SOL)
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4 border-t border-slate-700">
          <Button
            variant="outline"
            onClick={() => handleSave(false)}
            disabled={saving}
            className="flex-1 border-slate-600 text-white hover:bg-slate-800"
          >
            Save Configuration
          </Button>
          <Button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            {saving ? 'Activating...' : 'Save & Activate'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


