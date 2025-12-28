-- Migration: Populate analytics tables with data from trades
-- File: supabase/migrations/20240711000002_populate_analytics_tables.sql

-- Log the migration
INSERT INTO migration_log (migration_name, description, executed_at)
VALUES (
  '20240711000002_populate_analytics_tables',
  'Populate analytics tables with data from trades',
  NOW()
) ON CONFLICT DO NOTHING;

-- 1. Populate analytics_table for all users
DO $$
DECLARE
  user_record RECORD;
BEGIN
  -- Check if the populate_analytics_table function exists
  IF EXISTS (SELECT FROM pg_proc WHERE proname = 'populate_analytics_table') THEN
    -- For each user with trades
    FOR user_record IN SELECT DISTINCT user_id FROM trades LOOP
      -- Call the function to populate analytics for this user
      PERFORM populate_analytics_table(user_record.user_id);
    END LOOP;
  ELSE
    RAISE NOTICE 'Function populate_analytics_table does not exist, skipping population step';
  END IF;
END;
$$;

-- 2. Create a trigger to update analytics_table when trades are modified
CREATE OR REPLACE FUNCTION update_analytics_on_trade_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the populate_analytics_table function exists
  IF EXISTS (SELECT FROM pg_proc WHERE proname = 'populate_analytics_table') THEN
    -- For inserts and updates
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
      -- Update analytics for the user
      PERFORM populate_analytics_table(NEW.user_id);
    END IF;
    
    -- For deletes
    IF TG_OP = 'DELETE' THEN
      -- Update analytics for the user
      PERFORM populate_analytics_table(OLD.user_id);
    END IF;
  ELSE
    RAISE NOTICE 'Function populate_analytics_table does not exist, skipping analytics update';
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it already exists
DROP TRIGGER IF EXISTS trades_update_analytics ON trades;

-- Create the trigger
CREATE TRIGGER trades_update_analytics
AFTER INSERT OR UPDATE OR DELETE ON trades
FOR EACH ROW EXECUTE FUNCTION update_analytics_on_trade_change();

-- 3. Create a function to get analytics data for the Analytics page
CREATE OR REPLACE FUNCTION get_analytics_for_user(p_user_id UUID)
RETURNS TABLE (
  total_trades INTEGER,
  win_rate NUMERIC,
  total_pnl NUMERIC,
  average_pnl NUMERIC,
  winning_trades INTEGER,
  losing_trades INTEGER,
  largest_win NUMERIC,
  largest_loss NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH trade_stats AS (
    SELECT
      COUNT(*) as total_trades,
      SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as winning_trades,
      SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losing_trades,
      SUM(pnl) as total_pnl,
      AVG(pnl) as average_pnl,
      COALESCE(MAX(CASE WHEN pnl > 0 THEN pnl ELSE 0 END), 0) as largest_win,
      COALESCE(MIN(CASE WHEN pnl < 0 THEN pnl ELSE 0 END), 0) as largest_loss
    FROM
      trades
    WHERE
      user_id = p_user_id
  )
  SELECT
    total_trades,
    CASE WHEN total_trades > 0 THEN (winning_trades::NUMERIC / total_trades) * 100 ELSE 0 END as win_rate,
    total_pnl,
    average_pnl,
    winning_trades,
    losing_trades,
    largest_win,
    largest_loss
  FROM
    trade_stats;
END;
$$ LANGUAGE plpgsql; 