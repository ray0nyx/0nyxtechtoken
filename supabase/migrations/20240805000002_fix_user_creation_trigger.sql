-- Migration to fix user creation trigger issues

-- First, let's drop the existing trigger to avoid conflicts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create a more robust handle_new_user function with better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subscription_id UUID;
BEGIN
  -- Log the trigger activation for debugging purposes
  RAISE NOTICE 'handle_new_user trigger activated for user_id: %, email: %', NEW.id, NEW.email;
  
  -- First, try to insert the user record with error handling
  BEGIN
    INSERT INTO public.users (id, email, created_at, updated_at)
    VALUES (
      NEW.id, 
      NEW.email, 
      COALESCE(NEW.created_at, NOW()), 
      COALESCE(NEW.updated_at, NOW())
    )
    ON CONFLICT (id) DO UPDATE 
    SET email = EXCLUDED.email,
        updated_at = EXCLUDED.updated_at;
  EXCEPTION WHEN OTHERS THEN
    -- Log error but continue with subscription setup
    RAISE NOTICE 'Error creating user record: %, SQLSTATE: %', SQLERRM, SQLSTATE;
  END;
  
  -- Next, try to set up the subscription record separately
  BEGIN
    -- Generate a UUID for the subscription
    v_subscription_id := gen_random_uuid();
    
    -- Create pending subscription record (no trial)
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
    )
    ON CONFLICT (user_id) DO NOTHING;
    
    RAISE NOTICE 'Created subscription record with ID: % for user: %', v_subscription_id, NEW.id;
  EXCEPTION WHEN OTHERS THEN
    -- Log subscription error but don't fail the whole process
    RAISE NOTICE 'Error creating subscription: %, SQLSTATE: %', SQLERRM, SQLSTATE;
  END;
  
  -- Create default trading accounts if the table exists
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'trading_accounts'
    ) THEN
      -- Create a default Tradovate account
      INSERT INTO trading_accounts (user_id, name, broker, account_number, is_demo, is_active)
      VALUES (NEW.id, 'Default Tradovate Account', 'tradovate', 'DEFAULT', FALSE, TRUE)
      ON CONFLICT (user_id, name) DO NOTHING;
      
      RAISE NOTICE 'Created default trading account for user: %', NEW.id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Log trading account error but continue
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated; 