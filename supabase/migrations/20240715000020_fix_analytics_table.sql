-- Check if the migration has already been applied
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM migration_log 
    WHERE migration_name = '20240715000020_fix_analytics_table'
  ) THEN
    -- Log the migration
    INSERT INTO migration_log (migration_name, applied_at)
    VALUES ('20240715000020_fix_analytics_table', NOW());

    -- Drop existing triggers and functions
    DROP TRIGGER IF EXISTS update_analytics_on_trade_change ON trades;
    DROP FUNCTION IF EXISTS update_analytics_on_trade_change CASCADE;
    DROP FUNCTION IF EXISTS update_analytics_for_user CASCADE;
    DROP FUNCTION IF EXISTS calculate_user_analytics CASCADE;
    DROP FUNCTION IF EXISTS recalculate_all_analytics CASCADE;

    -- Clean up analytics table
    DELETE FROM analytics;

    -- Drop unnecessary columns
    ALTER TABLE analytics
    DROP COLUMN IF EXISTS metric_name,
    DROP COLUMN IF EXISTS metric_value,
    DROP COLUMN IF EXISTS date,
    DROP COLUMN IF EXISTS trade_id,
    DROP COLUMN IF EXISTS some_other_column,
    DROP COLUMN IF EXISTS net_pnl;

    -- Add unique constraint on user_id
    ALTER TABLE analytics
    DROP CONSTRAINT IF EXISTS analytics_user_id_key;
    
    ALTER TABLE analytics
    ADD CONSTRAINT analytics_user_id_key UNIQUE (user_id);

    -- Create function to calculate user analytics
    CREATE OR REPLACE FUNCTION calculate_user_analytics(user_id_param UUID)
    RETURNS TABLE (
        total_trades INTEGER,
        total_pnl NUMERIC,
        win_rate NUMERIC,
        average_pnl NUMERIC,
        wins INTEGER,
        losses INTEGER,
        largest_win NUMERIC,
        largest_loss NUMERIC,
        daily_pnl JSONB,
        weekly_pnl JSONB,
        monthly_pnl JSONB,
        cumulative_pnl NUMERIC
    ) AS $$
    BEGIN
        RETURN QUERY
        WITH trade_stats AS (
            SELECT
                COUNT(*) AS total_trades,
                COALESCE(SUM(pnl), 0)::NUMERIC AS total_pnl,
                COUNT(*) FILTER (WHERE pnl > 0) AS wins,
                COUNT(*) FILTER (WHERE pnl < 0) AS losses,
                COALESCE(MAX(CASE WHEN pnl > 0 THEN pnl ELSE 0 END), 0)::NUMERIC AS largest_win,
                COALESCE(MIN(CASE WHEN pnl < 0 THEN pnl ELSE 0 END), 0)::NUMERIC AS largest_loss,
                COALESCE(
                    jsonb_object_agg(
                        TO_CHAR(DATE(entry_date), 'YYYY-MM-DD'),
                        ROUND(SUM(pnl)::NUMERIC, 2)
                    ) FILTER (WHERE entry_date IS NOT NULL),
                    '{}'::JSONB
                ) AS daily_pnl,
                COALESCE(
                    jsonb_object_agg(
                        TO_CHAR(DATE_TRUNC('week', entry_date), 'YYYY-MM-DD'),
                        ROUND(SUM(pnl)::NUMERIC, 2)
                    ) FILTER (WHERE entry_date IS NOT NULL),
                    '{}'::JSONB
                ) AS weekly_pnl,
                COALESCE(
                    jsonb_object_agg(
                        TO_CHAR(DATE_TRUNC('month', entry_date), 'YYYY-MM'),
                        ROUND(SUM(pnl)::NUMERIC, 2)
                    ) FILTER (WHERE entry_date IS NOT NULL),
                    '{}'::JSONB
                ) AS monthly_pnl,
                COALESCE(SUM(pnl), 0)::NUMERIC AS cumulative_pnl
            FROM trades
            WHERE user_id = user_id_param
        )
        SELECT
            total_trades,
            ROUND(total_pnl, 2)::NUMERIC,
            CASE 
                WHEN total_trades > 0 THEN 
                    ROUND((wins::NUMERIC / total_trades * 100)::NUMERIC, 2)
                ELSE 0 
            END::NUMERIC AS win_rate,
            CASE 
                WHEN total_trades > 0 THEN 
                    ROUND((total_pnl / total_trades)::NUMERIC, 2)
                ELSE 0 
            END::NUMERIC AS average_pnl,
            wins,
            losses,
            ROUND(largest_win, 2)::NUMERIC,
            ROUND(largest_loss, 2)::NUMERIC,
            daily_pnl,
            weekly_pnl,
            monthly_pnl,
            ROUND(cumulative_pnl, 2)::NUMERIC
        FROM trade_stats;
    END;
    $$ LANGUAGE plpgsql;

    -- Create function to update analytics for a user
    CREATE OR REPLACE FUNCTION update_analytics_for_user(user_id_param UUID)
    RETURNS VOID AS $$
    DECLARE
        analytics_data RECORD;
    BEGIN
        SELECT * INTO analytics_data FROM calculate_user_analytics(user_id_param);
        
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
        )
        VALUES (
            user_id_param,
            analytics_data.total_trades,
            analytics_data.total_pnl,
            analytics_data.win_rate,
            analytics_data.average_pnl,
            analytics_data.wins,
            analytics_data.losses,
            analytics_data.largest_win,
            analytics_data.largest_loss,
            analytics_data.daily_pnl,
            analytics_data.weekly_pnl,
            analytics_data.monthly_pnl,
            analytics_data.cumulative_pnl,
            NOW(),
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
            updated_at = NOW();
    END;
    $$ LANGUAGE plpgsql;

    -- Create trigger function to update analytics when trades change
    CREATE OR REPLACE FUNCTION update_analytics_on_trade_change()
    RETURNS TRIGGER AS $$
    BEGIN
        IF TG_OP = 'INSERT' THEN
            PERFORM update_analytics_for_user(NEW.user_id);
        ELSIF TG_OP = 'UPDATE' THEN
            IF OLD.user_id != NEW.user_id THEN
                PERFORM update_analytics_for_user(OLD.user_id);
            END IF;
            PERFORM update_analytics_for_user(NEW.user_id);
        ELSIF TG_OP = 'DELETE' THEN
            PERFORM update_analytics_for_user(OLD.user_id);
        END IF;
        RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;

    -- Create trigger
    CREATE TRIGGER update_analytics_on_trade_change
    AFTER INSERT OR UPDATE OR DELETE ON trades
    FOR EACH ROW
    EXECUTE FUNCTION update_analytics_on_trade_change();

    -- Create function to recalculate all analytics
    CREATE OR REPLACE FUNCTION recalculate_all_analytics()
    RETURNS VOID AS $$
    DECLARE
        user_record RECORD;
    BEGIN
        FOR user_record IN SELECT DISTINCT user_id FROM trades
        LOOP
            PERFORM update_analytics_for_user(user_record.user_id);
        END LOOP;
    END;
    $$ LANGUAGE plpgsql;

    -- Recalculate analytics for all users
    SELECT recalculate_all_analytics();

    RAISE NOTICE 'Migration 20240715000020_fix_analytics_table has been applied';
  END IF;
END $$; 