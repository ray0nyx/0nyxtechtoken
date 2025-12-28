-- DIRECT FIX FOR TRADOVATE DATES USING CSV COLUMN VALUES
-- This script directly extracts and uses the date values from the CSV imported data

-- Create a backup of trades we'll modify
CREATE TABLE IF NOT EXISTS trades_backup_before_csv_date_fix AS
SELECT * FROM trades WHERE platform = 'Tradovate';

-- First, let's see what timestamps are stored in the metadata
SELECT id, symbol, "boughtTimestamp", "soldTimestamp", entry_date, exit_date
FROM trades
WHERE platform = 'Tradovate'
LIMIT 5;

-- Step 1: For trades where metadata has the correct timestamps but they're not being used
UPDATE trades
SET 
  entry_date = "boughtTimestamp",
  exit_date = "soldTimestamp",
  date = "boughtTimestamp"::DATE
WHERE 
  platform = 'Tradovate'
  AND "boughtTimestamp" IS NOT NULL
  AND "soldTimestamp" IS NOT NULL;

-- Step 2: Extract timestamps from extended_data.metadata for trades where dedicated fields are empty
UPDATE trades t
SET 
  "boughtTimestamp" = (t.extended_data->'metadata'->>'boughtTimestamp')::TIMESTAMP,
  "soldTimestamp" = (t.extended_data->'metadata'->>'soldTimestamp')::TIMESTAMP
WHERE 
  t.platform = 'Tradovate'
  AND (t."boughtTimestamp" IS NULL OR t."soldTimestamp" IS NULL)
  AND t.extended_data IS NOT NULL
  AND t.extended_data ? 'metadata'
  AND (t.extended_data->'metadata'->>'boughtTimestamp') IS NOT NULL;

-- Step 3: Extract timestamps from extended_data.original field for trades where metadata is missing
UPDATE trades t
SET 
  "boughtTimestamp" = (t.extended_data->'original'->>'boughtTimestamp')::TIMESTAMP,
  "soldTimestamp" = (t.extended_data->'original'->>'soldTimestamp')::TIMESTAMP
WHERE 
  t.platform = 'Tradovate'
  AND (t."boughtTimestamp" IS NULL OR t."soldTimestamp" IS NULL)
  AND t.extended_data IS NOT NULL
  AND t.extended_data ? 'original'
  AND (t.extended_data->'original'->>'boughtTimestamp') IS NOT NULL;

-- Step 4: Update entry_date and exit_date from the timestamps we just extracted
UPDATE trades
SET 
  entry_date = "boughtTimestamp",
  exit_date = "soldTimestamp",
  date = "boughtTimestamp"::DATE
WHERE 
  platform = 'Tradovate'
  AND "boughtTimestamp" IS NOT NULL
  AND "soldTimestamp" IS NOT NULL;

-- Step 5: For trades that need date format conversion (MM/DD/YYYY to YYYY-MM-DD)
-- This handles cases where timestamps are stored in non-standard formats
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT id, extended_data 
    FROM trades 
    WHERE platform = 'Tradovate' 
    AND (entry_date IS NULL OR exit_date IS NULL)
    AND extended_data IS NOT NULL
  LOOP
    -- Try to find any date strings in the extended data
    BEGIN
      -- Extract boughtTimestamp
      IF r.extended_data->>'boughtTimestamp' ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}' THEN
        -- MM/DD/YYYY format conversion
        UPDATE trades 
        SET "boughtTimestamp" = to_timestamp(r.extended_data->>'boughtTimestamp', 'MM/DD/YYYY HH24:MI:SS')
        WHERE id = r.id;
      ELSIF r.extended_data->'metadata'->>'boughtTimestamp' ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}' THEN
        -- MM/DD/YYYY format in metadata
        UPDATE trades 
        SET "boughtTimestamp" = to_timestamp(r.extended_data->'metadata'->>'boughtTimestamp', 'MM/DD/YYYY HH24:MI:SS')
        WHERE id = r.id;
      END IF;
      
      -- Extract soldTimestamp
      IF r.extended_data->>'soldTimestamp' ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}' THEN
        -- MM/DD/YYYY format conversion
        UPDATE trades 
        SET "soldTimestamp" = to_timestamp(r.extended_data->>'soldTimestamp', 'MM/DD/YYYY HH24:MI:SS')
        WHERE id = r.id;
      ELSIF r.extended_data->'metadata'->>'soldTimestamp' ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}' THEN
        -- MM/DD/YYYY format in metadata
        UPDATE trades 
        SET "soldTimestamp" = to_timestamp(r.extended_data->'metadata'->>'soldTimestamp', 'MM/DD/YYYY HH24:MI:SS')
        WHERE id = r.id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Continue to next record on error
      CONTINUE;
    END;
  END LOOP;
END $$;

-- Step 6: Update entry_date and exit_date from the fixed timestamps
UPDATE trades
SET 
  entry_date = "boughtTimestamp",
  exit_date = "soldTimestamp",
  date = COALESCE("boughtTimestamp"::DATE, date)
WHERE 
  platform = 'Tradovate'
  AND "boughtTimestamp" IS NOT NULL
  AND "soldTimestamp" IS NOT NULL;

-- Step 7: Last resort - try to directly extract the dates from extended_data raw text
-- This is needed for cases where the timestamps are stored in an unusual format
UPDATE trades t
SET 
  entry_date = to_timestamp(SUBSTRING(t.extended_data::TEXT, 'boughtTimestamp": "([^"]+)"'), 'MM/DD/YYYY HH24:MI:SS'),
  exit_date = to_timestamp(SUBSTRING(t.extended_data::TEXT, 'soldTimestamp": "([^"]+)"'), 'MM/DD/YYYY HH24:MI:SS')
WHERE 
  t.platform = 'Tradovate'
  AND (t.entry_date IS NULL OR t.exit_date IS NULL)
  AND t.extended_data IS NOT NULL
  AND t.extended_data::TEXT ~ 'boughtTimestamp": "[0-9]{2}/[0-9]{2}/[0-9]{4}'
  AND t.extended_data::TEXT ~ 'soldTimestamp": "[0-9]{2}/[0-9]{2}/[0-9]{4}';

-- Verify the results of our fixes
SELECT 
  COUNT(*) as fixed_trades,
  MIN(entry_date) as earliest_entry,
  MAX(entry_date) as latest_entry,
  COUNT(CASE WHEN exit_date IS NULL THEN 1 END) as missing_exit_dates
FROM trades 
WHERE platform = 'Tradovate'; 