-- Check if migration has already been applied
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM migration_log WHERE migration_name = '20240715000017_fix_analytics_duplicates'
  ) THEN
    -- Log migration
    INSERT INTO migration_log (migration_name, applied_at) 
    VALUES ('20240715000017_fix_analytics_duplicates', NOW());

    -- Drop existing triggers and functions
    DROP TRIGGER IF EXISTS update_analytics_on_trade_change ON trades;
    DROP FUNCTION IF EXISTS update_analytics_on_trade_change CASCADE;
    DROP FUNCTION IF EXISTS calculate_user_analytics CASCADE;
    DROP FUNCTION IF EXISTS recalculate_all_analytics CASCADE;

    -- Clean up analytics table
    DELETE FROM analytics;

    -- Alter table to remove unnecessary columns
    ALTER TABLE analytics
    DROP COLUMN IF EXISTS metric_name,
    DROP COLUMN IF EXISTS metric_value,
    DROP COLUMN IF EXISTS date,
    DROP COLUMN IF EXISTS trade_id,
    DROP COLUMN IF EXISTS some_other_column,
    DROP COLUMN IF EXISTS net_pnl;

    -- Add unique constraint on user_id
    ALTER TABLE analytics
    ADD CONSTRAINT analytics_user_id_unique UNIQUE (user_id);

    -- Create function to calculate user analytics
    CREATE OR REPLACE FUNCTION calculate_user_analytics(user_id_param UUID)
    RETURNS TABLE (
        total_trades INTEGER,
        total_pnl DECIMAL,
        win_rate DECIMAL,
        average_pnl DECIMAL,
        wins INTEGER,
        losses INTEGER,
        largest_win DECIMAL,
        largest_loss DECIMAL,
        daily_pnl JSONB,
        weekly_pnl JSONB,
        monthly_pnl JSONB,
        cumulative_pnl DECIMAL
    ) AS $$
    BEGIN
        RETURN QUERY
        WITH trade_stats AS (
            SELECT
                COUNT(*) as total_trades,
                SUM(pnl) as total_pnl,
                COUNT(*) FILTER (WHERE pnl > 0) as wins,
                COUNT(*) FILTER (WHERE pnl < 0) as losses,
                MAX(CASE WHEN pnl > 0 THEN pnl ELSE 0 END) as largest_win,
                MIN(CASE WHEN pnl < 0 THEN pnl ELSE 0 END) as largest_loss,
                COALESCE(
                    jsonb_object_agg(
                        TO_CHAR(date, 'YYYY-MM-DD'),
                        ROUND(CAST(SUM(pnl) as NUMERIC), 2)
                    ) FILTER (WHERE date >= CURRENT_DATE - INTERVAL '30 days'),
                    '{}'::jsonb
                ) as daily_pnl,
                COALESCE(
                    jsonb_object_agg(
                        TO_CHAR(date_trunc('week', date), 'YYYY-MM-DD'),
                        ROUND(CAST(SUM(pnl) as NUMERIC), 2)
                    ) FILTER (WHERE date >= CURRENT_DATE - INTERVAL '12 weeks'),
                    '{}'::jsonb
                ) as weekly_pnl,
                COALESCE(
                    jsonb_object_agg(
                        TO_CHAR(date_trunc('month', date), 'YYYY-MM'),
                        ROUND(CAST(SUM(pnl) as NUMERIC), 2)
                    ) FILTER (WHERE date >= CURRENT_DATE - INTERVAL '12 months'),
                    '{}'::jsonb
                ) as monthly_pnl
            FROM trades
            WHERE user_id = user_id_param
            GROUP BY user_id
        )
        SELECT
            total_trades,
            ROUND(CAST(total_pnl as NUMERIC), 2),
            ROUND(CAST(CASE 
                WHEN total_trades > 0 THEN 
                    (wins::DECIMAL / total_trades) * 100 
                ELSE 0 
            END as NUMERIC), 2),
            ROUND(CAST(CASE 
                WHEN total_trades > 0 THEN 
                    total_pnl / total_trades 
                ELSE 0 
            END as NUMERIC), 2),
            wins,
            losses,
            ROUND(CAST(COALESCE(largest_win, 0) as NUMERIC), 2),
            ROUND(CAST(COALESCE(largest_loss, 0) as NUMERIC), 2),
            daily_pnl,
            weekly_pnl,
            monthly_pnl,
            ROUND(CAST(total_pnl as NUMERIC), 2)
        FROM trade_stats;
    END;
    $$ LANGUAGE plpgsql;

    -- Create function to update analytics for a user
    CREATE OR REPLACE FUNCTION update_analytics_for_user(user_id_param UUID)
    RETURNS void AS $$
    BEGIN
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
            updated_at
        )
        SELECT
            user_id_param,
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
            NOW()
        FROM calculate_user_analytics(user_id_param)
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

    -- Create trigger function to update analytics on trade changes
    CREATE OR REPLACE FUNCTION update_analytics_on_trade_change()
    RETURNS TRIGGER AS $$
    BEGIN
        IF TG_OP = 'INSERT' THEN
            PERFORM update_analytics_for_user(NEW.user_id);
        ELSIF TG_OP = 'UPDATE' THEN
            PERFORM update_analytics_for_user(NEW.user_id);
            IF OLD.user_id != NEW.user_id THEN
                PERFORM update_analytics_for_user(OLD.user_id);
            END IF;
        ELSIF TG_OP = 'DELETE' THEN
            PERFORM update_analytics_for_user(OLD.user_id);
        END IF;
        RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;

    -- Create trigger on trades table
    CREATE TRIGGER update_analytics_on_trade_change
    AFTER INSERT OR UPDATE OR DELETE ON trades
    FOR EACH ROW
    EXECUTE FUNCTION update_analytics_on_trade_change();

    -- Create function to recalculate all analytics
    CREATE OR REPLACE FUNCTION recalculate_all_analytics()
    RETURNS void AS $$
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

    RAISE NOTICE 'Migration 20240715000017_fix_analytics_duplicates has been applied';
  END IF;
END $$; 