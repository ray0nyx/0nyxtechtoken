-- Fix the Tradovate CSV date parsing to ensure dates match correctly with CSV data
-- This addresses the issue where trades are showing today's date instead of the actual trade date

CREATE OR REPLACE FUNCTION process_tradovate_csv_batch(p_user_id uuid, p_rows jsonb, p_account_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
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
  v_metadata JSONB;
  v_bought_timestamp TEXT;
  v_sold_timestamp TEXT;
  v_date_str TEXT;
BEGIN
  -- Add entry to debug log
  v_debug_log := array_append(v_debug_log, format('Starting process_tradovate_csv_batch with user_id: %s, account_id: %s', 
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
  
  -- Check for accounts
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'accounts'
  ) INTO v_has_accounts;
  
  -- If account_id is not provided, try to find a default one
  IF v_account_id IS NULL AND v_has_accounts THEN
    -- Try the accounts table
    SELECT id INTO v_account_id
    FROM accounts
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    v_debug_log := array_append(v_debug_log, format('Found account ID %s for user %s', v_account_id, p_user_id));
  END IF;
  
  -- Process each trade in the batch
  FOR i IN 0..v_total_rows - 1 LOOP
    v_trade := p_rows->i;
    
    BEGIN
      -- Extract symbol
      v_symbol := COALESCE(
        v_trade->>'symbol',
        'Unknown'
      );
      
      -- First, extract any metadata to access timestamp data
      v_metadata := COALESCE(v_trade->'metadata', '{}'::JSONB);
      
      -- Get date first from the direct date field, which should be most reliable
      v_date_str := COALESCE(
        v_trade->>'date',
        NULL
      );
      
      -- Extract timestamps from metadata or direct fields
      v_bought_timestamp := COALESCE(
        v_metadata->>'boughtTimestamp',
        v_trade->>'boughtTimestamp',
        NULL
      );
      
      v_sold_timestamp := COALESCE(
        v_metadata->>'soldTimestamp',
        v_trade->>'soldTimestamp',
        NULL
      );
      
      -- Determine side based on timestamps and logic
      v_side := COALESCE(v_trade->>'side', 'long');
      v_position := v_side;
      
      -- Make sure side is valid
      IF v_side NOT IN ('buy', 'sell', 'long', 'short') THEN
        v_side := 'long';
        v_position := 'long';
      END IF;
      
      -- Extract quantity
      v_quantity := COALESCE((v_trade->>'qty')::NUMERIC, 1);
      
      -- Get entry and exit prices
      v_entry_price := COALESCE((v_trade->>'entry_price')::NUMERIC, 0);
      v_exit_price := COALESCE((v_trade->>'exit_price')::NUMERIC, 0);
      
      -- Get PnL - use provided value or calculate it
      v_pnl := COALESCE(
        (v_trade->>'pnl')::NUMERIC,
        CASE 
          WHEN v_side = 'long' THEN (v_exit_price - v_entry_price) * v_quantity
          ELSE (v_entry_price - v_exit_price) * v_quantity
        END
      );
      
      -- Get fees
      v_fees := COALESCE((v_trade->>'fees')::NUMERIC, 0);
      
      -- Parse timestamps more flexibly - attempt multiple formats
      -- For entry date
      IF v_bought_timestamp IS NOT NULL THEN
        BEGIN
          -- Try multiple timestamp formats in order of likelihood
          v_entry_date := NULL;
          
          -- Try MM/DD/YYYY HH24:MI:SS format
          BEGIN
            v_entry_date := to_timestamp(v_bought_timestamp, 'MM/DD/YYYY HH24:MI:SS');
          EXCEPTION WHEN OTHERS THEN
            -- Try ISO format
            BEGIN
              v_entry_date := v_bought_timestamp::TIMESTAMP;
            EXCEPTION WHEN OTHERS THEN
              -- Try MM/DD/YYYY format
              BEGIN
                v_entry_date := to_timestamp(v_bought_timestamp, 'MM/DD/YYYY');
              EXCEPTION WHEN OTHERS THEN
                -- Try YYYY-MM-DD format
                BEGIN
                  v_entry_date := to_timestamp(v_bought_timestamp, 'YYYY-MM-DD');
                EXCEPTION WHEN OTHERS THEN
                  v_entry_date := NULL;
                END;
              END;
            END;
          END;
          
          -- If all parsing attempts failed, use the current timestamp
          IF v_entry_date IS NULL THEN
            v_entry_date := NOW();
          END IF;
        EXCEPTION WHEN OTHERS THEN
          v_entry_date := NOW();
        END;
      ELSE
        v_entry_date := NOW();
      END IF;
      
      -- For exit date
      IF v_sold_timestamp IS NOT NULL THEN
        BEGIN
          -- Try multiple timestamp formats in order of likelihood
          v_exit_date := NULL;
          
          -- Try MM/DD/YYYY HH24:MI:SS format
          BEGIN
            v_exit_date := to_timestamp(v_sold_timestamp, 'MM/DD/YYYY HH24:MI:SS');
          EXCEPTION WHEN OTHERS THEN
            -- Try ISO format
            BEGIN
              v_exit_date := v_sold_timestamp::TIMESTAMP;
            EXCEPTION WHEN OTHERS THEN
              -- Try MM/DD/YYYY format
              BEGIN
                v_exit_date := to_timestamp(v_sold_timestamp, 'MM/DD/YYYY');
              EXCEPTION WHEN OTHERS THEN
                -- Try YYYY-MM-DD format
                BEGIN
                  v_exit_date := to_timestamp(v_sold_timestamp, 'YYYY-MM-DD');
                EXCEPTION WHEN OTHERS THEN
                  v_exit_date := NULL;
                END;
              END;
            END;
          END;
          
          -- If all parsing attempts failed, use the entry date or current timestamp
          IF v_exit_date IS NULL THEN
            v_exit_date := COALESCE(v_entry_date, NOW());
          END IF;
        EXCEPTION WHEN OTHERS THEN
          v_exit_date := COALESCE(v_entry_date, NOW());
        END;
      ELSE
        v_exit_date := COALESCE(v_entry_date, NOW());
      END IF;
      
      -- Set date field - prioritize the direct date from the CSV file
      BEGIN
        v_date := NULL;
        
        -- First priority: Use the explicit date from the CSV
        IF v_date_str IS NOT NULL THEN
          BEGIN
            -- Try parsing in ISO format first (YYYY-MM-DD)
            v_date := v_date_str::DATE;
          EXCEPTION WHEN OTHERS THEN
            -- Try MM/DD/YYYY format
            BEGIN
              v_date := to_date(v_date_str, 'MM/DD/YYYY');
            EXCEPTION WHEN OTHERS THEN
              -- Try various other formats
              BEGIN
                v_date := to_date(v_date_str, 'DD/MM/YYYY');
              EXCEPTION WHEN OTHERS THEN
                BEGIN
                  v_date := to_date(v_date_str, 'YYYY/MM/DD');
                EXCEPTION WHEN OTHERS THEN
                  v_date := NULL;
                END;
              END;
            END;
          END;
        END IF;
        
        -- Second priority: Use entry_date
        IF v_date IS NULL AND v_entry_date IS NOT NULL THEN
          v_date := v_entry_date::DATE;
        END IF;
        
        -- Fallback: Use today's date if all else fails
        IF v_date IS NULL THEN
          v_date := CURRENT_DATE;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- Final fallback
        v_date := CURRENT_DATE;
      END;
      
      -- Calculate duration between entry and exit
      v_duration := v_exit_date - v_entry_date;
      
      -- Debug info before insert
      v_debug_log := array_append(v_debug_log, format('Row %s: Inserting trade for symbol=%s, side=%s, qty=%s, entry=%s, exit=%s, pnl=%s, date=%s', 
        i, v_symbol, v_side, v_quantity, v_entry_price, v_exit_price, v_pnl, v_date));
        
      -- Insert the trade
      INSERT INTO trades (
        user_id,         
        account_id,      
        symbol,          
        side,            
        position,        
        quantity,        
        price,           
        entry_price,     
        exit_price,      
        pnl,             
        fees,            
        entry_date,      
        exit_date,       
        date,            
        timestamp,       
        broker,          
        created_at,      
        updated_at,      
        notes,           
        duration,        
        extended_data    
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
        v_date,          -- Using the properly parsed date here
        v_entry_date,
        'Tradovate',
        NOW(),
        NOW(),
        'Imported from Tradovate',
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
$function$;

-- Update existing trades with wrong dates - SIMPLE VERSION
-- This will fix any trades that were already imported with incorrect dates
CREATE OR REPLACE FUNCTION fix_tradovate_dates_simple()
RETURNS TEXT AS $$
DECLARE
  v_count INTEGER := 0;
  v_error TEXT;
BEGIN
  -- Simply set date to be the same as entry_date for all Tradovate trades
  -- that have today's date
  UPDATE trades 
  SET date = entry_date::DATE
  WHERE 
    broker = 'Tradovate'
    AND date = CURRENT_DATE
    AND entry_date IS NOT NULL;
    
  -- Get count of rows affected
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN format('Fixed %s Tradovate trades with incorrect dates', v_count);
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
  RETURN format('Error fixing dates: %s', v_error);
END;
$$ LANGUAGE plpgsql;

-- Run the simple fix function to update existing trades with wrong dates
SELECT fix_tradovate_dates_simple();

-- Update existing trades with wrong dates
-- This will fix any trades that were already imported with incorrect dates
CREATE OR REPLACE FUNCTION fix_tradovate_dates()
RETURNS TEXT AS $$
DECLARE
  v_count INTEGER := 0;
  v_error TEXT;
  v_count_metadata INTEGER := 0;
  v_count_entry_date INTEGER := 0;
  v_count_exit_date INTEGER := 0;
BEGIN
  -- STEP 1: Fix trades using metadata original_data
  UPDATE trades t
  SET 
    date = 
      CASE 
        -- Try to get the date from the metadata
        WHEN (t.extended_data->'original_data'->>'date') IS NOT NULL THEN
          -- Try various date formats
          COALESCE(
            -- ISO format
            (t.extended_data->'original_data'->>'date')::DATE,
            -- MM/DD/YYYY format
            to_date(t.extended_data->'original_data'->>'date', 'MM/DD/YYYY'),
            -- Original date
            t.date
          )
        -- If no date in metadata, use entry_date
        ELSE 
          t.entry_date::DATE
      END,
    entry_date = 
      CASE 
        -- Try to get the entry_date from timestamps
        WHEN (t.extended_data->'original_data'->'metadata'->>'boughtTimestamp') IS NOT NULL THEN
          -- Try to parse boughtTimestamp
          COALESCE(
            -- Try to parse as timestamp
            (t.extended_data->'original_data'->'metadata'->>'boughtTimestamp')::TIMESTAMP,
            -- Original entry date  
            t.entry_date
          )
        ELSE
          t.entry_date
      END,
    exit_date = 
      CASE 
        -- Try to get the exit_date from timestamps
        WHEN (t.extended_data->'original_data'->'metadata'->>'soldTimestamp') IS NOT NULL THEN
          -- Try to parse soldTimestamp
          COALESCE(
            -- Try to parse as timestamp
            (t.extended_data->'original_data'->'metadata'->>'soldTimestamp')::TIMESTAMP,
            -- Original exit date
            t.exit_date
          )
        ELSE
          t.exit_date
      END
  WHERE 
    t.broker = 'Tradovate'
    AND t.extended_data IS NOT NULL
    AND t.extended_data ? 'original_data'
    AND (DATE(t.date) = CURRENT_DATE OR t.date IS NULL);
    
  -- Get the number of rows affected in the first update
  GET DIAGNOSTICS v_count_metadata = ROW_COUNT;
  
  -- STEP 2: Fix any remaining trades that still have today's date by using entry_date
  -- This is needed for trades that might not have extended_data with parsed dates
  UPDATE trades t
  SET 
    date = t.entry_date::DATE
  WHERE 
    t.broker = 'Tradovate'
    AND (DATE(t.date) = CURRENT_DATE OR t.date IS NULL)
    AND t.entry_date IS NOT NULL;
    
  -- Get the number of rows affected in the second update
  GET DIAGNOSTICS v_count_entry_date = ROW_COUNT;
  
  -- Step 3: For any remaining trades, try using exit_date
  UPDATE trades t
  SET 
    date = t.exit_date::DATE
  WHERE 
    t.broker = 'Tradovate'
    AND (DATE(t.date) = CURRENT_DATE OR t.date IS NULL)
    AND t.exit_date IS NOT NULL;
  
  -- Get the number of rows affected in the third update
  GET DIAGNOSTICS v_count_exit_date = ROW_COUNT;
  
  -- Calculate total count of affected rows
  v_count := v_count_metadata + v_count_entry_date + v_count_exit_date;
  
  RETURN format('Fixed %s Tradovate trades with incorrect dates. Metadata fixes: %s, Entry date fixes: %s, Exit date fixes: %s', 
                v_count, v_count_metadata, v_count_entry_date, v_count_exit_date);
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
  RETURN format('Error fixing dates: %s', v_error);
END;
$$ LANGUAGE plpgsql;

-- Run the fix function to update any existing trades with wrong dates
SELECT fix_tradovate_dates(); 