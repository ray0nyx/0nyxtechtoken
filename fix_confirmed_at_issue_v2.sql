-- Fix for the confirmed_at column issue in user registration
-- This script addresses the specific error: "column confirmed_at can only be updated to DEFAULT"

-- Update the trigger function to avoid modifying confirmed_at directly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_subscription_id UUID;
BEGIN
  -- Log the trigger activation for debugging
  RAISE LOG 'handle_new_user trigger activated for user_id: %, email: %', NEW.id, NEW.email;
  
  -- Create user record - simplified to avoid errors
  BEGIN
    -- Insert new user if not exists
    INSERT INTO public.users (id, email, created_at, updated_at)
    VALUES (
      NEW.id, 
      NEW.email, 
      COALESCE(NEW.created_at, NOW()), 
      COALESCE(NEW.updated_at, NOW())
    )
    ON CONFLICT (id) DO UPDATE 
    SET 
      email = NEW.email,
      updated_at = COALESCE(NEW.updated_at, NOW());
      
    RAISE LOG 'User record managed for ID: %', NEW.id;
  EXCEPTION WHEN OTHERS THEN
    -- Log error but continue
    RAISE LOG 'Error managing user record: %, SQLSTATE: %', SQLERRM, SQLSTATE;
  END;
  
  -- Create subscription record - simplified to avoid errors
  BEGIN
    -- Only create if not exists
    IF NOT EXISTS (SELECT 1 FROM public.user_subscriptions WHERE user_id = NEW.id) THEN
      -- Generate a UUID for the subscription
      v_subscription_id := gen_random_uuid();
      
      -- Create trial subscription record
      INSERT INTO public.user_subscriptions (
        id,
        user_id,
        status,
        access_level,
        email,
        created_at,
        updated_at
      ) VALUES (
        v_subscription_id,
        NEW.id,
        'trial',
        'dashboard_only',
        NEW.email,
        NOW(),
        NOW()
      );
      
      RAISE LOG 'Created subscription record with ID: % for user: %', v_subscription_id, NEW.id;
    ELSE
      RAISE LOG 'User % already has a subscription record', NEW.id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Log but don't fail the whole process
    RAISE LOG 'Error creating subscription: %, SQLSTATE: %', SQLERRM, SQLSTATE;
  END;
  
  -- Always return NEW to allow the sign-up to complete
  RETURN NEW;
END;
$function$;

-- Make sure the handle_new_user trigger is properly set up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Drop and recreate constraints with more permissive values
ALTER TABLE public.user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_status_check;
ALTER TABLE public.user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_access_level_check;

ALTER TABLE public.user_subscriptions ADD CONSTRAINT user_subscriptions_status_check 
CHECK (status = ANY (ARRAY['trial'::text, 'active'::text, 'canceled'::text, 'expired'::text, 'pending'::text, NULL]));

ALTER TABLE public.user_subscriptions ADD CONSTRAINT user_subscriptions_access_level_check 
CHECK (access_level = ANY (ARRAY['dashboard_only'::text, 'full_access'::text, 'none'::text, NULL]));

-- Remove the auto-confirm trigger since it's causing issues
DROP TRIGGER IF EXISTS auto_confirm_user ON auth.users;
DROP FUNCTION IF EXISTS auth.auto_confirm_user(); 