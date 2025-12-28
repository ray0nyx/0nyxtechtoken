import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { email, userId } = await req.json();

    // Create Stripe customer
    const customer = await stripe.customers.create({
      email,
      metadata: {
        userId: userId,
      },
    });

    // Update user subscription with Stripe customer ID
    await supabase
      .from('user_subscriptions')
      .update({ stripe_customer_id: customer.id })
      .eq('user_id', userId);

    return new Response(JSON.stringify({ id: customer.id }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
} 