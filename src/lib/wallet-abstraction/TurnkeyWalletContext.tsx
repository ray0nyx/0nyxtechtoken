/**
 * Turnkey Wallet Context
 * 
 * Provides app-wide wallet state management for Turnkey wallets.
 * Handles wallet loading, signing, and connection state.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { getTurnkeyService, type TurnkeyWallet } from './turnkey-service';
import { createTurnkeyWalletAdapter, type TurnkeyWalletAdapter } from './turnkey-wallet';

interface TurnkeyWalletContextValue {
    // Wallet state
    wallet: TurnkeyWallet | null;
    adapter: TurnkeyWalletAdapter | null;
    publicKey: PublicKey | null;
    connected: boolean;
    connecting: boolean;
    loading: boolean;
    error: string | null;

    // Actions
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    createWallet: (email: string) => Promise<string>;
    signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
    signAllTransactions: (txs: VersionedTransaction[]) => Promise<VersionedTransaction[]>;

    // Wallet info
    address: string | null;
    isConfigured: boolean;
}

const TurnkeyWalletContext = createContext<TurnkeyWalletContextValue | null>(null);

export function useTurnkeyWallet(): TurnkeyWalletContextValue {
    const context = useContext(TurnkeyWalletContext);
    if (!context) {
        throw new Error('useTurnkeyWallet must be used within a TurnkeyWalletProvider');
    }
    return context;
}

interface TurnkeyWalletProviderProps {
    children: React.ReactNode;
}

export function TurnkeyWalletProvider({ children }: TurnkeyWalletProviderProps) {
    const { user } = useAuth();
    const supabase = createClient();
    const turnkeyService = getTurnkeyService();

    const [wallet, setWallet] = useState<TurnkeyWallet | null>(null);
    const [adapter, setAdapter] = useState<TurnkeyWalletAdapter | null>(null);
    const [loading, setLoading] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isConfigured = useMemo(() => turnkeyService.isConfigured(), [turnkeyService]);
    const publicKey = wallet?.publicKey || null;
    const connected = !!wallet;
    const address = wallet?.address || null;

    // Load existing wallet from Supabase on mount
    useEffect(() => {
        const loadWallet = async () => {
            if (!user?.id) return;

            setLoading(true);
            try {
                const { data, error: dbError } = await supabase
                    .from('user_wallets')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('wallet_type', 'turnkey')
                    .eq('is_active', true)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                if (dbError) {
                    if (dbError.code !== 'PGRST116') { // Not "no rows returned"
                        console.error('Error loading wallet from Supabase:', dbError);
                    }
                    return;
                }

                if (data && data.turnkey_wallet_id && data.turnkey_organization_id) {
                    // Fetch wallet details from Turnkey
                    const walletDetails = await turnkeyService.getWallet(
                        data.turnkey_wallet_id,
                        data.turnkey_organization_id
                    );

                    setWallet(walletDetails);
                    setAdapter(createTurnkeyWalletAdapter(walletDetails));
                    console.log('Loaded Turnkey wallet:', walletDetails.address);
                }
            } catch (err) {
                console.error('Error loading Turnkey wallet:', err);
            } finally {
                setLoading(false);
            }
        };

        loadWallet();
    }, [user?.id, supabase, turnkeyService]);

    // Connect to wallet (reconnect existing)
    const connect = useCallback(async () => {
        if (!user?.id || !isConfigured) {
            setError('Please sign in and configure Turnkey to connect wallet');
            return;
        }

        if (wallet) {
            // Already connected
            return;
        }

        setConnecting(true);
        setError(null);

        try {
            // Try to load existing wallet from Supabase
            const { data, error: dbError } = await supabase
                .from('user_wallets')
                .select('*')
                .eq('user_id', user.id)
                .eq('wallet_type', 'turnkey')
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (dbError && dbError.code !== 'PGRST116') {
                throw new Error('Failed to load wallet from database');
            }

            if (data && data.turnkey_wallet_id && data.turnkey_organization_id) {
                const walletDetails = await turnkeyService.getWallet(
                    data.turnkey_wallet_id,
                    data.turnkey_organization_id
                );

                setWallet(walletDetails);
                setAdapter(createTurnkeyWalletAdapter(walletDetails));
            } else {
                setError('No wallet found. Please create one first.');
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to connect wallet';
            setError(message);
            console.error('Error connecting Turnkey wallet:', err);
        } finally {
            setConnecting(false);
        }
    }, [user?.id, isConfigured, wallet, supabase, turnkeyService]);

    // Disconnect wallet (clear local state)
    const disconnect = useCallback(async () => {
        setWallet(null);
        setAdapter(null);
        setError(null);
    }, []);

    // Create a new wallet
    const createWallet = useCallback(async (email: string): Promise<string> => {
        if (!user?.id) {
            throw new Error('Please sign in to create a wallet');
        }

        if (!isConfigured) {
            throw new Error('Turnkey is not configured. Please contact support.');
        }

        setConnecting(true);
        setError(null);

        try {
            // Create sub-org and wallet
            const subOrg = await turnkeyService.createSubOrganization(user.id, email);
            const walletDetails = await turnkeyService.getWallet(
                subOrg.walletId,
                subOrg.subOrganizationId
            );

            // Store in Supabase
            const { error: dbError } = await supabase
                .from('user_wallets')
                .upsert({
                    user_id: user.id,
                    wallet_address: walletDetails.address,
                    wallet_type: 'turnkey',
                    turnkey_wallet_id: walletDetails.walletId,
                    turnkey_organization_id: walletDetails.organizationId,
                    is_active: true,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                });

            if (dbError) {
                console.error('Error saving wallet to Supabase:', dbError);
                // Don't fail - wallet was created successfully
            }

            setWallet(walletDetails);
            setAdapter(createTurnkeyWalletAdapter(walletDetails));

            return walletDetails.address;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to create wallet';
            setError(message);
            throw err;
        } finally {
            setConnecting(false);
        }
    }, [user?.id, isConfigured, turnkeyService, supabase]);

    // Sign a transaction
    const signTransaction = useCallback(async (tx: VersionedTransaction): Promise<VersionedTransaction> => {
        if (!adapter) {
            throw new Error('No wallet connected');
        }
        return adapter.signTransaction(tx);
    }, [adapter]);

    // Sign multiple transactions
    const signAllTransactions = useCallback(async (txs: VersionedTransaction[]): Promise<VersionedTransaction[]> => {
        if (!adapter) {
            throw new Error('No wallet connected');
        }
        return adapter.signAllTransactions(txs);
    }, [adapter]);

    const value: TurnkeyWalletContextValue = {
        wallet,
        adapter,
        publicKey,
        connected,
        connecting,
        loading,
        error,
        connect,
        disconnect,
        createWallet,
        signTransaction,
        signAllTransactions,
        address,
        isConfigured,
    };

    return (
        <TurnkeyWalletContext.Provider value={value}>
            {children}
        </TurnkeyWalletContext.Provider>
    );
}
