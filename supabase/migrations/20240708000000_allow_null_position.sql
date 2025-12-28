-- Create migration_log table if it doesn't exist
CREATE TABLE IF NOT EXISTS migration_log (
  id SERIAL PRIMARY KEY,
  migration_name TEXT NOT NULL UNIQUE,
  description TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Allow NULL values for the position column in the trades table
ALTER TABLE IF EXISTS trades ALTER COLUMN position DROP NOT NULL;

-- Add a comment to explain the change
COMMENT ON COLUMN trades.position IS 'Position type (long/short), now nullable to support imports without position data';

-- Update any existing NULL values to a default value
UPDATE trades SET position = 'long' WHERE position IS NULL;

-- Log the change
INSERT INTO migration_log (migration_name, description, executed_at)
VALUES (
  '20240708000000_allow_null_position',
  'Modified position column in trades table to allow NULL values',
  NOW()
) ON CONFLICT DO NOTHING; 