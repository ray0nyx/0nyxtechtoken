-- Create wallet_tracking table for Solana and Bitcoin wallets
CREATE TABLE IF NOT EXISTS wallet_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  blockchain TEXT NOT NULL CHECK (blockchain IN ('solana', 'bitcoin')),
  label TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, wallet_address, blockchain)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_wallet_tracking_user_id ON wallet_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tracking_address ON wallet_tracking(wallet_address);
CREATE INDEX IF NOT EXISTS idx_wallet_tracking_blockchain ON wallet_tracking(blockchain);

-- Create wallet_analytics_cache table to store cached wallet data
CREATE TABLE IF NOT EXISTS wallet_analytics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  blockchain TEXT NOT NULL CHECK (blockchain IN ('solana', 'bitcoin')),
  data JSONB NOT NULL,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(wallet_address, blockchain)
);

-- Create index for cache lookups
CREATE INDEX IF NOT EXISTS idx_wallet_cache_address ON wallet_analytics_cache(wallet_address, blockchain);
CREATE INDEX IF NOT EXISTS idx_wallet_cache_expires ON wallet_analytics_cache(expires_at);

-- Enable RLS
ALTER TABLE wallet_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_analytics_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies for wallet_tracking
CREATE POLICY "Users can view their own wallets"
  ON wallet_tracking FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wallets"
  ON wallet_tracking FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wallets"
  ON wallet_tracking FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wallets"
  ON wallet_tracking FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for wallet_analytics_cache (read-only for authenticated users)
CREATE POLICY "Authenticated users can read wallet cache"
  ON wallet_analytics_cache FOR SELECT
  USING (auth.role() = 'authenticated');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_wallet_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_wallet_tracking_timestamp
  BEFORE UPDATE ON wallet_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_wallet_tracking_updated_at();

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_wallet_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM wallet_analytics_cache
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

