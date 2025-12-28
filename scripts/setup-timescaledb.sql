-- TimescaleDB Setup Script for Institutional Backtester
-- This script sets up the time-series database for market data

-- Create database (run this as superuser)
-- CREATE DATABASE wagyu_market_data;

-- Connect to the database and run the following:

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

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
-- Add debugging and error handling
DO $$ 
BEGIN
    -- Verify table exists and has the correct column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'market_data' AND column_name = 'timestamp'
    ) THEN
        RAISE EXCEPTION 'market_data table does not have a "timestamp" column. Table creation may have failed.';
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
-- Force recreation to ensure correct column structure
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
    BEGIN
        PERFORM create_hypertable('tick_data', 'timestamp', chunk_time_interval => INTERVAL '1 hour', if_not_exists => TRUE);
        RAISE NOTICE 'Successfully created hypertable for tick_data';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Hypertable creation failed or already exists: %', SQLERRM;
    END;
END $$;

-- Create backtest_data table for storing backtest results
-- Force recreation to ensure correct column structure
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
    BEGIN
        PERFORM create_hypertable('backtest_data', 'timestamp', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
        RAISE NOTICE 'Successfully created hypertable for backtest_data';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Hypertable creation failed or already exists: %', SQLERRM;
    END;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_market_data_symbol_exchange ON market_data(symbol, exchange);
CREATE INDEX IF NOT EXISTS idx_market_data_timeframe ON market_data(timeframe);
CREATE INDEX IF NOT EXISTS idx_market_data_created_at ON market_data(created_at);

CREATE INDEX IF NOT EXISTS idx_tick_data_symbol_exchange ON tick_data(symbol, exchange);
CREATE INDEX IF NOT EXISTS idx_tick_data_side ON tick_data(side);
CREATE INDEX IF NOT EXISTS idx_tick_data_created_at ON tick_data(created_at);

CREATE INDEX IF NOT EXISTS idx_backtest_data_backtest_id ON backtest_data(backtest_id);
CREATE INDEX IF NOT EXISTS idx_backtest_data_symbol ON backtest_data(symbol);
CREATE INDEX IF NOT EXISTS idx_backtest_data_created_at ON backtest_data(created_at);

-- Create continuous aggregates for common queries
-- 1-hour OHLCV from tick data
CREATE MATERIALIZED VIEW IF NOT EXISTS market_data_1h_agg
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 hour', time) AS time,
    symbol,
    exchange,
    '1h' AS timeframe,
    first(price, time) AS open,
    max(price) AS high,
    min(price) AS low,
    last(price, time) AS close,
    sum(size) AS volume,
    count(*) AS trade_count,
    sum(price * size) / sum(size) AS vwap
FROM tick_data
GROUP BY time_bucket('1 hour', time), symbol, exchange;

-- 4-hour OHLCV from 1-hour data
CREATE MATERIALIZED VIEW IF NOT EXISTS market_data_4h_agg
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('4 hours', time) AS time,
    symbol,
    exchange,
    '4h' AS timeframe,
    first(close, time) AS open,
    max(high) AS high,
    min(low) AS low,
    last(close, time) AS close,
    sum(volume) AS volume,
    sum(trade_count) AS trade_count,
    sum(close * volume) / sum(volume) AS vwap
FROM market_data
WHERE timeframe = '1h'
GROUP BY time_bucket('4 hours', time), symbol, exchange;

-- Daily OHLCV from 1-hour data
CREATE MATERIALIZED VIEW IF NOT EXISTS market_data_1d_agg
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 day', time) AS time,
    symbol,
    exchange,
    '1d' AS timeframe,
    first(close, time) AS open,
    max(high) AS high,
    min(low) AS low,
    last(close, time) AS close,
    sum(volume) AS volume,
    sum(trade_count) AS trade_count,
    sum(close * volume) / sum(volume) AS vwap
FROM market_data
WHERE timeframe = '1h'
GROUP BY time_bucket('1 day', time), symbol, exchange;

-- Add refresh policies for continuous aggregates
SELECT add_continuous_aggregate_policy('market_data_1h_agg',
    start_offset => INTERVAL '2 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');

SELECT add_continuous_aggregate_policy('market_data_4h_agg',
    start_offset => INTERVAL '8 hours',
    end_offset => INTERVAL '4 hours',
    schedule_interval => INTERVAL '4 hours');

SELECT add_continuous_aggregate_policy('market_data_1d_agg',
    start_offset => INTERVAL '2 days',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day');

-- Create functions for data management

-- Function to insert market data
CREATE OR REPLACE FUNCTION insert_market_data(
    p_time TIMESTAMPTZ,
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
        p_time, p_symbol, p_exchange, p_timeframe, p_open, p_high, p_low, p_close,
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
$$ LANGUAGE plpgsql;

-- Function to get market data for a symbol and time range
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
$$ LANGUAGE plpgsql;

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
    ORDER BY time DESC
    LIMIT 1;
    
    RETURN latest_price;
END;
$$ LANGUAGE plpgsql;

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
    
    RETURN sma_value;
END;
$$ LANGUAGE plpgsql;

-- Create retention policies to manage data growth
-- Keep tick data for 30 days
SELECT add_retention_policy('tick_data', INTERVAL '30 days');

-- Keep 1-hour data for 1 year
SELECT add_retention_policy('market_data', INTERVAL '1 year', 
    where_clause => 'timeframe = ''1h''');

-- Keep daily data for 10 years
SELECT add_retention_policy('market_data', INTERVAL '10 years',
    where_clause => 'timeframe = ''1d''');

-- Create compression policies to save storage
-- Compress tick data after 7 days
SELECT add_compression_policy('tick_data', INTERVAL '7 days');

-- Compress 1-hour data after 30 days
SELECT add_compression_policy('market_data', INTERVAL '30 days',
    where_clause => 'timeframe = ''1h''');

-- Create user for the application (run as superuser)
-- CREATE USER wagyu_app WITH PASSWORD 'secure_password_here';
-- GRANT CONNECT ON DATABASE wagyu_market_data TO wagyu_app;
-- GRANT USAGE ON SCHEMA public TO wagyu_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO wagyu_app;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO wagyu_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO wagyu_app;

-- Create connection string for application
-- postgresql://wagyu_app:secure_password_here@localhost:5432/wagyu_market_data
