-- fix_time_period_pnl_all_users.sql
-- Script to fix NULL values in daily_pnl, weekly_pnl, and monthly_pnl columns for ALL users

-- Create a function to update the time period PnL values for a specific user
CREATE OR REPLACE FUNCTION update_time_period_pnl(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    daily_pnl_json JSONB;
    weekly_pnl_json JSONB;
    monthly_pnl_json JSONB;
    has_trades BOOLEAN;
    has_analytics BOOLEAN;
BEGIN
    -- Check if user has trades
    SELECT EXISTS(SELECT 1 FROM trades WHERE user_id = p_user_id) INTO has_trades;
    
    -- Check if user has analytics records
    SELECT EXISTS(SELECT 1 FROM analytics WHERE user_id = p_user_id AND metric_name = 'P&L') INTO has_analytics;
    
    -- Log status
    RAISE NOTICE 'Processing user ID: %, Has trades: %, Has analytics: %', 
        p_user_id, has_trades, has_analytics;
    
    -- Only proceed if user has both trades and analytics records
    IF has_trades AND has_analytics THEN
        -- Calculate daily PnL metrics
        SELECT jsonb_object_agg(date, jsonb_build_object('value', SUM(pnl)))
        INTO daily_pnl_json
        FROM trades
        WHERE user_id = p_user_id
        GROUP BY date;
        
        -- Calculate weekly PnL metrics (using date_trunc to group by week)
        SELECT jsonb_object_agg(
            to_char(date_trunc('week', date::timestamp), 'YYYY-MM-DD'),
            jsonb_build_object('value', SUM(pnl))
        )
        INTO weekly_pnl_json
        FROM trades
        WHERE user_id = p_user_id
        GROUP BY date_trunc('week', date::timestamp);
        
        -- Calculate monthly PnL metrics (using date_trunc to group by month)
        SELECT jsonb_object_agg(
            to_char(date_trunc('month', date::timestamp), 'YYYY-MM-DD'),
            jsonb_build_object('value', SUM(pnl))
        )
        INTO monthly_pnl_json
        FROM trades
        WHERE user_id = p_user_id
        GROUP BY date_trunc('month', date::timestamp);
        
        -- Update all analytics records for this user with the calculated values
        UPDATE analytics
        SET 
            daily_pnl = COALESCE(daily_pnl_json, '{}'::jsonb),
            weekly_pnl = COALESCE(weekly_pnl_json, '{}'::jsonb),
            monthly_pnl = COALESCE(monthly_pnl_json, '{}'::jsonb),
            updated_at = NOW()
        WHERE 
            user_id = p_user_id 
            AND metric_name = 'P&L';
            
        RAISE NOTICE 'Updated time period PnL for user %', p_user_id;
    ELSE
        RAISE NOTICE 'Skipping user % - missing trades or analytics records', p_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Main execution block
DO $$
DECLARE
    user_record RECORD;
    total_users INT := 0;
    updated_users INT := 0;
BEGIN
    -- Get count of distinct users in analytics
    SELECT COUNT(DISTINCT user_id) INTO total_users FROM analytics WHERE metric_name = 'P&L';
    RAISE NOTICE 'Found % distinct users with analytics records', total_users;
    
    -- Process each user that has NULL values in any of the time period columns
    FOR user_record IN 
        SELECT DISTINCT user_id
        FROM analytics
        WHERE metric_name = 'P&L'
        AND (daily_pnl IS NULL OR weekly_pnl IS NULL OR monthly_pnl IS NULL)
    LOOP
        PERFORM update_time_period_pnl(user_record.user_id);
        updated_users := updated_users + 1;
    END LOOP;
    
    RAISE NOTICE 'Updated % users with NULL time period metrics', updated_users;
    
    -- Also update all other users to ensure everyone has correct data
    FOR user_record IN 
        SELECT DISTINCT user_id
        FROM analytics
        WHERE metric_name = 'P&L'
        AND (daily_pnl IS NOT NULL AND weekly_pnl IS NOT NULL AND monthly_pnl IS NOT NULL)
    LOOP
        PERFORM update_time_period_pnl(user_record.user_id);
        updated_users := updated_users + 1;
    END LOOP;
    
    RAISE NOTICE 'Total users processed: %', updated_users;
    
    -- Verify that there are no longer any NULL values
    PERFORM COUNT(*) 
    FROM analytics 
    WHERE metric_name = 'P&L' 
    AND (daily_pnl IS NULL OR weekly_pnl IS NULL OR monthly_pnl IS NULL);
    
    IF FOUND THEN
        RAISE WARNING 'There are still some NULL time period metrics in the analytics table';
    ELSE
        RAISE NOTICE 'Successfully updated all time period metrics';
    END IF;
END;
$$;

-- Drop the function after use
DROP FUNCTION IF EXISTS update_time_period_pnl(UUID); 