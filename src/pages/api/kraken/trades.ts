/**
 * Kraken Trades API
 * Handles trade history fetching and syncing
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// OAuth-only implementation - no API keys needed

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { kraken_account_id, start_date, end_date } = req.body;

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

    // Fetch trades from Kraken API
    const tradesResponse = await fetch('https://api.kraken.com/0/private/TradesHistory', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${account.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        start: start_date ? Math.floor(new Date(start_date).getTime() / 1000) : undefined,
        end: end_date ? Math.floor(new Date(end_date).getTime() / 1000) : undefined,
        ofs: 0
      })
    });

    if (!tradesResponse.ok) {
      throw new Error('Failed to fetch trades from Kraken');
    }

    const tradesData = await tradesResponse.json();

    if (tradesData.error && tradesData.error.length > 0) {
      throw new Error(`Kraken API error: ${tradesData.error.join(', ')}`);
    }

    // Transform and save trades
    const trades = Object.entries(tradesData.result.trades).map(([tradeId, trade]: [string, any]) => ({
      kraken_trade_id: tradeId,
      order_id: trade.ordertxid,
      pair: trade.pair,
      trade_time: new Date(trade.time * 1000).toISOString(),
      trade_type: trade.type === 'buy' ? 'buy' : 'sell',
      order_type: trade.ordertype,
      price: parseFloat(trade.price),
      cost: parseFloat(trade.cost),
      fee: parseFloat(trade.fee),
      volume: parseFloat(trade.vol),
      margin: trade.margin ? parseFloat(trade.margin) : null,
      misc: trade.misc,
      raw_data: trade
    }));

    // Save trades to database
    const { data: savedTrades, error: saveError } = await supabase
      .from('kraken_trades')
      .upsert(
        trades.map(trade => ({
          ...trade,
          user_id: account.user_id,
          kraken_account_id: account.id
        })),
        { onConflict: 'kraken_account_id,kraken_trade_id' }
      )
      .select();

    if (saveError) {
      console.error('Error saving trades:', saveError);
      return res.status(500).json({ error: 'Failed to save trades' });
    }

    // Update last sync time
    await supabase
      .from('kraken_accounts')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', kraken_account_id);

    res.status(200).json(savedTrades || []);

  } catch (error) {
    console.error('Kraken trades error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch trades',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
