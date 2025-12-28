/**
 * usePumpStream - Real-time Pump.fun Token Stream Hook
 * 
 * Uses Helius Enhanced WebSocket (transactionSubscribe) to detect new pump.fun token creations.
 * Features:
 * - Auto-reconnect with exponential backoff
 * - 30-second heartbeat handling
 * - Metadata enrichment via Helius DAS API
 * - Deduplication of tokens
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    DataParser,
    HeliusMetadataFetcher,
    TokenEvent,
    ParsedPumpTransaction,
    PUMP_FUN_PROGRAM_ID
} from './DataParser';

// Configuration
const HELIUS_API_KEY = import.meta.env.VITE_HELIUS_API_KEY || '730189a2-3b6f-40d9-be94-4061b26fe2ae';
const HELIUS_WS_URL = `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const HEARTBEAT_INTERVAL = 25000; // 25 seconds (before 30s timeout)
const MAX_RECONNECT_DELAY = 30000; // 30 seconds max
const INITIAL_RECONNECT_DELAY = 1000; // 1 second
const MAX_TOKENS = 100; // Maximum tokens to keep in state

export interface UsePumpStreamOptions {
    autoConnect?: boolean;
    maxTokens?: number;
    onTokenCreated?: (token: TokenEvent) => void;
    onError?: (error: Error) => void;
    onConnectionChange?: (connected: boolean) => void;
}

export interface UsePumpStreamReturn {
    tokens: TokenEvent[];
    connected: boolean;
    connecting: boolean;
    error: string | null;
    connect: () => void;
    disconnect: () => void;
    clearTokens: () => void;
}

export function usePumpStream(options: UsePumpStreamOptions = {}): UsePumpStreamReturn {
    const {
        autoConnect = true,
        maxTokens = MAX_TOKENS,
        onTokenCreated,
        onError,
        onConnectionChange,
    } = options;

    // State
    const [tokens, setTokens] = useState<TokenEvent[]>([]);
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Refs for WebSocket lifecycle
    const wsRef = useRef<WebSocket | null>(null);
    const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY);
    const seenMintsRef = useRef<Set<string>>(new Set());
    const metadataFetcherRef = useRef<HeliusMetadataFetcher | null>(null);
    const mountedRef = useRef(true);

    // Initialize metadata fetcher
    useEffect(() => {
        metadataFetcherRef.current = new HeliusMetadataFetcher(HELIUS_API_KEY);
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // Start heartbeat
    const startHeartbeat = useCallback(() => {
        if (heartbeatRef.current) {
            clearInterval(heartbeatRef.current);
        }

        heartbeatRef.current = setInterval(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ jsonrpc: '2.0', id: 'ping', method: 'ping' }));
            }
        }, HEARTBEAT_INTERVAL);
    }, []);

    // Stop heartbeat
    const stopHeartbeat = useCallback(() => {
        if (heartbeatRef.current) {
            clearInterval(heartbeatRef.current);
            heartbeatRef.current = null;
        }
    }, []);

    // Process a new token
    const processToken = useCallback(async (parsed: ParsedPumpTransaction) => {
        // Deduplicate
        if (seenMintsRef.current.has(parsed.mint)) {
            return;
        }
        seenMintsRef.current.add(parsed.mint);

        // Create initial token event
        const initialToken: TokenEvent = {
            mint: parsed.mint,
            name: 'Loading...',
            symbol: '...',
            image: '',
            mcap: DataParser.calculateInitialMcap(),
            liquidity: DataParser.calculateInitialLiquidity(),
            bondingCurve: parsed.bondingCurve,
            creator: parsed.creator,
            signature: parsed.signature,
            createdAt: parsed.timestamp,
            timeAgo: 'just now',
        };

        // Add to state immediately for fast TTU
        if (mountedRef.current) {
            setTokens(prev => {
                const newTokens = [initialToken, ...prev].slice(0, maxTokens);
                return newTokens;
            });
        }

        // Notify callback
        onTokenCreated?.(initialToken);

        // Enrich with metadata (async)
        try {
            if (metadataFetcherRef.current) {
                const metadata = await metadataFetcherRef.current.getAssetMetadataWithRetry(
                    parsed.mint,
                    3,
                    500
                );

                // Update token with metadata
                if (mountedRef.current) {
                    setTokens(prev => prev.map(t => {
                        if (t.mint === parsed.mint) {
                            return {
                                ...t,
                                name: metadata.name,
                                symbol: metadata.symbol,
                                image: metadata.image,
                            };
                        }
                        return t;
                    }));
                }
            }
        } catch (e) {
            console.warn('Failed to enrich metadata for', parsed.mint, e);
        }
    }, [maxTokens, onTokenCreated]);

    // Handle incoming WebSocket message
    const handleMessage = useCallback((event: MessageEvent) => {
        try {
            const data = JSON.parse(event.data);

            // Ignore ping responses
            if (data.id === 'ping' || data.result === 'pong') {
                return;
            }

            // Check for subscription confirmation
            if (data.result && typeof data.result === 'number') {
                console.log('Helius subscription confirmed, ID:', data.result);
                return;
            }

            // Parse transaction notification
            const parsed = DataParser.parseTransaction(data);
            if (parsed) {
                console.log('New pump.fun token detected:', parsed.mint);
                processToken(parsed);
            }
        } catch (e) {
            console.error('Error handling WebSocket message:', e);
        }
    }, [processToken]);

    // Connect to WebSocket
    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            return;
        }

        setConnecting(true);
        setError(null);

        try {
            console.log('Connecting to Helius WebSocket...');
            const ws = new WebSocket(HELIUS_WS_URL);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('Helius WebSocket connected');
                setConnected(true);
                setConnecting(false);
                setError(null);
                reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
                onConnectionChange?.(true);

                // Start heartbeat
                startHeartbeat();

                // Subscribe to pump.fun transactions
                const subscribeMessage = {
                    jsonrpc: '2.0',
                    id: 420,
                    method: 'transactionSubscribe',
                    params: [
                        {
                            accountInclude: [PUMP_FUN_PROGRAM_ID],
                        },
                        {
                            commitment: 'confirmed',
                            encoding: 'jsonParsed',
                            transactionDetails: 'full',
                            showRewards: false,
                            maxSupportedTransactionVersion: 0,
                        },
                    ],
                };

                ws.send(JSON.stringify(subscribeMessage));
                console.log('Subscribed to pump.fun transactions');
            };

            ws.onmessage = handleMessage;

            ws.onerror = (event) => {
                console.error('Helius WebSocket error:', event);
                const errorMsg = 'WebSocket connection error';
                setError(errorMsg);
                onError?.(new Error(errorMsg));
            };

            ws.onclose = (event) => {
                console.log('Helius WebSocket closed:', event.code, event.reason);
                setConnected(false);
                setConnecting(false);
                onConnectionChange?.(false);
                stopHeartbeat();

                // Auto-reconnect with exponential backoff
                if (mountedRef.current) {
                    const delay = reconnectDelayRef.current;
                    console.log(`Reconnecting in ${delay}ms...`);

                    reconnectTimeoutRef.current = setTimeout(() => {
                        if (mountedRef.current) {
                            connect();
                        }
                    }, delay);

                    // Exponential backoff
                    reconnectDelayRef.current = Math.min(
                        reconnectDelayRef.current * 2,
                        MAX_RECONNECT_DELAY
                    );
                }
            };
        } catch (e) {
            console.error('Failed to create WebSocket:', e);
            setConnecting(false);
            setError('Failed to connect');
            onError?.(e instanceof Error ? e : new Error(String(e)));
        }
    }, [handleMessage, startHeartbeat, stopHeartbeat, onConnectionChange, onError]);

    // Disconnect from WebSocket
    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        stopHeartbeat();

        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        setConnected(false);
        setConnecting(false);
    }, [stopHeartbeat]);

    // Clear tokens
    const clearTokens = useCallback(() => {
        setTokens([]);
        seenMintsRef.current.clear();
    }, []);

    // Update timeAgo periodically
    useEffect(() => {
        const interval = setInterval(() => {
            if (mountedRef.current) {
                setTokens(prev => prev.map(t => ({
                    ...t,
                    timeAgo: DataParser.formatTimeAgo(t.createdAt),
                })));
            }
        }, 5000); // Update every 5 seconds

        return () => clearInterval(interval);
    }, []);

    // Auto-connect on mount
    useEffect(() => {
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

export default usePumpStream;
