-- Fix RLS policies for wallet tables to support SIWS wallet users
-- SIWS users don't have auth.uid() so we need service_role access

-- For wallet_tracking table
-- Allow service_role full access
DROP POLICY IF EXISTS "Service role can manage all wallet tracking" ON wallet_tracking;
CREATE POLICY "Service role can manage all wallet tracking"
  ON wallet_tracking
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions to service_role
GRANT ALL ON wallet_tracking TO service_role;

-- For user_wallets table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_wallets') THEN
    -- Allow service_role full access
    DROP POLICY IF EXISTS "Service role can manage all user wallets" ON public.user_wallets;
    CREATE POLICY "Service role can manage all user wallets"
      ON public.user_wallets
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
    
    -- Grant permissions to service_role
    GRANT ALL ON public.user_wallets TO service_role;
  END IF;
END $$;
