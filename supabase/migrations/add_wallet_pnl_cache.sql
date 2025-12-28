-- Create wallet_pnl_cache table for caching P&L calculations
CREATE TABLE IF NOT EXISTS wallet_pnl_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT NOT NULL,
  blockchain TEXT NOT NULL CHECK (blockchain IN ('solana', 'bitcoin')),
  category TEXT,
  unrealized_pnl DECIMAL(20, 2),
  realized_pnl DECIMAL(20, 2),
  total_pnl DECIMAL(20, 2),
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  win_rate DECIMAL(5, 2),
  avg_trade_size DECIMAL(20, 2),
  current_holdings JSONB DEFAULT '{}',
  last_calculated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(address, blockchain)
);

-- Create cohort P&L summary table
CREATE TABLE IF NOT EXISTS cohort_pnl_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blockchain TEXT NOT NULL CHECK (blockchain IN ('solana', 'bitcoin')),
  category TEXT NOT NULL CHECK (category IN ('exchange', 'whale', 'institution', 'protocol', 'vc', 'smart_money')),
  wallet_count INTEGER DEFAULT 0,
  total_unrealized_pnl DECIMAL(20, 2),
  total_realized_pnl DECIMAL(20, 2),
  avg_pnl DECIMAL(20, 2),
  median_pnl DECIMAL(20, 2),
  avg_win_rate DECIMAL(5, 2),
  snapshot_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blockchain, category, snapshot_date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_wallet_pnl_cache_address ON wallet_pnl_cache(address);
CREATE INDEX IF NOT EXISTS idx_wallet_pnl_cache_blockchain ON wallet_pnl_cache(blockchain);
CREATE INDEX IF NOT EXISTS idx_wallet_pnl_cache_category ON wallet_pnl_cache(category);
CREATE INDEX IF NOT EXISTS idx_wallet_pnl_cache_total_pnl ON wallet_pnl_cache(total_pnl DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_pnl_cache_last_calculated ON wallet_pnl_cache(last_calculated);
CREATE INDEX IF NOT EXISTS idx_cohort_pnl_summary_blockchain ON cohort_pnl_summary(blockchain);
CREATE INDEX IF NOT EXISTS idx_cohort_pnl_summary_category ON cohort_pnl_summary(category);
CREATE INDEX IF NOT EXISTS idx_cohort_pnl_summary_date ON cohort_pnl_summary(snapshot_date DESC);

-- Enable RLS
ALTER TABLE wallet_pnl_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohort_pnl_summary ENABLE ROW LEVEL SECURITY;

-- RLS Policies (public read for analytics)
CREATE POLICY "Anyone can view wallet P&L cache"
  ON wallet_pnl_cache FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage wallet P&L cache"
  ON wallet_pnl_cache FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Anyone can view cohort P&L summary"
  ON cohort_pnl_summary FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage cohort P&L summary"
  ON cohort_pnl_summary FOR ALL
  USING (auth.role() = 'service_role');

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_wallet_pnl_cache_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER update_wallet_pnl_cache_timestamp_trigger
  BEFORE UPDATE ON wallet_pnl_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_wallet_pnl_cache_timestamp();

-- Function to refresh cohort summaries
CREATE OR REPLACE FUNCTION refresh_cohort_pnl_summaries()
RETURNS void AS $$
BEGIN
  -- Delete today's summaries if they exist
  DELETE FROM cohort_pnl_summary WHERE snapshot_date = CURRENT_DATE;
  
  -- Insert fresh summaries
  INSERT INTO cohort_pnl_summary (blockchain, category, wallet_count, total_unrealized_pnl, total_realized_pnl, avg_pnl, avg_win_rate, snapshot_date)
  SELECT
    wpc.blockchain,
    wpc.category,
    COUNT(*) as wallet_count,
    SUM(wpc.unrealized_pnl) as total_unrealized_pnl,
    SUM(wpc.realized_pnl) as total_realized_pnl,
    AVG(wpc.total_pnl) as avg_pnl,
    AVG(wpc.win_rate) as avg_win_rate,
    CURRENT_DATE as snapshot_date
  FROM wallet_pnl_cache wpc
  WHERE wpc.category IS NOT NULL
    AND wpc.last_calculated > NOW() - INTERVAL '24 hours'
  GROUP BY wpc.blockchain, wpc.category;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

