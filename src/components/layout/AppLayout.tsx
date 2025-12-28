import { useEffect } from 'react';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { AppNavigation } from './AppNavigation';
import { PwaInstallPrompt } from '@/components/PwaInstallPrompt';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { Analytics } from '@/components/Analytics';
import {
  trackPageView,
  trackEvent,
  startSession,
  endSession
} from '@/utils/analytics';

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const supabase = createClient();

  // Track page views when the location changes
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    let debounceTimer: NodeJS.Timeout | null = null;

    const trackCurrentPage = async () => {
      try {
        // Add timeout to prevent hanging
        timeoutId = setTimeout(() => {
          console.warn('Page view tracking timeout');
        }, 2000); // Reduced from 3 to 2 seconds

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        if (user?.id) {
          trackPageView(user.id, location.pathname);
        }
      } catch (error) {
        console.error('Error tracking page view:', error);
      }
    };

    // Debounce page view tracking
    debounceTimer = setTimeout(trackCurrentPage, 200); // Increased from 100ms to 200ms
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [location.pathname, supabase.auth]);

  // Start/end session tracking
  useEffect(() => {
    const initializeSession = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user?.id) {
          // Start a new session when the app layout mounts
          startSession(user.id);

          // Track login event if coming from login
          if (location.pathname === '/app' && location.state?.from === '/signin') {
            trackEvent(user.id, 'login');
          }
        }
      } catch (error) {
        console.error('Error starting session:', error);
      }
    };

    initializeSession();

    // End session on unmount
    return () => {
      const endUserSession = async () => {
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (user?.id) {
            endSession(user.id);
          }
        } catch (error) {
          console.error('Error ending session:', error);
        }
      };

      endUserSession();
    };
  }, [supabase.auth, location]);

  // Auth state change listener
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === 'SIGNED_OUT') {
        // Track logout event before clearing storage
        const trackLogout = async () => {
          try {
            const {
              data: { user },
            } = await supabase.auth.getUser();

            if (user?.id) {
              await trackEvent(user.id, 'logout');
              await endSession(user.id);
            }
          } catch (error) {
            console.error('Error tracking logout:', error);
          }
        };

        trackLogout().finally(() => {
          // Clear any auth-related storage
          localStorage.clear();
          sessionStorage.clear();

          toast({
            title: "Signed out",
            description: "You have been successfully signed out.",
          });

          // Navigate to sign-in and prevent going back
          navigate('/signin', { replace: true });
        });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, toast, supabase.auth]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppNavigation />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <PwaInstallPrompt />
      <OfflineIndicator />
      <Analytics />
    </div>
  );
} 