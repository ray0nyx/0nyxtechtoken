-- Migration to fix nested aggregates error in calculate_period_pnl function
-- Description: Addresses "aggregate function calls cannot be nested" error

-- Fix the calculate_period_pnl function with correct query structure
CREATE OR REPLACE FUNCTION calculate_period_pnl(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_daily_pnl JSONB;
    v_weekly_pnl JSONB;
    v_monthly_pnl JSONB;
    v_overall_exists BOOLEAN;
BEGIN
    -- Calculate daily PnL using subquery to avoid nested aggregates
    -- Format: {"2023-07-19": 100.50, "2023-07-20": -25.75, ...}
    WITH daily_sums AS (
        SELECT 
            date::TEXT AS day_key,
            ROUND(SUM(pnl)::NUMERIC, 2) AS day_pnl
        FROM trades
        WHERE user_id = p_user_id
        GROUP BY date
    )
    SELECT 
        jsonb_object_agg(day_key, day_pnl)
    INTO 
        v_daily_pnl
    FROM 
        daily_sums;
    
    -- Calculate weekly PnL using subquery to avoid nested aggregates
    -- Format: {"2023-W29": 250.25, "2023-W30": -125.00, ...}
    WITH weekly_sums AS (
        SELECT 
            TO_CHAR(date_trunc('week', date), 'YYYY-"W"IW') AS week_key,
            ROUND(SUM(pnl)::NUMERIC, 2) AS week_pnl
        FROM trades
        WHERE user_id = p_user_id
        GROUP BY date_trunc('week', date)
    )
    SELECT 
        jsonb_object_agg(week_key, week_pnl)
    INTO 
        v_weekly_pnl
    FROM 
        weekly_sums;
    
    -- Calculate monthly PnL using subquery to avoid nested aggregates
    -- Format: {"2023-07": 500.75, "2023-08": -200.50, ...}
    WITH monthly_sums AS (
        SELECT 
            TO_CHAR(date_trunc('month', date), 'YYYY-MM') AS month_key,
            ROUND(SUM(pnl)::NUMERIC, 2) AS month_pnl
        FROM trades
        WHERE user_id = p_user_id
        GROUP BY date_trunc('month', date)
    )
    SELECT 
        jsonb_object_agg(month_key, month_pnl)
    INTO 
        v_monthly_pnl
    FROM 
        monthly_sums;
    
    -- Handle NULL values
    v_daily_pnl := COALESCE(v_daily_pnl, '{}'::JSONB);
    v_weekly_pnl := COALESCE(v_weekly_pnl, '{}'::JSONB);
    v_monthly_pnl := COALESCE(v_monthly_pnl, '{}'::JSONB);
    
    -- Check if user has an overall metrics record
    SELECT EXISTS(
        SELECT 1 
        FROM analytics 
        WHERE user_id = p_user_id 
        AND metric_name = 'overall_metrics'
    ) INTO v_overall_exists;
    
    -- Update or insert PnL data
    IF v_overall_exists THEN
        -- Update existing record
        UPDATE analytics
        SET 
            daily_pnl = v_daily_pnl,
            weekly_pnl = v_weekly_pnl,
            monthly_pnl = v_monthly_pnl,
            updated_at = NOW()
        WHERE 
            user_id = p_user_id
            AND metric_name = 'overall_metrics';
            
        RAISE NOTICE 'Updated PnL periods for user %', p_user_id;
    ELSE
        -- Create a new record if one doesn't exist
        INSERT INTO analytics (
            user_id,
            metric_name,
            daily_pnl,
            weekly_pnl,
            monthly_pnl,
            total_trades,
            total_pnl,
            created_at,
            updated_at
        ) VALUES (
            p_user_id,
            'overall_metrics',
            v_daily_pnl,
            v_weekly_pnl,
            v_monthly_pnl,
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            NOW(),
            NOW()
        );
        
        RAISE NOTICE 'Created PnL periods for user %', p_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create a safer version of recalculate_all_users_pnl that handles exceptions
CREATE OR REPLACE FUNCTION recalculate_all_users_pnl()
RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
    v_error TEXT;
BEGIN
    FOR v_user_id IN
        SELECT DISTINCT user_id FROM trades
    LOOP
        BEGIN
            PERFORM calculate_period_pnl(v_user_id);
            RAISE NOTICE 'Successfully calculated PnL for user %', v_user_id;
        EXCEPTION WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
            RAISE WARNING 'Error calculating PnL for user %: %', v_user_id, v_error;
        END;
    END LOOP;
    
    RAISE NOTICE 'Completed PnL recalculation for all users';
END;
$$ LANGUAGE plpgsql;

-- Run the updated function to calculate PnL for all users
SELECT recalculate_all_users_pnl();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION calculate_period_pnl(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_all_users_pnl() TO authenticated; 