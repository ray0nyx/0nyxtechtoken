import { useEffect, useState, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase, refreshSession } from "@/lib/supabase";
import { Loading } from "@/components/ui/loading";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const location = useLocation();
  const retryCountRef = useRef(0);
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout | null = null;
    let retryTimeoutId: NodeJS.Timeout | null = null;
    
    // Reset when location changes
    retryCountRef.current = 0;
    hasCheckedRef.current = false;
    
    const checkAuth = async () => {
      if (!isMounted || hasCheckedRef.current) return;
      
      try {
        // Add timeout to prevent hanging
        timeoutId = setTimeout(() => {
          if (isMounted) {
            console.warn('AuthGuard timeout - forcing loading to false');
            setIsLoading(false);
            setIsAuthenticated(false);
            hasCheckedRef.current = true;
          }
        }, 5000); // 5 second timeout for auth check
        
        // First try to get the session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        
        if (!isMounted) return;
        
        if (sessionError) {
          console.error("Session error:", sessionError);
          
          // Check if it's a refresh token error
          if (sessionError.message?.includes('refresh token') || 
              sessionError.message?.includes('Invalid refresh token') ||
              sessionError.message?.includes('refresh token not found')) {
            console.log('Refresh token error detected - clearing session');
            // Clear invalid tokens
            localStorage.removeItem('sb-access-token');
            localStorage.removeItem('sb-refresh-token');
            await supabase.auth.signOut();
            if (isMounted) {
              setIsAuthenticated(false);
              setIsLoading(false);
              hasCheckedRef.current = true;
            }
            return;
          }
          
          // If it's a 403 or auth error, clear the session and redirect to signin
          if (sessionError.message?.includes('403') || sessionError.message?.includes('Forbidden')) {
            console.log('403 Forbidden error - clearing session and redirecting to signin');
            await supabase.auth.signOut();
            if (isMounted) {
              setIsAuthenticated(false);
              setIsLoading(false);
              hasCheckedRef.current = true;
            }
            return;
          }
        }
        
        if (!session) {
          // Try to refresh the session if none exists
          const refreshed = await refreshSession();
          if (isMounted) {
            setIsAuthenticated(refreshed);
            setIsLoading(false);
            hasCheckedRef.current = true;
            // If refresh failed, redirect to signin
            if (!refreshed) {
              return;
            }
          }
        } else {
          if (isMounted) {
            setIsAuthenticated(true);
            setIsLoading(false);
            hasCheckedRef.current = true;
          }
        }
      } catch (error: any) {
        console.error("Authentication error:", error);
        
        if (!isMounted) return;
        
        // Check if it's a refresh token error
        if (error.message?.includes('refresh token') || 
            error.message?.includes('Invalid refresh token') ||
            error.message?.includes('refresh token not found')) {
          console.log('Refresh token error in catch - clearing session');
          localStorage.removeItem('sb-access-token');
          localStorage.removeItem('sb-refresh-token');
          await supabase.auth.signOut();
          setIsAuthenticated(false);
          setIsLoading(false);
          hasCheckedRef.current = true;
          return;
        }
        
        // If it's a 403 error, clear session and redirect to signin
        if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
          console.log('403 Forbidden error in catch - clearing session');
          await supabase.auth.signOut();
          setIsAuthenticated(false);
          setIsLoading(false);
          hasCheckedRef.current = true;
          return;
        }
        
        // If this is a network error or temporary issue, retry a few times
        if (retryCountRef.current < 2) {
          console.log(`Retrying authentication check (attempt ${retryCountRef.current + 1})`);
          retryCountRef.current += 1;
          retryTimeoutId = setTimeout(() => {
            if (isMounted && !hasCheckedRef.current) {
              checkAuth();
            }
          }, 1000 * retryCountRef.current); // Exponential backoff
          return;
        }
        
        // After max retries, stop loading
        setIsAuthenticated(false);
        setIsLoading(false);
        hasCheckedRef.current = true;
      }
    };

    checkAuth();
    
    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        
        console.log('Auth state change:', event, !!session);
        setIsAuthenticated(!!session);
        setIsLoading(false);
        hasCheckedRef.current = true;
        retryCountRef.current = 0; // Reset retry count on successful auth change
      }
    );

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId);
      }
      subscription.unsubscribe();
    };
  }, [location.pathname]); // Only re-run when location changes

  if (isLoading) {
    console.log('AuthGuard: Loading...');
    return <Loading />;
  }

  console.log('AuthGuard: isAuthenticated =', isAuthenticated, 'location =', location.pathname);

  if (!isAuthenticated) {
    // Only redirect to signin if we're sure the user is not authenticated
    // and we're not on a public page like affiliate signup
    const isPublicPage = location.pathname.includes('/affiliate-signup') || 
                        location.pathname.includes('/pricing') ||
                        location.pathname.includes('/signin') ||
                        location.pathname.includes('/signup') ||
                        location.pathname.includes('/debug');
    
    if (!isPublicPage) {
      console.log('User not authenticated, redirecting to signin');
      return <Navigate to="/signin" state={{ from: location }} replace />;
    }
  } else {
    // If user is authenticated and on pricing page, redirect to app
    if (location.pathname === '/pricing') {
      console.log('Authenticated user on pricing page, redirecting to app');
      return <Navigate to="/app" replace />;
    }
  }

  return <>{children}</>;
} 
