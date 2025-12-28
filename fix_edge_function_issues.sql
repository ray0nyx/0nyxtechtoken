-- Fix edge function issues and ensure 14-day trial for new users
-- Run this in the Supabase SQL Editor

-- Drop and recreate constraints with more permissive values
ALTER TABLE public.user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_status_check;
ALTER TABLE public.user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_access_level_check;

ALTER TABLE public.user_subscriptions ADD CONSTRAINT user_subscriptions_status_check 
CHECK (status = ANY (ARRAY['trial'::text, 'active'::text, 'canceled'::text, 'expired'::text, 'pending'::text, NULL]));

ALTER TABLE public.user_subscriptions ADD CONSTRAINT user_subscriptions_access_level_check 
CHECK (access_level = ANY (ARRAY['dashboard_only'::text, 'full_access'::text, 'none'::text, NULL]));

-- Make sure the handle_new_user trigger is properly set up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Update the trigger function to give new users a 14-day trial
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_subscription_id UUID;
  v_trial_start_date TIMESTAMP WITH TIME ZONE;
  v_trial_end_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Log the trigger activation for debugging
  RAISE LOG 'handle_new_user trigger activated for user_id: %, email: %', NEW.id, NEW.email;
  
  -- Set trial dates
  v_trial_start_date := NOW();
  v_trial_end_date := v_trial_start_date + INTERVAL '14 days';
  
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
  
  -- Create subscription record with 14-day trial
  BEGIN
    -- Only create if not exists
    IF NOT EXISTS (SELECT 1 FROM public.user_subscriptions WHERE user_id = NEW.id) THEN
      -- Generate a UUID for the subscription
      v_subscription_id := gen_random_uuid();
      
      -- Create trial subscription record with 14-day trial period
      INSERT INTO public.user_subscriptions (
        id,
        user_id,
        status,
        access_level,
        email,
        created_at,
        updated_at,
        trial_start_date,
        trial_end_date,
        current_period_start,
        current_period_end
      ) VALUES (
        v_subscription_id,
        NEW.id,
        'trial',
        'full_access',  -- Give full access during trial
        NEW.email,
        NOW(),
        NOW(),
        v_trial_start_date,
        v_trial_end_date,
        v_trial_start_date,
        v_trial_end_date
      );
      
      RAISE LOG 'Created trial subscription record with ID: % for user: %, trial ends: %', 
        v_subscription_id, NEW.id, v_trial_end_date;
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

-- Create the trigger
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Remove any auto-confirm triggers that might be causing issues
DROP TRIGGER IF EXISTS auto_confirm_user ON auth.users;
DROP FUNCTION IF EXISTS auth.auto_confirm_user();

-- Create a repair function to fix user accounts
CREATE OR REPLACE FUNCTION public.repair_user_account(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_subscription_id UUID;
  v_trial_start_date TIMESTAMP WITH TIME ZONE;
  v_trial_end_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Find the user ID from auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_email;
  
  IF v_user_id IS NULL THEN
    RAISE LOG 'User with email % not found in auth.users', p_email;
    RETURN FALSE;
  END IF;
  
  -- Set trial dates
  v_trial_start_date := NOW();
  v_trial_end_date := v_trial_start_date + INTERVAL '14 days';
  
  -- Ensure user exists in public.users
  INSERT INTO public.users (id, email, created_at, updated_at)
  VALUES (
    v_user_id,
    p_email,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = p_email,
    updated_at = NOW();
    
  -- Ensure user has a subscription
  IF NOT EXISTS (SELECT 1 FROM public.user_subscriptions WHERE user_id = v_user_id) THEN
    v_subscription_id := gen_random_uuid();
    
    INSERT INTO public.user_subscriptions (
      id,
      user_id,
      status,
      access_level,
      email,
      created_at,
      updated_at,
      trial_start_date,
      trial_end_date,
      current_period_start,
      current_period_end
    ) VALUES (
      v_subscription_id,
      v_user_id,
      'trial',
      'full_access',
      p_email,
      NOW(),
      NOW(),
      v_trial_start_date,
      v_trial_end_date,
      v_trial_start_date,
      v_trial_end_date
    );
    
    RAISE LOG 'Created subscription for user %', v_user_id;
  ELSE
    RAISE LOG 'User % already has a subscription', v_user_id;
  END IF;
  
  RETURN TRUE;
END;
$$; 