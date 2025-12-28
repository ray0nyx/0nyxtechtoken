-- Improved TopstepX Error Handling and Reporting
-- This script provides more detailed error reporting and robust function execution

-- Function to log errors for debugging purposes
CREATE OR REPLACE FUNCTION log_error(
  p_user_id UUID,
  p_error TEXT,
  p_context JSONB
) RETURNS VOID AS $$
BEGIN
  INSERT INTO error_logs (
    user_id,
    error_message,
    context_data,
    created_at
  ) VALUES (
    p_user_id,
    p_error,
    p_context,
    NOW()
  );
EXCEPTION WHEN OTHERS THEN
  -- If we can't log to the error_logs table, at least try to log to the postgres log
  RAISE WARNING 'Failed to log error: %, Context: %, Original Error: %', 
                SQLERRM, p_context, p_error;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create error_logs table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'error_logs') THEN
    CREATE TABLE error_logs (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID,
      error_message TEXT,
      context_data JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Index for faster queries
    CREATE INDEX error_logs_user_id_idx ON error_logs(user_id);
    CREATE INDEX error_logs_created_at_idx ON error_logs(created_at);
    
    -- Add RLS policy
    ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Admins can view all logs" ON error_logs
      FOR SELECT USING (auth.uid() IN (SELECT user_id FROM admins));
    CREATE POLICY "Users can view their own logs" ON error_logs
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END;
$$;

-- Improved TopstepX CSV batch processing function with better error handling
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
  v_function_error TEXT;
  v_context JSONB;
  v_result JSONB;
  v_detailed_errors JSONB := '[]'::JSONB;
  v_row_log TEXT;
BEGIN
  -- Parameter validation with detailed error handling
  BEGIN
    -- Log the incoming parameters for debugging
    RAISE NOTICE 'Processing TopstepX batch with parameters: %', p_data;
    
    -- 1. Extract and validate user_id
    IF NOT (p_data ? 'user_id') OR (p_data->>'user_id') IS NULL THEN
      RAISE EXCEPTION 'Missing required parameter: user_id';
    END IF;
    
    BEGIN
      v_user_id := (p_data->>'user_id')::UUID;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid user_id format: %', p_data->>'user_id';
    END;
    
    -- 2. Extract and validate rows data
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
    
    -- 3. Extract account_id (optional)
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
      
      IF v_account_id IS NULL THEN
        INSERT INTO accounts (user_id, name)
        VALUES (v_user_id, 'Default Account')
        RETURNING id INTO v_account_id;
      END IF;
    END IF;
    
    -- 4. Validate rows are not empty
    v_total_rows := jsonb_array_length(v_rows);
    
    IF v_total_rows = 0 THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'message', 'No rows to process',
        'total_rows', 0
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Log parameter validation errors
    v_function_error := SQLERRM;
    v_context := jsonb_build_object(
      'function', 'process_topstepx_csv_batch',
      'stage', 'parameter_validation',
      'input', p_data
    );
    
    PERFORM log_error(
      CASE WHEN v_user_id IS NOT NULL THEN v_user_id ELSE NULL END,
      v_function_error,
      v_context
    );
    
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'Error validating input parameters: ' || v_function_error,
      'error_details', v_function_error,
      'error_context', v_context
    );
  END;
  
  -- Process each row with detailed error tracking
  FOR v_row_index IN 0..(v_total_rows - 1) LOOP
    BEGIN
      v_row := v_rows->v_row_index;
      
      -- Convert scalar values to JSON for logging context
      v_row_log := format('Row %s of %s', v_row_index + 1, v_total_rows);
      RAISE NOTICE '%: Processing row: %', v_row_log, v_row;
      
      -- Process the individual trade
      BEGIN
        -- Insert the trade with all required field handling
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
          -- Required fields with validation
          CASE 
            WHEN v_row ? 'contract_name' AND (v_row->>'contract_name') IS NOT NULL AND (v_row->>'contract_name') != '' 
            THEN v_row->>'contract_name'
            ELSE RAISE EXCEPTION 'Missing required field: contract_name'
          END,
          
          -- Entry price with formatting support
          CASE
            WHEN v_row ? 'entry_price' AND (v_row->>'entry_price') IS NOT NULL AND (v_row->>'entry_price') != '' THEN
              CASE
                WHEN (v_row->>'entry_price') ~ '^-?\d+(\.\d+)?$' 
                THEN (v_row->>'entry_price')::NUMERIC
                ELSE REPLACE(REPLACE(v_row->>'entry_price', '$', ''), ',', '')::NUMERIC
              END
            ELSE RAISE EXCEPTION 'Missing required field: entry_price'
          END,
          
          -- Exit price with formatting support
          CASE
            WHEN v_row ? 'exit_price' AND (v_row->>'exit_price') IS NOT NULL AND (v_row->>'exit_price') != '' THEN
              CASE
                WHEN (v_row->>'exit_price') ~ '^-?\d+(\.\d+)?$' 
                THEN (v_row->>'exit_price')::NUMERIC
                ELSE REPLACE(REPLACE(v_row->>'exit_price', '$', ''), ',', '')::NUMERIC
              END
            ELSE RAISE EXCEPTION 'Missing required field: exit_price'
          END,
          
          -- Size (optional with default)
          COALESCE(
            CASE
              WHEN v_row ? 'size' AND (v_row->>'size') IS NOT NULL AND (v_row->>'size') != '' THEN
                CASE
                  WHEN (v_row->>'size') ~ '^-?\d+(\.\d+)?$' 
                  THEN (v_row->>'size')::NUMERIC
                  ELSE REPLACE(v_row->>'size', ',', '')::NUMERIC
                END
              ELSE 1::NUMERIC
            END,
            1::NUMERIC
          ),
          
          -- PnL (optional with calculation)
          CASE
            WHEN v_row ? 'pnl' AND (v_row->>'pnl') IS NOT NULL AND (v_row->>'pnl') != '' THEN
              CASE
                WHEN (v_row->>'pnl') ~ '^-?\d+(\.\d+)?$' 
                THEN (v_row->>'pnl')::NUMERIC
                ELSE REPLACE(REPLACE(v_row->>'pnl', '$', ''), ',', '')::NUMERIC
              END
            ELSE
              -- Calculate from entry/exit price if missing
              CASE
                WHEN v_row ? 'entry_price' AND v_row ? 'exit_price' THEN
                  (
                    CASE
                      WHEN (v_row->>'exit_price') ~ '^-?\d+(\.\d+)?$' 
                      THEN (v_row->>'exit_price')::NUMERIC
                      ELSE REPLACE(REPLACE(v_row->>'exit_price', '$', ''), ',', '')::NUMERIC
                    END
                    - 
                    CASE
                      WHEN (v_row->>'entry_price') ~ '^-?\d+(\.\d+)?$' 
                      THEN (v_row->>'entry_price')::NUMERIC
                      ELSE REPLACE(REPLACE(v_row->>'entry_price', '$', ''), ',', '')::NUMERIC
                    END
                  ) * 
                  COALESCE(
                    CASE
                      WHEN v_row ? 'size' AND (v_row->>'size') IS NOT NULL AND (v_row->>'size') != '' THEN
                        CASE
                          WHEN (v_row->>'size') ~ '^-?\d+(\.\d+)?$' 
                          THEN (v_row->>'size')::NUMERIC
                          ELSE REPLACE(v_row->>'size', ',', '')::NUMERIC
                        END
                      ELSE 1::NUMERIC
                    END,
                    1::NUMERIC
                  )
                ELSE 0::NUMERIC
              END
          END,
          
          -- Fees (optional with default)
          COALESCE(
            CASE
              WHEN v_row ? 'fees' AND (v_row->>'fees') IS NOT NULL AND (v_row->>'fees') != '' THEN
                CASE
                  WHEN (v_row->>'fees') ~ '^-?\d+(\.\d+)?$' 
                  THEN (v_row->>'fees')::NUMERIC
                  ELSE REPLACE(REPLACE(v_row->>'fees', '$', ''), ',', '')::NUMERIC
                END
              ELSE 0::NUMERIC
            END,
            0::NUMERIC
          ),
          
          -- Entered at date with format handling
          CASE
            WHEN v_row ? 'entered_at' AND (v_row->>'entered_at') IS NOT NULL AND (v_row->>'entered_at') != '' THEN
              CASE
                WHEN (v_row->>'entered_at') ~ '^\d{4}-\d{2}-\d{2}' THEN
                  (v_row->>'entered_at')::TIMESTAMP
                WHEN (v_row->>'entered_at') ~ '^\d{1,2}/\d{1,2}/\d{4}' THEN
                  -- Try MM/DD/YYYY format
                  CASE
                    WHEN LENGTH(v_row->>'entered_at') > 10 THEN 
                      TO_TIMESTAMP(v_row->>'entered_at', 'MM/DD/YYYY HH24:MI:SS')
                    ELSE
                      TO_TIMESTAMP(v_row->>'entered_at', 'MM/DD/YYYY')
                  END
                ELSE RAISE EXCEPTION 'Invalid entered_at date format: %', v_row->>'entered_at'
              END
            ELSE RAISE EXCEPTION 'Missing required field: entered_at'
          END,
          
          -- Exited at date with format handling
          CASE
            WHEN v_row ? 'exited_at' AND (v_row->>'exited_at') IS NOT NULL AND (v_row->>'exited_at') != '' THEN
              CASE
                WHEN (v_row->>'exited_at') ~ '^\d{4}-\d{2}-\d{2}' THEN
                  (v_row->>'exited_at')::TIMESTAMP
                WHEN (v_row->>'exited_at') ~ '^\d{1,2}/\d{1,2}/\d{4}' THEN
                  -- Try MM/DD/YYYY format
                  CASE
                    WHEN LENGTH(v_row->>'exited_at') > 10 THEN 
                      TO_TIMESTAMP(v_row->>'exited_at', 'MM/DD/YYYY HH24:MI:SS')
                    ELSE
                      TO_TIMESTAMP(v_row->>'exited_at', 'MM/DD/YYYY')
                  END
                ELSE RAISE EXCEPTION 'Invalid exited_at date format: %', v_row->>'exited_at'
              END
            ELSE RAISE EXCEPTION 'Missing required field: exited_at'
          END,
          
          -- Source field
          'topstepx'
        );
        
        v_success_count := v_success_count + 1;
        RAISE NOTICE '%: Row processed successfully', v_row_log;
        
      EXCEPTION WHEN OTHERS THEN
        -- Log the specific field processing error
        v_function_error := SQLERRM;
        RAISE NOTICE '%: Error processing row: %', v_row_log, v_function_error;
        
        -- Build detailed error information for this row
        v_detailed_errors := v_detailed_errors || jsonb_build_object(
          'row', v_row_index,
          'error', v_function_error,
          'row_data', v_row
        );
        
        -- Add to error count
        v_error_count := v_error_count + 1;
      END;
    
    EXCEPTION WHEN OTHERS THEN
      -- Handle unexpected errors in the row processing loop
      v_function_error := SQLERRM;
      RAISE NOTICE 'Unexpected error in row %: %', v_row_index + 1, v_function_error;
      
      -- Add error info to array
      v_detailed_errors := v_detailed_errors || jsonb_build_object(
        'row', v_row_index,
        'error', 'Unexpected error: ' || v_function_error,
        'row_data', v_row
      );
      
      v_error_count := v_error_count + 1;
    END;
  END LOOP;
  
  -- Build the final result
  IF v_success_count > 0 AND v_error_count = 0 THEN
    -- Complete success
    v_result := jsonb_build_object(
      'success', TRUE,
      'message', format('Successfully processed all %s rows', v_total_rows),
      'total_rows', v_total_rows,
      'success_count', v_success_count
    );
  ELSIF v_success_count > 0 AND v_error_count > 0 THEN
    -- Partial success
    v_result := jsonb_build_object(
      'success', TRUE,
      'message', format('Processed %s rows with %s errors', v_total_rows, v_error_count),
      'total_rows', v_total_rows,
      'success_count', v_success_count,
      'error_count', v_error_count,
      'errors', v_detailed_errors
    );
    
    -- Log partial success to help debug
    v_context := jsonb_build_object(
      'function', 'process_topstepx_csv_batch',
      'stage', 'partial_success',
      'total_rows', v_total_rows,
      'success_count', v_success_count,
      'error_count', v_error_count,
      'errors', v_detailed_errors
    );
    
    PERFORM log_error(v_user_id, 'Partial success with errors', v_context);
  ELSE
    -- Complete failure
    v_result := jsonb_build_object(
      'success', FALSE,
      'message', format('Failed to process any rows. %s errors encountered.', v_error_count),
      'total_rows', v_total_rows,
      'success_count', 0,
      'error_count', v_error_count,
      'errors', v_detailed_errors
    );
    
    -- Log complete failure
    v_context := jsonb_build_object(
      'function', 'process_topstepx_csv_batch',
      'stage', 'complete_failure',
      'total_rows', v_total_rows,
      'errors', v_detailed_errors
    );
    
    PERFORM log_error(v_user_id, 'Failed to process any rows', v_context);
  END IF;
  
  -- Try to refresh analytics if any trades were processed successfully
  IF v_success_count > 0 THEN
    BEGIN
      PERFORM refresh_user_analytics(v_user_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to refresh analytics: %', SQLERRM;
      
      -- Add analytics refresh error to result but don't change success status
      v_result := jsonb_set(v_result, '{analytics_refresh_error}', to_jsonb(SQLERRM));
    END;
  END IF;
  
  RETURN v_result;
  
EXCEPTION WHEN OTHERS THEN
  -- Catch-all error handler for unexpected function errors
  v_function_error := SQLERRM;
  v_context := jsonb_build_object(
    'function', 'process_topstepx_csv_batch',
    'stage', 'unexpected_error',
    'input', p_data
  );
  
  -- Log the error
  PERFORM log_error(
    CASE WHEN v_user_id IS NOT NULL THEN v_user_id ELSE NULL END,
    v_function_error,
    v_context
  );
  
  -- Return error details
  RETURN jsonb_build_object(
    'success', FALSE,
    'message', 'Unexpected error while processing TopstepX batch: ' || v_function_error,
    'error_details', v_function_error,
    'error_context', v_context
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Alternative version with legacy parameter structure support
CREATE OR REPLACE FUNCTION process_topstepx_csv_batch(
  p_user_id UUID, 
  p_rows JSONB,
  p_account_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
BEGIN
  -- Convert to the new parameter format
  RETURN process_topstepx_csv_batch(jsonb_build_object(
    'user_id', p_user_id,
    'rows', p_rows,
    'account_id', p_account_id
  ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create admin function to view errors
CREATE OR REPLACE FUNCTION view_error_logs(
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0,
  p_user_id UUID DEFAULT NULL
) RETURNS TABLE (
  id UUID,
  user_id UUID,
  error_message TEXT,
  context_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  IF EXISTS (SELECT FROM admins WHERE user_id = auth.uid()) THEN
    RETURN QUERY
      SELECT el.id, el.user_id, el.error_message, el.context_data, el.created_at
      FROM error_logs el
      WHERE (p_user_id IS NULL OR el.user_id = p_user_id)
      ORDER BY el.created_at DESC
      LIMIT p_limit OFFSET p_offset;
  ELSE
    -- For non-admin users, only show their own errors
    RETURN QUERY
      SELECT el.id, el.user_id, el.error_message, el.context_data, el.created_at
      FROM error_logs el
      WHERE el.user_id = auth.uid()
      ORDER BY el.created_at DESC
      LIMIT p_limit OFFSET p_offset;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION process_topstepx_csv_batch(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION process_topstepx_csv_batch(UUID, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION view_error_logs(INTEGER, INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION log_error(UUID, TEXT, JSONB) TO authenticated; 