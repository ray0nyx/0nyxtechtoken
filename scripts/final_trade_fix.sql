-- Final fix script for trade upload issues
-- This script specifically addresses the field name mismatch between client and server

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

-- Add missing columns if they don't exist
DO $$
DECLARE
  v_has_entry_price BOOLEAN;
  v_has_exit_price BOOLEAN;
  v_has_entry_date BOOLEAN;
  v_has_exit_date BOOLEAN;
BEGIN
  RAISE NOTICE 'Checking for missing columns in trades table...';
  
  -- Check for entry_price column
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'trades' 
    AND table_schema = 'public'
    AND column_name = 'entry_price'
  ) INTO v_has_entry_price;
  
  -- Check for exit_price column
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'trades' 
    AND table_schema = 'public'
    AND column_name = 'exit_price'
  ) INTO v_has_exit_price;
  
  -- Check for entry_date column
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'trades' 
    AND table_schema = 'public'
    AND column_name = 'entry_date'
  ) INTO v_has_entry_date;
  
  -- Check for exit_date column
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'trades' 
    AND table_schema = 'public'
    AND column_name = 'exit_date'
  ) INTO v_has_exit_date;
  
  -- Add entry_price column if it doesn't exist
  IF NOT v_has_entry_price THEN
    RAISE NOTICE 'Adding entry_price column to trades table';
    EXECUTE 'ALTER TABLE trades ADD COLUMN entry_price NUMERIC';
    
    -- Update existing trades to set entry_price = price
    EXECUTE 'UPDATE trades SET entry_price = price WHERE entry_price IS NULL';
    
    RAISE NOTICE 'entry_price column added and populated';
  ELSE
    RAISE NOTICE 'entry_price column already exists';
  END IF;
  
  -- Add exit_price column if it doesn't exist
  IF NOT v_has_exit_price THEN
    RAISE NOTICE 'Adding exit_price column to trades table';
    EXECUTE 'ALTER TABLE trades ADD COLUMN exit_price NUMERIC';
    
    -- Update existing trades to set exit_price = price
    EXECUTE 'UPDATE trades SET exit_price = price WHERE exit_price IS NULL';
    
    RAISE NOTICE 'exit_price column added and populated';
  ELSE
    RAISE NOTICE 'exit_price column already exists';
  END IF;
  
  -- Add entry_date column if it doesn't exist
  IF NOT v_has_entry_date THEN
    RAISE NOTICE 'Adding entry_date column to trades table';
    EXECUTE 'ALTER TABLE trades ADD COLUMN entry_date TIMESTAMP';
    
    -- Update existing trades to set entry_date = timestamp
    EXECUTE 'UPDATE trades SET entry_date = timestamp WHERE entry_date IS NULL';
    
    RAISE NOTICE 'entry_date column added and populated';
  ELSE
    RAISE NOTICE 'entry_date column already exists';
  END IF;
  
  -- Add exit_date column if it doesn't exist
  IF NOT v_has_exit_date THEN
    RAISE NOTICE 'Adding exit_date column to trades table';
    EXECUTE 'ALTER TABLE trades ADD COLUMN exit_date TIMESTAMP';
    
    -- Update existing trades to set exit_date = timestamp
    EXECUTE 'UPDATE trades SET exit_date = timestamp WHERE exit_date IS NULL';
    
    RAISE NOTICE 'exit_date column added and populated';
  ELSE
    RAISE NOTICE 'exit_date column already exists';
  END IF;
  
  RAISE NOTICE 'Column check and addition complete';
END $$;

-- Drop existing versions of the function
DO $$
BEGIN
  -- Try to drop all versions of the function
  BEGIN
    DROP FUNCTION IF EXISTS process_tradovate_csv_batch(uuid, jsonb, uuid);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_tradovate_csv_batch(uuid, jsonb, uuid): %', SQLERRM;
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS process_tradovate_csv_batch(uuid, uuid, jsonb);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_tradovate_csv_batch(uuid, uuid, jsonb): %', SQLERRM;
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS process_tradovate_csv_batch(uuid, jsonb);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_tradovate_csv_batch(uuid, jsonb): %', SQLERRM;
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS process_tradovate_csv_batch(uuid, jsonb, text);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_tradovate_csv_batch(uuid, jsonb, text): %', SQLERRM;
  END;
END $$;

-- Create the fixed function that specifically handles the client's field names
CREATE OR REPLACE FUNCTION process_tradovate_csv_batch(
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
      AND name LIKE '%Tradovate%'
    ) INTO v_account_exists;
    
    IF v_account_exists THEN
      -- Use the first Tradovate account found
      SELECT id INTO v_account_id 
      FROM accounts 
      WHERE user_id = p_user_id 
      AND name LIKE '%Tradovate%' 
      LIMIT 1;
      
      SELECT name INTO v_account_name 
      FROM accounts 
      WHERE id = v_account_id;
    ELSE
      -- Create a default Tradovate account
      v_account_id := gen_random_uuid();
      v_account_name := 'Tradovate Account';
      
      INSERT INTO accounts (id, user_id, name, created_at)
      VALUES (v_account_id, p_user_id, v_account_name, NOW());
    END IF;
  END IF;
  
  -- Process each row in the batch
  FOR i IN 0..jsonb_array_length(p_rows) - 1 LOOP
    v_row := p_rows->i;
    
    BEGIN
      -- Extract values from the row using the exact field names from the client
      v_symbol := v_row->>'symbol';
      v_side := COALESCE(v_row->>'side', 'long');
      v_quantity := (v_row->>'qty')::NUMERIC;  -- Note: Client uses 'qty' instead of 'quantity'
      v_date := (v_row->>'date')::DATE;        -- Note: Client uses 'date' instead of 'timestamp'
      v_timestamp := v_date::TIMESTAMP;
      v_pnl := (v_row->>'pnl')::NUMERIC;
      v_entry_price := (v_row->>'entry_price')::NUMERIC;
      v_exit_price := (v_row->>'exit_price')::NUMERIC;
      
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
GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(UUID, JSONB, UUID) TO authenticated;

-- Do the same for TopstepX
DO $$
BEGIN
  -- Try to drop all versions of the function
  BEGIN
    DROP FUNCTION IF EXISTS process_topstepx_csv_batch(uuid, jsonb, uuid);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_topstepx_csv_batch(uuid, jsonb, uuid): %', SQLERRM;
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS process_topstepx_csv_batch(uuid, uuid, jsonb);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_topstepx_csv_batch(uuid, uuid, jsonb): %', SQLERRM;
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS process_topstepx_csv_batch(uuid, jsonb);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_topstepx_csv_batch(uuid, jsonb): %', SQLERRM;
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS process_topstepx_csv_batch(uuid, jsonb, text);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_topstepx_csv_batch(uuid, jsonb, text): %', SQLERRM;
  END;
END $$;

-- Create the fixed function for TopstepX
CREATE OR REPLACE FUNCTION process_topstepx_csv_batch(
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
      AND name LIKE '%TopstepX%'
    ) INTO v_account_exists;
    
    IF v_account_exists THEN
      -- Use the first TopstepX account found
      SELECT id INTO v_account_id 
      FROM accounts 
      WHERE user_id = p_user_id 
      AND name LIKE '%TopstepX%' 
      LIMIT 1;
      
      SELECT name INTO v_account_name 
      FROM accounts 
      WHERE id = v_account_id;
    ELSE
      -- Create a default TopstepX account
      v_account_id := gen_random_uuid();
      v_account_name := 'TopstepX Account';
      
      INSERT INTO accounts (id, user_id, name, created_at)
      VALUES (v_account_id, p_user_id, v_account_name, NOW());
    END IF;
  END IF;
  
  -- Process each row in the batch
  FOR i IN 0..jsonb_array_length(p_rows) - 1 LOOP
    v_row := p_rows->i;
    
    BEGIN
      -- Extract values from the row using the exact field names from the client
      v_symbol := v_row->>'symbol';
      v_side := COALESCE(v_row->>'side', 'long');
      v_quantity := (v_row->>'qty')::NUMERIC;  -- Note: Client uses 'qty' instead of 'quantity'
      v_date := (v_row->>'date')::DATE;        -- Note: Client uses 'date' instead of 'timestamp'
      v_timestamp := v_date::TIMESTAMP;
      v_pnl := (v_row->>'pnl')::NUMERIC;
      v_entry_price := (v_row->>'entry_price')::NUMERIC;
      v_exit_price := (v_row->>'exit_price')::NUMERIC;
      
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
GRANT EXECUTE ON FUNCTION process_topstepx_csv_batch(UUID, JSONB, UUID) TO authenticated;

-- Refresh analytics for all users
DO $$
DECLARE
  v_user_id UUID;
  r RECORD;
BEGIN
  RAISE NOTICE 'Refreshing analytics for all users...';
  
  FOR v_user_id IN SELECT id FROM auth.users
  LOOP
    BEGIN
      PERFORM refresh_user_analytics(v_user_id);
      RAISE NOTICE 'Analytics refreshed for user %', v_user_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to refresh analytics for user %: %', v_user_id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Analytics refresh complete';
END $$; 