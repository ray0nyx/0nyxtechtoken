-- Migration: 20240715000016_fix_analytics_duplicates
-- Description: Clean up duplicate analytics rows and ensure proper data structure

-- Check if migration has already been applied
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM migration_log WHERE migration_name = '20240715000016_fix_analytics_duplicates'
  ) THEN
    -- Log migration
    INSERT INTO migration_log (migration_name, description) 
    VALUES (
      '20240715000016_fix_analytics_duplicates',
      'Clean up duplicate analytics rows and ensure proper data structure'
    );

    -- Drop existing triggers first
    DROP TRIGGER IF EXISTS update_analytics_on_trade_change ON trades;
    DROP FUNCTION IF EXISTS update_analytics_on_trade_change CASCADE;
    DROP FUNCTION IF EXISTS calculate_user_analytics CASCADE;
    DROP FUNCTION IF EXISTS update_analytics_for_user CASCADE;
    DROP FUNCTION IF EXISTS recalculate_all_analytics CASCADE;

    -- Clean up duplicate rows and keep only the latest row per user
    DELETE FROM analytics a1 
    WHERE EXISTS (
      SELECT 1 FROM analytics a2 
      WHERE a2.user_id = a1.user_id 
      AND a2.created_at > a1.created_at
    );

    -- Update analytics table structure
    ALTER TABLE analytics
    ALTER COLUMN total_trades SET DEFAULT 0,
    ALTER COLUMN total_pnl SET DEFAULT 0,
    ALTER COLUMN win_rate SET DEFAULT 0,
    ALTER COLUMN average_pnl SET DEFAULT 0,
    ALTER COLUMN wins SET DEFAULT 0,
    ALTER COLUMN losses SET DEFAULT 0,
    ALTER COLUMN largest_win SET DEFAULT 0,
    ALTER COLUMN largest_loss SET DEFAULT 0,
    ALTER COLUMN daily_pnl SET DEFAULT 0,
    ALTER COLUMN weekly_pnl SET DEFAULT 0,
    ALTER COLUMN monthly_pnl SET DEFAULT 0,
    ALTER COLUMN cumulative_pnl SET DEFAULT 0;

    -- Drop unnecessary columns
    ALTER TABLE analytics 
    DROP COLUMN IF EXISTS metric_name,
    DROP COLUMN IF EXISTS metric_value,
    DROP COLUMN IF EXISTS date,
    DROP COLUMN IF EXISTS trade_id,
    DROP COLUMN IF EXISTS some_other_column,
    DROP COLUMN IF EXISTS net_pnl;

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
      WITH trade_metrics AS (
        SELECT
          COUNT(*) as total_trades,
          COALESCE(SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END), 0) as wins,
          COALESCE(SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END), 0) as losses,
          COALESCE(SUM(pnl), 0) as total_pnl,
          COALESCE(MAX(CASE WHEN pnl > 0 THEN pnl ELSE 0 END), 0) as largest_win,
          COALESCE(MIN(CASE WHEN pnl < 0 THEN pnl ELSE 0 END), 0) as largest_loss,
          COALESCE(
            jsonb_object_agg(
              TO_CHAR(date, 'YYYY-MM-DD'),
              ROUND(CAST(SUM(pnl) as NUMERIC), 2)
            ) FILTER (WHERE date IS NOT NULL),
            '{}'::jsonb
          ) as daily_pnl,
          COALESCE(
            jsonb_object_agg(
              TO_CHAR(date_trunc('week', date), 'YYYY-MM-DD'),
              ROUND(CAST(SUM(pnl) as NUMERIC), 2)
            ) FILTER (WHERE date IS NOT NULL),
            '{}'::jsonb
          ) as weekly_pnl,
          COALESCE(
            jsonb_object_agg(
              TO_CHAR(date_trunc('month', date), 'YYYY-MM'),
              ROUND(CAST(SUM(pnl) as NUMERIC), 2)
            ) FILTER (WHERE date IS NOT NULL),
            '{}'::jsonb
          ) as monthly_pnl
        FROM trades
        WHERE user_id = user_id_param
        GROUP BY user_id
      )
      SELECT
        COALESCE(total_trades, 0)::INTEGER,
        ROUND(COALESCE(total_pnl, 0)::NUMERIC, 2),
        ROUND(CASE 
          WHEN total_trades > 0 THEN 
            (wins::NUMERIC / total_trades::NUMERIC * 100)
          ELSE 0 
        END, 2),
        ROUND(CASE 
          WHEN total_trades > 0 THEN 
            (total_pnl::NUMERIC / total_trades::NUMERIC)
          ELSE 0 
        END, 2),
        COALESCE(wins, 0)::INTEGER,
        COALESCE(losses, 0)::INTEGER,
        ROUND(COALESCE(largest_win, 0)::NUMERIC, 2),
        ROUND(COALESCE(largest_loss, 0)::NUMERIC, 2),
        COALESCE(daily_pnl, '{}'::jsonb),
        COALESCE(weekly_pnl, '{}'::jsonb),
        COALESCE(monthly_pnl, '{}'::jsonb),
        ROUND(COALESCE(total_pnl, 0)::NUMERIC, 2)
      FROM trade_metrics;
    END;
    $$ LANGUAGE plpgsql;

    -- Create function to update analytics for a user
    CREATE OR REPLACE FUNCTION update_analytics_for_user(user_id_param UUID)
    RETURNS VOID AS $$
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
      IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        PERFORM update_analytics_for_user(NEW.user_id);
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
    RETURNS VOID AS $$
    DECLARE
      user_record RECORD;
    BEGIN
      FOR user_record IN SELECT DISTINCT user_id FROM trades LOOP
        PERFORM update_analytics_for_user(user_record.user_id);
      END LOOP;
    END;
    $$ LANGUAGE plpgsql;

    -- Recalculate analytics for all users
    SELECT recalculate_all_analytics();

    RAISE NOTICE 'Migration 20240715000016_fix_analytics_duplicates has been applied';
  END IF;
END $$; 