-- Fix JSONB type error when updating analytics table
-- Description: Ensures all functions properly convert numeric values to JSONB format before insertion

-- Fix the update_analytics_for_user function
DO $$
DECLARE
    func record;
BEGIN
    -- Find all functions that might need fixing
    FOR func IN 
        SELECT ns.nspname as schema_name, p.proname as function_name, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        INNER JOIN pg_namespace ns ON p.pronamespace = ns.oid
        WHERE p.proname IN ('populate_analytics_table', 'update_analytics_for_user', 'calculate_user_analytics')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s)', 
                       func.schema_name, 
                       func.function_name, 
                       func.args);
        RAISE NOTICE 'Dropped function %I.%I(%s)', 
                     func.schema_name, 
                     func.function_name, 
                     func.args;
    END LOOP;
END $$;

-- Fix or create the update_analytics_for_user function
CREATE OR REPLACE FUNCTION update_analytics_for_user(p_user_id uuid)
RETURNS void AS $$
DECLARE
  v_trades_count INTEGER;
  v_total_pnl NUMERIC;
  v_wins INTEGER;
  v_losses INTEGER;
  v_win_rate NUMERIC;
  v_avg_pnl NUMERIC;
  v_largest_win NUMERIC;
  v_largest_loss NUMERIC;
BEGIN
  -- Get basic stats
  SELECT 
    COUNT(*),
    COALESCE(SUM(pnl), 0),
    COUNT(*) FILTER (WHERE pnl > 0),
    COUNT(*) FILTER (WHERE pnl < 0)
  INTO 
    v_trades_count, 
    v_total_pnl,
    v_wins,
    v_losses
  FROM trades
  WHERE user_id = p_user_id;
  
  -- Calculate derived stats
  IF v_trades_count > 0 THEN
    v_win_rate := (v_wins::NUMERIC / v_trades_count) * 100;
    v_avg_pnl := v_total_pnl / v_trades_count;
  ELSE
    v_win_rate := 0;
    v_avg_pnl := 0;
  END IF;
  
  -- Get largest win and loss
  SELECT 
    COALESCE(MAX(pnl) FILTER (WHERE pnl > 0), 0),
    COALESCE(MIN(pnl) FILTER (WHERE pnl < 0), 0)
  INTO
    v_largest_win,
    v_largest_loss
  FROM trades
  WHERE user_id = p_user_id;
  
  -- Delete existing analytics for this user to prevent duplicates
  DELETE FROM analytics WHERE user_id = p_user_id;
  
  -- Insert new analytics with proper JSONB formatting
  BEGIN
    INSERT INTO analytics (
      user_id,
      metric_name,
      metric_value,
      total_trades,  -- This must be JSONB not bigint
      total_pnl,
      win_rate,
      average_pnl,
      wins,
      losses,
      largest_win,
      largest_loss,
      daily_pnl,
      weekly_pnl,
      monthly_pnl,
      cumulative_pnl,
      created_at,
      updated_at
    ) VALUES (
      p_user_id,
      'overall_metrics',
      to_jsonb(v_total_pnl),
      jsonb_build_object('value', v_trades_count),  -- Properly convert to JSONB
      jsonb_build_object('value', ROUND(v_total_pnl, 2)),
      jsonb_build_object('value', ROUND(v_win_rate, 2)),
      jsonb_build_object('value', ROUND(v_avg_pnl, 2)),
      jsonb_build_object('value', v_wins),
      jsonb_build_object('value', v_losses),
      jsonb_build_object('value', ROUND(v_largest_win, 2)),
      jsonb_build_object('value', ROUND(v_largest_loss, 2)),
      jsonb_build_object('placeholder', TRUE),
      jsonb_build_object('placeholder', TRUE),
      jsonb_build_object('placeholder', TRUE),
      jsonb_build_object('value', ROUND(v_total_pnl, 2)),
      NOW(),
      NOW()
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error updating analytics for user %: %', p_user_id, SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql;

-- Also fix the populate_analytics_table function if it exists
CREATE OR REPLACE FUNCTION populate_analytics_table(p_user_id uuid)
RETURNS void AS $$
DECLARE
  v_trades_count INTEGER;
  v_total_pnl NUMERIC;
  v_wins INTEGER;
  v_losses INTEGER;
  v_win_rate NUMERIC;
  v_avg_pnl NUMERIC;
  v_largest_win NUMERIC;
  v_largest_loss NUMERIC;
BEGIN
  -- Get basic stats
  SELECT 
    COUNT(*),
    COALESCE(SUM(pnl), 0),
    COUNT(*) FILTER (WHERE pnl > 0),
    COUNT(*) FILTER (WHERE pnl < 0)
  INTO 
    v_trades_count, 
    v_total_pnl,
    v_wins,
    v_losses
  FROM trades
  WHERE user_id = p_user_id;
  
  -- Calculate derived stats
  IF v_trades_count > 0 THEN
    v_win_rate := (v_wins::NUMERIC / v_trades_count) * 100;
    v_avg_pnl := v_total_pnl / v_trades_count;
  ELSE
    v_win_rate := 0;
    v_avg_pnl := 0;
  END IF;
  
  -- Get largest win and loss
  SELECT 
    COALESCE(MAX(pnl) FILTER (WHERE pnl > 0), 0),
    COALESCE(MIN(pnl) FILTER (WHERE pnl < 0), 0)
  INTO
    v_largest_win,
    v_largest_loss
  FROM trades
  WHERE user_id = p_user_id;
  
  -- Delete existing analytics for this user to prevent duplicates
  DELETE FROM analytics WHERE user_id = p_user_id;
  
  -- Insert new analytics with proper JSONB formatting
  BEGIN
    INSERT INTO analytics (
      user_id,
      metric_name,
      metric_value,
      total_trades,  -- This must be JSONB not bigint
      total_pnl,
      win_rate,
      average_pnl,
      wins,
      losses,
      largest_win,
      largest_loss,
      daily_pnl,
      weekly_pnl,
      monthly_pnl,
      cumulative_pnl,
      created_at,
      updated_at
    ) VALUES (
      p_user_id,
      'overall_metrics',
      to_jsonb(v_total_pnl),
      jsonb_build_object('value', v_trades_count),  -- Properly convert to JSONB
      jsonb_build_object('value', ROUND(v_total_pnl, 2)),
      jsonb_build_object('value', ROUND(v_win_rate, 2)),
      jsonb_build_object('value', ROUND(v_avg_pnl, 2)),
      jsonb_build_object('value', v_wins),
      jsonb_build_object('value', v_losses),
      jsonb_build_object('value', ROUND(v_largest_win, 2)),
      jsonb_build_object('value', ROUND(v_largest_loss, 2)),
      jsonb_build_object('placeholder', TRUE),
      jsonb_build_object('placeholder', TRUE),
      jsonb_build_object('placeholder', TRUE),
      jsonb_build_object('value', ROUND(v_total_pnl, 2)),
      NOW(),
      NOW()
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error updating analytics for user %: %', p_user_id, SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions on the functions
GRANT EXECUTE ON FUNCTION update_analytics_for_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION populate_analytics_table(UUID) TO authenticated; 