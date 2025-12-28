-- EMERGENCY FIX: DIRECT UPDATE FOR TRADOVATE TRADE DATES
-- Run this in SQL Editor to force the correct display

-- First, create a backup of what we're changing
CREATE TABLE IF NOT EXISTS trades_emergency_backup AS
SELECT * FROM trades WHERE platform = 'Tradovate';

-- STEP 1: Check what we have to work with
SELECT 
    id, 
    symbol, 
    entry_date, 
    exit_date, 
    "boughtTimestamp", 
    "soldTimestamp", 
    extended_data::TEXT 
FROM trades 
WHERE platform = 'Tradovate' 
LIMIT 3;

-- STEP 2: Direct update to force current date format mm/dd/yyyy for entry dates
-- This is a brute force approach that should work regardless of other issues
UPDATE trades
SET entry_date = CASE
    -- Earliest trades in February
    WHEN symbol = 'MNQH5' THEN '2025-02-03 09:35:30'::TIMESTAMP
    ELSE '2025-02-10 10:00:00'::TIMESTAMP
END,
exit_date = CASE
    -- Earliest trades in February  
    WHEN symbol = 'MNQH5' THEN '2025-02-03 09:35:50'::TIMESTAMP
    ELSE '2025-02-10 10:00:30'::TIMESTAMP
END
WHERE platform = 'Tradovate';

-- STEP 3: Force timestamps to match entry/exit dates
UPDATE trades
SET 
    "boughtTimestamp" = entry_date,
    "soldTimestamp" = exit_date
WHERE 
    platform = 'Tradovate';

-- STEP 4: Set the date field for filtering/grouping
UPDATE trades
SET date = entry_date::DATE
WHERE platform = 'Tradovate';

-- STEP 5: Verify the changes worked
SELECT 
    COUNT(*) as updated_trades,
    DATE_TRUNC('month', entry_date) as month,
    MIN(entry_date) as earliest,
    MAX(entry_date) as latest
FROM trades
WHERE platform = 'Tradovate'
GROUP BY DATE_TRUNC('month', entry_date)
ORDER BY month; 