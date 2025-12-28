-- Migration: Fix Tradovate CSV processing
-- Description: Updates the process_tradovate_csv_batch function to properly handle JSON data

-- Log this migration
DO $$
BEGIN
  -- Check if migration has already been applied
  IF NOT EXISTS (
    SELECT 1 FROM public.migration_log 
    WHERE migration_name = '20240715000005_fix_tradovate_csv_processing'
  ) THEN
    -- Insert migration log entry
    INSERT INTO public.migration_log (migration_name, description, executed_at)
    VALUES ('20240715000005_fix_tradovate_csv_processing', 'Updates the process_tradovate_csv_batch function to properly handle JSON data', NOW());
  ELSE
    RAISE NOTICE 'Migration 20240715000005_fix_tradovate_csv_processing has already been applied.';
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
    VALUES ('20240715000005_fix_tradovate_csv_processing', 'Updates the process_tradovate_csv_batch function to properly handle JSON data', NOW());
END;
$$;

-- Drop the existing function
DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, JSONB, UUID) CASCADE;

-- Create an improved version of the function that properly handles JSON data
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
        clean_dollar_sign(v_row->>'pnl'),
        v_row->>'_priceFormat',
        clean_dollar_sign(v_row->>'_tickSize'),
        v_row->>'buyFillId',
        v_row->>'sellFillId',
        clean_dollar_sign(v_row->>'buyPrice'),
        clean_dollar_sign(v_row->>'sellPrice'),
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