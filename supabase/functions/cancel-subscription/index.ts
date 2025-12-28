/// <reference types="https://deno.land/x/stripe@v1.0.0/mod.ts" />
/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.0.0'

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400',
}

// Add Content-Type to all responses
const responseHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: responseHeaders
    });
  }

  try {
    // Check for required environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Missing Supabase credentials' }),
        { status: 500, headers: responseHeaders }
      );
    }

    if (!stripeSecretKey) {
      console.error('Missing Stripe secret key');
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Missing Stripe credentials' }),
        { status: 500, headers: responseHeaders }
      );
    }

    // Initialize Stripe
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Initialize Supabase client with auth context for the requesting user
    const supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization') || '' },
        },
      }
    );

    // Get the user from Supabase auth
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Authentication error', details: userError.message }),
        { status: 401, headers: responseHeaders }
      );
    }

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: User not found' }),
        { status: 401, headers: responseHeaders }
      );
    }

    // Initialize Supabase admin client for database operations
    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceKey
    );

    // Get the user's active subscription from the database
    const { data: subscriptionData, error: subscriptionError } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (subscriptionError) {
      console.error('Database error:', subscriptionError);
      return new Response(
        JSON.stringify({ error: 'Database error', details: subscriptionError.message }),
        { status: 500, headers: responseHeaders }
      );
    }

    if (!subscriptionData || !subscriptionData.stripe_subscription_id) {
      return new Response(
        JSON.stringify({ error: 'No active subscription found' }),
        { status: 404, headers: responseHeaders }
      );
    }

    // Cancel the subscription in Stripe
    try {
      // Cancel at period end to allow the user to retain access until the end of the current billing period
      await stripe.subscriptions.update(subscriptionData.stripe_subscription_id, {
        cancel_at_period_end: true,
      });

      // Update the subscription status in the database
      await supabaseAdmin
        .from('subscriptions')
        .update({
          cancel_at_period_end: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscriptionData.id);

      // Send a cancellation confirmation email if needed
      // This could be implemented similar to the subscription-notifications function

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Subscription will be canceled at the end of the current billing period' 
        }),
        { status: 200, headers: responseHeaders }
      );
    } catch (stripeError) {
      console.error('Stripe error:', stripeError);
      return new Response(
        JSON.stringify({ 
          error: 'Subscription cancellation error', 
          details: stripeError.message 
        }),
        { status: 400, headers: responseHeaders }
      );
    }
  } catch (error) {
    console.error('Cancel subscription error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: responseHeaders }
    );
  }
}); 