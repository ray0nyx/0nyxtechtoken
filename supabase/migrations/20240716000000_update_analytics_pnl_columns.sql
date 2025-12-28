-- Migration: Update analytics PnL columns to JSONB
-- Description: Convert daily_pnl, weekly_pnl, and monthly_pnl columns to JSONB type

-- Record the migration
INSERT INTO migration_log (migration_name, description, executed_at)
VALUES ('20240716000000_update_analytics_pnl_columns', 'Update analytics PnL columns to JSONB type', NOW());

-- Update the columns to JSONB type
ALTER TABLE analytics 
  ALTER COLUMN daily_pnl TYPE JSONB USING 
    CASE 
      WHEN daily_pnl IS NULL THEN '{}'::jsonb
      ELSE jsonb_build_object(CURRENT_DATE::text, daily_pnl)
    END,
  ALTER COLUMN weekly_pnl TYPE JSONB USING 
    CASE 
      WHEN weekly_pnl IS NULL THEN '{}'::jsonb
      ELSE jsonb_build_object(date_trunc('week', CURRENT_DATE)::text, weekly_pnl)
    END,
  ALTER COLUMN monthly_pnl TYPE JSONB USING 
    CASE 
      WHEN monthly_pnl IS NULL THEN '{}'::jsonb
      ELSE jsonb_build_object(date_trunc('month', CURRENT_DATE)::text, monthly_pnl)
    END;

-- Update the populate_analytics_table function to handle JSONB PnL
CREATE OR REPLACE FUNCTION populate_analytics_table(p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_daily_pnl jsonb;
  v_weekly_pnl jsonb;
  v_monthly_pnl jsonb;
BEGIN
  -- Calculate daily PnL
  WITH daily_stats AS (
    SELECT 
      date_trunc('day', date)::date as trade_date,
      SUM(pnl) as pnl
    FROM trades
    WHERE user_id = p_user_id
    GROUP BY date_trunc('day', date)::date
  )
  SELECT 
    jsonb_object_agg(trade_date::text, pnl)
  INTO v_daily_pnl
  FROM daily_stats;

  -- Calculate weekly PnL
  WITH weekly_stats AS (
    SELECT 
      date_trunc('week', date)::date as trade_week,
      SUM(pnl) as pnl
    FROM trades
    WHERE user_id = p_user_id
    GROUP BY date_trunc('week', date)::date
  )
  SELECT 
    jsonb_object_agg(trade_week::text, pnl)
  INTO v_weekly_pnl
  FROM weekly_stats;

  -- Calculate monthly PnL
  WITH monthly_stats AS (
    SELECT 
      date_trunc('month', date)::date as trade_month,
      SUM(pnl) as pnl
    FROM trades
    WHERE user_id = p_user_id
    GROUP BY date_trunc('month', date)::date
  )
  SELECT 
    jsonb_object_agg(trade_month::text, pnl)
  INTO v_monthly_pnl
  FROM monthly_stats;

  -- Update or insert analytics record
  INSERT INTO analytics (
    user_id,
    total_trades,
    win_rate,
    total_pnl,
    average_pnl,
    total_wins,
    total_losses,
    largest_win,
    largest_loss,
    daily_pnl,
    weekly_pnl,
    monthly_pnl,
    cumulative_pnl
  )
  SELECT
    p_user_id,
    COUNT(*) as total_trades,
    (COUNT(CASE WHEN pnl > 0 THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100) as win_rate,
    SUM(pnl) as total_pnl,
    AVG(pnl) as average_pnl,
    COUNT(CASE WHEN pnl > 0 THEN 1 END) as total_wins,
    COUNT(CASE WHEN pnl < 0 THEN 1 END) as total_losses,
    MAX(pnl) as largest_win,
    MIN(pnl) as largest_loss,
    COALESCE(v_daily_pnl, '{}'::jsonb) as daily_pnl,
    COALESCE(v_weekly_pnl, '{}'::jsonb) as weekly_pnl,
    COALESCE(v_monthly_pnl, '{}'::jsonb) as monthly_pnl,
    SUM(pnl) OVER (ORDER BY date) as cumulative_pnl
  FROM trades
  WHERE user_id = p_user_id
  ON CONFLICT (user_id)
  DO UPDATE SET
    total_trades = EXCLUDED.total_trades,
    win_rate = EXCLUDED.win_rate,
    total_pnl = EXCLUDED.total_pnl,
    average_pnl = EXCLUDED.average_pnl,
    total_wins = EXCLUDED.total_wins,
    total_losses = EXCLUDED.total_losses,
    largest_win = EXCLUDED.largest_win,
    largest_loss = EXCLUDED.largest_loss,
    daily_pnl = EXCLUDED.daily_pnl,
    weekly_pnl = EXCLUDED.weekly_pnl,
    monthly_pnl = EXCLUDED.monthly_pnl,
    cumulative_pnl = EXCLUDED.cumulative_pnl,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 