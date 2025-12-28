-- Migration: Fix analytics functions to use correct table names
-- Description: Updates the populate_tradovate_analytics function to use "analytics" instead of "analytics_table"

-- Check if migration has already been applied
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM migration_log WHERE migration_name = '20240716000005_fix_analytics_functions'
  ) THEN
    -- Log migration
    INSERT INTO migration_log (migration_name, description, applied_at) 
    VALUES ('20240716000005_fix_analytics_functions', 'Fix analytics functions to use correct table names', NOW());
    
    -- Drop the trigger that uses the problematic function
    DROP TRIGGER IF EXISTS tradovate_analytics_update ON trades;
    
    -- Create a fixed version of the populate_tradovate_analytics function
    CREATE OR REPLACE FUNCTION populate_tradovate_analytics(p_user_id UUID)
    RETURNS VOID AS $$
    BEGIN
        -- Clear existing analytics for this user
        DELETE FROM "analytics" WHERE "analytics"."user_id" = p_user_id;
        
        -- Insert overall metrics
        INSERT INTO "analytics" (
            "user_id", 
            "metric_name", 
            "total_trades", 
            "total_pnl",
            "created_at",
            "updated_at"
        )
        SELECT
            p_user_id,
            'overall_metrics' AS metric_name,
            COUNT(*) AS total_trades,
            SUM(trades.pnl) AS total_pnl,
            NOW() AS created_at,
            NOW() AS updated_at
        FROM 
            trades
        WHERE 
            trades.user_id = p_user_id
            AND trades.broker = 'Tradovate';
        
        -- Insert monthly metrics
        INSERT INTO "analytics" (
            "user_id", 
            "metric_name", 
            "date",
            "total_trades", 
            "total_pnl",
            "created_at",
            "updated_at"
        )
        SELECT
            p_user_id,
            'monthly_metrics' AS metric_name,
            DATE_TRUNC('month', trades.date)::date AS date,
            COUNT(*) AS total_trades,
            SUM(trades.pnl) AS total_pnl,
            NOW() AS created_at,
            NOW() AS updated_at
        FROM 
            trades
        WHERE 
            trades.user_id = p_user_id
            AND trades.broker = 'Tradovate'
        GROUP BY 
            DATE_TRUNC('month', trades.date);
            
        -- Insert daily metrics
        INSERT INTO "analytics" (
            "user_id", 
            "metric_name", 
            "date",
            "total_trades", 
            "total_pnl",
            "created_at",
            "updated_at"
        )
        SELECT
            p_user_id,
            'daily_metrics' AS metric_name,
            trades.date,
            COUNT(*) AS total_trades,
            SUM(trades.pnl) AS total_pnl,
            NOW() AS created_at,
            NOW() AS updated_at
        FROM 
            trades
        WHERE 
            trades.user_id = p_user_id
            AND trades.broker = 'Tradovate'
        GROUP BY 
            trades.date;
    END;
    $$ LANGUAGE plpgsql;

    -- Create a fixed version of the update_tradovate_analytics_on_trade_change function
    CREATE OR REPLACE FUNCTION update_tradovate_analytics_on_trade_change()
    RETURNS TRIGGER AS $$
    BEGIN
        -- Call the populate_tradovate_analytics function for the user
        IF TG_OP = 'DELETE' THEN
            IF OLD.user_id IS NOT NULL THEN
                PERFORM populate_tradovate_analytics(OLD.user_id);
            END IF;
        ELSE
            IF NEW.user_id IS NOT NULL THEN
                PERFORM populate_tradovate_analytics(NEW.user_id);
            END IF;
        END IF;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Create a new trigger with the fixed function
    CREATE TRIGGER tradovate_analytics_update
    AFTER INSERT OR UPDATE OR DELETE ON trades
    FOR EACH ROW
    EXECUTE FUNCTION update_tradovate_analytics_on_trade_change();

    -- Grant necessary permissions
    GRANT EXECUTE ON FUNCTION populate_tradovate_analytics(UUID) TO authenticated;
    GRANT EXECUTE ON FUNCTION update_tradovate_analytics_on_trade_change() TO authenticated;
    
    RAISE NOTICE 'Migration 20240716000005_fix_analytics_functions has been applied';
  END IF;
END $$; 