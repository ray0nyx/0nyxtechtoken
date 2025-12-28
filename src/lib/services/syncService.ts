import { createClient } from '@/lib/supabase/client';

export interface SyncResult {
  success: boolean;
  tradesSynced: number;
  error?: string;
}

export class SyncService {
  private static instance: SyncService;
  private supabase = createClient();

  static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  async syncTrades(connectionId: string, syncType: 'historical' | 'realtime' = 'historical'): Promise<SyncResult> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Call Supabase Edge Function for trade sync
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-trades`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await this.supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          connectionId,
          syncType,
          userId: user.id,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to sync trades');
      }

      return {
        success: true,
        tradesSynced: result.tradesSynced || 0,
      };
    } catch (error) {
      console.error('Sync service error:', error);
      return {
        success: false,
        tradesSynced: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getConnections(): Promise<any[]> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await this.supabase
        .from('user_exchange_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching connections:', error);
      return [];
    }
  }

  async deleteConnection(connectionId: string): Promise<boolean> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { error } = await this.supabase
        .from('user_exchange_connections')
        .delete()
        .eq('id', connectionId)
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error deleting connection:', error);
      return false;
    }
  }
}

export const syncService = SyncService.getInstance();
