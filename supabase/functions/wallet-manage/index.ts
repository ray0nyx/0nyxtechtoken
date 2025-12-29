// supabase/functions/wallet-manage/index.ts
// Edge Function for wallet management - uses service_role to bypass RLS for SIWS users

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
    // Handle CORS
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const {
            action,
            userId,
            walletAddress,
            blockchain,
            label,
            walletType,
            turnkeyWalletId,
            turnkeyOrgId,
            username,
            email,
            avatarUrl
        } = await req.json().catch(() => ({}));

        console.log("Wallet manage request:", { action, userId, walletAddress, blockchain, label, username });

        if (!userId) {
            return new Response(
                JSON.stringify({ error: "Missing userId" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
            );
        }

        if (action === "track_wallet") {
            // Add wallet to wallet_tracking table
            if (!walletAddress || !blockchain) {
                return new Response(
                    JSON.stringify({ error: "Missing walletAddress or blockchain" }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
                );
            }

            // Check if already tracked
            const { data: existing } = await supabase
                .from("wallet_tracking")
                .select("id")
                .eq("user_id", userId)
                .eq("wallet_address", walletAddress)
                .maybeSingle();

            if (existing) {
                return new Response(
                    JSON.stringify({ success: true, message: "Wallet already tracked", walletId: existing.id }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
                );
            }

            const { data, error } = await supabase
                .from("wallet_tracking")
                .insert({
                    user_id: userId,
                    wallet_address: walletAddress,
                    blockchain: blockchain || "solana",
                    label: label || "Wallet",
                    is_active: true,
                })
                .select()
                .single();

            if (error) {
                console.error("Error tracking wallet:", error);
                return new Response(
                    JSON.stringify({ error: error.message }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
                );
            }

            return new Response(
                JSON.stringify({ success: true, wallet: data }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
            );
        }

        if (action === "save_turnkey_wallet") {
            // Save Turnkey wallet to user_wallets table
            if (!walletAddress || !turnkeyWalletId || !turnkeyOrgId) {
                return new Response(
                    JSON.stringify({ error: "Missing walletAddress, turnkeyWalletId, or turnkeyOrgId" }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
                );
            }

            // Check if already exists
            const { data: existing } = await supabase
                .from("user_wallets")
                .select("id")
                .eq("user_id", userId)
                .eq("wallet_address", walletAddress)
                .maybeSingle();

            if (existing) {
                return new Response(
                    JSON.stringify({ success: true, message: "Wallet already saved", walletId: existing.id }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
                );
            }

            const { data, error } = await supabase
                .from("user_wallets")
                .insert({
                    user_id: userId,
                    wallet_address: walletAddress,
                    wallet_type: walletType || "turnkey",
                    turnkey_wallet_id: turnkeyWalletId,
                    turnkey_organization_id: turnkeyOrgId,
                    is_active: true,
                })
                .select()
                .single();

            if (error) {
                console.error("Error saving Turnkey wallet:", error);
                return new Response(
                    JSON.stringify({ error: error.message }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
                );
            }

            // Also add to wallet_tracking
            await supabase
                .from("wallet_tracking")
                .upsert({
                    user_id: userId,
                    wallet_address: walletAddress,
                    blockchain: "solana",
                    label: label || "Main Wallet",
                    is_active: true,
                });

            return new Response(
                JSON.stringify({ success: true, wallet: data }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
            );
        }

        if (action === "get_wallets") {
            // Get all tracked wallets for user
            const { data, error } = await supabase
                .from("wallet_tracking")
                .select("*")
                .eq("user_id", userId)
                .eq("is_active", true);

            if (error) {
                console.error("Error fetching wallets:", error);
                return new Response(
                    JSON.stringify({ error: error.message }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
                );
            }

            return new Response(
                JSON.stringify({ success: true, wallets: data || [] }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
            );
        }

        if (action === "get_turnkey_wallet") {
            // Get Turnkey wallet for user
            const { data, error } = await supabase
                .from("user_wallets")
                .select("*")
                .eq("user_id", userId)
                .eq("wallet_type", "turnkey")
                .eq("is_active", true)
                .limit(1)
                .maybeSingle();

            if (error) {
                console.error("Error fetching Turnkey wallet:", error);
                return new Response(
                    JSON.stringify({ error: error.message }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
                );
            }

            return new Response(
                JSON.stringify({ success: true, wallet: data }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
            );
        }

        if (action === "save_profile") {
            // Save user profile for SIWS users
            // Upsert to profiles table
            const { data, error } = await supabase
                .from("profiles")
                .upsert({
                    id: userId,
                    username: username || null,
                    avatar_url: avatarUrl || null,
                    updated_at: new Date().toISOString(),
                })
                .select()
                .single();

            if (error) {
                console.error("Error saving profile:", error);
                return new Response(
                    JSON.stringify({ error: error.message }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
                );
            }

            return new Response(
                JSON.stringify({ success: true, profile: data }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
            );
        }

        if (action === "get_profile") {
            // Get user profile for SIWS users
            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", userId)
                .maybeSingle();

            if (error) {
                console.error("Error fetching profile:", error);
                return new Response(
                    JSON.stringify({ error: error.message }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
                );
            }

            return new Response(
                JSON.stringify({ success: true, profile: data }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
            );
        }

        if (action === "delete_account") {
            // Delete all user data from database for SIWS users
            console.log("Deleting account data for user:", userId);

            // Delete from wallet_tracking
            await supabase
                .from("wallet_tracking")
                .delete()
                .eq("user_id", userId);

            // Delete from user_wallets
            await supabase
                .from("user_wallets")
                .delete()
                .eq("user_id", userId);

            // Delete from profiles
            await supabase
                .from("profiles")
                .delete()
                .eq("id", userId);

            // Delete from user_settings
            await supabase
                .from("user_settings")
                .delete()
                .eq("user_id", userId);

            // Delete from identities (if exists)
            await supabase
                .from("identities")
                .delete()
                .eq("user_id", userId);

            // Delete from users table (if exists)
            await supabase
                .from("users")
                .delete()
                .eq("id", userId);

            console.log("Successfully deleted all account data for user:", userId);

            return new Response(
                JSON.stringify({ success: true, message: "Account deleted successfully" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
            );
        }

        return new Response(
            JSON.stringify({ error: "Unknown action" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );

    } catch (error) {
        console.error("Wallet manage error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
    }
});
