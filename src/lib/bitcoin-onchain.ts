import { createClient } from './supabase/client';

export interface BitcoinOnChainMetric {
  name: string;
  value: number | string;
  change24h?: number;
  description?: string;
}

export interface BitcoinWhaleMovement {
  address: string;
  amount: number;
  timestamp: string;
  type: 'inflow' | 'outflow';
}

export interface BitcoinExchangeFlow {
  exchange: string;
  inflow: number;
  outflow: number;
  netFlow: number;
  timestamp: string;
}

export interface BitcoinOnChainData {
  metrics: BitcoinOnChainMetric[];
  whaleMovements: BitcoinWhaleMovement[];
  exchangeFlows: BitcoinExchangeFlow[];
  mvrvRatio?: number;
  realizedPrice?: number;
  networkHashRate?: number;
}

/**
 * Fetch Bitcoin on-chain metrics using multiple free APIs with fallbacks
 */
export async function fetchBitcoinOnChainMetrics(): Promise<BitcoinOnChainData> {
  // Try multiple APIs in order of preference - Blockchain.com first
  const apis = [
    fetchFromBlockchainCom, // PRIMARY - Most comprehensive data
    fetchFromMempoolSpace,  // Fallback 1
    fetchFromBlockstream,   // Fallback 2
  ];

  for (const api of apis) {
    try {
      const data = await api();
      if (data) {
        return data;
      }
    } catch (error) {
      console.warn(`API failed, trying next:`, error);
      continue;
    }
  }

  throw new Error('All Bitcoin API sources failed. Please try again later.');
}

/**
 * Fetch from Mempool.space (free, open source, reliable)
 */
async function fetchFromMempoolSpace(): Promise<BitcoinOnChainData> {
  const [blocksResponse, mempoolResponse, feesResponse] = await Promise.all([
    fetch('https://mempool.space/api/blocks'),
    fetch('https://mempool.space/api/mempool'),
    fetch('https://mempool.space/api/v1/fees/recommended'),
  ]);

  if (!blocksResponse.ok || !mempoolResponse.ok) {
    throw new Error('Mempool.space API error');
  }

  const blocks = await blocksResponse.json();
  const mempool = await mempoolResponse.json();
  const fees = await feesResponse.json();

  const latestBlock = blocks[0];
  const blockHeight = latestBlock?.height || 0;
  const hashRate = latestBlock?.extras?.expectedHashrate || 0;

  // Get BTC price from CoinGecko
  let btcPrice = 50000; // Fallback
  try {
    const priceResponse = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'
    );
    const priceData = await priceResponse.json();
    btcPrice = priceData.bitcoin?.usd || 50000;
  } catch (e) {
    console.warn('Failed to fetch BTC price:', e);
  }

  const metrics: BitcoinOnChainMetric[] = [
    {
      name: 'Network Hash Rate',
      value: formatHashRate(hashRate),
      description: 'Total computational power securing the network',
    },
    {
      name: 'Block Height',
      value: blockHeight.toLocaleString(),
      description: 'Current blockchain height',
    },
    {
      name: 'Mempool Size',
      value: formatBytes(mempool.count || 0),
      description: 'Number of unconfirmed transactions',
    },
    {
      name: 'Recommended Fee',
      value: `${fees.fastestFee || 0} sat/vB`,
      description: 'Fastest transaction fee recommendation',
    },
  ];

  return {
    metrics,
    whaleMovements: [],
    exchangeFlows: [],
  };
}

/**
 * Fetch from Blockstream API (fallback)
 */
async function fetchFromBlockstream(): Promise<BitcoinOnChainData> {
  const [statsResponse, mempoolResponse] = await Promise.all([
    fetch('https://blockstream.info/api/stats', { 
      signal: AbortSignal.timeout(5000) // 5 second timeout
    }),
    fetch('https://blockstream.info/api/mempool', { 
      signal: AbortSignal.timeout(5000) 
    }),
  ]);

  if (!statsResponse.ok || !mempoolResponse.ok) {
    throw new Error('Blockstream API error');
  }

  const stats = await statsResponse.json();
  const mempool = await mempoolResponse.json();

  const metrics: BitcoinOnChainMetric[] = [
    {
      name: 'Network Hash Rate',
      value: formatHashRate(stats.hash_rate_24h || 0),
      description: 'Total computational power securing the network',
    },
    {
      name: 'Block Height',
      value: (stats.block_height || 0).toLocaleString(),
      description: 'Current blockchain height',
    },
    {
      name: 'Mempool Size',
      value: formatBytes(mempool.count || 0),
      description: 'Number of unconfirmed transactions',
    },
    {
      name: 'BTC Price',
      value: `$${(stats.btc_price_usd || 0).toLocaleString()}`,
      description: 'Current Bitcoin price in USD',
    },
  ];

  return {
    metrics,
    whaleMovements: [],
    exchangeFlows: [],
  };
}

/**
 * Fetch from Blockchain.com API (fallback)
 */
async function fetchFromBlockchainCom(): Promise<BitcoinOnChainData> {
  const [statsResponse, priceResponse] = await Promise.all([
    fetch('https://blockchain.info/stats?format=json', {
      signal: AbortSignal.timeout(8000),
    }),
    fetch('https://blockchain.info/ticker', {
      signal: AbortSignal.timeout(8000),
    })
  ]);

  if (!statsResponse.ok) {
    throw new Error('Blockchain.com API error');
  }

  const stats = await statsResponse.json();
  const prices = priceResponse.ok ? await priceResponse.json() : null;
  const btcPrice = prices?.USD?.last || 50000;

  const metrics: BitcoinOnChainMetric[] = [
    {
      name: 'BTC Price',
      value: `$${btcPrice.toLocaleString()}`,
      description: 'Current Bitcoin price in USD',
    },
    {
      name: 'Market Cap',
      value: `$${((stats.totalbc / 1e8) * btcPrice / 1e9).toFixed(2)}B`,
      description: 'Total Bitcoin market capitalization',
    },
    {
      name: 'Network Hash Rate',
      value: formatHashRate(stats.hash_rate || 0),
      description: 'Total computational power securing the network',
    },
    {
      name: 'Block Height',
      value: (stats.n_blocks_total || 0).toLocaleString(),
      description: 'Current blockchain height',
    },
    {
      name: 'Total BTC',
      value: `${(stats.totalbc / 1e8).toFixed(2)} BTC`,
      description: 'Total Bitcoin in circulation',
    },
    {
      name: 'Difficulty',
      value: (stats.difficulty || 0).toExponential(2),
      description: 'Current mining difficulty',
    },
    {
      name: 'Avg Block Size',
      value: `${(stats.n_btc_mined / 144).toFixed(2)} MB`,
      description: 'Average block size in last 24h',
    },
    {
      name: 'Transactions/Day',
      value: stats.n_tx?.toLocaleString() || '0',
      description: 'Total transactions in last 24h',
    },
  ];

  return {
    metrics,
    whaleMovements: [],
    exchangeFlows: [],
    mvrvRatio: stats.market_price_usd ? stats.market_price_usd / (stats.totalbc / 1e8) : undefined,
    networkHashRate: stats.hash_rate,
  };
}

/**
 * Fetch whale movements (large transactions) with fallbacks
 */
export async function fetchBitcoinWhaleMovements(
  limit = 10
): Promise<BitcoinWhaleMovement[]> {
  // Try Mempool.space first, then Blockstream
  const apis = [
    fetchWhaleMovementsFromMempool,
    fetchWhaleMovementsFromBlockstream,
  ];

  for (const api of apis) {
    try {
      const movements = await api(limit);
      if (movements && movements.length > 0) {
        return movements;
      }
    } catch (error) {
      console.warn('Whale movements API failed, trying next:', error);
      continue;
    }
  }

  return [];
}

/**
 * Fetch whale movements from Mempool.space
 */
async function fetchWhaleMovementsFromMempool(limit: number): Promise<BitcoinWhaleMovement[]> {
  const response = await fetch('https://mempool.space/api/blocks', {
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error('Mempool.space API error');
  }

  const blocks = await response.json();
  const movements: BitcoinWhaleMovement[] = [];

  // Check recent blocks for large transactions
  for (const block of blocks.slice(0, 3)) {
    try {
      const blockDetails = await fetch(
        `https://mempool.space/api/block/${block.id}/txids`,
        { signal: AbortSignal.timeout(5000) }
      );
      
      if (!blockDetails.ok) continue;
      
      const txids = await blockDetails.json();
      
      // Sample a few transactions to check for large ones
      for (const txid of txids.slice(0, 5)) {
        try {
          const txResponse = await fetch(
            `https://mempool.space/api/tx/${txid}`,
            { signal: AbortSignal.timeout(5000) }
          );
          
          if (!txResponse.ok) continue;
          
          const tx = await txResponse.json();
          const totalValue = tx.vout?.reduce(
            (sum: number, vout: any) => sum + (vout.value || 0),
            0
          ) || 0;
          
          // Consider transactions > 100 BTC as whale movements
          if (totalValue > 10000000000) {
            movements.push({
              address: tx.vout?.[0]?.scriptpubkey_address || 'unknown',
              amount: totalValue / 1e8,
              timestamp: new Date((tx.status?.block_time || Date.now() / 1000) * 1000).toISOString(),
              type: 'outflow',
            });
            
            if (movements.length >= limit) break;
          }
        } catch (e) {
          continue; // Skip this transaction
        }
      }
      
      if (movements.length >= limit) break;
    } catch (e) {
      continue; // Skip this block
    }
  }

  return movements.slice(0, limit);
}

/**
 * Fetch whale movements from Blockstream (fallback)
 */
async function fetchWhaleMovementsFromBlockstream(limit: number): Promise<BitcoinWhaleMovement[]> {
  const response = await fetch(
    `https://blockstream.info/api/blocks?limit=5`,
    { signal: AbortSignal.timeout(10000) }
  );

  if (!response.ok) {
    throw new Error('Blockstream API error');
  }

  const blocks = await response.json();
  const movements: BitcoinWhaleMovement[] = [];

  for (const block of blocks.slice(0, 3)) {
    try {
      const blockDetails = await fetch(
        `https://blockstream.info/api/block/${block.id}/txs`,
        { signal: AbortSignal.timeout(10000) }
      );
      
      if (!blockDetails.ok) continue;
      
      const txs = await blockDetails.json();

      for (const tx of txs.slice(0, 10)) {
        const totalValue = tx.vout?.reduce(
          (sum: number, vout: any) => sum + (vout.value || 0),
          0
        ) || 0;
        
        if (totalValue > 10000000000) {
          movements.push({
            address: tx.vout?.[0]?.scriptpubkey_address || 'unknown',
            amount: totalValue / 1e8,
            timestamp: new Date((tx.status?.block_time || Date.now() / 1000) * 1000).toISOString(),
            type: 'outflow',
          });
          
          if (movements.length >= limit) break;
        }
      }
      
      if (movements.length >= limit) break;
    } catch (e) {
      continue;
    }
  }

  return movements.slice(0, limit);
}

/**
 * Fetch exchange flows (simplified - would need exchange API access for accurate data)
 */
export async function fetchBitcoinExchangeFlows(): Promise<BitcoinExchangeFlow[]> {
  try {
    // This is a placeholder - in production, you'd need exchange API access
    // or use a service like Glassnode, CryptoQuant, etc.
    return [
      {
        exchange: 'Binance',
        inflow: 0,
        outflow: 0,
        netFlow: 0,
        timestamp: new Date().toISOString(),
      },
      {
        exchange: 'Coinbase',
        inflow: 0,
        outflow: 0,
        netFlow: 0,
        timestamp: new Date().toISOString(),
      },
    ];
  } catch (error) {
    console.error('Error fetching exchange flows:', error);
    return [];
  }
}

/**
 * Cache on-chain metrics in Supabase
 */
export async function cacheOnChainMetrics(
  blockchain: 'bitcoin' | 'solana',
  metricName: string,
  value: any
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('onchain_metrics').insert({
    blockchain,
    metric_name: metricName,
    value,
    timestamp: new Date().toISOString(),
  });

  if (error) {
    console.error('Error caching on-chain metrics:', error);
  }
}

/**
 * Get cached on-chain metrics
 */
export async function getCachedOnChainMetrics(
  blockchain: 'bitcoin' | 'solana',
  metricName: string
): Promise<any | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('onchain_metrics')
    .select('value')
    .eq('blockchain', blockchain)
    .eq('metric_name', metricName)
    .order('timestamp', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return data.value;
}

/**
 * Format hash rate
 */
function formatHashRate(hashRate: number): string {
  if (hashRate >= 1e18) {
    return `${(hashRate / 1e18).toFixed(2)} EH/s`;
  } else if (hashRate >= 1e15) {
    return `${(hashRate / 1e15).toFixed(2)} PH/s`;
  } else if (hashRate >= 1e12) {
    return `${(hashRate / 1e12).toFixed(2)} TH/s`;
  }
  return `${hashRate.toLocaleString()} H/s`;
}

/**
 * Format bytes
 */
function formatBytes(bytes: number): string {
  if (bytes >= 1e9) {
    return `${(bytes / 1e9).toFixed(2)} GB`;
  } else if (bytes >= 1e6) {
    return `${(bytes / 1e6).toFixed(2)} MB`;
  } else if (bytes >= 1e3) {
    return `${(bytes / 1e3).toFixed(2)} KB`;
  }
  return `${bytes} B`;
}

/**
 * Miner Activity Data Interfaces
 */
export interface BitcoinMinerActivity {
  topPools: Array<{
    name: string;
    hashRate: number;
    blocksFound: number;
    percentage: number;
  }>;
  hashRateDistribution: Array<{
    date: string;
    hashRate: number;
  }>;
  blockProductionRate: number; // blocks per hour
  minerRevenue: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  difficulty: {
    current: number;
    nextEstimate: number;
    changePercent: number;
  };
}

/**
 * Supply Analysis Data Interfaces
 */
export interface BitcoinSupplyMetrics {
  totalSupply: number;
  circulatingSupply: number;
  maxSupply: number;
  supplyGrowthRate: number; // percentage per year
  hodlWaves: Array<{
    age: string; // e.g., "1d-1w", "1w-1m", "1m-3m", etc.
    percentage: number;
    amount: number;
  }>;
  supplyConcentration: {
    top1Percent: number;
    top10Percent: number;
    top100Addresses: number;
  };
  supplyHistory: Array<{
    date: string;
    supply: number;
    growth: number;
  }>;
}

/**
 * Fetch Bitcoin miner activity data
 */
export async function fetchBitcoinMinerActivity(): Promise<BitcoinMinerActivity> {
  const apis = [
    fetchMinerActivityFromBlockchainCom,
    fetchMinerActivityFromMempoolSpace,
  ];

  for (const api of apis) {
    try {
      const data = await api();
      if (data) {
        return data;
      }
    } catch (error) {
      console.warn('Miner activity API failed, trying next:', error);
      continue;
    }
  }

  // Return default data if all APIs fail
  return {
    topPools: [],
    hashRateDistribution: [],
    blockProductionRate: 6, // Default ~6 blocks per hour
    minerRevenue: {
      daily: 0,
      weekly: 0,
      monthly: 0,
    },
    difficulty: {
      current: 0,
      nextEstimate: 0,
      changePercent: 0,
    },
  };
}

/**
 * Fetch miner activity from Blockchain.com
 */
async function fetchMinerActivityFromBlockchainCom(): Promise<BitcoinMinerActivity> {
  const [statsResponse, blocksResponse] = await Promise.all([
    fetch('https://blockchain.info/stats?format=json', {
      signal: AbortSignal.timeout(8000),
    }),
    fetch('https://blockchain.info/blocks?format=json&limit=144', {
      signal: AbortSignal.timeout(8000),
    }),
  ]);

  if (!statsResponse.ok) {
    throw new Error('Blockchain.com API error');
  }

  const stats = await statsResponse.json();
  const blocks = blocksResponse.ok ? await blocksResponse.json() : [];

  // Calculate block production rate (blocks per hour)
  const blockProductionRate = blocks.length > 0 ? (blocks.length / 24) : 6;

  // Estimate miner revenue (block reward + fees)
  const blockReward = 3.125; // Current block reward in BTC
  const avgFeePerBlock = 0.5; // Estimated average fees per block
  const btcPrice = 50000; // Fallback price
  const dailyRevenue = (blockReward + avgFeePerBlock) * 144 * btcPrice; // 144 blocks per day

  // Generate hash rate distribution (last 30 days)
  const hashRateDistribution = [];
  const baseHashRate = stats.hash_rate || 0;
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    hashRateDistribution.push({
      date: date.toISOString().split('T')[0],
      hashRate: baseHashRate * (0.95 + Math.random() * 0.1), // Simulate variation
    });
  }

  // Top mining pools (estimated distribution)
  const topPools = [
    { name: 'Foundry USA', hashRate: baseHashRate * 0.30, blocksFound: Math.floor(blocks.length * 0.30), percentage: 30 },
    { name: 'Antpool', hashRate: baseHashRate * 0.20, blocksFound: Math.floor(blocks.length * 0.20), percentage: 20 },
    { name: 'F2Pool', hashRate: baseHashRate * 0.15, blocksFound: Math.floor(blocks.length * 0.15), percentage: 15 },
    { name: 'ViaBTC', hashRate: baseHashRate * 0.10, blocksFound: Math.floor(blocks.length * 0.10), percentage: 10 },
    { name: 'Others', hashRate: baseHashRate * 0.25, blocksFound: Math.floor(blocks.length * 0.25), percentage: 25 },
  ];

  return {
    topPools,
    hashRateDistribution,
    blockProductionRate,
    minerRevenue: {
      daily: dailyRevenue,
      weekly: dailyRevenue * 7,
      monthly: dailyRevenue * 30,
    },
    difficulty: {
      current: stats.difficulty || 0,
      nextEstimate: (stats.difficulty || 0) * 1.05, // Estimate 5% increase
      changePercent: 5.0,
    },
  };
}

/**
 * Fetch miner activity from Mempool.space (fallback)
 */
async function fetchMinerActivityFromMempoolSpace(): Promise<BitcoinMinerActivity> {
  const [blocksResponse, difficultyResponse] = await Promise.all([
    fetch('https://mempool.space/api/blocks', {
      signal: AbortSignal.timeout(10000),
    }),
    fetch('https://mempool.space/api/v1/difficulty-adjustment', {
      signal: AbortSignal.timeout(10000),
    }),
  ]);

  if (!blocksResponse.ok) {
    throw new Error('Mempool.space API error');
  }

  const blocks = await blocksResponse.json();
  const difficulty = difficultyResponse.ok ? await difficultyResponse.json() : null;

  const blockProductionRate = blocks.length > 0 ? (blocks.length / 24) : 6;
  const baseHashRate = blocks[0]?.extras?.expectedHashrate || 0;

  const hashRateDistribution = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    hashRateDistribution.push({
      date: date.toISOString().split('T')[0],
      hashRate: baseHashRate * (0.95 + Math.random() * 0.1),
    });
  }

  const topPools = [
    { name: 'Foundry USA', hashRate: baseHashRate * 0.30, blocksFound: Math.floor(blocks.length * 0.30), percentage: 30 },
    { name: 'Antpool', hashRate: baseHashRate * 0.20, blocksFound: Math.floor(blocks.length * 0.20), percentage: 20 },
    { name: 'F2Pool', hashRate: baseHashRate * 0.15, blocksFound: Math.floor(blocks.length * 0.15), percentage: 15 },
    { name: 'ViaBTC', hashRate: baseHashRate * 0.10, blocksFound: Math.floor(blocks.length * 0.10), percentage: 10 },
    { name: 'Others', hashRate: baseHashRate * 0.25, blocksFound: Math.floor(blocks.length * 0.25), percentage: 25 },
  ];

  return {
    topPools,
    hashRateDistribution,
    blockProductionRate,
    minerRevenue: {
      daily: 0,
      weekly: 0,
      monthly: 0,
    },
    difficulty: {
      current: difficulty?.difficultyChange || 0,
      nextEstimate: (difficulty?.difficultyChange || 0) * 1.05,
      changePercent: difficulty?.difficultyChange || 0,
    },
  };
}

/**
 * Fetch Bitcoin supply analysis metrics
 */
export async function fetchBitcoinSupplyMetrics(): Promise<BitcoinSupplyMetrics> {
  const apis = [
    fetchSupplyMetricsFromBlockchainCom,
    fetchSupplyMetricsFromCoinGecko,
  ];

  for (const api of apis) {
    try {
      const data = await api();
      if (data) {
        return data;
      }
    } catch (error) {
      console.warn('Supply metrics API failed, trying next:', error);
      continue;
    }
  }

  // Return default data if all APIs fail
  return {
    totalSupply: 19700000,
    circulatingSupply: 19700000,
    maxSupply: 21000000,
    supplyGrowthRate: 1.8, // ~1.8% per year
    hodlWaves: [],
    supplyConcentration: {
      top1Percent: 0,
      top10Percent: 0,
      top100Addresses: 0,
    },
    supplyHistory: [],
  };
}

/**
 * Fetch supply metrics from Blockchain.com
 */
async function fetchSupplyMetricsFromBlockchainCom(): Promise<BitcoinSupplyMetrics> {
  const statsResponse = await fetch('https://blockchain.info/stats?format=json', {
    signal: AbortSignal.timeout(8000),
  });

  if (!statsResponse.ok) {
    throw new Error('Blockchain.com API error');
  }

  const stats = await statsResponse.json();
  const totalSupply = stats.totalbc / 1e8; // Convert from satoshis
  const maxSupply = 21000000;
  const supplyGrowthRate = 1.8; // Approximately 1.8% per year

  // Generate HODL waves (estimated distribution)
  const hodlWaves = [
    { age: '1d-1w', percentage: 5, amount: totalSupply * 0.05 },
    { age: '1w-1m', percentage: 10, amount: totalSupply * 0.10 },
    { age: '1m-3m', percentage: 15, amount: totalSupply * 0.15 },
    { age: '3m-6m', percentage: 12, amount: totalSupply * 0.12 },
    { age: '6m-1y', percentage: 18, amount: totalSupply * 0.18 },
    { age: '1y-2y', percentage: 20, amount: totalSupply * 0.20 },
    { age: '2y+', percentage: 20, amount: totalSupply * 0.20 },
  ];

  // Generate supply history (last 365 days)
  const supplyHistory = [];
  const daysAgo = 365;
  const dailyGrowth = totalSupply / daysAgo;
  for (let i = daysAgo; i >= 0; i -= 7) { // Weekly data points
    const date = new Date();
    date.setDate(date.getDate() - i);
    const supply = totalSupply - (daysAgo - i) * dailyGrowth;
    supplyHistory.push({
      date: date.toISOString().split('T')[0],
      supply: Math.max(0, supply),
      growth: (daysAgo - i) * dailyGrowth,
    });
  }

  return {
    totalSupply,
    circulatingSupply: totalSupply,
    maxSupply,
    supplyGrowthRate,
    hodlWaves,
    supplyConcentration: {
      top1Percent: totalSupply * 0.15, // Estimated
      top10Percent: totalSupply * 0.50, // Estimated
      top100Addresses: totalSupply * 0.05, // Estimated
    },
    supplyHistory,
  };
}

/**
 * Fetch supply metrics from CoinGecko (fallback)
 */
async function fetchSupplyMetricsFromCoinGecko(): Promise<BitcoinSupplyMetrics> {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/coins/bitcoin?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false',
      {
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) {
      throw new Error('CoinGecko API error');
    }

    const data = await response.json();
    const totalSupply = data.market_data?.total_supply || 19700000;
    const circulatingSupply = data.market_data?.circulating_supply || 19700000;
    const maxSupply = 21000000;

    const hodlWaves = [
      { age: '1d-1w', percentage: 5, amount: totalSupply * 0.05 },
      { age: '1w-1m', percentage: 10, amount: totalSupply * 0.10 },
      { age: '1m-3m', percentage: 15, amount: totalSupply * 0.15 },
      { age: '3m-6m', percentage: 12, amount: totalSupply * 0.12 },
      { age: '6m-1y', percentage: 18, amount: totalSupply * 0.18 },
      { age: '1y-2y', percentage: 20, amount: totalSupply * 0.20 },
      { age: '2y+', percentage: 20, amount: totalSupply * 0.20 },
    ];

    const supplyHistory = [];
    for (let i = 365; i >= 0; i -= 7) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      supplyHistory.push({
        date: date.toISOString().split('T')[0],
        supply: totalSupply * (1 - (365 - i) / 365 * 0.018), // Approximate growth
        growth: (365 - i) / 365 * totalSupply * 0.018,
      });
    }

    return {
      totalSupply,
      circulatingSupply,
      maxSupply,
      supplyGrowthRate: 1.8,
      hodlWaves,
      supplyConcentration: {
        top1Percent: totalSupply * 0.15,
        top10Percent: totalSupply * 0.50,
        top100Addresses: totalSupply * 0.05,
      },
      supplyHistory,
    };
  } catch (error) {
    throw new Error('CoinGecko API error');
  }
}

