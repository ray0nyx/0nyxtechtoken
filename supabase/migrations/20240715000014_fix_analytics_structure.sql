-- Migration: 20240715000014_fix_analytics_structure
-- Description: Fix analytics structure and calculations

-- Check if this migration has already been applied
SELECT NOT EXISTS(
    SELECT 1 FROM migration_log WHERE migration_name = '20240715000014_fix_analytics_structure'
) as should_run \gset

\if :should_run
    \echo '# Running migration 20240715000014_fix_analytics_structure'

    -- Log the migration
    INSERT INTO migration_log(migration_name, description) VALUES 
    ('20240715000014_fix_analytics_structure', 'Fix analytics structure and calculations');

    -- Drop existing functions and triggers
    DROP TRIGGER IF EXISTS update_analytics_on_trade_change ON trades;
    DROP FUNCTION IF EXISTS update_analytics_on_trade_change() CASCADE;
    DROP FUNCTION IF EXISTS calculate_user_analytics(UUID) CASCADE;
    DROP FUNCTION IF EXISTS get_enhanced_analytics_for_user(UUID) CASCADE;

    -- Update analytics table to set default values
    ALTER TABLE analytics 
    ALTER COLUMN total_trades SET DEFAULT 0,
    ALTER COLUMN win_rate SET DEFAULT 0,
    ALTER COLUMN total_pnl SET DEFAULT 0,
    ALTER COLUMN average_pnl SET DEFAULT 0,
    ALTER COLUMN wins SET DEFAULT 0,
    ALTER COLUMN losses SET DEFAULT 0,
    ALTER COLUMN largest_win SET DEFAULT 0,
    ALTER COLUMN largest_loss SET DEFAULT 0;

    -- Create or replace the calculate_user_analytics function
    CREATE OR REPLACE FUNCTION calculate_user_analytics(user_id_param UUID)
    RETURNS TABLE (
        total_trades INTEGER,
        win_rate NUMERIC,
        total_pnl NUMERIC,
        average_pnl NUMERIC,
        wins INTEGER,
        losses INTEGER,
        largest_win NUMERIC,
        largest_loss NUMERIC,
        daily_pnl JSONB,
        weekly_pnl JSONB,
        monthly_pnl JSONB,
        cumulative_pnl JSONB
    ) AS $$
    DECLARE
        trade_count INTEGER;
        win_count INTEGER;
        loss_count INTEGER;
        total_profit NUMERIC;
        avg_profit NUMERIC;
        max_win NUMERIC;
        max_loss NUMERIC;
    BEGIN
        -- Calculate basic metrics
        SELECT 
            COUNT(*),
            COUNT(*) FILTER (WHERE pnl > 0),
            COUNT(*) FILTER (WHERE pnl < 0),
            COALESCE(SUM(pnl), 0),
            COALESCE(AVG(pnl), 0),
            COALESCE(MAX(CASE WHEN pnl > 0 THEN pnl ELSE 0 END), 0),
            COALESCE(MIN(CASE WHEN pnl < 0 THEN pnl ELSE 0 END), 0)
        INTO
            trade_count,
            win_count,
            loss_count,
            total_profit,
            avg_profit,
            max_win,
            max_loss
        FROM trades
        WHERE user_id = user_id_param;

        -- Calculate daily P&L
        WITH daily AS (
            SELECT 
                DATE(date_closed) as trade_date,
                SUM(pnl) as daily_pnl
            FROM trades
            WHERE user_id = user_id_param
            GROUP BY DATE(date_closed)
            ORDER BY DATE(date_closed)
        )
        SELECT 
            jsonb_object_agg(trade_date::text, daily_pnl)
        INTO daily_pnl
        FROM daily;

        -- Calculate weekly P&L
        WITH weekly AS (
            SELECT 
                DATE_TRUNC('week', date_closed) as trade_week,
                SUM(pnl) as weekly_pnl
            FROM trades
            WHERE user_id = user_id_param
            GROUP BY DATE_TRUNC('week', date_closed)
            ORDER BY DATE_TRUNC('week', date_closed)
        )
        SELECT 
            jsonb_object_agg(trade_week::text, weekly_pnl)
        INTO weekly_pnl
        FROM weekly;

        -- Calculate monthly P&L
        WITH monthly AS (
            SELECT 
                DATE_TRUNC('month', date_closed) as trade_month,
                SUM(pnl) as monthly_pnl
            FROM trades
            WHERE user_id = user_id_param
            GROUP BY DATE_TRUNC('month', date_closed)
            ORDER BY DATE_TRUNC('month', date_closed)
        )
        SELECT 
            jsonb_object_agg(trade_month::text, monthly_pnl)
        INTO monthly_pnl
        FROM monthly;

        -- Calculate cumulative P&L
        WITH cumulative AS (
            SELECT 
                date_closed::date,
                SUM(pnl) OVER (ORDER BY date_closed) as running_pnl
            FROM trades
            WHERE user_id = user_id_param
            ORDER BY date_closed
        )
        SELECT 
            jsonb_object_agg(date_closed::text, running_pnl)
        INTO cumulative_pnl
        FROM cumulative;

        -- Return the results
        RETURN QUERY SELECT
            trade_count,
            CASE WHEN trade_count > 0 THEN ROUND((win_count::NUMERIC / trade_count::NUMERIC) * 100, 2) ELSE 0 END,
            ROUND(total_profit, 2),
            ROUND(avg_profit, 2),
            win_count,
            loss_count,
            ROUND(max_win, 2),
            ROUND(max_loss, 2),
            COALESCE(daily_pnl, '{}'::jsonb),
            COALESCE(weekly_pnl, '{}'::jsonb),
            COALESCE(monthly_pnl, '{}'::jsonb),
            COALESCE(cumulative_pnl, '{}'::jsonb);
    END;
    $$ LANGUAGE plpgsql;

    -- Create or replace the update analytics trigger function
    CREATE OR REPLACE FUNCTION update_analytics_on_trade_change()
    RETURNS TRIGGER AS $$
    DECLARE
        affected_user_id UUID;
        analytics_data RECORD;
    BEGIN
        -- Determine which user's analytics need to be updated
        IF TG_OP = 'DELETE' THEN
            affected_user_id := OLD.user_id;
        ELSE
            affected_user_id := NEW.user_id;
        END IF;

        -- Calculate new analytics
        SELECT * FROM calculate_user_analytics(affected_user_id) INTO analytics_data;

        -- Update analytics table
        INSERT INTO analytics (
            user_id,
            total_trades,
            win_rate,
            total_pnl,
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
        )
        VALUES (
            affected_user_id,
            analytics_data.total_trades,
            analytics_data.win_rate,
            analytics_data.total_pnl,
            analytics_data.average_pnl,
            analytics_data.wins,
            analytics_data.losses,
            analytics_data.largest_win,
            analytics_data.largest_loss,
            analytics_data.daily_pnl,
            analytics_data.weekly_pnl,
            analytics_data.monthly_pnl,
            analytics_data.cumulative_pnl,
            NOW()
        )
        ON CONFLICT (user_id)
        DO UPDATE SET
            total_trades = EXCLUDED.total_trades,
            win_rate = EXCLUDED.win_rate,
            total_pnl = EXCLUDED.total_pnl,
            average_pnl = EXCLUDED.average_pnl,
            wins = EXCLUDED.wins,
            losses = EXCLUDED.losses,
            largest_win = EXCLUDED.largest_win,
            largest_loss = EXCLUDED.largest_loss,
            daily_pnl = EXCLUDED.daily_pnl,
            weekly_pnl = EXCLUDED.weekly_pnl,
            monthly_pnl = EXCLUDED.monthly_pnl,
            cumulative_pnl = EXCLUDED.cumulative_pnl,
            updated_at = NOW();

        RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;

    -- Create the trigger
    CREATE TRIGGER update_analytics_on_trade_change
    AFTER INSERT OR UPDATE OR DELETE ON trades
    FOR EACH ROW
    EXECUTE FUNCTION update_analytics_on_trade_change();

    -- Create a function to recalculate all analytics
    CREATE OR REPLACE FUNCTION recalculate_all_analytics()
    RETURNS void AS $$
    DECLARE
        user_record RECORD;
        analytics_data RECORD;
    BEGIN
        FOR user_record IN SELECT DISTINCT user_id FROM trades LOOP
            -- Calculate analytics for each user
            SELECT * FROM calculate_user_analytics(user_record.user_id) INTO analytics_data;
            
            -- Update analytics table
            INSERT INTO analytics (
                user_id,
                total_trades,
                win_rate,
                total_pnl,
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
            )
            VALUES (
                user_record.user_id,
                analytics_data.total_trades,
                analytics_data.win_rate,
                analytics_data.total_pnl,
                analytics_data.average_pnl,
                analytics_data.wins,
                analytics_data.losses,
                analytics_data.largest_win,
                analytics_data.largest_loss,
                analytics_data.daily_pnl,
                analytics_data.weekly_pnl,
                analytics_data.monthly_pnl,
                analytics_data.cumulative_pnl,
                NOW()
            )
            ON CONFLICT (user_id)
            DO UPDATE SET
                total_trades = EXCLUDED.total_trades,
                win_rate = EXCLUDED.win_rate,
                total_pnl = EXCLUDED.total_pnl,
                average_pnl = EXCLUDED.average_pnl,
                wins = EXCLUDED.wins,
                losses = EXCLUDED.losses,
                largest_win = EXCLUDED.largest_win,
                largest_loss = EXCLUDED.largest_loss,
                daily_pnl = EXCLUDED.daily_pnl,
                weekly_pnl = EXCLUDED.weekly_pnl,
                monthly_pnl = EXCLUDED.monthly_pnl,
                cumulative_pnl = EXCLUDED.cumulative_pnl,
                updated_at = NOW();
        END LOOP;
    END;
    $$ LANGUAGE plpgsql;

    \echo '# Completed migration 20240715000014_fix_analytics_structure'
\endif 