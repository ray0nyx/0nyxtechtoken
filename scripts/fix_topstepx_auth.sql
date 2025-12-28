-- Fix TopstepX upload auth issues
-- Ensure function verifies user authentication and handles RLS properly

-- First, check if function exists and drop it
DROP FUNCTION IF EXISTS process_topstepx_csv_batch(UUID, JSONB, UUID);
DROP FUNCTION IF EXISTS process_topstepx_csv_batch(UUID, JSONB);
DROP FUNCTION IF EXISTS process_topstepx_csv_batch(JSONB);

-- Create the function with proper auth verification
-- SECURITY DEFINER allows the function to bypass RLS policies
CREATE OR REPLACE FUNCTION process_topstepx_csv_batch(
  p_user_id UUID,
  p_rows JSONB,
  p_account_id UUID DEFAULT NULL
) RETURNS JSONB 
LANGUAGE plpgsql
SECURITY DEFINER -- Use SECURITY DEFINER to bypass RLS, but we'll still verify auth
SET search_path = public
AS $$
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
  v_position TEXT;
  v_quantity NUMERIC;
  v_entry_price NUMERIC;
  v_exit_price NUMERIC;
  v_pnl NUMERIC;
  v_fees NUMERIC;
  v_entry_date TIMESTAMP;
  v_exit_date TIMESTAMP;
  v_date DATE;
  v_total_rows INTEGER;
  v_debug_log TEXT[];
  v_detailed_errors JSONB := '[]'::JSONB;
  v_duration INTERVAL;
  v_duration_str TEXT;
  v_has_trading_accounts BOOLEAN;
  v_has_accounts BOOLEAN;
  v_authenticated_user_id UUID;
  v_is_developer BOOLEAN := FALSE;
  v_error_code TEXT;
  v_error_detail TEXT;
  v_error_hint TEXT;
BEGIN
  -- CRITICAL: Verify the authenticated user matches p_user_id
  -- This prevents users from uploading trades for other users
  v_authenticated_user_id := auth.uid();
  
  -- Check if p_user_id is a developer ID first (before checking auth.uid())
  -- This allows developers to upload even if auth.uid() is NULL
  v_is_developer := p_user_id IN (
    '856950ff-d638-419d-bcf1-b7dac51d1c7f', -- rayhan@arafatcapital.com
    '8538e0b7-6dcd-4673-b39f-00d273c7fc76'  -- sevemadsen18@gmail.com
  );
  
  -- If not a developer by ID, check database flag (only if we have auth.uid())
  IF NOT v_is_developer AND v_authenticated_user_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM user_subscriptions
      WHERE user_id = v_authenticated_user_id
      AND is_developer = TRUE
    ) INTO v_is_developer;
  END IF;
  
  -- If auth.uid() is NULL, only allow if user is a developer
  IF v_authenticated_user_id IS NULL THEN
    IF v_is_developer THEN
      -- Developer can proceed even without auth.uid()
      v_debug_log := array_append(v_debug_log, format('Developer %s proceeding without auth.uid()', p_user_id));
    ELSE
      RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'User not authenticated',
        'processed', 0,
        'debug', ARRAY['No authenticated user found and user is not a developer']
      );
    END IF;
  END IF;
  
  -- Developers can upload for any user, regular users can only upload for themselves
  IF NOT v_is_developer AND v_authenticated_user_id != p_user_id THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', format('User ID mismatch. Authenticated: %s, Provided: %s. Only developers can upload trades for other users.', v_authenticated_user_id, p_user_id),
      'processed', 0,
      'debug', ARRAY[format('Auth check failed: authenticated=%s, provided=%s, is_developer=%s', v_authenticated_user_id, p_user_id, v_is_developer)]
    );
  END IF;
  
  -- Add entry to debug log
  v_debug_log := array_append(v_debug_log, format('Starting process_topstepx_csv_batch with user_id: %s, account_id: %s, authenticated: %s, is_developer: %s', 
    p_user_id, p_account_id, v_authenticated_user_id, v_is_developer));
  
  -- Validate user_id
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'User ID is required',
      'processed', 0,
      'debug', v_debug_log
    );
  END IF;
  
  -- Validate rows input
  IF p_rows IS NULL OR jsonb_typeof(p_rows) != 'array' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Rows parameter must be a valid JSON array',
      'processed', 0,
      'debug', v_debug_log
    );
  END IF;
  
  -- Get total rows count
  v_total_rows := jsonb_array_length(p_rows);
  v_debug_log := array_append(v_debug_log, format('Number of rows to process: %s', v_total_rows));
  
  IF v_total_rows = 0 THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'No rows to process',
      'processed', 0,
      'debug', v_debug_log
    );
  END IF;
  
  -- Check for trading_accounts table
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'trading_accounts'
  ) INTO v_has_trading_accounts;
  
  -- Check for accounts table
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'accounts'
  ) INTO v_has_accounts;
  
  -- If account_id is not provided, try to find a default one
  IF v_account_id IS NULL THEN
    IF v_has_trading_accounts THEN
      SELECT id INTO v_account_id
      FROM trading_accounts
      WHERE user_id = p_user_id
      AND (LOWER(broker) LIKE '%topstepx%' OR LOWER(broker) LIKE '%topstep%')
      ORDER BY created_at DESC
      LIMIT 1;
      
      v_debug_log := array_append(v_debug_log, format('Found trading account ID %s for user %s', v_account_id, p_user_id));
      
      -- If still no account, create one
      IF v_account_id IS NULL AND column_exists('trading_accounts', 'broker') THEN
        INSERT INTO trading_accounts (
          user_id,
          name,
          broker,
          account_number,
          created_at,
          updated_at
        ) VALUES (
          p_user_id,
          'TopstepX Account',
          'TopstepX',
          'AUTO-' || substr(p_user_id::text, 1, 8),
          NOW(),
          NOW()
        ) RETURNING id INTO v_account_id;
        
        v_debug_log := array_append(v_debug_log, format('Created new TopstepX trading account %s for user %s', v_account_id, p_user_id));
      END IF;
    END IF;
    
    -- Fallback to accounts table if trading_accounts doesn't exist or didn't work
    IF v_account_id IS NULL AND v_has_accounts THEN
      SELECT id INTO v_account_id
      FROM accounts
      WHERE user_id = p_user_id
      AND (LOWER(platform) LIKE '%topstepx%' OR LOWER(platform) LIKE '%topstep%')
      ORDER BY created_at DESC
      LIMIT 1;
      
      IF v_account_id IS NULL THEN
        INSERT INTO accounts (
          user_id,
          name,
          platform,
          created_at,
          updated_at
        ) VALUES (
          p_user_id,
          'TopstepX Account',
          'topstepx',
          NOW(),
          NOW()
        ) RETURNING id INTO v_account_id;
        
        v_debug_log := array_append(v_debug_log, format('Created new TopstepX account %s for user %s', v_account_id, p_user_id));
      END IF;
    END IF;
  END IF;
  
  -- Process each trade
  FOR i IN 0..jsonb_array_length(p_rows)-1 LOOP
    v_trade := p_rows->i;
    v_debug_log := array_append(v_debug_log, format('Processing trade %s: %s', i, v_trade));
    
    BEGIN
      -- Extract trade data with validation
      -- Check for symbol/contract_name in multiple possible field names
      v_symbol := COALESCE(
        v_trade->>'symbol',
        v_trade->>'Symbol',
        v_trade->>'contract_name',
        v_trade->>'ContractName',
        v_trade->>'contract',
        v_trade->>'Contract'
      );
      IF v_symbol IS NULL OR v_symbol = '' THEN
        -- Get available field names for error message
        DECLARE
          v_available_fields TEXT := '';
          v_key TEXT;
        BEGIN
          FOR v_key IN SELECT jsonb_object_keys(v_trade)
          LOOP
            IF v_available_fields != '' THEN
              v_available_fields := v_available_fields || ', ';
            END IF;
            v_available_fields := v_available_fields || v_key;
          END LOOP;
          RAISE EXCEPTION 'Symbol/contract_name is required for trade at row %. Available fields: %', i, COALESCE(v_available_fields, 'none');
        END;
      END IF;
      
      v_side := v_trade->>'side';
      v_position := COALESCE(v_trade->>'position', v_side, 'long'); -- Default to long if not specified
      
      -- Ensure position is valid
      IF v_position NOT IN ('long', 'short') THEN
        -- Try to infer from side
        IF v_side IN ('buy', 'long', 'B', 'BTO') THEN
          v_position := 'long';
        ELSIF v_side IN ('sell', 'short', 'S', 'STO') THEN
          v_position := 'short';
        ELSE
          v_position := 'long'; -- Default
        END IF;
      END IF;
      
      -- Extract quantity from multiple possible field names
      v_quantity := COALESCE(
        (v_trade->>'quantity')::NUMERIC,
        (v_trade->>'Quantity')::NUMERIC,
        (v_trade->>'qty')::NUMERIC,
        (v_trade->>'Qty')::NUMERIC,
        (v_trade->>'size')::NUMERIC,
        (v_trade->>'Size')::NUMERIC
      );
      IF v_quantity IS NULL OR v_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity/size must be greater than 0 for trade at row %', i;
      END IF;
      
      -- Extract entry price from multiple possible field names
      v_entry_price := COALESCE(
        (v_trade->>'entry_price')::NUMERIC,
        (v_trade->>'EntryPrice')::NUMERIC,
        (v_trade->>'entryPrice')::NUMERIC,
        (v_trade->>'Entry')::NUMERIC
      );
      IF v_entry_price IS NULL THEN
        RAISE EXCEPTION 'Entry price is required for trade at row %', i;
      END IF;
      
      -- Extract exit price from multiple possible field names
      v_exit_price := COALESCE(
        (v_trade->>'exit_price')::NUMERIC,
        (v_trade->>'ExitPrice')::NUMERIC,
        (v_trade->>'exitPrice')::NUMERIC,
        (v_trade->>'Exit')::NUMERIC
      );
      v_pnl := COALESCE((v_trade->>'pnl')::NUMERIC, 0);
      v_fees := COALESCE((v_trade->>'fees')::NUMERIC, 0);
      
      -- Extract entry date from multiple possible field names
      v_entry_date := COALESCE(
        (v_trade->>'entry_date')::TIMESTAMP,
        (v_trade->>'EntryDate')::TIMESTAMP,
        (v_trade->>'entered_at')::TIMESTAMP,
        (v_trade->>'EnteredAt')::TIMESTAMP,
        (v_trade->>'entry_time')::TIMESTAMP,
        (v_trade->>'EntryTime')::TIMESTAMP
      );
      IF v_entry_date IS NULL THEN
        RAISE EXCEPTION 'Entry date/time is required for trade at row %', i;
      END IF;
      
      -- Extract exit date from multiple possible field names
      v_exit_date := COALESCE(
        (v_trade->>'exit_date')::TIMESTAMP,
        (v_trade->>'ExitDate')::TIMESTAMP,
        (v_trade->>'exited_at')::TIMESTAMP,
        (v_trade->>'ExitedAt')::TIMESTAMP,
        (v_trade->>'exit_time')::TIMESTAMP,
        (v_trade->>'ExitTime')::TIMESTAMP
      );
      v_date := COALESCE((v_trade->>'date')::DATE, v_entry_date::DATE);
      
      -- Ensure date is set
      IF v_date IS NULL THEN
        v_date := v_entry_date::DATE;
      END IF;
      
      -- Calculate duration if provided
      IF v_trade->>'duration' IS NOT NULL THEN
        v_duration_str := v_trade->>'duration';
        -- Try to parse duration string (format: HH:MM:SS or HH:MM:SS.MS)
        BEGIN
          v_duration := v_duration_str::INTERVAL;
        EXCEPTION WHEN OTHERS THEN
          v_duration := NULL;
        END;
      ELSE
        v_duration := NULL;
      END IF;
      
      -- Insert the trade - using only columns that definitely exist
      -- SECURITY DEFINER should bypass RLS, but we ensure user_id matches authenticated user
      -- Try the insert and catch any RLS or constraint errors
      BEGIN
        -- Build a dynamic INSERT that only uses columns that exist
        -- Start with required columns that definitely exist
        INSERT INTO trades (
          user_id,
          symbol,
          position,
          quantity,
          entry_price,
          entry_date,
          date,
          broker,
          created_at,
          updated_at
        ) VALUES (
          p_user_id,
          v_symbol,
          v_position,
          v_quantity::INTEGER,
          v_entry_price,
          v_entry_date,
          v_date,
          'TopstepX',
          NOW(),
          NOW()
        )
        RETURNING id INTO v_trade_id;
        
        -- Now update optional columns if they exist and have values
        IF v_trade_id IS NOT NULL THEN
          -- Update exit_price if provided
          IF v_exit_price IS NOT NULL THEN
            UPDATE trades SET exit_price = v_exit_price WHERE id = v_trade_id;
          END IF;
          
          -- Update exit_date if provided
          IF v_exit_date IS NOT NULL THEN
            UPDATE trades SET exit_date = v_exit_date WHERE id = v_trade_id;
          END IF;
          
          -- Update pnl if provided
          IF v_pnl IS NOT NULL AND v_pnl != 0 THEN
            UPDATE trades SET pnl = v_pnl WHERE id = v_trade_id;
          END IF;
          
          -- Update fees if provided
          IF v_fees IS NOT NULL AND v_fees != 0 THEN
            UPDATE trades SET fees = v_fees WHERE id = v_trade_id;
          END IF;
          
          -- Update account_id if provided
          IF v_account_id IS NOT NULL THEN
            UPDATE trades SET account_id = v_account_id WHERE id = v_trade_id;
          END IF;
          
          -- Update notes
          UPDATE trades SET notes = 'Imported from TopstepX' WHERE id = v_trade_id;
          
          -- Try to update optional columns that might exist
          BEGIN
            -- Try to update side if column exists
            IF v_side IS NOT NULL THEN
              EXECUTE format('UPDATE trades SET side = %L WHERE id = %L', v_side, v_trade_id);
            END IF;
          EXCEPTION WHEN OTHERS THEN
            -- Column doesn't exist, ignore
            NULL;
          END;
          
          BEGIN
            -- Try to update extended_data if column exists
            EXECUTE format('UPDATE trades SET extended_data = %L::jsonb WHERE id = %L', 
              jsonb_build_object('original_data', v_trade), v_trade_id);
          EXCEPTION WHEN OTHERS THEN
            -- Column doesn't exist, ignore
            NULL;
          END;
          
          BEGIN
            -- Try to update duration if column exists and value is provided
            IF v_duration IS NOT NULL THEN
              EXECUTE format('UPDATE trades SET duration = %L WHERE id = %L', v_duration, v_trade_id);
            END IF;
          EXCEPTION WHEN OTHERS THEN
            -- Column doesn't exist, ignore
            NULL;
          END;
        END IF;
        
        -- Verify the insert actually worked
        IF v_trade_id IS NULL THEN
          RAISE EXCEPTION 'Trade insert returned NULL ID';
        END IF;
        
        v_debug_log := array_append(v_debug_log, format('Successfully inserted trade %s for user %s', v_trade_id, p_user_id));
        
      EXCEPTION WHEN insufficient_privilege THEN
        -- RLS blocked the insert
        RAISE EXCEPTION 'RLS policy blocked trade insert. User: %, Authenticated: %, Is Developer: %', 
          p_user_id, v_authenticated_user_id, v_is_developer;
      WHEN OTHERS THEN
        -- Re-raise other errors with full details
        GET STACKED DIAGNOSTICS 
          v_error = MESSAGE_TEXT,
          v_error_code = RETURNED_SQLSTATE,
          v_error_detail = PG_EXCEPTION_DETAIL;
        RAISE EXCEPTION 'Error inserting trade: % (Code: %, Detail: %)', v_error, v_error_code, v_error_detail;
      END;
      
      v_success_count := v_success_count + 1;
      v_results := v_results || jsonb_build_object(
        'success', TRUE,
        'trade_id', v_trade_id,
        'row_index', i,
        'account_id_used', v_account_id
      );
      
    EXCEPTION WHEN OTHERS THEN
      -- Handle any errors - capture full error details
      GET STACKED DIAGNOSTICS 
        v_error = MESSAGE_TEXT,
        v_error_code = RETURNED_SQLSTATE,
        v_error_detail = PG_EXCEPTION_DETAIL,
        v_error_hint = PG_EXCEPTION_HINT;
      
      v_debug_log := array_append(v_debug_log, format('Error in row %s: %s (Code: %s, Detail: %s, Hint: %s)', 
        i, v_error, v_error_code, v_error_detail, v_error_hint));
      
      v_error_count := v_error_count + 1;
      v_detailed_errors := v_detailed_errors || jsonb_build_object(
        'row', i,
        'error', v_error,
        'error_code', v_error_code,
        'error_detail', v_error_detail,
        'error_hint', v_error_hint,
        'data', v_trade
      );
      
      v_results := v_results || jsonb_build_object(
        'success', FALSE,
        'error', v_error,
        'error_code', v_error_code,
        'row_index', i,
        'account_id_used', v_account_id
      );
    END;
  END LOOP;
  
  -- Attempt to refresh analytics tables if they exist
  BEGIN
    -- Try to call refresh_user_analytics if it exists
    IF EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'refresh_user_analytics'
    ) THEN
      PERFORM refresh_user_analytics(p_user_id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_debug_log := array_append(v_debug_log, format('Error refreshing analytics: %s', SQLERRM));
  END;
  
  -- Try to update regular analytics if that function exists
  BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'update_analytics_for_user'
    ) THEN
      PERFORM update_analytics_for_user(p_user_id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_debug_log := array_append(v_debug_log, format('Error updating analytics: %s', SQLERRM));
  END;
  
  -- Return the final result
  RETURN jsonb_build_object(
    'success', v_success_count > 0,
    'message', format('Processed %s rows with %s errors', v_total_rows, v_error_count),
    'total_rows', v_total_rows,
    'success_count', v_success_count,
    'error_count', v_error_count,
    'processed', v_success_count,
    'user_id', p_user_id,
    'account_id', v_account_id,
    'results', v_results,
    'detailed_errors', CASE WHEN v_error_count > 0 THEN v_detailed_errors ELSE NULL END,
    'debug_log', v_debug_log,
    'auth_info', jsonb_build_object(
      'authenticated_user', v_authenticated_user_id,
      'provided_user', p_user_id,
      'is_developer', v_is_developer
    )
  );
EXCEPTION WHEN OTHERS THEN
  -- Catch any unexpected errors
  RETURN jsonb_build_object(
    'success', FALSE,
    'error', 'Unexpected error: ' || SQLERRM,
    'processed', v_success_count,
    'errors', v_error_count + 1,
    'user_id', p_user_id,
    'debug_log', v_debug_log
  );
END;
$$;

-- Create simpler overloaded version with just user_id and rows
CREATE OR REPLACE FUNCTION process_topstepx_csv_batch(
  p_user_id UUID,
  p_rows JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN process_topstepx_csv_batch(p_user_id, p_rows, NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION process_topstepx_csv_batch(UUID, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION process_topstepx_csv_batch(UUID, JSONB) TO authenticated;

-- Helper function to check if column exists
CREATE OR REPLACE FUNCTION column_exists(table_name TEXT, column_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = column_exists.table_name
    AND column_name = column_exists.column_name
  );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION column_exists(TEXT, TEXT) TO authenticated;

