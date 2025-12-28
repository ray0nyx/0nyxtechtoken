-- Migration: Add Exchange Connections Table
-- This table stores user connections to cryptocurrency exchanges for broker sync

-- Create the user_exchange_connections table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_exchange_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exchange_name TEXT NOT NULL,
  api_key_encrypted TEXT,
  api_secret_encrypted TEXT,
  passphrase_encrypted TEXT,
  subaccount TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'error')),
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  sync_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one connection per exchange per user
  UNIQUE(user_id, exchange_name)
);

-- Add status column if it doesn't exist (for existing tables)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_exchange_connections' AND column_name = 'status'
  ) THEN
    ALTER TABLE user_exchange_connections 
    ADD COLUMN status TEXT NOT NULL DEFAULT 'active' 
    CHECK (status IN ('active', 'disconnected', 'error'));
  END IF;
END $$;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_exchange_connections_user_id ON user_exchange_connections(user_id);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_exchange_connections' AND column_name = 'status'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_exchange_connections_status ON user_exchange_connections(status);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_exchange_connections_exchange ON user_exchange_connections(exchange_name);

-- Enable RLS
ALTER TABLE user_exchange_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see their own connections
CREATE POLICY "Users can view own exchange connections"
  ON user_exchange_connections FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own connections
CREATE POLICY "Users can create own exchange connections"
  ON user_exchange_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own connections
CREATE POLICY "Users can update own exchange connections"
  ON user_exchange_connections FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own connections
CREATE POLICY "Users can delete own exchange connections"
  ON user_exchange_connections FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_exchange_connection_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp
DROP TRIGGER IF EXISTS update_exchange_connection_timestamp ON user_exchange_connections;
CREATE TRIGGER update_exchange_connection_timestamp
  BEFORE UPDATE ON user_exchange_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_exchange_connection_timestamp();

-- Add exchange_connection_id to trades table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trades' AND column_name = 'exchange_connection_id'
  ) THEN
    ALTER TABLE trades ADD COLUMN exchange_connection_id UUID REFERENCES user_exchange_connections(id);
    CREATE INDEX idx_trades_exchange_connection ON trades(exchange_connection_id);
  END IF;
END $$;

-- Add is_maker column to trades table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trades' AND column_name = 'is_maker'
  ) THEN
    ALTER TABLE trades ADD COLUMN is_maker BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Add order_type column to trades table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trades' AND column_name = 'order_type'
  ) THEN
    ALTER TABLE trades ADD COLUMN order_type TEXT CHECK (order_type IN ('market', 'limit', 'stop', 'stop_limit'));
  END IF;
END $$;

-- Create exchange sync logs table for tracking sync history
CREATE TABLE IF NOT EXISTS exchange_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES user_exchange_connections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('manual', 'scheduled', 'realtime')),
  status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
  trades_synced INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  metadata JSONB
);

-- Indexes for sync logs
CREATE INDEX IF NOT EXISTS idx_sync_logs_connection ON exchange_sync_logs(connection_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_user ON exchange_sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON exchange_sync_logs(status);

-- RLS for sync logs
ALTER TABLE exchange_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sync logs"
  ON exchange_sync_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sync logs"
  ON exchange_sync_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON user_exchange_connections TO authenticated;
GRANT ALL ON exchange_sync_logs TO authenticated;








