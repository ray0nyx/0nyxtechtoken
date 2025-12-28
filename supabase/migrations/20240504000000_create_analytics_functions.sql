-- Create or replace the analytics view
CREATE OR REPLACE VIEW analytics_view AS
SELECT 
    t.user_id,
    t.date,
    COUNT(*) as total_trades,
    SUM(CASE WHEN t.pnl > 0 THEN 1 ELSE 0 END) as winning_trades,
    SUM(CASE WHEN t.pnl < 0 THEN 1 ELSE 0 END) as losing_trades,
    SUM(t.pnl) as total_pnl,
    AVG(t.pnl) as average_pnl,
    MAX(t.pnl) as largest_win,
    MIN(t.pnl) as largest_loss,
    CASE 
        WHEN SUM(CASE WHEN t.pnl < 0 THEN 1 ELSE 0 END) > 0 
        THEN SUM(CASE WHEN t.pnl > 0 THEN t.pnl ELSE 0 END) / NULLIF(ABS(SUM(CASE WHEN t.pnl < 0 THEN t.pnl ELSE 0 END)), 0)
        ELSE 0
    END as profit_factor
FROM 
    trades t
GROUP BY 
    t.user_id, t.date;

-- Create a function to get analytics data for a user
CREATE OR REPLACE FUNCTION get_user_analytics(user_uuid UUID)
RETURNS TABLE (
    date date,
    total_trades bigint,
    winning_trades bigint,
    losing_trades bigint,
    total_pnl numeric,
    average_pnl numeric,
    largest_win numeric,
    largest_loss numeric,
    profit_factor numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        av.date,
        av.total_trades,
        av.winning_trades,
        av.losing_trades,
        av.total_pnl,
        av.average_pnl,
        av.largest_win,
        av.largest_loss,
        av.profit_factor
    FROM 
        analytics_view av
    WHERE 
        av.user_id = user_uuid
    ORDER BY 
        av.date DESC;
END;
$$ LANGUAGE plpgsql;

-- Create a function to populate the analytics table
CREATE OR REPLACE FUNCTION populate_analytics_table(user_uuid UUID)
RETURNS void AS $$
DECLARE
    analytics_record RECORD;
BEGIN
    -- Clear existing analytics for this user
    DELETE FROM analytics_table WHERE user_id = user_uuid;
    
    -- Insert overall metrics
    FOR analytics_record IN 
        SELECT 
            user_id,
            COUNT(*) as total_trades,
            SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as winning_trades,
            SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losing_trades,
            SUM(pnl) as total_pnl,
            AVG(pnl) as average_pnl
        FROM 
            trades
        WHERE 
            user_id = user_uuid
        GROUP BY 
            user_id
    LOOP
        INSERT INTO analytics_table (
            user_id, 
            metric_name, 
            total_trades, 
            total_pnl,
            created_at
        ) VALUES (
            user_uuid,
            'overall_metrics',
            analytics_record.total_trades,
            analytics_record.total_pnl,
            NOW()
        );
    END LOOP;
    
    -- Insert monthly metrics
    FOR analytics_record IN 
        SELECT 
            user_id,
            DATE_TRUNC('month', date) as month_date,
            COUNT(*) as total_trades,
            SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as winning_trades,
            SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losing_trades,
            SUM(pnl) as total_pnl,
            AVG(pnl) as average_pnl
        FROM 
            trades
        WHERE 
            user_id = user_uuid
        GROUP BY 
            user_id, DATE_TRUNC('month', date)
    LOOP
        INSERT INTO analytics_table (
            user_id, 
            metric_name, 
            date,
            total_trades, 
            total_pnl,
            created_at
        ) VALUES (
            user_uuid,
            'monthly_metrics',
            analytics_record.month_date::date,
            analytics_record.total_trades,
            analytics_record.total_pnl,
            NOW()
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql; 