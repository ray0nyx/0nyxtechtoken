-- Create wallet_labels table for categorizing known wallets
CREATE TABLE IF NOT EXISTS wallet_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT NOT NULL UNIQUE,
  blockchain TEXT NOT NULL CHECK (blockchain IN ('solana', 'bitcoin', 'ethereum')),
  category TEXT NOT NULL CHECK (category IN ('exchange', 'whale', 'institution', 'protocol', 'vc', 'smart_money', 'unknown')),
  label TEXT NOT NULL,
  confidence DECIMAL(3, 2) DEFAULT 1.0, -- 0.0 to 1.0
  metadata JSONB DEFAULT '{}',
  source TEXT DEFAULT 'manual', -- 'manual', 'auto', 'verified'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_wallet_labels for custom user labels
CREATE TABLE IF NOT EXISTS user_wallet_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  blockchain TEXT NOT NULL CHECK (blockchain IN ('solana', 'bitcoin', 'ethereum')),
  label TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, address, blockchain)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_wallet_labels_address ON wallet_labels(address);
CREATE INDEX IF NOT EXISTS idx_wallet_labels_category ON wallet_labels(category);
CREATE INDEX IF NOT EXISTS idx_wallet_labels_blockchain ON wallet_labels(blockchain);
CREATE INDEX IF NOT EXISTS idx_user_wallet_labels_user_id ON user_wallet_labels(user_id);
CREATE INDEX IF NOT EXISTS idx_user_wallet_labels_address ON user_wallet_labels(address);

-- Enable RLS
ALTER TABLE wallet_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_wallet_labels ENABLE ROW LEVEL SECURITY;

-- RLS Policies for wallet_labels (public read)
CREATE POLICY "Anyone can view wallet labels"
  ON wallet_labels FOR SELECT
  USING (true);

-- Only service role can manage public wallet labels
CREATE POLICY "Service role can manage wallet labels"
  ON wallet_labels FOR ALL
  USING (auth.role() = 'service_role');

-- RLS Policies for user_wallet_labels
CREATE POLICY "Users can view their own labels"
  ON user_wallet_labels FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own labels"
  ON user_wallet_labels FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own labels"
  ON user_wallet_labels FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own labels"
  ON user_wallet_labels FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_wallet_labels_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_wallet_labels_timestamp_trigger
  BEFORE UPDATE ON wallet_labels
  FOR EACH ROW
  EXECUTE FUNCTION update_wallet_labels_timestamp();

CREATE TRIGGER update_user_wallet_labels_timestamp_trigger
  BEFORE UPDATE ON user_wallet_labels
  FOR EACH ROW
  EXECUTE FUNCTION update_wallet_labels_timestamp();

-- Insert some known wallets (examples - would be expanded significantly)
INSERT INTO wallet_labels (address, blockchain, category, label, confidence, source) VALUES
  -- Solana Exchanges
  ('5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9', 'solana', 'exchange', 'Binance Hot Wallet', 1.0, 'verified'),
  ('CuieVDEDtLo7FypA9SbLM9saXFdb1dsshEkyErMqkRQq', 'solana', 'exchange', 'Coinbase', 1.0, 'verified'),
  ('HJP7XLrJV7MHp8P2X34qJvLaXd6Ue4XcpGxUqKQDjCYR', 'solana', 'exchange', 'FTX/Serum', 0.95, 'verified'),
  
  -- Solana Protocols
  ('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', 'solana', 'protocol', 'Jupiter Program', 1.0, 'verified'),
  ('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', 'solana', 'protocol', 'Raydium Program', 1.0, 'verified'),
  ('whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', 'solana', 'protocol', 'Orca Whirlpool', 1.0, 'verified'),
  
  -- Bitcoin Exchanges
  ('1NDyJtNTjmwk5xPNhjgAMu4HDHigtobu1s', 'bitcoin', 'exchange', 'Binance Cold Wallet', 1.0, 'verified'),
  ('bc1qgdjqv0av3q56jvd82tkdjpy7gdp9ut8tlqmgrpmv24sq90ecnvqqjwvw97', 'bitcoin', 'exchange', 'Coinbase', 1.0, 'verified'),
  ('3M219KR5vEneNb47ewrPfWyb5jQ2DjxRP6', 'bitcoin', 'exchange', 'Kraken', 0.95, 'verified')
ON CONFLICT (address) DO NOTHING;

