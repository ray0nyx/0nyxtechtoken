-- FIX PNL JSONB STRUCTURE - SQL SCRIPT
-- This script ensures all analytics values are stored in the proper JSONB structure {value: number}

-- Function to fix the JSONB structure for a user's analytics
CREATE OR REPLACE FUNCTION fix_analytics_jsonb_structure(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_has_analytics BOOLEAN;
    v_record RECORD;
    v_error TEXT;
    
    -- Variables for regular analytics metrics
    v_total_trades JSONB;
    v_total_pnl JSONB;
    v_win_rate JSONB;
    v_average_pnl JSONB;
    v_wins JSONB;
    v_losses JSONB;
    v_largest_win JSONB;
    v_largest_loss JSONB;
    
    -- Variables for time periods
    v_daily_pnl JSONB := '{}'::JSONB;
    v_weekly_pnl JSONB := '{}'::JSONB;
    v_monthly_pnl JSONB := '{}'::JSONB;
BEGIN
    -- Check if the user has analytics
    SELECT EXISTS(SELECT 1 FROM analytics WHERE user_id = p_user_id) INTO v_has_analytics;
    
    -- If user has no analytics record, log and exit
    IF NOT v_has_analytics THEN
        RAISE NOTICE 'User % has no analytics records', p_user_id;
        RETURN;
    END IF;
    
    BEGIN
        -- Fetch current analytics record
        SELECT * INTO v_record FROM analytics WHERE user_id = p_user_id LIMIT 1;
        
        -- Process regular metrics (converting to {"value": X} format)
        v_total_trades := jsonb_build_object('value', COALESCE((v_record.total_trades->>'value')::NUMERIC, 
                                                              (v_record.total_trades)::NUMERIC, 
                                                              0));
        
        v_total_pnl := jsonb_build_object('value', COALESCE((v_record.total_pnl->>'value')::NUMERIC, 
                                                           (v_record.total_pnl)::NUMERIC, 
                                                           0));
        
        v_win_rate := jsonb_build_object('value', COALESCE((v_record.win_rate->>'value')::NUMERIC, 
                                                         (v_record.win_rate)::NUMERIC, 
                                                         0));
        
        v_average_pnl := jsonb_build_object('value', COALESCE((v_record.average_pnl->>'value')::NUMERIC, 
                                                            (v_record.average_pnl)::NUMERIC, 
                                                            0));
        
        v_wins := jsonb_build_object('value', COALESCE((v_record.wins->>'value')::NUMERIC, 
                                                     (v_record.wins)::NUMERIC, 
                                                     0));
        
        v_losses := jsonb_build_object('value', COALESCE((v_record.losses->>'value')::NUMERIC, 
                                                      (v_record.losses)::NUMERIC, 
                                                      0));
        
        v_largest_win := jsonb_build_object('value', COALESCE((v_record.largest_win->>'value')::NUMERIC, 
                                                            (v_record.largest_win)::NUMERIC, 
                                                            0));
        
        v_largest_loss := jsonb_build_object('value', COALESCE((v_record.largest_loss->>'value')::NUMERIC, 
                                                             (v_record.largest_loss)::NUMERIC, 
                                                             0));
        
        -- Process time period PnL metrics (converting each date entry to {"value": X} format)
        -- For daily_pnl
        IF v_record.daily_pnl IS NOT NULL AND jsonb_typeof(v_record.daily_pnl) = 'object' THEN
            SELECT jsonb_object_agg(
                key, 
                jsonb_build_object('value', 
                    CASE 
                        WHEN jsonb_typeof(value) = 'object' AND value ? 'value' THEN 
                            (value->>'value')::NUMERIC
                        ELSE 
                            value::NUMERIC
                    END
                )
            ) INTO v_daily_pnl
            FROM jsonb_each(v_record.daily_pnl);
        ELSE
            v_daily_pnl := '{}'::JSONB;
        END IF;
        
        -- For weekly_pnl
        IF v_record.weekly_pnl IS NOT NULL AND jsonb_typeof(v_record.weekly_pnl) = 'object' THEN
            SELECT jsonb_object_agg(
                key, 
                jsonb_build_object('value', 
                    CASE 
                        WHEN jsonb_typeof(value) = 'object' AND value ? 'value' THEN 
                            (value->>'value')::NUMERIC
                        ELSE 
                            value::NUMERIC
                    END
                )
            ) INTO v_weekly_pnl
            FROM jsonb_each(v_record.weekly_pnl);
        ELSE
            v_weekly_pnl := '{}'::JSONB;
        END IF;
        
        -- For monthly_pnl
        IF v_record.monthly_pnl IS NOT NULL AND jsonb_typeof(v_record.monthly_pnl) = 'object' THEN
            SELECT jsonb_object_agg(
                key, 
                jsonb_build_object('value', 
                    CASE 
                        WHEN jsonb_typeof(value) = 'object' AND value ? 'value' THEN 
                            (value->>'value')::NUMERIC
                        ELSE 
                            value::NUMERIC
                    END
                )
            ) INTO v_monthly_pnl
            FROM jsonb_each(v_record.monthly_pnl);
        ELSE
            v_monthly_pnl := '{}'::JSONB;
        END IF;
        
        -- If daily_pnl is missing or empty, recalculate from trades
        IF v_daily_pnl = '{}'::JSONB OR v_daily_pnl IS NULL THEN
            SELECT jsonb_object_agg(
                date::TEXT, 
                jsonb_build_object('value', ROUND(SUM(pnl)::NUMERIC, 2))
            ) INTO v_daily_pnl
            FROM trades
            WHERE user_id = p_user_id
            GROUP BY date;
            
            v_daily_pnl := COALESCE(v_daily_pnl, '{}'::JSONB);
        END IF;
        
        -- If weekly_pnl is missing or empty, recalculate from trades
        IF v_weekly_pnl = '{}'::JSONB OR v_weekly_pnl IS NULL THEN
            SELECT jsonb_object_agg(
                TO_CHAR(date_trunc('week', date), 'YYYY-MM-DD'),
                jsonb_build_object('value', ROUND(SUM(pnl)::NUMERIC, 2))
            ) INTO v_weekly_pnl
            FROM trades
            WHERE user_id = p_user_id
            GROUP BY date_trunc('week', date);
            
            v_weekly_pnl := COALESCE(v_weekly_pnl, '{}'::JSONB);
        END IF;
        
        -- If monthly_pnl is missing or empty, recalculate from trades
        IF v_monthly_pnl = '{}'::JSONB OR v_monthly_pnl IS NULL THEN
            SELECT jsonb_object_agg(
                TO_CHAR(date_trunc('month', date), 'YYYY-MM'),
                jsonb_build_object('value', ROUND(SUM(pnl)::NUMERIC, 2))
            ) INTO v_monthly_pnl
            FROM trades
            WHERE user_id = p_user_id
            GROUP BY date_trunc('month', date);
            
            v_monthly_pnl := COALESCE(v_monthly_pnl, '{}'::JSONB);
        END IF;
        
        -- Debugging output
        RAISE NOTICE 'User: %, New JSONB structure: total_trades: %, total_pnl: %, win_rate: %', 
            p_user_id, v_total_trades, v_total_pnl, v_win_rate;
        
        -- Update all analytics records for this user
        UPDATE analytics
        SET 
            total_trades = v_total_trades,
            total_pnl = v_total_pnl,
            win_rate = v_win_rate,
            average_pnl = v_average_pnl,
            wins = v_wins,
            losses = v_losses,
            largest_win = v_largest_win,
            largest_loss = v_largest_loss,
            daily_pnl = v_daily_pnl,
            weekly_pnl = v_weekly_pnl,
            monthly_pnl = v_monthly_pnl,
            updated_at = NOW()
        WHERE 
            user_id = p_user_id;
            
        RAISE NOTICE 'Successfully updated analytics JSONB structure for user %', p_user_id;
        
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_error = PG_EXCEPTION_DETAIL;
        RAISE WARNING 'Error fixing JSONB structure for user %: %, %', p_user_id, SQLERRM, v_error;
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
        WHERE user_id IS NOT NULL
    LOOP
        PERFORM fix_analytics_jsonb_structure(v_user_id);
        v_users_processed := v_users_processed + 1;
    END LOOP;
    
    RAISE NOTICE 'JSONB structure fix completed. Processed % users (elapsed time: %)', 
        v_users_processed, clock_timestamp() - v_start_time;
END $$;

-- Verify a sample record after the fix
DO $$
DECLARE
    v_sample RECORD;
BEGIN
    SELECT * INTO v_sample FROM analytics LIMIT 1;
    
    RAISE NOTICE 'Sample record after fix:';
    RAISE NOTICE 'total_trades: %', v_sample.total_trades;
    RAISE NOTICE 'total_pnl: %', v_sample.total_pnl;
    RAISE NOTICE 'win_rate: %', v_sample.win_rate;
    RAISE NOTICE 'daily_pnl sample: %', (SELECT jsonb_pretty(v_sample.daily_pnl));
END $$; 