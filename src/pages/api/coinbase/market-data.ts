/**
 * Coinbase Market Data API
 * Fetches real-time market data from Coinbase
 */

import { NextApiRequest, NextApiResponse } from 'next';

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

    // Fetch ticker data from Coinbase
    const tickerPromises = symbols.map(async (symbol) => {
      try {
        const response = await fetch(`https://api.exchange.coinbase.com/products/${symbol}/ticker`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch data for ${symbol}`);
        }

        const data = await response.json();
        
        return {
          symbol: symbol,
          price: parseFloat(data.price),
          volume: parseFloat(data.volume),
          change_24h: parseFloat(data.price) - parseFloat(data.open),
          high_24h: parseFloat(data.high),
          low_24h: parseFloat(data.low),
          timestamp: new Date(data.time).getTime()
        };
      } catch (error) {
        console.error(`Error fetching data for ${symbol}:`, error);
        return null;
      }
    });

    const results = await Promise.all(tickerPromises);
    const marketData = results.filter(data => data !== null);

    res.status(200).json(marketData);

  } catch (error) {
    console.error('Coinbase market data error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch market data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

