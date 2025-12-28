-- Migration: Fix analytics data display
-- Description: Updates the get_enhanced_analytics_for_user function to handle existing data format

-- Log this migration
DO $$
BEGIN
  -- Check if migration has already been applied
  IF NOT EXISTS (
    SELECT 1 FROM public.migration_log 
    WHERE migration_name = '20240715000002_fix_analytics_data_display'
  ) THEN
    -- Insert migration log entry
    INSERT INTO public.migration_log (migration_name, description, executed_at)
    VALUES ('20240715000002_fix_analytics_data_display', 'Updates the get_enhanced_analytics_for_user function to handle existing data format', NOW());
  ELSE
    RAISE NOTICE 'Migration 20240715000002_fix_analytics_data_display has already been applied.';
    RETURN;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- If the migration_log table doesn't exist yet, create it
    CREATE TABLE IF NOT EXISTS public.migration_log (
      id SERIAL PRIMARY KEY,
      migration_name TEXT NOT NULL,
      description TEXT,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    
    -- Insert migration log entry
    INSERT INTO public.migration_log (migration_name, description, executed_at)
    VALUES ('20240715000002_fix_analytics_data_display', 'Updates the get_enhanced_analytics_for_user function to handle existing data format', NOW());
END;
$$;

-- Drop the existing function
DROP FUNCTION IF EXISTS get_enhanced_analytics_for_user(UUID);

-- Create an improved version of the function that works with existing data
CREATE OR REPLACE FUNCTION get_enhanced_analytics_for_user(p_user_id UUID)
RETURNS TABLE(
  total_trades BIGINT,
  win_rate NUMERIC,
  total_pnl NUMERIC,
  average_pnl NUMERIC,
  wins BIGINT,
  losses BIGINT,
  largest_win NUMERIC,
  largest_loss NUMERIC,
  daily_pnl NUMERIC,
  weekly_pnl NUMERIC,
  monthly_pnl NUMERIC,
  cumulative_pnl NUMERIC
) AS $$
DECLARE
  v_has_overall_metrics BOOLEAN;
BEGIN
  -- Check if we have overall_metrics data
  SELECT EXISTS (
    SELECT 1 FROM analytics 
    WHERE user_id = p_user_id AND metric_name = 'overall_metrics'
  ) INTO v_has_overall_metrics;
  
  -- If we have overall_metrics, use that
  IF v_has_overall_metrics THEN
    RETURN QUERY
    SELECT
      a.total_trades,
      a.win_rate,
      a.total_pnl,
      a.average_pnl,
      a.wins,
      a.losses,
      a.largest_win,
      a.largest_loss,
      a.daily_pnl,
      a.weekly_pnl,
      a.monthly_pnl,
      a.cumulative_pnl
    FROM
      analytics a
    WHERE
      a.user_id = p_user_id
      AND a.metric_name = 'overall_metrics'
    ORDER BY
      a.created_at DESC
    LIMIT 1;
  ELSE
    -- Otherwise, calculate metrics from trades table
    RETURN QUERY
    WITH trade_stats AS (
      SELECT
        COUNT(*) AS total_trades,
        SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) AS losses,
        SUM(pnl) AS total_pnl,
        CASE 
          WHEN COUNT(*) > 0 THEN SUM(pnl) / COUNT(*) 
          ELSE 0 
        END AS average_pnl,
        CASE 
          WHEN COUNT(*) > 0 THEN (SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) 
          ELSE 0 
        END AS win_rate,
        COALESCE(MAX(CASE WHEN pnl > 0 THEN pnl ELSE 0 END), 0) AS largest_win,
        COALESCE(MIN(CASE WHEN pnl < 0 THEN pnl ELSE 0 END), 0) AS largest_loss
      FROM
        trades
      WHERE
        user_id = p_user_id
    ),
    daily_stats AS (
      SELECT
        COALESCE(SUM(pnl), 0) AS daily_pnl
      FROM
        trades
      WHERE
        user_id = p_user_id
        AND DATE(exit_time) = CURRENT_DATE
    ),
    weekly_stats AS (
      SELECT
        COALESCE(SUM(pnl), 0) AS weekly_pnl
      FROM
        trades
      WHERE
        user_id = p_user_id
        AND DATE(exit_time) >= DATE_TRUNC('week', CURRENT_DATE)
        AND DATE(exit_time) <= CURRENT_DATE
    ),
    monthly_stats AS (
      SELECT
        COALESCE(SUM(pnl), 0) AS monthly_pnl
      FROM
        trades
      WHERE
        user_id = p_user_id
        AND DATE(exit_time) >= DATE_TRUNC('month', CURRENT_DATE)
        AND DATE(exit_time) <= CURRENT_DATE
    )
    SELECT
      ts.total_trades,
      ts.win_rate,
      ts.total_pnl,
      ts.average_pnl,
      ts.wins,
      ts.losses,
      ts.largest_win,
      ts.largest_loss,
      ds.daily_pnl,
      ws.weekly_pnl,
      ms.monthly_pnl,
      ts.total_pnl AS cumulative_pnl
    FROM
      trade_stats ts,
      daily_stats ds,
      weekly_stats ws,
      monthly_stats ms;
  END IF;
END;
$$ LANGUAGE plpgsql; 