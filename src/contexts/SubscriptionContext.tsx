import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { UserSubscription, SubscriptionPlan } from '@/types/subscription.types';
import { getCurrentUser } from '@/lib/auth-utils';

interface SubscriptionContextType {
  subscription: UserSubscription | null;
  isLoading: boolean;
  error: string | null;
  isSubscriptionValid: boolean;
  isDeveloper: boolean;
  isTrialActive: boolean;
  daysLeftInTrial: number;
  refreshSubscription: () => Promise<void>;
  availablePlans: SubscriptionPlan[];
  hasBasicAccess: boolean;
  hasPremiumAccess: boolean;
  canAccessQuantTesting: boolean;
  canAccessCopyTrading: boolean;
  canAccessRealTimeSync: boolean;
  canAccessTradeSync: boolean;
  isProMember: boolean;
  // New crypto-specific access controls
  subscriptionTier: 'starter' | 'pro' | 'elite' | 'none';
  canAccessWalletTracking: boolean;
  canAccessBitcoinAnalysis: boolean;
  canAccessBrokerSync: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [availablePlans, setAvailablePlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();
  const isFetchingRef = React.useRef(false); // Prevent concurrent fetchSubscription calls

  const isSubscriptionValid = React.useMemo(() => {
    // App is now free for all authenticated users
    if (!subscription) {
      console.log('No subscription found');
      return false;
    }

    // All authenticated users get full access
    if (subscription.user_id) {
      console.log('User authenticated - granting free access:', subscription.user_id);
      return true;
    }

    return false;
  }, [subscription]);

  const [sessionUserId, setSessionUserId] = React.useState<string | null>(null);

  // Get session user ID for developer check
  React.useEffect(() => {
    const getSessionUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          setSessionUserId(session.user.id);
        }
      } catch (error) {
        console.error('Error getting session user:', error);
      }
    };
    getSessionUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      getSessionUser();
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const isDeveloper = React.useMemo(() => {
    // List of developer user IDs
    const developerIds = [
      '856950ff-d638-419d-bcf1-b7dac51d1c7f', // rayhan@arafatcapital.com
      '92172686-1ae8-47d8-ad96-9514860ab468',
      '8538e0b7-6dcd-4673-b39f-00d273c7fc76'  // sevemadsen18@gmail.com
    ];

    // Check if user is in the developer list via subscription
    if (subscription?.user_id && developerIds.includes(subscription.user_id)) {
      console.log('SubscriptionContext: User is in developer list:', subscription.user_id);
      return true;
    }

    // Check session user ID as fallback (for when subscription not loaded yet)
    if (sessionUserId && developerIds.includes(sessionUserId)) {
      console.log('SubscriptionContext: User is in developer list (from session):', sessionUserId);
      return true;
    }

    // Also check the is_developer flag from the database
    if (subscription?.is_developer) {
      console.log('SubscriptionContext: User has is_developer flag set to true');
      return true;
    }

    console.log('SubscriptionContext: User is not a developer:', {
      userId: subscription?.user_id,
      sessionUserId: sessionUserId,
      isDeveloper: subscription?.is_developer,
      inDeveloperList: subscription?.user_id ? developerIds.includes(subscription.user_id) : false
    });

    return false;
  }, [subscription, sessionUserId]);

  const isTrialActive = React.useMemo(() => {
    // Trials are no longer supported
    return false;
  }, [subscription]);

  const daysLeftInTrial = React.useMemo(() => {
    // Trials are no longer supported
    return 0;
  }, [subscription]);

  // Access control logic
  const hasBasicAccess = React.useMemo(() => {
    // App is now free - all authenticated users have basic access
    return !!subscription?.user_id;
  }, [subscription]);

  const hasPremiumAccess = React.useMemo(() => {
    // App is now free - all authenticated users have premium access
    return !!subscription?.user_id;
  }, [subscription]);

  const canAccessQuantTesting = React.useMemo(() => {
    // App is now free - all authenticated users can access quant testing
    return !!subscription?.user_id;
  }, [subscription]);

  const canAccessCopyTrading = React.useMemo(() => {
    // App is now free - all authenticated users can access copy trading
    return !!subscription?.user_id;
  }, [subscription]);

  const canAccessRealTimeSync = React.useMemo(() => {
    // App is now free - all authenticated users can access real-time sync
    return !!subscription?.user_id;
  }, [subscription]);

  const canAccessTradeSync = React.useMemo(() => {
    // App is now free - all authenticated users can access trade sync
    return !!subscription?.user_id;
  }, [subscription]);

  const isProMember = React.useMemo(() => {
    return canAccessTradeSync;
  }, [canAccessTradeSync]);

  const fetchSubscription = async () => {
    // Prevent concurrent calls
    if (isFetchingRef.current) {
      console.log('SubscriptionContext: fetchSubscription already in progress, skipping');
      return;
    }

    isFetchingRef.current = true;
    let timeoutId: NodeJS.Timeout | null = null;
    try {
      setIsLoading(true);
      setError(null);

      // Add timeout to prevent infinite loading
      timeoutId = setTimeout(() => {
        console.warn('SubscriptionContext: fetchSubscription timeout - forcing completion');
        setIsLoading(false);
        setError('Subscription check timed out. Please refresh the page.');
        isFetchingRef.current = false;
      }, 10000); // 10 second timeout

      // Support both Supabase and SIWS wallet auth
      const authUser = await getCurrentUser();

      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (!authUser) {
        console.log('SubscriptionContext: No authenticated user found');
        setSubscription(null);
        setIsLoading(false);
        isFetchingRef.current = false;
        return;
      }

      const userId = authUser.id;
      const isWalletUser = authUser.isWalletUser;

      // Check if user is a developer (developers get access without subscription)
      const developerIds = [
        '856950ff-d638-419d-bcf1-b7dac51d1c7f', // rayhan@arafatcapital.com
        '8538e0b7-6dcd-4673-b39f-00d273c7fc76'  // sevemadsen18@gmail.com
      ];
      const isUserDeveloper = developerIds.includes(userId);

      console.log('SubscriptionContext: Fetching subscription for user:', userId, 'Is Developer:', isUserDeveloper, 'Is Wallet User:', isWalletUser);

      // For SIWS wallet users, just grant access (no DB lookup needed)
      if (isWalletUser) {
        console.log('SubscriptionContext: Creating free access subscription for SIWS wallet user:', userId);
        setSubscription({
          id: 'wallet-subscription',
          user_id: userId,
          plan_id: null,
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          cancel_at_period_end: false,
          payment_method_id: null,
          stripe_customer_id: null,
          stripe_subscription_id: null,
          is_developer: isUserDeveloper,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        } as UserSubscription);
        setAvailablePlans([]);
        setIsLoading(false);
        isFetchingRef.current = false;
        return;
      }

      // Fetch real subscription from database for regular users
      const { data: subscriptionData, error: subscriptionError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subscriptionError && subscriptionError.code !== 'PGRST116') {
        console.error('Error fetching subscription:', subscriptionError);
        setError('Failed to fetch subscription information');
        setSubscription(null);
        setIsLoading(false);
        isFetchingRef.current = false;
        return;
      }

      // For all authenticated users, create an active subscription record
      console.log('SubscriptionContext: Creating free access subscription for user:', userId);
      setSubscription({
        id: subscriptionData?.id || 'free-subscription',
        user_id: userId,
        plan_id: subscriptionData?.plan_id || null,
        status: 'active',
        current_period_start: subscriptionData?.current_period_start || new Date().toISOString(),
        current_period_end: subscriptionData?.current_period_end || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        cancel_at_period_end: false,
        payment_method_id: subscriptionData?.payment_method_id || null,
        stripe_customer_id: subscriptionData?.stripe_customer_id || null,
        stripe_subscription_id: subscriptionData?.stripe_subscription_id || null,
        is_developer: isUserDeveloper,
        created_at: subscriptionData?.created_at || new Date().toISOString(),
        updated_at: subscriptionData?.updated_at || new Date().toISOString()
      } as UserSubscription);
      setAvailablePlans([]);
      setIsLoading(false);
      isFetchingRef.current = false;
      return;


    } catch (err) {
      console.error('Error in subscription context:', err);
      setError('An unexpected error occurred');
      setSubscription(null);
      setIsLoading(false);
      isFetchingRef.current = false;
    } finally {
      // Always clear timeout in finally block
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  };

  const refreshSubscription = async () => {
    await fetchSubscription();
  };

  useEffect(() => {
    let isMounted = true;

    fetchSubscription();

    // Listen for auth state changes (but debounce to prevent loops)
    let authChangeTimeout: NodeJS.Timeout | null = null;
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      // Only refetch on significant auth changes, not every event
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        // Debounce to prevent rapid successive calls
        if (authChangeTimeout) {
          clearTimeout(authChangeTimeout);
        }
        authChangeTimeout = setTimeout(() => {
          if (isMounted) {
            fetchSubscription();
          }
        }, 500); // 500ms debounce
      }
    });

    return () => {
      isMounted = false;
      if (authChangeTimeout) {
        clearTimeout(authChangeTimeout);
      }
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  // All users get elite tier access now (free app)
  const subscriptionTier = React.useMemo(() => {
    if (!subscription?.user_id) return 'none';
    return 'elite'; // All authenticated users get elite access
  }, [subscription]) as 'starter' | 'pro' | 'elite' | 'none';

  // All authenticated users get full feature access (free app)
  const canAccessWalletTracking = !!subscription?.user_id;
  const canAccessBitcoinAnalysis = !!subscription?.user_id;
  const canAccessBrokerSync = !!subscription?.user_id;

  const value = {
    subscription,
    isLoading,
    error,
    isSubscriptionValid,
    isDeveloper,
    isTrialActive,
    daysLeftInTrial,
    refreshSubscription,
    availablePlans,
    hasBasicAccess,
    hasPremiumAccess,
    canAccessQuantTesting,
    canAccessCopyTrading,
    canAccessRealTimeSync,
    canAccessTradeSync,
    isProMember,
    // New crypto-specific access
    subscriptionTier,
    canAccessWalletTracking,
    canAccessBitcoinAnalysis,
    canAccessBrokerSync,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}; 