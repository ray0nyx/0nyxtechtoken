-- Create copy_trades table for tracking copy trading activity
CREATE TABLE IF NOT EXISTS copy_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  master_trader_id UUID NOT NULL REFERENCES master_traders(id) ON DELETE CASCADE,
  master_wallet TEXT NOT NULL,
  source_tx_hash TEXT NOT NULL,
  token_in TEXT NOT NULL,
  token_out TEXT NOT NULL,
  amount_in DECIMAL(20, 8) NOT NULL,
  amount_out DECIMAL(20, 8),
  suggested_amount_in DECIMAL(20, 8),
  execution_mode TEXT NOT NULL CHECK (execution_mode IN ('manual', 'auto')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'failed', 'cancelled', 'expired')),
  user_tx_hash TEXT,
  executed_at TIMESTAMPTZ,
  error_message TEXT,
  slippage_tolerance DECIMAL(5, 2),
  max_price_impact DECIMAL(5, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create copy trading settings table
CREATE TABLE IF NOT EXISTS copy_trading_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  default_copy_mode TEXT CHECK (default_copy_mode IN ('manual', 'auto')) DEFAULT 'manual',
  max_copy_amount_per_trade DECIMAL(20, 2) DEFAULT 1000,
  position_size_percentage DECIMAL(5, 2) DEFAULT 10, -- % of portfolio to copy
  max_daily_trades INTEGER DEFAULT 10,
  blacklist_tokens TEXT[] DEFAULT '{}',
  whitelist_tokens TEXT[] DEFAULT '{}',
  slippage_tolerance DECIMAL(5, 2) DEFAULT 1.0,
  max_price_impact DECIMAL(5, 2) DEFAULT 5.0,
  enable_stop_loss BOOLEAN DEFAULT false,
  stop_loss_percentage DECIMAL(5, 2) DEFAULT 10.0,
  notifications_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create copy trades history/analytics view
CREATE OR REPLACE VIEW copy_trades_analytics AS
SELECT 
  user_id,
  master_trader_id,
  COUNT(*) as total_copy_trades,
  COUNT(*) FILTER (WHERE status = 'executed') as executed_trades,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_trades,
  COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_trades,
  SUM(amount_in) FILTER (WHERE status = 'executed') as total_volume,
  AVG(amount_in) FILTER (WHERE status = 'executed') as avg_trade_size,
  MIN(created_at) as first_copy_trade,
  MAX(executed_at) as last_executed_trade
FROM copy_trades
GROUP BY user_id, master_trader_id;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_copy_trades_user_id ON copy_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_copy_trades_master_trader_id ON copy_trades(master_trader_id);
CREATE INDEX IF NOT EXISTS idx_copy_trades_status ON copy_trades(status);
CREATE INDEX IF NOT EXISTS idx_copy_trades_source_tx ON copy_trades(source_tx_hash);
CREATE INDEX IF NOT EXISTS idx_copy_trades_created_at ON copy_trades(created_at);
CREATE INDEX IF NOT EXISTS idx_copy_trading_settings_user_id ON copy_trading_settings(user_id);

-- Enable RLS
ALTER TABLE copy_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE copy_trading_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for copy_trades
CREATE POLICY "Users can view their own copy trades"
  ON copy_trades FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own copy trades"
  ON copy_trades FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own copy trades"
  ON copy_trades FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own copy trades"
  ON copy_trades FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for copy_trading_settings
CREATE POLICY "Users can view their own settings"
  ON copy_trading_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
  ON copy_trading_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON copy_trading_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp for copy_trades
CREATE OR REPLACE FUNCTION update_copy_trades_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at for copy_trades
CREATE TRIGGER update_copy_trades_timestamp
  BEFORE UPDATE ON copy_trades
  FOR EACH ROW
  EXECUTE FUNCTION update_copy_trades_updated_at();

-- Function to update updated_at timestamp for copy_trading_settings
CREATE OR REPLACE FUNCTION update_copy_trading_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at for copy_trading_settings
CREATE TRIGGER update_copy_trading_settings_timestamp
  BEFORE UPDATE ON copy_trading_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_copy_trading_settings_updated_at();

-- Function to expire old pending copy trades (older than 5 minutes)
CREATE OR REPLACE FUNCTION expire_old_copy_trades()
RETURNS void AS $$
BEGIN
  UPDATE copy_trades
  SET status = 'expired'
  WHERE status = 'pending'
  AND created_at < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

