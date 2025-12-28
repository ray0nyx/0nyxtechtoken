import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@/lib/supabase/client";
import { Loading } from "@/components/ui/loading";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { subscriptionService } from "@/lib/services/subscriptionService";

interface SubscriptionCheckProps {
  children: ReactNode;
}

export function SubscriptionCheck({ children }: SubscriptionCheckProps) {
  const [loading, setLoading] = useState(true);
  const [hasSubscription, setHasSubscription] = useState(false);
  const navigate = useNavigate();
  const supabase = createClient();

  useEffect(() => {
    const checkSubscription = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No authenticated user");

        // For now, we'll assume all users have a subscription
        // TODO: Implement actual subscription check
        setHasSubscription(true);
      } catch (error) {
        console.error("Error checking subscription:", error);
        setHasSubscription(false);
      } finally {
        setLoading(false);
      }
    };

    checkSubscription();
  }, []);

  if (loading) {
    return <Loading />;
  }

  if (!hasSubscription) {
    navigate("/pricing");
    return null;
  }

  return <>{children}</>;
}

interface SubscriptionCheckProps {
  children: React.ReactNode;
}

export function SubscriptionCheckOld({ children }: SubscriptionCheckProps) {
  const [showModal, setShowModal] = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkSubscription = async () => {
      const status = await subscriptionService.checkTrialStatus();
      
      if (!status) return;

      if (!status.isTrialActive && !status.hasActiveSubscription) {
        setShowModal(true);
        return;
      }

      if (status.isTrialActive) {
        const daysLeft = Math.ceil(
          (status.trialEndDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        );
        setTrialDaysLeft(daysLeft);
      }
    };

    checkSubscription();
  }, []);

  const handleUpgrade = () => {
    navigate("/pricing");
  };

  return (
    <>
      {children}
      
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Subscription Required</DialogTitle>
            <DialogDescription>
              Your trial period has ended. Please choose a subscription plan to continue using tradeLog.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <Button
              onClick={handleUpgrade}
              className="w-full bg-[#8b008b] hover:bg-[#6a006a]"
            >
              View Plans
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {trialDaysLeft !== null && trialDaysLeft <= 3 && (
        <div className="fixed bottom-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          <p className="font-medium">
            Trial ending soon! {trialDaysLeft} {trialDaysLeft === 1 ? 'day' : 'days'} left.
          </p>
          <Button
            onClick={handleUpgrade}
            variant="link"
            className="text-[#8b008b] p-0 h-auto font-medium"
          >
            Upgrade now
          </Button>
        </div>
      )}
    </>
  );
} 