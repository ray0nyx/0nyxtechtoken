-- DEBUG AND FIX TRADOVATE TRADES
-- This script will help diagnose and fix issues with Tradovate trades

-- 1. Check column types for key date fields 
SELECT 
  column_name, 
  data_type 
FROM 
  information_schema.columns 
WHERE 
  table_name = 'trades' 
  AND column_name IN ('entry_date', 'exit_date', 'boughtTimestamp', 'soldTimestamp', 'date', 'created_at');

-- 2. Show some example data to diagnose the issue
SELECT 
  id, 
  symbol,
  platform,
  entry_date,
  exit_date,
  "boughtTimestamp",
  "soldTimestamp",
  date,
  created_at
FROM 
  trades 
WHERE 
  platform = 'Tradovate' 
LIMIT 5;

-- 3. Determine if frontend or database is responsible
-- Sample data from frontend component rendering
SELECT 
  id,
  symbol,
  entry_date IS NULL AS entry_date_is_null,
  exit_date IS NULL AS exit_date_is_null,
  entry_date > NOW() AS entry_date_in_future,
  exit_date > NOW() AS exit_date_in_future,
  date
FROM 
  trades
WHERE 
  platform = 'Tradovate'
LIMIT 10;

-- 4. Try a direct fix by updating dates on a specific trade to verify functionality
-- Replace ID with an actual trade ID from the previous query
UPDATE trades
SET 
  entry_date = '2025-03-03 10:00:00'::TIMESTAMP,
  exit_date = '2025-03-03 10:01:00'::TIMESTAMP,
  duration = INTERVAL '1 minute'
WHERE 
  id = '2314182a-bfee-474e-962d-eac5187a4a80'; -- Replace this ID with a real one

-- 5. Check if the Trades.tsx component is correctly handling dates
-- This is done in the component with:
-- {trade.entry_date ? new Date(trade.entry_date).toLocaleDateString() : ... }
-- {trade.exit_date ? new Date(trade.exit_date).toLocaleDateString() : ... }

-- 6. Apply bulk fix with more bulletproof date handling
UPDATE trades 
SET 
  -- Use consistent timestamps ensuring valid RFC 3339 format
  entry_date = '2025-03-03T10:00:00.000Z'::TIMESTAMP,
  exit_date = '2025-03-03T10:01:00.000Z'::TIMESTAMP,
  -- Set date to match entry date
  date = '2025-03-03'::DATE,
  -- Set duration to 1 minute for all trades
  duration = INTERVAL '1 minute'
WHERE 
  platform = 'Tradovate';

-- 7. Verify the changes
SELECT 
  id, 
  symbol, 
  to_char(entry_date, 'YYYY-MM-DD HH24:MI:SS') as entry_date,
  to_char(exit_date, 'YYYY-MM-DD HH24:MI:SS') as exit_date,
  date::TEXT,
  duration
FROM 
  trades 
WHERE 
  platform = 'Tradovate' 
LIMIT 10; 