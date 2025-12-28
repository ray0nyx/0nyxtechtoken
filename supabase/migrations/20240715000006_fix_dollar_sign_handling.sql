-- Migration: Fix dollar sign handling in CSV import
-- Description: Updates the database functions to better handle dollar signs in numeric fields

-- Log this migration
DO $$
BEGIN
  -- Check if migration has already been applied
  IF NOT EXISTS (
    SELECT 1 FROM public.migration_log 
    WHERE migration_name = '20240715000006_fix_dollar_sign_handling'
  ) THEN
    -- Insert migration log entry
    INSERT INTO public.migration_log (migration_name, description, executed_at)
    VALUES ('20240715000006_fix_dollar_sign_handling', 'Updates the database functions to better handle dollar signs in numeric fields', NOW());
  ELSE
    RAISE NOTICE 'Migration 20240715000006_fix_dollar_sign_handling has already been applied.';
    RETURN;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- If the migration_log table doesn't exist yet, create it
    CREATE TABLE IF NOT EXISTS public.migration_log (
      id SERIAL PRIMARY KEY,
      migration_name TEXT NOT NULL,
      description TEXT,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    
    -- Insert migration log entry
    INSERT INTO public.migration_log (migration_name, description, executed_at)
    VALUES ('20240715000006_fix_dollar_sign_handling', 'Updates the database functions to better handle dollar signs in numeric fields', NOW());
END;
$$;

-- Drop the existing function
DROP FUNCTION IF EXISTS clean_dollar_sign(TEXT) CASCADE;

-- Create an improved version of the function that handles dollar signs better
CREATE OR REPLACE FUNCTION clean_dollar_sign(value TEXT)
RETURNS NUMERIC AS $$
DECLARE
  cleaned_value TEXT;
BEGIN
  IF value IS NULL OR value = '' THEN
    RETURN NULL;
  END IF;
  
  -- First, trim whitespace
  cleaned_value := TRIM(value);
  
  -- Handle dollar sign at the beginning
  IF LEFT(cleaned_value, 1) = '$' THEN
    cleaned_value := SUBSTRING(cleaned_value FROM 2);
  END IF;
  
  -- Remove commas and other non-numeric characters except decimal points and negative signs
  cleaned_value := REGEXP_REPLACE(cleaned_value, '[^0-9.-]', '', 'g');
  
  -- Handle empty string after cleaning
  IF cleaned_value = '' OR cleaned_value = '-' OR cleaned_value = '.' THEN
    RETURN NULL;
  END IF;
  
  -- Convert to numeric
  BEGIN
    RETURN cleaned_value::NUMERIC;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Error converting value "%": %', value, SQLERRM;
      RETURN 0;
  END;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error cleaning dollar sign from value "%": %', value, SQLERRM;
    RETURN 0;
END;
$$ LANGUAGE plpgsql;

-- Update the process_tradovate_csv_row function to handle dollar signs better
DROP FUNCTION IF EXISTS process_tradovate_csv_row(UUID, TEXT, TIMESTAMP, TIMESTAMP, NUMERIC, TEXT, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, TIMESTAMP, TIMESTAMP, INTERVAL, UUID) CASCADE;

-- Function to process a single Tradovate CSV row with better dollar sign handling
CREATE OR REPLACE FUNCTION process_tradovate_csv_row(
  p_user_id UUID,
  p_symbol TEXT,
  p_created_at TIMESTAMP DEFAULT NULL,
  p_updated_at TIMESTAMP DEFAULT NULL,
  p_pnl TEXT DEFAULT NULL,
  p_price_format TEXT DEFAULT NULL,
  p_tick_size TEXT DEFAULT NULL,
  p_buy_fill_id TEXT DEFAULT NULL,
  p_sell_fill_id TEXT DEFAULT NULL,
  p_buy_price TEXT DEFAULT NULL,
  p_sell_price TEXT DEFAULT NULL,
  p_bought_timestamp TIMESTAMP DEFAULT NULL,
  p_sold_timestamp TIMESTAMP DEFAULT NULL,
  p_duration INTERVAL DEFAULT NULL,
  p_account_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_trade_id UUID;
  v_position TEXT;
  v_entry_date TIMESTAMP;
  v_exit_date TIMESTAMP;
  v_entry_price NUMERIC;
  v_exit_price NUMERIC;
  v_quantity INTEGER DEFAULT 1;
  v_date DATE;
  v_account_id UUID;
  v_pnl NUMERIC;
  v_tick_size NUMERIC;
  v_buy_price NUMERIC;
  v_sell_price NUMERIC;
BEGIN
  -- If account_id is not provided, get the default account for this user
  IF p_account_id IS NULL THEN
    SELECT id INTO v_account_id
    FROM trading_accounts
    WHERE user_id = p_user_id AND name = 'Default Tradovate Account'
    LIMIT 1;
  ELSE
    v_account_id := p_account_id;
  END IF;
  
  -- Clean numeric values
  v_pnl := clean_dollar_sign(p_pnl);
  v_tick_size := clean_dollar_sign(p_tick_size);
  v_buy_price := clean_dollar_sign(p_buy_price);
  v_sell_price := clean_dollar_sign(p_sell_price);
  
  -- Determine position (long or short) based on buy/sell prices and timestamps
  IF p_bought_timestamp IS NOT NULL AND p_bought_timestamp < p_sold_timestamp THEN
    v_position := 'long';
    v_entry_date := p_bought_timestamp;
    v_exit_date := p_sold_timestamp;
    v_entry_price := v_buy_price;
    v_exit_price := v_sell_price;
  ELSE
    v_position := 'short';
    v_entry_date := p_sold_timestamp;
    v_exit_date := p_bought_timestamp;
    v_entry_price := v_sell_price;
    v_exit_price := v_buy_price;
  END IF;
  
  -- Set date to the entry date (just the date part)
  v_date := DATE(v_entry_date);
  
  -- Insert the trade into the trades table
  INSERT INTO trades (
    user_id,
    symbol,
    position,
    entry_date,
    exit_date,
    entry_price,
    exit_price,
    quantity,
    pnl,
    broker,
    date,
    "buyFillId",
    "sellFillId",
    "buyPrice",
    "sellPrice",
    "boughtTimestamp",
    "soldTimestamp",
    duration,
    "_priceFormat",
    "_tickSize",
    created_at,
    updated_at,
    account_id
  ) VALUES (
    p_user_id,
    p_symbol,
    v_position,
    v_entry_date,
    v_exit_date,
    v_entry_price,
    v_exit_price,
    v_quantity,
    v_pnl,
    'Tradovate',
    v_date,
    p_buy_fill_id,
    p_sell_fill_id,
    v_buy_price,
    v_sell_price,
    p_bought_timestamp,
    p_sold_timestamp,
    p_duration,
    p_price_format,
    v_tick_size,
    COALESCE(p_created_at, NOW()),
    COALESCE(p_updated_at, NOW()),
    v_account_id
  ) RETURNING id INTO v_trade_id;
  
  -- Update analytics for this user
  PERFORM populate_analytics_table(p_user_id);
  
  RETURN v_trade_id;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    RAISE NOTICE 'Error processing Tradovate CSV row: %', SQLERRM;
    -- Return NULL to indicate failure
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Update the process_tradovate_csv_batch function to handle dollar signs better
DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, JSONB, UUID) CASCADE;

-- Function to process a batch of Tradovate CSV rows with better dollar sign handling
CREATE OR REPLACE FUNCTION process_tradovate_csv_batch(
  p_user_id UUID,
  p_data JSONB,
  p_account_id UUID DEFAULT NULL
)
RETURNS TABLE(
  trade_id UUID,
  success BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_row JSONB;
  v_trade_id UUID;
  v_error TEXT;
  v_account_id UUID;
  v_data_array JSONB;
BEGIN
  -- If account_id is not provided, get the default account for this user
  IF p_account_id IS NULL THEN
    SELECT id INTO v_account_id
    FROM trading_accounts
    WHERE user_id = p_user_id AND name = 'Default Tradovate Account'
    LIMIT 1;
  ELSE
    v_account_id := p_account_id;
  END IF;
  
  -- Ensure p_data is an array
  IF jsonb_typeof(p_data) = 'array' THEN
    v_data_array := p_data;
  ELSE
    -- If it's not an array, try to parse it as an array
    BEGIN
      -- Try to wrap it in an array if it's an object
      IF jsonb_typeof(p_data) = 'object' THEN
        v_data_array := jsonb_build_array(p_data);
      ELSE
        -- If it's a scalar, create an empty array
        v_data_array := '[]'::jsonb;
        RAISE NOTICE 'Invalid data format: expected array, got %', jsonb_typeof(p_data);
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        -- If all else fails, use an empty array
        v_data_array := '[]'::jsonb;
        RAISE NOTICE 'Error converting data to array: %', SQLERRM;
    END;
  END IF;
  
  -- Process each row in the batch
  FOR v_row IN SELECT * FROM jsonb_array_elements(v_data_array) LOOP
    BEGIN
      -- Handle missing Fill Time
      v_row := handle_tradovate_missing_fill_time(v_row);
      
      -- Process the row and get the trade ID
      v_trade_id := process_tradovate_csv_row(
        p_user_id,
        v_row->>'symbol',
        (v_row->>'created_at')::TIMESTAMP,
        (v_row->>'updated_at')::TIMESTAMP,
        v_row->>'pnl',
        v_row->>'_priceFormat',
        v_row->>'_tickSize',
        v_row->>'buyFillId',
        v_row->>'sellFillId',
        v_row->>'buyPrice',
        v_row->>'sellPrice',
        (v_row->>'boughtTimestamp')::TIMESTAMP,
        (v_row->>'soldTimestamp')::TIMESTAMP,
        (v_row->>'duration')::INTERVAL,
        v_account_id
      );
      
      -- Return success
      trade_id := v_trade_id;
      success := v_trade_id IS NOT NULL;
      error_message := NULL;
      RETURN NEXT;
    EXCEPTION
      WHEN OTHERS THEN
        -- Return failure with error message
        trade_id := NULL;
        success := FALSE;
        error_message := SQLERRM;
        RETURN NEXT;
    END;
  END LOOP;
  
  -- If no rows were processed, return a single row with an error
  IF NOT FOUND THEN
    trade_id := NULL;
    success := FALSE;
    error_message := 'No valid rows found in the data';
    RETURN NEXT;
  END IF;
END;
$$ LANGUAGE plpgsql; 