-- Script to fix the TopstepX CSV upload process
-- This script completely rewrites the process_topstepx_csv_batch function to handle all cases correctly

-- First, clean up any previous function definitions to avoid conflicts
DO $$
BEGIN
  -- Drop all versions of the function to ensure a clean slate
  DROP FUNCTION IF EXISTS process_topstepx_csv_batch(UUID, JSONB, UUID);
  DROP FUNCTION IF EXISTS process_topstepx_csv_batch(UUID, JSONB);
  DROP FUNCTION IF EXISTS process_topstepx_csv_batch(JSONB);
  RAISE NOTICE 'Dropped existing process_topstepx_csv_batch functions';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error dropping functions: %', SQLERRM;
END;
$$;

-- Function to check if a column exists in a table
CREATE OR REPLACE FUNCTION column_exists(table_name TEXT, column_name TEXT) RETURNS BOOLEAN AS $$
DECLARE
  exists BOOLEAN;
BEGIN
  SELECT COUNT(*) > 0
  INTO exists
  FROM information_schema.columns
  WHERE table_name = $1
  AND column_name = $2;
  
  RETURN exists;
END;
$$ LANGUAGE plpgsql;

-- Create the main function for processing TopstepX CSV batch
CREATE OR REPLACE FUNCTION process_topstepx_csv_batch(
  p_user_id UUID,
  p_rows JSONB,
  p_account_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
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
BEGIN
  -- Add entry to debug log
  v_debug_log := array_append(v_debug_log, format('Starting process_topstepx_csv_batch with user_id: %s, account_id: %s', 
    p_user_id, p_account_id));
  
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
          is_demo,
          is_active,
          created_at,
          updated_at,
          is_default
        ) VALUES (
          p_user_id,
          'TopstepX Account',
          'TopstepX',
          'AUTO-' || substr(md5(random()::text), 1, 8),
          FALSE,
          TRUE,
          NOW(),
          NOW(),
          FALSE
        )
        RETURNING id INTO v_account_id;
        
        v_debug_log := array_append(v_debug_log, format('Created new trading_accounts record with ID %s', v_account_id));
      END IF;
    ELSIF v_has_accounts THEN
      -- Try the accounts table instead
      SELECT id INTO v_account_id
      FROM accounts
      WHERE user_id = p_user_id
      AND (LOWER(platform) LIKE '%topstepx%' OR LOWER(platform) LIKE '%topstep%')
      ORDER BY created_at DESC
      LIMIT 1;
      
      v_debug_log := array_append(v_debug_log, format('Found account ID %s for user %s', v_account_id, p_user_id));
      
      -- If still no account, create one
      IF v_account_id IS NULL AND column_exists('accounts', 'platform') THEN
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
        
        v_debug_log := array_append(v_debug_log, format('Created new accounts record with ID %s', v_account_id));
      END IF;
    END IF;
  END IF;
  
  -- Process each trade in the batch
  FOR i IN 0..v_total_rows - 1 LOOP
    v_trade := p_rows->i;
    
    BEGIN
      -- Extract symbol with fallbacks (use any field that might contain the symbol)
      v_symbol := COALESCE(
        v_trade->>'symbol',
        v_trade->>'Symbol',
        v_trade->>'contract_name',
        v_trade->>'ContractName',
        v_trade->>'contract',
        v_trade->>'Contract',
        'Unknown'
      );
      
      -- Extract and normalize side
      v_side := LOWER(COALESCE(
        v_trade->>'side',
        v_trade->>'Side',
        v_trade->>'type',
        v_trade->>'Type',
        v_trade->>'position',
        v_trade->>'Position',
        'long'
      ));
      
      -- Map side to one of the allowed values: buy, sell, long, short
      IF v_side IN ('buy', 'long', 'b', 'l') THEN
        v_side := 'long';
        v_position := 'long';
      ELSIF v_side IN ('sell', 'short', 's') THEN
        v_side := 'short';
        v_position := 'short';
      ELSE
        -- Default to long if not recognized
        v_side := 'long';
        v_position := 'long';
      END IF;
      
      -- Extract quantity (handle strings, numbers, and handle errors)
      BEGIN
        v_quantity := COALESCE(
          (NULLIF(TRIM(REPLACE(COALESCE(
            v_trade->>'quantity',
            v_trade->>'Quantity',
            v_trade->>'qty',
            v_trade->>'Qty',
            v_trade->>'size',
            v_trade->>'Size',
            '1'
          ), ',', '')), ''))::NUMERIC,
          1
        );
        
        -- Ensure quantity is positive
        v_quantity := ABS(v_quantity);
      EXCEPTION WHEN OTHERS THEN
        v_quantity := 1;
      END;
      
      -- Extract entry price with error handling
      BEGIN
        v_entry_price := COALESCE(
          (NULLIF(TRIM(REPLACE(REPLACE(COALESCE(
            v_trade->>'entry_price',
            v_trade->>'EntryPrice',
            v_trade->>'Entry',
            v_trade->>'price',
            v_trade->>'Price',
            '0'
          ), '$', ''), ',', '')), ''))::NUMERIC,
          0
        );
      EXCEPTION WHEN OTHERS THEN
        v_entry_price := 0;
      END;
      
      -- Extract exit price with error handling
      BEGIN
        v_exit_price := COALESCE(
          (NULLIF(TRIM(REPLACE(REPLACE(COALESCE(
            v_trade->>'exit_price',
            v_trade->>'ExitPrice',
            v_trade->>'Exit',
            v_trade->>'exit',
            '0'
          ), '$', ''), ',', '')), ''))::NUMERIC,
          0
        );
      EXCEPTION WHEN OTHERS THEN
        v_exit_price := 0;
      END;
      
      -- Extract PnL with fallbacks and error handling
      BEGIN
        v_pnl := COALESCE(
          (NULLIF(TRIM(REPLACE(REPLACE(COALESCE(
            v_trade->>'pnl',
            v_trade->>'PnL',
            v_trade->>'P&L',
            v_trade->>'P_L',
            v_trade->>'profit',
            v_trade->>'Profit',
            NULL
          ), '$', ''), ',', '')), ''))::NUMERIC,
          CASE 
            WHEN v_side = 'long' THEN (v_exit_price - v_entry_price) * v_quantity
            ELSE (v_entry_price - v_exit_price) * v_quantity
          END
        );
      EXCEPTION WHEN OTHERS THEN
        v_pnl := CASE 
          WHEN v_side = 'long' THEN (v_exit_price - v_entry_price) * v_quantity
          ELSE (v_entry_price - v_exit_price) * v_quantity
        END;
      END;
      
      -- Extract fees with fallbacks
      BEGIN
        v_fees := COALESCE(
          (NULLIF(TRIM(REPLACE(REPLACE(COALESCE(
            v_trade->>'fees',
            v_trade->>'Fees',
            v_trade->>'commission',
            v_trade->>'Commission',
            '0'
          ), '$', ''), ',', '')), ''))::NUMERIC,
          0
        );
      EXCEPTION WHEN OTHERS THEN
        v_fees := 0;
      END;
      
      -- Extract entry_date with extensive error handling
      BEGIN
        v_entry_date := COALESCE(
          (NULLIF(TRIM(COALESCE(
            v_trade->>'entry_date',
            v_trade->>'EntryDate',
            v_trade->>'entered_at',
            v_trade->>'EnteredAt',
            v_trade->>'entry_time',
            v_trade->>'EntryTime',
            v_trade->>'timestamp',
            v_trade->>'Timestamp',
            NULL
          )), ''))::TIMESTAMP,
          NOW()
        );
      EXCEPTION WHEN OTHERS THEN
        BEGIN
          -- Try alternate date formats
          v_entry_date := to_timestamp(COALESCE(
            v_trade->>'entry_date',
            v_trade->>'EntryDate',
            v_trade->>'entered_at',
            v_trade->>'EnteredAt',
            v_trade->>'entry_time',
            v_trade->>'EntryTime',
            v_trade->>'timestamp',
            v_trade->>'Timestamp',
            NULL
          ), 'MM/DD/YYYY HH24:MI:SS');
        EXCEPTION WHEN OTHERS THEN
          v_entry_date := NOW();
        END;
      END;
      
      -- Extract exit_date with extensive error handling
      BEGIN
        v_exit_date := COALESCE(
          (NULLIF(TRIM(COALESCE(
            v_trade->>'exit_date',
            v_trade->>'ExitDate',
            v_trade->>'exited_at',
            v_trade->>'ExitedAt',
            v_trade->>'exit_time',
            v_trade->>'ExitTime',
            NULL
          )), ''))::TIMESTAMP,
          NOW()
        );
      EXCEPTION WHEN OTHERS THEN
        BEGIN
          -- Try alternate date formats
          v_exit_date := to_timestamp(COALESCE(
            v_trade->>'exit_date',
            v_trade->>'ExitDate',
            v_trade->>'exited_at',
            v_trade->>'ExitedAt',
            v_trade->>'exit_time',
            v_trade->>'ExitTime',
            NULL
          ), 'MM/DD/YYYY HH24:MI:SS');
        EXCEPTION WHEN OTHERS THEN
          v_exit_date := NOW();
        END;
      END;
      
      -- Set date field from any available date field
      BEGIN
        v_date := COALESCE(
          (NULLIF(TRIM(COALESCE(
            v_trade->>'date',
            v_trade->>'Date',
            v_trade->>'trade_day',
            v_trade->>'TradeDay',
            v_trade->>'day',
            v_trade->>'Day',
            NULL
          )), ''))::DATE,
          v_entry_date::DATE
        );
      EXCEPTION WHEN OTHERS THEN
        v_date := v_entry_date::DATE;
      END;
      
      -- Parse duration with extensive error handling
      BEGIN
        -- Try to get duration from various fields
        v_duration_str := COALESCE(
          v_trade->>'duration',
          v_trade->>'Duration',
          v_trade->>'trade_duration',
          v_trade->>'TradeDuration',
          NULL
        );
        
        IF v_duration_str IS NOT NULL THEN
          -- Try to parse HH:MM:SS.MS format (common TopstepX format)
          IF v_duration_str ~ '^[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]+)?$' THEN
            v_duration := 
              (SPLIT_PART(v_duration_str, ':', 1)::INTEGER * INTERVAL '1 hour') + 
              (SPLIT_PART(v_duration_str, ':', 2)::INTEGER * INTERVAL '1 minute') +
              (SPLIT_PART(SPLIT_PART(v_duration_str, ':', 3), '.', 1)::INTEGER * INTERVAL '1 second');
          ELSE
            -- Try to cast directly to interval
            BEGIN
              v_duration := v_duration_str::INTERVAL;
            EXCEPTION WHEN OTHERS THEN
              -- Calculate from entry and exit timestamps
              v_duration := v_exit_date - v_entry_date;
            END;
          END IF;
        ELSE
          -- Calculate from entry and exit timestamps
          v_duration := v_exit_date - v_entry_date;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- Default to a reasonable value on error
        v_duration := v_exit_date - v_entry_date;
      END;
      
      -- Debug info before insert
      v_debug_log := array_append(v_debug_log, format('Row %s: Inserting trade for symbol=%s, side=%s, qty=%s, entry=%s, exit=%s, pnl=%s', 
        i, v_symbol, v_side, v_quantity, v_entry_price, v_exit_price, v_pnl));
        
      -- Insert the trade - using a basic insert that focuses on the essential fields
      INSERT INTO trades (
        user_id,           -- User who owns the trade
        account_id,        -- Account ID
        symbol,            -- Symbol/contract name
        side,              -- Direction of trade (buy/sell/long/short)
        position,          -- Position (long/short)
        quantity,          -- Quantity of contracts
        price,             -- Entry price (for compatibility)
        entry_price,       -- Entry price
        exit_price,        -- Exit price
        pnl,               -- Profit/loss
        fees,              -- Fees/commissions
        entry_date,        -- Entry timestamp
        exit_date,         -- Exit timestamp
        date,              -- Trade date
        timestamp,         -- Using entry_date for timestamp
        broker,            -- Broker name
        created_at,        -- Record creation time
        updated_at,        -- Record update time
        notes,             -- Notes field
        duration,          -- Properly handled duration as interval
        extended_data      -- Store original data
      ) VALUES (
        p_user_id,
        v_account_id,
        v_symbol,
        v_side,
        v_position,
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
        'Imported from TopstepX',
        v_duration,
        jsonb_build_object('original_data', v_trade)
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
      
      v_debug_log := array_append(v_debug_log, format('Error in row %s: %s', i, v_error));
      
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
    'user_id', p_user_id,
    'account_id', v_account_id,
    'results', v_results,
    'detailed_errors', CASE WHEN v_error_count > 0 THEN v_detailed_errors ELSE NULL END,
    'debug_log', v_debug_log
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
$$ LANGUAGE plpgsql;

-- Create simpler overloaded version with just user_id and rows
CREATE OR REPLACE FUNCTION process_topstepx_csv_batch(
  p_user_id UUID,
  p_rows JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN process_topstepx_csv_batch(p_user_id, p_rows, NULL);
END;
$$ LANGUAGE plpgsql;

-- Create version that accepts JSONB with user_id inside
CREATE OR REPLACE FUNCTION process_topstepx_csv_batch(
  p_data JSONB
) RETURNS JSONB AS $$
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
  
  IF p_data ? 'account_id' AND p_data->>'account_id' IS NOT NULL THEN
    v_account_id := (p_data->>'account_id')::UUID;
  END IF;
  
  -- Call the main function
  RETURN process_topstepx_csv_batch(v_user_id, v_rows, v_account_id);
END;
$$ LANGUAGE plpgsql;

-- Final notice of completion
DO $$
BEGIN
  RAISE NOTICE 'TopstepX function has been updated with proper duration type handling and robust error handling';
END;
$$; 