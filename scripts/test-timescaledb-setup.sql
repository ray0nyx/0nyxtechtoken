-- Test script to verify TimescaleDB setup
-- Run this after setup-timescaledb.sql to verify everything is working

-- Check if tables exist with correct column structure
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('market_data', 'tick_data', 'backtest_data')
    AND column_name = 'timestamp'
ORDER BY table_name;

-- Check if hypertables were created successfully
SELECT 
    hypertable_name,
    num_dimensions,
    created
FROM timescaledb_information.hypertables 
WHERE hypertable_name IN ('market_data', 'tick_data', 'backtest_data')
ORDER BY hypertable_name;

-- Test inserting sample data
INSERT INTO market_data (
    timestamp, symbol, exchange, timeframe, open, high, low, close, volume
) VALUES (
    NOW(), 'BTC/USD', 'binance', '1h', 50000.0, 51000.0, 49000.0, 50500.0, 100.0
) ON CONFLICT (timestamp, symbol, exchange, timeframe) DO NOTHING;

-- Verify data was inserted
SELECT COUNT(*) as market_data_count FROM market_data;

-- Test the functions
SELECT get_latest_price('BTC/USD', 'binance', '1h') as latest_price;

-- Clean up test data
DELETE FROM market_data WHERE symbol = 'BTC/USD' AND exchange = 'binance';

RAISE NOTICE 'TimescaleDB setup test completed successfully!';
