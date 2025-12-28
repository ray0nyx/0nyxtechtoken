/**
 * Kraken Balance API
 * Fetches account balance from Kraken
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { kraken_account_id } = req.body;

    if (!kraken_account_id) {
      return res.status(400).json({ error: 'Kraken account ID is required' });
    }

    // Get the Kraken account
    const { data: account, error: accountError } = await supabase
      .from('kraken_accounts')
      .select('*')
      .eq('id', kraken_account_id)
      .eq('is_active', true)
      .single();

    if (accountError || !account) {
      return res.status(404).json({ error: 'Kraken account not found' });
    }

    // Check if token is expired
    if (new Date(account.expires_at) <= new Date()) {
      return res.status(401).json({ error: 'Kraken access token expired' });
    }

    // Fetch balance from Kraken API
    const balanceResponse = await fetch('https://api.kraken.com/0/private/Balance', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${account.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!balanceResponse.ok) {
      throw new Error('Failed to fetch balance from Kraken');
    }

    const balanceData = await balanceResponse.json();

    if (balanceData.error && balanceData.error.length > 0) {
      throw new Error(`Kraken API error: ${balanceData.error.join(', ')}`);
    }

    // Transform balance data
    const balances = Object.entries(balanceData.result).map(([asset, balance]: [string, string]) => ({
      asset: asset,
      free_balance: parseFloat(balance),
      used_balance: 0, // Kraken doesn't provide separate used balance
      total_balance: parseFloat(balance)
    }));

    // Save balances to database
    const { data: savedBalances, error: saveError } = await supabase
      .from('kraken_balances')
      .upsert(
        balances.map(balance => ({
          ...balance,
          user_id: account.user_id,
          kraken_account_id: account.id
        })),
        { onConflict: 'kraken_account_id,asset' }
      )
      .select();

    if (saveError) {
      console.error('Error saving balances:', saveError);
      return res.status(500).json({ error: 'Failed to save balances' });
    }

    res.status(200).json(savedBalances || []);

  } catch (error) {
    console.error('Kraken balance error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch balance',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
