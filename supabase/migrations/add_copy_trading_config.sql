-- Create copy_trading_config table for user copy trading settings
CREATE TABLE IF NOT EXISTS copy_trading_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  master_wallet TEXT NOT NULL,
  allocated_capital DECIMAL(20, 2) NOT NULL,
  is_active BOOLEAN DEFAULT false,
  
  -- Position sizing
  position_sizing_mode TEXT DEFAULT 'proportional' CHECK (position_sizing_mode IN ('fixed', 'proportional', 'custom', 'kelly')),
  fixed_position_size DECIMAL(20, 2), -- For 'fixed' mode
  proportional_percentage DECIMAL(5, 2) DEFAULT 10, -- For 'proportional' mode (% of master's position)
  max_position_size DECIMAL(20, 2), -- Maximum $ per position
  
  -- Risk management
  max_slippage DECIMAL(5, 2) DEFAULT 1.0, -- Maximum slippage tolerance %
  max_price_impact DECIMAL(5, 2) DEFAULT 3.0, -- Maximum price impact %
  stop_loss_percentage DECIMAL(5, 2), -- Auto stop-loss %
  take_profit_percentage DECIMAL(5, 2), -- Auto take-profit %
  max_daily_loss DECIMAL(20, 2), -- Maximum daily loss limit
  max_daily_trades INTEGER DEFAULT 20, -- Maximum trades per day
  
  -- Token filters
  token_whitelist TEXT[] DEFAULT '{}', -- Only copy these tokens (empty = all)
  token_blacklist TEXT[] DEFAULT '{}', -- Never copy these tokens
  min_liquidity DECIMAL(20, 2), -- Minimum pool liquidity required
  
  -- Execution
  auto_execute BOOLEAN DEFAULT false, -- If true, execute without confirmation
  priority_fee DECIMAL(10, 6) DEFAULT 0.000005, -- SOL priority fee for faster execution
  
  -- Statistics
  total_copied_trades INTEGER DEFAULT 0,
  successful_trades INTEGER DEFAULT 0,
  failed_trades INTEGER DEFAULT 0,
  total_pnl DECIMAL(20, 2) DEFAULT 0,
  
  -- Metadata
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, master_wallet)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_copy_trading_config_user_id ON copy_trading_config(user_id);
CREATE INDEX IF NOT EXISTS idx_copy_trading_config_master_wallet ON copy_trading_config(master_wallet);
CREATE INDEX IF NOT EXISTS idx_copy_trading_config_active ON copy_trading_config(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE copy_trading_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own configs"
  ON copy_trading_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own configs"
  ON copy_trading_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own configs"
  ON copy_trading_config FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own configs"
  ON copy_trading_config FOR DELETE
  USING (auth.uid() = user_id);

-- Function to validate config before activation
CREATE OR REPLACE FUNCTION validate_copy_trading_config()
RETURNS TRIGGER AS $$
BEGIN
  -- Check allocated capital is positive
  IF NEW.allocated_capital <= 0 THEN
    RAISE EXCEPTION 'Allocated capital must be greater than 0';
  END IF;
  
  -- Check position sizing makes sense
  IF NEW.position_sizing_mode = 'fixed' AND (NEW.fixed_position_size IS NULL OR NEW.fixed_position_size <= 0) THEN
    RAISE EXCEPTION 'Fixed position size must be set and greater than 0 for fixed mode';
  END IF;
  
  IF NEW.position_sizing_mode = 'proportional' AND (NEW.proportional_percentage IS NULL OR NEW.proportional_percentage <= 0 OR NEW.proportional_percentage > 100) THEN
    RAISE EXCEPTION 'Proportional percentage must be between 0 and 100';
  END IF;
  
  -- Set started_at when activating
  IF NEW.is_active = true AND (OLD.is_active IS NULL OR OLD.is_active = false) THEN
    NEW.started_at = NOW();
    NEW.paused_at = NULL;
  END IF;
  
  -- Set paused_at when deactivating
  IF NEW.is_active = false AND OLD.is_active = true THEN
    NEW.paused_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for validation
CREATE TRIGGER validate_copy_trading_config_trigger
  BEFORE INSERT OR UPDATE ON copy_trading_config
  FOR EACH ROW
  EXECUTE FUNCTION validate_copy_trading_config();

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_copy_trading_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER update_copy_trading_config_timestamp_trigger
  BEFORE UPDATE ON copy_trading_config
  FOR EACH ROW
  EXECUTE FUNCTION update_copy_trading_config_timestamp();

-- Trigger to update leaderboard follower count (will be created after leaderboard table exists)
CREATE TRIGGER update_trader_follower_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON copy_trading_config
  FOR EACH ROW
  EXECUTE FUNCTION update_trader_follower_count();

