-- Fix Analytics All Issues Script
-- This script addresses several issues with the analytics table:
-- 1. Ensures all P&L metrics are properly calculated and stored as JSONB objects
-- 2. Creates triggers to keep analytics updated when trades are modified
-- 3. Fixes the get_analytics_for_user function to properly extract values
-- 4. Provides a clean API for frontend access

-- First, let's create improved functions for getting and calculating analytics

-- Drop existing functions to avoid return type issues
DROP FUNCTION IF EXISTS get_analytics_for_user(UUID);
DROP FUNCTION IF EXISTS calculate_user_analytics(UUID);

-- Create function to get analytics for a user with proper value extraction
CREATE OR REPLACE FUNCTION get_analytics_for_user(p_user_id UUID)
RETURNS TABLE (
    metric_name TEXT,
    total_trades NUMERIC,
    total_pnl NUMERIC,
    win_rate NUMERIC,
    average_pnl NUMERIC,
    wins NUMERIC,
    losses NUMERIC,
    largest_win NUMERIC,
    largest_loss NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.metric_name,
        (a.total_trades->>'value')::NUMERIC AS total_trades,
        (a.total_pnl->>'value')::NUMERIC AS total_pnl,
        (a.win_rate->>'value')::NUMERIC AS win_rate,
        (a.average_pnl->>'value')::NUMERIC AS average_pnl,
        (a.wins->>'value')::NUMERIC AS wins,
        (a.losses->>'value')::NUMERIC AS losses,
        (a.largest_win->>'value')::NUMERIC AS largest_win,
        (a.largest_loss->>'value')::NUMERIC AS largest_loss
    FROM 
        analytics a
    WHERE 
        a.user_id = p_user_id
    ORDER BY 
        a.metric_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate analytics for a user
CREATE OR REPLACE FUNCTION calculate_user_analytics(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_total_trades INTEGER;
    v_wins INTEGER;
    v_losses INTEGER;
    v_total_pnl NUMERIC;
    v_win_rate NUMERIC;
    v_average_pnl NUMERIC;
    v_largest_win NUMERIC;
    v_largest_loss NUMERIC;
    v_records_updated INTEGER;
BEGIN
    -- Validate input
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'User ID cannot be NULL';
    END IF;

    -- Calculate metrics
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE pnl > 0),
        COUNT(*) FILTER (WHERE pnl < 0),
        COALESCE(SUM(pnl), 0),
        COALESCE(MAX(pnl) FILTER (WHERE pnl > 0), 0),
        COALESCE(MIN(pnl) FILTER (WHERE pnl < 0), 0)
    INTO 
        v_total_trades,
        v_wins,
        v_losses,
        v_total_pnl,
        v_largest_win,
        v_largest_loss
    FROM trades t
    WHERE t.user_id = p_user_id;
    
    -- Calculate derived metrics
    IF v_total_trades > 0 THEN
        v_win_rate := (v_wins::NUMERIC / v_total_trades::NUMERIC) * 100;
        v_average_pnl := v_total_pnl / v_total_trades;
    ELSE
        v_win_rate := 0;
        v_average_pnl := 0;
    END IF;
    
    -- Check if P&L record exists
    IF EXISTS (SELECT 1 FROM analytics WHERE user_id = p_user_id AND metric_name = 'P&L') THEN
        -- Update existing record with JSONB objects
        UPDATE analytics a
        SET 
            total_trades = jsonb_build_object('value', v_total_trades),
            total_pnl = jsonb_build_object('value', v_total_pnl),
            win_rate = jsonb_build_object('value', v_win_rate),
            average_pnl = jsonb_build_object('value', v_average_pnl),
            wins = jsonb_build_object('value', v_wins),
            losses = jsonb_build_object('value', v_losses),
            largest_win = jsonb_build_object('value', v_largest_win),
            largest_loss = jsonb_build_object('value', v_largest_loss),
            updated_at = NOW()
        WHERE 
            a.user_id = p_user_id 
            AND a.metric_name = 'P&L';
        
        GET DIAGNOSTICS v_records_updated = ROW_COUNT;
        RAISE NOTICE 'Updated % P&L records for user %', v_records_updated, p_user_id;
    ELSE
        -- Insert new record
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
            created_at,
            updated_at
        ) VALUES (
            p_user_id,
            'P&L',
            jsonb_build_object('value', v_total_trades),
            jsonb_build_object('value', v_total_pnl),
            jsonb_build_object('value', v_win_rate),
            jsonb_build_object('value', v_average_pnl),
            jsonb_build_object('value', v_wins),
            jsonb_build_object('value', v_losses),
            jsonb_build_object('value', v_largest_win),
            jsonb_build_object('value', v_largest_loss),
            NOW(),
            NOW()
        );
        RAISE NOTICE 'Created new P&L record for user %', p_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 1: Update existing analytics records to use proper JSONB format
DO $$
DECLARE
    r RECORD;
    v_error TEXT;
    v_users_processed INTEGER := 0;
    v_users_with_trades INTEGER := 0;
    v_total_trades INTEGER;
    v_start_time TIMESTAMPTZ := clock_timestamp();
BEGIN
    -- Get all users with trades
    FOR r IN (
        SELECT DISTINCT user_id 
        FROM trades 
        WHERE user_id IS NOT NULL
        ORDER BY user_id
    ) LOOP
        BEGIN
            v_users_with_trades := v_users_with_trades + 1;
            
            -- Calculate and update analytics for this user
            PERFORM calculate_user_analytics(r.user_id);
            v_users_processed := v_users_processed + 1;
            
            -- Log progress periodically
            IF v_users_processed % 10 = 0 THEN
                RAISE NOTICE 'Processed % users out of % identified (elapsed time: %)', 
                    v_users_processed, v_users_with_trades, clock_timestamp() - v_start_time;
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS v_error = PG_EXCEPTION_DETAIL;
            RAISE WARNING 'Error processing user %: %, %', r.user_id, SQLERRM, v_error;
        END;
    END LOOP;
    
    RAISE NOTICE 'Analytics update complete. Processed % out of % users with trades (elapsed time: %)', 
        v_users_processed, v_users_with_trades, clock_timestamp() - v_start_time;
END $$;

-- Also calculate daily, weekly, and monthly PnL data
DO $$
DECLARE
    r RECORD;
    v_user_id UUID;
    v_daily_pnl JSONB;
    v_weekly_pnl JSONB;
    v_monthly_pnl JSONB;
    v_error TEXT;
BEGIN
    -- Get all users with P&L metrics
    FOR v_user_id IN 
        SELECT DISTINCT user_id 
        FROM analytics 
        WHERE metric_name = 'P&L'
        AND user_id IS NOT NULL
    LOOP
        BEGIN
            -- Calculate daily P&L (last 90 days)
            SELECT 
                jsonb_object_agg(
                    t.date::TEXT, 
                    ROUND(SUM(t.pnl)::NUMERIC, 2)
                )
            INTO v_daily_pnl
            FROM trades t
            WHERE t.user_id = v_user_id
            AND t.date >= CURRENT_DATE - INTERVAL '90 days'
            GROUP BY t.date;
            
            -- Calculate weekly P&L (start of each week for last 12 weeks)
            SELECT 
                jsonb_object_agg(
                    TO_CHAR(date_trunc('week', t.date), 'YYYY-MM-DD'),
                    ROUND(SUM(t.pnl)::NUMERIC, 2)
                )
            INTO v_weekly_pnl
            FROM trades t
            WHERE t.user_id = v_user_id
            AND t.date >= CURRENT_DATE - INTERVAL '12 weeks'
            GROUP BY date_trunc('week', t.date);
            
            -- Calculate monthly P&L (by month for last 12 months)
            SELECT 
                jsonb_object_agg(
                    TO_CHAR(date_trunc('month', t.date), 'YYYY-MM'),
                    ROUND(SUM(t.pnl)::NUMERIC, 2)
                )
            INTO v_monthly_pnl
            FROM trades t
            WHERE t.user_id = v_user_id
            AND t.date >= CURRENT_DATE - INTERVAL '12 months'
            GROUP BY date_trunc('month', t.date);
            
            -- Handle NULL JSONB values
            v_daily_pnl := COALESCE(v_daily_pnl, '{}'::JSONB);
            v_weekly_pnl := COALESCE(v_weekly_pnl, '{}'::JSONB);
            v_monthly_pnl := COALESCE(v_monthly_pnl, '{}'::JSONB);
            
            -- Update P&L records with time period data
            UPDATE analytics a
            SET 
                daily_pnl = v_daily_pnl,
                weekly_pnl = v_weekly_pnl,
                monthly_pnl = v_monthly_pnl,
                updated_at = NOW()
            WHERE 
                a.user_id = v_user_id 
                AND a.metric_name = 'P&L';
                
            RAISE NOTICE 'Updated time period PnL for user %', v_user_id;
        EXCEPTION WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS v_error = PG_EXCEPTION_DETAIL;
            RAISE WARNING 'Error processing PnL time periods for user %: %, %', v_user_id, SQLERRM, v_error;
        END;
    END LOOP;
END $$;

-- Step 2: Create or replace the trigger function for keeping analytics updated
CREATE OR REPLACE FUNCTION update_analytics_on_trade_change()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_daily_pnl JSONB;
    v_weekly_pnl JSONB;
    v_monthly_pnl JSONB;
BEGIN
    -- Determine the affected user_id based on the operation
    IF TG_OP = 'DELETE' THEN
        v_user_id := OLD.user_id;
    ELSE
        v_user_id := NEW.user_id;
    END IF;
    
    -- Skip if user_id is NULL
    IF v_user_id IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Recalculate analytics for the affected user
    PERFORM calculate_user_analytics(v_user_id);
    
    -- Also update time period PnL
    BEGIN
        -- Daily PnL
        SELECT 
            jsonb_object_agg(
                t.date::TEXT, 
                ROUND(SUM(t.pnl)::NUMERIC, 2)
            )
        INTO v_daily_pnl
        FROM trades t
        WHERE t.user_id = v_user_id
        AND t.date >= CURRENT_DATE - INTERVAL '90 days'
        GROUP BY t.date;
        
        -- Weekly PnL
        SELECT 
            jsonb_object_agg(
                TO_CHAR(date_trunc('week', t.date), 'YYYY-MM-DD'),
                ROUND(SUM(t.pnl)::NUMERIC, 2)
            )
        INTO v_weekly_pnl
        FROM trades t
        WHERE t.user_id = v_user_id
        AND t.date >= CURRENT_DATE - INTERVAL '12 weeks'
        GROUP BY date_trunc('week', t.date);
        
        -- Monthly PnL
        SELECT 
            jsonb_object_agg(
                TO_CHAR(date_trunc('month', t.date), 'YYYY-MM'),
                ROUND(SUM(t.pnl)::NUMERIC, 2)
            )
        INTO v_monthly_pnl
        FROM trades t
        WHERE t.user_id = v_user_id
        AND t.date >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY date_trunc('month', t.date);
        
        -- Handle NULL JSONB values
        v_daily_pnl := COALESCE(v_daily_pnl, '{}'::JSONB);
        v_weekly_pnl := COALESCE(v_weekly_pnl, '{}'::JSONB);
        v_monthly_pnl := COALESCE(v_monthly_pnl, '{}'::JSONB);
        
        -- Update time period PnL
        UPDATE analytics a
        SET 
            daily_pnl = v_daily_pnl,
            weekly_pnl = v_weekly_pnl,
            monthly_pnl = v_monthly_pnl,
            updated_at = NOW()
        WHERE 
            a.user_id = v_user_id 
            AND a.metric_name = 'P&L';
    EXCEPTION WHEN OTHERS THEN
        -- Log error but don't fail the trigger
        RAISE NOTICE 'Error updating time period PnL for user %: %', v_user_id, SQLERRM;
    END;
    
    -- Return the appropriate record based on operation
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create triggers for INSERT, UPDATE, and DELETE on trades table

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trades_analytics_trigger ON trades;

-- Create new trigger for INSERT/UPDATE/DELETE
CREATE TRIGGER trades_analytics_trigger
AFTER INSERT OR UPDATE OR DELETE ON trades
FOR EACH ROW
EXECUTE FUNCTION update_analytics_on_trade_change();

-- Final message
DO $$
BEGIN
    RAISE NOTICE 'Analytics fix script completed successfully:';
    RAISE NOTICE '1. All user analytics have been recalculated and stored as JSONB objects.';
    RAISE NOTICE '2. get_analytics_for_user() function has been updated to extract numeric values properly.';
    RAISE NOTICE '3. calculate_user_analytics() function ensures consistent JSONB object storage.';
    RAISE NOTICE '4. Trigger has been created to keep analytics up-to-date with trades changes.';
END $$; 