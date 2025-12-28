import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { verify } from "https://esm.sh/@noble/ed25519@2.0.0";

// Base58 decoding for Solana addresses
function base58Decode(str: string): Uint8Array {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const decoded = [0];
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const charIndex = alphabet.indexOf(char);
    if (charIndex === -1) throw new Error("Invalid base58 character");
    
    let carry = charIndex;
    for (let j = 0; j < decoded.length; j++) {
      carry += decoded[j] * 58;
      decoded[j] = carry % 256;
      carry = Math.floor(carry / 256);
    }
    while (carry > 0) {
      decoded.push(carry % 256);
      carry = Math.floor(carry / 256);
    }
  }
  
  // Remove leading zeros
  for (let i = 0; i < str.length && str[i] === "1"; i++) {
    decoded.push(0);
  }
  
  return new Uint8Array(decoded.reverse());
}

// JWT signing (simple implementation - in production use a proper JWT library)
function base64UrlEncode(str: string): string {
  return btoa(str)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function createJWT(payload: Record<string, any>, secret: string): string {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  
  // Simple HMAC-SHA256 (in production, use a proper crypto library)
  const signature = base64UrlEncode(
    btoa(
      String.fromCharCode(
        ...new Uint8Array(
          crypto.subtle.digestSync("SHA-256", 
            new TextEncoder().encode(`${encodedHeader}.${encodedPayload}.${secret}`)
          )
        )
      )
    )
  );
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

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

    const {
      publicKey,
      message,
      signature,
      nonce,
      domain,
      timestamp,
    } = await req.json();

    // Validate required fields
    if (!publicKey || !message || !signature || !nonce || !domain || !timestamp) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Verify nonce exists and hasn't expired
    const { data: nonceData, error: nonceError } = await supabaseClient
      .from("siws_nonces")
      .select("*")
      .eq("nonce", nonce)
      .single();

    if (nonceError || !nonceData) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired nonce" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    if (new Date(nonceData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Nonce has expired" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    if (nonceData.used_at) {
      return new Response(
        JSON.stringify({ error: "Nonce has already been used" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Validate domain
    const expectedDomain = new URL(Deno.env.get("SUPABASE_URL") ?? "").hostname;
    if (!message.includes(domain) || domain !== expectedDomain) {
      return new Response(
        JSON.stringify({ error: "Invalid domain" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Validate timestamp (should be within last 5 minutes)
    const messageTimestamp = new Date(timestamp);
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    if (messageTimestamp < fiveMinutesAgo || messageTimestamp > now) {
      return new Response(
        JSON.stringify({ error: "Invalid timestamp" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Verify signature using ed25519
    try {
      // Solana public keys are base58 encoded, decode them
      const publicKeyBytes = base58Decode(publicKey);
      
      // Signature from wallet adapter is Uint8Array, but we receive it as base64
      // Convert from base64 to Uint8Array
      let signatureBytes: Uint8Array;
      try {
        // Try base64 first (common format from wallet adapters)
        const base64Str = signature.replace(/-/g, "+").replace(/_/g, "/");
        const binaryStr = atob(base64Str);
        signatureBytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          signatureBytes[i] = binaryStr.charCodeAt(i);
        }
      } catch {
        // If base64 fails, try base58 (Solana native format)
        signatureBytes = base58Decode(signature);
      }

      // Convert message to bytes
      const messageBytes = new TextEncoder().encode(message);

      // Verify signature (ed25519 signature is 64 bytes)
      if (signatureBytes.length !== 64) {
        return new Response(
          JSON.stringify({ error: "Invalid signature length" }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          }
        );
      }

      // Verify signature
      const isValid = await verify(signatureBytes, messageBytes, publicKeyBytes);

      if (!isValid) {
        return new Response(
          JSON.stringify({ error: "Invalid signature" }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 401,
          }
        );
      }
    } catch (verifyError) {
      console.error("Signature verification error:", verifyError);
      return new Response(
        JSON.stringify({ error: "Failed to verify signature: " + verifyError.message }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    // Mark nonce as used
    await supabaseClient
      .from("siws_nonces")
      .update({ used_at: new Date().toISOString() })
      .eq("nonce", nonce);

    // Check if identity exists
    const { data: existingIdentity } = await supabaseClient
      .from("identities")
      .select("user_id, users(*)")
      .eq("provider", "wallet")
      .eq("provider_id", publicKey)
      .single();

    let userId: string;
    let isNewUser = false;

    if (existingIdentity) {
      // User exists, return existing user
      userId = existingIdentity.user_id;
    } else {
      // Create new user and identity
      const { data: newUser, error: userError } = await supabaseClient
        .from("users")
        .insert({
          settings: {},
        })
        .select()
        .single();

      if (userError || !newUser) {
        throw new Error("Failed to create user");
      }

      userId = newUser.id;
      isNewUser = true;

      // Create identity
      const { error: identityError } = await supabaseClient
        .from("identities")
        .insert({
          user_id: userId,
          provider: "wallet",
          provider_id: publicKey,
        });

      if (identityError) {
        throw new Error("Failed to create identity");
      }
    }

    // Generate JWT token
    const jwtSecret = Deno.env.get("JWT_SECRET");
    if (!jwtSecret) {
      console.error("JWT_SECRET not configured in environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }
    const token = createJWT(
      {
        sub: userId,
        publicKey,
        provider: "wallet",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
      },
      jwtSecret
    );

    // Get user data
    const { data: userData } = await supabaseClient
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    return new Response(
      JSON.stringify({
        token,
        user: {
          id: userId,
          publicKey,
          isNewUser,
          settings: userData?.settings || {},
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error verifying SIWS:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to verify signature" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
