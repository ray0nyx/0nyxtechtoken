-- Simple fix for Tradovate CSV processing
-- This ensures that all trades are imported with correct dates from the CSV

CREATE OR REPLACE FUNCTION process_tradovate_csv_batch_simple(p_user_id uuid, p_rows jsonb, p_account_id uuid DEFAULT NULL::uuid)
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
  v_total_rows INTEGER;
  v_debug_log TEXT[];
BEGIN
  -- Add entry to debug log
  v_debug_log := array_append(v_debug_log, format('Starting process_tradovate_csv_batch_simple with user_id: %s, account_id: %s', 
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
  
  -- If account_id is not provided, try to find a default one
  IF v_account_id IS NULL THEN
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
      -- Debug info
      v_debug_log := array_append(v_debug_log, format('Processing row %s: %s', i, v_trade));
      
      -- First priority for date: use the explicit date from CSV if available
      DECLARE
        v_date DATE;
        v_entry_date TIMESTAMP;
        v_exit_date TIMESTAMP;
        v_entry_price NUMERIC;
        v_exit_price NUMERIC;
        v_symbol TEXT;
        v_quantity NUMERIC;
        v_pnl NUMERIC;
        v_fees NUMERIC;
        v_side TEXT;
      BEGIN
        -- Get the symbol
        v_symbol := COALESCE(v_trade->>'symbol', 'Unknown');
      
        -- Parse entry date
        BEGIN
          v_entry_date := COALESCE((v_trade->>'entry_date')::TIMESTAMP, NOW());
        EXCEPTION WHEN OTHERS THEN
          v_entry_date := NOW();
        END;
        
        -- Parse exit date
        BEGIN
          v_exit_date := COALESCE((v_trade->>'exit_date')::TIMESTAMP, v_entry_date);
        EXCEPTION WHEN OTHERS THEN
          v_exit_date := v_entry_date;
        END;
        
        -- Set date to match entry_date
        v_date := v_entry_date::DATE;
        
        -- Other fields
        v_quantity := COALESCE((v_trade->>'qty')::NUMERIC, 1);
        v_entry_price := COALESCE((v_trade->>'entry_price')::NUMERIC, 0);
        v_exit_price := COALESCE((v_trade->>'exit_price')::NUMERIC, 0);
        v_pnl := COALESCE((v_trade->>'pnl')::NUMERIC, (v_exit_price - v_entry_price) * v_quantity);
        v_fees := COALESCE((v_trade->>'fees')::NUMERIC, 0);
        v_side := COALESCE(v_trade->>'side', 'long');
        
        -- Debug info
        v_debug_log := array_append(v_debug_log, format('Inserting trade: symbol=%s, date=%s, entry_date=%s', 
          v_symbol, v_date, v_entry_date));
          
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
          extended_data    
        ) VALUES (
          p_user_id,
          v_account_id,
          v_symbol,
          v_side,
          v_side,
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
      END;
      
    EXCEPTION WHEN OTHERS THEN
      -- Handle any errors
      GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
      
      v_debug_log := array_append(v_debug_log, format('Error in row %s: %s', i, v_error));
      
      v_error_count := v_error_count + 1;
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