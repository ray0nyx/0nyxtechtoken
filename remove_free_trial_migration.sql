-- Migration to remove free trial and require immediate payment
-- This will update the database to require payment upon signup

-- 1. Update the handle_new_user function to NOT create trial subscriptions
-- Instead, it will create a pending subscription that requires payment
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_subscription_id UUID;
  v_trial_start_date TIMESTAMP WITH TIME ZONE;
  v_trial_end_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Set trial dates (but won't be used for trial status)
  v_trial_start_date := NOW();
  v_trial_end_date := v_trial_start_date + INTERVAL '14 days';
  
  -- Ensure user exists in public.users
  BEGIN
    INSERT INTO public.users (id, email, created_at, updated_at)
    VALUES (
      NEW.id,
      NEW.email,
      NOW(),
      NOW()
    );
  EXCEPTION WHEN OTHERS THEN
    -- User might already exist, that's okay
    RAISE LOG 'User % already exists in public.users', NEW.id;
  END;
  
  -- Create subscription record with PENDING status (requires payment)
  BEGIN
    -- Only create if not exists
    IF NOT EXISTS (SELECT 1 FROM public.user_subscriptions WHERE user_id = NEW.id) THEN
      -- Generate a UUID for the subscription
      v_subscription_id := gen_random_uuid();
      
      -- Create PENDING subscription record (no trial, requires payment)
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
        'pending',  -- Changed from 'trial' to 'pending'
        'no_access',  -- Changed from 'full_access' to 'no_access'
        NEW.email,
        NOW(),
        NOW(),
        v_trial_start_date,
        v_trial_end_date,
        v_trial_start_date,
        v_trial_end_date
      );
      
      RAISE LOG 'Created PENDING subscription record with ID: % for user: %', 
        v_subscription_id, NEW.id;
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

-- 2. Update the is_subscription_valid function to not consider trials as valid
CREATE OR REPLACE FUNCTION is_subscription_valid(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  subscription_record user_subscriptions;
BEGIN
  SELECT * INTO subscription_record
  FROM user_subscriptions
  WHERE user_id = user_uuid;
  
  -- Only 'active' status is considered valid (removed trial check)
  RETURN subscription_record.status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update existing trial users to pending status (they need to pay)
UPDATE user_subscriptions 
SET status = 'pending', access_level = 'no_access'
WHERE status = 'trial';

-- 4. Add a comment to document the change
COMMENT ON FUNCTION public.handle_new_user() IS 'Creates pending subscription requiring payment - no free trial';
COMMENT ON FUNCTION is_subscription_valid(UUID) IS 'Only active subscriptions are valid - trials removed';
