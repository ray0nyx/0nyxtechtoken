/// <reference types="https://deno.land/x/stripe@v1.0.0/mod.ts" />
/// <reference lib="deno.ns" />

import { serve, createClient, Stripe } from "../deps.ts";

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2025-02-24.acacia',
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId } = await req.json()

    if (!userId) {
      throw new Error('Missing required field: userId')
    }

    console.log('Finding customer for userId:', userId)

    // Find the customer in Stripe
    const customers = await stripe.customers.search({
      query: `metadata['supabase_user_id']:'${userId}'`,
    })

    if (!customers.data || customers.data.length === 0) {
      throw new Error('No customer found for this user')
    }

    console.log('Creating billing portal session for customer:', customers.data[0].id)

    // Create a billing portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customers.data[0].id,
      return_url: `${req.headers.get('origin')}/app/settings`,
    })

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in create-portal-session:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        type: error.type,
        code: error.code,
        stack: error.stack
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
}) 