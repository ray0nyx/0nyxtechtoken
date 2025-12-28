-- Migration: Create analytics functions if they don't exist
-- File: supabase/migrations/20240711000001_create_analytics_functions.sql

-- Log the migration
INSERT INTO migration_log (migration_name, description, executed_at)
VALUES (
  '20240711000001_create_analytics_functions',
  'Create analytics functions if they do not exist',
  NOW()
) ON CONFLICT DO NOTHING;

-- Create analytics_table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'analytics_table') THEN
    CREATE TABLE analytics_table (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID,
      metric_name TEXT NOT NULL,
      date DATE,
      total_trades INTEGER DEFAULT 0,
      total_pnl NUMERIC(20,2) DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    -- Add RLS policies to analytics_table
    ALTER TABLE analytics_table ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Allow read access to authenticated users"
      ON analytics_table
      FOR SELECT
      USING (auth.uid() = user_id OR user_id IS NULL);
      
    RAISE NOTICE 'Created analytics_table';
  ELSE
    RAISE NOTICE 'Table analytics_table already exists';
  END IF;
END
$$;

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS populate_analytics_table(UUID);

-- Create a function to populate the analytics table
CREATE OR REPLACE FUNCTION populate_analytics_table(p_user_id UUID)
RETURNS void AS $$
BEGIN
    -- Clear existing analytics for this user
    DELETE FROM analytics_table WHERE analytics_table.user_id = p_user_id;
    
    -- Insert overall metrics
    INSERT INTO analytics_table (
        user_id, 
        metric_name, 
        total_trades, 
        total_pnl,
        created_at
    )
    SELECT
        p_user_id, -- Use the function parameter directly
        'overall_metrics' AS metric_name,
        COUNT(*) AS total_trades,
        SUM(trades.pnl) AS total_pnl,
        NOW() AS created_at
    FROM 
        trades
    WHERE 
        trades.user_id = p_user_id; -- Use the function parameter, not the column name
    
    -- Insert monthly metrics
    INSERT INTO analytics_table (
        user_id, 
        metric_name, 
        date,
        total_trades, 
        total_pnl,
        created_at
    )
    SELECT
        p_user_id, -- Use the function parameter directly
        'monthly_metrics' AS metric_name,
        DATE_TRUNC('month', trades.date)::date AS date,
        COUNT(*) AS total_trades,
        SUM(trades.pnl) AS total_pnl,
        NOW() AS created_at
    FROM 
        trades
    WHERE 
        trades.user_id = p_user_id -- Use the function parameter, not the column name
    GROUP BY 
        DATE_TRUNC('month', trades.date);
END;
$$ LANGUAGE plpgsql; 