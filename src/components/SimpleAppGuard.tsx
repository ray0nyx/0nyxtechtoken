import React, { useEffect, useState, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { createClient } from '@/lib/supabase/client';
import { Loading } from '@/components/ui/loading';

interface SimpleAppGuardProps {
  children: React.ReactNode;
}

export function SimpleAppGuard({ children }: SimpleAppGuardProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();
  const checkInProgress = useRef(false);

  // List of user IDs that have full access (developers)
  const developerIds = [
    '856950ff-d638-419d-bcf1-b7dac51d1c7f', // rayhan@arafatcapital.com
    '8538e0b7-6dcd-4673-b39f-00d273c7fc76'  // sevemadsen18@gmail.com
  ];
  
  // List of developer emails (fallback check)
  const developerEmails = [
    'rayhan@arafatcapital.com',
    'sevemadsen18@gmail.com'
  ];

  useEffect(() => {
    let isMounted = true;
    
    const checkAuth = async () => {
      // Prevent duplicate checks
      if (checkInProgress.current) {
        console.log('SimpleAppGuard: Check already in progress, skipping');
        return;
      }
      checkInProgress.current = true;
      
      console.log('SimpleAppGuard: Starting auth check...');
      
      try {
        // First, try to get the session
        console.log('SimpleAppGuard: Calling getSession...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        if (sessionError) {
          console.error('SimpleAppGuard: Session error:', sessionError);
        }
        
        let user = session?.user || null;
        
        // If no session, try getUser as fallback
        if (!user) {
          console.log('SimpleAppGuard: No session, trying getUser...');
          const { data: { user: userData }, error: userError } = await supabase.auth.getUser();
          
          if (!isMounted) return;
          
          if (userError) {
            console.log('SimpleAppGuard: getUser error:', userError.message);
          } else if (userData) {
            user = userData;
            console.log('SimpleAppGuard: Got user from getUser:', user.email);
          }
        } else {
          console.log('SimpleAppGuard: Got user from session:', user.email);
        }
        
        // No user found at all
        if (!user) {
          console.log('SimpleAppGuard: No user found, not authenticated');
          if (isMounted) {
            setIsAuthenticated(false);
            setHasAccess(false);
            setIsLoading(false);
          }
          return;
        }

        // User is authenticated
        if (isMounted) {
          setIsAuthenticated(true);
        }
        
        const userId = user.id;
        const userEmail = user.email;
        
        // Check if user is a developer by ID or email - grant immediate access
        const isDeveloperById = developerIds.includes(userId);
        const isDeveloperByEmail = userEmail && developerEmails.includes(userEmail);
        const isDeveloper = isDeveloperById || isDeveloperByEmail;
        
        console.log('SimpleAppGuard: Developer check:', { 
          userId, 
          userEmail, 
          isDeveloperById, 
          isDeveloperByEmail, 
          isDeveloper 
        });
        
        if (isDeveloper) {
          console.log('SimpleAppGuard: User is developer, granting access');
          if (isMounted) {
            setHasAccess(true);
            setIsLoading(false);
          }
          return;
        }
        
        // For non-developers, check subscription
        console.log('SimpleAppGuard: Checking subscription for non-developer user...');
        try {
          const { data: subscription, error: subError } = await supabase
            .from('user_subscriptions')
            .select('id, status, stripe_customer_id, stripe_subscription_id')
            .eq('user_id', userId)
            .eq('status', 'active')
            .maybeSingle();
          
          if (!isMounted) return;
          
          if (subError && subError.code !== 'PGRST116') {
            console.error('SimpleAppGuard: Subscription check error:', subError);
            if (isMounted) {
              setHasAccess(false);
              setIsLoading(false);
            }
            return;
          }
          
          // Check for valid subscription with Stripe payment
          const hasValidSubscription = subscription && 
                                       subscription.stripe_customer_id && 
                                       subscription.stripe_subscription_id;
          
          console.log('SimpleAppGuard: Subscription check result:', { 
            hasSubscription: !!subscription, 
            hasValidSubscription 
          });
          
          if (isMounted) {
            setHasAccess(!!hasValidSubscription);
            setIsLoading(false);
          }
        } catch (subCheckError) {
          console.error('SimpleAppGuard: Subscription check exception:', subCheckError);
          if (isMounted) {
            setHasAccess(false);
            setIsLoading(false);
          }
        }
        
      } catch (error) {
        console.error('SimpleAppGuard: Auth check exception:', error);
        if (isMounted) {
          setIsAuthenticated(false);
          setHasAccess(false);
          setIsLoading(false);
        }
      } finally {
        checkInProgress.current = false;
      }
    };

    // Small delay to ensure Supabase client is ready after sign-in
    const timer = setTimeout(() => {
      checkAuth();
    }, 100);
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('SimpleAppGuard: Auth state changed:', event, !!session);
      
      if (event === 'SIGNED_IN' && session?.user) {
        // User just signed in, recheck auth
        const user = session.user;
        const isDeveloper = developerIds.includes(user.id) || 
                          (user.email && developerEmails.includes(user.email));
        
        if (isDeveloper) {
          console.log('SimpleAppGuard: Developer signed in, granting access');
          setIsAuthenticated(true);
          setHasAccess(true);
          setIsLoading(false);
        } else {
          // Re-run full check for non-developers
          checkInProgress.current = false;
          checkAuth();
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('SimpleAppGuard: User signed out');
        setIsAuthenticated(false);
        setHasAccess(false);
        setIsLoading(false);
      }
    });
    
    return () => {
      isMounted = false;
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  if (isLoading) {
    console.log('SimpleAppGuard: Still loading...');
    return <Loading />;
  }

  console.log('SimpleAppGuard: Final decision:', { isAuthenticated, hasAccess });

  if (!isAuthenticated) {
    console.log('SimpleAppGuard: Not authenticated, redirecting to signin');
    return <Navigate to="/signin" replace />;
  }

  if (!hasAccess) {
    console.log('SimpleAppGuard: Authenticated but no access, redirecting to subscription');
    return <Navigate to="/subscription" replace />;
  }

  console.log('SimpleAppGuard: Access granted');
  return <>{children}</>;
}
