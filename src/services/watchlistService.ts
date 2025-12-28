import { createClient } from '@/lib/supabase/client';

export interface WatchlistItem {
  id: string;
  user_id: string;
  token_mint: string;
  token_symbol?: string;
  token_name?: string;
  created_at: string;
}

export interface TokenInfo {
  mint: string;
  symbol?: string;
  name?: string;
}

class WatchlistService {
  private supabase = createClient();

  /**
   * Get all watchlist items for the current user
   */
  async getWatchlist(): Promise<WatchlistItem[]> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Try to get user_id from new identity model
      let userId: string | null = null;
      
      // Check for SIWS auth first
      const siwsToken = localStorage.getItem('siws_token');
      if (siwsToken) {
        // For SIWS, we need to get user_id from the token or make an API call
        // For now, we'll use a helper function
        userId = await this.getUserIdFromAuth();
      } else {
        // For Supabase auth, use the user id
        userId = user.id;
      }

      if (!userId) {
        throw new Error('Could not determine user ID');
      }

      const { data, error } = await this.supabase
        .from('watchlists')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching watchlist:', error);
      throw error;
    }
  }

  /**
   * Add a token to the watchlist
   */
  async addToWatchlist(tokenInfo: TokenInfo): Promise<WatchlistItem> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      let userId: string | null = null;
      const siwsToken = localStorage.getItem('siws_token');
      if (siwsToken) {
        userId = await this.getUserIdFromAuth();
      } else {
        userId = user.id;
      }

      if (!userId) {
        throw new Error('Could not determine user ID');
      }

      const { data, error } = await this.supabase
        .from('watchlists')
        .insert({
          user_id: userId,
          token_mint: tokenInfo.mint,
          token_symbol: tokenInfo.symbol,
          token_name: tokenInfo.name,
        })
        .select()
        .single();

      if (error) {
        // If it's a unique constraint error, the token is already in watchlist
        if (error.code === '23505') {
          throw new Error('Token is already in your watchlist');
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error adding to watchlist:', error);
      throw error;
    }
  }

  /**
   * Remove a token from the watchlist
   */
  async removeFromWatchlist(tokenMint: string): Promise<void> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      let userId: string | null = null;
      const siwsToken = localStorage.getItem('siws_token');
      if (siwsToken) {
        userId = await this.getUserIdFromAuth();
      } else {
        userId = user.id;
      }

      if (!userId) {
        throw new Error('Could not determine user ID');
      }

      const { error } = await this.supabase
        .from('watchlists')
        .delete()
        .eq('user_id', userId)
        .eq('token_mint', tokenMint);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error removing from watchlist:', error);
      throw error;
    }
  }

  /**
   * Check if a token is in the watchlist
   */
  async isInWatchlist(tokenMint: string): Promise<boolean> {
    try {
      const watchlist = await this.getWatchlist();
      return watchlist.some(item => item.token_mint === tokenMint);
    } catch (error) {
      console.error('Error checking watchlist:', error);
      return false;
    }
  }

  /**
   * Helper to get user_id from authentication
   */
  private async getUserIdFromAuth(): Promise<string | null> {
    try {
      // For SIWS, we need to extract user_id from the token or make an API call
      // For now, we'll try to get it from the stored user data
      const siwsUserStr = sessionStorage.getItem('siws_user');
      if (siwsUserStr) {
        const siwsUser = JSON.parse(siwsUserStr);
        return siwsUser.id || null;
      }

      // Fallback: try to get from Supabase auth
      const { data: { user } } = await this.supabase.auth.getUser();
      return user?.id || null;
    } catch (error) {
      console.error('Error getting user ID:', error);
      return null;
    }
  }
}

export const watchlistService = new WatchlistService();
