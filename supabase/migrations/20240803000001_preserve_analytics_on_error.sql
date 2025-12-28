-- Migration to add a function that preserves analytics data when new trades fail to process
-- This ensures the analytics table retains previous calculations instead of showing 0 or null values

-- Create a function to safely update analytics data
CREATE OR REPLACE FUNCTION update_analytics_safely(p_user_id UUID) RETURNS JSONB AS $$
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
  v_existing_record RECORD;
  v_result JSONB;
  v_has_trades BOOLEAN;
BEGIN
  -- First check if user has any trades
  SELECT EXISTS(SELECT 1 FROM trades WHERE user_id = p_user_id) INTO v_has_trades;
  
  -- If no trades, preserve existing data and exit early
  IF NOT v_has_trades THEN
    SELECT EXISTS(SELECT 1 FROM analytics WHERE user_id = p_user_id AND metric_name = 'overall_metrics') INTO v_has_trades;
    
    IF v_has_trades THEN
      RETURN jsonb_build_object(
        'success', TRUE,
        'action', 'preserved',
        'message', 'No trades found - preserved existing analytics data'
      );
    ELSE
      -- Initialize with zeros if no existing data
      INSERT INTO analytics (
        user_id,
        metric_name,
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
        jsonb_build_object('value', 0),
        jsonb_build_object('value', 0),
        jsonb_build_object('value', 0),
        jsonb_build_object('value', 0),
        jsonb_build_object('value', 0),
        jsonb_build_object('value', 0),
        jsonb_build_object('value', 0),
        jsonb_build_object('value', 0),
        '{}'::JSONB,
        '{}'::JSONB,
        '{}'::JSONB,
        jsonb_build_object('value', 0),
        NOW(),
        NOW()
      ) ON CONFLICT (user_id, metric_name) DO NOTHING;
      
      RETURN jsonb_build_object(
        'success', TRUE,
        'action', 'initialized',
        'message', 'No trades or existing analytics - initialized with zeros'
      );
    END IF;
  END IF;
  
  -- Keep existing record for fallback
  SELECT * INTO v_existing_record 
  FROM analytics 
  WHERE user_id = p_user_id AND metric_name = 'overall_metrics'
  ORDER BY updated_at DESC LIMIT 1;
  
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
    
    -- Handle NULL values
    v_daily_pnl := COALESCE(v_daily_pnl, '{}'::JSONB);
    v_weekly_pnl := COALESCE(v_weekly_pnl, '{}'::JSONB);
    v_monthly_pnl := COALESCE(v_monthly_pnl, '{}'::JSONB);
    
    -- Use UPSERT to update or insert 
    INSERT INTO analytics (
      user_id,
      metric_name,
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
      jsonb_build_object('value', v_trades_count),
      jsonb_build_object('value', ROUND(v_total_pnl, 2)),
      jsonb_build_object('value', ROUND(v_win_rate, 2)),
      jsonb_build_object('value', ROUND(v_avg_pnl, 2)),
      jsonb_build_object('value', v_wins),
      jsonb_build_object('value', v_losses),
      jsonb_build_object('value', ROUND(v_largest_win, 2)),
      jsonb_build_object('value', ROUND(v_largest_loss, 2)),
      v_daily_pnl,
      v_weekly_pnl,
      v_monthly_pnl,
      jsonb_build_object('value', ROUND(v_total_pnl, 2)),
      COALESCE((SELECT created_at FROM analytics WHERE user_id = p_user_id AND metric_name = 'overall_metrics' LIMIT 1), NOW()),
      NOW()
    )
    ON CONFLICT (user_id, metric_name) 
    WHERE metric_name = 'overall_metrics'
    DO UPDATE SET
      total_trades = jsonb_build_object('value', v_trades_count),
      total_pnl = jsonb_build_object('value', ROUND(v_total_pnl, 2)),
      win_rate = jsonb_build_object('value', ROUND(v_win_rate, 2)),
      average_pnl = jsonb_build_object('value', ROUND(v_avg_pnl, 2)),
      wins = jsonb_build_object('value', v_wins),
      losses = jsonb_build_object('value', v_losses),
      largest_win = jsonb_build_object('value', ROUND(v_largest_win, 2)),
      largest_loss = jsonb_build_object('value', ROUND(v_largest_loss, 2)),
      daily_pnl = v_daily_pnl,
      weekly_pnl = v_weekly_pnl,
      monthly_pnl = v_monthly_pnl,
      cumulative_pnl = jsonb_build_object('value', ROUND(v_total_pnl, 2)),
      updated_at = NOW();
      
    -- Monthly metrics can be updated similarly if needed
    
    v_result := jsonb_build_object(
      'success', TRUE,
      'action', 'updated',
      'message', 'Analytics updated with latest trade data',
      'trades_count', v_trades_count,
      'total_pnl', v_total_pnl
    );
    
  EXCEPTION WHEN OTHERS THEN
    -- If there's an error during calculation, keep the existing data
    IF v_existing_record IS NOT NULL THEN
      -- Just record the error - don't modify existing data
      v_result := jsonb_build_object(
        'success', FALSE,
        'action', 'preserved',
        'message', 'Error calculating analytics - preserved existing data',
        'error', SQLERRM
      );
    ELSE
      -- No existing data and error during calculation - initialize with zeros
      INSERT INTO analytics (
        user_id,
        metric_name,
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
        jsonb_build_object('value', 0),
        jsonb_build_object('value', 0),
        jsonb_build_object('value', 0),
        jsonb_build_object('value', 0),
        jsonb_build_object('value', 0),
        jsonb_build_object('value', 0),
        jsonb_build_object('value', 0),
        jsonb_build_object('value', 0),
        '{}'::JSONB,
        '{}'::JSONB,
        '{}'::JSONB,
        jsonb_build_object('value', 0),
        NOW(),
        NOW()
      ) ON CONFLICT (user_id, metric_name) DO NOTHING;
      
      v_result := jsonb_build_object(
        'success', FALSE,
        'action', 'initialized',
        'message', 'Error calculating analytics with no existing data - initialized with zeros',
        'error', SQLERRM
      );
    END IF;
  END;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Update tradovate CSV batch processing to use safe analytics updates
CREATE OR REPLACE FUNCTION process_tradovate_csv_batch(p_user_id UUID, p_data JSONB, p_account_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_row JSONB;
  v_result JSONB;
  v_successful_rows INT := 0;
  v_failed_rows INT := 0;
  v_results JSONB[] := '{}';
  v_error TEXT;
  v_analytics_result JSONB;
  v_account_id UUID := p_account_id;
  v_parsed_data JSONB;
BEGIN
  -- Validate the account ID
  IF v_account_id IS NULL THEN
    -- Try to find a default account for the user
    SELECT id INTO v_account_id 
    FROM trading_accounts 
    WHERE user_id = p_user_id 
    ORDER BY COALESCE(is_default, FALSE) DESC, created_at ASC 
    LIMIT 1;
    
    IF v_account_id IS NULL THEN
      -- No account found, create a default account
      INSERT INTO trading_accounts (user_id, name, is_default) 
      VALUES (p_user_id, 'Default Account', TRUE)
      RETURNING id INTO v_account_id;
    END IF;
  END IF;

  -- Convert any non-array input to array format
  IF jsonb_typeof(p_data) = 'array' THEN
    v_parsed_data := p_data;
  ELSE
    -- Try to treat as a single object and wrap in array
    BEGIN
      v_parsed_data := jsonb_build_array(p_data);
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Input data must be a JSON array or object';
    END;
  END IF;

  -- Process each row with robust error handling for each row
  FOR v_row IN SELECT * FROM jsonb_array_elements(v_parsed_data) LOOP
    BEGIN
      -- Process the row with the exact function signature
      v_result := process_tradovate_csv_row(p_user_id, v_row, v_account_id);
      
      -- Add the result to our array
      v_results := v_results || v_result;
      
      -- Increment success or failure counter
      IF (v_result->>'success')::BOOLEAN THEN
        v_successful_rows := v_successful_rows + 1;
      ELSE
        v_failed_rows := v_failed_rows + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- On exception, record the error but continue processing other rows
      v_error := SQLERRM;
      v_results := v_results || jsonb_build_object(
        'success', FALSE,
        'error', 'Error processing row: ' || v_error,
        'data', v_row
      );
      v_failed_rows := v_failed_rows + 1;
    END;
  END LOOP;
  
  -- Use our safe update function for analytics
  v_analytics_result := update_analytics_safely(p_user_id);
  
  -- Return the summary
  RETURN jsonb_build_object(
    'success', v_successful_rows > 0,
    'processed', v_successful_rows,
    'failed', v_failed_rows,
    'total', v_successful_rows + v_failed_rows,
    'analytics', v_analytics_result,
    'results', to_jsonb(v_results)
  );
EXCEPTION WHEN OTHERS THEN
  v_error := SQLERRM;
  
  -- Even if batch processing fails, try to safely update analytics
  BEGIN
    v_analytics_result := update_analytics_safely(p_user_id);
  EXCEPTION WHEN OTHERS THEN
    v_analytics_result := jsonb_build_object(
      'success', FALSE,
      'action', 'failed',
      'error', 'Analytics update failed: ' || SQLERRM
    );
  END;
  
  RETURN jsonb_build_object(
    'success', FALSE,
    'error', 'Error processing batch: ' || v_error,
    'processed', v_successful_rows,
    'failed', v_failed_rows,
    'analytics', v_analytics_result
  );
END;
$$ LANGUAGE plpgsql;

-- Create a trigger function that uses the safe update function
CREATE OR REPLACE FUNCTION update_analytics_safely_on_trade_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Update analytics for the affected user
  IF TG_OP = 'DELETE' THEN
    IF OLD.user_id IS NOT NULL THEN
      PERFORM update_analytics_safely(OLD.user_id);
    END IF;
  ELSE
    IF NEW.user_id IS NOT NULL THEN
      PERFORM update_analytics_safely(NEW.user_id);
    END IF;
  END IF;
  
  RETURN NULL; -- for AFTER triggers
END;
$$ LANGUAGE plpgsql;

-- Update existing trigger to use the safe update function
DROP TRIGGER IF EXISTS update_analytics_on_trade_change ON trades;

-- Create new trigger using safe update function
CREATE TRIGGER update_analytics_safely_on_trade_change
AFTER INSERT OR UPDATE OR DELETE ON trades
FOR EACH ROW
EXECUTE FUNCTION update_analytics_safely_on_trade_change();
