/**
 * Kraken Sync Trades API
 * Syncs trades from Kraken and returns summary
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

    // Get last sync date
    const lastSyncDate = account.last_sync_at 
      ? new Date(account.last_sync_at)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    // Fetch trades from Kraken API
    const tradesResponse = await fetch('https://api.kraken.com/0/private/TradesHistory', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${account.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        start: Math.floor(lastSyncDate.getTime() / 1000),
        end: Math.floor(Date.now() / 1000),
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

    // Get existing trades to check for duplicates
    const { data: existingTrades } = await supabase
      .from('kraken_trades')
      .select('kraken_trade_id')
      .eq('kraken_account_id', kraken_account_id);

    const existingTradeIds = new Set(existingTrades?.map(t => t.kraken_trade_id) || []);

    // Transform trades
    const trades = Object.entries(tradesData.result.trades)
      .map(([tradeId, trade]: [string, any]) => ({
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
      }))
      .filter(trade => !existingTradeIds.has(trade.kraken_trade_id));

    let newTrades = 0;
    let updatedTrades = 0;

    if (trades.length > 0) {
      // Save new trades to database
      const { data: savedTrades, error: saveError } = await supabase
        .from('kraken_trades')
        .insert(
          trades.map(trade => ({
            ...trade,
            user_id: account.user_id,
            kraken_account_id: account.id
          }))
        )
        .select();

      if (saveError) {
        console.error('Error saving trades:', saveError);
        return res.status(500).json({ error: 'Failed to save trades' });
      }

      newTrades = savedTrades?.length || 0;
    }

    // Update last sync time
    await supabase
      .from('kraken_accounts')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', kraken_account_id);

    res.status(200).json({
      synced: trades.length,
      new_trades: newTrades,
      updated_trades: updatedTrades,
      last_sync: new Date().toISOString()
    });

  } catch (error) {
    console.error('Kraken sync trades error:', error);
    res.status(500).json({ 
      error: 'Failed to sync trades',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
