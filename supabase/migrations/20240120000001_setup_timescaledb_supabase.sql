-- TimescaleDB Setup Migration for Supabase
-- This migration sets up TimescaleDB tables for the institutional backtester
-- Run this after the main institutional backtester schema migration

-- Note: TimescaleDB extension should be enabled in your Supabase project
-- If not enabled, contact Supabase support to enable it

-- Create market_data table for OHLCV data
-- Force recreation to ensure correct column structure
DROP TABLE IF EXISTS market_data CASCADE;

CREATE TABLE market_data (
    timestamp TIMESTAMPTZ NOT NULL,
    symbol TEXT NOT NULL,
    exchange TEXT NOT NULL,
    timeframe TEXT NOT NULL DEFAULT '1h',
    open DECIMAL(20,8) NOT NULL,
    high DECIMAL(20,8) NOT NULL,
    low DECIMAL(20,8) NOT NULL,
    close DECIMAL(20,8) NOT NULL,
    volume DECIMAL(20,8) NOT NULL DEFAULT 0,
    trade_count INTEGER DEFAULT 0,
    vwap DECIMAL(20,8),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Composite primary key
    PRIMARY KEY (timestamp, symbol, exchange, timeframe)
);

-- Create hypertable for time-series optimization
-- Supabase-specific approach with error handling
DO $$ 
BEGIN
    -- Check if TimescaleDB is available
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        RAISE NOTICE 'TimescaleDB extension not found. Please contact Supabase support to enable TimescaleDB.';
        RETURN;
    END IF;
    
    -- Create hypertable with error handling
    BEGIN
        PERFORM create_hypertable('market_data', 'timestamp', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
        RAISE NOTICE 'Successfully created hypertable for market_data';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Hypertable creation failed or already exists: %', SQLERRM;
    END;
END $$;

-- Create tick_data table for high-frequency data
DROP TABLE IF EXISTS tick_data CASCADE;

CREATE TABLE tick_data (
    timestamp TIMESTAMPTZ NOT NULL,
    symbol TEXT NOT NULL,
    exchange TEXT NOT NULL,
    price DECIMAL(20,8) NOT NULL,
    size DECIMAL(20,8) NOT NULL,
    side TEXT CHECK (side IN ('buy', 'sell')),
    trade_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (timestamp, symbol, exchange, trade_id)
);

-- Create hypertable for tick data
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        BEGIN
            PERFORM create_hypertable('tick_data', 'timestamp', chunk_time_interval => INTERVAL '1 hour', if_not_exists => TRUE);
            RAISE NOTICE 'Successfully created hypertable for tick_data';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Hypertable creation failed or already exists: %', SQLERRM;
        END;
    END IF;
END $$;

-- Create backtest_data table for storing backtest results
DROP TABLE IF EXISTS backtest_data CASCADE;

CREATE TABLE backtest_data (
    timestamp TIMESTAMPTZ NOT NULL,
    backtest_id UUID NOT NULL,
    symbol TEXT NOT NULL,
    portfolio_value DECIMAL(20,8) NOT NULL,
    cash DECIMAL(20,8) NOT NULL,
    holdings JSONB NOT NULL DEFAULT '{}',
    pnl DECIMAL(20,8) DEFAULT 0,
    drawdown DECIMAL(20,8) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (timestamp, backtest_id, symbol)
);

-- Create hypertable for backtest data
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        BEGIN
            PERFORM create_hypertable('backtest_data', 'timestamp', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
            RAISE NOTICE 'Successfully created hypertable for backtest_data';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Hypertable creation failed or already exists: %', SQLERRM;
        END;
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_market_data_symbol_exchange ON market_data(symbol, exchange);
CREATE INDEX IF NOT EXISTS idx_market_data_timeframe ON market_data(timeframe);
CREATE INDEX IF NOT EXISTS idx_market_data_created_at ON market_data(created_at);

CREATE INDEX IF NOT EXISTS idx_tick_data_symbol_exchange ON tick_data(symbol, exchange);
CREATE INDEX IF NOT EXISTS idx_tick_data_created_at ON tick_data(created_at);

CREATE INDEX IF NOT EXISTS idx_backtest_data_backtest_id ON backtest_data(backtest_id);
CREATE INDEX IF NOT EXISTS idx_backtest_data_symbol ON backtest_data(symbol);
CREATE INDEX IF NOT EXISTS idx_backtest_data_created_at ON backtest_data(created_at);

-- Function to insert market data
CREATE OR REPLACE FUNCTION insert_market_data(
    p_timestamp TIMESTAMPTZ,
    p_symbol TEXT,
    p_exchange TEXT,
    p_timeframe TEXT,
    p_open DECIMAL(20,8),
    p_high DECIMAL(20,8),
    p_low DECIMAL(20,8),
    p_close DECIMAL(20,8),
    p_volume DECIMAL(20,8) DEFAULT 0,
    p_trade_count INTEGER DEFAULT 0,
    p_vwap DECIMAL(20,8) DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO market_data (
        timestamp, symbol, exchange, timeframe, open, high, low, close, 
        volume, trade_count, vwap
    ) VALUES (
        p_timestamp, p_symbol, p_exchange, p_timeframe, p_open, p_high, p_low, p_close,
        p_volume, p_trade_count, p_vwap
    ) ON CONFLICT (timestamp, symbol, exchange, timeframe) 
    DO UPDATE SET
        open = EXCLUDED.open,
        high = EXCLUDED.high,
        low = EXCLUDED.low,
        close = EXCLUDED.close,
        volume = EXCLUDED.volume,
        trade_count = EXCLUDED.trade_count,
        vwap = EXCLUDED.vwap,
        created_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get market data
CREATE OR REPLACE FUNCTION get_market_data(
    p_symbol TEXT,
    p_exchange TEXT,
    p_timeframe TEXT,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ
)
RETURNS TABLE (
    timestamp TIMESTAMPTZ,
    symbol TEXT,
    exchange TEXT,
    timeframe TEXT,
    open DECIMAL(20,8),
    high DECIMAL(20,8),
    low DECIMAL(20,8),
    close DECIMAL(20,8),
    volume DECIMAL(20,8),
    trade_count INTEGER,
    vwap DECIMAL(20,8)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        md.timestamp, md.symbol, md.exchange, md.timeframe,
        md.open, md.high, md.low, md.close,
        md.volume, md.trade_count, md.vwap
    FROM market_data md
    WHERE md.symbol = p_symbol
        AND md.exchange = p_exchange
        AND md.timeframe = p_timeframe
        AND md.timestamp >= p_start_time
        AND md.timestamp <= p_end_time
    ORDER BY md.timestamp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get latest price for a symbol
CREATE OR REPLACE FUNCTION get_latest_price(
    p_symbol TEXT,
    p_exchange TEXT,
    p_timeframe TEXT DEFAULT '1h'
)
RETURNS DECIMAL(20,8) AS $$
DECLARE
    latest_price DECIMAL(20,8);
BEGIN
    SELECT close INTO latest_price
    FROM market_data
    WHERE symbol = p_symbol
        AND exchange = p_exchange
        AND timeframe = p_timeframe
    ORDER BY timestamp DESC
    LIMIT 1;
    
    RETURN COALESCE(latest_price, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate technical indicators
CREATE OR REPLACE FUNCTION calculate_sma(
    p_symbol TEXT,
    p_exchange TEXT,
    p_timeframe TEXT,
    p_period INTEGER,
    p_end_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS DECIMAL(20,8) AS $$
DECLARE
    sma_value DECIMAL(20,8);
BEGIN
    SELECT AVG(close) INTO sma_value
    FROM market_data
    WHERE symbol = p_symbol
        AND exchange = p_exchange
        AND timeframe = p_timeframe
        AND timestamp <= p_end_time
    ORDER BY timestamp DESC
    LIMIT p_period;
    
    RETURN COALESCE(sma_value, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Row Level Security (RLS) for Supabase
ALTER TABLE market_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE tick_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE backtest_data ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for market_data (public read access)
CREATE POLICY "Market data is publicly readable" ON market_data
    FOR SELECT USING (true);

-- Create RLS policies for tick_data (public read access)
CREATE POLICY "Tick data is publicly readable" ON tick_data
    FOR SELECT USING (true);

-- Create RLS policies for backtest_data (authenticated users only)
CREATE POLICY "Users can view their own backtest data" ON backtest_data
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert their own backtest data" ON backtest_data
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own backtest data" ON backtest_data
    FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own backtest data" ON backtest_data
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON market_data TO authenticated;
GRANT ALL ON tick_data TO authenticated;
GRANT ALL ON backtest_data TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION insert_market_data TO authenticated;
GRANT EXECUTE ON FUNCTION get_market_data TO authenticated;
GRANT EXECUTE ON FUNCTION get_latest_price TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_sma TO authenticated;
