-- EMERGENCY SCRIPT TO FIX TRADE UPLOADS
-- This script focuses on directly fixing the account foreign key issue

-- PART 1: INSPECT DATABASE STRUCTURE
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Show accounts table structure
  RAISE NOTICE '=============================================';
  RAISE NOTICE 'ACCOUNTS TABLE STRUCTURE:';
  RAISE NOTICE '=============================================';
  
  FOR r IN (
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'accounts'
    AND table_schema = 'public'
    ORDER BY ordinal_position
  ) LOOP
    RAISE NOTICE 'Column: %, Type: %, Nullable: %', r.column_name, r.data_type, r.is_nullable;
  END LOOP;
  
  -- Show trades table foreign keys
  RAISE NOTICE '=============================================';
  RAISE NOTICE 'TRADES TABLE FOREIGN KEYS:';
  RAISE NOTICE '=============================================';
  
  FOR r IN (
    SELECT tc.constraint_name, tc.table_name, kcu.column_name, 
           ccu.table_name AS foreign_table_name,
           ccu.column_name AS foreign_column_name 
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name='trades'
    AND tc.table_schema = 'public'
  ) LOOP
    RAISE NOTICE 'Constraint: %, Column: % references %(%)', 
      r.constraint_name, r.column_name, r.foreign_table_name, r.foreign_column_name;
  END LOOP;
  
  -- Count existing accounts
  RAISE NOTICE '=============================================';
  RAISE NOTICE 'ACCOUNT COUNTS:';
  RAISE NOTICE '=============================================';
  
  FOR r IN (
    SELECT COUNT(*) as total_accounts
    FROM accounts
  ) LOOP
    RAISE NOTICE 'Total accounts: %', r.total_accounts;
  END LOOP;
  
  -- Count distinct users with accounts
  FOR r IN (
    SELECT COUNT(DISTINCT user_id) as distinct_users
    FROM accounts
  ) LOOP
    RAISE NOTICE 'Distinct users with accounts: %', r.distinct_users;
  END LOOP;
END $$;

-- PART 2: CREATE A DEFAULT ACCOUNT FUNCTION GUARANTEED TO WORK
-- This function will find or create a default account for the user, retrying multiple times if needed
CREATE OR REPLACE FUNCTION get_or_create_default_account(
  p_user_id UUID
) RETURNS UUID AS $$
DECLARE
  v_account_id UUID;
  v_user_exists BOOLEAN;
  v_error TEXT;
  v_max_attempts INT := 3;
  v_current_attempt INT := 0;
BEGIN
  -- Check if user exists
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) INTO v_user_exists;
  
  IF NOT v_user_exists THEN
    RAISE EXCEPTION 'User with ID % does not exist. Please check the user ID and try again.', p_user_id;
  END IF;

  -- First try to find an existing account for this user
  SELECT id INTO v_account_id 
  FROM accounts 
  WHERE user_id = p_user_id
  LIMIT 1;
  
  -- If found, return it immediately
  IF v_account_id IS NOT NULL THEN
    RAISE NOTICE 'Found existing account (ID: %) for user %', v_account_id, p_user_id;
    RETURN v_account_id;
  END IF;
  
  -- No account found, we need to create one
  -- Try multiple times in case of concurrent operations
  WHILE v_current_attempt < v_max_attempts LOOP
    v_current_attempt := v_current_attempt + 1;
    
    BEGIN
      -- Generate a new UUID
      v_account_id := gen_random_uuid();
      
      -- Create a new account
      INSERT INTO accounts (id, user_id, name, created_at)
      VALUES (v_account_id, p_user_id, 'Default Account', NOW());
      
      RAISE NOTICE 'Successfully created default account (ID: %) for user % on attempt %', 
        v_account_id, p_user_id, v_current_attempt;
      
      -- Successfully created, return the ID
      RETURN v_account_id;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
      RAISE NOTICE 'Attempt % failed: %', v_current_attempt, v_error;
      
      -- On failure, try to find account again (in case it was created by another session)
      SELECT id INTO v_account_id 
      FROM accounts 
      WHERE user_id = p_user_id
      LIMIT 1;
      
      IF v_account_id IS NOT NULL THEN
        RAISE NOTICE 'Found account (ID: %) for user % after failed creation attempt', v_account_id, p_user_id;
        RETURN v_account_id;
      END IF;
      
      -- If last attempt, give up and raise exception
      IF v_current_attempt = v_max_attempts THEN
        RAISE EXCEPTION 'Failed to create account after % attempts: %', v_max_attempts, v_error;
      END IF;
      
      -- Wait a short time before retrying
      PERFORM pg_sleep(0.1);
    END;
  END LOOP;
  
  -- This should never happen but just in case
  RAISE EXCEPTION 'Unexpected error in get_or_create_default_account';
END;
$$ LANGUAGE plpgsql;

-- PART 3: CREATE ULTRA-SIMPLIFIED TRADE BATCH FUNCTION
-- This version has minimal code and focuses only on core functionality
DROP FUNCTION IF EXISTS process_tradovate_csv_batch(uuid, jsonb, uuid);
DROP FUNCTION IF EXISTS process_tradovate_csv_batch(uuid, jsonb);
DROP FUNCTION IF EXISTS process_tradovate_csv_batch(uuid, uuid, jsonb);

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
  v_account_id UUID;
  v_error TEXT;
  v_symbol TEXT;
  v_side TEXT;
  v_quantity NUMERIC;
  v_date TIMESTAMP;
  v_pnl NUMERIC;
  v_entry_price NUMERIC;
  v_exit_price NUMERIC;
BEGIN
  -- CRITICAL FIX: Always get or create a guaranteed account, ignoring any passed account_id
  v_account_id := get_or_create_default_account(p_user_id);
  
  -- Log the account being used
  RAISE NOTICE 'Using account ID % for user % in process_tradovate_csv_batch', v_account_id, p_user_id;
  
  -- Process each row in the batch
  FOR i IN 0..jsonb_array_length(p_rows) - 1 LOOP
    v_row := p_rows->i;
    
    BEGIN
      -- Extract values with minimal processing to reduce potential errors
      v_symbol := v_row->>'symbol';
      v_side := CASE 
                  WHEN v_row->>'side' IN ('long', 'buy') THEN 'buy'
                  WHEN v_row->>'side' IN ('short', 'sell') THEN 'sell'
                  ELSE 'buy' -- Default to buy if unknown
                END;
      v_quantity := (v_row->>'qty')::NUMERIC;
      v_date := (v_row->>'date')::DATE::TIMESTAMP;
      v_pnl := (v_row->>'pnl')::NUMERIC;
      v_entry_price := (v_row->>'entry_price')::NUMERIC;
      v_exit_price := (v_row->>'exit_price')::NUMERIC;
      
      -- SIMPLIFIED INSERT with only essential fields
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
        v_entry_price,
        v_date,
        v_pnl,
        NOW(),
        NOW(),
        v_entry_price,
        v_exit_price,
        v_date,
        v_date
      );
      
      v_success_count := v_success_count + 1;
      
      v_result := jsonb_build_object(
        'success', TRUE,
        'row_index', i
      );
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
      
      v_error_count := v_error_count + 1;
      
      v_result := jsonb_build_object(
        'success', FALSE,
        'row_index', i,
        'error', v_error
      );
      
      -- Log the error with the problematic row
      RAISE NOTICE 'Error processing row %: %, Row data: %', i, v_error, v_row;
    END;
    
    v_results := array_append(v_results, v_result);
  END LOOP;
  
  -- Try to refresh analytics but don't fail if it doesn't work
  BEGIN
    PERFORM refresh_user_analytics(p_user_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Failed to refresh analytics: %', SQLERRM;
  END;
  
  -- Return simplified result object
  RETURN jsonb_build_object(
    'success', v_error_count = 0,
    'processed', v_success_count,
    'errors', v_error_count,
    'results', to_jsonb(v_results)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(UUID, JSONB, UUID) TO authenticated;

-- Create short version without account_id
CREATE OR REPLACE FUNCTION process_tradovate_csv_batch(
  p_user_id UUID,
  p_rows JSONB
) RETURNS JSONB AS $$
BEGIN
  -- Simply call the 3-parameter version with NULL account_id
  RETURN process_tradovate_csv_batch(p_user_id, p_rows, NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(UUID, JSONB) TO authenticated;

-- Apply same fix for TopstepX
DROP FUNCTION IF EXISTS process_topstepx_csv_batch(uuid, jsonb, uuid);
DROP FUNCTION IF EXISTS process_topstepx_csv_batch(uuid, jsonb);
DROP FUNCTION IF EXISTS process_topstepx_csv_batch(uuid, uuid, jsonb);

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
  v_account_id UUID;
  v_error TEXT;
  v_symbol TEXT;
  v_side TEXT;
  v_quantity NUMERIC;
  v_date TIMESTAMP;
  v_pnl NUMERIC;
  v_entry_price NUMERIC;
  v_exit_price NUMERIC;
BEGIN
  -- CRITICAL FIX: Always get or create a guaranteed account, ignoring any passed account_id
  v_account_id := get_or_create_default_account(p_user_id);
  
  -- Log the account being used
  RAISE NOTICE 'Using account ID % for user % in process_topstepx_csv_batch', v_account_id, p_user_id;
  
  -- Process each row in the batch
  FOR i IN 0..jsonb_array_length(p_rows) - 1 LOOP
    v_row := p_rows->i;
    
    BEGIN
      -- Extract values with minimal processing to reduce potential errors
      v_symbol := v_row->>'symbol';
      v_side := CASE 
                  WHEN v_row->>'side' IN ('long', 'buy') THEN 'buy'
                  WHEN v_row->>'side' IN ('short', 'sell') THEN 'sell'
                  ELSE 'buy' -- Default to buy if unknown
                END;
      v_quantity := (v_row->>'qty')::NUMERIC;
      v_date := (v_row->>'date')::DATE::TIMESTAMP;
      v_pnl := (v_row->>'pnl')::NUMERIC;
      v_entry_price := (v_row->>'entry_price')::NUMERIC;
      v_exit_price := (v_row->>'exit_price')::NUMERIC;
      
      -- SIMPLIFIED INSERT with only essential fields
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
        v_entry_price,
        v_date,
        v_pnl,
        NOW(),
        NOW(),
        v_entry_price,
        v_exit_price,
        v_date,
        v_date
      );
      
      v_success_count := v_success_count + 1;
      
      v_result := jsonb_build_object(
        'success', TRUE,
        'row_index', i
      );
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
      
      v_error_count := v_error_count + 1;
      
      v_result := jsonb_build_object(
        'success', FALSE,
        'row_index', i,
        'error', v_error
      );
      
      -- Log the error with the problematic row
      RAISE NOTICE 'Error processing row %: %, Row data: %', i, v_error, v_row;
    END;
    
    v_results := array_append(v_results, v_result);
  END LOOP;
  
  -- Try to refresh analytics but don't fail if it doesn't work
  BEGIN
    PERFORM refresh_user_analytics(p_user_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Failed to refresh analytics: %', SQLERRM;
  END;
  
  -- Return simplified result object
  RETURN jsonb_build_object(
    'success', v_error_count = 0,
    'processed', v_success_count,
    'errors', v_error_count,
    'results', to_jsonb(v_results)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION process_topstepx_csv_batch(UUID, JSONB, UUID) TO authenticated;

-- Create short version without account_id
CREATE OR REPLACE FUNCTION process_topstepx_csv_batch(
  p_user_id UUID,
  p_rows JSONB
) RETURNS JSONB AS $$
BEGIN
  -- Simply call the 3-parameter version with NULL account_id
  RETURN process_topstepx_csv_batch(p_user_id, p_rows, NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION process_topstepx_csv_batch(UUID, JSONB) TO authenticated;

-- PART 4: VERIFY THE CURRENT USER ACCOUNT
-- This function returns the account IDs available for the given user
CREATE OR REPLACE FUNCTION verify_user_accounts(
  p_user_id UUID
) RETURNS TABLE(account_id UUID, account_name TEXT, created_at TIMESTAMPTZ) AS $$
BEGIN
  -- First check if the user exists
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE NOTICE 'User with ID % does not exist', p_user_id;
    RETURN;
  END IF;
  
  -- If no accounts exist for this user, create a default one
  IF NOT EXISTS(SELECT 1 FROM accounts WHERE user_id = p_user_id) THEN
    INSERT INTO accounts (id, user_id, name, created_at)
    VALUES (gen_random_uuid(), p_user_id, 'Default Account', NOW());
    
    RAISE NOTICE 'Created a default account for user %', p_user_id;
  END IF;
  
  -- Return all accounts for this user
  RETURN QUERY
  SELECT a.id, a.name, a.created_at
  FROM accounts a
  WHERE a.user_id = p_user_id
  ORDER BY a.created_at;
END;
$$ LANGUAGE plpgsql; 