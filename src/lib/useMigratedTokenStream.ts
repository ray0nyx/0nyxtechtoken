/**
 * useMigratedTokenStream - React hook for real-time migrated token updates
 * 
 * Connects to the backend WebSocket at /ws/migrated-tokens to receive
 * updates on tokens graduating from Pump.fun bonding curve to Raydium.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { type PumpFunCoin } from './pump-fun-service';
import { proxyImageUrl } from './ipfs-utils';

const WS_RECONNECT_DELAY = 3000;
const WS_MAX_RECONNECT_DELAY = 30000;
const HEARTBEAT_TIMEOUT = 45000;

export interface UseMigratedTokenStreamOptions {
    autoConnect?: boolean;
    maxTokens?: number;
    onNewMigration?: (token: PumpFunCoin) => void;
    onConnectionChange?: (connected: boolean) => void;
}

export interface UseMigratedTokenStreamReturn {
    tokens: PumpFunCoin[];
    connected: boolean;
    connecting: boolean;
    error: string | null;
    connect: () => void;
    disconnect: () => void;
    refresh: () => void;
}

export function useMigratedTokenStream(
    options: UseMigratedTokenStreamOptions = {}
): UseMigratedTokenStreamReturn {
    const {
        autoConnect = true,
        maxTokens = 30,
        onNewMigration,
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
            console.warn('Migrated tokens WebSocket heartbeat timeout, reconnecting...');
            wsRef.current?.close();
        }, HEARTBEAT_TIMEOUT);
    }, []);

    // Process and add a single token (prepend to list)
    const addToken = useCallback((token: PumpFunCoin) => {
        const processedToken = {
            ...token,
            image_uri: proxyImageUrl(token.image_uri),
        };

        setTokens(prev => {
            // Prepend new token, remove duplicates, limit size
            const filtered = prev.filter(t => t.mint !== processedToken.mint);
            return [processedToken, ...filtered].slice(0, maxTokens);
        });

        onNewMigration?.(processedToken);
    }, [maxTokens, onNewMigration]);

    // Process token list (for initial load / refresh)
    const processTokens = useCallback((newTokens: PumpFunCoin[]) => {
        if (!Array.isArray(newTokens)) return;

        // Apply image proxy to all tokens
        const processedTokens = newTokens.map(token => ({
            ...token,
            image_uri: proxyImageUrl(token.image_uri),
        }));

        if (mountedRef.current) {
            setTokens(processedTokens.slice(0, maxTokens));
        }
    }, [maxTokens]);

    // Connect to WebSocket
    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        setConnecting(true);
        setError(null);

        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001';
        const wsUrl = apiUrl.replace('http', 'ws') + '/ws/migrated-tokens';

        console.log('Connecting to migrated tokens stream:', wsUrl);

        try {
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('Connected to migrated tokens stream');
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
                            console.log('Migrated stream connected:', data.message);
                            break;

                        case 'initial_tokens':
                            console.log(`Received ${data.tokens?.length || 0} initial migrated tokens`);
                            if (data.tokens) {
                                processTokens(data.tokens);
                            }
                            break;

                        case 'migration_update':
                            console.log(`Received migration update: ${data.tokens?.length || 0} tokens`);
                            if (data.tokens) {
                                processTokens(data.tokens);
                            }
                            break;

                        case 'new_migration':
                            console.log(`New migration event: ${data.token?.symbol || data.token?.mint}`);
                            if (data.token) {
                                addToken(data.token);
                            }
                            break;

                        case 'heartbeat':
                        case 'pong':
                            // Server heartbeat
                            break;

                        case 'error':
                            console.error('Migrated stream error:', data.message);
                            setError(data.message);
                            break;
                    }
                } catch (e) {
                    console.error('Error parsing migrated tokens WebSocket message:', e);
                }
            };

            ws.onerror = (event) => {
                console.error('Migrated tokens WebSocket error:', event);
                setError('Connection error');
            };

            ws.onclose = (event) => {
                console.log('Migrated tokens WebSocket closed:', event.code, event.reason);
                setConnected(false);
                setConnecting(false);
                onConnectionChange?.(false);

                if (heartbeatTimeoutRef.current) {
                    clearTimeout(heartbeatTimeoutRef.current);
                }

                // Auto-reconnect
                if (mountedRef.current) {
                    console.log(`Reconnecting migrated stream in ${reconnectDelayRef.current}ms...`);
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
            console.error('Failed to create migrated tokens WebSocket:', e);
            setConnecting(false);
            setError('Failed to connect');
        }
    }, [onConnectionChange, processTokens, addToken, resetHeartbeat]);

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

export default useMigratedTokenStream;
