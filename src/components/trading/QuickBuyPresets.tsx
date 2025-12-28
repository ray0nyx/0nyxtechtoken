/**
 * Quick Buy Presets Component
 * 
 * One-click trading buttons for quick SOL amounts.
 * Integrates with Turnkey wallet for signing.
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Loader2, Shield, Zap, AlertTriangle } from 'lucide-react';
import { useTurnkeyWallet } from '@/lib/wallet-abstraction/TurnkeyWalletContext';
import { quickBuy, quickSell, checkMevRisk } from '@/lib/wallet-abstraction/trading-utils';
import { toast } from 'sonner';

interface QuickAmount {
    label: string;
    solAmount: number;
    display: string;
}

interface TradingPreset {
    id: string;
    name: string;
    solAmount: number;
    slippageBps: number;
    priorityFeeLamports: number;
    useMevProtection: boolean;
    isDefault: boolean;
}

interface QuickBuyPresetsProps {
    tokenMint: string;
    tokenSymbol?: string;
    onTradeComplete?: (signature: string, action: 'buy' | 'sell') => void;
    onTradeError?: (error: string) => void;
    className?: string;
}

export function QuickBuyPresets({
    tokenMint,
    tokenSymbol = 'Token',
    onTradeComplete,
    onTradeError,
    className,
}: QuickBuyPresetsProps) {
    const { connected, adapter, address } = useTurnkeyWallet();
    const [loading, setLoading] = useState<string | null>(null);
    const [quickAmounts, setQuickAmounts] = useState<QuickAmount[]>([]);
    const [presets, setPresets] = useState<TradingPreset[]>([]);
    const [mevRisk, setMevRisk] = useState<{ riskLevel: string; recommendation: string } | null>(null);

    // Fetch presets from API
    useEffect(() => {
        const fetchPresets = async () => {
            try {
                const apiUrl = import.meta.env.VITE_RUST_API_URL || 'http://localhost:8002';
                const response = await fetch(`${apiUrl}/api/presets`);

                if (response.ok) {
                    const data = await response.json();
                    setQuickAmounts(data.quickAmounts || []);
                    setPresets(data.presets || []);
                } else {
                    // Fallback to default amounts
                    setQuickAmounts([
                        { label: '0.1', solAmount: 0.1, display: '0.1 SOL' },
                        { label: '0.25', solAmount: 0.25, display: '0.25 SOL' },
                        { label: '0.5', solAmount: 0.5, display: '0.5 SOL' },
                        { label: '1', solAmount: 1.0, display: '1 SOL' },
                        { label: '2', solAmount: 2.0, display: '2 SOL' },
                    ]);
                }
            } catch (err) {
                console.warn('Failed to fetch presets:', err);
                // Use defaults
                setQuickAmounts([
                    { label: '0.1', solAmount: 0.1, display: '0.1 SOL' },
                    { label: '0.25', solAmount: 0.25, display: '0.25 SOL' },
                    { label: '0.5', solAmount: 0.5, display: '0.5 SOL' },
                    { label: '1', solAmount: 1.0, display: '1 SOL' },
                ]);
            }
        };

        fetchPresets();
    }, []);

    // Check MEV risk when token changes
    useEffect(() => {
        const checkRisk = async () => {
            try {
                const risk = await checkMevRisk(tokenMint, 1_000_000_000, true);
                setMevRisk(risk);
            } catch (err) {
                // Ignore MEV check errors
            }
        };

        if (tokenMint) {
            checkRisk();
        }
    }, [tokenMint]);

    const handleQuickBuy = async (amount: number, label: string) => {
        if (!connected || !adapter) {
            toast.error('Please connect your wallet first');
            return;
        }

        setLoading(`buy-${label}`);

        try {
            const result = await quickBuy(adapter, tokenMint, amount);
            toast.success(`Bought ${tokenSymbol}!`, {
                description: `${amount} SOL spent. Tx: ${result.signature.slice(0, 8)}...`,
            });

            if (onTradeComplete) {
                onTradeComplete(result.signature, 'buy');
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Trade failed';
            toast.error('Buy failed', { description: message });

            if (onTradeError) {
                onTradeError(message);
            }
        } finally {
            setLoading(null);
        }
    };

    const handleQuickSell = async (percentage: number) => {
        if (!connected || !adapter) {
            toast.error('Please connect your wallet first');
            return;
        }

        setLoading(`sell-${percentage}`);

        try {
            // In production, would get actual token balance and calculate amount
            const tokenAmount = 1000 * (percentage / 100); // Placeholder
            const result = await quickSell(adapter, tokenMint, tokenAmount);

            toast.success(`Sold ${percentage}% of ${tokenSymbol}!`, {
                description: `Tx: ${result.signature.slice(0, 8)}...`,
            });

            if (onTradeComplete) {
                onTradeComplete(result.signature, 'sell');
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Trade failed';
            toast.error('Sell failed', { description: message });

            if (onTradeError) {
                onTradeError(message);
            }
        } finally {
            setLoading(null);
        }
    };

    if (!connected) {
        return (
            <Card className={className}>
                <CardContent className="pt-6">
                    <p className="text-center text-muted-foreground">
                        Connect wallet to trade
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={className}>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-yellow-500" />
                        Quick Trade
                    </span>
                    {mevRisk && mevRisk.riskLevel !== 'low' && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>
                                    <Badge variant="destructive" className="text-xs">
                                        <AlertTriangle className="h-3 w-3 mr-1" />
                                        MEV Risk
                                    </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{mevRisk.recommendation}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Quick Buy Buttons */}
                <div>
                    <div className="text-xs text-muted-foreground mb-2">Buy {tokenSymbol}</div>
                    <div className="grid grid-cols-4 gap-2">
                        {quickAmounts.slice(0, 4).map((amount) => (
                            <TooltipProvider key={amount.label}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full"
                                            disabled={!!loading}
                                            onClick={() => handleQuickBuy(amount.solAmount, amount.label)}
                                        >
                                            {loading === `buy-${amount.label}` ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                                amount.label
                                            )}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Buy with {amount.display}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        ))}
                    </div>
                </div>

                {/* Quick Sell Buttons */}
                <div>
                    <div className="text-xs text-muted-foreground mb-2">Sell {tokenSymbol}</div>
                    <div className="grid grid-cols-4 gap-2">
                        {[25, 50, 75, 100].map((pct) => (
                            <Button
                                key={pct}
                                variant={pct === 100 ? 'destructive' : 'outline'}
                                size="sm"
                                className="w-full"
                                disabled={!!loading}
                                onClick={() => handleQuickSell(pct)}
                            >
                                {loading === `sell-${pct}` ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                    `${pct}%`
                                )}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Protected Trade Option */}
                <div className="pt-2 border-t">
                    <Button
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        disabled={!!loading}
                        onClick={() => handleQuickBuy(0.5, 'protected')}
                    >
                        {loading === 'buy-protected' ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <Shield className="h-4 w-4 mr-2 text-green-500" />
                        )}
                        Protected Buy (0.5 SOL + Jito)
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

export default QuickBuyPresets;
