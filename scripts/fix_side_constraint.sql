-- Script to check and fix the side constraint on the trades table

-- First, check the existing constraint
DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE 'Checking existing side constraints on trades table:';
  
  FOR r IN (
    SELECT con.conname, pg_get_constraintdef(con.oid) AS constraint_def
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE rel.relname = 'trades'
    AND nsp.nspname = 'public'
    AND con.conname LIKE '%side%'
  ) LOOP
    RAISE NOTICE 'Constraint: %, Definition: %', r.conname, r.constraint_def;
  END LOOP;
  
  -- Check the datatype of the side column
  FOR r IN (
    SELECT column_name, data_type, character_maximum_length, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'trades'
    AND table_schema = 'public'
    AND column_name = 'side'
  ) LOOP
    RAISE NOTICE 'Column: side, Type: %, Max Length: %, Nullable: %', 
      r.data_type, r.character_maximum_length, r.is_nullable;
  END LOOP;
  
  -- Show sample values of 'side' from existing trades
  FOR r IN (
    SELECT DISTINCT side, count(*) as count
    FROM trades
    GROUP BY side
    ORDER BY count DESC
    LIMIT 10
  ) LOOP
    RAISE NOTICE 'Existing value: %, Count: %', r.side, r.count;
  END LOOP;
END $$;

-- Fix the constraint by dropping and recreating it
DO $$
BEGIN
  -- First, try to alter the constraint to allow both 'long' and 'short' values
  BEGIN
    -- Identify the constraint name first
    DECLARE
      v_constraint_name TEXT;
    BEGIN
      SELECT con.conname INTO v_constraint_name
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE rel.relname = 'trades'
      AND nsp.nspname = 'public'
      AND con.conname LIKE '%side%'
      LIMIT 1;
      
      IF v_constraint_name IS NOT NULL THEN
        RAISE NOTICE 'Found constraint: %', v_constraint_name;
        
        -- Drop the existing constraint
        EXECUTE 'ALTER TABLE trades DROP CONSTRAINT ' || v_constraint_name;
        RAISE NOTICE 'Dropped constraint: %', v_constraint_name;
        
        -- Add a new constraint that accepts 'long', 'short', 'buy', and 'sell'
        EXECUTE 'ALTER TABLE trades ADD CONSTRAINT ' || v_constraint_name || 
                ' CHECK (side IN (''buy'', ''sell'', ''long'', ''short''))';
        RAISE NOTICE 'Added new constraint: %', v_constraint_name;
      ELSE
        RAISE NOTICE 'No side constraint found. Adding a new one.';
        EXECUTE 'ALTER TABLE trades ADD CONSTRAINT trades_side_check CHECK (side IN (''buy'', ''sell'', ''long'', ''short''))';
      END IF;
    END;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error updating constraint: %', SQLERRM;
  END;
END $$;

-- Drop all existing versions of process_tradovate_csv_batch_fixed function
DO $$
BEGIN
  -- Try to drop using all possible parameter combinations
  BEGIN
    DROP FUNCTION IF EXISTS process_tradovate_csv_batch_fixed(uuid, jsonb, uuid);
    RAISE NOTICE 'Dropped process_tradovate_csv_batch_fixed(uuid, jsonb, uuid)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_tradovate_csv_batch_fixed(uuid, jsonb, uuid): %', SQLERRM;
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS process_tradovate_csv_batch_fixed(uuid, uuid, jsonb);
    RAISE NOTICE 'Dropped process_tradovate_csv_batch_fixed(uuid, uuid, jsonb)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_tradovate_csv_batch_fixed(uuid, uuid, jsonb): %', SQLERRM;
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS process_tradovate_csv_batch_fixed(uuid, jsonb);
    RAISE NOTICE 'Dropped process_tradovate_csv_batch_fixed(uuid, jsonb)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_tradovate_csv_batch_fixed(uuid, jsonb): %', SQLERRM;
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS process_tradovate_csv_batch_fixed(uuid, jsonb, text);
    RAISE NOTICE 'Dropped process_tradovate_csv_batch_fixed(uuid, jsonb, text)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_tradovate_csv_batch_fixed(uuid, jsonb, text): %', SQLERRM;
  END;
END $$;

-- Drop all existing versions of process_tradovate_csv_batch function
DO $$
BEGIN
  -- Try to drop using all possible parameter combinations
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

-- Create the fixed version of process_tradovate_csv_batch directly (no need for separate fixed function)
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
  v_normalized_side TEXT;
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
      
      -- Normalize the side value to match the constraint
      IF v_side = 'long' OR v_side = 'buy' THEN
        v_normalized_side := 'buy';
      ELSIF v_side = 'short' OR v_side = 'sell' THEN
        v_normalized_side := 'sell';
      ELSE
        v_normalized_side := 'buy'; -- Default to buy if unknown
      END IF;
      
      v_quantity := (v_row->>'qty')::NUMERIC;  -- Note: Client uses 'qty' instead of 'quantity'
      v_date := (v_row->>'date')::DATE;        -- Note: Client uses 'date' instead of 'timestamp'
      v_timestamp := v_date::TIMESTAMP;
      v_pnl := (v_row->>'pnl')::NUMERIC;
      v_entry_price := (v_row->>'entry_price')::NUMERIC;
      v_exit_price := (v_row->>'exit_price')::NUMERIC;
      
      -- Insert the trade with the exact field mappings and normalized side
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
        v_normalized_side, -- Use normalized side to match constraint
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
        'side', v_normalized_side,
        'original_side', v_side,
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

-- Drop all existing versions of process_topstepx_csv_batch_fixed function
DO $$
BEGIN
  -- Try to drop using all possible parameter combinations
  BEGIN
    DROP FUNCTION IF EXISTS process_topstepx_csv_batch_fixed(uuid, jsonb, uuid);
    RAISE NOTICE 'Dropped process_topstepx_csv_batch_fixed(uuid, jsonb, uuid)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_topstepx_csv_batch_fixed(uuid, jsonb, uuid): %', SQLERRM;
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS process_topstepx_csv_batch_fixed(uuid, uuid, jsonb);
    RAISE NOTICE 'Dropped process_topstepx_csv_batch_fixed(uuid, uuid, jsonb)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_topstepx_csv_batch_fixed(uuid, uuid, jsonb): %', SQLERRM;
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS process_topstepx_csv_batch_fixed(uuid, jsonb);
    RAISE NOTICE 'Dropped process_topstepx_csv_batch_fixed(uuid, jsonb)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_topstepx_csv_batch_fixed(uuid, jsonb): %', SQLERRM;
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS process_topstepx_csv_batch_fixed(uuid, jsonb, text);
    RAISE NOTICE 'Dropped process_topstepx_csv_batch_fixed(uuid, jsonb, text)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_topstepx_csv_batch_fixed(uuid, jsonb, text): %', SQLERRM;
  END;
END $$;

-- Drop all existing versions of process_topstepx_csv_batch function
DO $$
BEGIN
  -- Try to drop using all possible parameter combinations
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

-- Create the fixed version of the TopstepX function directly
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
  v_normalized_side TEXT;
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
      
      -- Normalize the side value to match the constraint
      IF v_side = 'long' OR v_side = 'buy' THEN
        v_normalized_side := 'buy';
      ELSIF v_side = 'short' OR v_side = 'sell' THEN
        v_normalized_side := 'sell';
      ELSE
        v_normalized_side := 'buy'; -- Default to buy if unknown
      END IF;
      
      v_quantity := (v_row->>'qty')::NUMERIC;  -- Note: Client uses 'qty' instead of 'quantity'
      v_date := (v_row->>'date')::DATE;        -- Note: Client uses 'date' instead of 'timestamp'
      v_timestamp := v_date::TIMESTAMP;
      v_pnl := (v_row->>'pnl')::NUMERIC;
      v_entry_price := (v_row->>'entry_price')::NUMERIC;
      v_exit_price := (v_row->>'exit_price')::NUMERIC;
      
      -- Insert the trade with the exact field mappings and normalized side
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
        v_normalized_side, -- Use normalized side to match constraint
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
        'side', v_normalized_side,
        'original_side', v_side,
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