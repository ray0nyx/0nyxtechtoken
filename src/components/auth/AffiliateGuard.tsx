import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { createClient } from "@/lib/supabase/client";
import { Loading } from "@/components/ui/loading";
import { useToast } from "@/components/ui/use-toast";

export function AffiliateGuard({ children }: { children: React.ReactNode }) {
  const [isAffiliate, setIsAffiliate] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const location = useLocation();
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    const checkAffiliateAccess = async () => {
      try {
        // Get the current session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          setIsAffiliate(false);
          return;
        }

        console.log('Checking affiliate access for user:', session.user.email);

        // Check if user is an approved affiliate
        const { data: affiliate, error } = await supabase
          .from('affiliates')
          .select('id, status')
          .eq('email', session.user.email)
          .eq('status', 'active')
          .single();

        console.log('Affiliate check result:', { affiliate, error });

        if (error || !affiliate) {
          console.log('User is not an approved affiliate');
          setIsAffiliate(false);
          toast({
            title: "Access Denied",
            description: "You need to be an approved affiliate to access this page.",
            variant: "destructive",
          });
        } else {
          console.log('User is an approved affiliate');
          setIsAffiliate(true);
        }
      } catch (error) {
        console.error("Affiliate authentication error:", error);
        setIsAffiliate(false);
        toast({
          title: "Error",
          description: "Failed to verify affiliate access. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    checkAffiliateAccess();
  }, [supabase, toast]);

  if (isLoading) {
    return <Loading />;
  }

  if (!isAffiliate) {
    // Redirect to app if not an affiliate
    return <Navigate to="/app" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
