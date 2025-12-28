-- Fix for Tradovate function parameter order issue (FIXED SYNTAX)
DO $$
BEGIN
  RAISE NOTICE 'Starting Tradovate function parameter fix...';
  
  -- First, check if the function exists with any signatures
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'process_tradovate_csv_batch' 
    AND n.nspname = 'public'
  ) THEN
    RAISE NOTICE 'Found process_tradovate_csv_batch function, checking parameters...';
  ELSE
    RAISE NOTICE 'No process_tradovate_csv_batch function found, will create new one';
  END IF;
  
  -- Drop all existing versions of the function
  BEGIN
    DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, JSONB, UUID);
    RAISE NOTICE 'Dropped process_tradovate_csv_batch(UUID, JSONB, UUID)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_tradovate_csv_batch(UUID, JSONB, UUID): %', SQLERRM;
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, JSONB);
    RAISE NOTICE 'Dropped process_tradovate_csv_batch(UUID, JSONB)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_tradovate_csv_batch(UUID, JSONB): %', SQLERRM;
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS process_tradovate_csv_batch_direct(UUID, JSONB);
    RAISE NOTICE 'Dropped process_tradovate_csv_batch_direct(UUID, JSONB)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_tradovate_csv_batch_direct(UUID, JSONB): %', SQLERRM;
  END;
  
  -- Create a new implementation of the function with the same signature as expected by the frontend
  EXECUTE $func$
  CREATE OR REPLACE FUNCTION process_tradovate_csv_batch(
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
    v_entry_date TIMESTAMP;
    v_exit_date TIMESTAMP;
    v_date DATE;
    v_total_rows INTEGER;
    v_detailed_errors JSONB := '[]'::JSONB;
  BEGIN
    RAISE NOTICE 'Starting process_tradovate_csv_batch with user_id: %, account_id: %, rows count: %', 
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
          'Tradovate Account',
          'tradovate',
          0,
          NOW(),
          NOW()
        )
        RETURNING id INTO v_account_id;
        
        RAISE NOTICE 'Created new Tradovate account % for user %', v_account_id, p_user_id;
      END IF;
    END IF;
    
    -- Process each trade in the batch
    FOR i IN 0..v_total_rows - 1 LOOP
      v_trade := p_rows->i;
      
      BEGIN
        -- Extract and log each field for debugging
        RAISE NOTICE 'Processing row %: %', i, v_trade;
        
        -- Extract symbol
        v_symbol := COALESCE(
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
        
        -- Extract dates
        BEGIN
          v_date := COALESCE(
            (NULLIF(TRIM(v_trade->>'date'), ''))::DATE,
            CURRENT_DATE
          );
        EXCEPTION WHEN OTHERS THEN
          v_date := CURRENT_DATE;
        END;
        
        BEGIN
          v_entry_date := COALESCE(
            (NULLIF(TRIM(v_trade->>'entry_date'), ''))::TIMESTAMP,
            CURRENT_TIMESTAMP
          );
        EXCEPTION WHEN OTHERS THEN
          v_entry_date := CURRENT_TIMESTAMP;
        END;
        
        BEGIN
          v_exit_date := COALESCE(
            (NULLIF(TRIM(v_trade->>'exit_date'), ''))::TIMESTAMP,
            CURRENT_TIMESTAMP
          );
        EXCEPTION WHEN OTHERS THEN
          v_exit_date := CURRENT_TIMESTAMP;
        END;
        
        -- Extract side with default to 'long'
        v_side := LOWER(COALESCE(
          v_trade->>'side',
          v_trade->>'position',
          'long'
        ));
        
        -- Normalize side
        IF v_side LIKE '%buy%' OR v_side LIKE '%long%' THEN
          v_side := 'long';
        ELSIF v_side LIKE '%sell%' OR v_side LIKE '%short%' THEN
          v_side := 'short';
        ELSE
          v_side := 'long';
        END IF;
        
        -- Insert the trade with all necessary fields
        INSERT INTO trades (
          user_id,
          account_id,
          symbol,
          side,
          position,  -- Same as side
          quantity,
          size,      -- Same as quantity
          price,     -- Use entry_price as price
          entry_price,
          exit_price,
          pnl,
          entry_date,
          exit_date,
          date,
          timestamp,  -- Use entry_date as timestamp
          broker,
          source,
          created_at,
          updated_at,
          notes
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
          v_entry_date,
          v_exit_date,
          v_date,
          v_entry_date,
          'Tradovate',
          'tradovate',
          NOW(),
          NOW(),
          'Imported from Tradovate CSV'
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
    
    -- Return the final result
    RETURN jsonb_build_object(
      'success', v_success_count > 0,
      'processed', v_success_count,
      'errors', v_error_count,
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
  
  -- Grant necessary permissions
  EXECUTE 'GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(UUID, JSONB, UUID) TO authenticated';
  
  -- Create a version without the account_id parameter for backward compatibility
  EXECUTE $func$
  CREATE OR REPLACE FUNCTION process_tradovate_csv_batch(
    p_user_id UUID,
    p_rows JSONB
  ) RETURNS JSONB AS $proc$
  BEGIN
    RETURN process_tradovate_csv_batch(p_user_id, p_rows, NULL);
  END;
  $proc$ LANGUAGE plpgsql SECURITY DEFINER;
  $func$;
  
  EXECUTE 'GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(UUID, JSONB) TO authenticated';
  
  RAISE NOTICE 'Tradovate function parameter fix completed successfully';
END$$; 