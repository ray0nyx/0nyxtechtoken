import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Generate a cryptographically secure random nonce
    const nonce = crypto.randomUUID();
    
    // Optional: extract publicKey from request if provided (for better tracking)
    const { publicKey } = await req.json().catch(() => ({}));

    // Store nonce in database with 5 minute expiration
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    const { error: insertError } = await supabaseClient
      .from("siws_nonces")
      .insert({
        nonce,
        public_key: publicKey || null,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("Error storing nonce:", insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify({ nonce, expiresAt: expiresAt.toISOString() }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error generating nonce:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to generate nonce" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
