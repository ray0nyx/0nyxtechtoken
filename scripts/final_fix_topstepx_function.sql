-- Final fix for the TopstepX function - resolves the column name error
-- Updated to use 'symbol' instead of 'contract_name'

-- Drop all existing related functions
DO $$
BEGIN
  BEGIN
    DROP FUNCTION IF EXISTS process_topstepx_csv_batch(uuid, jsonb, uuid);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_topstepx_csv_batch(uuid, jsonb, uuid): %', SQLERRM;
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS process_topstepx_csv_batch(jsonb);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_topstepx_csv_batch(jsonb): %', SQLERRM;
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS process_topstepx_batch(jsonb);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_topstepx_batch(jsonb): %', SQLERRM;
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS upload_topstepx_trades(jsonb);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop upload_topstepx_trades(jsonb): %', SQLERRM;
  END;
END $$;

-- Create a new fixed function with correct column names
CREATE OR REPLACE FUNCTION process_topstepx_csv_batch(
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
  v_symbol TEXT;             -- Changed from v_contract_name
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
    
    -- Extract account_id (optional) or find/create one
    IF p_data ? 'account_id' AND (p_data->>'account_id') IS NOT NULL AND (p_data->>'account_id') != '' THEN
      BEGIN
        v_account_id := (p_data->>'account_id')::UUID;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Invalid account_id format: %', p_data->>'account_id';
      END;
    ELSE
      -- Find or create an account for this user
      SELECT id INTO v_account_id 
      FROM accounts 
      WHERE user_id = v_user_id
      LIMIT 1;
      
      -- If no account exists, create one
      IF v_account_id IS NULL THEN
        INSERT INTO accounts (
          user_id, 
          name, 
          platform, 
          balance, 
          created_at, 
          updated_at
        ) VALUES (
          v_user_id, 
          'TopstepX Account', 
          'topstepx', 
          0, 
          NOW(), 
          NOW()
        ) RETURNING id INTO v_account_id;
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
        v_symbol := NULL;          -- Changed from v_contract_name
        v_entry_price := NULL;
        v_exit_price := NULL;
        v_size := NULL;
        v_pnl := NULL;
        v_fees := NULL;
        v_entered_at := NULL;
        v_exited_at := NULL;
        
        -- 1. Symbol (required) - Check for contract_name OR symbol in the input
        IF (v_row ? 'contract_name' AND (v_row->>'contract_name') IS NOT NULL AND (v_row->>'contract_name') != '') THEN
          v_symbol := v_row->>'contract_name';   -- Map contract_name to symbol
        ELSIF (v_row ? 'symbol' AND (v_row->>'symbol') IS NOT NULL AND (v_row->>'symbol') != '') THEN
          v_symbol := v_row->>'symbol';
        ELSE
          RAISE EXCEPTION 'Missing required field: contract_name or symbol';
        END IF;
        
        -- 2. Entry price (required)
        IF v_row ? 'entry_price' AND (v_row->>'entry_price') IS NOT NULL AND (v_row->>'entry_price') != '' THEN
          BEGIN
            IF (v_row->>'entry_price') ~ '^-?\d+(\.\d+)?$' THEN
              v_entry_price := (v_row->>'entry_price')::NUMERIC;
            ELSE
              -- Try removing currency symbols and commas
              v_entry_price := REPLACE(REPLACE(v_row->>'entry_price', '$', ''), ',', '')::NUMERIC;
            END IF;
          EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Invalid entry_price format: %', v_row->>'entry_price';
          END;
        ELSE
          RAISE EXCEPTION 'Missing required field: entry_price';
        END IF;
        
        -- 3. Exit price (required)
        IF v_row ? 'exit_price' AND (v_row->>'exit_price') IS NOT NULL AND (v_row->>'exit_price') != '' THEN
          BEGIN
            IF (v_row->>'exit_price') ~ '^-?\d+(\.\d+)?$' THEN
              v_exit_price := (v_row->>'exit_price')::NUMERIC;
            ELSE
              -- Try removing currency symbols and commas
              v_exit_price := REPLACE(REPLACE(v_row->>'exit_price', '$', ''), ',', '')::NUMERIC;
            END IF;
          EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Invalid exit_price format: %', v_row->>'exit_price';
          END;
        ELSE
          RAISE EXCEPTION 'Missing required field: exit_price';
        END IF;
        
        -- 4. Size (optional)
        IF v_row ? 'size' AND (v_row->>'size') IS NOT NULL AND (v_row->>'size') != '' THEN
          BEGIN
            v_size := (v_row->>'size')::NUMERIC;
          EXCEPTION WHEN OTHERS THEN
            BEGIN
              v_size := REPLACE(v_row->>'size', ',', '')::NUMERIC;
            EXCEPTION WHEN OTHERS THEN
              v_size := 1;
            END;
          END;
        ELSE
          v_size := 1;
        END IF;
        
        -- 5. PnL (optional)
        IF v_row ? 'pnl' AND (v_row->>'pnl') IS NOT NULL AND (v_row->>'pnl') != '' THEN
          BEGIN
            v_pnl := (v_row->>'pnl')::NUMERIC;
          EXCEPTION WHEN OTHERS THEN
            BEGIN
              v_pnl := REPLACE(REPLACE(v_row->>'pnl', '$', ''), ',', '')::NUMERIC;
            EXCEPTION WHEN OTHERS THEN
              -- Calculate from prices
              v_pnl := (v_exit_price - v_entry_price) * v_size;
            END;
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
            BEGIN
              v_fees := REPLACE(REPLACE(v_row->>'fees', '$', ''), ',', '')::NUMERIC;
            EXCEPTION WHEN OTHERS THEN
              v_fees := 0;
            END;
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
        
        -- Insert the trade with correct column names
        INSERT INTO trades (
          account_id,
          user_id,
          symbol,              -- Changed from contract_name
          entry_price,
          exit_price,
          size,                -- Optional: Quantity is also available
          quantity,            -- Adding this for compatibility 
          pnl,
          fees,
          entry_date,          -- Used instead of entered_at
          exit_date,           -- Used instead of exited_at
          broker,
          source,
          date,                -- Adding trade date
          position,            -- Adding position (side)
          created_at,
          updated_at
        ) VALUES (
          v_account_id,
          v_user_id,
          v_symbol,
          v_entry_price,
          v_exit_price,
          v_size,
          v_size,              -- Set quantity to the same as size
          v_pnl,
          v_fees,
          v_entered_at,
          v_exited_at,
          'TopstepX',
          'topstepx',
          v_entered_at::DATE,  -- Set date to the entry date
          'long',              -- Default to long position
          NOW(),
          NOW()
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
  
  -- Try to update analytics manually without using ON CONFLICT
  IF v_success_count > 0 THEN
    BEGIN
      -- Update analytics manually (basic version)
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
            EXECUTE format('SELECT calculate_%s($1)', v_metric) USING v_user_id INTO v_value;

            -- Check if metric exists
            SELECT id INTO v_metric_id 
            FROM analytics 
            WHERE user_id = v_user_id AND metric_name = v_metric
            LIMIT 1;

            IF v_metric_id IS NOT NULL THEN
              -- Update existing metric
              UPDATE analytics 
              SET value = v_value, updated_at = NOW()
              WHERE id = v_metric_id;
            ELSE
              -- Insert new metric
              INSERT INTO analytics (user_id, metric_name, value)
              VALUES (v_user_id, v_metric, v_value);
            END IF;
          EXCEPTION WHEN OTHERS THEN
            -- Just log and continue
            RAISE NOTICE 'Error updating metric %: %', v_metric, SQLERRM;
          END;
        END LOOP;
      END;
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

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION process_topstepx_csv_batch(JSONB) TO authenticated; 