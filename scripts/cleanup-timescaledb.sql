-- Cleanup script for TimescaleDB tables with reserved keyword issues
-- Run this script if you encounter "column 'time' does not exist" errors

-- Drop existing tables that might have the wrong column structure
DROP TABLE IF EXISTS market_data CASCADE;
DROP TABLE IF EXISTS tick_data CASCADE;
DROP TABLE IF EXISTS backtest_data CASCADE;

-- Drop any existing functions that reference the old column names
DROP FUNCTION IF EXISTS insert_market_data(TIMESTAMPTZ, TEXT, TEXT, TEXT, DECIMAL, DECIMAL, DECIMAL, DECIMAL, DECIMAL, INTEGER, DECIMAL);
DROP FUNCTION IF EXISTS get_market_data(TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS get_latest_price(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS calculate_sma(TEXT, TEXT, TEXT, INTEGER, TIMESTAMPTZ);

-- Drop any existing indexes that might reference the old column names
DROP INDEX IF EXISTS idx_market_data_symbol_exchange;
DROP INDEX IF EXISTS idx_market_data_timeframe;
DROP INDEX IF EXISTS idx_market_data_created_at;
DROP INDEX IF EXISTS idx_tick_data_symbol_exchange;
DROP INDEX IF EXISTS idx_tick_data_created_at;
DROP INDEX IF EXISTS idx_backtest_data_backtest_id;
DROP INDEX IF EXISTS idx_backtest_data_symbol;
DROP INDEX IF EXISTS idx_backtest_data_created_at;

-- Note: After running this cleanup script, run the main setup-timescaledb.sql script
-- to recreate the tables with the correct column structure
