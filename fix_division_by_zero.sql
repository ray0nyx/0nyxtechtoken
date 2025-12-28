-- Fix division by zero in calculate_trade_metrics function
CREATE OR REPLACE FUNCTION calculate_trade_metrics()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate Daily PnL
    NEW.daily_pnl = (
        SELECT SUM(profit)
        FROM trades
        WHERE DATE(exit_date) = DATE(NEW.exit_date)
          AND user_id = NEW.user_id
    );

    -- Calculate Cumulative PnL
    NEW.cumulative_pnl = (
        SELECT SUM(profit)
        FROM trades
        WHERE exit_date <= NEW.exit_date
          AND user_id = NEW.user_id
    );

    -- Calculate Win/Loss Distribution
    NEW.win_loss_distribution = (
        SELECT CONCAT(
            ROUND(100.0 * NULLIF(COUNT(*) FILTER (WHERE profit > 0), 0) / NULLIF(COUNT(*), 0), 2), '% Win / ',
            ROUND(100.0 * NULLIF(COUNT(*) FILTER (WHERE profit < 0), 0) / NULLIF(COUNT(*), 0), 2), '% Loss'
        )
        FROM trades
        WHERE user_id = NEW.user_id
    );

    -- Calculate Trade Duration PnL with NULLIF to prevent division by zero
    NEW.trade_duration_pnl = NEW.profit / NULLIF(EXTRACT(EPOCH FROM (NEW.exit_date - NEW.entry_date)), 0);

    -- Calculate Strategy Performance (example: average profit per trade)
    NEW.strategy_performance = (
        SELECT AVG(profit)
        FROM trades
        WHERE user_id = NEW.user_id
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql; 