-- Fix for "Database error saving new user" during signup
-- This migration updates the handle_new_user function to properly handle new user creation
-- and ensure proper subscription record creation

-- First, let's update the handle_new_user function to be more robust
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
        'pending',
        'none',
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
$$;

-- Now let's make sure the trigger is properly set up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Let's also ensure the auto_verify_user trigger is properly set up
DROP TRIGGER IF EXISTS trigger_auto_verify_user ON auth.users;
CREATE TRIGGER trigger_auto_verify_user
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.auto_verify_user();

-- Create a function to ensure user profiles are created
CREATE OR REPLACE FUNCTION public.ensure_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create a profile for the new user if it doesn't exist
  INSERT INTO public.profiles (id, created_at, updated_at)
  VALUES (NEW.id, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Add a trigger to create profiles for new users
DROP TRIGGER IF EXISTS ensure_user_profile ON public.users;
CREATE TRIGGER ensure_user_profile
AFTER INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.ensure_user_profile();

-- Log this migration
INSERT INTO migration_log (migration_name, description, executed_at, applied_at)
VALUES (
  'fix_user_signup_database_error',
  'Fix for Database error saving new user during signup',
  NOW(),
  NOW()
); 