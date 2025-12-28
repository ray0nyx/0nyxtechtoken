/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4?target=deno";

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400',
};

// Add Content-Type to all responses
const responseHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
};

interface UserSubscription {
  id: string;
  user_id: string;
  status: 'trialing' | 'active' | 'expired';
  trial_end: string;
  updated_at: string;
  users: {
    email: string;
  };
}

// Send email using fetch instead of Resend Node.js SDK
async function sendEmail(to: string, subject: string, html: string) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  
  if (!RESEND_API_KEY) {
    console.error("Missing RESEND_API_KEY environment variable");
    throw new Error("Missing RESEND_API_KEY environment variable");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${RESEND_API_KEY}`
    },
    body: JSON.stringify({
      from: "TradeLog <notifications@tradelog.app>",
      to: [to],
      subject: subject,
      html: html
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Failed to send email:", error);
    throw new Error(`Failed to send email: ${error}`);
  }

  return await response.json();
}

async function processSubscriptions() {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get subscriptions that are about to expire (trial ending in 3 days)
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const threeDaysFromNowStr = threeDaysFromNow.toISOString().split('T')[0];

    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select('*, users(email)')
      .eq('status', 'trialing')
      .lt('trial_end', threeDaysFromNowStr)
      .is('trial_end_notified', null);

    if (error) {
      throw error;
    }

    console.log(`Found ${subscriptions?.length || 0} subscriptions about to expire`);

    // Send notifications
    for (const subscription of (subscriptions || [])) {
      try {
        const userEmail = subscription.users?.email;
        if (!userEmail) continue;

        await sendEmail(
          userEmail,
          "Your TradeLog trial is ending soon",
          `
          <div>
            <h1>Your TradeLog trial is ending soon</h1>
            <p>Your trial will end on ${new Date(subscription.trial_end).toLocaleDateString()}.</p>
            <p>Upgrade now to continue using all features.</p>
            <a href="https://tradelog.app/pricing" style="display: inline-block; background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Upgrade Now</a>
          </div>
          `
        );

        // Mark as notified
        await supabase
          .from('subscriptions')
          .update({ trial_end_notified: new Date().toISOString() })
          .eq('id', subscription.id);

        console.log(`Sent notification to ${userEmail}`);
      } catch (err) {
        console.error(`Failed to process subscription ${subscription.id}:`, err);
      }
    }

    return { success: true, processed: subscriptions?.length || 0 };
  } catch (error) {
    console.error("Error processing subscriptions:", error);
    throw error;
  }
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
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: responseHeaders }
      );
    }

    // Process subscriptions
    const result = await processSubscriptions();

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: responseHeaders }
    );
  } catch (error) {
    console.error('Error in subscription-notifications function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: responseHeaders }
    );
  }
}); 