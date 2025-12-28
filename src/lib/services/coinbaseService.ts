/**
 * Coinbase OAuth Service
 * Handles OAuth authentication and data integration with Coinbase
 */

import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

// Coinbase API configuration - OAuth only
const COINBASE_BASE_URL = "https://api.coinbase.com";

export interface CoinbaseAccount {
  id: string;
  user_id: string;
  coinbase_user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  permissions: string[];
  is_active: boolean;
  last_sync_at: string;
  created_at: string;
  updated_at: string;
}

export interface CoinbaseTrade {
  id: string;
  user_id: string;
  coinbase_account_id: string;
  coinbase_trade_id: string;
  order_id: string;
  pair: string;
  trade_time: string;
  trade_type: 'buy' | 'sell';
  order_type: string;
  price: number;
  cost: number;
  fee: number;
  volume: number;
  raw_data: any;
  created_at: string;
  updated_at: string;
}

export interface CoinbaseMarketData {
  symbol: string;
  price: number;
  volume: number;
  change_24h: number;
  high_24h: number;
  low_24h: number;
  timestamp: number;
}

export interface CoinbaseBalance {
  asset: string;
  free: number;
  used: number;
  total: number;
}

class CoinbaseService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = COINBASE_BASE_URL;
  }

  /**
   * Generate Coinbase OAuth authorization URL
   */
  generateAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: process.env.VITE_COINBASE_CLIENT_ID || process.env.NEXT_PUBLIC_COINBASE_CLIENT_ID || 'your_coinbase_client_id',
      response_type: 'code',
      scope: 'wallet:accounts:read,wallet:transactions:read,wallet:user:read',
      redirect_uri: `${window.location.origin}/auth/coinbase/callback`,
      state: this.generateState()
    });

    return `https://www.coinbase.com/oauth/authorize?${params.toString()}`;
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
      const response = await fetch('/api/coinbase/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          state,
          redirect_uri: `${window.location.origin}/auth/coinbase/callback`
        })
      });

      if (!response.ok) {
        throw new Error('Failed to exchange code for token');
      }

      return await response.json();
    } catch (error) {
      console.error('Error exchanging code for token:', error);
      throw error;
    }
  }

  /**
   * Save Coinbase account to database
   */
  async saveCoinbaseAccount(
    userId: string,
    coinbaseUserId: string,
    accessToken: string,
    refreshToken: string,
    expiresIn: number,
    permissions: string[]
  ): Promise<CoinbaseAccount> {
    try {
      const { data, error } = await supabase
        .from('coinbase_accounts')
        .insert({
          user_id: userId,
          coinbase_user_id: coinbaseUserId,
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
      console.error('Error saving Coinbase account:', error);
      throw error;
    }
  }

  /**
   * Get user's Coinbase accounts
   */
  async getCoinbaseAccounts(userId: string): Promise<CoinbaseAccount[]> {
    try {
      const { data, error } = await supabase
        .from('coinbase_accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching Coinbase accounts:', error);
      throw error;
    }
  }

  /**
   * Get market data for symbols
   */
  async getMarketData(symbols: string[]): Promise<CoinbaseMarketData[]> {
    try {
      const response = await fetch('/api/coinbase/market-data', {
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
    coinbaseAccountId: string,
    startDate?: string,
    endDate?: string
  ): Promise<CoinbaseTrade[]> {
    try {
      const response = await fetch('/api/coinbase/trades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          coinbase_account_id: coinbaseAccountId,
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
  async getAccountBalance(coinbaseAccountId: string): Promise<CoinbaseBalance[]> {
    try {
      const response = await fetch('/api/coinbase/balance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ coinbase_account_id: coinbaseAccountId })
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
   * Sync trades from Coinbase
   */
  async syncTrades(coinbaseAccountId: string): Promise<{
    synced: number;
    new_trades: number;
    updated_trades: number;
  }> {
    try {
      const response = await fetch('/api/coinbase/sync-trades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ coinbase_account_id: coinbaseAccountId })
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
      const response = await fetch('/api/coinbase/pairs');
      
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
   * Disconnect Coinbase account
   */
  async disconnectAccount(coinbaseAccountId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('coinbase_accounts')
        .update({ is_active: false })
        .eq('id', coinbaseAccountId);

      if (error) throw error;
    } catch (error) {
      console.error('Error disconnecting account:', error);
      throw error;
    }
  }
}

export const coinbaseService = new CoinbaseService();
