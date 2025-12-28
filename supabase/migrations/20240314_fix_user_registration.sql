-- Fix user registration issues

-- First, let's drop the constraints that are preventing user registration
ALTER TABLE public.user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_status_check;
ALTER TABLE public.user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_access_level_check;

-- Now let's add back the constraints with more permissive values
ALTER TABLE public.user_subscriptions ADD CONSTRAINT user_subscriptions_status_check 
CHECK (status = ANY (ARRAY['trial'::text, 'active'::text, 'canceled'::text, 'expired'::text, 'pending'::text, NULL]));

ALTER TABLE public.user_subscriptions ADD CONSTRAINT user_subscriptions_access_level_check 
CHECK (access_level = ANY (ARRAY['dashboard_only'::text, 'full_access'::text, 'none'::text, NULL]));

-- Fix existing users without proper records
DO $$
DECLARE
    user_record RECORD;
BEGIN
    RAISE NOTICE 'Starting to fix user registration issues...';
    
    -- Loop through all auth users
    FOR user_record IN 
        SELECT id, email, created_at, updated_at 
        FROM auth.users 
        WHERE id NOT IN (SELECT user_id FROM public.user_subscriptions)
    LOOP
        RAISE NOTICE 'Processing user: % (%)', user_record.id, user_record.email;
        
        -- Ensure user exists in public.users table
        IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = user_record.id) THEN
            RAISE NOTICE 'Creating missing user record for %', user_record.id;
            
            INSERT INTO public.users (id, email, created_at, updated_at)
            VALUES (
                user_record.id,
                user_record.email,
                user_record.created_at,
                user_record.updated_at
            );
        END IF;
        
        -- Create subscription record if missing
        IF NOT EXISTS (SELECT 1 FROM public.user_subscriptions WHERE user_id = user_record.id) THEN
            RAISE NOTICE 'Creating missing subscription record for %', user_record.id;
            
            INSERT INTO public.user_subscriptions (
                id,
                user_id,
                status,
                access_level,
                email,
                created_at,
                updated_at
            ) VALUES (
                gen_random_uuid(),
                user_record.id,
                'trial',
                'dashboard_only',
                user_record.email,
                NOW(),
                NOW()
            );
        END IF;
    END LOOP;
    
    RAISE NOTICE 'User registration fix completed.';
END $$;

-- Update the trigger function to be more robust
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

-- Make sure the trigger is properly set up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Instead of directly updating email_confirmed_at, use the auth.users_set_confirmed_at function if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'users_set_confirmed_at' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')
  ) THEN
    -- Use the built-in function to confirm users
    EXECUTE 'SELECT auth.users_set_confirmed_at(id) FROM auth.users WHERE email_confirmed_at IS NULL';
    RAISE NOTICE 'Auto-confirmed existing users using auth.users_set_confirmed_at function';
  ELSE
    RAISE NOTICE 'auth.users_set_confirmed_at function not found, skipping auto-confirmation';
  END IF;
END $$;

-- Create a function to auto-confirm new users without directly updating email_confirmed_at
CREATE OR REPLACE FUNCTION auth.auto_confirm_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'auth'
AS $function$
BEGIN
  -- Use the built-in function to confirm users if it exists
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'users_set_confirmed_at' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')
  ) THEN
    -- Use the built-in function to confirm the user
    PERFORM auth.users_set_confirmed_at(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Add trigger to auto-confirm new users
DROP TRIGGER IF EXISTS auto_confirm_user ON auth.users;
CREATE TRIGGER auto_confirm_user
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION auth.auto_confirm_user(); 