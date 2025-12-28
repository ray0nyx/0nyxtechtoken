-- Migration: Ensure exchange_connection_id column exists in trades table
-- This fixes the 400 Bad Request error when querying CEX trades

-- Add exchange_connection_id column if it doesn't exist
ALTER TABLE trades ADD COLUMN IF NOT EXISTS exchange_connection_id UUID REFERENCES user_exchange_connections(id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_trades_exchange_connection ON trades(exchange_connection_id);

-- Add comment to clarify the column's purpose
COMMENT ON COLUMN trades.exchange_connection_id IS 'Foreign key linking trades to cryptocurrency exchange connections for CEX trades';

