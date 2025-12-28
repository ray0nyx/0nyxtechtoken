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
    const { priceId, userId } = await req.json();

    // Get or create Stripe customer
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();

    let customerId = subscription?.stripe_customer_id;

    if (!customerId) {
      const { data } = await supabase.auth.admin.getUserById(userId);
      if (!data?.user) throw new Error('User not found');

      const customer = await stripe.customers.create({
        email: data.user.email ?? undefined,
        metadata: {
          userId: userId,
        },
      });

      await supabase
        .from('user_subscriptions')
        .update({ stripe_customer_id: customer.id })
        .eq('user_id', userId);

      customerId = customer.id;
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.VITE_APP_URL}/app/dashboard?success=true`,
      cancel_url: `${process.env.VITE_APP_URL}/pricing?canceled=true`,
      subscription_data: {
        metadata: {
          userId: userId,
        },
      },
    });

    return new Response(JSON.stringify({ id: session.id }), {
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