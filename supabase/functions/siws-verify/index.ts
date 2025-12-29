import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import nacl from "https://esm.sh/tweetnacl";

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
// JWT signing using standard Web Crypto API
function base64UrlEncode(buffer: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(buffer));
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function createJWT(payload: Record<string, any>, secret: string): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = btoa(JSON.stringify(header)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
  );

  return `${encodedHeader}.${encodedPayload}.${base64UrlEncode(signature)}`;
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

    console.log(`Verifying SIWS for domain: ${domain}, message contains: ${message.includes(domain)}`);

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

    // Validate domain - allow local development and production
    const supabaseHostname = new URL(Deno.env.get("SUPABASE_URL") ?? "").hostname;
    const appDomain = Deno.env.get("APP_DOMAIN") || "0nyxtech.xyz";
    const isLocal = domain === "localhost" || domain === "127.0.0.1";
    const isProd = domain === appDomain || domain.endsWith(`.${appDomain}`);

    if (!message.includes(domain) || (!isLocal && !isProd && domain !== supabaseHostname)) {
      console.error(`Domain mismatch. Domain: ${domain}, AppDomain: ${appDomain}, Supabase: ${supabaseHostname}, Local: ${isLocal}, Prod: ${isProd}`);
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
    const nowTimestamp = new Date();
    const fiveMinutesAgo = new Date(nowTimestamp.getTime() - 5 * 60 * 1000);
    const fiveMinutesAhead = new Date(nowTimestamp.getTime() + 5 * 60 * 1000); // Allow some clock skew

    if (messageTimestamp < fiveMinutesAgo || messageTimestamp > fiveMinutesAhead) {
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
      const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

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
      .select("user_id")
      .eq("provider", "wallet")
      .eq("provider_id", publicKey)
      .single();

    let userId: string;
    let isNewUser = false;

    if (existingIdentity) {
      // User exists, return existing user
      userId = existingIdentity.user_id;
    } else {
      // Create new user using Supabase Auth Admin API
      // This properly handles all database triggers (like profile creation)
      const walletEmail = `${publicKey}@wallet.0nyxtech.xyz`;
      const tempPassword = crypto.randomUUID(); // Random password for wallet users (they won't use it)

      console.log("Creating new auth user for wallet:", publicKey);
      const { data: authUser, error: authError } = await supabaseClient.auth.admin.createUser({
        email: walletEmail,
        password: tempPassword,
        email_confirm: true, // Auto-confirm email for wallet users
        user_metadata: {
          wallet_address: publicKey,
          auth_provider: 'wallet',
        },
      });

      if (authError) {
        console.error("Auth user creation error:", JSON.stringify(authError));
        throw new Error(`Failed to create user: ${authError.message || JSON.stringify(authError)}`);
      }

      if (!authUser?.user) {
        console.error("Auth user creation returned no user data");
        throw new Error("Failed to create user: No user data returned");
      }

      userId = authUser.user.id;
      isNewUser = true;
      console.log("Created auth user with id:", userId);

      // Create identity record to link wallet to user
      console.log("Creating identity for user:", userId, "wallet:", publicKey);
      const { error: identityError } = await supabaseClient
        .from("identities")
        .insert({
          user_id: userId,
          provider: "wallet",
          provider_id: publicKey,
        });

      if (identityError) {
        console.error("Identity creation error:", JSON.stringify(identityError));
        // Don't throw here - user was created successfully, identity is bonus
        console.log("Warning: Identity creation failed but user was created");
      }
    }

    // Generate JWT token using Supabase's JWT secret (automatically available in Edge Functions)
    const jwtSecret = Deno.env.get("SUPABASE_JWT_SECRET") || Deno.env.get("JWT_SECRET");
    if (!jwtSecret) {
      console.error("JWT secret not configured. Available env vars:", Object.keys(Deno.env.toObject()).join(", "));
      // Fallback: Return basic authentication without JWT
      // The frontend can still use the user data for session management
      return new Response(
        JSON.stringify({
          token: `wallet_${userId}`, // Placeholder token - frontend should handle wallet auth differently
          user: {
            id: userId,
            publicKey,
            isNewUser,
            authProvider: "wallet",
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const token = await createJWT(
      {
        sub: userId,
        publicKey,
        provider: "wallet",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
      },
      jwtSecret
    );

    // Get user profile data if available
    const { data: profileData } = await supabaseClient
      .from("profiles")
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
          authProvider: "wallet",
          profile: profileData || {},
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
