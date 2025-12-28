import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { authService } from "@/lib/services/authService";
import { Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { loadStripe } from "@stripe/stripe-js";
import { supabase } from "@/lib/supabase";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

interface BillingPlansProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const plans = [
  {
    name: "Monthly",
    price: "$19.99",
    interval: "month",
    priceId: "price_1QzZqQK9cein1vEZExkBcl89",
    features: [
      "Unlimited trades",
      "Advanced analytics",
      "AI trade insights",
      "Priority support",
      "Custom reports",
    ],
  },
  {
    name: "Yearly",
    price: "$150",
    interval: "year",
    priceId: "price_1R0eqXK9cein1vEZJ35QwGMR",
    savings: "Save $89.88",
    features: [
      "Everything in Monthly",
      "2 months free",
      "Early access to new features",
      "1-on-1 consultation",
      "Custom strategy development",
    ],
  },
];

export function BillingPlans({ open, onOpenChange }: BillingPlansProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubscribe = async (priceId: string) => {
    try {
      setLoading(priceId);
      const user = await authService.getCurrentUser();
      
      if (!user) {
        toast({
          title: "Error",
          description: "Please sign in to subscribe",
          variant: "destructive",
        });
        return;
      }

      // Create a Stripe Checkout Session
      const { data: session, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          priceId,
          userId: user.id,
          email: user.email,
        },
      });

      if (error) throw error;

      // Redirect to Stripe Checkout
      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe failed to load');

      const { error: stripeError } = await stripe.redirectToCheckout({
        sessionId: session.id,
      });

      if (stripeError) throw stripeError;

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to process subscription",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  const handleManageBilling = async () => {
    try {
      setLoading('manage');
      const user = await authService.getCurrentUser();
      
      if (!user) {
        toast({
          title: "Error",
          description: "Please sign in to manage billing",
          variant: "destructive",
        });
        return;
      }

      // Create a Stripe Customer Portal session
      const { data: session, error } = await supabase.functions.invoke('create-portal-session', {
        body: { userId: user.id },
      });

      if (error) throw error;

      // Redirect to the customer portal
      window.location.href = session.url;

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to open billing portal",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Subscription Plans</DialogTitle>
          <DialogDescription>
            Choose the plan that best fits your needs
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6 mt-4">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className="relative rounded-lg border p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="mb-4">
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <div className="mt-2">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">/{plan.interval}</span>
                </div>
                {plan.savings && (
                  <div className="mt-1">
                    <span className="text-sm text-green-600 font-medium">
                      {plan.savings}
                    </span>
                  </div>
                )}
              </div>

              <ul className="space-y-2 mb-6">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="w-full"
                onClick={() => handleSubscribe(plan.priceId)}
                disabled={!!loading}
              >
                {loading === plan.priceId ? "Processing..." : "Subscribe"}
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-6 text-center">
          <Button
            variant="outline"
            onClick={handleManageBilling}
            disabled={loading === 'manage'}
          >
            {loading === 'manage' ? "Loading..." : "Manage Subscription"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 