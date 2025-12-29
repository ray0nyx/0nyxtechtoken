-- Fix SIWS user creation by adding proper RLS policies
-- This migration ensures the service role can insert users and identities

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Service role can insert users" ON public.users;
DROP POLICY IF EXISTS "Service role can insert identities" ON public.identities;

-- Allow service role to insert users (for SIWS authentication)
-- Note: Service role should bypass RLS, but we add this as a safety net
CREATE POLICY "Service role can insert users"
    ON public.users FOR INSERT
    WITH CHECK (true);

-- Allow service role to insert identities (for SIWS authentication)
CREATE POLICY "Service role can insert identities"
    ON public.identities FOR INSERT
    WITH CHECK (true);

-- Grant necessary permissions to service_role
GRANT INSERT ON public.users TO service_role;
GRANT INSERT ON public.identities TO service_role;
GRANT SELECT ON public.users TO service_role;
GRANT SELECT ON public.identities TO service_role;
GRANT UPDATE ON public.users TO service_role;
GRANT UPDATE ON public.identities TO service_role;
GRANT INSERT ON public.siws_nonces TO service_role;
GRANT SELECT ON public.siws_nonces TO service_role;
GRANT UPDATE ON public.siws_nonces TO service_role;
GRANT DELETE ON public.siws_nonces TO service_role;

-- Also grant to anon role for the nonce operations
GRANT INSERT ON public.siws_nonces TO anon;
GRANT SELECT ON public.siws_nonces TO anon;

-- Verify the policies exist using a comment (for documentation)
COMMENT ON POLICY "Service role can insert users" ON public.users IS 'Allows SIWS Edge Function to create new users';
COMMENT ON POLICY "Service role can insert identities" ON public.identities IS 'Allows SIWS Edge Function to create new identities';
