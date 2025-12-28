-- Create quant_backtests table for storing user backtested strategies
CREATE TABLE IF NOT EXISTS quant_backtests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled Strategy',
  description TEXT,
  code TEXT, -- Strategy code
  config JSONB NOT NULL DEFAULT '{}', -- Backtest configuration
  results JSONB, -- Backtest results
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_quant_backtests_user_id ON quant_backtests(user_id);
CREATE INDEX IF NOT EXISTS idx_quant_backtests_created_at ON quant_backtests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quant_backtests_name ON quant_backtests(name);

-- Enable RLS
ALTER TABLE quant_backtests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own backtests"
  ON quant_backtests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own backtests"
  ON quant_backtests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own backtests"
  ON quant_backtests FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own backtests"
  ON quant_backtests FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_quant_backtests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_quant_backtests_updated_at
  BEFORE UPDATE ON quant_backtests
  FOR EACH ROW
  EXECUTE FUNCTION update_quant_backtests_updated_at();

