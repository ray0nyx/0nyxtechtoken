-- Migrate existing users from auth.users to new users table
-- This script preserves all existing user data and creates identities

-- Function to migrate a single user
CREATE OR REPLACE FUNCTION public.migrate_user_to_new_model(auth_user_id UUID)
RETURNS UUID AS $$
DECLARE
    new_user_id UUID;
    user_email TEXT;
    user_settings JSONB;
BEGIN
    -- Get user email
    SELECT email INTO user_email
    FROM auth.users
    WHERE id = auth_user_id;
    
    -- Skip if user already migrated
    IF EXISTS (
        SELECT 1 FROM public.identities i
        JOIN public.users u ON u.id = i.user_id
        WHERE i.provider = 'email' AND i.provider_id = user_email
    ) THEN
        SELECT user_id INTO new_user_id
        FROM public.identities
        WHERE provider = 'email' AND provider_id = user_email
        LIMIT 1;
        RETURN new_user_id;
    END IF;
    
    -- Get existing user settings if they exist
    SELECT jsonb_build_object(
        'dark_mode', COALESCE(us.dark_mode, false),
        'notifications', COALESCE(us.notifications, true),
        'email_alerts', COALESCE(us.email_alerts, false)
    ) INTO user_settings
    FROM user_settings us
    WHERE us.user_id = auth_user_id
    LIMIT 1;
    
    -- If no settings exist, use empty object
    IF user_settings IS NULL THEN
        user_settings := '{}'::jsonb;
    END IF;
    
    -- Create new user record
    INSERT INTO public.users (id, created_at, updated_at, settings)
    VALUES (
        auth_user_id, -- Use same UUID to maintain relationships
        COALESCE((SELECT created_at FROM auth.users WHERE id = auth_user_id), NOW()),
        NOW(),
        user_settings
    )
    ON CONFLICT (id) DO UPDATE SET
        settings = EXCLUDED.settings,
        updated_at = NOW()
    RETURNING id INTO new_user_id;
    
    -- Create email identity if email exists
    IF user_email IS NOT NULL THEN
        INSERT INTO public.identities (user_id, provider, provider_id, created_at, updated_at)
        VALUES (
            new_user_id,
            'email',
            user_email,
            COALESCE((SELECT created_at FROM auth.users WHERE id = auth_user_id), NOW()),
            NOW()
        )
        ON CONFLICT (provider, provider_id) DO NOTHING;
    END IF;
    
    -- Check if user has Google OAuth identity
    IF EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = auth_user_id
        AND raw_app_meta_data->>'provider' = 'google'
    ) THEN
        INSERT INTO public.identities (user_id, provider, provider_id, created_at, updated_at)
        VALUES (
            new_user_id,
            'google',
            user_email, -- Google uses email as provider_id
            COALESCE((SELECT created_at FROM auth.users WHERE id = auth_user_id), NOW()),
            NOW()
        )
        ON CONFLICT (provider, provider_id) DO NOTHING;
    END IF;
    
    RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migrate all existing users
DO $$
DECLARE
    auth_user RECORD;
    migrated_count INTEGER := 0;
BEGIN
    FOR auth_user IN 
        SELECT id, email, created_at
        FROM auth.users
        WHERE email IS NOT NULL
        ORDER BY created_at
    LOOP
        BEGIN
            PERFORM public.migrate_user_to_new_model(auth_user.id);
            migrated_count := migrated_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Failed to migrate user %: %', auth_user.id, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE 'Migrated % users to new identity model', migrated_count;
END $$;

-- Create a helper function to get user_id from any identity
CREATE OR REPLACE FUNCTION public.get_user_id_from_identity(
    p_provider TEXT,
    p_provider_id TEXT
)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT user_id INTO v_user_id
    FROM public.identities
    WHERE provider = p_provider
    AND provider_id = p_provider_id
    LIMIT 1;
    
    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a helper function to link a new identity to an existing user
CREATE OR REPLACE FUNCTION public.link_identity_to_user(
    p_user_id UUID,
    p_provider TEXT,
    p_provider_id TEXT
)
RETURNS UUID AS $$
DECLARE
    v_identity_id UUID;
BEGIN
    INSERT INTO public.identities (user_id, provider, provider_id, created_at, updated_at)
    VALUES (p_user_id, p_provider, p_provider_id, NOW(), NOW())
    ON CONFLICT (provider, provider_id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        updated_at = NOW()
    RETURNING id INTO v_identity_id;
    
    RETURN v_identity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON FUNCTION public.migrate_user_to_new_model IS 'Migrates a single user from auth.users to the new users/identities model';
COMMENT ON FUNCTION public.get_user_id_from_identity IS 'Gets user_id from a provider and provider_id';
COMMENT ON FUNCTION public.link_identity_to_user IS 'Links a new identity to an existing user';
