-- Comprehensive fix for Tradovate CSV processing
-- This migration addresses both function signature issues and dollar amount handling

-- First, create a more robust clean_dollar_amount function
CREATE OR REPLACE FUNCTION clean_dollar_amount(p_value TEXT)
RETURNS NUMERIC AS $$
DECLARE
    v_cleaned TEXT;
    v_is_negative BOOLEAN := FALSE;
BEGIN
    -- Handle NULL values
    IF p_value IS NULL OR p_value = '' THEN
        RETURN 0;
    END IF;
    
    v_cleaned := p_value;
    
    -- Check if value is in parentheses (indicating negative)
    IF v_cleaned LIKE '%(%' OR v_cleaned LIKE '%(%)%' THEN
        v_is_negative := TRUE;
    END IF;
    
    -- Remove dollar signs
    v_cleaned := REPLACE(v_cleaned, '$', '');
    
    -- Remove commas
    v_cleaned := REPLACE(v_cleaned, ',', '');
    
    -- Remove parentheses
    v_cleaned := REPLACE(v_cleaned, '(', '');
    v_cleaned := REPLACE(v_cleaned, ')', '');
    
    -- Add negative sign if needed
    IF v_is_negative THEN
        v_cleaned := '-' || v_cleaned;
    END IF;
    
    -- Ensure it's a valid number, return 0 if not
    BEGIN
        RETURN v_cleaned::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Could not convert "%" to numeric, returning 0', p_value;
        RETURN 0;
    END;
END;
$$ LANGUAGE plpgsql;

-- Create a function that parses a JSONB value to numeric more safely
CREATE OR REPLACE FUNCTION safe_numeric_from_jsonb(p_json JSONB, p_key TEXT)
RETURNS NUMERIC AS $$
DECLARE
    v_value TEXT;
BEGIN
    -- Extract the value as text first
    v_value := p_json->>p_key;
    
    -- Use clean_dollar_amount to handle formatting
    RETURN clean_dollar_amount(v_value);
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error parsing numeric value for key %: %', p_key, SQLERRM;
    RETURN 0;
END;
$$ LANGUAGE plpgsql;

-- Now create the process_tradovate_csv_row function with EXACT parameter types
-- that match the function call signature (uuid, jsonb, uuid)
DROP FUNCTION IF EXISTS process_tradovate_csv_row(UUID, JSONB, UUID) CASCADE;

CREATE OR REPLACE FUNCTION process_tradovate_csv_row(
    p_user_id UUID,
    p_row JSONB,
    p_account_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_symbol TEXT;
    v_date DATE;
    v_qty INTEGER;
    v_entry_price NUMERIC;
    v_exit_price NUMERIC;
    v_fees NUMERIC;
    v_pnl NUMERIC;
    v_buy_fill_id TEXT;
    v_sell_fill_id TEXT;
    v_bought_timestamp TIMESTAMP;
    v_sold_timestamp TIMESTAMP;
    v_duration TEXT;
    v_metrics_exist BOOLEAN;
    v_trade_id UUID;
BEGIN
    -- Check if metrics exist before we start
    SELECT EXISTS(
        SELECT 1 
        FROM analytics 
        WHERE user_id = p_user_id
    ) INTO v_metrics_exist;
    
    IF NOT v_metrics_exist THEN
        -- Try to initialize metrics
        PERFORM calculate_user_analytics(p_user_id);
        
        -- Check again
        SELECT EXISTS(
            SELECT 1 
            FROM analytics 
            WHERE user_id = p_user_id
        ) INTO v_metrics_exist;
        
        IF NOT v_metrics_exist THEN
            RAISE WARNING 'No metrics found for user %, but continuing anyway', p_user_id;
        END IF;
    END IF;

    -- Extract trade data from the row with safer parsing
    v_symbol := p_row->>'symbol';
    
    -- Handle date fields
    BEGIN
        v_date := (p_row->>'date')::DATE;
    EXCEPTION WHEN OTHERS THEN
        -- Fall back to current date if parsing fails
        v_date := CURRENT_DATE;
    END;
    
    -- Parse quantity safely
    BEGIN
        v_qty := (p_row->>'qty')::INTEGER;
    EXCEPTION WHEN OTHERS THEN
        v_qty := 1; -- Default to 1 if parsing fails
    END;
    
    -- Use our safe numeric parsing for monetary values
    v_entry_price := safe_numeric_from_jsonb(p_row, 'entry_price');
    v_exit_price := safe_numeric_from_jsonb(p_row, 'exit_price');
    v_fees := safe_numeric_from_jsonb(p_row, 'fees');
    v_pnl := safe_numeric_from_jsonb(p_row, 'pnl');
    
    v_buy_fill_id := p_row->>'buyFillId';
    v_sell_fill_id := p_row->>'sellFillId';
    
    -- Handle timestamp fields safely
    BEGIN
        v_bought_timestamp := (p_row->>'boughtTimestamp')::TIMESTAMP;
    EXCEPTION WHEN OTHERS THEN
        v_bought_timestamp := NULL;
    END;
    
    BEGIN
        v_sold_timestamp := (p_row->>'soldTimestamp')::TIMESTAMP;
    EXCEPTION WHEN OTHERS THEN
        v_sold_timestamp := NULL;
    END;
    
    v_duration := p_row->>'duration';
    
    -- Validate required fields
    IF v_symbol IS NULL OR v_qty IS NULL OR 
       v_entry_price IS NULL OR v_exit_price IS NULL THEN
        RAISE EXCEPTION 'Missing required fields in trade data: %', p_row;
    END IF;
    
    -- Handle missing date
    IF v_date IS NULL THEN
        v_date := COALESCE(v_bought_timestamp::DATE, v_sold_timestamp::DATE, CURRENT_DATE);
    END IF;
    
    -- Insert trade into the trades table with robust error handling
    BEGIN
        INSERT INTO trades (
            user_id,
            account_id,
            symbol,
            date,
            broker,
            direction,
            quantity,
            entry_price,
            exit_price,
            pnl,
            fees,
            buy_fill_id,
            sell_fill_id,
            entry_date,
            exit_date,
            duration,
            created_at,
            updated_at
        ) VALUES (
            p_user_id,
            p_account_id,
            v_symbol,
            v_date,
            'Tradovate',
            CASE WHEN v_qty > 0 THEN 'long' ELSE 'short' END,
            ABS(v_qty),
            v_entry_price,
            v_exit_price,
            v_pnl,
            v_fees,
            v_buy_fill_id,
            v_sell_fill_id,
            v_bought_timestamp,
            v_sold_timestamp,
            v_duration,
            NOW(),
            NOW()
        )
        RETURNING id INTO v_trade_id;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Error inserting trade: %', SQLERRM;
    END;
    
    -- Return success with the trade ID
    RETURN jsonb_build_object(
        'success', TRUE,
        'trade_id', v_trade_id
    );
    
EXCEPTION WHEN OTHERS THEN
    -- Return error info
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', SQLERRM,
        'trade_data', p_row
    );
END;
$$ LANGUAGE plpgsql;

-- Now also update the process_tradovate_csv_batch function to better handle JSON inputs
DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, JSONB, UUID) CASCADE;

CREATE FUNCTION process_tradovate_csv_batch(
  p_user_id UUID,
  p_data JSONB,
  p_account_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_row JSONB;
  v_result JSONB;
  v_successful_rows INT := 0;
  v_failed_rows INT := 0;
  v_results JSONB[] := '{}';
  v_error TEXT;
  v_analytics_record_exists BOOLEAN;
  v_account_id UUID := p_account_id;
  v_parsed_data JSONB;
BEGIN
  -- Validate the account ID
  IF v_account_id IS NULL THEN
    -- Try to find a default account for the user
    SELECT id INTO v_account_id 
    FROM trading_accounts 
    WHERE user_id = p_user_id 
    ORDER BY COALESCE(is_default, FALSE) DESC, created_at ASC 
    LIMIT 1;
    
    IF v_account_id IS NULL THEN
      -- No account found, create a default account
      INSERT INTO trading_accounts (user_id, name, is_default) 
      VALUES (p_user_id, 'Default Account', TRUE)
      RETURNING id INTO v_account_id;
    END IF;
  END IF;

  -- Convert any non-array input to array format
  IF jsonb_typeof(p_data) = 'array' THEN
    v_parsed_data := p_data;
  ELSE
    -- Try to treat as a single object and wrap in array
    BEGIN
      v_parsed_data := jsonb_build_array(p_data);
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Input data must be a JSON array or object';
    END;
  END IF;

  -- Process each row with robust error handling for each row
  FOR v_row IN SELECT * FROM jsonb_array_elements(v_parsed_data) LOOP
    BEGIN
      -- Process the row with the exact function signature
      v_result := process_tradovate_csv_row(p_user_id, v_row, v_account_id);
      
      -- Add the result to our array
      v_results := v_results || v_result;
      
      -- Increment success or failure counter
      IF (v_result->>'success')::BOOLEAN THEN
        v_successful_rows := v_successful_rows + 1;
      ELSE
        v_failed_rows := v_failed_rows + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- On exception, record the error but continue processing other rows
      v_error := SQLERRM;
      v_results := v_results || jsonb_build_object(
        'success', FALSE,
        'error', 'Error processing row: ' || v_error,
        'data', v_row
      );
      v_failed_rows := v_failed_rows + 1;
    END;
  END LOOP;
  
  -- Ensure analytics exist for this user
  BEGIN
    SELECT EXISTS(
      SELECT 1 FROM analytics WHERE user_id = p_user_id
    ) INTO v_analytics_record_exists;
    
    -- If no analytics record exists, create one
    IF NOT v_analytics_record_exists THEN
      PERFORM calculate_user_analytics(p_user_id);
    ELSE
      -- Update analytics for this user
      PERFORM update_analytics_for_user(p_user_id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error updating analytics: %', SQLERRM;
    -- Continue processing even if analytics update fails
  END;
  
  -- Return the summary
  RETURN jsonb_build_object(
    'success', TRUE,
    'processed', v_successful_rows,
    'failed', v_failed_rows,
    'total', v_successful_rows + v_failed_rows,
    'results', to_jsonb(v_results)
  );
EXCEPTION WHEN OTHERS THEN
  v_error := SQLERRM;
  RETURN jsonb_build_object(
    'success', FALSE,
    'error', 'Error processing batch: ' || v_error,
    'processed', v_successful_rows,
    'failed', v_failed_rows
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also create the two-parameter version
CREATE OR REPLACE FUNCTION process_tradovate_csv_batch(
  p_user_id UUID,
  p_data JSONB
)
RETURNS JSONB AS $$
BEGIN
  RETURN process_tradovate_csv_batch(p_user_id, p_data, NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on all functions
GRANT EXECUTE ON FUNCTION clean_dollar_amount(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION safe_numeric_from_jsonb(JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION process_tradovate_csv_row(UUID, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(UUID, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(UUID, JSONB) TO authenticated; 