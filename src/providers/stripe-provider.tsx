import { Elements } from '@stripe/stripe-js';
import { ReactNode, useEffect, useState } from 'react';
import { getStripe } from '@/lib/stripe/client';

interface StripeProviderProps {
  children: ReactNode;
}

export function StripeProvider({ children }: StripeProviderProps) {
  const [stripePromise, setStripePromise] = useState(() => getStripe());

  useEffect(() => {
    // Refresh Stripe instance if publishable key changes
    setStripePromise(getStripe());
  }, []);

  return <Elements stripe={stripePromise}>{children}</Elements>;
} 