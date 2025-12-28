/**
 * Kraken Market Data API
 * Fetches real-time market data from Kraken
 */

import { NextApiRequest, NextApiResponse } from 'next';

const KRAKEN_API_KEY = "zVzTZCclvCDZy3/5SzXzOcePlMhItLxZLQIaUTPHrYKXahM8LtxZbSpi";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { symbols } = req.body;

    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json({ error: 'Symbols array is required' });
    }

    // Convert symbols to Kraken format (e.g., BTCUSD -> XXBTZUSD)
    const krakenSymbols = symbols.map(symbol => {
      // Basic mapping - you might need to expand this
      const mapping: { [key: string]: string } = {
        'BTC/USD': 'XXBTZUSD',
        'ETH/USD': 'XETHZUSD',
        'LTC/USD': 'XLTCZUSD',
        'XRP/USD': 'XXRPZUSD',
        'ADA/USD': 'ADAUSD',
        'DOT/USD': 'DOTUSD',
        'LINK/USD': 'LINKUSD',
        'UNI/USD': 'UNIUSD'
      };
      return mapping[symbol] || symbol.replace('/', '');
    });

    // Fetch ticker data from Kraken
    const tickerResponse = await fetch('https://api.kraken.com/0/public/Ticker', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        pair: krakenSymbols.join(',')
      })
    });

    if (!tickerResponse.ok) {
      throw new Error('Failed to fetch data from Kraken');
    }

    const tickerData = await tickerResponse.json();

    if (tickerData.error && tickerData.error.length > 0) {
      throw new Error(`Kraken API error: ${tickerData.error.join(', ')}`);
    }

    // Transform Kraken data to our format
    const marketData = Object.entries(tickerData.result).map(([pair, data]: [string, any]) => {
      const [price, volume, time, bid, ask, open, high, low, close] = data.c;
      
      return {
        symbol: symbols[krakenSymbols.indexOf(pair)] || pair,
        price: parseFloat(price),
        volume: parseFloat(volume),
        change_24h: parseFloat(close) - parseFloat(open),
        high_24h: parseFloat(high),
        low_24h: parseFloat(low),
        timestamp: time * 1000 // Convert to milliseconds
      };
    });

    res.status(200).json(marketData);

  } catch (error) {
    console.error('Kraken market data error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch market data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

