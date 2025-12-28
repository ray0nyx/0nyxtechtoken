-- Fix user registration issues

-- First, let's check for users without subscription records
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

-- Now let's update the trigger function to ensure it works correctly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_subscription_id UUID;
  v_user_exists BOOLEAN;
BEGIN
  -- Log the trigger activation for debugging
  RAISE LOG 'handle_new_user trigger activated for user_id: %, email: %', NEW.id, NEW.email;
  
  -- Check if the user already exists in the users table
  BEGIN
    SELECT EXISTS(SELECT 1 FROM public.users WHERE id = NEW.id) INTO v_user_exists;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error checking if user exists: %', SQLERRM;
    v_user_exists := FALSE;
  END;
  
  -- Create or update the user record
  BEGIN
    IF v_user_exists THEN
      -- Update if exists
      UPDATE public.users
      SET email = NEW.email,
          updated_at = COALESCE(NEW.updated_at, NOW())
      WHERE id = NEW.id;
      
      RAISE LOG 'Updated existing user record for ID: %', NEW.id;
    ELSE
      -- Insert new user
      INSERT INTO public.users (id, email, created_at, updated_at)
      VALUES (
        NEW.id, 
        NEW.email, 
        COALESCE(NEW.created_at, NOW()), 
        COALESCE(NEW.updated_at, NOW())
      );
      
      RAISE LOG 'Created new user record for ID: %', NEW.id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Log error but continue
    RAISE LOG 'Error managing user record: %, SQLSTATE: %', SQLERRM, SQLSTATE;
  END;
  
  -- Check if user already has a subscription
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.user_subscriptions WHERE user_id = NEW.id) THEN
      -- Generate a UUID for the subscription
      v_subscription_id := gen_random_uuid();
      
      -- Create pending subscription record
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

-- Verify the trigger is set up correctly
SELECT tgname, tgtype, tgenabled 
FROM pg_trigger 
WHERE tgrelid = 'auth.users'::regclass 
AND tgname = 'on_auth_user_created';

-- Output a success message
DO $$
BEGIN
    RAISE NOTICE 'User registration fix script completed successfully.';
END $$; 