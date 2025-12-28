-- Migration: Create functions for analytics and performance
-- Description: Creates functions for analytics and performance tables

-- Log this migration
DO $$
BEGIN
  -- Check if migration has already been applied
  IF NOT EXISTS (
    SELECT 1 FROM public.migration_log 
    WHERE migration_name = '20240713000002_create_functions'
  ) THEN
    -- Insert migration log entry
    INSERT INTO public.migration_log (migration_name, description, executed_at)
    VALUES ('20240713000002_create_functions', 'Creates functions for analytics and performance tables', NOW());
  ELSE
    RAISE NOTICE 'Migration 20240713000002_create_functions has already been applied.';
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
      WHERE migration_name = '20240713000002_create_functions'
    ) THEN
      INSERT INTO public.migration_log (migration_name, description, executed_at)
      VALUES ('20240713000002_create_functions', 'Creates functions for analytics and performance tables', NOW());
    ELSE
      RAISE NOTICE 'Migration 20240713000002_create_functions has already been applied.';
    END IF;
END;
$$;

-- Function to populate analytics table with enhanced metrics
CREATE OR REPLACE FUNCTION populate_enhanced_analytics_table(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Clear existing analytics for this user
    DELETE FROM analytics_table WHERE analytics_table.user_id = p_user_id;
    
    -- Insert overall metrics
    INSERT INTO analytics_table (
        user_id, 
        metric_name, 
        total_trades, 
        total_pnl,
        "Win Rate",
        "Average P&L",
        "Wins",
        "Losses",
        "Largest Win",
        "Largest Loss",
        "Cumulative P&L",
        created_at,
        updated_at
    )
    SELECT
        p_user_id,
        'overall_metrics' AS metric_name,
        COUNT(*) AS total_trades,
        SUM(trades.pnl) AS total_pnl,
        (SUM(CASE WHEN trades.pnl > 0 THEN 1 ELSE 0 END)::NUMERIC / NULLIF(COUNT(*), 0)) * 100 AS "Win Rate",
        AVG(trades.pnl) AS "Average P&L",
        SUM(CASE WHEN trades.pnl > 0 THEN 1 ELSE 0 END) AS "Wins",
        SUM(CASE WHEN trades.pnl < 0 THEN 1 ELSE 0 END) AS "Losses",
        MAX(CASE WHEN trades.pnl > 0 THEN trades.pnl ELSE 0 END) AS "Largest Win",
        MIN(CASE WHEN trades.pnl < 0 THEN trades.pnl ELSE 0 END) AS "Largest Loss",
        SUM(trades.pnl) OVER (ORDER BY trades.date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS "Cumulative P&L",
        NOW() AS created_at,
        NOW() AS updated_at
    FROM 
        trades
    WHERE 
        trades.user_id = p_user_id;
    
    -- Insert monthly metrics
    INSERT INTO analytics_table (
        user_id, 
        metric_name, 
        date,
        total_trades, 
        total_pnl,
        "Win Rate",
        "Average P&L",
        "Wins",
        "Losses",
        "Largest Win",
        "Largest Loss",
        "Monthly P&L",
        created_at,
        updated_at
    )
    SELECT
        p_user_id,
        'monthly_metrics' AS metric_name,
        DATE_TRUNC('month', trades.date)::date AS date,
        COUNT(*) AS total_trades,
        SUM(trades.pnl) AS total_pnl,
        (SUM(CASE WHEN trades.pnl > 0 THEN 1 ELSE 0 END)::NUMERIC / NULLIF(COUNT(*), 0)) * 100 AS "Win Rate",
        AVG(trades.pnl) AS "Average P&L",
        SUM(CASE WHEN trades.pnl > 0 THEN 1 ELSE 0 END) AS "Wins",
        SUM(CASE WHEN trades.pnl < 0 THEN 1 ELSE 0 END) AS "Losses",
        MAX(CASE WHEN trades.pnl > 0 THEN trades.pnl ELSE 0 END) AS "Largest Win",
        MIN(CASE WHEN trades.pnl < 0 THEN trades.pnl ELSE 0 END) AS "Largest Loss",
        SUM(trades.pnl) AS "Monthly P&L",
        NOW() AS created_at,
        NOW() AS updated_at
    FROM 
        trades
    WHERE 
        trades.user_id = p_user_id
    GROUP BY 
        DATE_TRUNC('month', trades.date);
        
    -- Insert weekly metrics
    INSERT INTO analytics_table (
        user_id, 
        metric_name, 
        date,
        total_trades, 
        total_pnl,
        "Win Rate",
        "Average P&L",
        "Wins",
        "Losses",
        "Largest Win",
        "Largest Loss",
        "Weekly P&L",
        created_at,
        updated_at
    )
    SELECT
        p_user_id,
        'weekly_metrics' AS metric_name,
        DATE_TRUNC('week', trades.date)::date AS date,
        COUNT(*) AS total_trades,
        SUM(trades.pnl) AS total_pnl,
        (SUM(CASE WHEN trades.pnl > 0 THEN 1 ELSE 0 END)::NUMERIC / NULLIF(COUNT(*), 0)) * 100 AS "Win Rate",
        AVG(trades.pnl) AS "Average P&L",
        SUM(CASE WHEN trades.pnl > 0 THEN 1 ELSE 0 END) AS "Wins",
        SUM(CASE WHEN trades.pnl < 0 THEN 1 ELSE 0 END) AS "Losses",
        MAX(CASE WHEN trades.pnl > 0 THEN trades.pnl ELSE 0 END) AS "Largest Win",
        MIN(CASE WHEN trades.pnl < 0 THEN trades.pnl ELSE 0 END) AS "Largest Loss",
        SUM(trades.pnl) AS "Weekly P&L",
        NOW() AS created_at,
        NOW() AS updated_at
    FROM 
        trades
    WHERE 
        trades.user_id = p_user_id
    GROUP BY 
        DATE_TRUNC('week', trades.date);
        
    -- Insert daily metrics
    INSERT INTO analytics_table (
        user_id, 
        metric_name, 
        date,
        total_trades, 
        total_pnl,
        "Win Rate",
        "Average P&L",
        "Wins",
        "Losses",
        "Largest Win",
        "Largest Loss",
        "Daily P&L",
        created_at,
        updated_at
    )
    SELECT
        p_user_id,
        'daily_metrics' AS metric_name,
        trades.date,
        COUNT(*) AS total_trades,
        SUM(trades.pnl) AS total_pnl,
        (SUM(CASE WHEN trades.pnl > 0 THEN 1 ELSE 0 END)::NUMERIC / NULLIF(COUNT(*), 0)) * 100 AS "Win Rate",
        AVG(trades.pnl) AS "Average P&L",
        SUM(CASE WHEN trades.pnl > 0 THEN 1 ELSE 0 END) AS "Wins",
        SUM(CASE WHEN trades.pnl < 0 THEN 1 ELSE 0 END) AS "Losses",
        MAX(CASE WHEN trades.pnl > 0 THEN trades.pnl ELSE 0 END) AS "Largest Win",
        MIN(CASE WHEN trades.pnl < 0 THEN trades.pnl ELSE 0 END) AS "Largest Loss",
        SUM(trades.pnl) AS "Daily P&L",
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

-- Function to populate performance table
CREATE OR REPLACE FUNCTION populate_performance_table(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Clear existing performance data for this user
    DELETE FROM performance_table WHERE performance_table.user_id = p_user_id;
    
    -- Insert performance metrics
    INSERT INTO performance_table (
        user_id,
        date,
        "Strategy Performance",
        "Win Rate",
        "Trade Duration vs P&L",
        "Performance by Duration",
        created_at,
        updated_at
    )
    SELECT
        p_user_id,
        CURRENT_DATE,
        -- Strategy Performance: Average PnL by strategy
        (SELECT AVG(pnl) FROM trades WHERE user_id = p_user_id AND strategy IS NOT NULL GROUP BY strategy),
        -- Win Rate: Percentage of winning trades
        (SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END)::NUMERIC / NULLIF(COUNT(*), 0)) * 100,
        -- Trade Duration vs P&L: Average PnL per minute of trade duration
        AVG(pnl / NULLIF(EXTRACT(EPOCH FROM duration) / 60, 0)),
        -- Performance by Duration: Average PnL grouped by duration buckets
        (SELECT AVG(pnl) FROM trades 
         WHERE user_id = p_user_id 
         GROUP BY 
           CASE 
             WHEN EXTRACT(EPOCH FROM duration) < 300 THEN 'Under 5 min'
             WHEN EXTRACT(EPOCH FROM duration) < 900 THEN '5-15 min'
             WHEN EXTRACT(EPOCH FROM duration) < 3600 THEN '15-60 min'
             ELSE 'Over 60 min'
           END),
        NOW(),
        NOW()
    FROM 
        trades
    WHERE 
        trades.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to update analytics and performance when trades are changed
CREATE OR REPLACE FUNCTION update_analytics_and_performance_on_trade_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Call the populate_enhanced_analytics_table function for the user
    PERFORM populate_enhanced_analytics_table(NEW.user_id);
    
    -- Call the populate_performance_table function for the user
    PERFORM populate_performance_table(NEW.user_id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on trades table
DROP TRIGGER IF EXISTS analytics_and_performance_update ON trades;
CREATE TRIGGER analytics_and_performance_update
AFTER INSERT OR UPDATE OR DELETE ON trades
FOR EACH ROW
EXECUTE FUNCTION update_analytics_and_performance_on_trade_change();

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
    a."Win Rate" as win_rate,
    a.total_pnl,
    a."Average P&L" as average_pnl,
    a."Wins" as wins,
    a."Losses" as losses,
    a."Largest Win" as largest_win,
    a."Largest Loss" as largest_loss,
    a."Daily P&L" as daily_pnl,
    a."Weekly P&L" as weekly_pnl,
    a."Monthly P&L" as monthly_pnl,
    a."Cumulative P&L" as cumulative_pnl
  FROM
    analytics_table a
  WHERE
    a.user_id = p_user_id
    AND a.metric_name = 'overall_metrics'
  ORDER BY
    a.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to get performance for user
CREATE OR REPLACE FUNCTION get_performance_for_user(p_user_id UUID)
RETURNS TABLE(
  strategy_performance NUMERIC,
  win_rate NUMERIC,
  trade_duration_vs_pnl NUMERIC,
  performance_by_duration NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p."Strategy Performance" as strategy_performance,
    p."Win Rate" as win_rate,
    p."Trade Duration vs P&L" as trade_duration_vs_pnl,
    p."Performance by Duration" as performance_by_duration
  FROM
    performance_table p
  WHERE
    p.user_id = p_user_id
  ORDER BY
    p.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql; 