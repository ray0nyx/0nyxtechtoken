import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { UserSubscription, SubscriptionPlan } from '@/types/subscription.types';

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
    if (!subscription) {
      console.log('No subscription found');
      return false;
    }
    
    // List of user IDs that can bypass subscription requirements (developers only)
  const bypassUserIds = [
      '856950ff-d638-419d-bcf1-b7dac51d1c7f', // rayhan@arafatcapital.com
      '8538e0b7-6dcd-4673-b39f-00d273c7fc76'  // sevemadsen18@gmail.com
  ];
    
    // Check if user is in the bypass list
    if (subscription.user_id && bypassUserIds.includes(subscription.user_id)) {
      console.log('User in bypass list:', subscription.user_id);
      return true;
    }
    
    // Developer always has access
    if (subscription.is_developer) {
      console.log('User is developer');
      return true;
    }
    
    // Check if subscription was canceled during trial period - deny access immediately
    if (subscription.status === 'canceled' && subscription.trial_end_date) {
      const trialEndDate = new Date(subscription.trial_end_date);
      const now = new Date();
      // If trial hasn't naturally expired yet but subscription is canceled, access is revoked
      if (trialEndDate > now) {
        console.log('Subscription canceled during trial - access revoked');
        return false;
      }
    }
    
    // Check if subscription is in trial period and not canceled
    if ((subscription.status === 'trialing' || subscription.status === 'trial') && subscription.trial_end_date) {
      const trialEndDate = new Date(subscription.trial_end_date);
      const now = new Date();
      if (trialEndDate > now) {
        console.log('User has active trial subscription');
        return true;
      } else {
        console.log('Trial has expired');
        return false;
      }
    }
    
    // Check if subscription is active AND has Stripe payment information
    if (subscription.status === 'active' && subscription.stripe_customer_id && subscription.stripe_subscription_id) {
      console.log('User has active subscription with Stripe payment');
      return true;
    }
    
    // If subscription is marked as active but no Stripe payment, it's invalid
    if (subscription.status === 'active' && (!subscription.stripe_customer_id || !subscription.stripe_subscription_id)) {
      console.log('User has active subscription but no Stripe payment - invalid');
      return false;
    }
    
    console.log('Subscription not valid:', {
      userId: subscription.user_id,
      status: subscription.status,
      isDeveloper: subscription.is_developer,
      trialEndDate: subscription.trial_end_date
    });
    
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
    if (!subscription) return false;
    
    // Bypass users and developers have full access
    const bypassUserIds = [
      '856950ff-d638-419d-bcf1-b7dac51d1c7f', // rayhan@arafatcapital.com
      '8538e0b7-6dcd-4673-b39f-00d273c7fc76'  // sevemadsen18@gmail.com
    ];
    if (subscription.user_id && bypassUserIds.includes(subscription.user_id)) {
      return true;
    }
    
    // Active subscription with Stripe payment
    return subscription.status === 'active' && subscription.stripe_customer_id && subscription.stripe_subscription_id;
  }, [subscription]);

  const hasPremiumAccess = React.useMemo(() => {
    if (!subscription) return false;
    
    // Bypass users and developers have full access
    const bypassUserIds = [
      '856950ff-d638-419d-bcf1-b7dac51d1c7f', // rayhan@arafatcapital.com
      '8538e0b7-6dcd-4673-b39f-00d273c7fc76'  // sevemadsen18@gmail.com
    ];
    if (subscription.user_id && bypassUserIds.includes(subscription.user_id)) {
      return true;
    }
    
    // Check if user has premium plan (Pro or Yearly)
    if (subscription.status === 'active' && subscription.stripe_customer_id && subscription.stripe_subscription_id) {
      // For now, only bypass users have premium access
      // This can be expanded when premium plans are implemented
      return false;
    }
    
    return false;
  }, [subscription]);

  const canAccessQuantTesting = React.useMemo(() => {
    // Only bypass users and developers can access quant testing
    const bypassUserIds = [
      '856950ff-d638-419d-bcf1-b7dac51d1c7f', // rayhan@arafatcapital.com
      '8538e0b7-6dcd-4673-b39f-00d273c7fc76'  // sevemadsen18@gmail.com
    ];
    return subscription?.user_id && bypassUserIds.includes(subscription.user_id);
  }, [subscription]);

  const canAccessCopyTrading = React.useMemo(() => {
    // Only bypass users and developers can access copy trading
    const bypassUserIds = [
      '856950ff-d638-419d-bcf1-b7dac51d1c7f', // rayhan@arafatcapital.com
      '8538e0b7-6dcd-4673-b39f-00d273c7fc76'  // sevemadsen18@gmail.com
    ];
    return subscription?.user_id && bypassUserIds.includes(subscription.user_id);
  }, [subscription]);

  const canAccessRealTimeSync = React.useMemo(() => {
    // Only bypass users and developers can access real-time sync
    const bypassUserIds = [
      '856950ff-d638-419d-bcf1-b7dac51d1c7f', // rayhan@arafatcapital.com
      '8538e0b7-6dcd-4673-b39f-00d273c7fc76'  // sevemadsen18@gmail.com
    ];
    return subscription?.user_id && bypassUserIds.includes(subscription.user_id);
  }, [subscription]);

  const canAccessTradeSync = React.useMemo(() => {
    if (!subscription) return false;
    
    // Bypass users and developers have full access
    const bypassUserIds = [
      '856950ff-d638-419d-bcf1-b7dac51d1c7f', // rayhan@arafatcapital.com
      '8538e0b7-6dcd-4673-b39f-00d273c7fc76'  // sevemadsen18@gmail.com
    ];
    if (subscription.user_id && bypassUserIds.includes(subscription.user_id)) {
      return true;
    }
    
    // Check if user has Pro plan ($39.99/month)
    if (subscription.status === 'active' && subscription.stripe_customer_id && subscription.stripe_subscription_id) {
      // For now, all active subscriptions have Pro access
      // In production, you would check the actual plan price
      return true;
    }
    
    return false;
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
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      if (!user) {
        setSubscription(null);
        setIsLoading(false);
        return;
      }
      
      // Check if user is a developer (developers get access without subscription)
      const developerIds = [
        '856950ff-d638-419d-bcf1-b7dac51d1c7f', // rayhan@arafatcapital.com
        '8538e0b7-6dcd-4673-b39f-00d273c7fc76'  // sevemadsen18@gmail.com
      ];
      const isUserDeveloper = developerIds.includes(user.id);
      
      console.log('SubscriptionContext: Fetching subscription for user:', user.id, 'Is Developer:', isUserDeveloper);
      
      // Fetch real subscription from database
      const { data: subscriptionData, error: subscriptionError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (subscriptionError && subscriptionError.code !== 'PGRST116') {
        console.error('Error fetching subscription:', subscriptionError);
        setError('Failed to fetch subscription information');
        setSubscription(null);
        setIsLoading(false);
        return;
      }
      
      // If developer, create developer subscription object
      if (isUserDeveloper) {
        console.log('SubscriptionContext: User is developer, granting access');
      setSubscription({
          id: subscriptionData?.id || 'dev-subscription',
        user_id: user.id,
          plan_id: subscriptionData?.plan_id || null,
        status: 'active',
        trial_start_date: null,
        trial_end_date: null,
          current_period_start: subscriptionData?.current_period_start || new Date().toISOString(),
          current_period_end: subscriptionData?.current_period_end || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        cancel_at_period_end: false,
          payment_method_id: subscriptionData?.payment_method_id || null,
          stripe_customer_id: subscriptionData?.stripe_customer_id || null,
          stripe_subscription_id: subscriptionData?.stripe_subscription_id || null,
          is_developer: true,
          created_at: subscriptionData?.created_at || new Date().toISOString(),
          updated_at: subscriptionData?.updated_at || new Date().toISOString()
        });
        setAvailablePlans([]);
        setIsLoading(false);
        return;
      }
      
      // For non-developers, only set subscription if it exists and has Stripe payment
      if (subscriptionData) {
        // If subscription is marked as active but missing Stripe payment, revoke it
        if (subscriptionData.status === 'active' && 
            (!subscriptionData.stripe_customer_id || !subscriptionData.stripe_subscription_id)) {
          console.log('SubscriptionContext: Active subscription found but missing Stripe payment - revoking', {
            userId: user.id,
            subscriptionId: subscriptionData.id,
            hasStripeCustomer: !!subscriptionData.stripe_customer_id,
            hasStripeSubscription: !!subscriptionData.stripe_subscription_id
          });
          
          // Revoke the subscription in the database
          await supabase
            .from('user_subscriptions')
            .update({ 
              status: 'expired',
        updated_at: new Date().toISOString()
            })
            .eq('id', subscriptionData.id);
      
          // No valid paid subscription
          setSubscription(null);
        } else if (subscriptionData.status === 'active' && 
                   subscriptionData.stripe_customer_id && 
                   subscriptionData.stripe_subscription_id) {
          console.log('SubscriptionContext: Found valid paid subscription');
          setSubscription(subscriptionData);
        } else {
          console.log('SubscriptionContext: Subscription found but not active or missing payment info', {
            status: subscriptionData.status,
            hasStripeCustomer: !!subscriptionData.stripe_customer_id,
            hasStripeSubscription: !!subscriptionData.stripe_subscription_id
          });
          // No valid paid subscription
          setSubscription(null);
        }
      } else {
        console.log('SubscriptionContext: No subscription found for user');
        setSubscription(null);
      }
      
      // Fetch available plans
      const { data: plans, error: plansError } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('price_monthly', { ascending: true });
      
      if (plansError) {
        console.error('Error fetching plans:', plansError);
      setAvailablePlans([]);
      } else {
        setAvailablePlans(plans || []);
      }
      
      setIsLoading(false);
      isFetchingRef.current = false;
      
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

  // Determine subscription tier based on plan/price
  const subscriptionTier = React.useMemo(() => {
    if (isDeveloper) return 'elite'; // Developers get elite access
    if (!subscription || subscription.status !== 'active') return 'none';
    
    // Check plan type from subscription
    const planType = subscription.plan_type?.toLowerCase() || '';
    if (planType.includes('elite') || planType.includes('79.99')) return 'elite';
    if (planType.includes('pro') || planType.includes('39.99')) return 'pro';
    if (planType.includes('starter') || planType.includes('19.99')) return 'starter';
    
    // Default to starter for any active subscription
    return 'starter';
  }, [subscription, isDeveloper]) as 'starter' | 'pro' | 'elite' | 'none';

  // Crypto-specific feature access
  const canAccessWalletTracking = subscriptionTier === 'elite' || isDeveloper;
  const canAccessBitcoinAnalysis = subscriptionTier === 'elite' || isDeveloper;
  const canAccessBrokerSync = subscriptionTier === 'pro' || subscriptionTier === 'elite' || isDeveloper;

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