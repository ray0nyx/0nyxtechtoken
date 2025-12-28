-- Drop existing objects
DROP TRIGGER IF EXISTS update_analytics_trigger ON trades;
DROP FUNCTION IF EXISTS calculate_period_performance(uuid) CASCADE;
DROP FUNCTION IF EXISTS update_analytics_and_performance() CASCADE;

-- Ensure user_performance table exists
CREATE TABLE IF NOT EXISTS user_performance (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    metrics jsonb DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Create function to calculate performance metrics
CREATE OR REPLACE FUNCTION calculate_period_performance(user_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    result jsonb;
BEGIN
    -- Return default values for NULL user_id
    IF user_id_param IS NULL THEN
        RETURN jsonb_build_object(
            'total_pnl', 0,
            'win_rate', 0,
            'loss_rate', 0,
            'average_win', 0,
            'average_loss', 0,
            'largest_win', 0,
            'largest_loss', 0,
            'total_trades', 0,
            'winning_trades', 0,
            'losing_trades', 0,
            'breakeven_trades', 0
        );
    END IF;

    -- Calculate metrics with proper error handling
    WITH trade_metrics AS (
        SELECT
            COUNT(*) as total_trades,
            COUNT(*) FILTER (WHERE COALESCE(pnl, 0) > 0) as winning_trades,
            COUNT(*) FILTER (WHERE COALESCE(pnl, 0) < 0) as losing_trades,
            COUNT(*) FILTER (WHERE COALESCE(pnl, 0) = 0) as breakeven_trades,
            COALESCE(SUM(COALESCE(pnl, 0)), 0) as total_pnl,
            COALESCE(AVG(pnl) FILTER (WHERE COALESCE(pnl, 0) > 0), 0) as average_win,
            COALESCE(AVG(pnl) FILTER (WHERE COALESCE(pnl, 0) < 0), 0) as average_loss,
            COALESCE(MAX(COALESCE(pnl, 0)), 0) as largest_win,
            COALESCE(MIN(COALESCE(pnl, 0)), 0) as largest_loss
        FROM trades
        WHERE user_id = user_id_param
    )
    SELECT
        jsonb_build_object(
            'total_pnl', COALESCE(tm.total_pnl, 0),
            'win_rate', CASE 
                WHEN NULLIF(tm.total_trades, 0) IS NOT NULL THEN 
                    ROUND((tm.winning_trades::numeric / NULLIF(tm.total_trades, 0)) * 100, 2)
                ELSE 0 
            END,
            'loss_rate', CASE 
                WHEN NULLIF(tm.total_trades, 0) IS NOT NULL THEN 
                    ROUND((tm.losing_trades::numeric / NULLIF(tm.total_trades, 0)) * 100, 2)
                ELSE 0 
            END,
            'average_win', ROUND(COALESCE(tm.average_win, 0)::numeric, 2),
            'average_loss', ROUND(COALESCE(tm.average_loss, 0)::numeric, 2),
            'largest_win', COALESCE(tm.largest_win, 0),
            'largest_loss', COALESCE(tm.largest_loss, 0),
            'total_trades', COALESCE(tm.total_trades, 0),
            'winning_trades', COALESCE(tm.winning_trades, 0),
            'losing_trades', COALESCE(tm.losing_trades, 0),
            'breakeven_trades', COALESCE(tm.breakeven_trades, 0)
        )
    INTO result
    FROM trade_metrics tm;

    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        -- Return default values on any error
        RETURN jsonb_build_object(
            'total_pnl', 0,
            'win_rate', 0,
            'loss_rate', 0,
            'average_win', 0,
            'average_loss', 0,
            'largest_win', 0,
            'largest_loss', 0,
            'total_trades', 0,
            'winning_trades', 0,
            'losing_trades', 0,
            'breakeven_trades', 0
        );
END;
$$;

-- Create function to update analytics
CREATE OR REPLACE FUNCTION update_analytics_and_performance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only proceed if we have a valid user_id
    IF (TG_OP = 'DELETE' AND OLD.user_id IS NOT NULL) OR (NEW.user_id IS NOT NULL) THEN
        -- Upsert into user_performance
        INSERT INTO user_performance (user_id, metrics, updated_at)
        VALUES (
            CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END,
            calculate_period_performance(CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END),
            CURRENT_TIMESTAMP
        )
        ON CONFLICT (user_id) 
        DO UPDATE SET
            metrics = EXCLUDED.metrics,
            updated_at = CURRENT_TIMESTAMP;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error if possible and continue
        RAISE NOTICE 'Error in update_analytics_and_performance: %', SQLERRM;
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
END;
$$;

-- Create trigger
CREATE TRIGGER update_analytics_trigger
    AFTER INSERT OR UPDATE OR DELETE ON trades
    FOR EACH ROW
    EXECUTE FUNCTION update_analytics_and_performance();

-- Update existing user performance records
INSERT INTO user_performance (user_id, metrics)
SELECT DISTINCT user_id, calculate_period_performance(user_id)
FROM trades
WHERE user_id IS NOT NULL
ON CONFLICT (user_id) 
DO UPDATE SET
    metrics = EXCLUDED.metrics,
    updated_at = CURRENT_TIMESTAMP; 