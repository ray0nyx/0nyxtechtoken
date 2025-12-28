-- Create trading_orders table for storing user trading orders
CREATE TABLE IF NOT EXISTS trading_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pair TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  order_type TEXT NOT NULL CHECK (order_type IN ('market', 'limit', 'stop_loss', 'take_profit')),
  amount DECIMAL NOT NULL CHECK (amount > 0),
  price DECIMAL CHECK (price > 0),
  stop_price DECIMAL CHECK (stop_price > 0),
  take_profit_price DECIMAL CHECK (take_profit_price > 0),
  execution_method TEXT NOT NULL CHECK (execution_method IN ('onchain', 'exchange')),
  exchange_name TEXT,
  wallet_address TEXT,
  transaction_hash TEXT,
  slippage_bps INTEGER NOT NULL DEFAULT 50 CHECK (slippage_bps >= 0 AND slippage_bps <= 1000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'filled', 'cancelled', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  filled_at TIMESTAMPTZ,
  filled_price DECIMAL,
  filled_quantity DECIMAL,
  fees DECIMAL,
  error_message TEXT
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_trading_orders_user_id ON trading_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_orders_status ON trading_orders(status);
CREATE INDEX IF NOT EXISTS idx_trading_orders_pair ON trading_orders(pair);
CREATE INDEX IF NOT EXISTS idx_trading_orders_created_at ON trading_orders(created_at DESC);

-- Enable RLS
ALTER TABLE trading_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own orders
CREATE POLICY "Users can view their own orders"
  ON trading_orders FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own orders
CREATE POLICY "Users can insert their own orders"
  ON trading_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own orders
CREATE POLICY "Users can update their own orders"
  ON trading_orders FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can delete their own orders
CREATE POLICY "Users can delete their own orders"
  ON trading_orders FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_trading_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_trading_orders_updated_at
  BEFORE UPDATE ON trading_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_trading_orders_updated_at();

