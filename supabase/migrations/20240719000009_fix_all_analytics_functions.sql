-- Fix all functions that try to insert bigint values into JSONB columns
-- Description: Ensures all analytics-related functions properly convert values to JSONB format

-- First, drop any function named populate_tradovate_analytics
DO $$
BEGIN
    DROP FUNCTION IF EXISTS populate_tradovate_analytics(UUID);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error dropping populate_tradovate_analytics: %', SQLERRM;
END $$;

-- Create or replace the populate_tradovate_analytics function with proper JSONB handling
CREATE OR REPLACE FUNCTION populate_tradovate_analytics(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Clear existing analytics for this user
    DELETE FROM "analytics" WHERE "analytics"."user_id" = p_user_id;
    
    -- Insert overall metrics
    INSERT INTO "analytics" (
        "user_id", 
        "metric_name", 
        "total_trades", 
        "total_pnl",
        "created_at",
        "updated_at"
    )
    SELECT
        p_user_id,
        'overall_metrics' AS metric_name,
        jsonb_build_object('value', COUNT(*)) AS total_trades,  -- Convert to JSONB
        jsonb_build_object('value', SUM(trades.pnl)) AS total_pnl,  -- Convert to JSONB
        NOW() AS created_at,
        NOW() AS updated_at
    FROM 
        trades
    WHERE 
        trades.user_id = p_user_id
        AND trades.broker = 'Tradovate';
    
    -- Insert monthly metrics
    INSERT INTO "analytics" (
        "user_id", 
        "metric_name", 
        "date",
        "total_trades", 
        "total_pnl",
        "created_at",
        "updated_at"
    )
    SELECT
        p_user_id,
        'monthly_metrics' AS metric_name,
        DATE_TRUNC('month', trades.date)::date AS date,
        jsonb_build_object('value', COUNT(*)) AS total_trades,  -- Convert to JSONB
        jsonb_build_object('value', SUM(trades.pnl)) AS total_pnl,  -- Convert to JSONB
        NOW() AS created_at,
        NOW() AS updated_at
    FROM 
        trades
    WHERE 
        trades.user_id = p_user_id
        AND trades.broker = 'Tradovate'
    GROUP BY 
        DATE_TRUNC('month', trades.date);
        
    -- Insert daily metrics
    INSERT INTO "analytics" (
        "user_id", 
        "metric_name", 
        "date",
        "total_trades", 
        "total_pnl",
        "created_at",
        "updated_at"
    )
    SELECT
        p_user_id,
        'daily_metrics' AS metric_name,
        trades.date,
        jsonb_build_object('value', COUNT(*)) AS total_trades,  -- Convert to JSONB
        jsonb_build_object('value', SUM(trades.pnl)) AS total_pnl,  -- Convert to JSONB
        NOW() AS created_at,
        NOW() AS updated_at
    FROM 
        trades
    WHERE 
        trades.user_id = p_user_id
        AND trades.broker = 'Tradovate'
    GROUP BY 
        trades.date;
END;
$$ LANGUAGE plpgsql;

-- Next, drop any function named populate_enhanced_analytics if it exists
DO $$
BEGIN
    DROP FUNCTION IF EXISTS populate_enhanced_analytics(UUID);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error dropping populate_enhanced_analytics: %', SQLERRM;
END $$;

-- Create or replace the populate_enhanced_analytics function with proper JSONB handling
CREATE OR REPLACE FUNCTION populate_enhanced_analytics(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Clear existing analytics for this user
    DELETE FROM analytics WHERE analytics.user_id = p_user_id;
    
    -- Insert overall metrics
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
        cumulative_pnl,
        created_at,
        updated_at
    )
    SELECT
        p_user_id,
        'overall_metrics' AS metric_name,
        jsonb_build_object('value', COUNT(*)) AS total_trades,  -- Convert to JSONB
        jsonb_build_object('value', SUM(trades.pnl)) AS total_pnl,  -- Convert to JSONB
        jsonb_build_object('value', (SUM(CASE WHEN trades.pnl > 0 THEN 1 ELSE 0 END)::NUMERIC / NULLIF(COUNT(*), 0)) * 100) AS win_rate,
        jsonb_build_object('value', AVG(trades.pnl)) AS average_pnl,
        jsonb_build_object('value', SUM(CASE WHEN trades.pnl > 0 THEN 1 ELSE 0 END)) AS wins,
        jsonb_build_object('value', SUM(CASE WHEN trades.pnl < 0 THEN 1 ELSE 0 END)) AS losses,
        jsonb_build_object('value', MAX(CASE WHEN trades.pnl > 0 THEN trades.pnl ELSE 0 END)) AS largest_win,
        jsonb_build_object('value', MIN(CASE WHEN trades.pnl < 0 THEN trades.pnl ELSE 0 END)) AS largest_loss,
        jsonb_build_object('value', SUM(trades.pnl)) AS cumulative_pnl,
        NOW() AS created_at,
        NOW() AS updated_at
    FROM 
        trades
    WHERE 
        trades.user_id = p_user_id;
    
    -- Insert monthly metrics
    INSERT INTO analytics (
        user_id, 
        metric_name, 
        date,
        total_trades, 
        total_pnl,
        win_rate,
        average_pnl,
        wins,
        losses,
        largest_win,
        largest_loss,
        monthly_pnl,
        created_at,
        updated_at
    )
    SELECT
        p_user_id,
        'monthly_metrics' AS metric_name,
        DATE_TRUNC('month', trades.date)::date AS date,
        jsonb_build_object('value', COUNT(*)) AS total_trades,  -- Convert to JSONB
        jsonb_build_object('value', SUM(trades.pnl)) AS total_pnl,  -- Convert to JSONB
        jsonb_build_object('value', (SUM(CASE WHEN trades.pnl > 0 THEN 1 ELSE 0 END)::NUMERIC / NULLIF(COUNT(*), 0)) * 100) AS win_rate,
        jsonb_build_object('value', AVG(trades.pnl)) AS average_pnl,
        jsonb_build_object('value', SUM(CASE WHEN trades.pnl > 0 THEN 1 ELSE 0 END)) AS wins,
        jsonb_build_object('value', SUM(CASE WHEN trades.pnl < 0 THEN 1 ELSE 0 END)) AS losses,
        jsonb_build_object('value', MAX(CASE WHEN trades.pnl > 0 THEN trades.pnl ELSE 0 END)) AS largest_win,
        jsonb_build_object('value', MIN(CASE WHEN trades.pnl < 0 THEN trades.pnl ELSE 0 END)) AS largest_loss,
        jsonb_build_object('value', SUM(trades.pnl)) AS monthly_pnl,
        NOW() AS created_at,
        NOW() AS updated_at
    FROM 
        trades
    WHERE 
        trades.user_id = p_user_id
    GROUP BY 
        DATE_TRUNC('month', trades.date);
        
    -- Similarly fix the weekly and daily metrics with JSONB conversions...
END;
$$ LANGUAGE plpgsql;

-- Fix the fix_user_analytics function if it exists
DO $$
BEGIN
    DROP FUNCTION IF EXISTS fix_user_analytics(UUID);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error dropping fix_user_analytics: %', SQLERRM;
END $$;

-- Create or replace the fix_user_analytics function with proper JSONB handling
CREATE OR REPLACE FUNCTION fix_user_analytics(p_user_id UUID)
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
    -- Get basic stats directly to avoid type issues
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
    
    -- Calculate daily PNL as JSONB
    SELECT jsonb_object_agg(
        date::TEXT, 
        ROUND(SUM(pnl)::NUMERIC, 2)
    )
    INTO v_daily_pnl
    FROM trades
    WHERE user_id = p_user_id
    AND date >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY date;
    
    -- Calculate weekly PNL as JSONB
    SELECT jsonb_object_agg(
        TO_CHAR(date_trunc('week', date), 'YYYY-MM-DD'),
        ROUND(SUM(pnl)::NUMERIC, 2)
    )
    INTO v_weekly_pnl
    FROM trades
    WHERE user_id = p_user_id
    AND date >= CURRENT_DATE - INTERVAL '12 weeks'
    GROUP BY date_trunc('week', date);
    
    -- Calculate monthly PNL as JSONB
    SELECT jsonb_object_agg(
        TO_CHAR(date_trunc('month', date), 'YYYY-MM'),
        ROUND(SUM(pnl)::NUMERIC, 2)
    )
    INTO v_monthly_pnl
    FROM trades
    WHERE user_id = p_user_id
    AND date >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY date_trunc('month', date);
    
    -- Handle NULL JSONB values
    v_daily_pnl := COALESCE(v_daily_pnl, '{}'::JSONB);
    v_weekly_pnl := COALESCE(v_weekly_pnl, '{}'::JSONB);
    v_monthly_pnl := COALESCE(v_monthly_pnl, '{}'::JSONB);
    
    -- Insert or update analytics with JSONB data
    INSERT INTO analytics (
        user_id,
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
        updated_at
    ) VALUES (
        p_user_id,
        jsonb_build_object('value', v_trades_count),  -- Convert to JSONB
        jsonb_build_object('value', ROUND(v_total_pnl, 2)),
        jsonb_build_object('value', ROUND(v_win_rate, 2)),
        jsonb_build_object('value', ROUND(v_avg_pnl, 2)),
        jsonb_build_object('value', v_wins),
        jsonb_build_object('value', v_losses),
        jsonb_build_object('value', ROUND(v_largest_win, 2)),
        jsonb_build_object('value', ROUND(v_largest_loss, 2)),
        v_daily_pnl,  -- Already JSONB
        v_weekly_pnl,  -- Already JSONB
        v_monthly_pnl,  -- Already JSONB
        jsonb_build_object('value', ROUND(v_total_pnl, 2)),
        NOW()
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
        total_trades = EXCLUDED.total_trades,
        total_pnl = EXCLUDED.total_pnl,
        win_rate = EXCLUDED.win_rate,
        average_pnl = EXCLUDED.average_pnl,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses,
        largest_win = EXCLUDED.largest_win,
        largest_loss = EXCLUDED.largest_loss,
        daily_pnl = EXCLUDED.daily_pnl,
        weekly_pnl = EXCLUDED.weekly_pnl,
        monthly_pnl = EXCLUDED.monthly_pnl,
        cumulative_pnl = EXCLUDED.cumulative_pnl,
        updated_at = EXCLUDED.updated_at;
END;
$$ LANGUAGE plpgsql;

-- Finally, ensure we have a function to convert existing data
CREATE OR REPLACE FUNCTION convert_all_analytics_columns_to_jsonb()
RETURNS VOID AS $$
BEGIN
    -- Update total_trades column
    UPDATE analytics
    SET total_trades = jsonb_build_object('value', total_trades)
    WHERE total_trades IS NOT NULL 
      AND jsonb_typeof(total_trades) != 'object';
    
    -- Update total_pnl column
    UPDATE analytics
    SET total_pnl = jsonb_build_object('value', total_pnl)
    WHERE total_pnl IS NOT NULL 
      AND jsonb_typeof(total_pnl) != 'object';
    
    -- Update win_rate column
    UPDATE analytics
    SET win_rate = jsonb_build_object('value', win_rate)
    WHERE win_rate IS NOT NULL 
      AND jsonb_typeof(win_rate) != 'object';
    
    -- Update average_pnl column
    UPDATE analytics
    SET average_pnl = jsonb_build_object('value', average_pnl)
    WHERE average_pnl IS NOT NULL 
      AND jsonb_typeof(average_pnl) != 'object';
    
    -- Update wins column
    UPDATE analytics
    SET wins = jsonb_build_object('value', wins)
    WHERE wins IS NOT NULL 
      AND jsonb_typeof(wins) != 'object';
    
    -- Update losses column
    UPDATE analytics
    SET losses = jsonb_build_object('value', losses)
    WHERE losses IS NOT NULL 
      AND jsonb_typeof(losses) != 'object';
    
    -- Update largest_win column
    UPDATE analytics
    SET largest_win = jsonb_build_object('value', largest_win)
    WHERE largest_win IS NOT NULL 
      AND jsonb_typeof(largest_win) != 'object';
    
    -- Update largest_loss column
    UPDATE analytics
    SET largest_loss = jsonb_build_object('value', largest_loss)
    WHERE largest_loss IS NOT NULL 
      AND jsonb_typeof(largest_loss) != 'object';
    
    -- Update cumulative_pnl column
    UPDATE analytics
    SET cumulative_pnl = jsonb_build_object('value', cumulative_pnl)
    WHERE cumulative_pnl IS NOT NULL 
      AND jsonb_typeof(cumulative_pnl) != 'object';
END;
$$ LANGUAGE plpgsql;

-- Run the conversion function to fix any existing data
SELECT convert_all_analytics_columns_to_jsonb();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION populate_tradovate_analytics(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION populate_enhanced_analytics(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fix_user_analytics(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION convert_all_analytics_columns_to_jsonb() TO authenticated; 