-- Enhanced TopstepX Row Processing Fix
-- This script improves the processing of TopstepX CSV rows with better error handling
-- and more robust data parsing for dates, prices, and other fields

-- Drop existing functions to avoid conflicts
DROP FUNCTION IF EXISTS process_topstepx_csv_batch(uuid, jsonb, uuid);
DROP FUNCTION IF EXISTS process_topstepx_csv_batch(jsonb);

-- Helper function to ensure account exists
CREATE OR REPLACE FUNCTION ensure_account_exists(
  p_user_id UUID
) RETURNS UUID AS $$
DECLARE
  v_account_id UUID;
BEGIN
  -- Check if user already has an account
  SELECT id INTO v_account_id 
  FROM accounts 
  WHERE user_id = p_user_id
  LIMIT 1;
  
  -- If no account exists, create one
  IF v_account_id IS NULL THEN
    INSERT INTO accounts (user_id, name)
    VALUES (p_user_id, 'Default Account')
    RETURNING id INTO v_account_id;
  END IF;
  
  RETURN v_account_id;
END;
$$ LANGUAGE plpgsql;

-- Main function to process TopstepX CSV batch with enhanced error handling
CREATE OR REPLACE FUNCTION process_topstepx_csv_batch(
  p_user_id UUID, 
  p_rows JSONB,
  p_account_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_row JSONB;
  v_row_index INTEGER;
  v_total_rows INTEGER;
  v_success_count INTEGER := 0;
  v_error_count INTEGER := 0;
  v_account_id UUID;
  v_trade_id UUID;
  v_errors JSONB := '[]'::JSONB;
  v_contract_name TEXT;
  v_entry_price NUMERIC;
  v_exit_price NUMERIC;
  v_size NUMERIC;
  v_pnl NUMERIC;
  v_fees NUMERIC;
  v_entered_at TIMESTAMP;
  v_exited_at TIMESTAMP;
  v_mdy_regex TEXT := '^\d{1,2}/\d{1,2}/\d{4}';
  v_numeric_regex TEXT := '^-?\d+(\.\d+)?$';
  v_result_message TEXT;
BEGIN
  -- Input validation
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID cannot be null';
  END IF;
  
  -- Handle json parsing if input is string
  IF jsonb_typeof(p_rows) = 'string' THEN
    BEGIN
      p_rows := p_rows::JSONB;
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'message', 'Invalid JSON input',
        'error', SQLERRM
      );
    END;
  END IF;
  
  -- Ensure we have an array
  IF jsonb_typeof(p_rows) != 'array' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'Expected JSON array of rows',
      'received', jsonb_typeof(p_rows)
    );
  END IF;
  
  -- Determine account ID - if NULL, ensure one exists for the user
  IF p_account_id IS NULL THEN
    v_account_id := ensure_account_exists(p_user_id);
  ELSE
    v_account_id := p_account_id;
  END IF;
  
  -- Process rows
  v_total_rows := jsonb_array_length(p_rows);
  
  FOR v_row_index IN 0..(v_total_rows - 1) LOOP
    BEGIN
      v_row := p_rows->v_row_index;
      
      -- Reset variables for this row
      v_contract_name := NULL;
      v_entry_price := NULL;
      v_exit_price := NULL;
      v_size := NULL;
      v_pnl := NULL;
      v_fees := NULL;
      v_entered_at := NULL;
      v_exited_at := NULL;
      
      -- 1. Extract and validate contract_name (required)
      IF v_row ? 'contract_name' AND (v_row->>'contract_name') IS NOT NULL AND (v_row->>'contract_name') != '' THEN
        v_contract_name := v_row->>'contract_name';
      ELSE
        RAISE EXCEPTION 'Missing required field: contract_name at row %', v_row_index;
      END IF;
      
      -- 2. Extract and parse entry_price (required)
      IF v_row ? 'entry_price' AND (v_row->>'entry_price') IS NOT NULL AND (v_row->>'entry_price') != '' THEN
        -- Handle different formats ($1,234.56 or 1234.56)
        IF (v_row->>'entry_price') ~ v_numeric_regex THEN
          -- Clean numeric format
          v_entry_price := (v_row->>'entry_price')::NUMERIC;
        ELSE
          -- Try removing currency symbols and commas
          DECLARE
            v_cleaned_price TEXT;
          BEGIN
            v_cleaned_price := REPLACE(REPLACE(v_row->>'entry_price', '$', ''), ',', '');
            
            IF v_cleaned_price ~ v_numeric_regex THEN
              v_entry_price := v_cleaned_price::NUMERIC;
            ELSE
              RAISE EXCEPTION 'Invalid entry_price format: % at row %', v_row->>'entry_price', v_row_index;
            END IF;
          EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Invalid entry_price format: % at row %', v_row->>'entry_price', v_row_index;
          END;
        END IF;
      ELSE
        RAISE EXCEPTION 'Missing required field: entry_price at row %', v_row_index;
      END IF;
      
      -- 3. Extract and parse exit_price (required)
      IF v_row ? 'exit_price' AND (v_row->>'exit_price') IS NOT NULL AND (v_row->>'exit_price') != '' THEN
        -- Handle different formats ($1,234.56 or 1234.56)
        IF (v_row->>'exit_price') ~ v_numeric_regex THEN
          -- Clean numeric format
          v_exit_price := (v_row->>'exit_price')::NUMERIC;
        ELSE
          -- Try removing currency symbols and commas
          DECLARE
            v_cleaned_price TEXT;
          BEGIN
            v_cleaned_price := REPLACE(REPLACE(v_row->>'exit_price', '$', ''), ',', '');
            
            IF v_cleaned_price ~ v_numeric_regex THEN
              v_exit_price := v_cleaned_price::NUMERIC;
            ELSE
              RAISE EXCEPTION 'Invalid exit_price format: % at row %', v_row->>'exit_price', v_row_index;
            END IF;
          EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Invalid exit_price format: % at row %', v_row->>'exit_price', v_row_index;
          END;
        END IF;
      ELSE
        RAISE EXCEPTION 'Missing required field: exit_price at row %', v_row_index;
      END IF;
      
      -- 4. Extract and parse size (optional)
      IF v_row ? 'size' AND (v_row->>'size') IS NOT NULL AND (v_row->>'size') != '' THEN
        BEGIN
          -- Try direct conversion first
          v_size := (v_row->>'size')::NUMERIC;
        EXCEPTION WHEN OTHERS THEN
          -- Try cleaning and converting
          DECLARE
            v_cleaned_size TEXT;
          BEGIN
            v_cleaned_size := REPLACE(v_row->>'size', ',', '');
            v_size := v_cleaned_size::NUMERIC;
          EXCEPTION WHEN OTHERS THEN
            -- Default to 1 if can't parse
            v_size := 1;
          END;
        END;
      ELSE
        -- Default to 1 if missing
        v_size := 1;
      END IF;
      
      -- 5. Extract and parse PnL (optional)
      IF v_row ? 'pnl' AND (v_row->>'pnl') IS NOT NULL AND (v_row->>'pnl') != '' THEN
        BEGIN
          -- Try direct conversion first
          v_pnl := (v_row->>'pnl')::NUMERIC;
        EXCEPTION WHEN OTHERS THEN
          -- Try cleaning and converting
          DECLARE
            v_cleaned_pnl TEXT;
          BEGIN
            v_cleaned_pnl := REPLACE(REPLACE(v_row->>'pnl', '$', ''), ',', '');
            v_pnl := v_cleaned_pnl::NUMERIC;
          EXCEPTION WHEN OTHERS THEN
            -- Calculate from prices if can't parse
            v_pnl := (v_exit_price - v_entry_price) * v_size;
          END;
        END;
      ELSE
        -- Calculate from prices if missing
        v_pnl := (v_exit_price - v_entry_price) * v_size;
      END IF;
      
      -- 6. Extract and parse fees (optional)
      IF v_row ? 'fees' AND (v_row->>'fees') IS NOT NULL AND (v_row->>'fees') != '' THEN
        BEGIN
          -- Try direct conversion first
          v_fees := (v_row->>'fees')::NUMERIC;
        EXCEPTION WHEN OTHERS THEN
          -- Try cleaning and converting
          DECLARE
            v_cleaned_fees TEXT;
          BEGIN
            v_cleaned_fees := REPLACE(REPLACE(v_row->>'fees', '$', ''), ',', '');
            v_fees := v_cleaned_fees::NUMERIC;
          EXCEPTION WHEN OTHERS THEN
            -- Default to 0 if can't parse
            v_fees := 0;
          END;
        END;
      ELSE
        -- Default to 0 if missing
        v_fees := 0;
      END IF;
      
      -- 7. Extract and parse entered_at (required)
      IF v_row ? 'entered_at' AND (v_row->>'entered_at') IS NOT NULL AND (v_row->>'entered_at') != '' THEN
        BEGIN
          -- Try direct conversion for ISO format
          IF (v_row->>'entered_at') ~ '^\d{4}-\d{2}-\d{2}' THEN
            v_entered_at := (v_row->>'entered_at')::TIMESTAMP;
          -- Try MM/DD/YYYY format
          ELSIF (v_row->>'entered_at') ~ v_mdy_regex THEN
            BEGIN
              v_entered_at := TO_TIMESTAMP(v_row->>'entered_at', 'MM/DD/YYYY HH24:MI:SS');
            EXCEPTION WHEN OTHERS THEN
              v_entered_at := TO_TIMESTAMP(v_row->>'entered_at', 'MM/DD/YYYY');
            END;
          ELSE
            RAISE EXCEPTION 'Invalid entered_at date format: % at row %', v_row->>'entered_at', v_row_index;
          END IF;
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'Invalid entered_at date format: % at row %', v_row->>'entered_at', v_row_index;
        END;
      ELSE
        RAISE EXCEPTION 'Missing required field: entered_at at row %', v_row_index;
      END IF;
      
      -- 8. Extract and parse exited_at (required)
      IF v_row ? 'exited_at' AND (v_row->>'exited_at') IS NOT NULL AND (v_row->>'exited_at') != '' THEN
        BEGIN
          -- Try direct conversion for ISO format
          IF (v_row->>'exited_at') ~ '^\d{4}-\d{2}-\d{2}' THEN
            v_exited_at := (v_row->>'exited_at')::TIMESTAMP;
          -- Try MM/DD/YYYY format
          ELSIF (v_row->>'exited_at') ~ v_mdy_regex THEN
            BEGIN
              v_exited_at := TO_TIMESTAMP(v_row->>'exited_at', 'MM/DD/YYYY HH24:MI:SS');
            EXCEPTION WHEN OTHERS THEN
              v_exited_at := TO_TIMESTAMP(v_row->>'exited_at', 'MM/DD/YYYY');
            END;
          ELSE
            RAISE EXCEPTION 'Invalid exited_at date format: % at row %', v_row->>'exited_at', v_row_index;
          END IF;
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'Invalid exited_at date format: % at row %', v_row->>'exited_at', v_row_index;
        END;
      ELSE
        RAISE EXCEPTION 'Missing required field: exited_at at row %', v_row_index;
      END IF;
      
      -- Insert the trade
      INSERT INTO trades (
        account_id,
        user_id,
        contract_name,
        entry_price,
        exit_price,
        size,
        pnl,
        fees,
        entered_at,
        exited_at,
        source
      ) VALUES (
        v_account_id,
        p_user_id,
        v_contract_name,
        v_entry_price,
        v_exit_price,
        v_size,
        v_pnl,
        v_fees,
        v_entered_at,
        v_exited_at,
        'topstepx'
      ) RETURNING id INTO v_trade_id;
      
      v_success_count := v_success_count + 1;

    EXCEPTION WHEN OTHERS THEN
      v_error_count := v_error_count + 1;
      
      -- Add error details to array
      v_errors := v_errors || jsonb_build_object(
        'row', v_row_index,
        'error', SQLERRM,
        'data', v_row
      );
    END;
  END LOOP;
  
  -- Construct result message
  IF v_error_count > 0 THEN
    v_result_message := format('Processed %s rows: %s successful, %s failed', 
                              v_total_rows, v_success_count, v_error_count);
  ELSE
    v_result_message := format('Successfully processed all %s rows', v_total_rows);
  END IF;
  
  -- Return results
  RETURN jsonb_build_object(
    'success', v_success_count > 0,
    'message', v_result_message,
    'total_rows', v_total_rows,
    'success_count', v_success_count,
    'error_count', v_error_count,
    'errors', v_errors
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Legacy API Wrapper (to maintain compatibility)
CREATE OR REPLACE FUNCTION process_topstepx_csv_batch(p_data JSONB) 
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_rows JSONB;
  v_account_id UUID;
BEGIN
  -- Extract parameters from JSON
  v_user_id := (p_data->>'user_id')::UUID;
  v_rows := p_data->'rows';
  
  -- Account ID is optional
  IF p_data ? 'account_id' AND (p_data->>'account_id') IS NOT NULL AND (p_data->>'account_id') != '' THEN
    v_account_id := (p_data->>'account_id')::UUID;
  ELSE
    v_account_id := NULL;
  END IF;
  
  -- Call the main function
  RETURN process_topstepx_csv_batch(v_user_id, v_rows, v_account_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', FALSE,
    'message', 'Error processing batch',
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissions
GRANT EXECUTE ON FUNCTION process_topstepx_csv_batch(UUID, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION process_topstepx_csv_batch(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_account_exists(UUID) TO authenticated;

-- Create debug function to extract problematic row
CREATE OR REPLACE FUNCTION debug_topstepx_row(
  p_rows JSONB,
  p_row_number INTEGER
) RETURNS TEXT AS $$
DECLARE
  v_row JSONB;
  v_result TEXT;
BEGIN
  -- Input validation
  IF jsonb_typeof(p_rows) != 'array' THEN
    RETURN 'Error: Input is not a JSONB array';
  END IF;
  
  IF p_row_number < 0 OR p_row_number >= jsonb_array_length(p_rows) THEN
    RETURN format('Error: Row number %s is out of bounds (0-%s)', 
                  p_row_number, jsonb_array_length(p_rows) - 1);
  END IF;
  
  -- Get the specified row
  v_row := p_rows->p_row_number;
  
  -- Return detailed info about this row
  RETURN jsonb_pretty(v_row);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION debug_topstepx_row(JSONB, INTEGER) TO authenticated; 