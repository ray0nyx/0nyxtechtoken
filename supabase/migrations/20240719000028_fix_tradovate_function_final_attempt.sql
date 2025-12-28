-- This migration uses a more aggressive approach to fix the Tradovate CSV processing issues
-- We'll drop all existing versions of the functions, then create new ones with the right names

-- First, drop all variants of both function names to start with a clean slate
DO $$
BEGIN
  -- Attempt to drop all possible versions with generic parameter types
  -- Note: Using CASCADE to ensure dependent objects are also removed
  -- Using loop to catch any exceptions and continue
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, JSONB, UUID) CASCADE';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error dropping function: %', SQLERRM;
  END;
  
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, UUID, JSONB) CASCADE';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error dropping function: %', SQLERRM;
  END;
  
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS process_tradovate_csv_batch_alt(UUID, JSONB, UUID) CASCADE';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error dropping function: %', SQLERRM;
  END;
  
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, JSONB) CASCADE';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error dropping function: %', SQLERRM;
  END;
  
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS process_tradovate_csv_batch_alt(UUID, JSONB) CASCADE';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error dropping function: %', SQLERRM;
  END;
END $$;

-- Now create the ACTUAL implementation with the parameter order the client is expecting
-- Avoiding OR REPLACE to ensure we're truly creating a new function
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
BEGIN
  -- Validate the account ID
  IF v_account_id IS NULL THEN
    -- Try to find a default account for the user
    SELECT id INTO v_account_id 
    FROM trading_accounts 
    WHERE user_id = p_user_id 
    ORDER BY is_default DESC, created_at ASC 
    LIMIT 1;
    
    IF v_account_id IS NULL THEN
      -- No account found, create a default account
      INSERT INTO trading_accounts (user_id, name, is_default) 
      VALUES (p_user_id, 'Default Account', TRUE)
      RETURNING id INTO v_account_id;
    END IF;
  END IF;

  -- Process each row
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_data) LOOP
    BEGIN
      -- Process the row
      v_result := process_tradovate_csv_row(
        p_user_id,
        (v_row->>'symbol')::TEXT,
        (v_row->>'entry_date')::TIMESTAMP,
        (v_row->>'exit_date')::TIMESTAMP,
        (v_row->>'pnl')::NUMERIC::TEXT,
        (v_row->>'_priceFormat')::TEXT,
        (v_row->>'_tickSize')::NUMERIC::TEXT,
        (v_row->>'buyFillId')::TEXT,
        (v_row->>'sellFillId')::TEXT,
        (v_row->>'entry_price')::NUMERIC::TEXT,
        (v_row->>'exit_price')::NUMERIC::TEXT,
        (v_row->>'boughtTimestamp')::TIMESTAMP,
        (v_row->>'soldTimestamp')::TIMESTAMP,
        (v_row->>'duration')::INTERVAL,
        v_account_id,
        NOW(),
        NOW()
      );
      
      -- Add result to array
      v_results := array_append(v_results, v_result);
      
      -- Count successes and failures
      IF (v_result->>'success')::BOOLEAN THEN
        v_successful_rows := v_successful_rows + 1;
      ELSE
        v_failed_rows := v_failed_rows + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_error := SQLERRM;
      v_results := array_append(v_results, jsonb_build_object(
        'success', FALSE,
        'error', v_error,
        'trade_id', NULL
      ));
      v_failed_rows := v_failed_rows + 1;
    END;
  END LOOP;
  
  -- Check if analytics record exists for this user
  SELECT EXISTS(
    SELECT 1 FROM analytics WHERE user_id = p_user_id
  ) INTO v_analytics_record_exists;
  
  -- If no analytics record exists, try to create one
  IF NOT v_analytics_record_exists THEN
    BEGIN
      PERFORM calculate_user_analytics(p_user_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error calculating user analytics: %', SQLERRM;
    END;
  ELSE
    -- Update analytics for this user
    BEGIN
      PERFORM update_analytics_for_user(p_user_id);
      PERFORM calculate_period_pnl(p_user_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error updating analytics: %', SQLERRM;
    END;
  END IF;
  
  -- Return the results
  RETURN jsonb_build_object(
    'success', TRUE,
    'processed', v_successful_rows,
    'failed', v_failed_rows,
    'results', to_jsonb(v_results)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', FALSE,
    'error', SQLERRM,
    'processed', v_successful_rows,
    'failed', v_failed_rows
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also create a 2-parameter version for backwards compatibility
CREATE FUNCTION process_tradovate_csv_batch(
  p_account_id UUID,
  p_data JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Extract user_id from the session
  SELECT auth.uid() INTO v_user_id;
  
  -- Call the 3-parameter version
  RETURN process_tradovate_csv_batch(p_account_id, p_data, v_user_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', FALSE,
    'error', SQLERRM,
    'processed', 0,
    'failed', jsonb_array_length(p_data)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users for both functions
GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(UUID, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(UUID, JSONB) TO authenticated; 