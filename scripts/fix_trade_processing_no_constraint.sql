-- Fix for the "there is no unique or exclusion constraint matching the ON CONFLICT specification" error
-- This script modifies the trade processing function to avoid using ON CONFLICT

-- Create a simple trades processing function that doesn't rely on ON CONFLICT
CREATE OR REPLACE FUNCTION process_topstepx_csv_batch_simple(
  p_data JSONB
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_rows JSONB;
  v_account_id UUID;
  v_row JSONB;
  v_row_index INTEGER;
  v_total_rows INTEGER;
  v_success_count INTEGER := 0;
  v_error_count INTEGER := 0;
  v_errors JSONB := '[]'::JSONB;
  v_result JSONB;
  v_detailed_errors JSONB := '[]'::JSONB;
  
  -- Variables for trade data
  v_contract_name TEXT;
  v_entry_price NUMERIC;
  v_exit_price NUMERIC;
  v_size NUMERIC;
  v_pnl NUMERIC;
  v_fees NUMERIC;
  v_entered_at TIMESTAMP;
  v_exited_at TIMESTAMP;
  v_trade_id UUID;
BEGIN
  -- Extract parameters with validation
  BEGIN
    -- Extract user_id
    IF NOT (p_data ? 'user_id') OR (p_data->>'user_id') IS NULL THEN
      RAISE EXCEPTION 'Missing required parameter: user_id';
    END IF;
    
    BEGIN
      v_user_id := (p_data->>'user_id')::UUID;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid user_id format: %', p_data->>'user_id';
    END;
    
    -- Extract rows data
    IF NOT (p_data ? 'rows') THEN
      RAISE EXCEPTION 'Missing required parameter: rows';
    END IF;
    
    v_rows := p_data->'rows';
    
    -- Handle json parsing if input is string
    IF jsonb_typeof(v_rows) = 'string' THEN
      BEGIN
        v_rows := v_rows::JSONB;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Invalid JSON in rows parameter: %', SQLERRM;
      END;
    END IF;
    
    -- Validate rows is an array
    IF jsonb_typeof(v_rows) != 'array' THEN
      RAISE EXCEPTION 'Parameter "rows" must be a JSON array, got: %', jsonb_typeof(v_rows);
    END IF;
    
    -- Extract account_id (optional)
    IF p_data ? 'account_id' AND (p_data->>'account_id') IS NOT NULL AND (p_data->>'account_id') != '' THEN
      BEGIN
        v_account_id := (p_data->>'account_id')::UUID;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Invalid account_id format: %', p_data->>'account_id';
      END;
    ELSE
      -- Find or create an account for this user without using ON CONFLICT
      SELECT id INTO v_account_id 
      FROM accounts 
      WHERE user_id = v_user_id
      LIMIT 1;
      
      IF v_account_id IS NULL THEN
        INSERT INTO accounts (user_id, name)
        VALUES (v_user_id, 'Default Account')
        RETURNING id INTO v_account_id;
      END IF;
    END IF;
    
    -- Validate rows are not empty
    v_total_rows := jsonb_array_length(v_rows);
    
    IF v_total_rows = 0 THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'message', 'No rows to process',
        'total_rows', 0
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'Error validating input parameters: ' || SQLERRM,
      'error_details', SQLERRM
    );
  END;

  -- Process each row with detailed error tracking
  FOR v_row_index IN 0..(v_total_rows - 1) LOOP
    BEGIN
      v_row := v_rows->v_row_index;
      
      -- Extract and validate trade data
      BEGIN
        -- Reset variables for this row
        v_contract_name := NULL;
        v_entry_price := NULL;
        v_exit_price := NULL;
        v_size := NULL;
        v_pnl := NULL;
        v_fees := NULL;
        v_entered_at := NULL;
        v_exited_at := NULL;
        
        -- 1. Contract name (required)
        IF v_row ? 'contract_name' AND (v_row->>'contract_name') IS NOT NULL AND (v_row->>'contract_name') != '' THEN
          v_contract_name := v_row->>'contract_name';
        ELSE
          RAISE EXCEPTION 'Missing required field: contract_name';
        END IF;
        
        -- 2. Entry price (required)
        IF v_row ? 'entry_price' AND (v_row->>'entry_price') IS NOT NULL AND (v_row->>'entry_price') != '' THEN
          IF (v_row->>'entry_price') ~ '^-?\d+(\.\d+)?$' THEN
            v_entry_price := (v_row->>'entry_price')::NUMERIC;
          ELSE
            -- Try removing currency symbols and commas
            v_entry_price := REPLACE(REPLACE(v_row->>'entry_price', '$', ''), ',', '')::NUMERIC;
          END IF;
        ELSE
          RAISE EXCEPTION 'Missing required field: entry_price';
        END IF;
        
        -- 3. Exit price (required)
        IF v_row ? 'exit_price' AND (v_row->>'exit_price') IS NOT NULL AND (v_row->>'exit_price') != '' THEN
          IF (v_row->>'exit_price') ~ '^-?\d+(\.\d+)?$' THEN
            v_exit_price := (v_row->>'exit_price')::NUMERIC;
          ELSE
            -- Try removing currency symbols and commas
            v_exit_price := REPLACE(REPLACE(v_row->>'exit_price', '$', ''), ',', '')::NUMERIC;
          END IF;
        ELSE
          RAISE EXCEPTION 'Missing required field: exit_price';
        END IF;
        
        -- 4. Size (optional)
        IF v_row ? 'size' AND (v_row->>'size') IS NOT NULL AND (v_row->>'size') != '' THEN
          BEGIN
            v_size := (v_row->>'size')::NUMERIC;
          EXCEPTION WHEN OTHERS THEN
            v_size := REPLACE(v_row->>'size', ',', '')::NUMERIC;
          END;
        ELSE
          v_size := 1;
        END IF;
        
        -- 5. PnL (optional)
        IF v_row ? 'pnl' AND (v_row->>'pnl') IS NOT NULL AND (v_row->>'pnl') != '' THEN
          BEGIN
            v_pnl := (v_row->>'pnl')::NUMERIC;
          EXCEPTION WHEN OTHERS THEN
            v_pnl := REPLACE(REPLACE(v_row->>'pnl', '$', ''), ',', '')::NUMERIC;
          END;
        ELSE
          -- Calculate from prices
          v_pnl := (v_exit_price - v_entry_price) * v_size;
        END IF;
        
        -- 6. Fees (optional)
        IF v_row ? 'fees' AND (v_row->>'fees') IS NOT NULL AND (v_row->>'fees') != '' THEN
          BEGIN
            v_fees := (v_row->>'fees')::NUMERIC;
          EXCEPTION WHEN OTHERS THEN
            v_fees := REPLACE(REPLACE(v_row->>'fees', '$', ''), ',', '')::NUMERIC;
          END;
        ELSE
          v_fees := 0;
        END IF;
        
        -- 7. Entered at (required)
        IF v_row ? 'entered_at' AND (v_row->>'entered_at') IS NOT NULL AND (v_row->>'entered_at') != '' THEN
          BEGIN
            -- Try ISO format first (YYYY-MM-DD)
            IF (v_row->>'entered_at') ~ '^\d{4}-\d{2}-\d{2}' THEN
              v_entered_at := (v_row->>'entered_at')::TIMESTAMP;
            -- Try MM/DD/YYYY format
            ELSIF (v_row->>'entered_at') ~ '^\d{1,2}/\d{1,2}/\d{4}' THEN
              IF LENGTH(v_row->>'entered_at') > 10 THEN
                v_entered_at := TO_TIMESTAMP(v_row->>'entered_at', 'MM/DD/YYYY HH24:MI:SS');
              ELSE
                v_entered_at := TO_TIMESTAMP(v_row->>'entered_at', 'MM/DD/YYYY');
              END IF;
            ELSE
              RAISE EXCEPTION 'Invalid entered_at date format: %', v_row->>'entered_at';
            END IF;
          EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Error parsing entered_at date: %', SQLERRM;
          END;
        ELSE
          RAISE EXCEPTION 'Missing required field: entered_at';
        END IF;
        
        -- 8. Exited at (required)
        IF v_row ? 'exited_at' AND (v_row->>'exited_at') IS NOT NULL AND (v_row->>'exited_at') != '' THEN
          BEGIN
            -- Try ISO format first (YYYY-MM-DD)
            IF (v_row->>'exited_at') ~ '^\d{4}-\d{2}-\d{2}' THEN
              v_exited_at := (v_row->>'exited_at')::TIMESTAMP;
            -- Try MM/DD/YYYY format
            ELSIF (v_row->>'exited_at') ~ '^\d{1,2}/\d{1,2}/\d{4}' THEN
              IF LENGTH(v_row->>'exited_at') > 10 THEN
                v_exited_at := TO_TIMESTAMP(v_row->>'exited_at', 'MM/DD/YYYY HH24:MI:SS');
              ELSE
                v_exited_at := TO_TIMESTAMP(v_row->>'exited_at', 'MM/DD/YYYY');
              END IF;
            ELSE
              RAISE EXCEPTION 'Invalid exited_at date format: %', v_row->>'exited_at';
            END IF;
          EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Error parsing exited_at date: %', SQLERRM;
          END;
        ELSE
          RAISE EXCEPTION 'Missing required field: exited_at';
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
          v_user_id,
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
        -- Add detailed error for this row
        v_detailed_errors := v_detailed_errors || jsonb_build_object(
          'row', v_row_index,
          'error', SQLERRM,
          'data', v_row
        );
        
        v_error_count := v_error_count + 1;
      END;
      
    EXCEPTION WHEN OTHERS THEN
      -- Handle any other errors in the row processing loop
      v_detailed_errors := v_detailed_errors || jsonb_build_object(
        'row', v_row_index,
        'error', 'Unexpected error: ' || SQLERRM,
        'data', v_row
      );
      
      v_error_count := v_error_count + 1;
    END;
  END LOOP;
  
  -- Build the result
  IF v_success_count > 0 AND v_error_count = 0 THEN
    -- Complete success
    v_result := jsonb_build_object(
      'success', TRUE,
      'message', format('Successfully processed all %s rows', v_total_rows),
      'total_rows', v_total_rows,
      'success_count', v_success_count,
      'user_id', v_user_id,
      'account_id', v_account_id
    );
  ELSIF v_success_count > 0 AND v_error_count > 0 THEN
    -- Partial success
    v_result := jsonb_build_object(
      'success', TRUE,
      'message', format('Processed %s rows with %s errors', v_total_rows, v_error_count),
      'total_rows', v_total_rows,
      'success_count', v_success_count,
      'error_count', v_error_count,
      'errors', v_detailed_errors,
      'user_id', v_user_id,
      'account_id', v_account_id
    );
  ELSE
    -- Complete failure
    v_result := jsonb_build_object(
      'success', FALSE,
      'message', format('Failed to process any rows. %s errors encountered.', v_error_count),
      'total_rows', v_total_rows,
      'success_count', 0,
      'error_count', v_error_count,
      'errors', v_detailed_errors,
      'user_id', v_user_id,
      'account_id', v_account_id
    );
  END IF;
  
  -- Try to refresh analytics without using ON CONFLICT
  -- This is a safe version that won't use ON CONFLICT
  IF v_success_count > 0 THEN
    BEGIN
      PERFORM refresh_user_analytics_safe(v_user_id);
    EXCEPTION WHEN OTHERS THEN
      -- Just log the error but don't fail the whole operation
      v_result := jsonb_set(v_result, '{analytics_refresh_error}', to_jsonb(SQLERRM));
    END;
  END IF;
  
  RETURN v_result;
  
EXCEPTION WHEN OTHERS THEN
  -- Catch any other unexpected errors
  RETURN jsonb_build_object(
    'success', FALSE,
    'message', 'Unexpected error: ' || SQLERRM,
    'user_id', v_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a safer version of refresh_user_analytics that doesn't use ON CONFLICT
CREATE OR REPLACE FUNCTION refresh_user_analytics_safe(p_user_id uuid)
RETURNS BOOLEAN AS $$
DECLARE
  v_metric_names TEXT[] := ARRAY[
    'winning_days', 'win_rate', 'total_trades', 'total_pnl', 
    'avg_pnl_per_contract', 'avg_win', 'avg_loss', 'profit_factor', 
    'expectancy', 'sharpe_ratio', 'largest_win', 'largest_loss',
    'win_loss_ratio', 'consecutive_wins', 'consecutive_losses'
  ];
  v_metric TEXT;
  v_value NUMERIC;
  v_metric_id UUID;
BEGIN
  -- For each metric, calculate and update
  FOREACH v_metric IN ARRAY v_metric_names
  LOOP
    BEGIN
      -- Calculate the metric value
      EXECUTE format('SELECT calculate_%s($1)', v_metric) USING p_user_id INTO v_value;
      
      -- Check if metric exists
      SELECT id INTO v_metric_id 
      FROM analytics 
      WHERE user_id = p_user_id AND metric_name = v_metric;
      
      IF v_metric_id IS NOT NULL THEN
        -- Update existing metric
        UPDATE analytics 
        SET value = v_value, updated_at = NOW()
        WHERE id = v_metric_id;
      ELSE
        -- Insert new metric
        INSERT INTO analytics (user_id, metric_name, value)
        VALUES (p_user_id, v_metric, v_value);
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      -- Log but continue with next metric
      RAISE WARNING 'Error processing metric %: %', v_metric, SQLERRM;
    END;
  END LOOP;
  
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error in refresh_user_analytics_safe: %', SQLERRM;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to expose the process_trades function as an API
CREATE OR REPLACE FUNCTION process_topstepx_batch(p_data JSONB)
RETURNS JSONB AS $$
BEGIN
  -- Call our simplified function that doesn't use ON CONFLICT
  RETURN process_topstepx_csv_batch_simple(p_data);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', FALSE,
    'message', 'Error in wrapper function: ' || SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION process_topstepx_csv_batch_simple(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_user_analytics_safe(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION process_topstepx_batch(JSONB) TO authenticated; 