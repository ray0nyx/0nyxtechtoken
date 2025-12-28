-- Migration: Create analytics functions
-- Description: Creates functions to populate the analytics table

-- Log this migration
DO $$
BEGIN
  -- Check if migration has already been applied
  IF NOT EXISTS (
    SELECT 1 FROM public.migration_log 
    WHERE migration_name = '20240713000004_create_analytics_functions'
  ) THEN
    -- Insert migration log entry
    INSERT INTO public.migration_log (migration_name, description, executed_at)
    VALUES ('20240713000004_create_analytics_functions', 'Creates functions to populate the analytics table', NOW());
  ELSE
    RAISE NOTICE 'Migration 20240713000004_create_analytics_functions has already been applied.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- If the migration_log table doesn't exist yet, create it
    CREATE TABLE IF NOT EXISTS public.migration_log (
      id SERIAL PRIMARY KEY,
      migration_name TEXT NOT NULL UNIQUE,
      description TEXT,
      executed_at TIMESTAMP WITH TIME ZONE NOT NULL
    );
    
    -- Then try to insert again
    IF NOT EXISTS (
      SELECT 1 FROM public.migration_log 
      WHERE migration_name = '20240713000004_create_analytics_functions'
    ) THEN
      INSERT INTO public.migration_log (migration_name, description, executed_at)
      VALUES ('20240713000004_create_analytics_functions', 'Creates functions to populate the analytics table', NOW());
    ELSE
      RAISE NOTICE 'Migration 20240713000004_create_analytics_functions has already been applied.';
    END IF;
END;
$$;

-- Function to populate analytics table with enhanced metrics
CREATE OR REPLACE FUNCTION populate_enhanced_analytics(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Clear existing analytics for this user
    DELETE FROM analytics WHERE analytics.user_id = p_user_id;
    
    -- Insert overall metrics
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
        cumulative_pnl,
        created_at,
        updated_at
    )
    SELECT
        p_user_id,
        'overall_metrics' AS metric_name,
        COUNT(*) AS total_trades,
        SUM(trades.pnl) AS total_pnl,
        (SUM(CASE WHEN trades.pnl > 0 THEN 1 ELSE 0 END)::NUMERIC / NULLIF(COUNT(*), 0)) * 100 AS win_rate,
        AVG(trades.pnl) AS average_pnl,
        SUM(CASE WHEN trades.pnl > 0 THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN trades.pnl < 0 THEN 1 ELSE 0 END) AS losses,
        MAX(CASE WHEN trades.pnl > 0 THEN trades.pnl ELSE 0 END) AS largest_win,
        MIN(CASE WHEN trades.pnl < 0 THEN trades.pnl ELSE 0 END) AS largest_loss,
        SUM(trades.pnl) OVER (ORDER BY trades.date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cumulative_pnl,
        NOW() AS created_at,
        NOW() AS updated_at
    FROM 
        trades
    WHERE 
        trades.user_id = p_user_id;
    
    -- Insert monthly metrics
    INSERT INTO analytics (
        user_id, 
        metric_name, 
        date,
        total_trades, 
        total_pnl,
        win_rate,
        average_pnl,
        wins,
        losses,
        largest_win,
        largest_loss,
        monthly_pnl,
        created_at,
        updated_at
    )
    SELECT
        p_user_id,
        'monthly_metrics' AS metric_name,
        DATE_TRUNC('month', trades.date)::date AS date,
        COUNT(*) AS total_trades,
        SUM(trades.pnl) AS total_pnl,
        (SUM(CASE WHEN trades.pnl > 0 THEN 1 ELSE 0 END)::NUMERIC / NULLIF(COUNT(*), 0)) * 100 AS win_rate,
        AVG(trades.pnl) AS average_pnl,
        SUM(CASE WHEN trades.pnl > 0 THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN trades.pnl < 0 THEN 1 ELSE 0 END) AS losses,
        MAX(CASE WHEN trades.pnl > 0 THEN trades.pnl ELSE 0 END) AS largest_win,
        MIN(CASE WHEN trades.pnl < 0 THEN trades.pnl ELSE 0 END) AS largest_loss,
        SUM(trades.pnl) AS monthly_pnl,
        NOW() AS created_at,
        NOW() AS updated_at
    FROM 
        trades
    WHERE 
        trades.user_id = p_user_id
    GROUP BY 
        DATE_TRUNC('month', trades.date);
        
    -- Insert weekly metrics
    INSERT INTO analytics (
        user_id, 
        metric_name, 
        date,
        total_trades, 
        total_pnl,
        win_rate,
        average_pnl,
        wins,
        losses,
        largest_win,
        largest_loss,
        weekly_pnl,
        created_at,
        updated_at
    )
    SELECT
        p_user_id,
        'weekly_metrics' AS metric_name,
        DATE_TRUNC('week', trades.date)::date AS date,
        COUNT(*) AS total_trades,
        SUM(trades.pnl) AS total_pnl,
        (SUM(CASE WHEN trades.pnl > 0 THEN 1 ELSE 0 END)::NUMERIC / NULLIF(COUNT(*), 0)) * 100 AS win_rate,
        AVG(trades.pnl) AS average_pnl,
        SUM(CASE WHEN trades.pnl > 0 THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN trades.pnl < 0 THEN 1 ELSE 0 END) AS losses,
        MAX(CASE WHEN trades.pnl > 0 THEN trades.pnl ELSE 0 END) AS largest_win,
        MIN(CASE WHEN trades.pnl < 0 THEN trades.pnl ELSE 0 END) AS largest_loss,
        SUM(trades.pnl) AS weekly_pnl,
        NOW() AS created_at,
        NOW() AS updated_at
    FROM 
        trades
    WHERE 
        trades.user_id = p_user_id
    GROUP BY 
        DATE_TRUNC('week', trades.date);
        
    -- Insert daily metrics
    INSERT INTO analytics (
        user_id, 
        metric_name, 
        date,
        total_trades, 
        total_pnl,
        win_rate,
        average_pnl,
        wins,
        losses,
        largest_win,
        largest_loss,
        daily_pnl,
        created_at,
        updated_at
    )
    SELECT
        p_user_id,
        'daily_metrics' AS metric_name,
        trades.date,
        COUNT(*) AS total_trades,
        SUM(trades.pnl) AS total_pnl,
        (SUM(CASE WHEN trades.pnl > 0 THEN 1 ELSE 0 END)::NUMERIC / NULLIF(COUNT(*), 0)) * 100 AS win_rate,
        AVG(trades.pnl) AS average_pnl,
        SUM(CASE WHEN trades.pnl > 0 THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN trades.pnl < 0 THEN 1 ELSE 0 END) AS losses,
        MAX(CASE WHEN trades.pnl > 0 THEN trades.pnl ELSE 0 END) AS largest_win,
        MIN(CASE WHEN trades.pnl < 0 THEN trades.pnl ELSE 0 END) AS largest_loss,
        SUM(trades.pnl) AS daily_pnl,
        NOW() AS created_at,
        NOW() AS updated_at
    FROM 
        trades
    WHERE 
        trades.user_id = p_user_id
    GROUP BY 
        trades.date;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to update analytics when trades are changed
CREATE OR REPLACE FUNCTION update_analytics_on_trade_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Call the populate_enhanced_analytics function for the user
    PERFORM populate_enhanced_analytics(NEW.user_id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on trades table
DROP TRIGGER IF EXISTS analytics_update ON trades;
CREATE TRIGGER analytics_update
AFTER INSERT OR UPDATE OR DELETE ON trades
FOR EACH ROW
EXECUTE FUNCTION update_analytics_on_trade_change();

-- Function to get analytics for user with enhanced metrics
CREATE OR REPLACE FUNCTION get_enhanced_analytics_for_user(p_user_id UUID)
RETURNS TABLE(
  total_trades BIGINT,
  win_rate NUMERIC,
  total_pnl NUMERIC,
  average_pnl NUMERIC,
  wins BIGINT,
  losses BIGINT,
  largest_win NUMERIC,
  largest_loss NUMERIC,
  daily_pnl NUMERIC,
  weekly_pnl NUMERIC,
  monthly_pnl NUMERIC,
  cumulative_pnl NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.total_trades,
    a.win_rate,
    a.total_pnl,
    a.average_pnl,
    a.wins,
    a.losses,
    a.largest_win,
    a.largest_loss,
    a.daily_pnl,
    a.weekly_pnl,
    a.monthly_pnl,
    a.cumulative_pnl
  FROM
    analytics a
  WHERE
    a.user_id = p_user_id
    AND a.metric_name = 'overall_metrics'
  ORDER BY
    a.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql; 