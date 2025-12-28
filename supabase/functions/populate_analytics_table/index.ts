import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4?target=deno&no-check";
import { corsHeaders } from "../_shared/cors.ts";

// Add Content-Type to all responses
const responseHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: responseHeaders
    });
  }

  try {
    // Verify request method
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: responseHeaders }
      );
    }

    // Parse request body
    let requestData;
    try {
      requestData = await req.json();
    } catch (error) {
      console.error('Error parsing request body:', error);
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: responseHeaders }
      );
    }

    // Validate user_id
    const { user_id } = requestData;
    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: responseHeaders }
      );
    }

    // Create a Supabase client with the service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: responseHeaders }
      );
    }

    const supabaseClient = createClient(
      supabaseUrl,
      supabaseKey,
      {
        auth: {
          persistSession: false,
        }
      }
    );

    // Call the populate_analytics_table function
    const { error } = await supabaseClient.rpc('populate_analytics_table', { user_uuid: user_id });

    if (error) {
      console.error('Error populating analytics:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to populate analytics table',
          details: error.message
        }),
        { status: 500, headers: responseHeaders }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Analytics table populated successfully' 
      }),
      { status: 200, headers: responseHeaders }
    );
  } catch (error) {
    console.error('Error in populate_analytics_table function:', error);
    // Ensure we always return a valid Response object
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: responseHeaders }
    );
  }
}); 