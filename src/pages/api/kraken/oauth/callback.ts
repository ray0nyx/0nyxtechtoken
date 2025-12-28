/**
 * Kraken OAuth Callback Handler
 * Handles the OAuth callback from Kraken and exchanges code for tokens
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// OAuth client credentials (these should be stored in environment variables)
const KRAKEN_CLIENT_ID = process.env.VITE_KRAKEN_CLIENT_ID || process.env.KRAKEN_CLIENT_ID || "your_kraken_client_id";
const KRAKEN_CLIENT_SECRET = process.env.VITE_KRAKEN_CLIENT_SECRET || process.env.KRAKEN_CLIENT_SECRET || "your_kraken_client_secret";

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
    const tokenResponse = await fetch('https://www.kraken.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${KRAKEN_CLIENT_ID}:${KRAKEN_CLIENT_SECRET}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: `${process.env.VITE_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:8080'}/auth/kraken/callback`
      })
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for token');
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in, scope } = tokenData;

    // Get user info from Kraken
    const userResponse = await fetch('https://api.kraken.com/0/private/GetAccountInfo', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!userResponse.ok) {
      throw new Error('Failed to get user info from Kraken');
    }

    const userData = await userResponse.json();
    const krakenUserId = userData.result?.username || userData.result?.email;

    // Get the current user from Supabase
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return res.redirect('/auth/signin?error=user_not_authenticated');
    }

    // Save Kraken account to database
    const { data: krakenAccount, error: saveError } = await supabase
      .from('kraken_accounts')
      .insert({
        user_id: user.id,
        kraken_user_id: krakenUserId,
        access_token: access_token,
        refresh_token: refresh_token,
        expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
        permissions: scope ? scope.split(' ') : ['read'],
        is_active: true
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving Kraken account:', saveError);
      return res.redirect('/auth/error?error=account_save_failed');
    }

    // Redirect to success page or back to the app
    return res.redirect('/quant-testing?kraken_connected=true');

  } catch (error) {
    console.error('Kraken OAuth callback error:', error);
    return res.redirect('/auth/error?error=oauth_callback_failed');
  }
}
