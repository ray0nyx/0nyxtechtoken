import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';

// Possible subscription statuses
export type SubscriptionStatus = 'active' | 'pending' | 'expired' | 'canceled' | 'loading' | 'error' | 'unauthenticated';

export function useSubscriptionStatus() {
  const [status, setStatus] = useState<SubscriptionStatus>('loading');
  const [accessLevel, setAccessLevel] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [subscriptionData, setSubscriptionData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const navigate = useNavigate();

  // Function to fetch the subscription status from the database
  const fetchSubscriptionStatus = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get the current user
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.log('No session found, user is unauthenticated');
        setIsAuthenticated(false);
        setStatus('unauthenticated');
        setIsLoading(false);
        return;
      }

      setIsAuthenticated(true);
      const userId = session.user.id;
      setUserId(userId);

      // Fetch the subscription data
      const { data: subscriptionData, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error('Error fetching subscription:', error);
        setStatus('error');
        setError(error.message);
        return;
      }

      if (!subscriptionData) {
        console.log('No subscription found, setting as pending');
        setStatus('pending');
        setAccessLevel('none');
        return;
      }

      // Set the subscription data
      setSubscriptionData(subscriptionData);
      setStatus(subscriptionData.status as SubscriptionStatus);
      setAccessLevel(subscriptionData.access_level);

    } catch (err) {
      console.error('Unexpected error in useSubscriptionStatus:', err);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  // Update the subscription status in the database
  const updateSubscriptionStatus = async (newStatus: SubscriptionStatus, newAccessLevel: string) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('user_subscriptions')
        .update({
          status: newStatus,
          access_level: newAccessLevel,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating subscription:', error);
        return false;
      }

      // Refresh subscription data
      await fetchSubscriptionStatus();
      return true;
    } catch (err) {
      console.error('Error updating subscription status:', err);
      return false;
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchSubscriptionStatus();
  }, []);

  return {
    status,
    accessLevel,
    isLoading,
    error,
    isAuthenticated,
    subscriptionData,
    fetchSubscriptionStatus,
    updateSubscriptionStatus,
    requiresSubscription: status === 'pending' || status === 'expired' || status === 'canceled' || status === 'unauthenticated'
  };
} 