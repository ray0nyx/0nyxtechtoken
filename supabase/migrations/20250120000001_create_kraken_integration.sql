-- Kraken Integration Tables
-- Tables for Kraken OAuth authentication and data integration

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Kraken accounts table
CREATE TABLE IF NOT EXISTS kraken_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    kraken_user_id TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    permissions TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, kraken_user_id)
);

-- Kraken trades table
CREATE TABLE IF NOT EXISTS kraken_trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    kraken_account_id UUID NOT NULL REFERENCES kraken_accounts(id) ON DELETE CASCADE,
    kraken_trade_id TEXT NOT NULL,
    order_id TEXT,
    pair TEXT NOT NULL,
    trade_time TIMESTAMPTZ NOT NULL,
    trade_type TEXT NOT NULL CHECK (trade_type IN ('buy', 'sell')),
    order_type TEXT NOT NULL,
    price DECIMAL(20,8) NOT NULL,
    cost DECIMAL(20,8) NOT NULL,
    fee DECIMAL(20,8) NOT NULL,
    volume DECIMAL(20,8) NOT NULL,
    margin DECIMAL(20,8),
    misc TEXT,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(kraken_account_id, kraken_trade_id)
);

-- Kraken balances table
CREATE TABLE IF NOT EXISTS kraken_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    kraken_account_id UUID NOT NULL REFERENCES kraken_accounts(id) ON DELETE CASCADE,
    asset TEXT NOT NULL,
    free_balance DECIMAL(20,8) NOT NULL DEFAULT 0,
    used_balance DECIMAL(20,8) NOT NULL DEFAULT 0,
    total_balance DECIMAL(20,8) NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(kraken_account_id, asset)
);

-- Kraken market data cache table
CREATE TABLE IF NOT EXISTS kraken_market_data (
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

-- Copy trading signals table
CREATE TABLE IF NOT EXISTS copy_trading_signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    kraken_account_id UUID NOT NULL REFERENCES kraken_accounts(id) ON DELETE CASCADE,
    signal_type TEXT NOT NULL CHECK (signal_type IN ('buy', 'sell', 'hold')),
    symbol TEXT NOT NULL,
    price DECIMAL(20,8) NOT NULL,
    volume DECIMAL(20,8) NOT NULL,
    confidence DECIMAL(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    reason TEXT,
    is_executed BOOLEAN DEFAULT false,
    executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_kraken_accounts_user_id ON kraken_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_kraken_accounts_is_active ON kraken_accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_kraken_trades_user_id ON kraken_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_kraken_trades_kraken_account_id ON kraken_trades(kraken_account_id);
CREATE INDEX IF NOT EXISTS idx_kraken_trades_trade_time ON kraken_trades(trade_time);
CREATE INDEX IF NOT EXISTS idx_kraken_trades_pair ON kraken_trades(pair);
CREATE INDEX IF NOT EXISTS idx_kraken_balances_user_id ON kraken_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_kraken_balances_kraken_account_id ON kraken_balances(kraken_account_id);
CREATE INDEX IF NOT EXISTS idx_kraken_market_data_symbol ON kraken_market_data(symbol);
CREATE INDEX IF NOT EXISTS idx_kraken_market_data_timestamp ON kraken_market_data(timestamp);
CREATE INDEX IF NOT EXISTS idx_copy_trading_signals_user_id ON copy_trading_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_copy_trading_signals_kraken_account_id ON copy_trading_signals(kraken_account_id);
CREATE INDEX IF NOT EXISTS idx_copy_trading_signals_created_at ON copy_trading_signals(created_at);

-- Row Level Security Policies
ALTER TABLE kraken_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE kraken_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE kraken_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE kraken_market_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE copy_trading_signals ENABLE ROW LEVEL SECURITY;

-- Kraken accounts policies
CREATE POLICY "Users can view their own kraken accounts" ON kraken_accounts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own kraken accounts" ON kraken_accounts
    FOR ALL USING (auth.uid() = user_id);

-- Kraken trades policies
CREATE POLICY "Users can view their own kraken trades" ON kraken_trades
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own kraken trades" ON kraken_trades
    FOR ALL USING (auth.uid() = user_id);

-- Kraken balances policies
CREATE POLICY "Users can view their own kraken balances" ON kraken_balances
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own kraken balances" ON kraken_balances
    FOR ALL USING (auth.uid() = user_id);

-- Market data policies (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view market data" ON kraken_market_data
    FOR SELECT USING (auth.role() = 'authenticated');

-- Copy trading signals policies
CREATE POLICY "Users can view their own copy trading signals" ON copy_trading_signals
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own copy trading signals" ON copy_trading_signals
    FOR ALL USING (auth.uid() = user_id);

-- Functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_kraken_accounts_updated_at
    BEFORE UPDATE ON kraken_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kraken_trades_updated_at
    BEFORE UPDATE ON kraken_trades
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kraken_balances_updated_at
    BEFORE UPDATE ON kraken_balances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up old market data
CREATE OR REPLACE FUNCTION cleanup_old_market_data()
RETURNS void AS $$
BEGIN
    DELETE FROM kraken_market_data 
    WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Function to get user's kraken account summary
CREATE OR REPLACE FUNCTION get_kraken_account_summary(p_user_id UUID)
RETURNS TABLE (
    account_id UUID,
    kraken_user_id TEXT,
    is_active BOOLEAN,
    total_balance DECIMAL(20,8),
    trade_count BIGINT,
    last_trade_date TIMESTAMPTZ,
    last_sync_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ka.id as account_id,
        ka.kraken_user_id,
        ka.is_active,
        COALESCE(SUM(kb.total_balance), 0) as total_balance,
        COUNT(kt.id) as trade_count,
        MAX(kt.trade_time) as last_trade_date,
        ka.last_sync_at
    FROM kraken_accounts ka
    LEFT JOIN kraken_balances kb ON ka.id = kb.kraken_account_id
    LEFT JOIN kraken_trades kt ON ka.id = kt.kraken_account_id
    WHERE ka.user_id = p_user_id
    GROUP BY ka.id, ka.kraken_user_id, ka.is_active, ka.last_sync_at;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE kraken_accounts IS 'Kraken OAuth connected accounts';
COMMENT ON TABLE kraken_trades IS 'Synced trades from Kraken accounts';
COMMENT ON TABLE kraken_balances IS 'Account balances from Kraken';
COMMENT ON TABLE kraken_market_data IS 'Cached market data from Kraken';
COMMENT ON TABLE copy_trading_signals IS 'Copy trading signals generated from Kraken data';
