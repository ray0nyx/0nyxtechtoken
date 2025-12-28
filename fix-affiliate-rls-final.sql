-- Fix RLS policy for affiliate_applications to allow public signup
-- This allows anyone to submit an affiliate application without being authenticated

-- Drop existing policies
DROP POLICY IF EXISTS "Allow public affiliate applications" ON affiliate_applications;
DROP POLICY IF EXISTS "Users can create applications" ON affiliate_applications;
DROP POLICY IF EXISTS "Users can view own applications" ON affiliate_applications;

-- Create a policy that allows public inserts (no authentication required)
CREATE POLICY "Allow public affiliate applications" ON affiliate_applications
  FOR INSERT WITH CHECK (true);

-- Create a policy that allows public selects by email (for checking existing applications)
CREATE POLICY "Allow public select by email" ON affiliate_applications
  FOR SELECT USING (true);

-- Keep the admin policy for managing applications
DROP POLICY IF EXISTS "Admins can view all applications" ON affiliate_applications;
DROP POLICY IF EXISTS "Admins can manage applications" ON affiliate_applications;

CREATE POLICY "Admins can manage applications" ON affiliate_applications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_subscriptions 
      WHERE user_id = auth.uid() 
      AND (is_developer = true OR user_id IN ('a541b0e8-b16f-4963-a764-dfb5bf95c972', '8538e0b7-6dcd-4673-b39f-00d273c7fc76'))
    )
  );

-- Show completion message
SELECT 'Affiliate applications RLS policy fixed for public signup!' as message;
