-- Test script for TimescaleDB setup in Supabase
-- Run this in your Supabase SQL Editor after setup-timescaledb-supabase.sql

-- Check if TimescaleDB extension is available
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') 
        THEN 'TimescaleDB extension is available'
        ELSE 'TimescaleDB extension is NOT available - contact Supabase support'
    END as timescaledb_status;

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

-- Check if hypertables were created successfully (only if TimescaleDB is available)
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

-- Test SMA calculation
SELECT calculate_sma('BTC/USD', 'binance', '1h', 5) as sma_5_period;

-- Test getting market data
SELECT * FROM get_market_data(
    'BTC/USD', 
    'binance', 
    '1h', 
    NOW() - INTERVAL '1 day', 
    NOW()
) LIMIT 5;

-- Test RLS policies (this should work for authenticated users)
SELECT 'RLS test - this should work if you are authenticated' as rls_test;

-- Clean up test data
DELETE FROM market_data WHERE symbol = 'BTC/USD' AND exchange = 'binance';

-- Show final status
SELECT 'TimescaleDB Supabase setup test completed successfully!' as final_status;
