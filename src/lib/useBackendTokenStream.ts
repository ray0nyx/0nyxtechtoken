/**
 * useBackendTokenStream - React hook for real-time Pump.fun token updates
 * 
 * Connects to the backend WebSocket at /ws/pump-tokens to receive
 * new token notifications as they're created on Pump.fun.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { type PumpFunCoin } from './pump-fun-service';
import { proxyImageUrl } from './ipfs-utils';

const WS_RECONNECT_DELAY = 3000;
const WS_MAX_RECONNECT_DELAY = 30000;
const HEARTBEAT_TIMEOUT = 35000; // Slightly longer than server's 30s heartbeat

export interface UseBackendTokenStreamOptions {
    autoConnect?: boolean;
    maxTokens?: number;
    onTokenCreated?: (token: PumpFunCoin) => void;
    onConnectionChange?: (connected: boolean) => void;
}

export interface UseBackendTokenStreamReturn {
    tokens: PumpFunCoin[];
    connected: boolean;
    connecting: boolean;
    error: string | null;
    connect: () => void;
    disconnect: () => void;
    clearTokens: () => void;
}

export function useBackendTokenStream(
    options: UseBackendTokenStreamOptions = {}
): UseBackendTokenStreamReturn {
    const {
        autoConnect = true,
        maxTokens = 50,
        onTokenCreated,
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
    const seenMintsRef = useRef<Set<string>>(new Set());
    const mountedRef = useRef(true);

    // Reset heartbeat timer
    const resetHeartbeat = useCallback(() => {
        if (heartbeatTimeoutRef.current) {
            clearTimeout(heartbeatTimeoutRef.current);
        }
        heartbeatTimeoutRef.current = setTimeout(() => {
            console.warn('WebSocket heartbeat timeout, reconnecting...');
            wsRef.current?.close();
        }, HEARTBEAT_TIMEOUT);
    }, []);

    // Process incoming token
    const processToken = useCallback((token: PumpFunCoin) => {
        if (!token.mint) return;

        // Deduplicate
        if (seenMintsRef.current.has(token.mint)) return;
        seenMintsRef.current.add(token.mint);

        // Apply image proxy
        const processedToken: PumpFunCoin = {
            ...token,
            image_uri: proxyImageUrl(token.image_uri),
        };

        // Add to state
        if (mountedRef.current) {
            setTokens(prev => {
                const newTokens = [processedToken, ...prev].slice(0, maxTokens);
                return newTokens;
            });
        }

        // Notify callback
        onTokenCreated?.(processedToken);
    }, [maxTokens, onTokenCreated]);

    // Connect to WebSocket
    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        setConnecting(true);
        setError(null);

        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001';
        const wsUrl = apiUrl.replace('http', 'ws') + '/ws/pump-tokens';

        console.log('Connecting to backend token stream:', wsUrl);

        try {
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('Connected to backend token stream');
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
                            console.log('Backend stream connected:', data.message);
                            break;

                        case 'stream_status':
                            console.log('Stream status:', data.connected ? 'active' : 'inactive');
                            break;

                        case 'initial_tokens':
                            // Process initial batch
                            if (data.tokens && Array.isArray(data.tokens)) {
                                console.log(`Received ${data.tokens.length} initial tokens`);
                                data.tokens.forEach((token: PumpFunCoin) => {
                                    processToken(token);
                                });
                            }
                            break;

                        case 'new_token':
                            // New token created
                            if (data.token) {
                                console.log('New token:', data.token.symbol || data.token.mint?.slice(0, 8));
                                processToken(data.token);
                            }
                            break;

                        case 'heartbeat':
                        case 'pong':
                            // Server heartbeat, keep connection alive
                            break;

                        case 'error':
                            console.error('Stream error:', data.message);
                            setError(data.message);
                            break;
                    }
                } catch (e) {
                    console.error('Error parsing WebSocket message:', e);
                }
            };

            ws.onerror = (event) => {
                console.error('WebSocket error:', event);
                setError('Connection error');
            };

            ws.onclose = (event) => {
                console.log('WebSocket closed:', event.code, event.reason);
                setConnected(false);
                setConnecting(false);
                onConnectionChange?.(false);

                if (heartbeatTimeoutRef.current) {
                    clearTimeout(heartbeatTimeoutRef.current);
                }

                // Auto-reconnect
                if (mountedRef.current) {
                    console.log(`Reconnecting in ${reconnectDelayRef.current}ms...`);
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
            console.error('Failed to create WebSocket:', e);
            setConnecting(false);
            setError('Failed to connect');
        }
    }, [onConnectionChange, processToken, resetHeartbeat]);

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

    // Clear tokens
    const clearTokens = useCallback(() => {
        setTokens([]);
        seenMintsRef.current.clear();
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
        clearTokens,
    };
}

export default useBackendTokenStream;
