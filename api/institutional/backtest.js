/**
 * Institutional Backtest API (singular)
 * Handles individual backtest operations
 */

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
      case 'POST':
        return await handleCreateBacktest(req, res);
      default:
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Backtest API error:', error);
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
      status: 'running',
      created_at: new Date().toISOString(),
      config: {
        start_date,
        end_date,
        initial_capital: parseFloat(initial_capital),
        symbols: Array.isArray(symbols) ? symbols : symbols.split(',').map(s => s.trim()),
        ...config
      },
      results: {
        total_return: 12.5,
        sharpe_ratio: 1.1,
        max_drawdown: -5.2,
        win_rate: 68.0,
        trades: []
      }
    };

    // Simulate async processing
    setTimeout(() => {
      // In a real implementation, this would update the backtest status
      console.log(`Backtest ${mockBacktest.id} completed`);
    }, 5000);

    return res.status(201).json(mockBacktest);
  } catch (error) {
    console.error('Error in handleCreateBacktest:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
