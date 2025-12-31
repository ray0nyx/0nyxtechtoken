/**
 * useTrendingTokenStream - React hook for real-time trending token updates
 * 
 * Connects to the backend WebSocket at /ws/trending-tokens to receive
 * trending tokens with high market cap, updated every 30 seconds.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { type PumpFunCoin } from './pump-fun-service';
import { proxyImageUrl } from './ipfs-utils';

const WS_RECONNECT_DELAY = 3000;
const WS_MAX_RECONNECT_DELAY = 30000;
const HEARTBEAT_TIMEOUT = 45000; // Slightly longer since trending updates every 30s

export interface UseTrendingTokenStreamOptions {
    autoConnect?: boolean;
    onConnectionChange?: (connected: boolean) => void;
}

export interface UseTrendingTokenStreamReturn {
    tokens: PumpFunCoin[];
    connected: boolean;
    connecting: boolean;
    error: string | null;
    connect: () => void;
    disconnect: () => void;
    refresh: () => void;
}

export function useTrendingTokenStream(
    options: UseTrendingTokenStreamOptions = {}
): UseTrendingTokenStreamReturn {
    const {
        autoConnect = true,
        onConnectionChange,
    } = options;

    const [tokens, setTokens] = useState<PumpFunCoin[]>([]);
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectDelayRef = useRef(WS_RECONNECT_DELAY);
    const mountedRef = useRef(true);

    // Reset heartbeat timer
    const resetHeartbeat = useCallback(() => {
        if (heartbeatTimeoutRef.current) {
            clearTimeout(heartbeatTimeoutRef.current);
        }
        heartbeatTimeoutRef.current = setTimeout(() => {
            console.warn('Trending WebSocket heartbeat timeout, reconnecting...');
            wsRef.current?.close();
        }, HEARTBEAT_TIMEOUT);
    }, []);

    // Process incoming tokens
    const processTokens = useCallback((rawTokens: PumpFunCoin[]) => {
        const processed = rawTokens.map(token => ({
            ...token,
            image_uri: proxyImageUrl(token.image_uri),
        }));

        // Sort by market cap (highest first)
        processed.sort((a, b) => (b.usd_market_cap || 0) - (a.usd_market_cap || 0));

        if (mountedRef.current) {
            setTokens(processed);
        }
    }, []);

    // Connect to WebSocket
    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        setConnecting(true);
        setError(null);

        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001';
        const wsUrl = apiUrl.replace('http', 'ws') + '/ws/trending-tokens';

        console.log('Connecting to trending tokens stream:', wsUrl);

        try {
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('Connected to trending tokens stream');
                setConnected(true);
                setConnecting(false);
                setError(null);
                reconnectDelayRef.current = WS_RECONNECT_DELAY;
                onConnectionChange?.(true);
                resetHeartbeat();
            };

            ws.onmessage = (event) => {
                resetHeartbeat();

                try {
                    const data = JSON.parse(event.data);

                    switch (data.type) {
                        case 'connected':
                            console.log('Trending stream connected:', data.message);
                            break;

                        case 'initial_tokens':
                        case 'trending_update':
                            if (data.tokens && Array.isArray(data.tokens)) {
                                console.log(`Received ${data.tokens.length} trending tokens`);
                                processTokens(data.tokens);
                            }
                            break;

                        case 'heartbeat':
                        case 'pong':
                            break;

                        case 'error':
                            console.error('Trending stream error:', data.message);
                            setError(data.message);
                            break;
                    }
                } catch (e) {
                    console.error('Error parsing trending WebSocket message:', e);
                }
            };

            ws.onerror = (event) => {
                console.error('Trending WebSocket error:', event);
                setError('Connection error');
            };

            ws.onclose = (event) => {
                console.log('Trending WebSocket closed:', event.code, event.reason);
                setConnected(false);
                setConnecting(false);
                onConnectionChange?.(false);

                if (heartbeatTimeoutRef.current) {
                    clearTimeout(heartbeatTimeoutRef.current);
                }

                // Auto-reconnect
                if (mountedRef.current) {
                    console.log(`Reconnecting trending in ${reconnectDelayRef.current}ms...`);
                    reconnectTimeoutRef.current = setTimeout(() => {
                        if (mountedRef.current) {
                            connect();
                        }
                    }, reconnectDelayRef.current);

                    reconnectDelayRef.current = Math.min(
                        reconnectDelayRef.current * 1.5,
                        WS_MAX_RECONNECT_DELAY
                    );
                }
            };
        } catch (e) {
            console.error('Failed to create trending WebSocket:', e);
            setConnecting(false);
            setError('Failed to connect');
        }
    }, [onConnectionChange, processTokens, resetHeartbeat]);

    // Disconnect
    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        if (heartbeatTimeoutRef.current) {
            clearTimeout(heartbeatTimeoutRef.current);
            heartbeatTimeoutRef.current = null;
        }
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        setConnected(false);
        setConnecting(false);
    }, []);

    // Manual refresh
    const refresh = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'refresh' }));
        }
    }, []);

    // Auto-connect on mount
    useEffect(() => {
        mountedRef.current = true;

        if (autoConnect) {
            connect();
        }

        return () => {
            mountedRef.current = false;
            disconnect();
        };
    }, [autoConnect]); // eslint-disable-line react-hooks/exhaustive-deps

    return {
        tokens,
        connected,
        connecting,
        error,
        connect,
        disconnect,
        refresh,
    };
}

export default useTrendingTokenStream;
