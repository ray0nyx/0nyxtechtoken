/**
 * SurgePage Integration Example
 * 
 * This file demonstrates how to integrate the usePumpStream hook
 * with your existing SurgePage component.
 */

import React, { useMemo } from 'react';
import { usePumpStream, TokenEvent } from '@/lib/helius';

// Example integration with your existing AxiomSurgePage
export function SurgePageExample() {
    // Use the Helius pump stream hook
    const {
        tokens,
        connected,
        connecting,
        error,
        clearTokens,
    } = usePumpStream({
        autoConnect: true,
        maxTokens: 100,
        onTokenCreated: (token) => {
            console.log('New token created:', token.mint, token.name);
        },
        onConnectionChange: (isConnected) => {
            console.log('Stream connection:', isConnected ? 'connected' : 'disconnected');
        },
    });

    // Transform tokens for your UI (if needed)
    const displayTokens = useMemo(() => {
        return tokens.map(token => ({
            ...token,
            // Add any additional transformations for your UI here
            formattedMcap: formatMcap(token.mcap),
        }));
    }, [tokens]);

    return (
        <div className="surge-page">
            {/* Connection Status */}
            <div className="flex items-center gap-2 mb-4">
                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : connecting ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />
                <span className="text-sm text-muted-foreground">
                    {connected ? 'Live' : connecting ? 'Connecting...' : 'Disconnected'}
                </span>
                {error && <span className="text-sm text-red-500">Error: {error}</span>}
            </div>

            {/* Token Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayTokens.map((token) => (
                    <TokenCard key={token.mint} token={token} />
                ))}
            </div>

            {/* Empty State */}
            {tokens.length === 0 && connected && (
                <div className="text-center text-muted-foreground py-12">
                    Waiting for new pump.fun tokens...
                </div>
            )}
        </div>
    );
}

// Token card component
function TokenCard({ token }: { token: TokenEvent & { formattedMcap: string } }) {
    return (
        <div className="p-4 border rounded-lg hover:border-primary transition-colors">
            <div className="flex items-center gap-3">
                {token.image ? (
                    <img
                        src={token.image}
                        alt={token.symbol}
                        className="w-10 h-10 rounded-full object-cover"
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                        }}
                    />
                ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <span className="text-white font-bold text-sm">
                            {token.symbol.slice(0, 2)}
                        </span>
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{token.name}</div>
                    <div className="text-sm text-muted-foreground">{token.symbol}</div>
                </div>
                <div className="text-right">
                    <div className="text-sm font-medium">{token.formattedMcap}</div>
                    <div className="text-xs text-muted-foreground">{token.timeAgo}</div>
                </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground truncate">
                {token.mint}
            </div>
        </div>
    );
}

// Utility function
function formatMcap(mcap: number): string {
    if (mcap >= 1_000_000) return `$${(mcap / 1_000_000).toFixed(2)}M`;
    if (mcap >= 1_000) return `$${(mcap / 1_000).toFixed(1)}K`;
    return `$${mcap.toFixed(0)}`;
}

export default SurgePageExample;
