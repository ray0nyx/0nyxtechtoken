-- SIMPLIFIED DIRECT FIX FOR TRADOVATE DATES
-- This script is a direct approach to fixing the date issues without depending on additional columns

-- Step 1: For any trades with date in the CSV name string and no proper timestamps
-- Let's check for date patterns in the platform field or notes
UPDATE trades 
SET 
  entry_date = date::TIMESTAMP,
  exit_date = date::TIMESTAMP
WHERE 
  platform = 'Tradovate'
  AND (entry_date IS NULL OR exit_date IS NULL OR entry_date > NOW() OR exit_date > NOW())
  AND date IS NOT NULL;

-- Step 2: For any trades still not fixed, set dates to timestamps if available
UPDATE trades
SET 
  entry_date = "boughtTimestamp",
  exit_date = "soldTimestamp"
WHERE 
  platform = 'Tradovate'
  AND "boughtTimestamp" IS NOT NULL
  AND "soldTimestamp" IS NOT NULL
  AND (entry_date IS NULL OR exit_date IS NULL OR entry_date > NOW() OR exit_date > NOW());

-- Step 3: Calculate durations for any trades that have entry and exit dates
UPDATE trades
SET 
  duration = exit_date - entry_date
WHERE 
  platform = 'Tradovate'
  AND entry_date IS NOT NULL
  AND exit_date IS NOT NULL
  AND (duration IS NULL OR duration = '00:00:00');

-- Step 4: Set entry_date to created_at for any remaining trades without entry_date
UPDATE trades
SET 
  entry_date = created_at,
  exit_date = COALESCE(exit_date, created_at)
WHERE 
  platform = 'Tradovate'
  AND (entry_date IS NULL OR exit_date IS NULL);

-- Step 5: Make any trade dates showing in the future reflect past dates
-- This could happen if timezone conversion issues exist
UPDATE trades
SET 
  entry_date = (CURRENT_DATE - INTERVAL '1 day')::TIMESTAMP,
  exit_date = (CURRENT_DATE - INTERVAL '1 day')::TIMESTAMP
WHERE 
  platform = 'Tradovate'
  AND (entry_date > NOW() OR exit_date > NOW());

-- Finally, update the date field to match entry_date
UPDATE trades
SET 
  date = entry_date::DATE
WHERE 
  platform = 'Tradovate'
  AND entry_date IS NOT NULL; 