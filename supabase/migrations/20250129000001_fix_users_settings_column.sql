-- Fix missing 'settings' column in users table for SIWS authentication
-- The siws-verify Edge Function requires this column to create new users

-- Check if the users table exists and add the settings column if it doesn't exist
DO $$
BEGIN
    -- Check if users table exists
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
        -- Check if settings column exists
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'users' 
            AND column_name = 'settings'
        ) THEN
            ALTER TABLE public.users ADD COLUMN settings JSONB DEFAULT '{}'::jsonb;
            RAISE NOTICE 'Added settings column to users table';
        ELSE
            RAISE NOTICE 'Settings column already exists in users table';
        END IF;
    ELSE
        -- Create the users table if it doesn't exist
        CREATE TABLE public.users (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
            settings JSONB DEFAULT '{}'::jsonb
        );
        RAISE NOTICE 'Created users table with settings column';
        
        -- Enable RLS
        ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
        
        -- Create insert policy for service role
        CREATE POLICY "Service role can insert users"
            ON public.users FOR INSERT
            WITH CHECK (true);
    END IF;
END $$;

-- Also ensure identities table exists with correct schema
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'identities') THEN
        CREATE TABLE public.identities (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            provider TEXT NOT NULL CHECK (provider IN ('google', 'wallet', 'email')),
            provider_id TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
            UNIQUE(provider, provider_id)
        );
        
        ALTER TABLE public.identities ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Service role can insert identities"
            ON public.identities FOR INSERT
            WITH CHECK (true);
            
        RAISE NOTICE 'Created identities table';
    END IF;
END $$;

-- Ensure siws_nonces table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'siws_nonces') THEN
        CREATE TABLE public.siws_nonces (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            nonce TEXT NOT NULL UNIQUE,
            public_key TEXT,
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
            used_at TIMESTAMP WITH TIME ZONE
        );
        
        ALTER TABLE public.siws_nonces ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Anyone can insert nonces"
            ON public.siws_nonces FOR INSERT
            WITH CHECK (true);
        
        CREATE POLICY "Anyone can read nonces"
            ON public.siws_nonces FOR SELECT
            USING (true);
        
        CREATE POLICY "Service role can update nonces"
            ON public.siws_nonces FOR UPDATE
            USING (true);
            
        RAISE NOTICE 'Created siws_nonces table';
    END IF;
END $$;

-- Grant permissions
GRANT ALL ON public.users TO service_role;
GRANT ALL ON public.identities TO service_role;
GRANT ALL ON public.siws_nonces TO service_role;
GRANT INSERT, SELECT ON public.siws_nonces TO anon;
