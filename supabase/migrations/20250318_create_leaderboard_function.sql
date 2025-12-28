-- Create a function to get the monthly leaderboard data
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
  RETURN QUERY
  WITH MonthlyPnL AS (
    SELECT 
      p.id,
      COALESCE(p.first_name || ' ' || p.last_name, 'Anonymous Trader') as trader_name,
      SUM(t.pnl) as monthly_pnl
    FROM 
      profiles p
    JOIN 
      trades t ON p.id = t.user_id
    WHERE 
      t.date >= date_trunc('month', CURRENT_DATE)
      AND t.pnl IS NOT NULL
    GROUP BY 
      p.id, trader_name
  )
  SELECT 
    mp.id,
    mp.trader_name,
    mp.monthly_pnl,
    RANK() OVER (ORDER BY mp.monthly_pnl DESC) as rank
  FROM 
    MonthlyPnL mp
  ORDER BY 
    mp.monthly_pnl DESC
  LIMIT 100;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_monthly_leaderboard() TO authenticated;

-- Add comment to the function
COMMENT ON FUNCTION public.get_monthly_leaderboard() IS 'Returns the top 100 traders ranked by their monthly P&L for the current month'; 