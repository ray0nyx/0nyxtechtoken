-- Migration: Create analytics calculation functions
-- Description: Adds functions to calculate analytics metrics from trades and insert into analytics table

-- Log this migration
DO $$
BEGIN
  -- Check if migration has already been applied
  IF NOT EXISTS (
    SELECT 1 FROM public.migration_log 
    WHERE migration_name = '20240714000001_create_analytics_calculation_functions'
  ) THEN
    -- Insert migration log entry
    INSERT INTO public.migration_log (migration_name, description, executed_at)
    VALUES ('20240714000001_create_analytics_calculation_functions', 'Adds functions to calculate analytics metrics from trades and insert into analytics table', NOW());
  ELSE
    RAISE NOTICE 'Migration 20240714000001_create_analytics_calculation_functions has already been applied.';
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
      WHERE migration_name = '20240714000001_create_analytics_calculation_functions'
    ) THEN
      INSERT INTO public.migration_log (migration_name, description, executed_at)
      VALUES ('20240714000001_create_analytics_calculation_functions', 'Adds functions to calculate analytics metrics from trades and insert into analytics table', NOW());
    ELSE
      RAISE NOTICE 'Migration 20240714000001_create_analytics_calculation_functions has already been applied.';
    END IF;
END;
$$;

-- Drop existing functions and trigger to avoid conflicts
DROP TRIGGER IF EXISTS analytics_update ON trades;
DROP FUNCTION IF EXISTS update_analytics_on_trade_change() CASCADE;
DROP FUNCTION IF EXISTS calculate_all_users_analytics() CASCADE;
DROP FUNCTION IF EXISTS calculate_user_analytics(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_analytics_for_user(UUID) CASCADE;

-- Function to calculate analytics for a specific user
CREATE OR REPLACE FUNCTION calculate_user_analytics(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_total_trades INTEGER;
    v_win_rate NUMERIC;
    v_total_pnl NUMERIC;
    v_average_pnl NUMERIC;
    v_wins INTEGER;
    v_losses INTEGER;
    v_largest_win NUMERIC;
    v_largest_loss NUMERIC;
    v_daily_pnl NUMERIC;
    v_weekly_pnl NUMERIC;
    v_monthly_pnl NUMERIC;
    v_cumulative_pnl NUMERIC;
    v_current_date DATE := CURRENT_DATE;
    v_current_week DATE := DATE_TRUNC('week', CURRENT_DATE)::DATE;
    v_current_month DATE := DATE_TRUNC('month', CURRENT_DATE)::DATE;
BEGIN
    -- Calculate total trades
    SELECT COUNT(*) INTO v_total_trades
    FROM trades
    WHERE user_id = p_user_id;
    
    -- Calculate wins and losses
    SELECT 
        COUNT(CASE WHEN pnl > 0 THEN 1 END),
        COUNT(CASE WHEN pnl < 0 THEN 1 END)
    INTO v_wins, v_losses
    FROM trades
    WHERE user_id = p_user_id;
    
    -- Calculate win rate
    IF v_total_trades > 0 THEN
        v_win_rate := (v_wins::NUMERIC / v_total_trades) * 100;
    ELSE
        v_win_rate := 0;
    END IF;
    
    -- Calculate total P&L
    SELECT COALESCE(SUM(pnl), 0) INTO v_total_pnl
    FROM trades
    WHERE user_id = p_user_id;
    
    -- Calculate average P&L
    IF v_total_trades > 0 THEN
        v_average_pnl := v_total_pnl / v_total_trades;
    ELSE
        v_average_pnl := 0;
    END IF;
    
    -- Calculate largest win and loss
    SELECT 
        COALESCE(MAX(CASE WHEN pnl > 0 THEN pnl END), 0),
        COALESCE(MIN(CASE WHEN pnl < 0 THEN pnl END), 0)
    INTO v_largest_win, v_largest_loss
    FROM trades
    WHERE user_id = p_user_id;
    
    -- Calculate daily P&L (for current day)
    SELECT COALESCE(SUM(pnl), 0) INTO v_daily_pnl
    FROM trades
    WHERE user_id = p_user_id
    AND date = v_current_date;
    
    -- Calculate weekly P&L (for current week)
    SELECT COALESCE(SUM(pnl), 0) INTO v_weekly_pnl
    FROM trades
    WHERE user_id = p_user_id
    AND date >= v_current_week
    AND date <= v_current_date;
    
    -- Calculate monthly P&L (for current month)
    SELECT COALESCE(SUM(pnl), 0) INTO v_monthly_pnl
    FROM trades
    WHERE user_id = p_user_id
    AND date >= v_current_month
    AND date <= v_current_date;
    
    -- Calculate cumulative P&L (all time)
    v_cumulative_pnl := v_total_pnl;
    
    -- Delete existing overall metrics for this user
    DELETE FROM analytics 
    WHERE user_id = p_user_id 
    AND metric_name = 'overall_metrics';
    
    -- Insert overall metrics
    INSERT INTO analytics (
        user_id,
        metric_name,
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
        created_at,
        updated_at
    ) VALUES (
        p_user_id,
        'overall_metrics',
        v_total_trades,
        v_win_rate,
        v_total_pnl,
        v_average_pnl,
        v_wins,
        v_losses,
        v_largest_win,
        v_largest_loss,
        v_daily_pnl,
        v_weekly_pnl,
        v_monthly_pnl,
        v_cumulative_pnl,
        NOW(),
        NOW()
    );
    
    -- Calculate and insert daily metrics
    DELETE FROM analytics 
    WHERE user_id = p_user_id 
    AND metric_name = 'daily_metrics';
    
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
        'daily_metrics',
        date,
        COUNT(*) AS total_trades,
        SUM(pnl) AS total_pnl,
        (COUNT(CASE WHEN pnl > 0 THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0)) * 100 AS win_rate,
        AVG(pnl) AS average_pnl,
        COUNT(CASE WHEN pnl > 0 THEN 1 END) AS wins,
        COUNT(CASE WHEN pnl < 0 THEN 1 END) AS losses,
        MAX(CASE WHEN pnl > 0 THEN pnl ELSE 0 END) AS largest_win,
        MIN(CASE WHEN pnl < 0 THEN pnl ELSE 0 END) AS largest_loss,
        SUM(pnl) AS daily_pnl,
        NOW() AS created_at,
        NOW() AS updated_at
    FROM trades
    WHERE user_id = p_user_id
    GROUP BY date;
    
    -- Calculate and insert weekly metrics
    DELETE FROM analytics 
    WHERE user_id = p_user_id 
    AND metric_name = 'weekly_metrics';
    
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
        'weekly_metrics',
        DATE_TRUNC('week', date)::DATE,
        COUNT(*) AS total_trades,
        SUM(pnl) AS total_pnl,
        (COUNT(CASE WHEN pnl > 0 THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0)) * 100 AS win_rate,
        AVG(pnl) AS average_pnl,
        COUNT(CASE WHEN pnl > 0 THEN 1 END) AS wins,
        COUNT(CASE WHEN pnl < 0 THEN 1 END) AS losses,
        MAX(CASE WHEN pnl > 0 THEN pnl ELSE 0 END) AS largest_win,
        MIN(CASE WHEN pnl < 0 THEN pnl ELSE 0 END) AS largest_loss,
        SUM(pnl) AS weekly_pnl,
        NOW() AS created_at,
        NOW() AS updated_at
    FROM trades
    WHERE user_id = p_user_id
    GROUP BY DATE_TRUNC('week', date)::DATE;
    
    -- Calculate and insert monthly metrics
    DELETE FROM analytics 
    WHERE user_id = p_user_id 
    AND metric_name = 'monthly_metrics';
    
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
        'monthly_metrics',
        DATE_TRUNC('month', date)::DATE,
        COUNT(*) AS total_trades,
        SUM(pnl) AS total_pnl,
        (COUNT(CASE WHEN pnl > 0 THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0)) * 100 AS win_rate,
        AVG(pnl) AS average_pnl,
        COUNT(CASE WHEN pnl > 0 THEN 1 END) AS wins,
        COUNT(CASE WHEN pnl < 0 THEN 1 END) AS losses,
        MAX(CASE WHEN pnl > 0 THEN pnl ELSE 0 END) AS largest_win,
        MIN(CASE WHEN pnl < 0 THEN pnl ELSE 0 END) AS largest_loss,
        SUM(pnl) AS monthly_pnl,
        NOW() AS created_at,
        NOW() AS updated_at
    FROM trades
    WHERE user_id = p_user_id
    GROUP BY DATE_TRUNC('month', date)::DATE;
    
    -- Calculate cumulative P&L over time
    WITH cumulative_data AS (
        SELECT
            date,
            SUM(pnl) OVER (ORDER BY date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cumulative_pnl
        FROM (
            SELECT date, SUM(pnl) AS pnl
            FROM trades
            WHERE user_id = p_user_id
            GROUP BY date
            ORDER BY date
        ) daily_pnl
    )
    UPDATE analytics a
    SET cumulative_pnl = cd.cumulative_pnl
    FROM cumulative_data cd
    WHERE a.user_id = p_user_id
    AND a.metric_name = 'daily_metrics'
    AND a.date = cd.date;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate analytics for all users
CREATE OR REPLACE FUNCTION calculate_all_users_analytics()
RETURNS VOID AS $$
DECLARE
    user_rec RECORD;
BEGIN
    FOR user_rec IN SELECT DISTINCT user_id FROM trades WHERE user_id IS NOT NULL LOOP
        PERFORM calculate_user_analytics(user_rec.user_id);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to update analytics when trades are changed
CREATE OR REPLACE FUNCTION update_analytics_on_trade_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process trades with a user_id
    IF NEW.user_id IS NOT NULL THEN
        -- Call the calculate_user_analytics function for the user
        PERFORM calculate_user_analytics(NEW.user_id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on trades table
DROP TRIGGER IF EXISTS analytics_update ON trades;
CREATE TRIGGER analytics_update
AFTER INSERT OR UPDATE OR DELETE ON trades
FOR EACH ROW
EXECUTE FUNCTION update_analytics_on_trade_change();

-- Function to get analytics for a specific user
DROP FUNCTION IF EXISTS get_analytics_for_user(UUID);
CREATE OR REPLACE FUNCTION get_analytics_for_user(p_user_id UUID)
RETURNS TABLE(
    total_trades INTEGER,
    win_rate NUMERIC,
    total_pnl NUMERIC,
    average_pnl NUMERIC,
    wins INTEGER,
    losses INTEGER,
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