-- Create dex_trades table for Solana DEX trade tracking
CREATE TABLE IF NOT EXISTS dex_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dex TEXT NOT NULL CHECK (dex IN ('jupiter', 'raydium', 'orca', 'meteora')),
  token_in TEXT NOT NULL,
  token_out TEXT NOT NULL,
  amount_in DECIMAL(20, 8) NOT NULL,
  amount_out DECIMAL(20, 8) NOT NULL,
  price_impact DECIMAL(10, 4),
  slippage DECIMAL(10, 4),
  fee DECIMAL(20, 8),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tx_hash TEXT,
  wallet TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_dex_trades_user_id ON dex_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_dex_trades_dex ON dex_trades(dex);
CREATE INDEX IF NOT EXISTS idx_dex_trades_timestamp ON dex_trades(timestamp);
CREATE INDEX IF NOT EXISTS idx_dex_trades_tx_hash ON dex_trades(tx_hash);

-- Enable RLS
ALTER TABLE dex_trades ENABLE ROW LEVEL SECURITY;

-- RLS Policies for dex_trades
CREATE POLICY "Users can view their own DEX trades"
  ON dex_trades FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own DEX trades"
  ON dex_trades FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own DEX trades"
  ON dex_trades FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own DEX trades"
  ON dex_trades FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_dex_trades_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_dex_trades_timestamp
  BEFORE UPDATE ON dex_trades
  FOR EACH ROW
  EXECUTE FUNCTION update_dex_trades_updated_at();

