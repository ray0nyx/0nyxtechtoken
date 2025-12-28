-- Create master_traders table for tracking profitable Solana wallets
CREATE TABLE IF NOT EXISTS master_traders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  total_pnl DECIMAL(20, 2),
  win_rate DECIMAL(5, 2),
  total_trades INTEGER DEFAULT 0,
  avg_trade_size DECIMAL(20, 2),
  follower_count INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,
  is_curated BOOLEAN DEFAULT false,
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high')),
  social_links JSONB DEFAULT '{}',
  last_analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_master_traders_wallet ON master_traders(wallet_address);
CREATE INDEX IF NOT EXISTS idx_master_traders_verified ON master_traders(is_verified);
CREATE INDEX IF NOT EXISTS idx_master_traders_win_rate ON master_traders(win_rate DESC);
CREATE INDEX IF NOT EXISTS idx_master_traders_pnl ON master_traders(total_pnl DESC);
CREATE INDEX IF NOT EXISTS idx_master_traders_tags ON master_traders USING GIN(tags);

-- Create followers tracking table
CREATE TABLE IF NOT EXISTS master_trader_followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  master_trader_id UUID NOT NULL REFERENCES master_traders(id) ON DELETE CASCADE,
  followed_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  copy_trading_enabled BOOLEAN DEFAULT false,
  copy_mode TEXT CHECK (copy_mode IN ('manual', 'auto')),
  settings JSONB DEFAULT '{}',
  UNIQUE(user_id, master_trader_id)
);

-- Create indexes for followers
CREATE INDEX IF NOT EXISTS idx_followers_user_id ON master_trader_followers(user_id);
CREATE INDEX IF NOT EXISTS idx_followers_master_id ON master_trader_followers(master_trader_id);
CREATE INDEX IF NOT EXISTS idx_followers_active ON master_trader_followers(is_active);

-- Enable RLS
ALTER TABLE master_traders ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_trader_followers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for master_traders (public read)
CREATE POLICY "Anyone can view master traders"
  ON master_traders FOR SELECT
  USING (true);

-- Only admins can insert/update master traders
CREATE POLICY "Service role can manage master traders"
  ON master_traders FOR ALL
  USING (auth.role() = 'service_role');

-- RLS Policies for followers
CREATE POLICY "Users can view their own follows"
  ON master_trader_followers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can follow master traders"
  ON master_trader_followers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own follows"
  ON master_trader_followers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can unfollow master traders"
  ON master_trader_followers FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update follower count
CREATE OR REPLACE FUNCTION update_master_trader_follower_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE master_traders
    SET follower_count = (
      SELECT COUNT(*) 
      FROM master_trader_followers 
      WHERE master_trader_id = NEW.master_trader_id 
      AND is_active = true
    )
    WHERE id = NEW.master_trader_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE master_traders
    SET follower_count = (
      SELECT COUNT(*) 
      FROM master_trader_followers 
      WHERE master_trader_id = OLD.master_trader_id 
      AND is_active = true
    )
    WHERE id = OLD.master_trader_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update follower count
CREATE TRIGGER update_follower_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON master_trader_followers
  FOR EACH ROW
  EXECUTE FUNCTION update_master_trader_follower_count();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_master_traders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_master_traders_timestamp
  BEFORE UPDATE ON master_traders
  FOR EACH ROW
  EXECUTE FUNCTION update_master_traders_updated_at();

