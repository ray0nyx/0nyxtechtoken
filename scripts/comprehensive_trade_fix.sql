-- Comprehensive script to fix trade upload issues
-- This script:
-- 1. Adds missing columns to the trades table
-- 2. Creates a fixed version of the process_tradovate_csv_batch function
-- 3. Creates a fixed version of the process_topstepx_csv_batch function
-- 4. Refreshes analytics for all users

-- PART 1: Add missing columns to the trades table
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

-- PART 2: Create a fixed version of the process_tradovate_csv_batch function
-- First, drop existing versions of the function if they exist
DO $$
BEGIN
  -- Try to drop the function with all possible parameter combinations
  BEGIN
    DROP FUNCTION IF EXISTS process_tradovate_csv_batch(uuid, jsonb, uuid);
    RAISE NOTICE 'Dropped process_tradovate_csv_batch(uuid, jsonb, uuid)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_tradovate_csv_batch(uuid, jsonb, uuid): %', SQLERRM;
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS process_tradovate_csv_batch(uuid, uuid, jsonb);
    RAISE NOTICE 'Dropped process_tradovate_csv_batch(uuid, uuid, jsonb)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_tradovate_csv_batch(uuid, uuid, jsonb): %', SQLERRM;
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS process_tradovate_csv_batch(uuid, jsonb);
    RAISE NOTICE 'Dropped process_tradovate_csv_batch(uuid, jsonb)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_tradovate_csv_batch(uuid, jsonb): %', SQLERRM;
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS process_tradovate_csv_batch(uuid, jsonb, text);
    RAISE NOTICE 'Dropped process_tradovate_csv_batch(uuid, jsonb, text)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_tradovate_csv_batch(uuid, jsonb, text): %', SQLERRM;
  END;
END $$;

-- Now create the new function with flexible column handling
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
  v_price NUMERIC;
  v_timestamp TIMESTAMP;
  v_pnl NUMERIC;
  v_commission NUMERIC;
  v_account_exists BOOLEAN;
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
      
      RAISE NOTICE 'Using existing account: % (ID: %)', v_account_name, v_account_id;
    ELSE
      -- Create a default Tradovate account
      v_account_id := gen_random_uuid();
      v_account_name := 'Tradovate Account';
      
      INSERT INTO accounts (id, user_id, name, created_at)
      VALUES (v_account_id, p_user_id, v_account_name, NOW());
      
      RAISE NOTICE 'Created new account: % (ID: %)', v_account_name, v_account_id;
    END IF;
  END IF;
  
  -- Process each row in the batch
  FOR v_row IN SELECT jsonb_array_elements(p_rows)
  LOOP
    BEGIN
      -- Extract values from the row
      v_symbol := v_row->>'symbol';
      v_side := v_row->>'side';
      v_quantity := (v_row->>'quantity')::NUMERIC;
      v_timestamp := (v_row->>'timestamp')::TIMESTAMP;
      v_pnl := (v_row->>'pnl')::NUMERIC;
      v_commission := COALESCE((v_row->>'commission')::NUMERIC, 0);
      
      -- Handle different price field names
      IF v_row ? 'entry_price' THEN
        v_price := (v_row->>'entry_price')::NUMERIC;
      ELSIF v_row ? 'price' THEN
        v_price := (v_row->>'price')::NUMERIC;
      ELSE
        v_price := NULL;
      END IF;
      
      -- Insert the trade with flexible column handling
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
        commission,
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
        v_price, -- Use as fallback for both entry and exit
        v_timestamp,
        v_pnl,
        v_commission,
        NOW(),
        NOW(),
        COALESCE((v_row->>'entry_price')::NUMERIC, v_price),
        COALESCE((v_row->>'exit_price')::NUMERIC, v_price),
        COALESCE((v_row->>'entry_date')::TIMESTAMP, v_timestamp),
        COALESCE((v_row->>'exit_date')::TIMESTAMP, v_timestamp)
      );
      
      v_result := jsonb_build_object(
        'success', TRUE,
        'symbol', v_symbol,
        'side', v_side,
        'quantity', v_quantity,
        'price', v_price,
        'timestamp', v_timestamp,
        'pnl', v_pnl
      );
      
      v_success_count := v_success_count + 1;
    EXCEPTION WHEN OTHERS THEN
      v_error := SQLERRM;
      
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
GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(UUID, JSONB, UUID) TO authenticated;

-- PART 3: Create a fixed version of the process_topstepx_csv_batch function
-- First, drop existing versions of the function if they exist
DO $$
BEGIN
  -- Try to drop the function with all possible parameter combinations
  BEGIN
    DROP FUNCTION IF EXISTS process_topstepx_csv_batch(uuid, jsonb, uuid);
    RAISE NOTICE 'Dropped process_topstepx_csv_batch(uuid, jsonb, uuid)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_topstepx_csv_batch(uuid, jsonb, uuid): %', SQLERRM;
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS process_topstepx_csv_batch(uuid, uuid, jsonb);
    RAISE NOTICE 'Dropped process_topstepx_csv_batch(uuid, uuid, jsonb)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_topstepx_csv_batch(uuid, uuid, jsonb): %', SQLERRM;
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS process_topstepx_csv_batch(uuid, jsonb);
    RAISE NOTICE 'Dropped process_topstepx_csv_batch(uuid, jsonb)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_topstepx_csv_batch(uuid, jsonb): %', SQLERRM;
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS process_topstepx_csv_batch(uuid, jsonb, text);
    RAISE NOTICE 'Dropped process_topstepx_csv_batch(uuid, jsonb, text)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_topstepx_csv_batch(uuid, jsonb, text): %', SQLERRM;
  END;
END $$;

-- Now create the new function with flexible column handling
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
  v_price NUMERIC;
  v_timestamp TIMESTAMP;
  v_pnl NUMERIC;
  v_commission NUMERIC;
  v_account_exists BOOLEAN;
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
      
      RAISE NOTICE 'Using existing account: % (ID: %)', v_account_name, v_account_id;
    ELSE
      -- Create a default TopstepX account
      v_account_id := gen_random_uuid();
      v_account_name := 'TopstepX Account';
      
      INSERT INTO accounts (id, user_id, name, created_at)
      VALUES (v_account_id, p_user_id, v_account_name, NOW());
      
      RAISE NOTICE 'Created new account: % (ID: %)', v_account_name, v_account_id;
    END IF;
  END IF;
  
  -- Process each row in the batch
  FOR v_row IN SELECT jsonb_array_elements(p_rows)
  LOOP
    BEGIN
      -- Extract values from the row
      v_symbol := v_row->>'symbol';
      v_side := v_row->>'side';
      v_quantity := (v_row->>'quantity')::NUMERIC;
      v_timestamp := (v_row->>'timestamp')::TIMESTAMP;
      v_pnl := (v_row->>'pnl')::NUMERIC;
      v_commission := COALESCE((v_row->>'commission')::NUMERIC, 0);
      
      -- Handle different price field names
      IF v_row ? 'entry_price' THEN
        v_price := (v_row->>'entry_price')::NUMERIC;
      ELSIF v_row ? 'price' THEN
        v_price := (v_row->>'price')::NUMERIC;
      ELSE
        v_price := NULL;
      END IF;
      
      -- Insert the trade with flexible column handling
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
        commission,
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
        v_price, -- Use as fallback for both entry and exit
        v_timestamp,
        v_pnl,
        v_commission,
        NOW(),
        NOW(),
        COALESCE((v_row->>'entry_price')::NUMERIC, v_price),
        COALESCE((v_row->>'exit_price')::NUMERIC, v_price),
        COALESCE((v_row->>'entry_date')::TIMESTAMP, v_timestamp),
        COALESCE((v_row->>'exit_date')::TIMESTAMP, v_timestamp)
      );
      
      v_result := jsonb_build_object(
        'success', TRUE,
        'symbol', v_symbol,
        'side', v_side,
        'quantity', v_quantity,
        'price', v_price,
        'timestamp', v_timestamp,
        'pnl', v_pnl
      );
      
      v_success_count := v_success_count + 1;
    EXCEPTION WHEN OTHERS THEN
      v_error := SQLERRM;
      
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
GRANT EXECUTE ON FUNCTION process_topstepx_csv_batch(UUID, JSONB, UUID) TO authenticated;

-- PART 4: Refresh analytics for all users
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