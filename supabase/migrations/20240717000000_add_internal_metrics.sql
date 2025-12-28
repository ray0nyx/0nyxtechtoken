-- Migration: Add internal metrics to leaderboard function
-- Description: Track win rate and profit factor internally without affecting the output structure

-- Record the migration
INSERT INTO migration_log (migration_name, description, executed_at)
VALUES ('20240717000000_add_internal_metrics', 'Add internal tracking of win rate and profit factor to the leaderboard function', NOW());

-- Drop the existing function
DROP FUNCTION IF EXISTS public.get_monthly_leaderboard();

-- Create updated function that tracks metrics internally
CREATE OR REPLACE FUNCTION public.get_monthly_leaderboard()
RETURNS TABLE (
  id UUID,
  trader_name TEXT,
  monthly_pnl NUMERIC,
  rank BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create a temporary table to hold the metrics
  CREATE TEMP TABLE trader_metrics ON COMMIT DROP AS
  WITH TraderResults AS (
    SELECT 
      p.id,
      COALESCE(p.username, 'Anonymous Trader') as trader_name,
      SUM(t.pnl) as monthly_pnl,
      SUM(CASE WHEN t.pnl > 0 THEN 1 ELSE 0 END) as winning_trades,
      SUM(CASE WHEN t.pnl < 0 THEN 1 ELSE 0 END) as losing_trades,
      SUM(CASE WHEN t.pnl > 0 THEN t.pnl ELSE 0 END) as gross_profit,
      SUM(CASE WHEN t.pnl < 0 THEN ABS(t.pnl) ELSE 0 END) as gross_loss,
      COUNT(t.id) as total_trades
    FROM 
      profiles p
    JOIN 
      trades t ON p.id = t.user_id
    WHERE 
      t.date >= date_trunc('month', CURRENT_DATE)
      AND t.pnl IS NOT NULL
    GROUP BY 
      p.id, p.username
  )
  SELECT
    tr.id,
    tr.trader_name,
    tr.monthly_pnl,
    CASE 
      WHEN tr.total_trades > 0 THEN (tr.winning_trades::NUMERIC / tr.total_trades) * 100 
      ELSE 0 
    END as win_rate,
    CASE 
      WHEN tr.gross_loss > 0 THEN tr.gross_profit / tr.gross_loss
      WHEN tr.gross_profit > 0 THEN 999  -- When profit but no loss
      ELSE 0                           -- When no profit and no loss
    END as profit_factor,
    RANK() OVER (ORDER BY tr.monthly_pnl DESC) as rank
  FROM 
    TraderResults tr;

  -- Log the metrics for potential analysis (optional)
  PERFORM pg_notify(
    'trader_metrics_updated',
    (SELECT json_agg(row_to_json(m)) FROM trader_metrics m)::text
  );

  -- Return just the fields we want to expose
  RETURN QUERY
  SELECT
    tm.id,
    tm.trader_name,
    tm.monthly_pnl,
    tm.rank
  FROM
    trader_metrics tm
  ORDER BY
    tm.rank
  LIMIT 100;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_monthly_leaderboard() TO authenticated;

-- Add comment to the function
COMMENT ON FUNCTION public.get_monthly_leaderboard() IS 'Returns the top 100 traders ranked by their monthly P&L for the current month, with internal tracking of win rate and profit factor'; 