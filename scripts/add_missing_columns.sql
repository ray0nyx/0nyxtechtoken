-- Script to add missing entry_price and exit_price columns to the trades table if they don't exist

-- First, check if the columns already exist
DO $$
DECLARE
  v_has_entry_price BOOLEAN;
  v_has_exit_price BOOLEAN;
BEGIN
  -- Check for entry_price column
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'trades' 
    AND table_schema = 'public'
    AND column_name = 'entry_price'
  ) INTO v_has_entry_price;
  
  -- Check for exit_price column
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'trades' 
    AND table_schema = 'public'
    AND column_name = 'exit_price'
  ) INTO v_has_exit_price;
  
  -- Add entry_price column if it doesn't exist
  IF NOT v_has_entry_price THEN
    RAISE NOTICE 'Adding entry_price column to trades table';
    EXECUTE 'ALTER TABLE trades ADD COLUMN entry_price NUMERIC';
    
    -- Update existing trades to set entry_price = price
    EXECUTE 'UPDATE trades SET entry_price = price WHERE entry_price IS NULL';
    
    RAISE NOTICE 'entry_price column added and populated';
  ELSE
    RAISE NOTICE 'entry_price column already exists';
  END IF;
  
  -- Add exit_price column if it doesn't exist
  IF NOT v_has_exit_price THEN
    RAISE NOTICE 'Adding exit_price column to trades table';
    EXECUTE 'ALTER TABLE trades ADD COLUMN exit_price NUMERIC';
    
    -- Update existing trades to set exit_price = price
    EXECUTE 'UPDATE trades SET exit_price = price WHERE exit_price IS NULL';
    
    RAISE NOTICE 'exit_price column added and populated';
  ELSE
    RAISE NOTICE 'exit_price column already exists';
  END IF;
END $$;

-- Add entry_date and exit_date columns if they don't exist
DO $$
DECLARE
  v_has_entry_date BOOLEAN;
  v_has_exit_date BOOLEAN;
BEGIN
  -- Check for entry_date column
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'trades' 
    AND table_schema = 'public'
    AND column_name = 'entry_date'
  ) INTO v_has_entry_date;
  
  -- Check for exit_date column
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'trades' 
    AND table_schema = 'public'
    AND column_name = 'exit_date'
  ) INTO v_has_exit_date;
  
  -- Add entry_date column if it doesn't exist
  IF NOT v_has_entry_date THEN
    RAISE NOTICE 'Adding entry_date column to trades table';
    EXECUTE 'ALTER TABLE trades ADD COLUMN entry_date TIMESTAMP';
    
    -- Update existing trades to set entry_date = timestamp
    EXECUTE 'UPDATE trades SET entry_date = timestamp WHERE entry_date IS NULL';
    
    RAISE NOTICE 'entry_date column added and populated';
  ELSE
    RAISE NOTICE 'entry_date column already exists';
  END IF;
  
  -- Add exit_date column if it doesn't exist
  IF NOT v_has_exit_date THEN
    RAISE NOTICE 'Adding exit_date column to trades table';
    EXECUTE 'ALTER TABLE trades ADD COLUMN exit_date TIMESTAMP';
    
    -- Update existing trades to set exit_date = timestamp
    EXECUTE 'UPDATE trades SET exit_date = timestamp WHERE exit_date IS NULL';
    
    RAISE NOTICE 'exit_date column added and populated';
  ELSE
    RAISE NOTICE 'exit_date column already exists';
  END IF;
END $$;

-- Create a simple function to check the trades table structure
CREATE OR REPLACE FUNCTION check_trades_table()
RETURNS TABLE(column_name TEXT, data_type TEXT, is_nullable TEXT) AS $$
DECLARE
  r RECORD;
BEGIN
  RETURN QUERY
  SELECT c.column_name::TEXT, c.data_type::TEXT, c.is_nullable::TEXT
  FROM information_schema.columns c
  WHERE c.table_name = 'trades'
  AND c.table_schema = 'public'
  ORDER BY c.ordinal_position;
END;
$$ LANGUAGE plpgsql; 