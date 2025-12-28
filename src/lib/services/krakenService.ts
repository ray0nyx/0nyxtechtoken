/**
 * Kraken API Service
 * Handles OAuth authentication, market data, and trade syncing with Kraken
 */

import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

// Kraken API configuration - OAuth only
const KRAKEN_BASE_URL = "https://api.kraken.com";

export interface KrakenAccount {
  id: string;
  user_id: string;
  kraken_user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  permissions: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface KrakenTrade {
  id: string;
  order_id: string;
  pair: string;
  time: number;
  type: 'buy' | 'sell';
  ordertype: string;
  price: string;
  cost: string;
  fee: string;
  vol: string;
  margin: string;
  misc: string;
  user_id: string;
  kraken_account_id: string;
  created_at: string;
}

export interface KrakenMarketData {
  symbol: string;
  price: number;
  volume: number;
  change_24h: number;
  high_24h: number;
  low_24h: number;
  timestamp: number;
}

export interface KrakenBalance {
  asset: string;
  free: number;
  used: number;
  total: number;
}

class KrakenService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = KRAKEN_BASE_URL;
  }

  /**
   * Generate Kraken OAuth authorization URL
   */
  generateAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: import.meta.env.VITE_KRAKEN_CLIENT_ID || 'your_kraken_client_id',
      response_type: 'code',
      scope: 'account.info:basic account.fast-api-key:funds-query account.fast-api-key:trades-query-open account.fast-api-key:trades-query-closed account.fast-api-key:ledger-query',
      redirect_uri: `${window.location.origin}/auth/kraken/callback`,
      state: this.generateState()
    });

    return `https://id.kraken.com/oauth/authorize?${params.toString()}`;
  }

  /**
   * Generate random state for OAuth security
   */
  private generateState(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string, state: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    try {
      const clientId = import.meta.env.VITE_KRAKEN_CLIENT_ID || '';
      const clientSecret = import.meta.env.VITE_KRAKEN_CLIENT_SECRET || '';
      
      // Create Basic Auth header
      const credentials = btoa(`${clientId}:${clientSecret}`);
      
      const response = await fetch('https://api.kraken.com/oauth/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: `${window.location.origin}/auth/kraken/callback`
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Kraken token exchange failed:', errorData);
        throw new Error(`Failed to exchange code for token: ${errorData.error_description || errorData.error}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error exchanging code for token:', error);
      throw error;
    }
  }

  /**
   * Save Kraken account to database
   */
  async saveKrakenAccount(
    userId: string,
    krakenUserId: string,
    accessToken: string,
    refreshToken: string,
    expiresIn: number,
    permissions: string[]
  ): Promise<KrakenAccount> {
    try {
      const { data, error } = await supabase
        .from('kraken_accounts')
        .insert({
          user_id: userId,
          kraken_user_id: krakenUserId,
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
          permissions,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error saving Kraken account:', error);
      throw error;
    }
  }

  /**
   * Get user's Kraken accounts
   */
  async getKrakenAccounts(userId: string): Promise<KrakenAccount[]> {
    try {
      const { data, error } = await supabase
        .from('kraken_accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching Kraken accounts:', error);
      throw error;
    }
  }

  /**
   * Get market data for symbols
   */
  async getMarketData(symbols: string[]): Promise<KrakenMarketData[]> {
    try {
      const response = await fetch('/api/kraken/market-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ symbols })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch market data');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching market data:', error);
      throw error;
    }
  }

  /**
   * Get user's trade history
   */
  async getTradeHistory(
    krakenAccountId: string,
    startDate?: string,
    endDate?: string
  ): Promise<KrakenTrade[]> {
    try {
      const response = await fetch('/api/kraken/trades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kraken_account_id: krakenAccountId,
          start_date: startDate,
          end_date: endDate
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch trade history');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching trade history:', error);
      throw error;
    }
  }

  /**
   * Get account balance
   */
  async getAccountBalance(krakenAccountId: string): Promise<KrakenBalance[]> {
    try {
      const response = await fetch('/api/kraken/balance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ kraken_account_id: krakenAccountId })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch account balance');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching account balance:', error);
      throw error;
    }
  }

  /**
   * Sync trades from Kraken
   */
  async syncTrades(krakenAccountId: string): Promise<{
    synced: number;
    new_trades: number;
    updated_trades: number;
  }> {
    try {
      const response = await fetch('/api/kraken/sync-trades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ kraken_account_id: krakenAccountId })
      });

      if (!response.ok) {
        throw new Error('Failed to sync trades');
      }

      return await response.json();
    } catch (error) {
      console.error('Error syncing trades:', error);
      throw error;
    }
  }

  /**
   * Get available trading pairs
   */
  async getTradingPairs(): Promise<Array<{
    symbol: string;
    base: string;
    quote: string;
    status: string;
  }>> {
    try {
      const response = await fetch('/api/kraken/pairs');
      
      if (!response.ok) {
        throw new Error('Failed to fetch trading pairs');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching trading pairs:', error);
      throw error;
    }
  }

  /**
   * Disconnect Kraken account
   */
  async disconnectAccount(krakenAccountId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('kraken_accounts')
        .update({ is_active: false })
        .eq('id', krakenAccountId);

      if (error) throw error;
    } catch (error) {
      console.error('Error disconnecting account:', error);
      throw error;
    }
  }
}

export const krakenService = new KrakenService();
