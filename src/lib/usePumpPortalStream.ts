/**
 * usePumpPortalStream - React hook for PumpPortal WebSocket real-time token data
 * 
 * Uses a SINGLE WebSocket connection at wss://pumpportal.fun/api/data
 * All subscriptions should be sent through the same connection.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { proxyImageUrl } from './ipfs-utils';

const WS_URL = 'wss://pumpportal.fun/api/data';
const WS_RECONNECT_DELAY = 3000;
const WS_MAX_RECONNECT_DELAY = 30000;
const HEARTBEAT_TIMEOUT = 45000;

export interface PumpPortalToken {
    mint: string;
    name: string;
    symbol: string;
    uri?: string;
    image_uri?: string;
    description?: string;
    twitter?: string;
    telegram?: string;
    website?: string;
    signature?: string;
    traderPublicKey?: string;
    bondingCurveKey?: string;
    vTokensInBondingCurve?: number;
    vSolInBondingCurve?: number;
    marketCapSol?: number;
    pool?: string;
    initialBuy?: number;
}

export interface PumpPortalTrade {
    signature: string;
    mint: string;
    traderPublicKey: string;
    txType: 'buy' | 'sell';
    tokenAmount: number;
    vSolInBondingCurve: number;
    vTokensInBondingCurve: number;
    marketCapSol: number;
    newTokenBalance?: number;
    bondingCurveKey?: string;
    pool?: string;
}

export interface UsePumpPortalStreamOptions {
    autoConnect?: boolean;
    subscribeToNewTokens?: boolean;
    onTokenCreated?: (token: PumpPortalToken) => void;
    onTrade?: (trade: PumpPortalTrade) => void;
    onConnectionChange?: (connected: boolean) => void;
}

export interface UsePumpPortalStreamReturn {
    tokens: PumpPortalToken[];
    trades: PumpPortalTrade[];
    connected: boolean;
    connecting: boolean;
    error: string | null;
    connect: () => void;
    disconnect: () => void;
    subscribeToToken: (mint: string) => void;
    unsubscribeFromToken: (mint: string) => void;
    clearTokens: () => void;
}

// Global singleton WebSocket to ensure only ONE connection
let globalWs: WebSocket | null = null;
let globalListeners: Set<(data: any) => void> = new Set();
let globalConnectedState = false;
let globalConnectingState = false;
let globalReconnectTimeout: NodeJS.Timeout | null = null;
let globalHeartbeatTimeout: NodeJS.Timeout | null = null;
let globalReconnectDelay = WS_RECONNECT_DELAY;

function resetHeartbeat() {
    if (globalHeartbeatTimeout) {
        clearTimeout(globalHeartbeatTimeout);
    }
    globalHeartbeatTimeout = setTimeout(() => {
        console.warn('PumpPortal WebSocket heartbeat timeout, reconnecting...');
        globalWs?.close();
    }, HEARTBEAT_TIMEOUT);
}

function connectGlobalWs() {
    if (globalWs?.readyState === WebSocket.OPEN || globalConnectingState) return;

    globalConnectingState = true;

    console.log('Connecting to PumpPortal WebSocket:', WS_URL);

    try {
        globalWs = new WebSocket(WS_URL);

        globalWs.onopen = () => {
            console.log('PumpPortal WebSocket connected');
            globalConnectedState = true;
            globalConnectingState = false;
            globalReconnectDelay = WS_RECONNECT_DELAY;
            resetHeartbeat();

            // Notify all listeners
            globalListeners.forEach(listener => {
                listener({ type: 'connected' });
            });

            // Subscribe to new tokens by default
            globalWs?.send(JSON.stringify({ method: 'subscribeNewToken' }));
        };

        globalWs.onmessage = (event) => {
            resetHeartbeat();

            try {
                const data = JSON.parse(event.data);

                // Broadcast to all listeners
                globalListeners.forEach(listener => {
                    listener(data);
                });
            } catch (e) {
                console.error('Error parsing PumpPortal message:', e);
            }
        };

        globalWs.onerror = (event) => {
            console.error('PumpPortal WebSocket error:', event);
        };

        globalWs.onclose = (event) => {
            console.log('PumpPortal WebSocket closed:', event.code, event.reason);
            globalConnectedState = false;
            globalConnectingState = false;

            if (globalHeartbeatTimeout) {
                clearTimeout(globalHeartbeatTimeout);
            }

            // Notify all listeners
            globalListeners.forEach(listener => {
                listener({ type: 'disconnected' });
            });

            // Auto-reconnect
            if (globalListeners.size > 0) {
                console.log(`PumpPortal reconnecting in ${globalReconnectDelay}ms...`);
                globalReconnectTimeout = setTimeout(() => {
                    connectGlobalWs();
                }, globalReconnectDelay);

                globalReconnectDelay = Math.min(
                    globalReconnectDelay * 1.5,
                    WS_MAX_RECONNECT_DELAY
                );
            }
        };
    } catch (e) {
        console.error('Failed to create PumpPortal WebSocket:', e);
        globalConnectingState = false;
    }
}

function disconnectGlobalWs() {
    if (globalReconnectTimeout) {
        clearTimeout(globalReconnectTimeout);
        globalReconnectTimeout = null;
    }
    if (globalHeartbeatTimeout) {
        clearTimeout(globalHeartbeatTimeout);
        globalHeartbeatTimeout = null;
    }
    if (globalWs) {
        globalWs.close();
        globalWs = null;
    }
    globalConnectedState = false;
    globalConnectingState = false;
}

export function usePumpPortalStream(
    options: UsePumpPortalStreamOptions = {}
): UsePumpPortalStreamReturn {
    const {
        autoConnect = true,
        subscribeToNewTokens = true,
        onTokenCreated,
        onTrade,
        onConnectionChange,
    } = options;

    const [tokens, setTokens] = useState<PumpPortalToken[]>([]);
    const [trades, setTrades] = useState<PumpPortalTrade[]>([]);
    const [connected, setConnected] = useState(globalConnectedState);
    const [connecting, setConnecting] = useState(globalConnectingState);
    const [error, setError] = useState<string | null>(null);

    const mountedRef = useRef(true);
    const onTokenCreatedRef = useRef(onTokenCreated);
    const onTradeRef = useRef(onTrade);
    const onConnectionChangeRef = useRef(onConnectionChange);

    // Keep refs updated
    useEffect(() => {
        onTokenCreatedRef.current = onTokenCreated;
        onTradeRef.current = onTrade;
        onConnectionChangeRef.current = onConnectionChange;
    });

    // Handle incoming messages
    const handleMessage = useCallback((data: any) => {
        if (!mountedRef.current) return;

        if (data.type === 'connected') {
            setConnected(true);
            setConnecting(false);
            onConnectionChangeRef.current?.(true);
            return;
        }

        if (data.type === 'disconnected') {
            setConnected(false);
            onConnectionChangeRef.current?.(false);
            return;
        }

        // New token creation event
        if (data.mint && data.name && !data.txType) {
            const token: PumpPortalToken = {
                mint: data.mint,
                name: data.name,
                symbol: data.symbol || '',
                uri: data.uri,
                image_uri: proxyImageUrl(data.uri),
                description: data.description,
                twitter: data.twitter,
                telegram: data.telegram,
                website: data.website,
                signature: data.signature,
                traderPublicKey: data.traderPublicKey,
                bondingCurveKey: data.bondingCurveKey,
                vTokensInBondingCurve: data.vTokensInBondingCurve,
                vSolInBondingCurve: data.vSolInBondingCurve,
                marketCapSol: data.marketCapSol,
                pool: data.pool,
                initialBuy: data.initialBuy,
            };

            setTokens(prev => {
                // Avoid duplicates
                if (prev.some(t => t.mint === token.mint)) return prev;
                // Keep max 50 tokens, newest first
                return [token, ...prev].slice(0, 50);
            });

            onTokenCreatedRef.current?.(token);
        }

        // Trade event
        if (data.txType && data.mint) {
            const trade: PumpPortalTrade = {
                signature: data.signature,
                mint: data.mint,
                traderPublicKey: data.traderPublicKey,
                txType: data.txType,
                tokenAmount: data.tokenAmount,
                vSolInBondingCurve: data.vSolInBondingCurve,
                vTokensInBondingCurve: data.vTokensInBondingCurve,
                marketCapSol: data.marketCapSol,
                newTokenBalance: data.newTokenBalance,
                bondingCurveKey: data.bondingCurveKey,
                pool: data.pool,
            };

            setTrades(prev => [trade, ...prev].slice(0, 100));
            onTradeRef.current?.(trade);
        }
    }, []);

    // Connect on mount
    useEffect(() => {
        mountedRef.current = true;
        globalListeners.add(handleMessage);

        // Sync local state with global state
        setConnected(globalConnectedState);
        setConnecting(globalConnectingState);

        if (autoConnect && globalListeners.size === 1) {
            // First listener, connect the global WebSocket
            connectGlobalWs();
        }

        return () => {
            mountedRef.current = false;
            globalListeners.delete(handleMessage);

            // If no more listeners, disconnect
            if (globalListeners.size === 0) {
                disconnectGlobalWs();
            }
        };
    }, [autoConnect, handleMessage]);

    const connect = useCallback(() => {
        connectGlobalWs();
    }, []);

    const disconnect = useCallback(() => {
        globalListeners.delete(handleMessage);
        if (globalListeners.size === 0) {
            disconnectGlobalWs();
        }
    }, [handleMessage]);

    const subscribeToToken = useCallback((mint: string) => {
        if (globalWs?.readyState === WebSocket.OPEN) {
            globalWs.send(JSON.stringify({
                method: 'subscribeTokenTrade',
                keys: [mint]
            }));
        }
    }, []);

    const unsubscribeFromToken = useCallback((mint: string) => {
        if (globalWs?.readyState === WebSocket.OPEN) {
            globalWs.send(JSON.stringify({
                method: 'unsubscribeTokenTrade',
                keys: [mint]
            }));
        }
    }, []);

    const clearTokens = useCallback(() => {
        setTokens([]);
        setTrades([]);
    }, []);

    return {
        tokens,
        trades,
        connected,
        connecting,
        error,
        connect,
        disconnect,
        subscribeToToken,
        unsubscribeFromToken,
        clearTokens,
    };
}

export default usePumpPortalStream;
