-- Fix RLS policy for master_traders to allow authenticated users to insert (for seeding)
-- Allow authenticated users to insert/update master traders for seeding purposes

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Service role can manage master traders" ON master_traders;

-- Create new policy that allows authenticated users to insert/update
CREATE POLICY "Authenticated users can manage master traders"
  ON master_traders FOR ALL
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Also allow inserts for seeding (any authenticated user can seed)
CREATE POLICY "Allow master traders seeding"
  ON master_traders FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

