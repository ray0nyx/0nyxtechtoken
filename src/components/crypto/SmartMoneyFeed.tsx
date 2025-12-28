/**
 * Smart Money Feed Component
 * 
 * Displays Twitter signals and whale swap events
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Twitter, TrendingUp, Wallet } from 'lucide-react';
import { subscribeToPulseUpdates } from '@/lib/sse-service';

interface SmartMoneySignal {
  account: string;
  account_handle: string;
  token_address?: string;
  token_symbol?: string;
  signal_type: 'buy' | 'sell' | 'hold' | 'mention';
  confidence: number;
  timestamp: number;
  tweet_id?: string;
  tweet_url?: string;
}

interface WhaleSwap {
  wallet_address: string;
  token_in: string;
  token_out: string;
  amount_usd: number;
  signature: string;
  timestamp: number;
  dex: string;
}

export default function SmartMoneyFeed() {
  const [twitterSignals, setTwitterSignals] = useState<SmartMoneySignal[]>([]);
  const [whaleSwaps, setWhaleSwaps] = useState<WhaleSwap[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Subscribe to smart money signals from Redis/WebSocket
    // This would connect to the backend WebSocket or SSE stream
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001';
    
    // For now, use placeholder - would connect to actual WebSocket
    setIsConnected(true);
    
    // In production, would subscribe to:
    // - WebSocket: ws://localhost:8001/ws/smart-money
    // - Or SSE: /api/sse/smart-money
    
    return () => {
      // Cleanup
    };
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Smart Money Feed
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Real-time signals from Twitter and whale swaps
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <div
              className={`h-2 w-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-sm text-muted-foreground">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          <Tabs defaultValue="twitter" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="twitter">
                <Twitter className="h-4 w-4 mr-2" />
                Twitter Signals ({twitterSignals.length})
              </TabsTrigger>
              <TabsTrigger value="whales">
                <Wallet className="h-4 w-4 mr-2" />
                Whale Swaps ({whaleSwaps.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="twitter" className="mt-4">
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {twitterSignals.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No Twitter signals yet
                  </p>
                ) : (
                  twitterSignals.map((signal, index) => (
                    <Card key={index} className="mb-2">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold">@{signal.account_handle}</span>
                              <Badge
                                variant={
                                  signal.signal_type === 'buy'
                                    ? 'default'
                                    : signal.signal_type === 'sell'
                                    ? 'destructive'
                                    : 'outline'
                                }
                              >
                                {signal.signal_type.toUpperCase()}
                              </Badge>
                              <Badge variant="outline">
                                {Math.round(signal.confidence * 100)}% confidence
                              </Badge>
                            </div>
                            {signal.token_symbol && (
                              <p className="text-sm text-muted-foreground">
                                Token: {signal.token_symbol}
                              </p>
                            )}
                            {signal.tweet_url && (
                              <a
                                href={signal.tweet_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-500 hover:underline"
                              >
                                View Tweet →
                              </a>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="whales" className="mt-4">
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {whaleSwaps.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No whale swaps detected yet
                  </p>
                ) : (
                  whaleSwaps.map((swap, index) => (
                    <Card key={index} className="mb-2">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-xs">
                                {swap.wallet_address.slice(0, 8)}...
                              </span>
                              <Badge variant="outline">{swap.dex}</Badge>
                            </div>
                            <p className="text-sm">
                              {swap.token_in} → {swap.token_out}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              ${swap.amount_usd.toLocaleString()}
                            </p>
                            <a
                              href={`https://solscan.io/tx/${swap.signature}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-500 hover:underline"
                            >
                              View Transaction →
                            </a>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
