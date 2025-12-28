-- Institutional Backtester Database Schema
-- This migration creates all necessary tables for the institutional backtester

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create linked_exchanges table for storing exchange API credentials
CREATE TABLE IF NOT EXISTS linked_exchanges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    exchange_name TEXT NOT NULL CHECK (exchange_name IN ('binance', 'coinbase', 'kraken', 'bybit', 'okx')),
    exchange_type TEXT NOT NULL CHECK (exchange_type IN ('crypto', 'futures')),
    api_key_encrypted TEXT,
    api_secret_encrypted TEXT,
    oauth_token_encrypted TEXT,
    oauth_refresh_token_encrypted TEXT,
    oauth_expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'active', 'error')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one active connection per exchange per user
    UNIQUE(user_id, exchange_name)
);

-- Create institutional_backtests table
CREATE TABLE IF NOT EXISTS institutional_backtests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    strategy_code TEXT NOT NULL,
    strategy_language TEXT DEFAULT 'python' CHECK (strategy_language IN ('python', 'csharp')),
    config JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    lean_job_id TEXT,
    lean_container_id TEXT,
    results JSONB,
    error_message TEXT,
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    estimated_completion_time TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create backtest_trades table for storing individual trade results
CREATE TABLE IF NOT EXISTS backtest_trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    backtest_id UUID NOT NULL REFERENCES institutional_backtests(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
    quantity DECIMAL(20,8) NOT NULL,
    price DECIMAL(20,8) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    commission DECIMAL(20,8) DEFAULT 0,
    slippage DECIMAL(20,8) DEFAULT 0,
    trade_type TEXT DEFAULT 'market' CHECK (trade_type IN ('market', 'limit', 'stop', 'stop_limit')),
    order_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create copy_trades table for managing copy trading
CREATE TABLE IF NOT EXISTS copy_trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_backtest_id UUID REFERENCES institutional_backtests(id) ON DELETE SET NULL,
    source_trade_id UUID REFERENCES backtest_trades(id) ON DELETE SET NULL,
    target_exchange_id UUID NOT NULL REFERENCES linked_exchanges(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
    quantity DECIMAL(20,8) NOT NULL,
    price DECIMAL(20,8) NOT NULL,
    scaled_quantity DECIMAL(20,8) NOT NULL,
    scaled_price DECIMAL(20,8) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'filled', 'failed', 'cancelled')),
    exchange_order_id TEXT,
    exchange_response JSONB,
    error_message TEXT,
    risk_checks_passed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create copy trading configuration table
CREATE TABLE IF NOT EXISTS copy_trading_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    source_backtest_id UUID NOT NULL REFERENCES institutional_backtests(id),
    target_exchange_ids UUID[] NOT NULL,
    risk_limits JSONB NOT NULL DEFAULT '{}',
    copy_settings JSONB NOT NULL DEFAULT '{}',
    sync_status TEXT DEFAULT 'disabled' CHECK (sync_status IN ('active', 'paused', 'error', 'disabled')),
    last_sync_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create trade reconciliation tables
CREATE TABLE IF NOT EXISTS trade_reconciliations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_id UUID NOT NULL REFERENCES copy_trading_configs(id),
    total_trades INTEGER NOT NULL DEFAULT 0,
    matched_trades INTEGER NOT NULL DEFAULT 0,
    mismatched_trades INTEGER NOT NULL DEFAULT 0,
    missing_trades INTEGER NOT NULL DEFAULT 0,
    duplicate_trades INTEGER NOT NULL DEFAULT 0,
    error_trades INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reconciliation_discrepancies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reconciliation_id UUID NOT NULL REFERENCES trade_reconciliations(id),
    trade_id TEXT NOT NULL,
    discrepancy_type TEXT NOT NULL,
    description TEXT NOT NULL,
    correction_needed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create audit_logs table for security and compliance
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    session_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create backtest_metrics table for storing calculated performance metrics
CREATE TABLE IF NOT EXISTS backtest_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    backtest_id UUID NOT NULL REFERENCES institutional_backtests(id) ON DELETE CASCADE,
    metric_name TEXT NOT NULL,
    metric_value DECIMAL(20,8) NOT NULL,
    metric_type TEXT NOT NULL CHECK (metric_type IN ('return', 'risk', 'ratio', 'drawdown', 'trade_stat')),
    calculation_method TEXT,
    benchmark_value DECIMAL(20,8),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(backtest_id, metric_name)
);

-- Create copy_trading_sessions table for managing copy trading sessions
CREATE TABLE IF NOT EXISTS copy_trading_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    backtest_id UUID NOT NULL REFERENCES institutional_backtests(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    risk_limits JSONB NOT NULL DEFAULT '{}',
    target_exchanges UUID[] NOT NULL,
    total_trades_copied INTEGER DEFAULT 0,
    successful_trades INTEGER DEFAULT 0,
    failed_trades INTEGER DEFAULT 0,
    total_pnl DECIMAL(20,8) DEFAULT 0,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_linked_exchanges_user_id ON linked_exchanges(user_id);
CREATE INDEX IF NOT EXISTS idx_linked_exchanges_exchange_name ON linked_exchanges(exchange_name);
CREATE INDEX IF NOT EXISTS idx_linked_exchanges_is_active ON linked_exchanges(is_active);

CREATE INDEX IF NOT EXISTS idx_institutional_backtests_user_id ON institutional_backtests(user_id);
CREATE INDEX IF NOT EXISTS idx_institutional_backtests_status ON institutional_backtests(status);
CREATE INDEX IF NOT EXISTS idx_institutional_backtests_created_at ON institutional_backtests(created_at);

CREATE INDEX IF NOT EXISTS idx_backtest_trades_backtest_id ON backtest_trades(backtest_id);
CREATE INDEX IF NOT EXISTS idx_backtest_trades_timestamp ON backtest_trades(timestamp);
CREATE INDEX IF NOT EXISTS idx_backtest_trades_symbol ON backtest_trades(symbol);

CREATE INDEX IF NOT EXISTS idx_copy_trades_user_id ON copy_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_copy_trades_status ON copy_trades(status);
CREATE INDEX IF NOT EXISTS idx_copy_trades_created_at ON copy_trades(created_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_backtest_metrics_backtest_id ON backtest_metrics(backtest_id);
CREATE INDEX IF NOT EXISTS idx_backtest_metrics_metric_name ON backtest_metrics(metric_name);

-- Enable Row Level Security
ALTER TABLE linked_exchanges ENABLE ROW LEVEL SECURITY;
ALTER TABLE institutional_backtests ENABLE ROW LEVEL SECURITY;
ALTER TABLE backtest_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE copy_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE backtest_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE copy_trading_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for linked_exchanges
CREATE POLICY "Users can view their own linked exchanges"
    ON linked_exchanges FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own linked exchanges"
    ON linked_exchanges FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own linked exchanges"
    ON linked_exchanges FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own linked exchanges"
    ON linked_exchanges FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for institutional_backtests
CREATE POLICY "Users can view their own backtests"
    ON institutional_backtests FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own backtests"
    ON institutional_backtests FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own backtests"
    ON institutional_backtests FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own backtests"
    ON institutional_backtests FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for backtest_trades
CREATE POLICY "Users can view trades from their backtests"
    ON backtest_trades FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM institutional_backtests 
        WHERE institutional_backtests.id = backtest_trades.backtest_id 
        AND institutional_backtests.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert trades for their backtests"
    ON backtest_trades FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM institutional_backtests 
        WHERE institutional_backtests.id = backtest_trades.backtest_id 
        AND institutional_backtests.user_id = auth.uid()
    ));

-- RLS Policies for copy_trades
CREATE POLICY "Users can view their own copy trades"
    ON copy_trades FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own copy trades"
    ON copy_trades FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own copy trades"
    ON copy_trades FOR UPDATE
    USING (auth.uid() = user_id);

-- RLS Policies for audit_logs
CREATE POLICY "Users can view their own audit logs"
    ON audit_logs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "System can insert audit logs"
    ON audit_logs FOR INSERT
    WITH CHECK (true);

-- RLS Policies for backtest_metrics
CREATE POLICY "Users can view metrics from their backtests"
    ON backtest_metrics FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM institutional_backtests 
        WHERE institutional_backtests.id = backtest_metrics.backtest_id 
        AND institutional_backtests.user_id = auth.uid()
    ));

-- RLS Policies for copy_trading_sessions
CREATE POLICY "Users can view their own copy trading sessions"
    ON copy_trading_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own copy trading sessions"
    ON copy_trading_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own copy trading sessions"
    ON copy_trading_sessions FOR UPDATE
    USING (auth.uid() = user_id);

-- Functions for institutional backtester

-- Function to check if user has Pro plan access
CREATE OR REPLACE FUNCTION has_institutional_access(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    subscription_record user_subscriptions;
    plan_record subscription_plans;
BEGIN
    -- Get user's subscription
    SELECT us.* INTO subscription_record
    FROM user_subscriptions us
    WHERE us.user_id = user_uuid
    ORDER BY us.updated_at DESC
    LIMIT 1;
    
    -- Get subscription plan details
    SELECT sp.* INTO plan_record
    FROM subscription_plans sp
    WHERE sp.id = subscription_record.plan_id;
    
    -- Developer always has access
    IF subscription_record.is_developer THEN
        RETURN TRUE;
    END IF;
    
    -- Check if subscription is active and Pro plan
    RETURN (
        subscription_record.status = 'active' AND 
        plan_record.price_monthly = 39.99
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log audit events
CREATE OR REPLACE FUNCTION log_audit_event(
    p_user_id UUID,
    p_action TEXT,
    p_resource_type TEXT,
    p_resource_id UUID DEFAULT NULL,
    p_details JSONB DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO audit_logs (
        user_id,
        action,
        resource_type,
        resource_id,
        details,
        ip_address,
        user_agent
    ) VALUES (
        p_user_id,
        p_action,
        p_resource_type,
        p_resource_id,
        p_details,
        p_ip_address,
        p_user_agent
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update backtest status
CREATE OR REPLACE FUNCTION update_backtest_status(
    p_backtest_id UUID,
    p_status TEXT,
    p_progress INTEGER DEFAULT NULL,
    p_results JSONB DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE institutional_backtests 
    SET 
        status = p_status,
        progress_percentage = COALESCE(p_progress, progress_percentage),
        results = COALESCE(p_results, results),
        error_message = COALESCE(p_error_message, error_message),
        updated_at = NOW(),
        started_at = CASE WHEN p_status = 'running' AND started_at IS NULL THEN NOW() ELSE started_at END,
        completed_at = CASE WHEN p_status IN ('completed', 'failed', 'cancelled') THEN NOW() ELSE completed_at END
    WHERE id = p_backtest_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate backtest metrics
CREATE OR REPLACE FUNCTION calculate_backtest_metrics(p_backtest_id UUID)
RETURNS VOID AS $$
DECLARE
    trade_record RECORD;
    total_trades INTEGER := 0;
    winning_trades INTEGER := 0;
    losing_trades INTEGER := 0;
    total_pnl DECIMAL(20,8) := 0;
    max_drawdown DECIMAL(20,8) := 0;
    current_drawdown DECIMAL(20,8) := 0;
    peak_balance DECIMAL(20,8) := 0;
    current_balance DECIMAL(20,8) := 0;
    initial_capital DECIMAL(20,8);
    returns DECIMAL(20,8)[];
    daily_return DECIMAL(20,8);
    avg_return DECIMAL(20,8);
    volatility DECIMAL(20,8);
    sharpe_ratio DECIMAL(20,8);
BEGIN
    -- Get initial capital from backtest config
    SELECT (config->>'initial_capital')::DECIMAL INTO initial_capital
    FROM institutional_backtests 
    WHERE id = p_backtest_id;
    
    current_balance := initial_capital;
    peak_balance := initial_capital;
    
    -- Process trades chronologically
    FOR trade_record IN 
        SELECT * FROM backtest_trades 
        WHERE backtest_id = p_backtest_id 
        ORDER BY timestamp
    LOOP
        total_trades := total_trades + 1;
        
        -- Calculate P&L for this trade (simplified)
        IF trade_record.side = 'buy' THEN
            current_balance := current_balance - (trade_record.quantity * trade_record.price);
        ELSE
            current_balance := current_balance + (trade_record.quantity * trade_record.price);
        END IF;
        
        -- Update peak and drawdown
        IF current_balance > peak_balance THEN
            peak_balance := current_balance;
            current_drawdown := 0;
        ELSE
            current_drawdown := (peak_balance - current_balance) / peak_balance;
            IF current_drawdown > max_drawdown THEN
                max_drawdown := current_drawdown;
            END IF;
        END IF;
        
        -- Calculate daily return (simplified)
        daily_return := (current_balance - initial_capital) / initial_capital;
        returns := array_append(returns, daily_return);
    END LOOP;
    
    -- Calculate final metrics
    total_pnl := current_balance - initial_capital;
    
    -- Calculate Sharpe ratio (simplified)
    IF array_length(returns, 1) > 1 THEN
        SELECT AVG(r), STDDEV(r) INTO avg_return, volatility
        FROM unnest(returns) AS r;
        
        IF volatility > 0 THEN
            sharpe_ratio := avg_return / volatility;
        ELSE
            sharpe_ratio := 0;
        END IF;
    END IF;
    
    -- Store metrics
    INSERT INTO backtest_metrics (backtest_id, metric_name, metric_value, metric_type) VALUES
        (p_backtest_id, 'total_return', total_pnl, 'return'),
        (p_backtest_id, 'total_trades', total_trades, 'trade_stat'),
        (p_backtest_id, 'max_drawdown', max_drawdown, 'drawdown'),
        (p_backtest_id, 'sharpe_ratio', sharpe_ratio, 'ratio')
    ON CONFLICT (backtest_id, metric_name) 
    DO UPDATE SET 
        metric_value = EXCLUDED.metric_value,
        created_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_linked_exchanges_updated_at
    BEFORE UPDATE ON linked_exchanges
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_institutional_backtests_updated_at
    BEFORE UPDATE ON institutional_backtests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_copy_trades_updated_at
    BEFORE UPDATE ON copy_trades
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_copy_trading_sessions_updated_at
    BEFORE UPDATE ON copy_trading_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Clean up duplicate subscription plans and add unique constraint
DO $$ 
BEGIN
    -- Remove duplicate plans, keeping the most recent one
    DELETE FROM subscription_plans 
    WHERE id NOT IN (
        SELECT DISTINCT ON (name) id 
        FROM subscription_plans 
        ORDER BY name, created_at DESC
    );
    
    -- Add unique constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'subscription_plans_name_unique'
    ) THEN
        ALTER TABLE subscription_plans ADD CONSTRAINT subscription_plans_name_unique UNIQUE (name);
    END IF;
END $$;

-- Insert sample Pro plan if it doesn't exist
INSERT INTO subscription_plans (name, description, price_monthly, price_yearly, features)
VALUES (
    'Pro',
    'Advanced institutional backtesting with copy trading',
    39.99,
    399.99,
    '{"features": ["Institutional backtesting", "Copy trading", "Advanced analytics", "Exchange integration", "Priority support"]}'
)
ON CONFLICT (name) DO UPDATE SET
    price_monthly = EXCLUDED.price_monthly,
    price_yearly = EXCLUDED.price_yearly,
    features = EXCLUDED.features,
    updated_at = NOW();
