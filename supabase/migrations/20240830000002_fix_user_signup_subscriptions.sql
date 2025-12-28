-- Migration to fix user signup issues
-- This migration enhances error handling and ensures the user_subscriptions table exists

-- First, check if the user_subscriptions table exists and create it if needed
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
    
    -- Create policy to allow users to see their own subscription
    CREATE POLICY "Users can view their own subscription"
      ON public.user_subscriptions
      FOR SELECT
      USING (auth.uid() = user_id);
    
    -- Create policy to allow service role to manage all subscriptions
    CREATE POLICY "Service role can manage all subscriptions"
      ON public.user_subscriptions
      USING (auth.role() = 'service_role');
  END IF;
END
$$;

-- Drop and recreate the handle_new_user function with enhanced error handling
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subscription_id UUID;
  v_user_exists BOOLEAN;
BEGIN
  -- Log the trigger activation for debugging
  RAISE NOTICE 'handle_new_user trigger activated for user_id: %, email: %', NEW.id, NEW.email;
  
  -- Check if the user already exists in the users table
  SELECT EXISTS(SELECT 1 FROM public.users WHERE id = NEW.id) INTO v_user_exists;
  
  -- Create or update the user record
  BEGIN
    IF v_user_exists THEN
      -- Update if exists
      UPDATE public.users
      SET email = NEW.email,
          updated_at = COALESCE(NEW.updated_at, NOW())
      WHERE id = NEW.id;
      
      RAISE NOTICE 'Updated existing user record for ID: %', NEW.id;
    ELSE
      -- Insert new user
      INSERT INTO public.users (id, email, created_at, updated_at)
      VALUES (
        NEW.id, 
        NEW.email, 
        COALESCE(NEW.created_at, NOW()), 
        COALESCE(NEW.updated_at, NOW())
      );
      
      RAISE NOTICE 'Created new user record for ID: %', NEW.id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Log error but continue
    RAISE NOTICE 'Error managing user record: %, SQLSTATE: %', SQLERRM, SQLSTATE;
  END;
  
  -- Check if user already has a subscription
  IF NOT EXISTS (SELECT 1 FROM public.user_subscriptions WHERE user_id = NEW.id) THEN
    -- Create subscription record with isolated error handling
    BEGIN
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
      
      RAISE NOTICE 'Created subscription record with ID: % for user: %', v_subscription_id, NEW.id;
    EXCEPTION WHEN OTHERS THEN
      -- Log but don't fail the whole process
      RAISE NOTICE 'Error creating subscription: %, SQLSTATE: %', SQLERRM, SQLSTATE;
    END;
  ELSE
    RAISE NOTICE 'User % already has a subscription record', NEW.id;
  END IF;
  
  -- Create default trading accounts if needed
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'trading_accounts'
    ) AND NOT EXISTS (SELECT 1 FROM public.trading_accounts WHERE user_id = NEW.id) THEN
      -- Create a default Tradovate account
      INSERT INTO trading_accounts (user_id, name, broker, account_number, is_demo, is_active)
      VALUES (NEW.id, 'Default Tradovate Account', 'tradovate', 'DEFAULT', FALSE, TRUE);
      
      RAISE NOTICE 'Created default trading account for user: %', NEW.id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Log but continue
    RAISE NOTICE 'Error creating trading accounts: %, SQLSTATE: %', SQLERRM, SQLSTATE;
  END;
  
  -- Always return NEW to allow the sign-up to complete
  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create a repair function that can be called directly for existing users
DROP FUNCTION IF EXISTS public.ensure_user_has_subscription(UUID);

CREATE OR REPLACE FUNCTION public.ensure_user_has_subscription(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result BOOLEAN := FALSE;
BEGIN
  -- Check if user exists but has no subscription
  IF EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) AND 
     NOT EXISTS (SELECT 1 FROM public.user_subscriptions WHERE user_id = p_user_id) THEN
    
    -- Create the missing subscription
    INSERT INTO public.user_subscriptions (
      id,
      user_id,
      status,
      access_level,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      p_user_id,
      'pending',
      'none',
      NOW(),
      NOW()
    );
    
    v_result := TRUE;
  END IF;
  
  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error in ensure_user_has_subscription: %, SQLSTATE: %', SQLERRM, SQLSTATE;
  RETURN FALSE;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_user_has_subscription(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_user_has_subscription(UUID) TO service_role; 