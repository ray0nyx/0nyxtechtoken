-- Migration: Add a policy to allow authenticated users to view all trades for the leaderboard
-- Description: This policy enables the leaderboard to display top 100 users to all authenticated users

-- Record the migration
INSERT INTO migration_log (migration_name, description, executed_at)
VALUES ('20240715000000_add_leaderboard_read_policy', 'Add policy to allow authenticated users to view trades for leaderboard', NOW());

-- Create a policy that allows authenticated users to view all trades for leaderboard purposes
DO $$
BEGIN
    -- Drop policy if it exists
    DROP POLICY IF EXISTS "Authenticated users can view all trades for leaderboard" ON public.trades;
    
    -- Create policy
    CREATE POLICY "Authenticated users can view all trades for leaderboard"
        ON public.trades FOR SELECT
        USING (true)
        TO authenticated;
END
$$;

-- Grant users the ability to execute the leaderboard function
GRANT EXECUTE ON FUNCTION public.get_monthly_leaderboard() TO authenticated;

COMMENT ON POLICY "Authenticated users can view all trades for leaderboard" ON public.trades
  IS 'Allows authenticated users to view all trades for the purpose of displaying the leaderboard'; 