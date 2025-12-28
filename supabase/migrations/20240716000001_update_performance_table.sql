-- Migration: Update performance table to use JSONB
-- Description: Convert performance metrics to JSONB type for consistency

-- Record the migration
INSERT INTO migration_log (migration_name, description, executed_at)
VALUES ('20240716000001_update_performance_table', 'Update performance table to use JSONB type', NOW());

-- Update the performance table structure
ALTER TABLE performance_table
  ALTER COLUMN "Strategy Performance" TYPE JSONB USING jsonb_build_object('value', "Strategy Performance"),
  ALTER COLUMN "Win Rate" TYPE JSONB USING jsonb_build_object('value', "Win Rate"),
  ALTER COLUMN "Trade Duration vs P&L" TYPE JSONB USING jsonb_build_object('value', "Trade Duration vs P&L"),
  ALTER COLUMN "Performance by Duration" TYPE JSONB USING jsonb_build_object('value', "Performance by Duration");

-- Drop existing function before recreating with new return type
DROP FUNCTION IF EXISTS get_performance_for_user(UUID);

-- Update the get_performance_for_user function to handle JSONB
CREATE OR REPLACE FUNCTION get_performance_for_user(p_user_id UUID)
RETURNS TABLE(
  strategy_performance JSONB,
  win_rate JSONB,
  trade_duration_vs_pnl JSONB,
  performance_by_duration JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p."Strategy Performance" as strategy_performance,
    p."Win Rate" as win_rate,
    p."Trade Duration vs P&L" as trade_duration_vs_pnl,
    p."Performance by Duration" as performance_by_duration
  FROM
    performance_table p
  WHERE
    p.user_id = p_user_id
  ORDER BY
    p.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Update the populate_performance_table function
CREATE OR REPLACE FUNCTION populate_performance_table(p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_strategy_performance NUMERIC;
  v_win_rate NUMERIC;
  v_trade_duration_vs_pnl NUMERIC;
  v_performance_by_duration NUMERIC;
BEGIN
  -- Calculate strategy performance (average PnL by strategy)
  SELECT AVG(pnl)
  INTO v_strategy_performance
  FROM trades
  WHERE user_id = p_user_id
  AND strategy IS NOT NULL;

  -- Calculate win rate
  SELECT (COUNT(CASE WHEN pnl > 0 THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0)) * 100
  INTO v_win_rate
  FROM trades
  WHERE user_id = p_user_id;

  -- Calculate trade duration vs PnL
  SELECT AVG(pnl / NULLIF(EXTRACT(EPOCH FROM duration) / 60, 0))
  INTO v_trade_duration_vs_pnl
  FROM trades
  WHERE user_id = p_user_id
  AND duration IS NOT NULL;

  -- Calculate performance by duration
  WITH duration_buckets AS (
    SELECT
      CASE 
        WHEN EXTRACT(EPOCH FROM duration) < 300 THEN 'Under 5 min'
        WHEN EXTRACT(EPOCH FROM duration) < 900 THEN '5-15 min'
        WHEN EXTRACT(EPOCH FROM duration) < 3600 THEN '15-60 min'
        ELSE 'Over 60 min'
      END as bucket,
      AVG(pnl) as avg_pnl
    FROM trades
    WHERE user_id = p_user_id
    AND duration IS NOT NULL
    GROUP BY 1
  )
  SELECT AVG(avg_pnl)
  INTO v_performance_by_duration
  FROM duration_buckets;

  -- Update or insert performance record
  INSERT INTO performance_table (
    user_id,
    date,
    "Strategy Performance",
    "Win Rate",
    "Trade Duration vs P&L",
    "Performance by Duration"
  )
  VALUES (
    p_user_id,
    CURRENT_DATE,
    jsonb_build_object('value', COALESCE(v_strategy_performance, 0)),
    jsonb_build_object('value', COALESCE(v_win_rate, 0)),
    jsonb_build_object('value', COALESCE(v_trade_duration_vs_pnl, 0)),
    jsonb_build_object('value', COALESCE(v_performance_by_duration, 0))
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    date = EXCLUDED.date,
    "Strategy Performance" = EXCLUDED."Strategy Performance",
    "Win Rate" = EXCLUDED."Win Rate",
    "Trade Duration vs P&L" = EXCLUDED."Trade Duration vs P&L",
    "Performance by Duration" = EXCLUDED."Performance by Duration",
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql; 