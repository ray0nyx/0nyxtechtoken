-- Script to debug the specific trade format being sent by the client

-- First, check the trades table structure
DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE 'Checking trades table structure:';
  FOR r IN (
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'trades'
    AND table_schema = 'public'
    ORDER BY ordinal_position
  ) LOOP
    RAISE NOTICE 'Column: %, Type: %, Nullable: %', r.column_name, r.data_type, r.is_nullable;
  END LOOP;
END $$;

-- Create a test function to try inserting a sample trade with the exact format from the client
CREATE OR REPLACE FUNCTION test_insert_sample_trade(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_account_id UUID;
  v_trade_id UUID;
  v_error TEXT;
  v_sample_trade JSONB := '{
    "symbol": "MNQH5",
    "date": "2025-03-12",
    "qty": 2,
    "entry_price": 19691.5,
    "exit_price": 19676.5,
    "pnl": -30,
    "side": "long"
  }'::JSONB;
BEGIN
  -- Find or create an account for the user
  SELECT id INTO v_account_id
  FROM accounts
  WHERE user_id = p_user_id
  LIMIT 1;
  
  IF v_account_id IS NULL THEN
    -- Create a default account
    INSERT INTO accounts (id, user_id, name, created_at)
    VALUES (gen_random_uuid(), p_user_id, 'Test Account', NOW())
    RETURNING id INTO v_account_id;
  END IF;
  
  -- Try to insert the trade with the exact format
  BEGIN
    INSERT INTO trades (
      id,
      user_id,
      account_id,
      symbol,
      side,
      quantity,
      price,
      timestamp,
      pnl,
      created_at,
      updated_at,
      entry_price,
      exit_price,
      entry_date,
      exit_date
    )
    VALUES (
      gen_random_uuid(),
      p_user_id,
      v_account_id,
      v_sample_trade->>'symbol',
      v_sample_trade->>'side',
      (v_sample_trade->>'qty')::NUMERIC,
      (v_sample_trade->>'entry_price')::NUMERIC, -- Using entry_price as the main price
      (v_sample_trade->>'date')::DATE::TIMESTAMP,
      (v_sample_trade->>'pnl')::NUMERIC,
      NOW(),
      NOW(),
      (v_sample_trade->>'entry_price')::NUMERIC,
      (v_sample_trade->>'exit_price')::NUMERIC,
      (v_sample_trade->>'date')::DATE::TIMESTAMP,
      (v_sample_trade->>'date')::DATE::TIMESTAMP
    )
    RETURNING id INTO v_trade_id;
    
    RETURN jsonb_build_object(
      'success', TRUE,
      'trade_id', v_trade_id,
      'message', 'Sample trade inserted successfully'
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', v_error,
      'sample_trade', v_sample_trade
    );
  END;
END;
$$ LANGUAGE plpgsql;

-- Create a modified version of process_tradovate_csv_batch that matches the exact client format
CREATE OR REPLACE FUNCTION process_tradovate_csv_batch_debug(
  p_user_id UUID,
  p_rows JSONB,
  p_account_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_row JSONB;
  v_result JSONB;
  v_results JSONB[] := '{}';
  v_success_count INTEGER := 0;
  v_error_count INTEGER := 0;
  v_account_id UUID := p_account_id;
  v_user_exists BOOLEAN;
  v_account_name TEXT;
  v_error TEXT;
  v_symbol TEXT;
  v_side TEXT;
  v_quantity NUMERIC;
  v_timestamp TIMESTAMP;
  v_pnl NUMERIC;
  v_account_exists BOOLEAN;
  v_entry_price NUMERIC;
  v_exit_price NUMERIC;
  v_date DATE;
BEGIN
  -- Log the input parameters
  RAISE NOTICE 'Debug - User ID: %, Account ID: %, Rows count: %', 
    p_user_id, p_account_id, jsonb_array_length(p_rows);
  
  -- Check if user exists
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) INTO v_user_exists;
  
  IF NOT v_user_exists THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'processed', 0,
      'errors', 1,
      'results', jsonb_build_array(jsonb_build_object('error', 'User does not exist'))
    );
  END IF;
  
  -- If account_id is not provided, find or create a default account for the user
  IF v_account_id IS NULL THEN
    -- Check if user has any accounts
    SELECT EXISTS(
      SELECT 1 FROM accounts 
      WHERE user_id = p_user_id
    ) INTO v_account_exists;
    
    IF v_account_exists THEN
      -- Use the first account found
      SELECT id INTO v_account_id 
      FROM accounts 
      WHERE user_id = p_user_id
      LIMIT 1;
      
      SELECT name INTO v_account_name 
      FROM accounts 
      WHERE id = v_account_id;
      
      RAISE NOTICE 'Using existing account: % (ID: %)', v_account_name, v_account_id;
    ELSE
      -- Create a default account
      v_account_id := gen_random_uuid();
      v_account_name := 'Default Account';
      
      INSERT INTO accounts (id, user_id, name, created_at)
      VALUES (v_account_id, p_user_id, v_account_name, NOW());
      
      RAISE NOTICE 'Created new account: % (ID: %)', v_account_name, v_account_id;
    END IF;
  END IF;
  
  -- Process each row in the batch
  FOR i IN 0..jsonb_array_length(p_rows) - 1 LOOP
    v_row := p_rows->i;
    
    -- Log the row being processed
    RAISE NOTICE 'Processing row %: %', i, v_row;
    
    BEGIN
      -- Extract values from the row using the exact field names from the client
      v_symbol := v_row->>'symbol';
      v_side := COALESCE(v_row->>'side', 'long');
      v_quantity := (v_row->>'qty')::NUMERIC;
      v_date := (v_row->>'date')::DATE;
      v_timestamp := v_date::TIMESTAMP;
      v_pnl := (v_row->>'pnl')::NUMERIC;
      v_entry_price := (v_row->>'entry_price')::NUMERIC;
      v_exit_price := (v_row->>'exit_price')::NUMERIC;
      
      -- Log the extracted values
      RAISE NOTICE 'Extracted values - Symbol: %, Side: %, Qty: %, Date: %, PnL: %, Entry: %, Exit: %',
        v_symbol, v_side, v_quantity, v_date, v_pnl, v_entry_price, v_exit_price;
      
      -- Insert the trade with the exact field mappings
      INSERT INTO trades (
        id,
        user_id,
        account_id,
        symbol,
        side,
        quantity,
        price,
        timestamp,
        pnl,
        created_at,
        updated_at,
        entry_price,
        exit_price,
        entry_date,
        exit_date
      )
      VALUES (
        gen_random_uuid(),
        p_user_id,
        v_account_id,
        v_symbol,
        v_side,
        v_quantity,
        v_entry_price, -- Use entry_price as the main price
        v_timestamp,
        v_pnl,
        NOW(),
        NOW(),
        v_entry_price,
        v_exit_price,
        v_timestamp,
        v_timestamp
      );
      
      v_result := jsonb_build_object(
        'success', TRUE,
        'symbol', v_symbol,
        'side', v_side,
        'quantity', v_quantity,
        'entry_price', v_entry_price,
        'exit_price', v_exit_price,
        'date', v_date,
        'pnl', v_pnl
      );
      
      v_success_count := v_success_count + 1;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
      
      RAISE NOTICE 'Error processing row %: %', i, v_error;
      
      v_result := jsonb_build_object(
        'success', FALSE,
        'error', v_error,
        'row', v_row
      );
      
      v_error_count := v_error_count + 1;
    END;
    
    v_results := array_append(v_results, v_result);
  END LOOP;
  
  -- Refresh analytics for the user
  BEGIN
    PERFORM refresh_user_analytics(p_user_id);
    RAISE NOTICE 'Analytics refreshed for user %', p_user_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Failed to refresh analytics: %', SQLERRM;
  END;
  
  -- Return the results
  RETURN jsonb_build_object(
    'success', v_error_count = 0,
    'processed', v_success_count,
    'errors', v_error_count,
    'results', to_jsonb(v_results)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch_debug(UUID, JSONB, UUID) TO authenticated;

-- Create a function to test with a single sample trade
CREATE OR REPLACE FUNCTION test_process_single_trade(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_sample_trade JSONB := '[{
    "symbol": "MNQH5",
    "date": "2025-03-12",
    "qty": 2,
    "entry_price": 19691.5,
    "exit_price": 19676.5,
    "pnl": -30,
    "side": "long"
  }]'::JSONB;
  v_result JSONB;
BEGIN
  -- Call the debug function with a single trade
  v_result := process_tradovate_csv_batch_debug(p_user_id, v_sample_trade);
  RETURN v_result;
END;
$$ LANGUAGE plpgsql; 