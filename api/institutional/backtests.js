/**
 * Institutional Backtests API
 * Handles backtest creation, status checking, and results retrieval
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    switch (req.method) {
      case 'GET':
        return await handleGetBacktests(req, res);
      case 'POST':
        return await handleCreateBacktest(req, res);
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Backtests API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleGetBacktests(req, res) {
  try {
    // For now, return mock data since we don't have proper auth setup
    const mockBacktests = [
      {
        id: '1',
        name: 'Sample Strategy',
        status: 'completed',
        created_at: new Date().toISOString(),
        config: {
          start_date: '2023-01-01',
          end_date: '2023-12-31',
          initial_capital: 100000,
          symbols: ['AAPL', 'MSFT']
        },
        results: {
          total_return: 15.5,
          sharpe_ratio: 1.2,
          max_drawdown: -8.3,
          win_rate: 65.0
        }
      }
    ];

    return res.status(200).json(mockBacktests);
  } catch (error) {
    console.error('Error in handleGetBacktests:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleCreateBacktest(req, res) {
  try {
    const {
      name,
      strategy_code,
      start_date,
      end_date,
      initial_capital,
      symbols,
      config
    } = req.body;

    // Validate required fields
    if (!name || !strategy_code || !start_date || !end_date || !initial_capital || !symbols) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, strategy_code, start_date, end_date, initial_capital, symbols' 
      });
    }

    // For now, return a mock response
    const mockBacktest = {
      id: Date.now().toString(),
      name,
      strategy_code,
      status: 'pending',
      created_at: new Date().toISOString(),
      config: {
        start_date,
        end_date,
        initial_capital: parseFloat(initial_capital),
        symbols: Array.isArray(symbols) ? symbols : symbols.split(',').map(s => s.trim()),
        ...config
      }
    };

    return res.status(201).json(mockBacktest);
  } catch (error) {
    console.error('Error in handleCreateBacktest:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
