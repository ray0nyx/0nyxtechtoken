-- Create Relational Identity Model
-- This migration creates the new users, identities, and watchlists tables
-- to support multiple authentication providers (Google, Email, Solana Wallet)

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create users table (primary user entity)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    settings JSONB DEFAULT '{}'::jsonb
);

-- Create identities table (links authentication providers to users)
CREATE TABLE IF NOT EXISTS public.identities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('google', 'wallet', 'email')),
    provider_id TEXT NOT NULL, -- email address or Solana publicKey
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(provider, provider_id)
);

-- Create watchlists table (for Solana tokens)
CREATE TABLE IF NOT EXISTS public.watchlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token_mint TEXT NOT NULL, -- Solana token mint address
    token_symbol TEXT,
    token_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, token_mint)
);

-- Create siws_nonces table for SIWS authentication
CREATE TABLE IF NOT EXISTS public.siws_nonces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nonce TEXT NOT NULL UNIQUE,
    public_key TEXT, -- Optional: associate nonce with a public key
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_identities_user_id ON public.identities(user_id);
CREATE INDEX IF NOT EXISTS idx_identities_provider_id ON public.identities(provider, provider_id);
CREATE INDEX IF NOT EXISTS idx_watchlists_user_id ON public.watchlists(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlists_token_mint ON public.watchlists(token_mint);
CREATE INDEX IF NOT EXISTS idx_siws_nonces_nonce ON public.siws_nonces(nonce);
CREATE INDEX IF NOT EXISTS idx_siws_nonces_expires_at ON public.siws_nonces(expires_at);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.siws_nonces ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view their own user record"
    ON public.users FOR SELECT
    USING (
        id IN (
            SELECT user_id FROM public.identities 
            WHERE provider_id = COALESCE(
                (SELECT email FROM auth.users WHERE id = auth.uid())::text,
                NULL
            )
        )
    );

CREATE POLICY "Users can update their own user record"
    ON public.users FOR UPDATE
    USING (
        id IN (
            SELECT user_id FROM public.identities 
            WHERE provider_id = COALESCE(
                (SELECT email FROM auth.users WHERE id = auth.uid())::text,
                NULL
            )
        )
    );

-- RLS Policies for identities table
CREATE POLICY "Users can view their own identities"
    ON public.identities FOR SELECT
    USING (
        user_id IN (
            SELECT user_id FROM public.identities 
            WHERE provider_id = COALESCE(
                (SELECT email FROM auth.users WHERE id = auth.uid())::text,
                NULL
            )
        )
    );

-- RLS Policies for watchlists table
CREATE POLICY "Users can view their own watchlists"
    ON public.watchlists FOR SELECT
    USING (
        user_id IN (
            SELECT user_id FROM public.identities 
            WHERE provider_id = COALESCE(
                (SELECT email FROM auth.users WHERE id = auth.uid())::text,
                NULL
            )
        )
    );

CREATE POLICY "Users can insert their own watchlists"
    ON public.watchlists FOR INSERT
    WITH CHECK (
        user_id IN (
            SELECT user_id FROM public.identities 
            WHERE provider_id = COALESCE(
                (SELECT email FROM auth.users WHERE id = auth.uid())::text,
                NULL
            )
        )
    );

CREATE POLICY "Users can delete their own watchlists"
    ON public.watchlists FOR DELETE
    USING (
        user_id IN (
            SELECT user_id FROM public.identities 
            WHERE provider_id = COALESCE(
                (SELECT email FROM auth.users WHERE id = auth.uid())::text,
                NULL
            )
        )
    );

-- RLS Policies for siws_nonces table (public read for nonce generation, restricted for verification)
CREATE POLICY "Anyone can insert nonces"
    ON public.siws_nonces FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Anyone can read nonces for verification"
    ON public.siws_nonces FOR SELECT
    USING (true);

CREATE POLICY "Service role can update nonces"
    ON public.siws_nonces FOR UPDATE
    USING (true);

-- Create trigger to update updated_at column for users
CREATE OR REPLACE FUNCTION public.handle_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_users_updated_at();

-- Create trigger to update updated_at column for identities
CREATE OR REPLACE FUNCTION public.handle_identities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_identities_updated_at
    BEFORE UPDATE ON public.identities
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_identities_updated_at();

-- Create function to clean up expired nonces (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_nonces()
RETURNS void AS $$
BEGIN
    DELETE FROM public.siws_nonces
    WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON TABLE public.users IS 'Primary user entity with UUID primary key and JSONB settings';
COMMENT ON TABLE public.identities IS 'Links authentication providers (Google, Email, Solana Wallet) to users';
COMMENT ON TABLE public.watchlists IS 'User watchlists for Solana tokens';
COMMENT ON TABLE public.siws_nonces IS 'Nonces for Sign-In With Solana (SIWS) authentication';
