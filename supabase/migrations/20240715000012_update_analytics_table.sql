-- Migration: update_analytics_table
-- Description: Update analytics table structure

-- Record the migration
INSERT INTO migration_log (migration_name, description, executed_at)
VALUES ('20240715000012_update_analytics_table', 'Update analytics table structure', NOW());

-- Ensure the analytics table has the correct structure
CREATE TABLE IF NOT EXISTS analytics (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    total_trades INTEGER DEFAULT 0,
    win_rate NUMERIC DEFAULT 0,
    total_pnl NUMERIC DEFAULT 0,
    average_pnl NUMERIC DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    largest_win NUMERIC DEFAULT 0,
    largest_loss NUMERIC DEFAULT 0,
    daily_pnl NUMERIC DEFAULT 0,
    weekly_pnl NUMERIC DEFAULT 0,
    monthly_pnl NUMERIC DEFAULT 0,
    cumulative_pnl NUMERIC DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add unique constraint on user_id if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'analytics_user_id_key'
    ) THEN
        ALTER TABLE analytics ADD CONSTRAINT analytics_user_id_key UNIQUE (user_id);
    END IF;
END $$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_updated_at ON analytics(updated_at);

-- Grant necessary permissions
GRANT ALL ON analytics TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE analytics_id_seq TO authenticated; 