-- First drop the existing functions
DROP FUNCTION IF EXISTS update_all_analytics();
DROP FUNCTION IF EXISTS update_analytics_for_user(UUID);

-- Check if process_pending_trades needs to be recreated
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_pending_trades') THEN
    -- Temporarily disable process_pending_trades to prevent issues
    CREATE OR REPLACE FUNCTION process_pending_trades()
    RETURNS VOID AS $$
    BEGIN
      -- Empty implementation to avoid dependency issues
      RAISE NOTICE 'Process pending trades called. Implementation temporarily disabled.';
    END;
    $$ LANGUAGE plpgsql;
  END IF;
END$$;

-- Fix the update_analytics_for_user function to handle JSONB columns correctly
CREATE OR REPLACE FUNCTION update_analytics_for_user(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_trades_count INTEGER;
  v_total_pnl NUMERIC;
  v_wins INTEGER;
  v_losses INTEGER;
  v_win_rate NUMERIC;
  v_avg_pnl NUMERIC;
  v_largest_win NUMERIC;
  v_largest_loss NUMERIC;
  v_daily_pnl JSONB;
  v_weekly_pnl JSONB;
  v_monthly_pnl JSONB;
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
  
  -- Calculate daily PNL
  SELECT jsonb_object_agg(
    date::TEXT, 
    ROUND(SUM(pnl)::NUMERIC, 2)
  )
  INTO v_daily_pnl
  FROM trades
  WHERE user_id = p_user_id
  AND date >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY date;
  
  -- Calculate weekly PNL
  SELECT jsonb_object_agg(
    TO_CHAR(date_trunc('week', date), 'YYYY-MM-DD'),
    ROUND(SUM(pnl)::NUMERIC, 2)
  )
  INTO v_weekly_pnl
  FROM trades
  WHERE user_id = p_user_id
  AND date >= CURRENT_DATE - INTERVAL '12 weeks'
  GROUP BY date_trunc('week', date);
  
  -- Calculate monthly PNL
  SELECT jsonb_object_agg(
    TO_CHAR(date_trunc('month', date), 'YYYY-MM'),
    ROUND(SUM(pnl)::NUMERIC, 2)
  )
  INTO v_monthly_pnl
  FROM trades
  WHERE user_id = p_user_id
  AND date >= CURRENT_DATE - INTERVAL '12 months'
  GROUP BY date_trunc('month', date);
  
  -- Delete existing analytics for this user to prevent duplicates
  DELETE FROM analytics WHERE user_id = p_user_id;
  
  -- Insert new analytics with properly formatted JSONB values
  INSERT INTO analytics (
    user_id,
    metric_name,
    metric_value,
    total_trades,
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
    jsonb_build_object('value', v_trades_count),
    jsonb_build_object('value', ROUND(v_total_pnl, 2)),
    jsonb_build_object('value', ROUND(v_win_rate, 2)),
    jsonb_build_object('value', ROUND(v_avg_pnl, 2)),
    jsonb_build_object('value', v_wins),
    jsonb_build_object('value', v_losses),
    jsonb_build_object('value', ROUND(v_largest_win, 2)),
    jsonb_build_object('value', ROUND(v_largest_loss, 2)),
    COALESCE(v_daily_pnl, '{}'::JSONB),
    COALESCE(v_weekly_pnl, '{}'::JSONB),
    COALESCE(v_monthly_pnl, '{}'::JSONB),
    jsonb_build_object('value', ROUND(v_total_pnl, 2)),
    NOW(),
    NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_analytics_for_user(UUID) TO authenticated;

-- Also fix the update_all_analytics function to use our fixed function
CREATE OR REPLACE FUNCTION update_all_analytics()
RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  FOR v_user_id IN 
    SELECT DISTINCT user_id 
    FROM trades
    WHERE user_id IS NOT NULL
  LOOP
    PERFORM update_analytics_for_user(v_user_id);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_all_analytics() TO authenticated;

-- Fix the process_pending_trades function if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_pending_trades') THEN
    -- Restore proper behavior for process_pending_trades
    CREATE OR REPLACE FUNCTION process_pending_trades()
    RETURNS VOID AS $$
    DECLARE
      v_record_id UUID;
      v_count INTEGER := 0;
    BEGIN
      -- Process each record in the staging table
      FOR v_record_id IN 
        SELECT id FROM trades_staging
        WHERE processed = FALSE
        ORDER BY created_at
      LOOP
        BEGIN
          -- Process each record
          PERFORM process_one_staging_trade(v_record_id);
          v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'Error processing trade %: %', v_record_id, SQLERRM;
        END;
      END LOOP;
      
      -- Update analytics for all users that had trades processed
      PERFORM update_all_analytics();
      
      RAISE NOTICE 'Processed % trades', v_count;
    END;
    $$ LANGUAGE plpgsql;
    
    -- Grant permissions
    GRANT EXECUTE ON FUNCTION process_pending_trades() TO authenticated;
  END IF;
END$$;

-- Print a message to indicate successful execution
DO $$
BEGIN
  RAISE NOTICE 'Analytics functions have been updated successfully!';
END$$; 