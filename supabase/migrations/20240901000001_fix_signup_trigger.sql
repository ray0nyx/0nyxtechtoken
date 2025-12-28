-- Migration to fix signup trigger issues
-- This migration addresses the "Database error saving new user" problem

-- First, disable the existing trigger temporarily to prevent it from interfering
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Ensure the user_subscriptions table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'user_subscriptions'
  ) THEN
    CREATE TABLE public.user_subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      access_level TEXT NOT NULL DEFAULT 'none',
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      current_period_end TIMESTAMP WITH TIME ZONE,
      cancel_at_period_end BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Set RLS policies
    ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
  END IF;
END
$$;

-- Drop existing RLS policies on user_subscriptions to recreate them
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Users can view their own subscription" ON public.user_subscriptions;
  DROP POLICY IF EXISTS "Service role can manage all subscriptions" ON public.user_subscriptions;
  DROP POLICY IF EXISTS "Allow service role full access" ON public.user_subscriptions;
EXCEPTION WHEN OTHERS THEN
  -- Ignore errors if policies don't exist
  RAISE NOTICE 'Error dropping policies: %', SQLERRM;
END
$$;

-- Create new policies with proper permissions
CREATE POLICY "Users can view their own subscription"
  ON public.user_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Allow service role full access"
  ON public.user_subscriptions
  USING (auth.role() = 'service_role');

-- Create a more resilient handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
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
        created_at,
        updated_at
      ) VALUES (
        v_subscription_id,
        NEW.id,
        'pending',
        'none',
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

-- Create the trigger
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create a utility function to repair user accounts
DROP FUNCTION IF EXISTS public.repair_user_account(TEXT);

CREATE OR REPLACE FUNCTION public.repair_user_account(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_result BOOLEAN := FALSE;
BEGIN
  -- Get the user ID from auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_email;
  
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Ensure user exists in public.users
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_user_id) THEN
    INSERT INTO public.users (id, email, created_at, updated_at)
    VALUES (
      v_user_id,
      p_email,
      NOW(),
      NOW()
    );
    v_result := TRUE;
  END IF;
  
  -- Ensure user has a subscription
  IF NOT EXISTS (SELECT 1 FROM public.user_subscriptions WHERE user_id = v_user_id) THEN
    INSERT INTO public.user_subscriptions (
      id,
      user_id,
      status,
      access_level,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      'pending',
      'none',
      NOW(),
      NOW()
    );
    v_result := TRUE;
  END IF;
  
  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'Error in repair_user_account: %, SQLSTATE: %', SQLERRM, SQLSTATE;
  RETURN FALSE;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres;
GRANT EXECUTE ON FUNCTION public.repair_user_account(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.repair_user_account(TEXT) TO service_role;

-- Ensure the service role has access to the tables
GRANT ALL ON public.users TO service_role;
GRANT ALL ON public.user_subscriptions TO service_role; 