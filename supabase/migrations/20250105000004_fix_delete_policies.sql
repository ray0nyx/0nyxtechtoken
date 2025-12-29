-- Add missing DELETE policies for Copy Trading tables
BEGIN;

-- For master_traders
DROP POLICY IF EXISTS "Authenticated users can delete master traders" ON master_traders;
CREATE POLICY "Authenticated users can delete master traders"
  ON master_traders FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- For copy_trading_leaderboard
DROP POLICY IF EXISTS "Authenticated users can delete leaderboard entries" ON copy_trading_leaderboard;
CREATE POLICY "Authenticated users can delete leaderboard entries"
  ON copy_trading_leaderboard FOR DELETE
  USING (auth.uid() IS NOT NULL);

COMMIT;
