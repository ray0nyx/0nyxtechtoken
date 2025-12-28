-- Migration: 20240715000015_cleanup_analytics_table
-- Description: Clean up analytics table to ensure one row per user

-- Check if this migration has already been applied
SELECT NOT EXISTS(
    SELECT 1 FROM migration_log WHERE migration_name = '20240715000015_cleanup_analytics_table'
) as should_run \gset

\if :should_run
    \echo '# Running migration 20240715000015_cleanup_analytics_table'

    -- Log the migration
    INSERT INTO migration_log(migration_name, description) VALUES 
    ('20240715000015_cleanup_analytics_table', 'Clean up analytics table to ensure one row per user');

    -- Create a temporary table to store the latest analytics per user
    CREATE TEMP TABLE latest_analytics AS
    WITH ranked_analytics AS (
        SELECT 
            *,
            ROW_NUMBER() OVER (
                PARTITION BY user_id 
                ORDER BY 
                    CASE 
                        WHEN total_trades IS NOT NULL 
                        OR total_pnl IS NOT NULL 
                        OR win_rate IS NOT NULL 
                        THEN 1 
                        ELSE 0 
                    END DESC,
                    updated_at DESC NULLS LAST,
                    created_at DESC NULLS LAST,
                    id DESC
            ) as rn
        FROM analytics
    )
    SELECT 
        id,
        user_id,
        COALESCE(total_trades, 0) as total_trades,
        COALESCE(win_rate, 0) as win_rate,
        COALESCE(total_pnl, 0) as total_pnl,
        COALESCE(average_pnl, 0) as average_pnl,
        COALESCE(wins, 0) as wins,
        COALESCE(losses, 0) as losses,
        COALESCE(largest_win, 0) as largest_win,
        COALESCE(largest_loss, 0) as largest_loss,
        COALESCE(daily_pnl, '{}'::jsonb) as daily_pnl,
        COALESCE(weekly_pnl, '{}'::jsonb) as weekly_pnl,
        COALESCE(monthly_pnl, '{}'::jsonb) as monthly_pnl,
        COALESCE(cumulative_pnl, '{}'::jsonb) as cumulative_pnl,
        NOW() as updated_at
    FROM ranked_analytics
    WHERE rn = 1;

    -- Delete all rows from analytics
    DELETE FROM analytics;

    -- Insert the latest analytics back
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
    SELECT
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
    FROM latest_analytics;

    -- Drop the temporary table
    DROP TABLE latest_analytics;

    -- Recalculate analytics for all users
    SELECT recalculate_all_analytics();

    \echo '# Completed migration 20240715000015_cleanup_analytics_table'
\endif 