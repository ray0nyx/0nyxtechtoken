/**
 * Institutional Exchanges API
 * Handles exchange connections and management
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
      case 'GET':
        return await handleGetExchanges(req, res);
      case 'POST':
        return await handleCreateExchange(req, res);
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Exchanges API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleGetExchanges(req, res) {
  try {
    // Return mock exchange data
    const mockExchanges = [
      {
        id: '1',
        name: 'Binance',
        type: 'spot',
        status: 'connected',
        is_active: true,
        last_sync_at: new Date().toISOString(),
        api_key_masked: '****-****-****-****-1234'
      },
      {
        id: '2',
        name: 'Coinbase Pro',
        type: 'spot',
        status: 'disconnected',
        is_active: false,
        last_sync_at: null,
        api_key_masked: '****-****-****-****-5678'
      }
    ];

    return res.status(200).json(mockExchanges);
  } catch (error) {
    console.error('Error in handleGetExchanges:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleCreateExchange(req, res) {
  try {
    const { name, type, api_key, api_secret } = req.body;

    // Validate required fields
    if (!name || !type || !api_key || !api_secret) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, type, api_key, api_secret' 
      });
    }

    // For now, return a mock response
    const mockExchange = {
      id: Date.now().toString(),
      name,
      type,
      status: 'connected',
      is_active: true,
      last_sync_at: new Date().toISOString(),
      api_key_masked: `****-****-****-****-${api_key.slice(-4)}`
    };

    return res.status(201).json(mockExchange);
  } catch (error) {
    console.error('Error in handleCreateExchange:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
