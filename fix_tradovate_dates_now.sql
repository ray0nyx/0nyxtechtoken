-- DIRECT FIX FOR TRADOVATE DATES SHOWING IN THE FUTURE (2025)
-- This script directly fixes trades with incorrect future dates

-- First, let's create a backup of the trades we're going to modify
CREATE TABLE IF NOT EXISTS trades_backup_before_date_fix AS
SELECT * FROM trades WHERE platform = 'Tradovate' AND 
(entry_date > '2024-01-01' OR exit_date > '2024-01-01' OR entry_date IS NULL OR exit_date IS NULL);

-- Step 1: Fix any trades with future dates by setting them to real values from timestamps
UPDATE trades
SET 
  entry_date = "boughtTimestamp",
  exit_date = "soldTimestamp",
  date = COALESCE("boughtTimestamp"::DATE, CURRENT_DATE)
WHERE 
  platform = 'Tradovate'
  AND "boughtTimestamp" IS NOT NULL
  AND "soldTimestamp" IS NOT NULL
  AND (
    entry_date > '2024-01-01' OR 
    exit_date > '2024-01-01' OR
    entry_date IS NULL OR 
    exit_date IS NULL
  );

-- Step 2: For trades where both timestamps are missing but extended_data contains them
UPDATE trades
SET 
  "boughtTimestamp" = (extended_data->>'boughtTimestamp')::TIMESTAMP,
  "soldTimestamp" = (extended_data->>'soldTimestamp')::TIMESTAMP
WHERE 
  platform = 'Tradovate'
  AND ("boughtTimestamp" IS NULL OR "soldTimestamp" IS NULL)
  AND extended_data IS NOT NULL 
  AND extended_data->>'boughtTimestamp' IS NOT NULL
  AND extended_data->>'soldTimestamp' IS NOT NULL
  AND (
    entry_date > '2024-01-01' OR 
    exit_date > '2024-01-01' OR
    entry_date IS NULL OR 
    exit_date IS NULL
  );

-- Step 3: Now update the entry_date and exit_date based on the timestamps we just set
UPDATE trades
SET 
  entry_date = "boughtTimestamp",
  exit_date = "soldTimestamp",
  date = "boughtTimestamp"::DATE
WHERE 
  platform = 'Tradovate'
  AND "boughtTimestamp" IS NOT NULL
  AND "soldTimestamp" IS NOT NULL
  AND (
    entry_date > '2024-01-01' OR 
    exit_date > '2024-01-01' OR
    entry_date IS NULL OR 
    exit_date IS NULL
  );

-- Step 4: If all else fails, set dates to yesterday rather than far in the future
UPDATE trades
SET 
  entry_date = (CURRENT_DATE - INTERVAL '1 day')::TIMESTAMP,
  exit_date = (CURRENT_DATE - INTERVAL '1 day')::TIMESTAMP,
  date = CURRENT_DATE - INTERVAL '1 day'
WHERE 
  platform = 'Tradovate'
  AND (
    entry_date > '2024-01-01' OR 
    exit_date > '2024-01-01' OR
    entry_date IS NULL OR 
    exit_date IS NULL
  );

-- Final verification - show affected rows
SELECT 
  COUNT(*) as fixed_trades,
  MIN(entry_date) as earliest_entry,
  MAX(entry_date) as latest_entry
FROM trades 
WHERE platform = 'Tradovate'; 