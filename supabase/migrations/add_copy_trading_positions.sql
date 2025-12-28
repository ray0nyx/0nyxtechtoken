-- Create copy_trading_positions table for tracking copied positions
CREATE TABLE IF NOT EXISTS copy_trading_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  config_id UUID NOT NULL REFERENCES copy_trading_config(id) ON DELETE CASCADE,
  master_wallet TEXT NOT NULL,
  
  -- Master trade info
  master_tx_hash TEXT NOT NULL,
  master_token_in TEXT NOT NULL,
  master_token_out TEXT NOT NULL,
  master_amount_in DECIMAL(28, 18),
  master_amount_out DECIMAL(28, 18),
  
  -- User trade info
  user_tx_hash TEXT,
  token_in TEXT NOT NULL,
  token_out TEXT NOT NULL,
  amount_in DECIMAL(28, 18),
  amount_out DECIMAL(28, 18),
  entry_price DECIMAL(28, 18),
  exit_price DECIMAL(28, 18),
  
  -- Position tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'open', 'closed', 'failed', 'cancelled')),
  pnl DECIMAL(20, 2),
  pnl_percentage DECIMAL(10, 4),
  roi DECIMAL(10, 4),
  
  -- Execution details
  slippage_actual DECIMAL(5, 2),
  price_impact_actual DECIMAL(5, 2),
  fees_paid DECIMAL(20, 8),
  execution_delay_ms INTEGER, -- Milliseconds delay from master trade
  
  -- Risk management
  stop_loss_price DECIMAL(28, 18),
  take_profit_price DECIMAL(28, 18),
  stop_loss_triggered BOOLEAN DEFAULT false,
  take_profit_triggered BOOLEAN DEFAULT false,
  
  -- Metadata
  opened_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create pending copy trades queue
CREATE TABLE IF NOT EXISTS pending_copy_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  config_id UUID NOT NULL REFERENCES copy_trading_config(id) ON DELETE CASCADE,
  master_wallet TEXT NOT NULL,
  master_tx_hash TEXT NOT NULL,
  token_in TEXT NOT NULL,
  token_out TEXT NOT NULL,
  suggested_amount_in DECIMAL(28, 18),
  priority INTEGER DEFAULT 5, -- 1-10, higher = execute first
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '5 minutes',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, master_tx_hash)
);

-- Create copy trading performance summary
CREATE TABLE IF NOT EXISTS copy_trading_performance_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  master_wallet TEXT NOT NULL,
  
  -- Performance metrics
  total_positions INTEGER DEFAULT 0,
  open_positions INTEGER DEFAULT 0,
  closed_positions INTEGER DEFAULT 0,
  winning_positions INTEGER DEFAULT 0,
  losing_positions INTEGER DEFAULT 0,
  win_rate DECIMAL(5, 2),
  
  -- Financial metrics
  total_capital_deployed DECIMAL(20, 2),
  total_pnl DECIMAL(20, 2),
  total_roi DECIMAL(10, 4),
  avg_position_size DECIMAL(20, 2),
  largest_win DECIMAL(20, 2),
  largest_loss DECIMAL(20, 2),
  total_fees DECIMAL(20, 2),
  
  -- Time-based performance
  pnl_24h DECIMAL(20, 2),
  pnl_7d DECIMAL(20, 2),
  pnl_30d DECIMAL(20, 2),
  
  -- Execution metrics
  avg_execution_delay_ms INTEGER,
  avg_slippage DECIMAL(5, 2),
  failed_trades INTEGER DEFAULT 0,
  success_rate DECIMAL(5, 2),
  
  last_calculated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, master_wallet)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_copy_trading_positions_user_id ON copy_trading_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_copy_trading_positions_config_id ON copy_trading_positions(config_id);
CREATE INDEX IF NOT EXISTS idx_copy_trading_positions_master_wallet ON copy_trading_positions(master_wallet);
CREATE INDEX IF NOT EXISTS idx_copy_trading_positions_status ON copy_trading_positions(status);
CREATE INDEX IF NOT EXISTS idx_copy_trading_positions_master_tx ON copy_trading_positions(master_tx_hash);
CREATE INDEX IF NOT EXISTS idx_pending_copy_trades_user_id ON pending_copy_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_copy_trades_status ON pending_copy_trades(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_pending_copy_trades_expires ON pending_copy_trades(expires_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_copy_trading_performance_user_id ON copy_trading_performance_summary(user_id);

-- Enable RLS
ALTER TABLE copy_trading_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_copy_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE copy_trading_performance_summary ENABLE ROW LEVEL SECURITY;

-- RLS Policies for copy_trading_positions
CREATE POLICY "Users can view their own positions"
  ON copy_trading_positions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own positions"
  ON copy_trading_positions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own positions"
  ON copy_trading_positions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage positions"
  ON copy_trading_positions FOR ALL
  USING (auth.role() = 'service_role');

-- RLS Policies for pending_copy_trades
CREATE POLICY "Users can view their own pending trades"
  ON pending_copy_trades FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own pending trades"
  ON pending_copy_trades FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage pending trades"
  ON pending_copy_trades FOR ALL
  USING (auth.role() = 'service_role');

-- RLS Policies for copy_trading_performance_summary
CREATE POLICY "Users can view their own performance"
  ON copy_trading_performance_summary FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage performance summaries"
  ON copy_trading_performance_summary FOR ALL
  USING (auth.role() = 'service_role');

-- Function to update performance summary when position closes
CREATE OR REPLACE FUNCTION update_copy_trading_performance()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'closed' AND (OLD.status IS NULL OR OLD.status != 'closed') THEN
    INSERT INTO copy_trading_performance_summary (
      user_id, master_wallet, total_positions, closed_positions,
      winning_positions, losing_positions, total_capital_deployed, 
      total_pnl, total_fees, largest_win, largest_loss
    )
    VALUES (
      NEW.user_id, NEW.master_wallet, 1, 1,
      CASE WHEN NEW.pnl > 0 THEN 1 ELSE 0 END,
      CASE WHEN NEW.pnl < 0 THEN 1 ELSE 0 END,
      NEW.amount_in, NEW.pnl, NEW.fees_paid,
      CASE WHEN NEW.pnl > 0 THEN NEW.pnl ELSE 0 END,
      CASE WHEN NEW.pnl < 0 THEN ABS(NEW.pnl) ELSE 0 END
    )
    ON CONFLICT (user_id, master_wallet) DO UPDATE SET
      total_positions = copy_trading_performance_summary.total_positions + 1,
      closed_positions = copy_trading_performance_summary.closed_positions + 1,
      winning_positions = copy_trading_performance_summary.winning_positions + 
        CASE WHEN NEW.pnl > 0 THEN 1 ELSE 0 END,
      losing_positions = copy_trading_performance_summary.losing_positions + 
        CASE WHEN NEW.pnl < 0 THEN 1 ELSE 0 END,
      total_capital_deployed = copy_trading_performance_summary.total_capital_deployed + NEW.amount_in,
      total_pnl = copy_trading_performance_summary.total_pnl + COALESCE(NEW.pnl, 0),
      total_fees = copy_trading_performance_summary.total_fees + COALESCE(NEW.fees_paid, 0),
      largest_win = GREATEST(copy_trading_performance_summary.largest_win, COALESCE(NEW.pnl, 0)),
      largest_loss = GREATEST(copy_trading_performance_summary.largest_loss, 
        CASE WHEN NEW.pnl < 0 THEN ABS(NEW.pnl) ELSE 0 END),
      win_rate = (copy_trading_performance_summary.winning_positions + 
        CASE WHEN NEW.pnl > 0 THEN 1 ELSE 0 END) * 100.0 / 
        (copy_trading_performance_summary.closed_positions + 1),
      last_calculated = NOW(),
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update performance
CREATE TRIGGER update_copy_trading_performance_trigger
  AFTER UPDATE ON copy_trading_positions
  FOR EACH ROW
  EXECUTE FUNCTION update_copy_trading_performance();

-- Function to expire old pending trades
CREATE OR REPLACE FUNCTION expire_old_pending_trades()
RETURNS void AS $$
BEGIN
  UPDATE pending_copy_trades
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_copy_trading_positions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_copy_trading_positions_timestamp_trigger
  BEFORE UPDATE ON copy_trading_positions
  FOR EACH ROW
  EXECUTE FUNCTION update_copy_trading_positions_timestamp();

CREATE TRIGGER update_copy_trading_performance_summary_timestamp_trigger
  BEFORE UPDATE ON copy_trading_performance_summary
  FOR EACH ROW
  EXECUTE FUNCTION update_copy_trading_positions_timestamp();

