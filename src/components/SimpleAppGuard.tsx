import React, { useEffect, useState, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { createClient } from '@/lib/supabase/client';
import { Loading } from '@/components/ui/loading';
import { getSIWSToken, getSIWSPublicKey } from '@/lib/solana/siws';

interface SimpleAppGuardProps {
  children: React.ReactNode;
}

/**
 * SimpleAppGuard - Authentication guard for protected routes
 * 
 * All authenticated users get full access - no subscription required.
 * Supports both Supabase auth (email/Google) and SIWS wallet auth (Phantom).
 */
export function SimpleAppGuard({ children }: SimpleAppGuardProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();
  const checkInProgress = useRef(false);

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
        // First, try to get the Supabase session (email/Google auth)
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

        // If Supabase user found, grant access
        if (user) {
          console.log('SimpleAppGuard: Supabase user authenticated, granting access');
          if (isMounted) {
            setIsAuthenticated(true);
            setIsLoading(false);
          }
          checkInProgress.current = false;
          return;
        }

        // No Supabase user found, check for SIWS wallet authentication
        console.log('SimpleAppGuard: No Supabase user, checking SIWS wallet auth...');
        const siwsToken = getSIWSToken();
        const siwsPublicKey = getSIWSPublicKey();

        if (siwsToken && siwsPublicKey) {
          console.log('SimpleAppGuard: SIWS wallet authenticated:', siwsPublicKey);
          if (isMounted) {
            setIsAuthenticated(true);
            setIsLoading(false);
          }
          checkInProgress.current = false;
          return;
        }

        // No authentication found
        console.log('SimpleAppGuard: No user found, not authenticated');
        if (isMounted) {
          setIsAuthenticated(false);
          setIsLoading(false);
        }
        checkInProgress.current = false;

      } catch (error) {
        console.error('SimpleAppGuard: Auth check exception:', error);
        if (isMounted) {
          setIsAuthenticated(false);
          setIsLoading(false);
        }
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
        console.log('SimpleAppGuard: User signed in, granting access');
        setIsAuthenticated(true);
        setIsLoading(false);
      } else if (event === 'SIGNED_OUT') {
        console.log('SimpleAppGuard: User signed out');
        setIsAuthenticated(false);
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

  console.log('SimpleAppGuard: Final decision - isAuthenticated:', isAuthenticated);

  if (!isAuthenticated) {
    console.log('SimpleAppGuard: Not authenticated, redirecting to signin');
    return <Navigate to="/signin" replace />;
  }

  console.log('SimpleAppGuard: Access granted');
  return <>{children}</>;
}
