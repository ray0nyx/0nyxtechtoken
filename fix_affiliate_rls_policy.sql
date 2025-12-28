-- Fix RLS policy for affiliate_applications to allow public signup
-- This allows anyone to submit an affiliate application without being authenticated

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can create applications" ON affiliate_applications;

-- Create a new policy that allows public inserts (no authentication required)
CREATE POLICY "Allow public affiliate applications" ON affiliate_applications
  FOR INSERT WITH CHECK (true);

-- Keep the existing policy for users to view their own applications (if they have a user_id)
-- This policy only applies when user_id is not null
DROP POLICY IF EXISTS "Users can view own applications" ON affiliate_applications;
CREATE POLICY "Users can view own applications" ON affiliate_applications
  FOR SELECT USING (user_id IS NULL OR auth.uid() = user_id);

-- Keep the admin policy unchanged
-- Admins can still view and manage all applications
DROP POLICY IF EXISTS "Admins can view all applications" ON affiliate_applications;
CREATE POLICY "Admins can view all applications" ON affiliate_applications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_subscriptions 
      WHERE user_id = auth.uid() 
      AND (is_developer = true OR user_id IN ('a541b0e8-b16f-4963-a764-dfb5bf95c972', '8538e0b7-6dcd-4673-b39f-00d273c7fc76'))
    )
  );

-- Also create a policy for admins to manage applications
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
