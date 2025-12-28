-- Fix the analytics triggers to properly update analytics for all users

-- First, clean up existing triggers to avoid redundancy
DROP TRIGGER IF EXISTS trades_analytics_trigger ON trades;
DROP TRIGGER IF EXISTS trades_analytics_update_trigger ON trades;
DROP TRIGGER IF EXISTS trades_update_pnl_analytics ON trades;
DROP TRIGGER IF EXISTS reliable_analytics_trigger ON trades;
DROP TRIGGER IF EXISTS tradovate_analytics_update ON trades;

-- Create a proper function to update analytics for a user
CREATE OR REPLACE FUNCTION update_analytics_for_user(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  daily_pnl_json JSONB;
  weekly_pnl_json JSONB;
  monthly_pnl_json JSONB;
  total_trades INTEGER;
  total_pnl NUMERIC;
  win_rate NUMERIC;
  wins INTEGER;
  losses INTEGER;
  largest_win NUMERIC;
  largest_loss NUMERIC;
  average_pnl NUMERIC;
  
  -- Used for checking if the user has a record in analytics
  has_analytics BOOLEAN;
BEGIN
  RAISE NOTICE 'Updating analytics for user %', p_user_id;
  
  -- Calculate total trades, wins, losses, and PnL
  SELECT 
    COUNT(*) as trades_count,
    SUM(pnl) as sum_pnl,
    SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins_count,
    SUM(CASE WHEN pnl <= 0 THEN 1 ELSE 0 END) as losses_count,
    CASE 
      WHEN COUNT(*) > 0 THEN 
        (SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END)::FLOAT / COUNT(*)::FLOAT) * 100
      ELSE 0
    END as calculated_win_rate,
    AVG(pnl) as avg_pnl,
    MAX(CASE WHEN pnl > 0 THEN pnl ELSE 0 END) as max_win,
    MIN(CASE WHEN pnl < 0 THEN pnl ELSE 0 END) as max_loss
  INTO 
    total_trades, total_pnl, wins, losses, win_rate, average_pnl, largest_win, largest_loss
  FROM 
    trades
  WHERE 
    user_id = p_user_id;

  -- Calculate daily PnL metrics
  WITH daily_totals AS (
    SELECT date, SUM(pnl) as total_pnl
    FROM trades
    WHERE user_id = p_user_id
    GROUP BY date
  )
  SELECT jsonb_object_agg(date, jsonb_build_object('value', total_pnl))
  INTO daily_pnl_json
  FROM daily_totals;
    
  -- Calculate weekly PnL metrics
  WITH weekly_totals AS (
    SELECT date_trunc('week', date::timestamp) as week_start, SUM(pnl) as total_pnl
    FROM trades
    WHERE user_id = p_user_id
    GROUP BY date_trunc('week', date::timestamp)
  )
  SELECT jsonb_object_agg(to_char(week_start, 'YYYY-MM-DD'), jsonb_build_object('value', total_pnl))
  INTO weekly_pnl_json
  FROM weekly_totals;
    
  -- Calculate monthly PnL metrics
  WITH monthly_totals AS (
    SELECT date_trunc('month', date::timestamp) as month_start, SUM(pnl) as total_pnl
    FROM trades
    WHERE user_id = p_user_id
    GROUP BY date_trunc('month', date::timestamp)
  )
  SELECT jsonb_object_agg(to_char(month_start, 'YYYY-MM-DD'), jsonb_build_object('value', total_pnl))
  INTO monthly_pnl_json
  FROM monthly_totals;

  -- Check if user already has an analytics record
  SELECT EXISTS(
    SELECT 1 FROM analytics 
    WHERE user_id = p_user_id AND metric_name = 'P&L'
  ) INTO has_analytics;

  -- Handle the case where values might be NULL
  total_trades := COALESCE(total_trades, 0);
  total_pnl := COALESCE(total_pnl, 0);
  win_rate := COALESCE(win_rate, 0);
  wins := COALESCE(wins, 0);
  losses := COALESCE(losses, 0);
  largest_win := COALESCE(largest_win, 0);
  largest_loss := COALESCE(largest_loss, 0);
  average_pnl := COALESCE(average_pnl, 0);
  daily_pnl_json := COALESCE(daily_pnl_json, '{}'::JSONB);
  weekly_pnl_json := COALESCE(weekly_pnl_json, '{}'::JSONB);
  monthly_pnl_json := COALESCE(monthly_pnl_json, '{}'::JSONB);

  -- Insert or update the analytics record
  IF has_analytics THEN
    -- Update existing record
    UPDATE analytics
    SET 
      total_trades = jsonb_build_object('value', total_trades),
      total_pnl = jsonb_build_object('value', total_pnl),
      win_rate = jsonb_build_object('value', win_rate),
      wins = jsonb_build_object('value', wins),
      losses = jsonb_build_object('value', losses),
      largest_win = jsonb_build_object('value', largest_win),
      largest_loss = jsonb_build_object('value', largest_loss),
      average_pnl = jsonb_build_object('value', average_pnl),
      daily_pnl = daily_pnl_json,
      weekly_pnl = weekly_pnl_json,
      monthly_pnl = monthly_pnl_json,
      updated_at = NOW()
    WHERE 
      user_id = p_user_id 
      AND metric_name = 'P&L';
  ELSE
    -- Insert new record
    INSERT INTO analytics (
      user_id,
      metric_name,
      total_trades,
      total_pnl,
      win_rate,
      wins,
      losses,
      largest_win,
      largest_loss,
      average_pnl,
      daily_pnl,
      weekly_pnl,
      monthly_pnl,
      created_at,
      updated_at
    ) VALUES (
      p_user_id,
      'P&L',
      jsonb_build_object('value', total_trades),
      jsonb_build_object('value', total_pnl),
      jsonb_build_object('value', win_rate),
      jsonb_build_object('value', wins),
      jsonb_build_object('value', losses),
      jsonb_build_object('value', largest_win),
      jsonb_build_object('value', largest_loss),
      jsonb_build_object('value', average_pnl),
      daily_pnl_json,
      weekly_pnl_json,
      monthly_pnl_json,
      NOW(),
      NOW()
    );
  END IF;

  RAISE NOTICE 'Successfully updated analytics for user %', p_user_id;
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error updating analytics for user %: %', p_user_id, SQLERRM;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Create a reliable trigger function to update analytics when trades change
CREATE OR REPLACE FUNCTION reliable_update_analytics_on_trade_change()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Determine the affected user
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
  ELSE
    v_user_id := NEW.user_id;
  END IF;
  
  -- Safely update analytics without causing trigger recursion
  BEGIN
    PERFORM update_analytics_for_user(v_user_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to update analytics for user %, error: %', v_user_id, SQLERRM;
  END;
  
  -- Return appropriate value based on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create a single trigger that handles all trade changes
CREATE TRIGGER reliable_analytics_trigger
AFTER INSERT OR UPDATE OR DELETE ON trades
FOR EACH ROW
EXECUTE FUNCTION reliable_update_analytics_on_trade_change();

-- Create a function to manually update all users' analytics
CREATE OR REPLACE FUNCTION update_all_users_analytics()
RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
  v_users_processed INTEGER := 0;
  v_users_total INTEGER := 0;
BEGIN
  -- Count total distinct users with trades
  SELECT COUNT(DISTINCT user_id) INTO v_users_total FROM trades;
  
  -- Process each user
  FOR v_user_id IN 
    SELECT DISTINCT user_id FROM trades
  LOOP
    v_users_processed := v_users_processed + 1;
    RAISE NOTICE 'Processing user % (%/%)', v_user_id, v_users_processed, v_users_total;
    
    PERFORM update_analytics_for_user(v_user_id);
  END LOOP;
  
  RAISE NOTICE 'Completed updating analytics for % users', v_users_processed;
END;
$$ LANGUAGE plpgsql;

-- Ensure the function gets executed when this script runs
DO $$
BEGIN
  RAISE NOTICE 'Executing update_all_users_analytics()';
  PERFORM update_all_users_analytics();
END;
$$; 