-- Fix the handle_new_user function to remove the reference to connected_accounts column
-- which is causing the error in user creation

-- 1. Update the handle_new_user function that's called during user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trial_start_date timestamptz;
  v_trial_end_date timestamptz;
  is_protonmail BOOLEAN;
BEGIN
  -- Check if it's a ProtonMail email
  is_protonmail := NEW.email LIKE '%@proton.%' OR 
                   NEW.email LIKE '%@pm.%' OR 
                   NEW.email LIKE '%@protonmail.%' OR
                   NEW.email LIKE '%@proton.me';
                   
  -- Set trial dates
  v_trial_start_date := NOW();
  v_trial_end_date := v_trial_start_date + INTERVAL '7 days';

  -- Create subscription record WITHOUT the connected_accounts column
  -- Only include columns that actually exist in the table
  INSERT INTO public.user_subscriptions (
    id,
    user_id,
    status,
    trial_start_date,
    trial_end_date,
    email,
    access_level,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    NEW.id,
    'trial',
    v_trial_start_date,
    v_trial_end_date,
    NEW.email,
    'full_access',
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;  -- Added conflict handling

  -- For ProtonMail users, set email_confirmed_at
  IF is_protonmail THEN
    UPDATE auth.users
    SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"is_protonmail": true}'::jsonb
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't block user creation
  RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 2. Create a special auto-verification trigger for ProtonMail users
CREATE OR REPLACE FUNCTION auto_verify_protonmail()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if it's a ProtonMail email
  IF NEW.email LIKE '%@proton.%' OR 
     NEW.email LIKE '%@pm.%' OR 
     NEW.email LIKE '%@protonmail.%' OR
     NEW.email LIKE '%@proton.me' THEN
    
    -- Auto-verify ProtonMail users
    NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, NOW());
    
    -- Set metadata flag
    IF NEW.raw_user_meta_data IS NULL THEN
      NEW.raw_user_meta_data := jsonb_build_object('is_protonmail', true);
    ELSE
      NEW.raw_user_meta_data := NEW.raw_user_meta_data || jsonb_build_object('is_protonmail', true);
    END IF;
    
    RAISE NOTICE 'Auto-verified ProtonMail user: %', NEW.email;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Add the ProtonMail auto-verification trigger
DROP TRIGGER IF EXISTS auto_verify_protonmail_trigger ON auth.users;
CREATE TRIGGER auto_verify_protonmail_trigger
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION auto_verify_protonmail();

-- 4. Create a function to fix existing ProtonMail users if needed
CREATE OR REPLACE FUNCTION fix_protonmail_users()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- Find all ProtonMail users
  FOR user_record IN 
    SELECT id, email 
    FROM auth.users 
    WHERE email LIKE '%@proton.%' 
       OR email LIKE '%@pm.%' 
       OR email LIKE '%@protonmail.%'
       OR email LIKE '%@proton.me'
  LOOP
    -- Auto-verify their email if not already verified
    UPDATE auth.users
    SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"is_protonmail": true}'::jsonb
    WHERE id = user_record.id;
    
    -- Ensure they have a subscription
    BEGIN
      INSERT INTO user_subscriptions (
        id,
        user_id,
        status,
        trial_start_date,
        trial_end_date,
        email,
        access_level,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        user_record.id,
        'trial',
        NOW(),
        NOW() + INTERVAL '7 days',
        user_record.email,
        'full_access',
        NOW(),
        NOW()
      )
      ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error creating subscription for %: %', user_record.email, SQLERRM;
    END;
    
    RAISE NOTICE 'Fixed ProtonMail user: %', user_record.email;
  END LOOP;
END;
$$; 