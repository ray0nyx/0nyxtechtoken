-- DIRECT FIX FOR TRADOVATE DATES
-- This script should be run directly in the Supabase SQL editor
-- It will fix dates for all existing Tradovate trades

-- First, extract timestamps from extended_data for trades with missing timestamps
WITH trade_data AS (
  SELECT 
    id, 
    extended_data
  FROM 
    trades
  WHERE 
    platform = 'Tradovate' 
    AND ("boughtTimestamp" IS NULL OR "soldTimestamp" IS NULL)
    AND extended_data IS NOT NULL
)
UPDATE trades t
SET 
  "boughtTimestamp" = CASE 
    WHEN e.extended_data->>'boughtTimestamp' IS NOT NULL THEN 
      (e.extended_data->>'boughtTimestamp')::TIMESTAMP
    ELSE
      "boughtTimestamp"
    END,
  "soldTimestamp" = CASE 
    WHEN e.extended_data->>'soldTimestamp' IS NOT NULL THEN 
      (e.extended_data->>'soldTimestamp')::TIMESTAMP
    ELSE
      "soldTimestamp"
    END
FROM trade_data e
WHERE t.id = e.id;

-- Now update entry and exit dates based on saved timestamps
-- For long trades (bought before sold)
UPDATE trades
SET 
  entry_date = "boughtTimestamp",
  exit_date = "soldTimestamp",
  date = COALESCE("boughtTimestamp"::DATE, date),
  duration = CASE 
    WHEN "boughtTimestamp" IS NOT NULL AND "soldTimestamp" IS NOT NULL THEN
      "soldTimestamp" - "boughtTimestamp"
    ELSE
      duration
    END
WHERE
  platform = 'Tradovate'
  AND "boughtTimestamp" IS NOT NULL
  AND "soldTimestamp" IS NOT NULL
  AND "boughtTimestamp" <= "soldTimestamp";

-- For short trades (sold before bought)
UPDATE trades
SET 
  entry_date = "soldTimestamp",
  exit_date = "boughtTimestamp",
  date = COALESCE("soldTimestamp"::DATE, date),
  duration = CASE 
    WHEN "boughtTimestamp" IS NOT NULL AND "soldTimestamp" IS NOT NULL THEN
      "boughtTimestamp" - "soldTimestamp"
    ELSE
      duration
    END
WHERE
  platform = 'Tradovate'
  AND "boughtTimestamp" IS NOT NULL
  AND "soldTimestamp" IS NOT NULL
  AND "boughtTimestamp" > "soldTimestamp";

-- For trades without specific timestamp data, set entry_date = created_at and exit_date = entry_date
UPDATE trades
SET 
  entry_date = CASE WHEN entry_date IS NULL THEN created_at ELSE entry_date END,
  exit_date = CASE WHEN exit_date IS NULL THEN entry_date ELSE exit_date END
WHERE
  platform = 'Tradovate'
  AND (entry_date IS NULL OR exit_date IS NULL);

-- Calculate durations for any remaining trades without durations
UPDATE trades
SET 
  duration = CASE 
    WHEN entry_date IS NOT NULL AND exit_date IS NOT NULL THEN
      exit_date - entry_date
    ELSE
      duration
    END
WHERE
  platform = 'Tradovate'
  AND entry_date IS NOT NULL
  AND exit_date IS NOT NULL
  AND duration IS NULL; 