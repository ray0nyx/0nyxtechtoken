-- Fix column mismatches between TypeScript types and database schema

-- Ensure position column is properly defined in trades table
ALTER TABLE trades ALTER COLUMN position TYPE text;
ALTER TABLE trades ALTER COLUMN position SET NOT NULL;

-- Ensure entry_price and exit_price have consistent types
ALTER TABLE trades ALTER COLUMN entry_price TYPE numeric(10,2);
ALTER TABLE trades ALTER COLUMN exit_price TYPE numeric(10,2);

-- Ensure quantity is properly defined
ALTER TABLE trades ALTER COLUMN quantity TYPE integer;

-- Ensure pnl column is properly defined
ALTER TABLE trades ALTER COLUMN pnl TYPE numeric(10,2);

-- Ensure date column is properly defined
ALTER TABLE trades ALTER COLUMN date TYPE date;

-- Create or update analytics view for easier querying
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