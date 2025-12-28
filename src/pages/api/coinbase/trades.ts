/**
 * Coinbase Trades API
 * Handles trade history fetching and syncing
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
    const { coinbase_account_id, start_date, end_date } = req.body;

    if (!coinbase_account_id) {
      return res.status(400).json({ error: 'Coinbase account ID is required' });
    }

    // Get the Coinbase account
    const { data: account, error: accountError } = await supabase
      .from('coinbase_accounts')
      .select('*')
      .eq('id', coinbase_account_id)
      .eq('is_active', true)
      .single();

    if (accountError || !account) {
      return res.status(404).json({ error: 'Coinbase account not found' });
    }

    // Check if token is expired
    if (new Date(account.expires_at) <= new Date()) {
      return res.status(401).json({ error: 'Coinbase access token expired' });
    }

    // Fetch fills from Coinbase API
    const fillsResponse = await fetch('https://api.exchange.coinbase.com/fills', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${account.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!fillsResponse.ok) {
      throw new Error('Failed to fetch fills from Coinbase');
    }

    const fillsData = await fillsResponse.json();

    // Transform fills data to our format
    const trades = fillsData.map((fill: any) => ({
      coinbase_trade_id: fill.trade_id,
      order_id: fill.order_id,
      pair: fill.product_id,
      trade_time: new Date(fill.created_at).toISOString(),
      trade_type: fill.side === 'buy' ? 'buy' : 'sell',
      order_type: 'market', // Coinbase fills are typically market orders
      price: parseFloat(fill.price),
      cost: parseFloat(fill.size) * parseFloat(fill.price),
      fee: parseFloat(fill.fee),
      volume: parseFloat(fill.size),
      raw_data: fill
    }));

    // Save trades to database
    const { data: savedTrades, error: saveError } = await supabase
      .from('coinbase_trades')
      .upsert(
        trades.map(trade => ({
          ...trade,
          user_id: account.user_id,
          coinbase_account_id: account.id
        })),
        { onConflict: 'coinbase_account_id,coinbase_trade_id' }
      )
      .select();

    if (saveError) {
      console.error('Error saving trades:', saveError);
      return res.status(500).json({ error: 'Failed to save trades' });
    }

    // Update last sync time
    await supabase
      .from('coinbase_accounts')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', coinbase_account_id);

    res.status(200).json(savedTrades || []);

  } catch (error) {
    console.error('Coinbase trades error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch trades',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
