-- Migration to fix function overloading conflicts
-- We need to make sure we have only one version of each function with clear parameter types

-- First, clean up all versions of the process_tradovate_csv_batch function
DO $$
BEGIN
  -- Drop all versions of process_tradovate_csv_batch to resolve conflicts
  DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, JSONB);
  DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, JSONB, UUID);
  DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, TEXT);
  DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, TEXT, UUID);
  DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, UUID, JSONB);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error dropping function versions: %', SQLERRM;
END $$;

-- Recreate the process_tradovate_csv_batch function with clear parameter types
CREATE OR REPLACE FUNCTION process_tradovate_csv_batch(
  p_user_id UUID,
  p_rows JSONB,
  p_account_id UUID DEFAULT NULL
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
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
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

-- Now let's also fix the TopstepX function to ensure it doesn't have conflicts
DROP FUNCTION IF EXISTS process_topstepx_csv_batch(JSONB);

-- Recreate process_topstepx_csv_batch with clear parameter naming
CREATE OR REPLACE FUNCTION process_topstepx_csv_batch(
  p_trades JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_trade JSONB;
  v_trade_id UUID;
  v_success_count INTEGER := 0;
  v_error_count INTEGER := 0;
  v_results JSONB := '[]'::JSONB;
  v_user_id UUID;
  v_account_id UUID;
BEGIN
  -- Extract user ID from the first trade (all trades should have the same user ID)
  IF jsonb_array_length(p_trades) > 0 THEN
    v_user_id := (p_trades->0->>'user_id')::UUID;
    v_account_id := (p_trades->0->>'account_id')::UUID;
  ELSE
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'No trades provided',
      'processed', 0
    );
  END IF;

  -- Process each trade in the batch
  FOR v_trade IN SELECT * FROM jsonb_array_elements(p_trades) LOOP
    BEGIN
      -- Process the trade
      v_trade_id := process_topstepx_trade(
        v_user_id,
        v_trade->>'contract_name',
        (v_trade->>'entered_at')::TIMESTAMP,
        (v_trade->>'exited_at')::TIMESTAMP,
        (v_trade->>'entry_price')::NUMERIC,
        (v_trade->>'exit_price')::NUMERIC,
        (v_trade->>'fees')::NUMERIC,
        (v_trade->>'pnl')::NUMERIC,
        (v_trade->>'size')::INTEGER,
        v_trade->>'type',
        (v_trade->>'trade_day')::TIMESTAMP,
        (v_trade->>'trade_duration')::INTEGER,
        v_account_id
      );
      
      -- Add result to results array
      IF v_trade_id IS NOT NULL THEN
        v_success_count := v_success_count + 1;
        v_results := v_results || jsonb_build_object(
          'trade_id', v_trade_id,
          'success', TRUE
        );
      ELSE
        v_error_count := v_error_count + 1;
        v_results := v_results || jsonb_build_object(
          'success', FALSE,
          'error', 'Failed to process trade'
        );
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        -- Add error to results array
        v_error_count := v_error_count + 1;
        v_results := v_results || jsonb_build_object(
          'success', FALSE,
          'error', SQLERRM
        );
    END;
  END LOOP;
  
  -- Try to recalculate PnL periods after all trades are processed
  BEGIN
    PERFORM calculate_period_pnl(v_user_id);
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Error calculating period PnL: %', SQLERRM;
  END;
  
  -- Return summary of results
  RETURN jsonb_build_object(
    'success', TRUE,
    'processed', v_success_count,
    'errors', v_error_count,
    'results', v_results
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', SQLERRM,
      'processed', v_success_count
    );
END;
$$ LANGUAGE plpgsql;

-- Grant execution privileges to authenticated users
GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(UUID, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION process_topstepx_csv_batch(JSONB) TO authenticated; 