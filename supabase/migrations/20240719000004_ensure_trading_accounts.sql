-- Ensure the trading_accounts table exists
CREATE TABLE IF NOT EXISTS trading_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    name TEXT NOT NULL,
    broker TEXT NOT NULL,
    account_number TEXT,
    is_demo BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Add RLS policy to allow users to access their own accounts
ALTER TABLE trading_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trading_accounts_user_policy ON trading_accounts;
CREATE POLICY trading_accounts_user_policy ON trading_accounts 
    FOR ALL 
    TO authenticated 
    USING (user_id = auth.uid());

-- Allow querying on trading_accounts
GRANT SELECT, INSERT, UPDATE, DELETE ON trading_accounts TO authenticated;

-- Create an updated trigger for the updated_at column
CREATE OR REPLACE FUNCTION trading_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create or replace the trigger
DROP TRIGGER IF EXISTS set_trading_accounts_updated_at ON trading_accounts;
CREATE TRIGGER set_trading_accounts_updated_at
BEFORE UPDATE ON trading_accounts
FOR EACH ROW
EXECUTE FUNCTION trading_accounts_updated_at(); 