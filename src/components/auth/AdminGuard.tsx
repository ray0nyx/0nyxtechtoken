import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { createClient } from "@/lib/supabase/client";
import { Loading } from "@/components/ui/loading";
import { useSubscription } from "@/contexts/SubscriptionContext";

const ADMIN_UUID = "856950ff-d638-419d-bcf1-b7dac51d1c7f";
const DEVELOPER_UUIDS = [
  "856950ff-d638-419d-bcf1-b7dac51d1c7f", // rayhan@arafatcapital.com
  "8538e0b7-6dcd-4673-b39f-00d273c7fc76",  // sevemadsen18@gmail.com
  "92172686-1ae8-47d8-ad96-9514860ab468"
];

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const location = useLocation();
  const supabase = createClient();
  const { isDeveloper } = useSubscription();

  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        // Get the current session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          setIsAdmin(false);
          setIsLoading(false);
          return;
        }

        const userId = session.user.id;
        
        // Check if user is admin or developer (check user ID first, then context)
        // This ensures it works even if subscription context hasn't loaded yet
        const hasAdminAccess = userId === ADMIN_UUID || 
                              DEVELOPER_UUIDS.includes(userId) || 
                              isDeveloper;
        
        console.log('AdminGuard: Checking access', {
          userId,
          isAdminUUID: userId === ADMIN_UUID,
          isDeveloperUUID: DEVELOPER_UUIDS.includes(userId),
          isDeveloperFromContext: isDeveloper,
          hasAdminAccess
        });
        
        setIsAdmin(hasAdminAccess);
      } catch (error) {
        console.error("Admin authentication error:", error);
        setIsAdmin(false);
      } finally {
        setIsLoading(false);
      }
    };

    // Check immediately
    checkAdminAccess();
    
    // Also check when isDeveloper changes (subscription context loads)
    if (isDeveloper !== undefined) {
      checkAdminAccess();
    }
    
    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!session) {
          setIsAdmin(false);
          setIsLoading(false);
          return;
        }
        
        const userId = session.user.id;
        // Check user ID directly first (works immediately)
        // Then check isDeveloper from context (may not be loaded yet)
        const hasAdminAccess = userId === ADMIN_UUID || 
                              DEVELOPER_UUIDS.includes(userId) || 
                              isDeveloper;
        
        console.log('AdminGuard: Auth state changed', {
          event,
          userId,
          hasAdminAccess,
          isDeveloperFromContext: isDeveloper
        });
        
        setIsAdmin(hasAdminAccess);
        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [isDeveloper, supabase]);

  if (isLoading) {
    return <Loading />;
  }

  if (!isAdmin) {
    // Redirect to app if not an admin
    return <Navigate to="/app" state={{ from: location }} replace />;
  }

  return <>{children}</>;
} 