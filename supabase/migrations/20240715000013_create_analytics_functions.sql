-- Migration: create_analytics_functions
-- Description: Create functions for calculating analytics and triggers for updates

-- Record the migration
INSERT INTO migration_log (migration_name, description, executed_at)
VALUES ('20240715000013_create_analytics_functions', 'Create functions for calculating analytics and triggers for updates', NOW());

-- Drop existing triggers and functions to avoid conflicts
DROP TRIGGER IF EXISTS update_analytics_on_trade_change ON trades;
DROP TRIGGER IF EXISTS analytics_update ON trades;
DROP FUNCTION IF EXISTS get_enhanced_analytics_for_user(UUID) CASCADE;
DROP FUNCTION IF EXISTS update_analytics_on_trade_change() CASCADE;
DROP FUNCTION IF EXISTS calculate_user_analytics(UUID) CASCADE;
DROP FUNCTION IF EXISTS clean_dollar_sign(TEXT) CASCADE;

-- Function to clean dollar signs from text values
CREATE OR REPLACE FUNCTION clean_dollar_sign(value TEXT)
RETURNS NUMERIC AS $$
DECLARE
  cleaned_value TEXT;
BEGIN
  -- Return 0 for NULL or empty values
  IF value IS NULL OR value = '' THEN
    RETURN 0;
  END IF;
  
  -- First, trim whitespace
  cleaned_value := TRIM(value);
  
  -- Handle dollar sign at the beginning
  IF LEFT(cleaned_value, 1) = '$' THEN
    cleaned_value := SUBSTRING(cleaned_value FROM 2);
  END IF;
  
  -- Remove commas and other non-numeric characters except decimal points and negative signs
  cleaned_value := REGEXP_REPLACE(cleaned_value, '[^0-9.-]', '', 'g');
  
  -- Handle empty string after cleaning
  IF cleaned_value = '' OR cleaned_value = '-' OR cleaned_value = '.' THEN
    RETURN 0;
  END IF;
  
  -- Convert to numeric with robust error handling
  BEGIN
    RETURN cleaned_value::NUMERIC;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Error converting value "%": %', value, SQLERRM;
      RETURN 0;
  END;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error cleaning dollar sign from value "%": %', value, SQLERRM;
    RETURN 0;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate user analytics
CREATE OR REPLACE FUNCTION calculate_user_analytics(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_total_trades INTEGER;
    v_wins INTEGER;
    v_losses INTEGER;
    v_win_rate NUMERIC;
    v_total_pnl NUMERIC;
    v_average_pnl NUMERIC;
    v_largest_win NUMERIC;
    v_largest_loss NUMERIC;
    v_daily_pnl NUMERIC;
    v_weekly_pnl NUMERIC;
    v_monthly_pnl NUMERIC;
    v_cumulative_pnl NUMERIC;
BEGIN
    -- Calculate basic metrics
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE pnl > 0),
        COUNT(*) FILTER (WHERE pnl < 0),
        COALESCE(SUM(pnl), 0),
        COALESCE(MAX(CASE WHEN pnl > 0 THEN pnl ELSE 0 END), 0),
        COALESCE(MIN(CASE WHEN pnl < 0 THEN pnl ELSE 0 END), 0)
    INTO 
        v_total_trades,
        v_wins,
        v_losses,
        v_total_pnl,
        v_largest_win,
        v_largest_loss
    FROM trades
    WHERE user_id = p_user_id;

    -- Calculate win rate (avoid division by zero)
    v_win_rate := CASE 
        WHEN v_total_trades > 0 THEN 
            (v_wins::NUMERIC / v_total_trades::NUMERIC) * 100
        ELSE 0 
    END;

    -- Calculate average PnL (avoid division by zero)
    v_average_pnl := CASE 
        WHEN v_total_trades > 0 THEN 
            v_total_pnl / v_total_trades::NUMERIC
        ELSE 0 
    END;

    -- Calculate daily PnL (last 24 hours)
    SELECT COALESCE(SUM(pnl), 0)
    INTO v_daily_pnl
    FROM trades
    WHERE user_id = p_user_id
    AND date >= CURRENT_DATE;

    -- Calculate weekly PnL (last 7 days)
    SELECT COALESCE(SUM(pnl), 0)
    INTO v_weekly_pnl
    FROM trades
    WHERE user_id = p_user_id
    AND date >= CURRENT_DATE - INTERVAL '7 days';

    -- Calculate monthly PnL (last 30 days)
    SELECT COALESCE(SUM(pnl), 0)
    INTO v_monthly_pnl
    FROM trades
    WHERE user_id = p_user_id
    AND date >= CURRENT_DATE - INTERVAL '30 days';

    -- Calculate cumulative PnL
    v_cumulative_pnl := v_total_pnl;

    -- Insert or update analytics
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
    ) VALUES (
        p_user_id,
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
        NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
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
END;
$$ LANGUAGE plpgsql;

-- Function to handle trade changes
CREATE OR REPLACE FUNCTION update_analytics_on_trade_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate analytics for the affected user
    IF TG_OP = 'DELETE' THEN
        PERFORM calculate_user_analytics(OLD.user_id);
    ELSE
        PERFORM calculate_user_analytics(NEW.user_id);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for trade changes
CREATE TRIGGER update_analytics_on_trade_change
AFTER INSERT OR UPDATE OR DELETE ON trades
FOR EACH ROW
EXECUTE FUNCTION update_analytics_on_trade_change();

-- Function to get enhanced analytics for a user
CREATE OR REPLACE FUNCTION get_enhanced_analytics_for_user(p_user_id UUID)
RETURNS TABLE (
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
    -- Ensure analytics are up to date
    PERFORM calculate_user_analytics(p_user_id);
    
    -- Return the analytics
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
    FROM analytics a
    WHERE a.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql; 