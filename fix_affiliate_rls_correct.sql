-- Fix RLS policy for affiliate_applications to allow public signup
-- Based on the actual table structure (no user_id column, uses email instead)

-- Add a policy to allow public inserts (anyone can submit an affiliate application)
CREATE POLICY "Allow public affiliate applications" ON affiliate_applications
  FOR INSERT WITH CHECK (true);

-- The existing policies are:
-- 1. "Admin users can access all affiliate applications" - allows specific admin user
-- 2. "Service role can access all affiliate applications" - allows service role
-- 3. "Users can view their own affiliate application" - allows users to view by email

-- These existing policies are fine and don't need to be changed
