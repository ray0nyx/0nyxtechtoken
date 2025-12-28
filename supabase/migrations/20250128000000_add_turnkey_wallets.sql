-- Add Turnkey Wallet Support
-- Stores Turnkey wallet information for users

CREATE TABLE IF NOT EXISTS public.user_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    wallet_address TEXT NOT NULL,
    wallet_type TEXT NOT NULL DEFAULT 'turnkey' CHECK (wallet_type IN ('turnkey', 'phantom', 'solflare', 'hardware')),
    turnkey_wallet_id TEXT,
    turnkey_organization_id TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, wallet_address)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_wallets_user_id ON public.user_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_wallets_address ON public.user_wallets(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_wallets_turnkey_id ON public.user_wallets(turnkey_wallet_id) WHERE turnkey_wallet_id IS NOT NULL;

-- RLS Policies
ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;

-- Users can read their own wallets
CREATE POLICY "Users can read their own wallets"
    ON public.user_wallets
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own wallets
CREATE POLICY "Users can insert their own wallets"
    ON public.user_wallets
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own wallets
CREATE POLICY "Users can update their own wallets"
    ON public.user_wallets
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Comments
COMMENT ON TABLE public.user_wallets IS 'Stores wallet information for users, including Turnkey wallets';
COMMENT ON COLUMN public.user_wallets.turnkey_wallet_id IS 'Turnkey wallet ID for backend signature requests';
COMMENT ON COLUMN public.user_wallets.turnkey_organization_id IS 'Turnkey organization ID for backend signature requests';
