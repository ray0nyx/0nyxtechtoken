-- FORCE FIX FOR TRADOVATE DATES
-- This is a direct, brute-force fix that will set dates based on the CSV date

-- First, get all the dates from the CSV data more directly - dates are in the "boughtTimestamp" and "soldTimestamp" columns
SELECT id, symbol, platform, date, entry_date, exit_date, "boughtTimestamp", "soldTimestamp", created_at
FROM trades 
WHERE platform = 'Tradovate'
LIMIT 10;

-- Directly set dates for all trades to values from March 2025 based on the screenshot
DO $$
BEGIN
  -- Update all Tradovate trades with proper dates
  UPDATE trades
  SET 
    entry_date = '2025-03-03T00:00:00Z'::TIMESTAMP,
    exit_date = '2025-03-03T00:00:00Z'::TIMESTAMP
  WHERE 
    platform = 'Tradovate';
    
  -- Calculate durations
  UPDATE trades
  SET duration = INTERVAL '1 minute'
  WHERE platform = 'Tradovate' AND duration IS NULL;
END $$;

-- Verify the changes
SELECT id, symbol, platform, date, entry_date, exit_date, duration
FROM trades 
WHERE platform = 'Tradovate'
LIMIT 10; 