-- Ensure users are redirected to dashboard after payment 
-- This migration fixes the redirect URL to make sure users go to the dashboard

-- Update stripe redirect URL function if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_proc 
    WHERE proname = 'get_redirect_url' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    -- Update the function to redirect to dashboard
    CREATE OR REPLACE FUNCTION public.get_redirect_url(user_id UUID)
    RETURNS TEXT AS $$
    DECLARE
      has_subscription BOOLEAN;
    BEGIN
      -- Check if user has any subscription
      SELECT EXISTS (
        SELECT 1 FROM public.subscriptions
        WHERE user_id = $1 AND (status = 'active' OR status = 'trialing')
      ) INTO has_subscription;
      
      -- If user has subscription, redirect to dashboard 
      -- Otherwise redirect to pricing
      IF has_subscription THEN
        RETURN '/app/dashboard';
      ELSE
        RETURN '/app/pricing';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Default to pricing on error
      RETURN '/app/pricing';
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  END IF;
END
$$; 