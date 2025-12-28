-- Fix entry_date and exit_date for Tradovate trades where timestamps exist
UPDATE trades
SET 
  entry_date = "boughtTimestamp",
  exit_date = "soldTimestamp"
WHERE 
  platform = 'Tradovate' 
  AND "boughtTimestamp" IS NOT NULL
  AND "soldTimestamp" IS NOT NULL;

-- For records where bought is after sold (short trades)
UPDATE trades
SET 
  entry_date = "soldTimestamp",
  exit_date = "boughtTimestamp"
WHERE 
  platform = 'Tradovate' 
  AND "boughtTimestamp" IS NOT NULL
  AND "soldTimestamp" IS NOT NULL
  AND "boughtTimestamp" > "soldTimestamp";

-- For trades with no timestamps, check if they have the right timestamps in the extended_data column
UPDATE trades 
SET 
  "boughtTimestamp" = (extended_data->>'boughtTimestamp')::TIMESTAMP,
  "soldTimestamp" = (extended_data->>'soldTimestamp')::TIMESTAMP
WHERE 
  platform = 'Tradovate'
  AND "boughtTimestamp" IS NULL
  AND extended_data->>'boughtTimestamp' IS NOT NULL;

-- Now update entry_date and exit_date for those we just updated
UPDATE trades
SET 
  entry_date = "boughtTimestamp",
  exit_date = "soldTimestamp",
  date = "boughtTimestamp"::DATE,
  duration = 
    CASE 
      WHEN "boughtTimestamp" IS NOT NULL AND "soldTimestamp" IS NOT NULL THEN
        "soldTimestamp" - "boughtTimestamp"
      ELSE
        duration
    END
WHERE 
  platform = 'Tradovate' 
  AND "boughtTimestamp" IS NOT NULL
  AND "soldTimestamp" IS NOT NULL
  AND "boughtTimestamp" <= "soldTimestamp"
  AND (entry_date IS NULL OR exit_date IS NULL);

-- Update for short trades
UPDATE trades
SET 
  entry_date = "soldTimestamp",
  exit_date = "boughtTimestamp",
  date = "soldTimestamp"::DATE,
  duration = 
    CASE 
      WHEN "boughtTimestamp" IS NOT NULL AND "soldTimestamp" IS NOT NULL THEN
        "boughtTimestamp" - "soldTimestamp" 
      ELSE
        duration
    END
WHERE 
  platform = 'Tradovate' 
  AND "boughtTimestamp" IS NOT NULL
  AND "soldTimestamp" IS NOT NULL
  AND "boughtTimestamp" > "soldTimestamp"
  AND (entry_date IS NULL OR exit_date IS NULL);

-- For the remaining trades with no timestamps, try to extract dates from the original CSV data
UPDATE trades
SET 
  entry_date = (extended_data->>'boughtTimestamp')::TIMESTAMP,
  exit_date = (extended_data->>'soldTimestamp')::TIMESTAMP
WHERE 
  platform = 'Tradovate'
  AND (entry_date IS NULL OR exit_date IS NULL)
  AND extended_data->>'boughtTimestamp' IS NOT NULL;

-- Calculate durations for all trades
UPDATE trades
SET 
  duration = 
    CASE 
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