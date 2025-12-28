-- Fix Trade Dates
-- This script updates the 'date' field in the trades table to match the 'entry_date' field
-- This ensures consistency between the Trades page and Analytics calendar

-- Log the start of the script execution
DO $$
BEGIN
  RAISE NOTICE 'Starting trade date fix script...';
END $$;

-- Count trades with mismatched dates before the update
DO $$
DECLARE
  mismatch_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO mismatch_count
  FROM trades
  WHERE date IS DISTINCT FROM entry_date;
  
  RAISE NOTICE 'Found % trades with mismatched dates', mismatch_count;
END $$;

-- Update the date field to match entry_date for all trades
UPDATE trades
SET date = entry_date
WHERE date IS DISTINCT FROM entry_date;

-- Count trades with mismatched dates after the update
DO $$
DECLARE
  mismatch_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO mismatch_count
  FROM trades
  WHERE date IS DISTINCT FROM entry_date;
  
  RAISE NOTICE 'After update: % trades with mismatched dates', mismatch_count;
END $$;

-- Refresh the analytics data to ensure it uses the updated dates
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT DISTINCT user_id FROM trades LOOP
    PERFORM populate_tradovate_analytics(user_record.user_id);
    RAISE NOTICE 'Refreshed analytics for user %', user_record.user_id;
  END LOOP;
END $$;

-- Log the completion of the script
DO $$
BEGIN
  RAISE NOTICE 'Trade date fix script completed successfully';
END $$; 