/**
 * Coinbase OAuth Callback Handler
 * Handles the OAuth callback from Coinbase and exchanges code for tokens
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// OAuth client credentials (these should be stored in environment variables)
const COINBASE_CLIENT_ID = process.env.VITE_COINBASE_CLIENT_ID || process.env.COINBASE_CLIENT_ID || "your_coinbase_client_id";
const COINBASE_CLIENT_SECRET = process.env.VITE_COINBASE_CLIENT_SECRET || process.env.COINBASE_CLIENT_SECRET || "your_coinbase_client_secret";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, state, error: oauthError } = req.query;

  if (oauthError) {
    return res.redirect(`/auth/error?error=${encodeURIComponent(oauthError as string)}`);
  }

  if (!code || !state) {
    return res.redirect('/auth/error?error=missing_code_or_state');
  }

  try {
    // Exchange code for access token using OAuth client credentials
    const tokenResponse = await fetch('https://api.coinbase.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${COINBASE_CLIENT_ID}:${COINBASE_CLIENT_SECRET}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: `${process.env.VITE_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:8080'}/auth/coinbase/callback`
      })
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for token');
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in, scope } = tokenData;

    // Get user info from Coinbase
    const userResponse = await fetch('https://api.coinbase.com/v2/user', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!userResponse.ok) {
      throw new Error('Failed to get user info from Coinbase');
    }

    const userData = await userResponse.json();
    const coinbaseUserId = userData.data?.id || userData.data?.email;

    // Get the current user from Supabase
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return res.redirect('/auth/signin?error=user_not_authenticated');
    }

    // Save Coinbase account to database
    const { data: coinbaseAccount, error: saveError } = await supabase
      .from('coinbase_accounts')
      .insert({
        user_id: user.id,
        coinbase_user_id: coinbaseUserId,
        access_token: access_token,
        refresh_token: refresh_token,
        expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
        permissions: scope ? scope.split(' ') : ['wallet:accounts:read'],
        is_active: true
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving Coinbase account:', saveError);
      return res.redirect('/auth/error?error=account_save_failed');
    }

    // Redirect to success page or back to the app
    return res.redirect('/quant-testing?coinbase_connected=true');

  } catch (error) {
    console.error('Coinbase OAuth callback error:', error);
    return res.redirect('/auth/error?error=oauth_callback_failed');
  }
}
