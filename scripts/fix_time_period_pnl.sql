-- FIX TIME PERIOD PNL - SQL SCRIPT
-- This script addresses NULL values in daily_pnl, weekly_pnl, and monthly_pnl columns in the analytics table

-- Check the format of the date column in trades
DO $$
DECLARE
    v_date_format TEXT;
    v_sample_date DATE;
BEGIN
    -- Get a sample date
    SELECT date INTO v_sample_date FROM trades LIMIT 1;
    
    -- Log the sample date for inspection
    RAISE NOTICE 'Sample date from trades table: %', v_sample_date;
END $$;

-- Function to fix PnL time periods for a user
CREATE OR REPLACE FUNCTION fix_pnl_time_periods(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_daily_pnl JSONB;
    v_weekly_pnl JSONB;
    v_monthly_pnl JSONB;
    v_has_trades BOOLEAN;
    v_has_analytics BOOLEAN;
    v_records_updated INTEGER;
    v_error TEXT;
BEGIN
    -- Check if the user has trades and analytics
    SELECT EXISTS(SELECT 1 FROM trades WHERE user_id = p_user_id) INTO v_has_trades;
    SELECT EXISTS(SELECT 1 FROM analytics WHERE user_id = p_user_id AND metric_name = 'P&L') INTO v_has_analytics;
    
    -- If user has no trades or no analytics record, log and exit
    IF NOT v_has_trades THEN
        RAISE NOTICE 'User % has no trades in the trades table', p_user_id;
        RETURN;
    END IF;
    
    IF NOT v_has_analytics THEN
        RAISE NOTICE 'User % has no P&L record in the analytics table', p_user_id;
        RETURN;
    END IF;
    
    BEGIN
        -- Calculate daily P&L - using the date field from trades table
        SELECT jsonb_object_agg(
            t.date::TEXT, 
            ROUND(SUM(t.pnl)::NUMERIC, 2)
        ) INTO v_daily_pnl
        FROM trades t
        WHERE t.user_id = p_user_id
        GROUP BY t.date;
        
        -- Calculate weekly P&L
        SELECT jsonb_object_agg(
            TO_CHAR(date_trunc('week', t.date), 'YYYY-MM-DD'),
            ROUND(SUM(t.pnl)::NUMERIC, 2)
        ) INTO v_weekly_pnl
        FROM trades t
        WHERE t.user_id = p_user_id
        GROUP BY date_trunc('week', t.date);
        
        -- Calculate monthly P&L
        SELECT jsonb_object_agg(
            TO_CHAR(date_trunc('month', t.date), 'YYYY-MM'),
            ROUND(SUM(t.pnl)::NUMERIC, 2)
        ) INTO v_monthly_pnl
        FROM trades t
        WHERE t.user_id = p_user_id
        GROUP BY date_trunc('month', t.date);

        -- Handle NULL JSONB values - set to empty JSONB object
        v_daily_pnl := COALESCE(v_daily_pnl, '{}'::JSONB);
        v_weekly_pnl := COALESCE(v_weekly_pnl, '{}'::JSONB);
        v_monthly_pnl := COALESCE(v_monthly_pnl, '{}'::JSONB);
        
        -- Debugging output
        RAISE NOTICE 'User: %, Daily PnL: %, Weekly PnL: %, Monthly PnL: %', 
            p_user_id, v_daily_pnl, v_weekly_pnl, v_monthly_pnl;
        
        -- Update all P&L records for this user
        UPDATE analytics a
        SET 
            daily_pnl = v_daily_pnl,
            weekly_pnl = v_weekly_pnl,
            monthly_pnl = v_monthly_pnl,
            updated_at = NOW()
        WHERE 
            a.user_id = p_user_id 
            AND a.metric_name = 'P&L';
            
        GET DIAGNOSTICS v_records_updated = ROW_COUNT;
        RAISE NOTICE 'Updated % P&L records for user %', v_records_updated, p_user_id;
        
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_error = PG_EXCEPTION_DETAIL;
        RAISE WARNING 'Error fixing time period PnL for user %: %, %', p_user_id, SQLERRM, v_error;
    END;
END;
$$ LANGUAGE plpgsql;

-- Run the fix for all users
DO $$
DECLARE
    v_user_id UUID;
    v_users_processed INTEGER := 0;
    v_start_time TIMESTAMPTZ := clock_timestamp();
BEGIN
    -- Process each user with analytics
    FOR v_user_id IN 
        SELECT DISTINCT user_id 
        FROM analytics 
        WHERE metric_name = 'P&L'
        AND user_id IS NOT NULL
    LOOP
        PERFORM fix_pnl_time_periods(v_user_id);
        v_users_processed := v_users_processed + 1;
    END LOOP;
    
    RAISE NOTICE 'Time period PnL fix completed. Processed % users (elapsed time: %)', 
        v_users_processed, clock_timestamp() - v_start_time;
END $$;

-- Verify that the fixes were applied
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM analytics
    WHERE metric_name = 'P&L'
    AND (daily_pnl IS NULL OR weekly_pnl IS NULL OR monthly_pnl IS NULL);
    
    IF v_count > 0 THEN
        RAISE WARNING 'There are still % P&L records with NULL time period values', v_count;
    ELSE
        RAISE NOTICE 'All P&L records now have time period values';
    END IF;
END $$;

-- If there are issues with date formats, try an alternative approach
-- This part is a fallback if the first approach didn't work
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM analytics
    WHERE metric_name = 'P&L'
    AND (daily_pnl IS NULL OR weekly_pnl IS NULL OR monthly_pnl IS NULL);
    
    IF v_count > 0 THEN
        RAISE NOTICE 'Attempting alternative approach for % records with NULL values', v_count;
        
        -- Set empty JSONB objects instead of NULL
        UPDATE analytics
        SET 
            daily_pnl = '{}',
            weekly_pnl = '{}',
            monthly_pnl = '{}'
        WHERE metric_name = 'P&L'
        AND (daily_pnl IS NULL OR weekly_pnl IS NULL OR monthly_pnl IS NULL);
        
        RAISE NOTICE 'Applied fallback fix - set empty JSONB objects';
    END IF;
END $$; 