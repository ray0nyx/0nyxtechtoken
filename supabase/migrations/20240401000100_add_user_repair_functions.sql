-- Drop functions that can be safely dropped
DROP FUNCTION IF EXISTS public.repair_user_account(text);
DROP FUNCTION IF EXISTS public.repair_missing_users();

-- We can't drop handle_new_user directly, so we'll replace it instead
-- Create a function to repair user accounts
CREATE OR REPLACE FUNCTION public.repair_user_account(p_email TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_result JSON;
    v_existing BOOLEAN;
BEGIN
    -- First check if the user exists in auth.users
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = p_email;
    
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User not found in auth system');
    END IF;
    
    -- Check if user already exists in public.users
    SELECT EXISTS(
        SELECT 1 FROM public.users WHERE id = v_user_id
    ) INTO v_existing;
    
    IF v_existing THEN
        -- User already exists, just return success
        RETURN json_build_object('success', true, 'message', 'User already exists');
    END IF;
    
    -- Create the user record in public.users
    BEGIN
        INSERT INTO public.users (id, email, created_at, updated_at)
        VALUES (
            v_user_id, 
            p_email,
            NOW(),
            NOW()
        );
        
        -- Initialize user metrics if possible
        BEGIN
            PERFORM initialize_user_metrics(v_user_id);
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Error initializing metrics for user %: %', v_user_id, SQLERRM;
            -- Continue anyway
        END;
        
        -- Check if user has a subscription
        DECLARE
            v_has_subscription BOOLEAN;
        BEGIN
            SELECT EXISTS(
                SELECT 1 FROM public.user_subscriptions 
                WHERE user_id = v_user_id
            ) INTO v_has_subscription;
            
            IF NOT v_has_subscription THEN
                -- Create a pending subscription record (no trial)
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
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Error creating subscription for user %: %', v_user_id, SQLERRM;
            -- Continue anyway
        END;
        
        RETURN json_build_object('success', true, 'user_id', v_user_id);
    EXCEPTION WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', SQLERRM);
    END;
END;
$$;

-- Create a function to repair all missing users
CREATE OR REPLACE FUNCTION public.repair_missing_users()
RETURNS TABLE(user_id UUID, email TEXT, status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user RECORD;
    v_result JSON;
BEGIN
    -- Find auth.users without corresponding public.users entries
    FOR v_user IN 
        SELECT au.id, au.email
        FROM auth.users au
        LEFT JOIN public.users pu ON au.id = pu.id
        WHERE pu.id IS NULL
    LOOP
        BEGIN
            v_result := repair_user_account(v_user.email);
            
            IF (v_result->>'success')::BOOLEAN THEN
                user_id := v_user.id;
                email := v_user.email;
                status := 'success';
                RETURN NEXT;
            ELSE
                user_id := v_user.id;
                email := v_user.email;
                status := 'error: ' || (v_result->>'error');
                RETURN NEXT;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            user_id := v_user.id;
            email := v_user.email;
            status := 'exception: ' || SQLERRM;
            RETURN NEXT;
        END;
    END LOOP;
    
    RETURN;
END;
$$;

-- Update the handle_new_user function instead of dropping it
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert a record into public.users with better error handling
  BEGIN
    INSERT INTO public.users (id, email, created_at, updated_at)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.created_at, NOW()), COALESCE(NEW.updated_at, NOW()))
    ON CONFLICT (id) DO NOTHING;

    -- Create a pending subscription status (no trial)
    INSERT INTO public.user_subscriptions (
      id,
      user_id,
      status,
      access_level,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      NEW.id,
      'pending',
      'none',
      NOW(),
      NOW()
    )
    ON CONFLICT (user_id) DO NOTHING;
        
  EXCEPTION WHEN OTHERS THEN
    -- Log detailed error information
    RAISE WARNING 'Error in handle_new_user trigger for user %: %, SQLSTATE: %', 
      NEW.email, SQLERRM, SQLSTATE;
      
    -- Try again with just the essential fields
    BEGIN
      INSERT INTO public.users (id, email, created_at, updated_at)
      VALUES (
        NEW.id, 
        NEW.email, 
        NOW(), 
        NOW()
      )
      ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      -- Final fallback with minimal fields
      RAISE WARNING 'Final fallback attempt for user % failed: %', NEW.id, SQLERRM;
    END;
  END;
  
  RETURN NEW;
END;
$$; 