-- Migration: Ensure migration_log table exists
-- File: supabase/migrations/20240711000000_ensure_migration_log.sql

-- Create migration_log table if it doesn't exist
CREATE TABLE IF NOT EXISTS migration_log (
  id SERIAL PRIMARY KEY,
  migration_name TEXT NOT NULL UNIQUE,
  description TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add a comment to explain the purpose of this table
COMMENT ON TABLE migration_log IS 'Tracks executed migrations for better schema management';

-- Log this migration
INSERT INTO migration_log (migration_name, description, executed_at)
VALUES (
  '20240711000000_ensure_migration_log',
  'Created migration_log table to track executed migrations',
  NOW()
) ON CONFLICT DO NOTHING; 