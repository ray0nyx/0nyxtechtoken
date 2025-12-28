-- Migration to add the missing calculate_user_analytics function
-- Description: This function is required by process_tradovate_csv_batch

-- First, check if the function already exists and drop it if it does
DO $$
BEGIN
    DROP FUNCTION IF EXISTS calculate_user_analytics(UUID);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error dropping calculate_user_analytics: %', SQLERRM;
END $$;

-- Create the calculate_user_analytics function
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
    
    -- Handle NULL values
    v_daily_pnl := COALESCE(v_daily_pnl, '{}'::JSONB);
    v_weekly_pnl := COALESCE(v_weekly_pnl, '{}'::JSONB);
    v_monthly_pnl := COALESCE(v_monthly_pnl, '{}'::JSONB);
    
    -- Delete existing analytics record for this user
    DELETE FROM analytics WHERE user_id = p_user_id;
    
    -- Insert new analytics data with proper JSONB formatting
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
        created_at,
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
        v_daily_pnl,
        v_weekly_pnl,
        v_monthly_pnl,
        jsonb_build_object('value', ROUND(v_total_pnl, 2)),
        NOW(),
        NOW()
    );

    RAISE NOTICE 'Analytics calculated for user %', p_user_id;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error calculating analytics for user %: %', p_user_id, SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION calculate_user_analytics(UUID) TO authenticated; 