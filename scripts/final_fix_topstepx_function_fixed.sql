-- Final fix for TopstepX function that had column schema issues
DO $$
BEGIN
  RAISE NOTICE 'Starting TopstepX function final fix...';
  
  -- First, check if the function exists with any signatures
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'process_topstepx_csv_batch' 
    AND n.nspname = 'public'
  ) THEN
    RAISE NOTICE 'Found process_topstepx_csv_batch function, checking parameters...';
  ELSE
    RAISE NOTICE 'No process_topstepx_csv_batch function found, will create new one';
  END IF;
  
  -- Drop all existing versions of the function
  BEGIN
    DROP FUNCTION IF EXISTS process_topstepx_csv_batch(JSONB);
    RAISE NOTICE 'Dropped process_topstepx_csv_batch(JSONB)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_topstepx_csv_batch(JSONB): %', SQLERRM;
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS process_topstepx_csv_batch(UUID, JSONB, UUID);
    RAISE NOTICE 'Dropped process_topstepx_csv_batch(UUID, JSONB, UUID)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_topstepx_csv_batch(UUID, JSONB, UUID): %', SQLERRM;
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS process_topstepx_csv_batch(UUID, JSONB);
    RAISE NOTICE 'Dropped process_topstepx_csv_batch(UUID, JSONB)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_topstepx_csv_batch(UUID, JSONB): %', SQLERRM;
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS upload_topstepx_trades(JSONB);
    RAISE NOTICE 'Dropped upload_topstepx_trades(JSONB)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop upload_topstepx_trades(JSONB): %', SQLERRM;
  END;
  
  -- Create a new implementation of the function that matches what the frontend expects
  EXECUTE $func$
  CREATE OR REPLACE FUNCTION process_topstepx_csv_batch(
    p_user_id UUID,
    p_rows JSONB,
    p_account_id UUID DEFAULT NULL
  ) RETURNS JSONB AS $proc$
  DECLARE
    v_trade JSONB;
    v_trade_id UUID;
    v_success_count INTEGER := 0;
    v_error_count INTEGER := 0;
    v_results JSONB := '[]'::JSONB;
    v_account_id UUID := p_account_id;
    v_error TEXT;
    v_symbol TEXT;
    v_side TEXT;
    v_quantity INTEGER;
    v_entry_price NUMERIC;
    v_exit_price NUMERIC;
    v_pnl NUMERIC;
    v_fees NUMERIC;
    v_entry_date TIMESTAMP;
    v_exit_date TIMESTAMP;
    v_date DATE;
    v_total_rows INTEGER;
    v_detailed_errors JSONB := '[]'::JSONB;
  BEGIN
    RAISE NOTICE 'Starting process_topstepx_csv_batch with user_id: %, account_id: %, rows count: %', 
      p_user_id, 
      p_account_id, 
      CASE WHEN jsonb_typeof(p_rows) = 'array' THEN jsonb_array_length(p_rows)::text ELSE 'not an array' END;
    
    -- Validate user_id
    IF p_user_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'User ID is required',
        'processed', 0
      );
    END IF;
    
    -- Validate rows input
    IF p_rows IS NULL OR jsonb_typeof(p_rows) != 'array' THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Rows parameter must be a valid JSON array',
        'processed', 0
      );
    END IF;
    
    -- Get total rows count
    v_total_rows := jsonb_array_length(p_rows);
    
    IF v_total_rows = 0 THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'No rows to process',
        'processed', 0
      );
    END IF;
    
    -- If account_id is not provided, try to find a default one
    IF v_account_id IS NULL THEN
      SELECT id INTO v_account_id
      FROM accounts
      WHERE user_id = p_user_id
      ORDER BY created_at DESC
      LIMIT 1;
      
      RAISE NOTICE 'Using account ID % for user %', v_account_id, p_user_id;
      
      -- If still no account, create one
      IF v_account_id IS NULL THEN
        INSERT INTO accounts (
          user_id,
          name,
          platform,
          balance,
          created_at,
          updated_at
        ) VALUES (
          p_user_id,
          'TopstepX Account',
          'topstepx',
          0,
          NOW(),
          NOW()
        )
        RETURNING id INTO v_account_id;
        
        RAISE NOTICE 'Created new TopstepX account % for user %', v_account_id, p_user_id;
      END IF;
    END IF;
    
    -- Process each trade in the batch
    FOR i IN 0..v_total_rows - 1 LOOP
      v_trade := p_rows->i;
      
      BEGIN
        -- Extract and log each field for debugging
        RAISE NOTICE 'Processing row %: %', i, v_trade;
        
        -- Extract symbol with fallbacks (contract_name is used in TopstepX)
        v_symbol := COALESCE(
          v_trade->>'contract_name',
          v_trade->>'symbol',
          v_trade->>'Symbol',
          v_trade->>'contract',
          v_trade->>'Contract',
          'Unknown'
        );
        
        -- Extract quantity
        BEGIN
          v_quantity := COALESCE(
            (NULLIF(TRIM(v_trade->>'qty'), ''))::INTEGER,
            (NULLIF(TRIM(v_trade->>'quantity'), ''))::INTEGER,
            (NULLIF(TRIM(v_trade->>'size'), ''))::INTEGER,
            1
          );
        EXCEPTION WHEN OTHERS THEN
          v_quantity := 1;
        END;
        
        -- Extract entry price
        BEGIN
          v_entry_price := COALESCE(
            (NULLIF(TRIM(REPLACE(REPLACE(v_trade->>'entry_price', '$', ''), ',', '')), ''))::NUMERIC,
            0
          );
        EXCEPTION WHEN OTHERS THEN
          v_entry_price := 0;
        END;
        
        -- Extract exit price
        BEGIN
          v_exit_price := COALESCE(
            (NULLIF(TRIM(REPLACE(REPLACE(v_trade->>'exit_price', '$', ''), ',', '')), ''))::NUMERIC,
            0
          );
        EXCEPTION WHEN OTHERS THEN
          v_exit_price := 0;
        END;
        
        -- Extract PnL
        BEGIN
          v_pnl := COALESCE(
            (NULLIF(TRIM(REPLACE(REPLACE(v_trade->>'pnl', '$', ''), ',', '')), ''))::NUMERIC,
            (v_exit_price - v_entry_price) * v_quantity
          );
        EXCEPTION WHEN OTHERS THEN
          v_pnl := (v_exit_price - v_entry_price) * v_quantity;
        END;
        
        -- Extract fees
        BEGIN
          v_fees := COALESCE(
            (NULLIF(TRIM(REPLACE(REPLACE(v_trade->>'fees', '$', ''), ',', '')), ''))::NUMERIC,
            0
          );
        EXCEPTION WHEN OTHERS THEN
          v_fees := 0;
        END;
        
        -- Extract dates - try multiple date formats
        BEGIN
          -- Try various formats for entered_at
          v_entry_date := NULL;
          
          -- First try direct timestamp conversion
          BEGIN
            v_entry_date := (NULLIF(TRIM(v_trade->>'entered_at'), ''))::TIMESTAMP;
          EXCEPTION WHEN OTHERS THEN
            -- If that fails, try parsing as different formats
            IF v_trade->>'entered_at' ~ '^\d{4}-\d{2}-\d{2}' THEN
              -- ISO format (YYYY-MM-DD)
              BEGIN
                v_entry_date := (v_trade->>'entered_at')::TIMESTAMP;
              EXCEPTION WHEN OTHERS THEN
                NULL;
              END;
            ELSIF v_trade->>'entered_at' ~ '^\d{1,2}/\d{1,2}/\d{4}' THEN
              -- MM/DD/YYYY format
              BEGIN
                IF LENGTH(v_trade->>'entered_at') > 10 THEN
                  v_entry_date := TO_TIMESTAMP(v_trade->>'entered_at', 'MM/DD/YYYY HH24:MI:SS');
                ELSE
                  v_entry_date := TO_TIMESTAMP(v_trade->>'entered_at', 'MM/DD/YYYY');
                END IF;
              EXCEPTION WHEN OTHERS THEN
                NULL;
              END;
            END IF;
          END;
          
          -- If all parsing failed, use current timestamp
          IF v_entry_date IS NULL THEN
            v_entry_date := CURRENT_TIMESTAMP;
          END IF;
          
          -- Similar logic for exit_date
          v_exit_date := NULL;
          
          -- First try direct timestamp conversion
          BEGIN
            v_exit_date := (NULLIF(TRIM(v_trade->>'exited_at'), ''))::TIMESTAMP;
          EXCEPTION WHEN OTHERS THEN
            -- If that fails, try parsing as different formats
            IF v_trade->>'exited_at' ~ '^\d{4}-\d{2}-\d{2}' THEN
              -- ISO format (YYYY-MM-DD)
              BEGIN
                v_exit_date := (v_trade->>'exited_at')::TIMESTAMP;
              EXCEPTION WHEN OTHERS THEN
                NULL;
              END;
            ELSIF v_trade->>'exited_at' ~ '^\d{1,2}/\d{1,2}/\d{4}' THEN
              -- MM/DD/YYYY format
              BEGIN
                IF LENGTH(v_trade->>'exited_at') > 10 THEN
                  v_exit_date := TO_TIMESTAMP(v_trade->>'exited_at', 'MM/DD/YYYY HH24:MI:SS');
                ELSE
                  v_exit_date := TO_TIMESTAMP(v_trade->>'exited_at', 'MM/DD/YYYY');
                END IF;
              EXCEPTION WHEN OTHERS THEN
                NULL;
              END;
            END IF;
          END;
          
          -- If all parsing failed, use entry_date or current timestamp
          IF v_exit_date IS NULL THEN
            v_exit_date := COALESCE(v_entry_date, CURRENT_TIMESTAMP);
          END IF;
          
          -- Extract or derive the date field
          v_date := COALESCE(
            (NULLIF(TRIM(v_trade->>'date'), ''))::DATE,
            v_entry_date::DATE
          );
        EXCEPTION WHEN OTHERS THEN
          -- If all date parsing fails, use current date
          v_entry_date := CURRENT_TIMESTAMP;
          v_exit_date := CURRENT_TIMESTAMP;
          v_date := CURRENT_DATE;
        END;
        
        -- Extract side/position, default to 'long' for TopstepX
        v_side := LOWER(COALESCE(
          v_trade->>'side',
          v_trade->>'position',
          'long'
        ));
        
        -- Normalize side values
        IF v_side LIKE '%buy%' OR v_side LIKE '%long%' THEN
          v_side := 'long';
        ELSIF v_side LIKE '%sell%' OR v_side LIKE '%short%' THEN
          v_side := 'short';
        ELSE
          v_side := 'long';  -- Default to long if unclear
        END IF;
        
        -- Insert the trade with all necessary fields
        INSERT INTO trades (
          user_id,
          account_id,
          symbol,          -- Use symbol field (mapped from contract_name)
          side,            -- Direction of trade
          position,        -- Same as side for compatibility
          quantity,        -- Number of contracts
          size,            -- Same as quantity
          price,           -- Using entry_price for price
          entry_price,     -- Buy/entry price
          exit_price,      -- Sell/exit price
          pnl,             -- Profit/loss
          fees,            -- Fees/commissions
          entry_date,      -- When trade was entered
          exit_date,       -- When trade was exited
          date,            -- Trade date (date part of entry)
          timestamp,       -- Using entry_date for timestamp
          broker,          -- Set to TopstepX
          created_at,
          updated_at,
          notes            -- Add notes indicating import source
        ) VALUES (
          p_user_id,
          v_account_id,
          v_symbol,
          v_side,
          v_side,
          v_quantity,
          v_quantity,
          v_entry_price,
          v_entry_price,
          v_exit_price,
          v_pnl,
          v_fees,
          v_entry_date,
          v_exit_date,
          v_date,
          v_entry_date,
          'TopstepX',
          NOW(),
          NOW(),
          'Imported from TopstepX CSV'
        )
        RETURNING id INTO v_trade_id;
        
        v_success_count := v_success_count + 1;
        v_results := v_results || jsonb_build_object(
          'success', TRUE,
          'trade_id', v_trade_id,
          'row_index', i,
          'account_id_used', v_account_id
        );
        
      EXCEPTION WHEN OTHERS THEN
        -- Handle any errors
        GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
        
        RAISE NOTICE 'Error in row %: %', i, v_error;
        
        v_error_count := v_error_count + 1;
        v_detailed_errors := v_detailed_errors || jsonb_build_object(
          'row', i,
          'error', v_error,
          'data', v_trade
        );
        
        v_results := v_results || jsonb_build_object(
          'success', FALSE,
          'error', v_error,
          'row_index', i,
          'account_id_used', v_account_id
        );
      END;
    END LOOP;
    
    -- Try to update analytics if any trades were processed successfully
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
              EXECUTE format('SELECT calculate_%s($1)', v_metric) USING p_user_id INTO v_value;

              -- Check if metric exists
              SELECT id INTO v_metric_id 
              FROM analytics 
              WHERE user_id = p_user_id AND metric_name = v_metric
              LIMIT 1;

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
              -- Just log and continue
              RAISE NOTICE 'Error updating metric %: %', v_metric, SQLERRM;
            END;
          END LOOP;
        END;
      EXCEPTION WHEN OTHERS THEN
        -- Just log the error but don't fail the whole operation
        RAISE WARNING 'Error updating analytics: %', SQLERRM;
      END;
    END IF;
    
    -- Return the final result
    RETURN jsonb_build_object(
      'success', v_success_count > 0,
      'message', format('Processed %s rows with %s errors', v_total_rows, v_error_count),
      'total_rows', v_total_rows,
      'success_count', v_success_count,
      'error_count', v_error_count,
      'user_id', p_user_id,
      'account_id', v_account_id,
      'results', v_results,
      'detailed_errors', CASE WHEN v_error_count > 0 THEN v_detailed_errors ELSE NULL END
    );
  EXCEPTION WHEN OTHERS THEN
    -- Catch any unexpected errors
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Unexpected error: ' || SQLERRM,
      'processed', v_success_count,
      'errors', v_error_count + 1,
      'user_id', p_user_id
    );
  END;
  $proc$ LANGUAGE plpgsql SECURITY DEFINER;
  $func$;
  
  -- Create 2-parameter version for backward compatibility
  EXECUTE $func$
  CREATE OR REPLACE FUNCTION process_topstepx_csv_batch(
    p_user_id UUID,
    p_rows JSONB
  ) RETURNS JSONB AS $proc$
  BEGIN
    RETURN process_topstepx_csv_batch(p_user_id, p_rows, NULL);
  END;
  $proc$ LANGUAGE plpgsql SECURITY DEFINER;
  $func$;
  
  -- Create JSONB version for backward compatibility
  EXECUTE $func$
  CREATE OR REPLACE FUNCTION process_topstepx_csv_batch(
    p_data JSONB
  ) RETURNS JSONB AS $proc$
  DECLARE
    v_user_id UUID;
    v_rows JSONB;
    v_account_id UUID := NULL;
  BEGIN
    -- Extract parameters with validation
    IF p_data ? 'user_id' AND p_data->>'user_id' IS NOT NULL THEN
      v_user_id := (p_data->>'user_id')::UUID;
    ELSE
      RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Missing required parameter: user_id'
      );
    END IF;
    
    IF p_data ? 'rows' AND p_data->'rows' IS NOT NULL THEN
      v_rows := p_data->'rows';
    ELSE
      RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Missing required parameter: rows'
      );
    END IF;
    
    IF p_data ? 'account_id' AND p_data->>'account_id' IS NOT NULL AND p_data->>'account_id' != '' THEN
      v_account_id := (p_data->>'account_id')::UUID;
    END IF;
    
    -- Call the main function
    RETURN process_topstepx_csv_batch(v_user_id, v_rows, v_account_id);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Error processing parameters: ' || SQLERRM
    );
  END;
  $proc$ LANGUAGE plpgsql SECURITY DEFINER;
  $func$;
  
  -- Grant necessary permissions to all versions
  EXECUTE 'GRANT EXECUTE ON FUNCTION process_topstepx_csv_batch(UUID, JSONB, UUID) TO authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION process_topstepx_csv_batch(UUID, JSONB) TO authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION process_topstepx_csv_batch(JSONB) TO authenticated';
  
  RAISE NOTICE 'TopstepX function fix completed successfully';
END$$; 