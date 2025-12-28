/*
 * UPDATE P&L ANALYTICS - SQL SCRIPT
 * =================================
 *
 * Purpose:
 * This script fixes the analytics table entries with metric_name = 'P&L' that currently have NULL values
 * for columns like total_trades, total_pnl, win_rate, etc. It calculates these values from the trades table
 * and updates the analytics records properly.
 *
 * The script:
 * 1. For each unique user with 'P&L' metrics, it calculates the correct statistics
 * 2. Updates the existing P&L records with the calculated values
 * 3. Outputs a report of updated records
 * 
 * Note: The total_trades value is calculated directly from the trades table, ensuring
 * that it accurately reflects the total number of trades for each user at the time
 * this script is run. For future trades, you should set up a trigger to update the
 * analytics table automatically when new trades are added.
 *
 * Important: The analytics table columns are JSONB type, not numeric or integer type.
 * Values must be stored as JSONB objects like {"value": 123} instead of direct numbers.
 */

-- Main function to update P&L analytics entries
CREATE OR REPLACE FUNCTION update_pnl_analytics()
RETURNS TABLE (
    updated_user_id UUID,
    records_updated INTEGER,
    total_trades INTEGER,
    total_pnl NUMERIC,
    win_rate NUMERIC
) AS $$
DECLARE
    v_user_id UUID;
    v_total_trades INTEGER;
    v_wins INTEGER;
    v_losses INTEGER;
    v_win_rate NUMERIC;
    v_total_pnl NUMERIC;
    v_average_pnl NUMERIC;
    v_largest_win NUMERIC;
    v_largest_loss NUMERIC;
    v_records_updated INTEGER;
    v_has_pnl_records BOOLEAN;
    v_error TEXT;
BEGIN
    -- Check if we have any P&L records
    BEGIN
        SELECT EXISTS(SELECT 1 FROM analytics a WHERE a.metric_name = 'P&L') INTO v_has_pnl_records;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
        RAISE NOTICE 'Error checking for P&L records: %', v_error;
        v_has_pnl_records := FALSE;
    END;
    
    -- If no P&L records exist, log a message and return
    IF NOT v_has_pnl_records THEN
        RAISE NOTICE 'No P&L records found in the analytics table. Nothing to update.';
        RETURN QUERY 
        SELECT 
            NULL::UUID,
            0,
            0,
            0.0,
            0.0
        WHERE FALSE; -- Empty result set
        RETURN;
    END IF;

    -- For each user with P&L metrics
    FOR v_user_id IN 
        SELECT DISTINCT a.user_id 
        FROM analytics a
        WHERE a.metric_name = 'P&L'
        AND a.user_id IS NOT NULL -- Skip records with null user_id
    LOOP
        BEGIN
            -- Calculate total trades count from the trades table - this counts ALL trades for this user
            -- This ensures total_trades is calculated from the current state of the trades table
            SELECT COUNT(*) INTO v_total_trades
            FROM trades t
            WHERE t.user_id = v_user_id;
            
            RAISE NOTICE 'User % has % total trades in the trades table', v_user_id, v_total_trades;
            
            -- Calculate wins and losses counts
            SELECT 
                COUNT(*) FILTER (WHERE pnl > 0),
                COUNT(*) FILTER (WHERE pnl < 0),
                COALESCE(SUM(pnl), 0),
                COALESCE(MAX(CASE WHEN pnl > 0 THEN pnl ELSE 0 END), 0),
                COALESCE(MIN(CASE WHEN pnl < 0 THEN pnl ELSE 0 END), 0)
            INTO 
                v_wins,
                v_losses,
                v_total_pnl,
                v_largest_win,
                v_largest_loss
            FROM trades t
            WHERE t.user_id = v_user_id;

            -- Calculate win rate (avoid division by zero)
            IF v_total_trades > 0 THEN
                v_win_rate := (v_wins::NUMERIC / v_total_trades::NUMERIC) * 100;
            ELSE
                v_win_rate := 0;
            END IF;

            -- Calculate average PnL (avoid division by zero)
            IF v_total_trades > 0 THEN
                v_average_pnl := v_total_pnl / v_total_trades::NUMERIC;
            ELSE
                v_average_pnl := 0;
            END IF;

            -- Update all P&L records for this user
            -- IMPORTANT: Use jsonb_build_object to create JSONB values since the columns are JSONB type
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
                a.user_id = v_user_id 
                AND a.metric_name = 'P&L';
                
            -- Count updated records
            GET DIAGNOSTICS v_records_updated = ROW_COUNT;
            
            -- Return the result
            RETURN QUERY 
            SELECT 
                v_user_id,
                v_records_updated,
                v_total_trades,
                v_total_pnl,
                v_win_rate;
                
        EXCEPTION WHEN OTHERS THEN
            -- Log error and continue with next user
            GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
            RAISE NOTICE 'Error processing user %: %', v_user_id, v_error;
            
            -- Return error row
            RETURN QUERY 
            SELECT 
                v_user_id,
                0, -- no records updated
                0, -- no trades counted
                0.0, -- no pnl calculated 
                0.0; -- no win rate calculated
        END;
    END LOOP;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- Execute the function
SELECT * FROM update_pnl_analytics();

-- Also create a daily_pnl and other metrics too
DO $$
DECLARE
    v_user_id UUID;
    v_daily_pnl JSONB;
    v_weekly_pnl JSONB;
    v_monthly_pnl JSONB;
    v_has_pnl_records BOOLEAN;
    v_error TEXT;
BEGIN
    -- Check if we have any P&L records
    BEGIN
        SELECT EXISTS(SELECT 1 FROM analytics a WHERE a.metric_name = 'P&L') INTO v_has_pnl_records;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
        RAISE NOTICE 'Error checking for P&L records: %', v_error;
        v_has_pnl_records := FALSE;
    END;
    
    -- If no P&L records exist, exit early
    IF NOT v_has_pnl_records THEN
        RAISE NOTICE 'No P&L records found for PnL objects update. Nothing to update.';
        RETURN;
    END IF;

    -- For each user with P&L metrics
    FOR v_user_id IN 
        SELECT DISTINCT a.user_id 
        FROM analytics a
        WHERE a.metric_name = 'P&L'
        AND a.user_id IS NOT NULL -- Skip records with null user_id
    LOOP
        BEGIN
            -- Calculate daily P&L
            SELECT 
                jsonb_object_agg(
                    t.date::TEXT, 
                    ROUND(SUM(t.pnl)::NUMERIC, 2)
                )
            INTO v_daily_pnl
            FROM trades t
            WHERE t.user_id = v_user_id
            AND t.date >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY t.date;
            
            -- Calculate weekly P&L
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
            
            -- Calculate monthly P&L
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
            
            -- Update all P&L records for this user with the PNL objects
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
            -- Log error and continue with next user
            GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
            RAISE NOTICE 'Error processing PnL objects for user %: %', v_user_id, v_error;
        END;
    END LOOP;
END $$;

-- Create a trigger to automatically update analytics when trades are modified
CREATE OR REPLACE FUNCTION update_analytics_on_trade_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Try to call update_pnl_analytics for the affected user
    BEGIN
        IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
            -- For inserts and updates, use the NEW user_id
            IF NEW.user_id IS NOT NULL THEN
                -- Update any P&L records for this user
                UPDATE analytics a
                SET 
                    total_trades = jsonb_build_object('value', (SELECT COUNT(*) FROM trades t WHERE t.user_id = NEW.user_id)),
                    total_pnl = jsonb_build_object('value', (SELECT COALESCE(SUM(pnl), 0) FROM trades t WHERE t.user_id = NEW.user_id)),
                    win_rate = jsonb_build_object('value', (
                        SELECT 
                            CASE 
                                WHEN COUNT(*) > 0 THEN 
                                    (COUNT(*) FILTER (WHERE pnl > 0)::NUMERIC / COUNT(*)) * 100
                                ELSE 0 
                            END 
                        FROM trades t 
                        WHERE t.user_id = NEW.user_id
                    )),
                    wins = jsonb_build_object('value', (SELECT COUNT(*) FROM trades t WHERE t.user_id = NEW.user_id AND pnl > 0)),
                    losses = jsonb_build_object('value', (SELECT COUNT(*) FROM trades t WHERE t.user_id = NEW.user_id AND pnl < 0)),
                    updated_at = NOW()
                WHERE a.user_id = NEW.user_id AND a.metric_name = 'P&L';
            END IF;
        END IF;
        
        IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
            -- For deletes and updates, use the OLD user_id
            IF OLD.user_id IS NOT NULL THEN
                -- Update any P&L records for this user
                UPDATE analytics a
                SET 
                    total_trades = jsonb_build_object('value', (SELECT COUNT(*) FROM trades t WHERE t.user_id = OLD.user_id)),
                    total_pnl = jsonb_build_object('value', (SELECT COALESCE(SUM(pnl), 0) FROM trades t WHERE t.user_id = OLD.user_id)),
                    win_rate = jsonb_build_object('value', (
                        SELECT 
                            CASE 
                                WHEN COUNT(*) > 0 THEN 
                                    (COUNT(*) FILTER (WHERE pnl > 0)::NUMERIC / COUNT(*)) * 100
                                ELSE 0 
                            END 
                        FROM trades t 
                        WHERE t.user_id = OLD.user_id
                    )),
                    wins = jsonb_build_object('value', (SELECT COUNT(*) FROM trades t WHERE t.user_id = OLD.user_id AND pnl > 0)),
                    losses = jsonb_build_object('value', (SELECT COUNT(*) FROM trades t WHERE t.user_id = OLD.user_id AND pnl < 0)),
                    updated_at = NOW()
                WHERE a.user_id = OLD.user_id AND a.metric_name = 'P&L';
            END IF;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Log the error but don't fail the transaction
        RAISE NOTICE 'Error updating analytics after trade change: %', SQLERRM;
    END;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it already exists
DROP TRIGGER IF EXISTS trades_update_pnl_analytics ON trades;

-- Create the trigger
CREATE TRIGGER trades_update_pnl_analytics
AFTER INSERT OR UPDATE OR DELETE ON trades
FOR EACH ROW EXECUTE FUNCTION update_analytics_on_trade_change(); 