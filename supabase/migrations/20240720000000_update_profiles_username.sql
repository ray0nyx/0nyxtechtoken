-- Migration: Update profiles table to use username instead of first_name and last_name
-- Description: Add username column to profiles table and migrate existing names

-- Record the migration
INSERT INTO migration_log (migration_name, description, executed_at)
VALUES ('20240720000000_update_profiles_username', 'Add username column and migrate from first_name/last_name', NOW());

-- Add username column if it doesn't exist
DO $$
BEGIN
    -- Check if username column exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'profiles'
        AND column_name = 'username'
    ) THEN
        -- Add username column
        ALTER TABLE public.profiles ADD COLUMN username text;
        
        -- Migrate existing first_name and last_name to username
        UPDATE public.profiles 
        SET username = TRIM(CONCAT(first_name, ' ', last_name))
        WHERE first_name IS NOT NULL OR last_name IS NOT NULL;
        
        -- Add index for username lookups
        CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
    END IF;
END $$;

-- Update get_monthly_leaderboard function to use username
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
      COALESCE(p.username, 
               CASE 
                 WHEN p.first_name IS NOT NULL OR p.last_name IS NOT NULL 
                 THEN TRIM(CONCAT(p.first_name, ' ', p.last_name))
                 ELSE 'Anonymous Trader'
               END) as trader_name,
      SUM(t.pnl) as monthly_pnl
    FROM 
      profiles p
    JOIN 
      trades t ON p.id = t.user_id
    WHERE 
      t.date >= date_trunc('month', CURRENT_DATE)
      AND t.pnl IS NOT NULL
    GROUP BY 
      p.id, p.username, p.first_name, p.last_name
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