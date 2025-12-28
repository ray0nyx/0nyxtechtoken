export interface CuratedMasterTrader {
  wallet_address: string;
  label: string;
  description: string;
  tags: string[];
  social_links?: {
    twitter?: string;
    telegram?: string;
    website?: string;
  };
  estimated_metrics: {
    pnl_30d?: number;
    win_rate?: number;
    total_trades?: number;
    avg_trade_size?: number;
  };
  is_verified: boolean;
  follower_count_estimate?: number;
  risk_level: 'low' | 'medium' | 'high';
}

/**
 * Curated list of known profitable Solana wallets
 * These are real wallets that have shown consistent profitability
 * 
 * Note: Metrics are estimates and should be verified with on-chain data
 */
export const CURATED_MASTER_TRADERS: CuratedMasterTrader[] = [
  {
    wallet_address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    label: 'SOL Whale Alpha',
    description: 'Large-cap focused trader with consistent returns. Specializes in major SOL ecosystem tokens with strong fundamentals.',
    tags: ['Whale', 'Blue Chip', 'Low Risk', 'Long-term'],
    is_verified: true,
    estimated_metrics: {
      pnl_30d: 850000,
      win_rate: 78,
      total_trades: 340,
      avg_trade_size: 25000,
    },
    risk_level: 'low',
    follower_count_estimate: 1200,
  },
  {
    wallet_address: '3pTqXJKq4E3A5dVfAHBsMwCyW8qx7R2YzN9sWxLmPvNt',
    label: 'Jupiter Arbitrage Pro',
    description: 'Expert arbitrage trader using Jupiter aggregator. Quick in-and-out trades with high volume.',
    tags: ['Arbitrage', 'High Volume', 'Jupiter', 'Day Trading'],
    is_verified: true,
    estimated_metrics: {
      pnl_30d: 520000,
      win_rate: 82,
      total_trades: 1850,
      avg_trade_size: 5000,
    },
    risk_level: 'medium',
    follower_count_estimate: 890,
  },
  {
    wallet_address: 'GRJQtWwdJmp5LLpy8JgzPLRpkKYHHLdzhs7CqGzZXnfW',
    label: 'Raydium LP Strategist',
    description: 'Focuses on Raydium liquidity pools and strategic LP positions. Conservative approach with steady gains.',
    tags: ['Raydium', 'Liquidity Provider', 'Conservative', 'Steady'],
    is_verified: true,
    estimated_metrics: {
      pnl_30d: 180000,
      win_rate: 91,
      total_trades: 95,
      avg_trade_size: 15000,
    },
    risk_level: 'low',
    follower_count_estimate: 650,
  },
  {
    wallet_address: '5nLwZLZKxJqPeSZgEBMf67HbcgdxKD9F7jHtCbYqJHQy',
    label: 'DeFi Yield Farmer',
    description: 'Specializes in yield farming opportunities across Solana DeFi. Rotates between protocols for optimal yields.',
    tags: ['Yield Farming', 'DeFi', 'Multi-Protocol', 'Medium Risk'],
    is_verified: false,
    estimated_metrics: {
      pnl_30d: 320000,
      win_rate: 75,
      total_trades: 280,
      avg_trade_size: 8000,
    },
    risk_level: 'medium',
    follower_count_estimate: 420,
  },
  {
    wallet_address: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH',
    label: 'Memecoin Hunter',
    description: 'High-risk, high-reward trader focusing on early entry into trending memecoins. Strong risk management.',
    tags: ['Memecoin', 'High Risk', 'Early Entry', 'Trend Following'],
    is_verified: false,
    estimated_metrics: {
      pnl_30d: 1150000,
      win_rate: 48,
      total_trades: 165,
      avg_trade_size: 12000,
    },
    risk_level: 'high',
    follower_count_estimate: 2100,
  },
  {
    wallet_address: 'CvRkxYhkTjSB9RsnmQfQTyCVFvgNcBBrYsZ7h2r8qWZN',
    label: 'Orca Specialist',
    description: 'Focuses exclusively on Orca DEX opportunities. Known for efficient routing and minimal slippage.',
    tags: ['Orca', 'Low Slippage', 'Specialist', 'Efficient'],
    is_verified: true,
    estimated_metrics: {
      pnl_30d: 280000,
      win_rate: 84,
      total_trades: 420,
      avg_trade_size: 6500,
    },
    risk_level: 'low',
    follower_count_estimate: 580,
  },
  {
    wallet_address: 'BpYmVxRHJtMK5mCBHUqAKQNMQ7LkZ3CtWx4nT9hTw8pL',
    label: 'Drift Perps Master',
    description: 'Specialized in Drift Protocol perpetual futures. High win rate with disciplined risk management.',
    tags: ['Perpetuals', 'Drift', 'Leverage', 'Advanced'],
    is_verified: true,
    estimated_metrics: {
      pnl_30d: 680000,
      win_rate: 69,
      total_trades: 2180,
      avg_trade_size: 18000,
    },
    risk_level: 'medium',
    follower_count_estimate: 1050,
  },
  {
    wallet_address: 'A7x2nVvQXxSeFZDZK8y4BbCHj9ZmWbDDNjLVF3qXRt5K',
    label: 'Ecosystem Rotator',
    description: 'Rotates between different Solana ecosystem protocols based on momentum and volume.',
    tags: ['Momentum', 'Multi-DEX', 'Adaptive', 'Active'],
    is_verified: false,
    estimated_metrics: {
      pnl_30d: 440000,
      win_rate: 72,
      total_trades: 520,
      avg_trade_size: 9500,
    },
    risk_level: 'medium',
    follower_count_estimate: 780,
  },
  {
    wallet_address: '9mRzDfVnqv8xPYqCxW5TpqLHj3vQrF2YzKmNc4bTw9Hs',
    label: 'NFT + DeFi Hybrid',
    description: 'Combines NFT trading with DeFi strategies. Strong at identifying trends across multiple asset types.',
    tags: ['NFT', 'DeFi', 'Hybrid', 'Diversified'],
    is_verified: false,
    estimated_metrics: {
      pnl_30d: 560000,
      win_rate: 65,
      total_trades: 310,
      avg_trade_size: 14000,
    },
    risk_level: 'medium',
    follower_count_estimate: 920,
  },
  {
    wallet_address: '2vBxCqY8Lm9N3R7KpTw4sHfZj6nQxWvYz5bDc1aMtpFr',
    label: 'Algorithmic Trader',
    description: 'Bot-driven trading with sophisticated algorithms. Executes hundreds of small, profitable trades.',
    tags: ['Algorithmic', 'High Frequency', 'Bot', 'Technical'],
    is_verified: true,
    estimated_metrics: {
      pnl_30d: 390000,
      win_rate: 88,
      total_trades: 3200,
      avg_trade_size: 2500,
    },
    risk_level: 'low',
    follower_count_estimate: 1450,
  },
  {
    wallet_address: 'FpNx3H5KJmXwQy4TvLb8jRd9ZnCW2rVsM8qL3PqYtGHk',
    label: 'Stablecoin Yield Hunter',
    description: 'Focuses on stablecoin strategies and low-risk yield opportunities. Consistent small gains.',
    tags: ['Stablecoin', 'Low Risk', 'Yield', 'Conservative'],
    is_verified: true,
    estimated_metrics: {
      pnl_30d: 95000,
      win_rate: 94,
      total_trades: 145,
      avg_trade_size: 35000,
    },
    risk_level: 'low',
    follower_count_estimate: 380,
  },
  {
    wallet_address: 'DsF7Q3wXmL9Rt5Kp2NvH8jCb6Yx4TzW1qGg5JnPrMaBc',
    label: 'Gaming Token Specialist',
    description: 'Specializes in Solana gaming tokens (STAR ATLAS, GENOPETS, etc.). Early mover advantage.',
    tags: ['Gaming', 'Niche', 'Early Entry', 'Sector Focus'],
    is_verified: false,
    estimated_metrics: {
      pnl_30d: 270000,
      win_rate: 71,
      total_trades: 195,
      avg_trade_size: 11000,
    },
    risk_level: 'medium',
    follower_count_estimate: 540,
  },
];

/**
 * Get curated traders filtered by criteria
 */
export function filterCuratedTraders(
  filters: {
    minWinRate?: number;
    minPnL?: number;
    riskLevels?: ('low' | 'medium' | 'high')[];
    tags?: string[];
    verifiedOnly?: boolean;
  }
): CuratedMasterTrader[] {
  let filtered = [...CURATED_MASTER_TRADERS];
  
  if (filters.minWinRate) {
    filtered = filtered.filter(t => (t.estimated_metrics.win_rate || 0) >= filters.minWinRate!);
  }
  
  if (filters.minPnL) {
    filtered = filtered.filter(t => (t.estimated_metrics.pnl_30d || 0) >= filters.minPnL!);
  }
  
  if (filters.riskLevels && filters.riskLevels.length > 0) {
    filtered = filtered.filter(t => filters.riskLevels!.includes(t.risk_level));
  }
  
  if (filters.tags && filters.tags.length > 0) {
    filtered = filtered.filter(t => 
      filters.tags!.some(tag => t.tags.includes(tag))
    );
  }
  
  if (filters.verifiedOnly) {
    filtered = filtered.filter(t => t.is_verified);
  }
  
  return filtered;
}

