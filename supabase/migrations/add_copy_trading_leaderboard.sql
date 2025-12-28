-- Create copy_trading_leaderboard table for tracking trader performance
CREATE TABLE IF NOT EXISTS copy_trading_leaderboard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL UNIQUE,
  blockchain TEXT NOT NULL DEFAULT 'solana' CHECK (blockchain IN ('solana', 'bitcoin')),
  total_pnl DECIMAL(20, 2) DEFAULT 0,
  roi DECIMAL(10, 4) DEFAULT 0, -- Return on investment percentage
  win_rate DECIMAL(5, 2) DEFAULT 0, -- 0-100%
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  avg_trade_duration INTERVAL,
  max_drawdown DECIMAL(10, 4) DEFAULT 0, -- Maximum percentage loss from peak
  sharpe_ratio DECIMAL(10, 4), -- Risk-adjusted return
  assets_under_copy DECIMAL(20, 2) DEFAULT 0, -- Total $ being copied
  follower_count INTEGER DEFAULT 0,
  risk_score DECIMAL(5, 2) DEFAULT 50, -- 0-100, higher = riskier
  consistency_score DECIMAL(5, 2) DEFAULT 50, -- 0-100, higher = more consistent
  avg_position_size DECIMAL(20, 2),
  largest_win DECIMAL(20, 2),
  largest_loss DECIMAL(20, 2),
  
  -- Time-based performance
  pnl_24h DECIMAL(20, 2) DEFAULT 0,
  pnl_7d DECIMAL(20, 2) DEFAULT 0,
  pnl_30d DECIMAL(20, 2) DEFAULT 0,
  roi_24h DECIMAL(10, 4) DEFAULT 0,
  roi_7d DECIMAL(10, 4) DEFAULT 0,
  roi_30d DECIMAL(10, 4) DEFAULT 0,
  trades_24h INTEGER DEFAULT 0,
  trades_7d INTEGER DEFAULT 0,
  trades_30d INTEGER DEFAULT 0,
  
  -- Metadata
  first_trade_at TIMESTAMPTZ,
  last_trade_at TIMESTAMPTZ,
  last_analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create trader performance history for charts
CREATE TABLE IF NOT EXISTS trader_performance_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL REFERENCES copy_trading_leaderboard(wallet_address) ON DELETE CASCADE,
  date DATE NOT NULL,
  daily_pnl DECIMAL(20, 2),
  cumulative_pnl DECIMAL(20, 2),
  trade_count INTEGER,
  win_count INTEGER,
  avg_position_size DECIMAL(20, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(wallet_address, date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_copy_trading_leaderboard_wallet ON copy_trading_leaderboard(wallet_address);
CREATE INDEX IF NOT EXISTS idx_copy_trading_leaderboard_roi ON copy_trading_leaderboard(roi DESC);
CREATE INDEX IF NOT EXISTS idx_copy_trading_leaderboard_total_pnl ON copy_trading_leaderboard(total_pnl DESC);
CREATE INDEX IF NOT EXISTS idx_copy_trading_leaderboard_win_rate ON copy_trading_leaderboard(win_rate DESC);
CREATE INDEX IF NOT EXISTS idx_copy_trading_leaderboard_sharpe ON copy_trading_leaderboard(sharpe_ratio DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_copy_trading_leaderboard_followers ON copy_trading_leaderboard(follower_count DESC);
CREATE INDEX IF NOT EXISTS idx_copy_trading_leaderboard_active ON copy_trading_leaderboard(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_trader_performance_history_wallet ON trader_performance_history(wallet_address);
CREATE INDEX IF NOT EXISTS idx_trader_performance_history_date ON trader_performance_history(date DESC);

-- Enable RLS
ALTER TABLE copy_trading_leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE trader_performance_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies (public read)
CREATE POLICY "Anyone can view leaderboard"
  ON copy_trading_leaderboard FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage leaderboard"
  ON copy_trading_leaderboard FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Anyone can view performance history"
  ON trader_performance_history FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage performance history"
  ON trader_performance_history FOR ALL
  USING (auth.role() = 'service_role');

-- Function to update follower count
CREATE OR REPLACE FUNCTION update_trader_follower_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE copy_trading_leaderboard
    SET follower_count = (
      SELECT COUNT(*) 
      FROM copy_trading_config 
      WHERE master_wallet = NEW.master_wallet 
      AND is_active = true
    )
    WHERE wallet_address = NEW.master_wallet;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE copy_trading_leaderboard
    SET follower_count = (
      SELECT COUNT(*) 
      FROM copy_trading_config 
      WHERE master_wallet = OLD.master_wallet 
      AND is_active = true
    )
    WHERE wallet_address = OLD.master_wallet;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_copy_trading_leaderboard_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER update_copy_trading_leaderboard_timestamp_trigger
  BEFORE UPDATE ON copy_trading_leaderboard
  FOR EACH ROW
  EXECUTE FUNCTION update_copy_trading_leaderboard_timestamp();

