import { supabase } from "@/lib/supabase";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export const subscriptionService = {
  // Trial functions removed - no more free trials

  async redirectToCheckout(priceId: string) {
    const stripe = await stripePromise;
    if (!stripe) throw new Error('Stripe failed to load');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get or create Stripe customer
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    let customerId = subscription?.stripe_customer_id;

    if (!customerId) {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user?.email) throw new Error('User email not found');

      // Create customer on your backend
      const response = await fetch('/api/create-customer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userData.user.email,
          userId: user.id,
        }),
      });

      const customer = await response.json();
      customerId = customer.id;
    }

    // Create checkout session
    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        priceId,
        customerId,
      }),
    });

    const session = await response.json();
    
    // Redirect to Stripe checkout
    const result = await stripe.redirectToCheckout({
      sessionId: session.id,
    });

    if (result.error) {
      throw new Error(result.error.message);
    }
  },

  async canConnectMoreAccounts() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!subscription) return false;

    // No trial access - only active subscriptions with Stripe payment

    // Paid subscribers can connect unlimited accounts
    return subscription.status === 'active' && subscription.stripe_customer_id && subscription.stripe_subscription_id;
  },

  async incrementConnectedAccounts() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // First get the current count
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('connected_accounts')
      .eq('user_id', user.id)
      .single();

    if (!subscription) return false;

    // Then increment it
    const { error } = await supabase
      .from('user_subscriptions')
      .update({
        connected_accounts: (subscription.connected_accounts || 0) + 1,
      })
      .eq('user_id', user.id);

    return !error;
  }
}; 