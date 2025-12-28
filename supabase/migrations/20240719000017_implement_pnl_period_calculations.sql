-- Migration to implement daily, weekly, and monthly PnL calculations
-- Description: Calculates PnL for different time periods and updates the analytics table

-- Function to calculate and update PnL for different time periods for a specific user
CREATE OR REPLACE FUNCTION calculate_period_pnl(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_daily_pnl JSONB;
    v_weekly_pnl JSONB;
    v_monthly_pnl JSONB;
    v_overall_exists BOOLEAN;
BEGIN
    -- Calculate daily PnL
    -- Format: {"2023-07-19": 100.50, "2023-07-20": -25.75, ...}
    SELECT jsonb_object_agg(
        date::TEXT, 
        ROUND(SUM(pnl)::NUMERIC, 2)
    )
    INTO v_daily_pnl
    FROM trades
    WHERE user_id = p_user_id
    GROUP BY date;
    
    -- Calculate weekly PnL
    -- Format: {"2023-W29": 250.25, "2023-W30": -125.00, ...}
    SELECT jsonb_object_agg(
        TO_CHAR(date_trunc('week', date), 'YYYY-"W"IW'),
        ROUND(SUM(pnl)::NUMERIC, 2)
    )
    INTO v_weekly_pnl
    FROM trades
    WHERE user_id = p_user_id
    GROUP BY date_trunc('week', date);
    
    -- Calculate monthly PnL
    -- Format: {"2023-07": 500.75, "2023-08": -200.50, ...}
    SELECT jsonb_object_agg(
        TO_CHAR(date_trunc('month', date), 'YYYY-MM'),
        ROUND(SUM(pnl)::NUMERIC, 2)
    )
    INTO v_monthly_pnl
    FROM trades
    WHERE user_id = p_user_id
    GROUP BY date_trunc('month', date);
    
    -- Handle NULL values
    v_daily_pnl := COALESCE(v_daily_pnl, '{}'::JSONB);
    v_weekly_pnl := COALESCE(v_weekly_pnl, '{}'::JSONB);
    v_monthly_pnl := COALESCE(v_monthly_pnl, '{}'::JSONB);
    
    -- Check if user has an overall metrics record
    SELECT EXISTS(
        SELECT 1 
        FROM analytics 
        WHERE user_id = p_user_id 
        AND metric_name = 'overall_metrics'
    ) INTO v_overall_exists;
    
    -- Update or insert PnL data
    IF v_overall_exists THEN
        -- Update existing record
        UPDATE analytics
        SET 
            daily_pnl = v_daily_pnl,
            weekly_pnl = v_weekly_pnl,
            monthly_pnl = v_monthly_pnl,
            updated_at = NOW()
        WHERE 
            user_id = p_user_id
            AND metric_name = 'overall_metrics';
            
        RAISE NOTICE 'Updated PnL periods for user %', p_user_id;
    ELSE
        -- Create a new record if one doesn't exist
        INSERT INTO analytics (
            user_id,
            metric_name,
            daily_pnl,
            weekly_pnl,
            monthly_pnl,
            total_trades,
            total_pnl,
            created_at,
            updated_at
        ) VALUES (
            p_user_id,
            'overall_metrics',
            v_daily_pnl,
            v_weekly_pnl,
            v_monthly_pnl,
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            NOW(),
            NOW()
        );
        
        RAISE NOTICE 'Created PnL periods for user %', p_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to update PnL periods when a trade is added/modified/deleted
CREATE OR REPLACE FUNCTION update_pnl_after_trade_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate and update PnL for the user
    PERFORM calculate_period_pnl(
        CASE
            WHEN TG_OP = 'DELETE' THEN OLD.user_id
            ELSE NEW.user_id
        END
    );
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to update PnL when trades are changed
DO $$
BEGIN
    -- Drop the trigger if it exists
    DROP TRIGGER IF EXISTS trigger_update_pnl_after_trade_change ON trades;
    
    -- Create the trigger
    CREATE TRIGGER trigger_update_pnl_after_trade_change
    AFTER INSERT OR UPDATE OR DELETE ON trades
    FOR EACH STATEMENT
    EXECUTE FUNCTION update_pnl_after_trade_change();
    
    RAISE NOTICE 'Created PnL update trigger on trades table';
END $$;

-- Create a convenience function to manually recalculate PnL for all users
CREATE OR REPLACE FUNCTION recalculate_all_users_pnl()
RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
BEGIN
    FOR v_user_id IN
        SELECT DISTINCT user_id FROM trades
    LOOP
        PERFORM calculate_period_pnl(v_user_id);
    END LOOP;
    
    RAISE NOTICE 'Recalculated PnL for all users';
END;
$$ LANGUAGE plpgsql;

-- Run the function to calculate PnL for all users (initial population)
SELECT recalculate_all_users_pnl();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION calculate_period_pnl(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_pnl_after_trade_change() TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_all_users_pnl() TO authenticated; 