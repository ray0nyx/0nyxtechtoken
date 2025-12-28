import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { code, state, redirect_uri } = await req.json()

    if (!code) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization code' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Exchanging Coinbase OAuth code for token')

    // Exchange code for access token
    const tokenResponse = await fetch('https://api.coinbase.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: Deno.env.get('VITE_COINBASE_CLIENT_ID') || '',
        client_secret: Deno.env.get('VITE_COINBASE_CLIENT_SECRET') || '',
        redirect_uri: redirect_uri,
      })
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      console.error('Coinbase token exchange failed:', errorData)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to exchange code for token: ' + (errorData.error_description || errorData.error)
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const tokenData = await tokenResponse.json()

    // Get user info from Coinbase
    const userResponse = await fetch('https://api.coinbase.com/v2/user', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      }
    })

    if (!userResponse.ok) {
      console.error('Failed to fetch Coinbase user info')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to fetch user information from Coinbase'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const userData = await userResponse.json()

    return new Response(
      JSON.stringify({ 
        success: true,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in,
        scope: tokenData.scope,
        token_type: tokenData.token_type,
        user_id: userData.data.id,
        user_email: userData.data.email
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Coinbase OAuth error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})




