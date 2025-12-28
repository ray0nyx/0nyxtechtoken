import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/use-toast';

export interface Trade {
  id: string;
  user_id: string;
  symbol: string;
  position: string;
  entry_date: string;
  entry_price: number;
  exit_date: string | null;
  exit_price: number | null;
  quantity: number;
  qty?: number;
  pnl: number | null;
  strategy: string | null;
  broker: string;
  notes: string | null;
  tags: string[] | null;
  fees: number | null;
  created_at: string;
  updated_at: string;
}

interface UserPermissions {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  maxBatchSize: number;
}

export function useTrades() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissions>({
    canRead: false,
    canWrite: false,
    canDelete: false,
    maxBatchSize: 100
  });
  const supabase = createClient();
  const { toast } = useToast();

  const checkUserPermissions = async (userId: string): Promise<UserPermissions> => {
    try {
      // Get user's role from auth metadata
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      // Get user's subscription status
      const { data: subscription, error: subError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (subError && subError.code !== 'PGRST116') throw subError;

      // Default permissions for free tier
      const permissions: UserPermissions = {
        canRead: true,
        canWrite: true,
        canDelete: true,
        maxBatchSize: 100
      };

      // Enhanced permissions for premium users
      if (subscription?.status === 'active') {
        permissions.maxBatchSize = 1000;
      }

      // Admin permissions
      if (user?.user_metadata?.role === 'admin') {
        permissions.maxBatchSize = 5000;
      }

      return permissions;
    } catch (error) {
      console.error('Error checking permissions:', error);
      return {
        canRead: true,
        canWrite: true,
        canDelete: false,
        maxBatchSize: 100
      };
    }
  };

  const fetchTrades = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('No authenticated user found');

      // Check user permissions
      const permissions = await checkUserPermissions(user.id);
      setUserPermissions(permissions);

      if (!permissions.canRead) {
        throw new Error('You do not have permission to view trades');
      }

      // Fetch trades for current user
      const { data, error: tradesError } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .order('entry_date', { ascending: false });

      if (tradesError) throw tradesError;

      setTrades(data || []);
    } catch (err) {
      const error = err as Error;
      console.error('Error fetching trades:', error);
      setError(error);
      toast({
        title: "Error",
        description: `Failed to fetch trades: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrades();

    // Listen for trade updates
    const handleTradesUpdated = (event: CustomEvent) => {
      const { userId } = event.detail;
      // Only refresh if the event is for the current user
      if (userId === supabase.auth.user()?.id) {
        fetchTrades();
      }
    };

    window.addEventListener('tradesUpdated', handleTradesUpdated as EventListener);

    // Cleanup
    return () => {
      window.removeEventListener('tradesUpdated', handleTradesUpdated as EventListener);
    };
  }, []);

  return {
    trades,
    loading,
    error,
    permissions: userPermissions,
    refetch: fetchTrades
  };
} 