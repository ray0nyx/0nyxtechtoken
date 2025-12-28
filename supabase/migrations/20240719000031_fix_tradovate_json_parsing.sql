-- Fix the process_tradovate_csv_batch function to handle string inputs
DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, JSONB, UUID) CASCADE;
DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, JSONB) CASCADE;

-- Create the function with improved JSON handling
CREATE FUNCTION process_tradovate_csv_batch(
  p_account_id UUID,
  p_data JSONB,
  p_user_id UUID
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

  -- Handle the case where p_data might be a string JSON or a scalar
  BEGIN
    -- Check if p_data is already an array
    IF jsonb_typeof(p_data) = 'array' THEN
      v_parsed_data := p_data;
    ELSIF jsonb_typeof(p_data) = 'string' THEN
      -- Try to parse the string as JSON array
      v_parsed_data := p_data#>>'{}';
      
      -- Double-check if valid array after parsing
      IF jsonb_typeof(v_parsed_data) != 'array' THEN
        -- If still not an array, try to parse double-encoded JSON
        BEGIN
          -- Remove quotes and escape characters for proper parsing
          v_parsed_data := CAST(
            REPLACE(
              REPLACE(p_data#>>'{}', '\"', '"'), 
              '\\', ''
            ) AS JSONB
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'Unable to parse JSON data from string: %', SQLERRM;
        END;
      END IF;
    ELSE
      RAISE EXCEPTION 'Input data must be either a JSON array or a JSON string containing an array';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Error parsing input data: %', SQLERRM;
  END;

  -- Process each row from the parsed data
  FOR v_row IN SELECT * FROM jsonb_array_elements(v_parsed_data) LOOP
    BEGIN
      -- Process the row
      SELECT
        process_tradovate_csv_row(p_user_id, v_row, v_account_id)
      INTO v_result;
      
      -- Add the result to our array
      v_results := v_results || v_result;
      
      -- Increment success or failure counter
      IF (v_result->>'success')::BOOLEAN THEN
        v_successful_rows := v_successful_rows + 1;
      ELSE
        v_failed_rows := v_failed_rows + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- On exception, record the error
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(UUID, JSONB, UUID) TO authenticated;

-- Create the two-parameter version with explicit parameter names
CREATE FUNCTION process_tradovate_csv_batch(
  p_user_id UUID,
  p_data JSONB
)
RETURNS JSONB AS $$
BEGIN
  RETURN process_tradovate_csv_batch(NULL, p_data, p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(UUID, JSONB) TO authenticated; 