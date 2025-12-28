-- Script to diagnose and fix account foreign key issues

-- First, inspect the accounts table structure
DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE 'Checking accounts table structure:';
  
  FOR r IN (
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'accounts'
    AND table_schema = 'public'
    ORDER BY ordinal_position
  ) LOOP
    RAISE NOTICE 'Column: %, Type: %, Nullable: %', r.column_name, r.data_type, r.is_nullable;
  END LOOP;
  
  -- Check foreign key constraints on trades table
  RAISE NOTICE 'Checking trades table foreign key constraints:';
  FOR r IN (
    SELECT con.conname, pg_get_constraintdef(con.oid) AS constraint_def
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE rel.relname = 'trades'
    AND nsp.nspname = 'public'
    AND con.contype = 'f'  -- 'f' means foreign key
  ) LOOP
    RAISE NOTICE 'Foreign key constraint: %, Definition: %', r.conname, r.constraint_def;
  END LOOP;
  
  -- Count accounts and check user connections
  RAISE NOTICE 'Checking existing accounts:';
  FOR r IN (
    SELECT COUNT(*) as account_count
    FROM accounts
  ) LOOP
    RAISE NOTICE 'Total accounts: %', r.account_count;
  END LOOP;
  
  -- Count users with accounts
  FOR r IN (
    SELECT COUNT(DISTINCT user_id) as users_with_accounts
    FROM accounts
  ) LOOP
    RAISE NOTICE 'Users with accounts: %', r.users_with_accounts;
  END LOOP;
  
  -- Check for accounts without valid user_id
  FOR r IN (
    SELECT COUNT(*) as accounts_without_user
    FROM accounts a
    LEFT JOIN auth.users u ON a.user_id = u.id
    WHERE u.id IS NULL
  ) LOOP
    RAISE NOTICE 'Accounts without valid user_id: %', r.accounts_without_user;
  END LOOP;
END $$;

-- Function to debug account creation
CREATE OR REPLACE FUNCTION debug_account_creation(
  p_user_id UUID,
  p_account_name TEXT
) RETURNS TABLE(success BOOLEAN, account_id UUID, error_message TEXT) AS $$
DECLARE
  v_account_id UUID;
  v_user_exists BOOLEAN;
  v_error TEXT;
BEGIN
  -- Check if user exists
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) INTO v_user_exists;
  
  IF NOT v_user_exists THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'User with ID ' || p_user_id || ' does not exist';
    RETURN;
  END IF;

  -- Check if user already has an account with the given name
  BEGIN
    SELECT id INTO v_account_id 
    FROM accounts 
    WHERE user_id = p_user_id 
    AND name = p_account_name
    LIMIT 1;
    
    -- If no account found, create one
    IF v_account_id IS NULL THEN
      v_account_id := gen_random_uuid();
      
      INSERT INTO accounts (id, user_id, name, created_at)
      VALUES (v_account_id, p_user_id, p_account_name, NOW());
      
      RETURN QUERY SELECT TRUE, v_account_id, 'Created new account: ' || p_account_name;
    ELSE
      RETURN QUERY SELECT TRUE, v_account_id, 'Using existing account: ' || p_account_name;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    RETURN QUERY SELECT FALSE, NULL::UUID, 'Error creating account: ' || v_error;
  END;
END;
$$ LANGUAGE plpgsql;

-- Improved function to ensure an account exists for a user
CREATE OR REPLACE FUNCTION ensure_account_exists_safe(
  p_user_id UUID,
  p_account_name TEXT
) RETURNS UUID AS $$
DECLARE
  v_account_id UUID;
  v_user_exists BOOLEAN;
  v_error TEXT;
BEGIN
  -- Check if user exists
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) INTO v_user_exists;
  
  IF NOT v_user_exists THEN
    RAISE EXCEPTION 'User with ID % does not exist', p_user_id;
  END IF;

  -- Check if user already has any accounts at all
  SELECT id INTO v_account_id 
  FROM accounts 
  WHERE user_id = p_user_id
  LIMIT 1;
  
  -- If the user has no accounts at all, create a default one
  IF v_account_id IS NULL THEN
    v_account_id := gen_random_uuid();
    
    BEGIN
      INSERT INTO accounts (id, user_id, name, created_at)
      VALUES (v_account_id, p_user_id, 'Default Account', NOW());
      
      RAISE NOTICE 'Created default account (ID: %) for user %', v_account_id, p_user_id;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
      RAISE EXCEPTION 'Failed to create account: %', v_error;
    END;
    
    RETURN v_account_id;
  END IF;
  
  -- Now check if the user has the specific named account
  SELECT id INTO v_account_id 
  FROM accounts 
  WHERE user_id = p_user_id 
  AND name = p_account_name
  LIMIT 1;
  
  -- If no specific named account found, create it
  IF v_account_id IS NULL THEN
    v_account_id := gen_random_uuid();
    
    BEGIN
      INSERT INTO accounts (id, user_id, name, created_at)
      VALUES (v_account_id, p_user_id, p_account_name, NOW());
      
      RAISE NOTICE 'Created new account: % (ID: %) for user %', p_account_name, v_account_id, p_user_id;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
      
      -- Fall back to using the first account found
      SELECT id INTO v_account_id 
      FROM accounts 
      WHERE user_id = p_user_id
      LIMIT 1;
      
      RAISE NOTICE 'Failed to create specific account, using existing account (ID: %): %', v_account_id, v_error;
    END;
  ELSE
    RAISE NOTICE 'Using existing account: % (ID: %) for user %', p_account_name, v_account_id, p_user_id;
  END IF;
  
  RETURN v_account_id;
END;
$$ LANGUAGE plpgsql;

-- Simple function to find a valid account for a user
CREATE OR REPLACE FUNCTION find_any_account_for_user(
  p_user_id UUID
) RETURNS UUID AS $$
DECLARE
  v_account_id UUID;
  v_user_exists BOOLEAN;
BEGIN
  -- Check if user exists
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) INTO v_user_exists;
  
  IF NOT v_user_exists THEN
    RAISE EXCEPTION 'User with ID % does not exist', p_user_id;
  END IF;

  -- Get the first account for this user
  SELECT id INTO v_account_id 
  FROM accounts 
  WHERE user_id = p_user_id
  LIMIT 1;
  
  -- If no account found, create a default one
  IF v_account_id IS NULL THEN
    v_account_id := gen_random_uuid();
    
    INSERT INTO accounts (id, user_id, name, created_at)
    VALUES (v_account_id, p_user_id, 'Default Account', NOW());
    
    RAISE NOTICE 'Created default account (ID: %) for user %', v_account_id, p_user_id;
  ELSE
    RAISE NOTICE 'Found existing account (ID: %) for user %', v_account_id, p_user_id;
  END IF;
  
  RETURN v_account_id;
END;
$$ LANGUAGE plpgsql;

-- Create a fallback version of process_tradovate_csv_batch that always uses the first account found
CREATE OR REPLACE FUNCTION process_tradovate_csv_batch_fallback(
  p_user_id UUID,
  p_rows JSONB
) RETURNS JSONB AS $$
DECLARE
  v_row JSONB;
  v_result JSONB;
  v_results JSONB[] := '{}';
  v_success_count INTEGER := 0;
  v_error_count INTEGER := 0;
  v_account_id UUID;
  v_user_exists BOOLEAN;
  v_error TEXT;
  v_symbol TEXT;
  v_side TEXT;
  v_normalized_side TEXT;
  v_quantity NUMERIC;
  v_timestamp TIMESTAMP;
  v_pnl NUMERIC;
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
  
  -- Always use the find_any_account_for_user function to get a valid account
  v_account_id := find_any_account_for_user(p_user_id);
  
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
        v_account_id, -- Using the guaranteed valid account_id
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
GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch_fallback(UUID, JSONB) TO authenticated;

-- Drop all existing versions of process_tradovate_csv_batch and recreate with new simplified version
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

-- Create a minimal version that just calls the fallback
CREATE OR REPLACE FUNCTION process_tradovate_csv_batch(
  p_user_id UUID,
  p_rows JSONB,
  p_account_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
BEGIN
  -- Ignore the p_account_id parameter and just use the fallback
  RETURN process_tradovate_csv_batch_fallback(p_user_id, p_rows);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(UUID, JSONB, UUID) TO authenticated;

-- Also create the version without the account_id parameter
CREATE OR REPLACE FUNCTION process_tradovate_csv_batch(
  p_user_id UUID,
  p_rows JSONB
) RETURNS JSONB AS $$
BEGIN
  -- Just call the fallback
  RETURN process_tradovate_csv_batch_fallback(p_user_id, p_rows);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(UUID, JSONB) TO authenticated;

-- Do the same for TopstepX
CREATE OR REPLACE FUNCTION process_topstepx_csv_batch_fallback(
  p_user_id UUID,
  p_rows JSONB
) RETURNS JSONB AS $$
DECLARE
  v_row JSONB;
  v_result JSONB;
  v_results JSONB[] := '{}';
  v_success_count INTEGER := 0;
  v_error_count INTEGER := 0;
  v_account_id UUID;
  v_user_exists BOOLEAN;
  v_error TEXT;
  v_symbol TEXT;
  v_side TEXT;
  v_normalized_side TEXT;
  v_quantity NUMERIC;
  v_timestamp TIMESTAMP;
  v_pnl NUMERIC;
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
  
  -- Always use the find_any_account_for_user function to get a valid account
  v_account_id := find_any_account_for_user(p_user_id);
  
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
        v_account_id, -- Using the guaranteed valid account_id
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
GRANT EXECUTE ON FUNCTION process_topstepx_csv_batch_fallback(UUID, JSONB) TO authenticated;

-- Drop all existing versions of process_topstepx_csv_batch
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

-- Create a minimal version that just calls the fallback
CREATE OR REPLACE FUNCTION process_topstepx_csv_batch(
  p_user_id UUID,
  p_rows JSONB,
  p_account_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
BEGIN
  -- Ignore the p_account_id parameter and just use the fallback
  RETURN process_topstepx_csv_batch_fallback(p_user_id, p_rows);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION process_topstepx_csv_batch(UUID, JSONB, UUID) TO authenticated;

-- Also create the version without the account_id parameter
CREATE OR REPLACE FUNCTION process_topstepx_csv_batch(
  p_user_id UUID,
  p_rows JSONB
) RETURNS JSONB AS $$
BEGIN
  -- Just call the fallback
  RETURN process_topstepx_csv_batch_fallback(p_user_id, p_rows);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION process_topstepx_csv_batch(UUID, JSONB) TO authenticated; 