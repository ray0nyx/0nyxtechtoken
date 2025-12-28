/**
 * Enhanced Chart Demo Page
 * 
 * Test page for the EnhancedChart component with real-time data,
 * technical indicators, and drawing tools.
 */

import React, { useState, useMemo } from 'react';
import EnhancedChart from '@/components/crypto/EnhancedChart';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useTradingStore } from '@/stores/useTradingStore';
import RealtimeDataSync from '@/components/crypto/RealtimeDataSync';

// Popular Solana tokens for testing
const POPULAR_TOKENS = [
    { name: 'SOL', address: 'So11111111111111111111111111111111111111112' },
    { name: 'BONK', address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
    { name: 'WIF', address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm' },
    { name: 'JUP', address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' },
    { name: 'RAY', address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R' },
];

export default function EnhancedChartDemo() {
    const [tokenAddress, setTokenAddress] = useState(POPULAR_TOKENS[0].address);
    const [customAddress, setCustomAddress] = useState('');
    const [rsiEnabled, setRsiEnabled] = useState(false);
    const [macdEnabled, setMacdEnabled] = useState(false);
    const [smaEnabled, setSmaEnabled] = useState(false);
    const [emaEnabled, setEmaEnabled] = useState(false);
    const [bbEnabled, setBbEnabled] = useState(false);
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);

    // Get store state for display
    const wsStatus = useTradingStore((state) => state.wsStatus);
    const storePrice = useTradingStore((state) => state.currentPrice);
    const marketCap = useTradingStore((state) => state.marketCap);
    const candles = useTradingStore((state) => state.candles);

    const indicators = useMemo(() => ({
        rsi: { enabled: rsiEnabled, period: 14 },
        macd: { enabled: macdEnabled, fast: 12, slow: 26, signal: 9 },
        sma: { enabled: smaEnabled, periods: [20, 50] },
        ema: { enabled: emaEnabled, periods: [12, 26] },
        bollingerBands: { enabled: bbEnabled, period: 20, stdDev: 2 },
    }), [rsiEnabled, macdEnabled, smaEnabled, emaEnabled, bbEnabled]);

    // Calculate chart height based on enabled indicators
    const chartHeight = 500 + (rsiEnabled ? 100 : 0) + (macdEnabled ? 100 : 0);

    const handleCustomToken = () => {
        if (customAddress.length > 30) {
            setTokenAddress(customAddress);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white p-6">
            {/* Real-time data sync component - ensures WebSocket is connected */}
            <RealtimeDataSync tokenAddress={tokenAddress} timeframes={['1m', '5m', '15m', '1h']} />

            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Enhanced Chart Demo</h1>
                        <p className="text-gray-400 text-sm">
                            Real-time data with technical indicators and drawing tools
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="flex items-center gap-2 mb-1">
                            <div className={`w-2 h-2 rounded-full ${wsStatus === 'connected' ? 'bg-green-500' :
                                    wsStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                                        'bg-red-500'
                                }`} />
                            <span className="text-xs text-gray-400">
                                {wsStatus === 'connected' ? 'Connected' :
                                    wsStatus === 'connecting' ? 'Connecting...' :
                                        'Disconnected'}
                            </span>
                        </div>
                        {storePrice > 0 && (
                            <div className="text-lg font-mono text-cyan-400">
                                ${storePrice.toFixed(6)}
                            </div>
                        )}
                        <div className="text-xs text-gray-500">
                            {candles.length} candles loaded
                        </div>
                    </div>
                </div>

                {/* Token Selection */}
                <Card className="p-4 bg-[#12121a] border-white/10">
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex gap-2">
                            {POPULAR_TOKENS.map((token) => (
                                <Button
                                    key={token.address}
                                    variant={tokenAddress === token.address ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setTokenAddress(token.address)}
                                    className={tokenAddress === token.address ? 'bg-cyan-600 hover:bg-cyan-700' : ''}
                                >
                                    {token.name}
                                </Button>
                            ))}
                        </div>
                        <div className="flex-1 flex gap-2 min-w-[300px]">
                            <Input
                                placeholder="Custom token address..."
                                value={customAddress}
                                onChange={(e) => setCustomAddress(e.target.value)}
                                className="flex-1 bg-[#0a0a0f] border-white/20"
                            />
                            <Button onClick={handleCustomToken} variant="outline" size="sm">
                                Load
                            </Button>
                        </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-500 font-mono truncate">
                        Active: {tokenAddress}
                    </div>
                </Card>

                {/* Indicator Controls */}
                <Card className="p-4 bg-[#12121a] border-white/10">
                    <div className="flex flex-wrap gap-6">
                        <div className="flex items-center gap-2">
                            <Switch
                                id="rsi"
                                checked={rsiEnabled}
                                onCheckedChange={setRsiEnabled}
                            />
                            <Label htmlFor="rsi" className="text-sm text-gray-300">
                                RSI (14)
                            </Label>
                        </div>

                        <div className="flex items-center gap-2">
                            <Switch
                                id="macd"
                                checked={macdEnabled}
                                onCheckedChange={setMacdEnabled}
                            />
                            <Label htmlFor="macd" className="text-sm text-gray-300">
                                MACD (12, 26, 9)
                            </Label>
                        </div>

                        <div className="flex items-center gap-2">
                            <Switch
                                id="sma"
                                checked={smaEnabled}
                                onCheckedChange={setSmaEnabled}
                            />
                            <Label htmlFor="sma" className="text-sm text-gray-300">
                                SMA (20, 50)
                            </Label>
                        </div>

                        <div className="flex items-center gap-2">
                            <Switch
                                id="ema"
                                checked={emaEnabled}
                                onCheckedChange={setEmaEnabled}
                            />
                            <Label htmlFor="ema" className="text-sm text-gray-300">
                                EMA (12, 26)
                            </Label>
                        </div>

                        <div className="flex items-center gap-2">
                            <Switch
                                id="bb"
                                checked={bbEnabled}
                                onCheckedChange={setBbEnabled}
                            />
                            <Label htmlFor="bb" className="text-sm text-gray-300">
                                Bollinger Bands
                            </Label>
                        </div>
                    </div>
                </Card>

                {/* Instructions */}
                <Card className="p-4 bg-[#12121a] border-white/10">
                    <h3 className="text-sm font-medium text-cyan-400 mb-2">Drawing Tools Instructions</h3>
                    <ul className="text-xs text-gray-400 space-y-1">
                        <li>• <span className="text-white">H</span> - Horizontal Line: Click to place a line at that price</li>
                        <li>• <span className="text-white">T</span> - Trendline: Click twice to draw a line between two points</li>
                        <li>• <span className="text-white">R</span> - Ray: Click twice to create a ray extending to the right</li>
                        <li>• <span className="text-white">Esc</span> - Return to cursor mode</li>
                        <li>• <span className="text-white">+/-</span> - Zoom in/out</li>
                        <li>• Click the trash icon to clear all drawings</li>
                    </ul>
                </Card>

                {/* Chart */}
                <Card className="overflow-hidden border-white/10">
                    <EnhancedChart
                        tokenAddress={tokenAddress}
                        height={chartHeight}
                        theme="dark"
                        showVolume={true}
                        showDrawingTools={true}
                        indicators={indicators}
                        onPriceUpdate={setCurrentPrice}
                    />
                </Card>

                {/* Debug Info */}
                <Card className="p-4 bg-[#12121a] border-white/10">
                    <h3 className="text-sm font-medium text-cyan-400 mb-2">Debug Info</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                        <div>
                            <div className="text-gray-500">WebSocket Status</div>
                            <div className="text-white">{wsStatus}</div>
                        </div>
                        <div>
                            <div className="text-gray-500">Current Price</div>
                            <div className="text-white">${storePrice.toFixed(8)}</div>
                        </div>
                        <div>
                            <div className="text-gray-500">Market Cap</div>
                            <div className="text-white">${marketCap.toLocaleString()}</div>
                        </div>
                        <div>
                            <div className="text-gray-500">Candles Loaded</div>
                            <div className="text-white">{candles.length}</div>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
