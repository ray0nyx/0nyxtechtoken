import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { createClient } from "@/lib/supabase/client";
import { Loading } from "@/components/ui/loading";
import { getSIWSToken, getSIWSPublicKey } from "@/lib/solana/siws";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const location = useLocation();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      // First check for Supabase session (email/Google auth)
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        setIsAuthenticated(true);
        return;
      }

      // If no Supabase session, check for SIWS wallet authentication
      const siwsToken = getSIWSToken();
      const siwsPublicKey = getSIWSPublicKey();

      if (siwsToken && siwsPublicKey) {
        // User is authenticated via wallet
        setIsAuthenticated(true);
        return;
      }

      // No authentication found
      setIsAuthenticated(false);
    };

    checkAuth();
  }, []);

  if (isAuthenticated === null) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
