/**
 * useBackendTrendingStream - React hook for real-time trending token updates
 * 
 * Connects to the backend WebSocket at /ws/trending-tokens to receive
 * updates on trending tokens with high market cap and liquidity.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { type PumpFunCoin } from './pump-fun-service';
import { proxyImageUrl } from './ipfs-utils';

const WS_RECONNECT_DELAY = 3000;
const WS_MAX_RECONNECT_DELAY = 30000;
const HEARTBEAT_TIMEOUT = 45000; // Server refreshes every 30s, give it some breathing room

export interface UseBackendTrendingStreamOptions {
    autoConnect?: boolean;
    onUpdate?: (tokens: PumpFunCoin[]) => void;
    onConnectionChange?: (connected: boolean) => void;
}

export interface UseBackendTrendingStreamReturn {
    tokens: PumpFunCoin[];
    connected: boolean;
    connecting: boolean;
    error: string | null;
    connect: () => void;
    disconnect: () => void;
    refresh: () => void;
}

export function useBackendTrendingStream(
    options: UseBackendTrendingStreamOptions = {}
): UseBackendTrendingStreamReturn {
    const {
        autoConnect = true,
        onUpdate,
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

    // Process token list
    const processTokens = useCallback((newTokens: PumpFunCoin[]) => {
        if (!Array.isArray(newTokens)) return;

        // Apply image proxy to all tokens
        const processedTokens = newTokens.map(token => ({
            ...token,
            image_uri: proxyImageUrl(token.image_uri),
        }));

        if (mountedRef.current) {
            setTokens(processedTokens);
        }

        // Notify callback
        onUpdate?.(processedTokens);
    }, [onUpdate]);

    // Connect to WebSocket
    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        setConnecting(true);
        setError(null);

        const apiUrl = 'http://localhost:8001'; // Force local backend for debugging
        const wsUrl = apiUrl.replace('http', 'ws') + '/ws/trending-tokens';

        console.log('Connecting to backend trending stream:', wsUrl);

        try {
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('Connected to backend trending stream');
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
                            console.log(`Received ${data.tokens?.length || 0} initial trending tokens`);
                            if (data.tokens) {
                                processTokens(data.tokens);
                            }
                            break;

                        case 'trending_update':
                            console.log(`Received trending update: ${data.tokens?.length || 0} tokens`);
                            if (data.tokens) {
                                processTokens(data.tokens);
                            }
                            break;

                        case 'heartbeat':
                        case 'pong':
                            // Server heartbeat
                            break;

                        case 'error':
                            console.error('Trending stream error:', data.message);
                            setError(data.message);
                            break;
                    }
                } catch (e) {
                    console.error('Error parsing Trending WebSocket message:', e);
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
                    console.log(`Reconnecting trending stream in ${reconnectDelayRef.current}ms...`);
                    reconnectTimeoutRef.current = setTimeout(() => {
                        if (mountedRef.current) {
                            connect();
                        }
                    }, reconnectDelayRef.current);

                    // Exponential backoff
                    reconnectDelayRef.current = Math.min(
                        reconnectDelayRef.current * 1.5,
                        WS_MAX_RECONNECT_DELAY
                    );
                }
            };
        } catch (e) {
            console.error('Failed to create Trending WebSocket:', e);
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
        } else {
            connect();
        }
    }, [connect]);

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
    }, [autoConnect, connect, disconnect]);

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

export default useBackendTrendingStream;
