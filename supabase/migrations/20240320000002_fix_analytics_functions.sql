-- Drop existing trigger and functions
DROP TRIGGER IF EXISTS update_analytics_trigger ON trades;
DROP FUNCTION IF EXISTS calculate_period_performance(uuid) CASCADE;
DROP FUNCTION IF EXISTS update_analytics_and_performance() CASCADE;

-- Recreate calculate_period_performance with NULL handling
CREATE OR REPLACE FUNCTION calculate_period_performance(user_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    result jsonb;
BEGIN
    -- Check for NULL user_id
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

    -- Calculate metrics only if trades exist
    WITH trade_metrics AS (
        SELECT
            COUNT(*) as total_trades,
            COUNT(*) FILTER (WHERE pnl > 0) as winning_trades,
            COUNT(*) FILTER (WHERE pnl < 0) as losing_trades,
            COUNT(*) FILTER (WHERE pnl = 0) as breakeven_trades,
            COALESCE(SUM(pnl), 0) as total_pnl,
            COALESCE(AVG(pnl) FILTER (WHERE pnl > 0), 0) as average_win,
            COALESCE(AVG(pnl) FILTER (WHERE pnl < 0), 0) as average_loss,
            COALESCE(MAX(pnl), 0) as largest_win,
            COALESCE(MIN(pnl), 0) as largest_loss
        FROM trades
        WHERE user_id = user_id_param
    )
    SELECT
        jsonb_build_object(
            'total_pnl', COALESCE(tm.total_pnl, 0),
            'win_rate', CASE 
                WHEN tm.total_trades > 0 THEN 
                    ROUND((tm.winning_trades::numeric / tm.total_trades) * 100, 2)
                ELSE 0 
            END,
            'loss_rate', CASE 
                WHEN tm.total_trades > 0 THEN 
                    ROUND((tm.losing_trades::numeric / tm.total_trades) * 100, 2)
                ELSE 0 
            END,
            'average_win', ROUND(tm.average_win::numeric, 2),
            'average_loss', ROUND(tm.average_loss::numeric, 2),
            'largest_win', tm.largest_win,
            'largest_loss', tm.largest_loss,
            'total_trades', tm.total_trades,
            'winning_trades', tm.winning_trades,
            'losing_trades', tm.losing_trades,
            'breakeven_trades', tm.breakeven_trades
        )
    INTO result
    FROM trade_metrics tm;

    RETURN COALESCE(result, jsonb_build_object(
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
    ));
END;
$$;

-- Recreate update_analytics_and_performance with better error handling
CREATE OR REPLACE FUNCTION update_analytics_and_performance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    affected_user_id uuid;
BEGIN
    -- Determine which user_id to use
    affected_user_id := CASE 
        WHEN TG_OP = 'DELETE' THEN OLD.user_id 
        ELSE NEW.user_id 
    END;

    -- Only proceed if we have a valid user_id
    IF affected_user_id IS NOT NULL THEN
        -- Update the user's performance metrics
        UPDATE user_performance
        SET 
            metrics = calculate_period_performance(affected_user_id),
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = affected_user_id;

        -- Insert if not exists
        IF NOT FOUND THEN
            INSERT INTO user_performance (user_id, metrics)
            VALUES (affected_user_id, calculate_period_performance(affected_user_id));
        END IF;
    END IF;

    -- Return appropriate record based on operation
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS update_analytics_trigger ON trades;
CREATE TRIGGER update_analytics_trigger
    AFTER INSERT OR UPDATE OR DELETE ON trades
    FOR EACH ROW
    EXECUTE FUNCTION update_analytics_and_performance(); 