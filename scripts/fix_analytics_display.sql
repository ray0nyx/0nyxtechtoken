/*
 * FIX ANALYTICS DISPLAY - SQL SCRIPT
 * =================================
 *
 * Purpose:
 * This script fixes the analytics display issue where JSONB objects with a "value" key were causing 
 * the created_at date to be displayed alongside numeric metrics in the UI.
 *
 * The script:
 * 1. Checks column types in the analytics table
 * 2. Updates the function that retrieves analytics data to return direct values
 * 3. Updates existing analytics records to extract numeric values from JSONB objects
 * 4. Refreshes all user analytics to ensure consistency
 *
 * How to execute:
 * 1. Copy the entire content of this file
 * 2. In Supabase, open the SQL Editor
 * 3. Paste the content and run the script
 * 4. Check the logs for any errors that may occur
 * 
 * Note: This script is safe to run multiple times.
 */

-- Fix for analytics display issue
-- This script updates the user analytics function to return direct values instead of JSON objects with value/date

-- Add safety check for column types
DO $$
DECLARE
    v_numeric_columns TEXT[] := ARRAY[
        'total_trades', 'total_pnl', 'win_rate', 'average_pnl', 
        'wins', 'losses', 'largest_win', 'largest_loss'
    ];
    v_col TEXT;
    v_data_type TEXT;
BEGIN
    -- Check each column and add a conversion step if it's not a numeric type
    FOREACH v_col IN ARRAY v_numeric_columns LOOP
        SELECT data_type INTO v_data_type
        FROM information_schema.columns
        WHERE table_name = 'analytics' AND column_name = v_col;
        
        IF v_data_type = 'jsonb' THEN
            -- Column is JSONB, add an ALTER TABLE command to support fixing
            RAISE NOTICE 'Column % is JSONB, script will extract values from JSONB objects', v_col;
        END IF;
    END LOOP;
END $$;

-- First, check the current function that populates analytics
DROP FUNCTION IF EXISTS get_analytics_for_user;

-- Create an updated version of the function to get analytics for the UI
CREATE OR REPLACE FUNCTION get_analytics_for_user(p_user_id UUID)
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
        -- Format the analytics data - extract direct values from JSONB fields
        v_result := jsonb_build_object(
            'totalTrades', 
                CASE 
                    WHEN jsonb_typeof(v_analytics.total_trades) = 'object' THEN 
                        (v_analytics.total_trades->>'value')::NUMERIC
                    ELSE 
                        COALESCE(v_analytics.total_trades, 0)
                END,
            'winRate', 
                CASE 
                    WHEN jsonb_typeof(v_analytics.win_rate) = 'object' THEN 
                        (v_analytics.win_rate->>'value')::NUMERIC
                    ELSE 
                        COALESCE(v_analytics.win_rate, 0)
                END,
            'totalPnl', 
                CASE 
                    WHEN jsonb_typeof(v_analytics.total_pnl) = 'object' THEN 
                        (v_analytics.total_pnl->>'value')::NUMERIC
                    ELSE 
                        COALESCE(v_analytics.total_pnl, 0)
                END,
            'averagePnl', 
                CASE 
                    WHEN jsonb_typeof(v_analytics.average_pnl) = 'object' THEN 
                        (v_analytics.average_pnl->>'value')::NUMERIC
                    ELSE 
                        COALESCE(v_analytics.average_pnl, 0)
                END,
            'winningTrades', 
                CASE 
                    WHEN jsonb_typeof(v_analytics.wins) = 'object' THEN 
                        (v_analytics.wins->>'value')::NUMERIC
                    ELSE 
                        COALESCE(v_analytics.wins, 0)
                END,
            'losingTrades', 
                CASE 
                    WHEN jsonb_typeof(v_analytics.losses) = 'object' THEN 
                        (v_analytics.losses->>'value')::NUMERIC
                    ELSE 
                        COALESCE(v_analytics.losses, 0)
                END,
            'largestWin', 
                CASE 
                    WHEN jsonb_typeof(v_analytics.largest_win) = 'object' THEN 
                        (v_analytics.largest_win->>'value')::NUMERIC
                    ELSE 
                        COALESCE(v_analytics.largest_win, 0)
                END,
            'largestLoss', 
                CASE 
                    WHEN jsonb_typeof(v_analytics.largest_loss) = 'object' THEN 
                        (v_analytics.largest_loss->>'value')::NUMERIC
                    ELSE 
                        COALESCE(v_analytics.largest_loss, 0)
                END,
            'dailyPnl', COALESCE(v_analytics.daily_pnl, '{}'::JSONB),
            'weeklyPnl', COALESCE(v_analytics.weekly_pnl, '{}'::JSONB),
            'monthlyPnl', COALESCE(v_analytics.monthly_pnl, '{}'::JSONB),
            'cumulativePnl',
                CASE 
                    WHEN jsonb_typeof(v_analytics.cumulative_pnl) = 'object' THEN 
                        (v_analytics.cumulative_pnl->>'value')::NUMERIC
                    ELSE 
                        COALESCE(v_analytics.cumulative_pnl, 0)
                END
        );
        
        RETURN v_result;
    ELSE
        -- If no analytics in table, calculate from trades
        -- Calculate analytics directly from trades
        v_result := jsonb_build_object(
            'totalTrades', (SELECT COUNT(*) FROM trades WHERE user_id = p_user_id),
            'winRate', (
                SELECT 
                    CASE 
                        WHEN COUNT(*) > 0 THEN 
                            ROUND((COUNT(*) FILTER (WHERE pnl > 0)::DECIMAL / COUNT(*)) * 100, 2)
                        ELSE 0 
                    END 
                FROM trades 
                WHERE user_id = p_user_id
            ),
            'totalPnl', (SELECT COALESCE(SUM(pnl), 0) FROM trades WHERE user_id = p_user_id),
            'averagePnl', (
                SELECT 
                    CASE 
                        WHEN COUNT(*) > 0 THEN 
                            ROUND(SUM(pnl) / COUNT(*), 2)
                        ELSE 0 
                    END
                FROM trades 
                WHERE user_id = p_user_id
            ),
            'winningTrades', (SELECT COUNT(*) FROM trades WHERE user_id = p_user_id AND pnl > 0),
            'losingTrades', (SELECT COUNT(*) FROM trades WHERE user_id = p_user_id AND pnl < 0),
            'largestWin', (
                SELECT COALESCE(MAX(pnl), 0) 
                FROM trades 
                WHERE user_id = p_user_id AND pnl > 0
            ),
            'largestLoss', (
                SELECT COALESCE(MIN(pnl), 0) 
                FROM trades 
                WHERE user_id = p_user_id AND pnl < 0
            )
        );
        
        -- Add PnL records
        v_result := v_result || jsonb_build_object(
            'dailyPnl', (
                SELECT COALESCE(
                    jsonb_object_agg(
                        date::TEXT, 
                        ROUND(SUM(pnl)::NUMERIC, 2)
                    ), 
                    '{}'::JSONB
                )
                FROM trades
                WHERE user_id = p_user_id
                AND date >= CURRENT_DATE - INTERVAL '30 days'
                GROUP BY date
            ),
            'weeklyPnl', (
                SELECT COALESCE(
                    jsonb_object_agg(
                        TO_CHAR(date_trunc('week', date), 'YYYY-MM-DD'),
                        ROUND(SUM(pnl)::NUMERIC, 2)
                    ),
                    '{}'::JSONB
                )
                FROM trades
                WHERE user_id = p_user_id
                AND date >= CURRENT_DATE - INTERVAL '12 weeks'
                GROUP BY date_trunc('week', date)
            ),
            'monthlyPnl', (
                SELECT COALESCE(
                    jsonb_object_agg(
                        TO_CHAR(date_trunc('month', date), 'YYYY-MM'),
                        ROUND(SUM(pnl)::NUMERIC, 2)
                    ),
                    '{}'::JSONB
                )
                FROM trades
                WHERE user_id = p_user_id
                AND date >= CURRENT_DATE - INTERVAL '12 months'
                GROUP BY date_trunc('month', date)
            )
        );
        
        RETURN v_result;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Update calculate_user_analytics function to use direct values instead of JSONB with value key
DROP FUNCTION IF EXISTS calculate_user_analytics(UUID);

CREATE OR REPLACE FUNCTION calculate_user_analytics(p_user_id UUID)
RETURNS JSONB AS $$
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
BEGIN
    -- Check if user already has analytics
    SELECT * INTO v_existing_record
    FROM analytics
    WHERE user_id = p_user_id
    LIMIT 1;
    
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
    
    -- Insert or update analytics with direct values instead of JSONB objects
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
        created_at,
        updated_at
    ) VALUES (
        p_user_id,
        'overall_metrics',
        v_trades_count,
        v_total_pnl,
        v_win_rate,
        v_avg_pnl,
        v_wins,
        v_losses,
        v_largest_win,
        v_largest_loss,
        v_daily_pnl,
        v_weekly_pnl,
        v_monthly_pnl,
        NOW(),
        NOW()
    ) 
    ON CONFLICT (user_id, metric_name) 
    DO UPDATE SET
        total_trades = v_trades_count,
        total_pnl = v_total_pnl,
        win_rate = v_win_rate,
        average_pnl = v_avg_pnl,
        wins = v_wins,
        losses = v_losses,
        largest_win = v_largest_win,
        largest_loss = v_largest_loss,
        daily_pnl = v_daily_pnl,
        weekly_pnl = v_weekly_pnl,
        monthly_pnl = v_monthly_pnl,
        updated_at = NOW();
    
    -- Return success status
    RETURN jsonb_build_object(
        'success', TRUE,
        'action', 'updated',
        'message', 'Analytics updated with direct values',
        'trades_count', v_trades_count,
        'total_pnl', v_total_pnl
    );
END;
$$ LANGUAGE plpgsql;

-- Update existing analytics records to use plain numeric values
DO $$
DECLARE
    r RECORD;
    v_error TEXT;
    v_value NUMERIC;
BEGIN
    FOR r IN SELECT * FROM analytics LOOP
        BEGIN
            -- Update each metric field if it's a JSONB object with a value key
            -- This covers multiple possible formats:
            -- 1. JSONB object with 'value' key: {"value": 123, "created_at": "..."}
            -- 2. JSONB scalar value stored as JSONB: 123 (as JSONB)
            -- 3. Direct numeric value: 123

            -- total_trades
            BEGIN
                IF r.total_trades IS NOT NULL THEN
                    IF jsonb_typeof(r.total_trades) = 'object' AND (r.total_trades->'value') IS NOT NULL THEN
                        -- It's a JSONB object with a value key
                        v_value := (r.total_trades->>'value')::NUMERIC;
                    ELSIF jsonb_typeof(r.total_trades) = 'number' THEN
                        -- It's a JSONB scalar
                        v_value := (r.total_trades)::TEXT::NUMERIC;
                    ELSIF r.total_trades IS NOT NULL THEN
                        -- It might be a direct numeric already
                        v_value := r.total_trades;
                    END IF;
                    
                    UPDATE analytics SET total_trades = v_value WHERE id = r.id;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                v_error := SQLERRM;
                RAISE NOTICE 'Error updating total_trades for analytics id %: %', r.id, v_error;
            END;

            -- total_pnl
            BEGIN
                IF r.total_pnl IS NOT NULL THEN
                    IF jsonb_typeof(r.total_pnl) = 'object' AND (r.total_pnl->'value') IS NOT NULL THEN
                        v_value := (r.total_pnl->>'value')::NUMERIC;
                    ELSIF jsonb_typeof(r.total_pnl) = 'number' THEN
                        v_value := (r.total_pnl)::TEXT::NUMERIC;
                    ELSIF r.total_pnl IS NOT NULL THEN
                        v_value := r.total_pnl;
                    END IF;
                    
                    UPDATE analytics SET total_pnl = v_value WHERE id = r.id;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                v_error := SQLERRM;
                RAISE NOTICE 'Error updating total_pnl for analytics id %: %', r.id, v_error;
            END;

            -- win_rate
            BEGIN
                IF r.win_rate IS NOT NULL THEN
                    IF jsonb_typeof(r.win_rate) = 'object' AND (r.win_rate->'value') IS NOT NULL THEN
                        v_value := (r.win_rate->>'value')::NUMERIC;
                    ELSIF jsonb_typeof(r.win_rate) = 'number' THEN
                        v_value := (r.win_rate)::TEXT::NUMERIC;
                    ELSIF r.win_rate IS NOT NULL THEN
                        v_value := r.win_rate;
                    END IF;
                    
                    UPDATE analytics SET win_rate = v_value WHERE id = r.id;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                v_error := SQLERRM;
                RAISE NOTICE 'Error updating win_rate for analytics id %: %', r.id, v_error;
            END;

            -- average_pnl
            BEGIN
                IF r.average_pnl IS NOT NULL THEN
                    IF jsonb_typeof(r.average_pnl) = 'object' AND (r.average_pnl->'value') IS NOT NULL THEN
                        v_value := (r.average_pnl->>'value')::NUMERIC;
                    ELSIF jsonb_typeof(r.average_pnl) = 'number' THEN
                        v_value := (r.average_pnl)::TEXT::NUMERIC;
                    ELSIF r.average_pnl IS NOT NULL THEN
                        v_value := r.average_pnl;
                    END IF;
                    
                    UPDATE analytics SET average_pnl = v_value WHERE id = r.id;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                v_error := SQLERRM;
                RAISE NOTICE 'Error updating average_pnl for analytics id %: %', r.id, v_error;
            END;

            -- wins
            BEGIN
                IF r.wins IS NOT NULL THEN
                    IF jsonb_typeof(r.wins) = 'object' AND (r.wins->'value') IS NOT NULL THEN
                        v_value := (r.wins->>'value')::NUMERIC;
                    ELSIF jsonb_typeof(r.wins) = 'number' THEN
                        v_value := (r.wins)::TEXT::NUMERIC;
                    ELSIF r.wins IS NOT NULL THEN
                        v_value := r.wins;
                    END IF;
                    
                    UPDATE analytics SET wins = v_value WHERE id = r.id;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                v_error := SQLERRM;
                RAISE NOTICE 'Error updating wins for analytics id %: %', r.id, v_error;
            END;

            -- losses
            BEGIN
                IF r.losses IS NOT NULL THEN
                    IF jsonb_typeof(r.losses) = 'object' AND (r.losses->'value') IS NOT NULL THEN
                        v_value := (r.losses->>'value')::NUMERIC;
                    ELSIF jsonb_typeof(r.losses) = 'number' THEN
                        v_value := (r.losses)::TEXT::NUMERIC;
                    ELSIF r.losses IS NOT NULL THEN
                        v_value := r.losses;
                    END IF;
                    
                    UPDATE analytics SET losses = v_value WHERE id = r.id;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                v_error := SQLERRM;
                RAISE NOTICE 'Error updating losses for analytics id %: %', r.id, v_error;
            END;

            -- largest_win
            BEGIN
                IF r.largest_win IS NOT NULL THEN
                    IF jsonb_typeof(r.largest_win) = 'object' AND (r.largest_win->'value') IS NOT NULL THEN
                        v_value := (r.largest_win->>'value')::NUMERIC;
                    ELSIF jsonb_typeof(r.largest_win) = 'number' THEN
                        v_value := (r.largest_win)::TEXT::NUMERIC;
                    ELSIF r.largest_win IS NOT NULL THEN
                        v_value := r.largest_win;
                    END IF;
                    
                    UPDATE analytics SET largest_win = v_value WHERE id = r.id;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                v_error := SQLERRM;
                RAISE NOTICE 'Error updating largest_win for analytics id %: %', r.id, v_error;
            END;

            -- largest_loss
            BEGIN
                IF r.largest_loss IS NOT NULL THEN
                    IF jsonb_typeof(r.largest_loss) = 'object' AND (r.largest_loss->'value') IS NOT NULL THEN
                        v_value := (r.largest_loss->>'value')::NUMERIC;
                    ELSIF jsonb_typeof(r.largest_loss) = 'number' THEN
                        v_value := (r.largest_loss)::TEXT::NUMERIC;
                    ELSIF r.largest_loss IS NOT NULL THEN
                        v_value := r.largest_loss;
                    END IF;
                    
                    UPDATE analytics SET largest_loss = v_value WHERE id = r.id;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                v_error := SQLERRM;
                RAISE NOTICE 'Error updating largest_loss for analytics id %: %', r.id, v_error;
            END;

            -- cumulative_pnl
            BEGIN
                IF r.cumulative_pnl IS NOT NULL THEN
                    IF jsonb_typeof(r.cumulative_pnl) = 'object' AND (r.cumulative_pnl->'value') IS NOT NULL THEN
                        v_value := (r.cumulative_pnl->>'value')::NUMERIC;
                    ELSIF jsonb_typeof(r.cumulative_pnl) = 'number' THEN
                        v_value := (r.cumulative_pnl)::TEXT::NUMERIC;
                    ELSIF r.cumulative_pnl IS NOT NULL THEN
                        v_value := r.cumulative_pnl;
                    END IF;
                    
                    UPDATE analytics SET cumulative_pnl = v_value WHERE id = r.id;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                v_error := SQLERRM;
                RAISE NOTICE 'Error updating cumulative_pnl for analytics id %: %', r.id, v_error;
            END;
            
            -- Update the updated_at timestamp
            UPDATE analytics SET updated_at = NOW() WHERE id = r.id;

        EXCEPTION WHEN OTHERS THEN
            v_error := SQLERRM;
            RAISE NOTICE 'Error processing analytics id %: %', r.id, v_error;
        END;
    END LOOP;
END $$;

-- Refresh all user analytics using the new function
DO $$
DECLARE
    u RECORD;
    v_error TEXT;
BEGIN
    FOR u IN SELECT DISTINCT user_id FROM analytics LOOP
        BEGIN
            PERFORM calculate_user_analytics(u.user_id);
        EXCEPTION WHEN OTHERS THEN
            -- If there's an error, capture it but continue processing
            GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
            RAISE NOTICE 'Error calculating analytics for user %: %', u.user_id, v_error;
        END;
    END LOOP;
END $$; 