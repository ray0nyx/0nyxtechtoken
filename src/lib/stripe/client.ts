import { loadStripe } from '@stripe/stripe-js';

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

if (!stripePublishableKey) {
  console.warn('Missing Stripe publishable key. Stripe functionality may be limited.');
}

export const getStripe = () => {
  return loadStripe(stripePublishableKey || '');
}; 