-- Create a function to get comprehensive trade statistics for a user
CREATE OR REPLACE FUNCTION get_user_trade_stats(p_user_id UUID, p_period TEXT DEFAULT 'all')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    start_date DATE;
    result JSONB;
BEGIN
    -- Determine the start date based on the period
    CASE 
        WHEN p_period = 'daily' THEN
            start_date := CURRENT_DATE;
        WHEN p_period = 'weekly' THEN
            start_date := CURRENT_DATE - INTERVAL '7 days';
        WHEN p_period = 'monthly' THEN
            start_date := CURRENT_DATE - INTERVAL '30 days';
        ELSE -- 'all' or any other value
            start_date := '1900-01-01'::DATE; -- Far in the past to include all trades
    END CASE;
    
    -- Calculate trade statistics
    WITH user_trades AS (
        SELECT *
        FROM trades
        WHERE user_id = p_user_id
            AND entry_date::DATE >= start_date
    ),
    trade_stats AS (
        SELECT 
            COUNT(*) AS total_trades,
            COALESCE(SUM(pnl), 0) AS total_pnl,
            COUNT(*) FILTER (WHERE pnl > 0) AS winning_trades,
            COUNT(*) FILTER (WHERE pnl < 0) AS losing_trades,
            COUNT(*) FILTER (WHERE pnl = 0) AS break_even_trades,
            COALESCE(AVG(pnl), 0) AS avg_trade_pnl,
            COALESCE(AVG(pnl) FILTER (WHERE pnl > 0), 0) AS avg_winning_trade,
            COALESCE(AVG(pnl) FILTER (WHERE pnl < 0), 0) AS avg_losing_trade,
            COALESCE(MAX(pnl), 0) AS largest_profit,
            COALESCE(MIN(pnl), 0) AS largest_loss,
            COALESCE(SUM(pnl) FILTER (WHERE pnl > 0), 0) AS gross_profits,
            COALESCE(ABS(SUM(pnl) FILTER (WHERE pnl < 0)), 0) AS gross_losses,
            COALESCE(AVG(duration_seconds) / 60, 0) AS avg_hold_time_all,
            COALESCE(AVG(duration_seconds) FILTER (WHERE pnl > 0) / 60, 0) AS avg_hold_time_winning,
            COALESCE(AVG(duration_seconds) FILTER (WHERE pnl < 0) / 60, 0) AS avg_hold_time_losing,
            COALESCE(SUM(fees), 0) AS total_fees,
            COALESCE(SUM(COALESCE(extended_data->>'commission', '0')::NUMERIC), 0) AS total_commissions
        FROM user_trades
    ),
    day_stats AS (
        SELECT 
            DATE_TRUNC('day', entry_date)::DATE AS trade_day,
            SUM(pnl) AS daily_pnl,
            COUNT(*) AS daily_trades
        FROM user_trades
        GROUP BY DATE_TRUNC('day', entry_date)::DATE
    ),
    day_metrics AS (
        SELECT
            COUNT(DISTINCT trade_day) AS logged_days,
            COUNT(DISTINCT trade_day) FILTER (WHERE daily_pnl > 0) AS winning_days,
            COUNT(DISTINCT trade_day) FILTER (WHERE daily_pnl < 0) AS losing_days,
            COUNT(DISTINCT trade_day) FILTER (WHERE daily_pnl = 0) AS break_even_days,
            COALESCE(AVG(daily_pnl), 0) AS avg_daily_pnl,
            COALESCE(AVG(daily_pnl) FILTER (WHERE daily_pnl > 0), 0) AS avg_winning_day_pnl,
            COALESCE(AVG(daily_pnl) FILTER (WHERE daily_pnl < 0), 0) AS avg_losing_day_pnl,
            COALESCE(MAX(daily_pnl), 0) AS largest_profitable_day,
            COALESCE(MIN(daily_pnl), 0) AS largest_losing_day,
            COALESCE(AVG(daily_trades), 0) AS avg_daily_volume
        FROM day_stats
    ),
    -- Return all statistics as a JSON object
    combined_stats AS (
        SELECT 
            jsonb_build_object(
                'total_trades', total_trades,
                'total_pnl', total_pnl,
                'winning_trades', winning_trades,
                'losing_trades', losing_trades,
                'break_even_trades', break_even_trades,
                'avg_trade_pnl', avg_trade_pnl,
                'avg_winning_trade', avg_winning_trade,
                'avg_losing_trade', avg_losing_trade,
                'largest_profit', largest_profit,
                'largest_loss', largest_loss,
                'profit_factor', CASE 
                    WHEN gross_losses = 0 THEN 
                        CASE WHEN gross_profits > 0 THEN 999 ELSE 0 END
                    ELSE gross_profits / gross_losses 
                END,
                'trade_expectancy', (winning_trades::NUMERIC / NULLIF(total_trades, 0) * avg_winning_trade) + 
                                   (losing_trades::NUMERIC / NULLIF(total_trades, 0) * avg_losing_trade),
                'avg_hold_time_all', avg_hold_time_all,
                'avg_hold_time_winning', avg_hold_time_winning,
                'avg_hold_time_losing', avg_hold_time_losing,
                'total_fees', total_fees,
                'total_commissions', total_commissions,
                'logged_days', dm.logged_days,
                'winning_days', dm.winning_days,
                'losing_days', dm.losing_days,
                'break_even_days', dm.break_even_days,
                'avg_daily_pnl', dm.avg_daily_pnl,
                'avg_winning_day_pnl', dm.avg_winning_day_pnl,
                'avg_losing_day_pnl', dm.avg_losing_day_pnl,
                'largest_profitable_day', dm.largest_profitable_day,
                'largest_losing_day', dm.largest_losing_day,
                'avg_daily_volume', dm.avg_daily_volume,
                -- Default values for metrics we don't calculate directly yet
                'max_consecutive_wins', 0,
                'max_consecutive_losses', 0,
                'max_consecutive_winning_days', 0,
                'max_consecutive_losing_days', 0,
                'max_drawdown', 0,
                'max_drawdown_percentage', 0,
                'avg_drawdown', 0,
                'avg_drawdown_percentage', 0
            ) AS stats
        FROM trade_stats, day_metrics dm
    )
    SELECT stats INTO result FROM combined_stats;
    
    RETURN result;
END;
$$;

-- Grant access to the function for authenticated users
GRANT EXECUTE ON FUNCTION get_user_trade_stats(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION get_user_trade_stats IS 'Get comprehensive trade statistics for a user with period filtering'; 