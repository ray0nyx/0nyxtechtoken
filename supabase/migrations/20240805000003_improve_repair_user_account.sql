-- Migration to improve the repair_user_account function

-- Drop and recreate the repair_user_account function with better error handling
DROP FUNCTION IF EXISTS public.repair_user_account(TEXT);

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
    v_subscription_exists BOOLEAN;
    v_account_exists BOOLEAN;
BEGIN
    -- Log function call for debugging
    RAISE NOTICE 'repair_user_account called for email: %', p_email;
    
    -- Find user in auth.users
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = p_email;
    
    IF v_user_id IS NULL THEN
        RAISE NOTICE 'User not found in auth.users: %', p_email;
        RETURN json_build_object('success', false, 'error', 'User not found in auth system');
    END IF;
    
    RAISE NOTICE 'Found user with ID: % in auth.users', v_user_id;
    
    -- Check existing records
    SELECT EXISTS(SELECT 1 FROM public.users WHERE id = v_user_id) INTO v_existing;
    SELECT EXISTS(SELECT 1 FROM public.user_subscriptions WHERE user_id = v_user_id) INTO v_subscription_exists;
    
    -- For trading accounts, first check if the table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'trading_accounts'
    ) THEN
        SELECT EXISTS(SELECT 1 FROM public.trading_accounts WHERE user_id = v_user_id) INTO v_account_exists;
    ELSE
        v_account_exists := FALSE;
    END IF;
    
    -- Log current state
    RAISE NOTICE 'Current state for user %: user_record=%, subscription=%, trading_account=%', 
        v_user_id, v_existing, v_subscription_exists, v_account_exists;
    
    -- 1. Create or update user record
    BEGIN
        IF v_existing THEN
            -- Update existing record
            UPDATE public.users
            SET email = p_email,
                updated_at = NOW()
            WHERE id = v_user_id;
            
            RAISE NOTICE 'Updated existing user record for ID: %', v_user_id;
        ELSE
            -- Create new record
            INSERT INTO public.users (id, email, created_at, updated_at)
            VALUES (v_user_id, p_email, NOW(), NOW());
            
            RAISE NOTICE 'Created new user record for ID: %', v_user_id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error managing user record: %, SQLSTATE: %', SQLERRM, SQLSTATE;
        -- Continue with other steps even if this fails
    END;
    
    -- 2. Create subscription if missing
    BEGIN
        IF NOT v_subscription_exists THEN
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
            
            RAISE NOTICE 'Created new subscription record for user ID: %', v_user_id;
        ELSE
            RAISE NOTICE 'Subscription already exists for user ID: %', v_user_id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error managing subscription: %, SQLSTATE: %', SQLERRM, SQLSTATE;
        -- Continue with other steps even if this fails
    END;
    
    -- 3. Create trading account if missing and table exists
    BEGIN
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'trading_accounts'
        ) AND NOT v_account_exists THEN
            INSERT INTO public.trading_accounts (
                user_id, 
                name, 
                broker, 
                account_number, 
                is_demo, 
                is_active
            )
            VALUES (
                v_user_id, 
                'Default Tradovate Account', 
                'tradovate', 
                'DEFAULT', 
                FALSE, 
                TRUE
            );
            
            RAISE NOTICE 'Created default trading account for user ID: %', v_user_id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error creating trading account: %, SQLSTATE: %', SQLERRM, SQLSTATE;
        -- Continue even if this fails
    END;
    
    -- Return success result
    RETURN json_build_object(
        'success', true, 
        'user_id', v_user_id,
        'user_record_exists', v_existing,
        'subscription_exists', v_subscription_exists,
        'account_exists', v_account_exists
    );
EXCEPTION WHEN OTHERS THEN
    -- Catch any unexpected errors
    RAISE NOTICE 'Unexpected error in repair_user_account: %, SQLSTATE: %', SQLERRM, SQLSTATE;
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.repair_user_account(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.repair_user_account(TEXT) TO anon; 