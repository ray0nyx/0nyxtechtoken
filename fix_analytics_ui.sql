-- Update the get_enhanced_analytics_for_user function to ensure it formats data correctly for UI display
CREATE OR REPLACE FUNCTION get_enhanced_analytics_for_user(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_analytics RECORD;
    v_daily_pnl JSONB;
    v_weekly_pnl JSONB;
    v_monthly_pnl JSONB;
BEGIN
    -- Try to get analytics from the analytics table first
    SELECT * INTO v_analytics
    FROM analytics
    WHERE user_id = p_user_id
    LIMIT 1;

    -- If analytics exists, use it
    IF FOUND THEN
        -- Extract values from JSONB fields
        v_result := jsonb_build_object(
            'totalTrades', COALESCE((v_analytics.total_trades->>'value')::NUMERIC, 0),
            'winRate', COALESCE((v_analytics.win_rate->>'value')::NUMERIC, 0),
            'totalPnl', COALESCE((v_analytics.total_pnl->>'value')::NUMERIC, 0),
            'averagePnl', COALESCE((v_analytics.average_pnl->>'value')::NUMERIC, 0),
            'winningTrades', COALESCE((v_analytics.wins->>'value')::NUMERIC, 0),
            'losingTrades', COALESCE((v_analytics.losses->>'value')::NUMERIC, 0),
            'largestWin', COALESCE((v_analytics.largest_win->>'value')::NUMERIC, 0),
            'largestLoss', COALESCE((v_analytics.largest_loss->>'value')::NUMERIC, 0),
            'dailyPnl', COALESCE(v_analytics.daily_pnl, '{}'::JSONB),
            'weeklyPnl', COALESCE(v_analytics.weekly_pnl, '{}'::JSONB),
            'monthlyPnl', COALESCE(v_analytics.monthly_pnl, '{}'::JSONB),
            'cumulativePnl', COALESCE((v_analytics.cumulative_pnl->>'value')::NUMERIC, 0)
        );
    ELSE
        -- If no analytics, calculate from trades
        SELECT
            COUNT(*) as total_trades,
            COALESCE(SUM(pnl), 0) as total_pnl,
            COALESCE(COUNT(*) FILTER (WHERE pnl > 0), 0) as wins,
            COALESCE(COUNT(*) FILTER (WHERE pnl < 0), 0) as losses,
            CASE 
                WHEN COUNT(*) > 0 THEN 
                    ROUND((COUNT(*) FILTER (WHERE pnl > 0)::DECIMAL / COUNT(*)) * 100, 2)
                ELSE 0 
            END as win_rate,
            CASE 
                WHEN COUNT(*) > 0 THEN 
                    ROUND(SUM(pnl) / COUNT(*), 2)
                ELSE 0 
            END as average_pnl,
            COALESCE(MAX(pnl) FILTER (WHERE pnl > 0), 0) as largest_win,
            COALESCE(MIN(pnl) FILTER (WHERE pnl < 0), 0) as largest_loss
        INTO v_analytics
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

        -- Format the analytics data
        v_result := jsonb_build_object(
            'totalTrades', COALESCE(v_analytics.total_trades, 0),
            'winRate', COALESCE(v_analytics.win_rate, 0),
            'totalPnl', COALESCE(v_analytics.total_pnl, 0),
            'averagePnl', COALESCE(v_analytics.average_pnl, 0),
            'winningTrades', COALESCE(v_analytics.wins, 0),
            'losingTrades', COALESCE(v_analytics.losses, 0),
            'largestWin', COALESCE(v_analytics.largest_win, 0),
            'largestLoss', COALESCE(v_analytics.largest_loss, 0),
            'dailyPnl', COALESCE(v_daily_pnl, '{}'::JSONB),
            'weeklyPnl', COALESCE(v_weekly_pnl, '{}'::JSONB),
            'monthlyPnl', COALESCE(v_monthly_pnl, '{}'::JSONB),
            'cumulativePnl', COALESCE(v_analytics.total_pnl, 0)
        );
    END IF;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_enhanced_analytics_for_user(UUID) TO authenticated;

-- Update the calculate_user_analytics function
CREATE OR REPLACE FUNCTION calculate_user_analytics(p_user_id UUID)
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
  
  -- Delete existing analytics for this user
  DELETE FROM analytics WHERE user_id = p_user_id;
  
  -- Insert new analytics with JSONB values
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
GRANT EXECUTE ON FUNCTION calculate_user_analytics(UUID) TO authenticated;

-- Update all analytics one last time
SELECT update_all_user_analytics(); 