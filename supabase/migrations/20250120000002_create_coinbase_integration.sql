-- Coinbase Integration Tables
-- Tables for Coinbase OAuth authentication and data integration

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Coinbase accounts table
CREATE TABLE IF NOT EXISTS coinbase_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    coinbase_user_id TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    permissions TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, coinbase_user_id)
);

-- Coinbase trades table
CREATE TABLE IF NOT EXISTS coinbase_trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    coinbase_account_id UUID NOT NULL REFERENCES coinbase_accounts(id) ON DELETE CASCADE,
    coinbase_trade_id TEXT NOT NULL,
    order_id TEXT,
    pair TEXT NOT NULL,
    trade_time TIMESTAMPTZ NOT NULL,
    trade_type TEXT NOT NULL CHECK (trade_type IN ('buy', 'sell')),
    order_type TEXT NOT NULL,
    price DECIMAL(20,8) NOT NULL,
    cost DECIMAL(20,8) NOT NULL,
    fee DECIMAL(20,8) NOT NULL,
    volume DECIMAL(20,8) NOT NULL,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(coinbase_account_id, coinbase_trade_id)
);

-- Coinbase balances table
CREATE TABLE IF NOT EXISTS coinbase_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    coinbase_account_id UUID NOT NULL REFERENCES coinbase_accounts(id) ON DELETE CASCADE,
    asset TEXT NOT NULL,
    free_balance DECIMAL(20,8) NOT NULL DEFAULT 0,
    used_balance DECIMAL(20,8) NOT NULL DEFAULT 0,
    total_balance DECIMAL(20,8) NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(coinbase_account_id, asset)
);

-- Coinbase market data cache table
CREATE TABLE IF NOT EXISTS coinbase_market_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol TEXT NOT NULL,
    price DECIMAL(20,8) NOT NULL,
    volume DECIMAL(20,8) NOT NULL,
    change_24h DECIMAL(20,8) NOT NULL,
    high_24h DECIMAL(20,8) NOT NULL,
    low_24h DECIMAL(20,8) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(symbol, timestamp)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_coinbase_accounts_user_id ON coinbase_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_coinbase_accounts_is_active ON coinbase_accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_coinbase_trades_user_id ON coinbase_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_coinbase_trades_coinbase_account_id ON coinbase_trades(coinbase_account_id);
CREATE INDEX IF NOT EXISTS idx_coinbase_trades_trade_time ON coinbase_trades(trade_time);
CREATE INDEX IF NOT EXISTS idx_coinbase_trades_pair ON coinbase_trades(pair);
CREATE INDEX IF NOT EXISTS idx_coinbase_balances_user_id ON coinbase_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_coinbase_balances_coinbase_account_id ON coinbase_balances(coinbase_account_id);
CREATE INDEX IF NOT EXISTS idx_coinbase_market_data_symbol ON coinbase_market_data(symbol);
CREATE INDEX IF NOT EXISTS idx_coinbase_market_data_timestamp ON coinbase_market_data(timestamp);

-- Row Level Security Policies
ALTER TABLE coinbase_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE coinbase_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE coinbase_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE coinbase_market_data ENABLE ROW LEVEL SECURITY;

-- Coinbase accounts policies
CREATE POLICY "Users can view their own coinbase accounts" ON coinbase_accounts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own coinbase accounts" ON coinbase_accounts
    FOR ALL USING (auth.uid() = user_id);

-- Coinbase trades policies
CREATE POLICY "Users can view their own coinbase trades" ON coinbase_trades
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own coinbase trades" ON coinbase_trades
    FOR ALL USING (auth.uid() = user_id);

-- Coinbase balances policies
CREATE POLICY "Users can view their own coinbase balances" ON coinbase_balances
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own coinbase balances" ON coinbase_balances
    FOR ALL USING (auth.uid() = user_id);

-- Market data policies (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view coinbase market data" ON coinbase_market_data
    FOR SELECT USING (auth.role() = 'authenticated');

-- Add updated_at triggers
CREATE TRIGGER update_coinbase_accounts_updated_at
    BEFORE UPDATE ON coinbase_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_coinbase_trades_updated_at
    BEFORE UPDATE ON coinbase_trades
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_coinbase_balances_updated_at
    BEFORE UPDATE ON coinbase_balances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to get user's coinbase account summary
CREATE OR REPLACE FUNCTION get_coinbase_account_summary(p_user_id UUID)
RETURNS TABLE (
    account_id UUID,
    coinbase_user_id TEXT,
    is_active BOOLEAN,
    total_balance DECIMAL(20,8),
    trade_count BIGINT,
    last_trade_date TIMESTAMPTZ,
    last_sync_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ca.id as account_id,
        ca.coinbase_user_id,
        ca.is_active,
        COALESCE(SUM(cb.total_balance), 0) as total_balance,
        COUNT(ct.id) as trade_count,
        MAX(ct.trade_time) as last_trade_date,
        ca.last_sync_at
    FROM coinbase_accounts ca
    LEFT JOIN coinbase_balances cb ON ca.id = cb.coinbase_account_id
    LEFT JOIN coinbase_trades ct ON ca.id = ct.coinbase_account_id
    WHERE ca.user_id = p_user_id
    GROUP BY ca.id, ca.coinbase_user_id, ca.is_active, ca.last_sync_at;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE coinbase_accounts IS 'Coinbase OAuth connected accounts';
COMMENT ON TABLE coinbase_trades IS 'Synced trades from Coinbase accounts';
COMMENT ON TABLE coinbase_balances IS 'Account balances from Coinbase';
COMMENT ON TABLE coinbase_market_data IS 'Cached market data from Coinbase';

