-- Fix RLS policy for copy_trading_leaderboard to allow seeding
-- Allow authenticated users to insert/update leaderboard data

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Service role can manage leaderboard" ON copy_trading_leaderboard;

-- Create new policy that allows authenticated users to insert/update
CREATE POLICY "Authenticated users can manage leaderboard"
  ON copy_trading_leaderboard FOR ALL
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Also allow inserts for seeding (any authenticated user can seed)
CREATE POLICY "Allow leaderboard seeding"
  ON copy_trading_leaderboard FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

