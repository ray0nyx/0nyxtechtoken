-- DIRECT UPLOAD FIX
-- Ensures trades can be processed without requiring an account ID

-------------------------------------------------------
-- PART 1: MODIFY TRADOVATE PROCESSOR FUNCTION
-------------------------------------------------------

-- Drop the function if it exists
DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, JSONB, UUID);

-- Recreate with improved account handling
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
  -- If account_id is NULL, find or create a default account
  IF p_account_id IS NULL THEN
    -- Try to find an existing account for this user
    SELECT id INTO v_account_id
    FROM trading_accounts
    WHERE user_id = p_user_id
    LIMIT 1;
    
    -- If no account exists, create one
    IF v_account_id IS NULL THEN
      v_account_id := gen_random_uuid();
      
      INSERT INTO trading_accounts (id, user_id, name, created_at)
      VALUES (v_account_id, p_user_id, 'Default Trading Account', NOW());
      
      RAISE NOTICE 'Created new account ID % for user %', v_account_id, p_user_id;
    ELSE
      RAISE NOTICE 'Using existing account ID % for user %', v_account_id, p_user_id;
    END IF;
  ELSE
    v_account_id := p_account_id;
  END IF;
  
  -- Process each row in the batch
  FOR i IN 0..jsonb_array_length(p_rows) - 1 LOOP
    v_row := p_rows->i;
    
    BEGIN
      -- Extract and validate required fields
      v_symbol := COALESCE(v_row->>'symbol', 'UNKNOWN');
      v_side := CASE 
                  WHEN v_row->>'side' IN ('long', 'buy') THEN 'buy'
                  WHEN v_row->>'side' IN ('short', 'sell') THEN 'sell'
                  ELSE 'buy' -- Default to buy if unknown
                END;
      v_quantity := COALESCE((v_row->>'qty')::NUMERIC, 1);
      v_date := COALESCE((v_row->>'date')::DATE::TIMESTAMP, NOW());
      v_pnl := COALESCE((v_row->>'pnl')::NUMERIC, 0);
      v_entry_price := COALESCE((v_row->>'entry_price')::NUMERIC, 0);
      v_exit_price := COALESCE((v_row->>'exit_price')::NUMERIC, 0);
      
      -- Insert with the validated account ID
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
        'row_index', i,
        'account_id', v_account_id
      );
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
      
      v_error_count := v_error_count + 1;
      
      v_result := jsonb_build_object(
        'success', FALSE,
        'row_index', i,
        'error', v_error,
        'account_id_used', v_account_id
      );
    END;
    
    v_results := array_append(v_results, v_result);
  END LOOP;
  
  -- Return detailed result
  RETURN jsonb_build_object(
    'success', v_error_count = 0,
    'processed', v_success_count,
    'errors', v_error_count,
    'account_id', v_account_id,
    'user_id', p_user_id,
    'results', to_jsonb(v_results)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(UUID, JSONB, UUID) TO authenticated;

-------------------------------------------------------
-- PART 2: MODIFY TOPSTEPX PROCESSOR FUNCTION
-------------------------------------------------------

-- Drop the function if it exists
DROP FUNCTION IF EXISTS process_topstepx_csv_batch(UUID, JSONB, UUID);

-- Recreate with improved account handling
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
  -- If account_id is NULL, find or create a default account
  IF p_account_id IS NULL THEN
    -- Try to find an existing account for this user
    SELECT id INTO v_account_id
    FROM trading_accounts
    WHERE user_id = p_user_id
    LIMIT 1;
    
    -- If no account exists, create one
    IF v_account_id IS NULL THEN
      v_account_id := gen_random_uuid();
      
      INSERT INTO trading_accounts (id, user_id, name, created_at)
      VALUES (v_account_id, p_user_id, 'Default Trading Account', NOW());
      
      RAISE NOTICE 'Created new account ID % for user %', v_account_id, p_user_id;
    ELSE
      RAISE NOTICE 'Using existing account ID % for user %', v_account_id, p_user_id;
    END IF;
  ELSE
    v_account_id := p_account_id;
  END IF;
  
  -- Process each row in the batch
  FOR i IN 0..jsonb_array_length(p_rows) - 1 LOOP
    v_row := p_rows->i;
    
    BEGIN
      -- Extract and validate required fields
      v_symbol := COALESCE(v_row->>'symbol', 'UNKNOWN');
      v_side := CASE 
                  WHEN v_row->>'side' IN ('long', 'buy') THEN 'buy'
                  WHEN v_row->>'side' IN ('short', 'sell') THEN 'sell'
                  ELSE 'buy' -- Default to buy if unknown
                END;
      v_quantity := COALESCE((v_row->>'qty')::NUMERIC, 1);
      v_date := COALESCE((v_row->>'date')::DATE::TIMESTAMP, NOW());
      v_pnl := COALESCE((v_row->>'pnl')::NUMERIC, 0);
      v_entry_price := COALESCE((v_row->>'entry_price')::NUMERIC, 0);
      v_exit_price := COALESCE((v_row->>'exit_price')::NUMERIC, 0);
      
      -- Insert with the validated account ID
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
        'row_index', i,
        'account_id', v_account_id
      );
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
      
      v_error_count := v_error_count + 1;
      
      v_result := jsonb_build_object(
        'success', FALSE,
        'row_index', i,
        'error', v_error,
        'account_id_used', v_account_id
      );
    END;
    
    v_results := array_append(v_results, v_result);
  END LOOP;
  
  -- Return detailed result
  RETURN jsonb_build_object(
    'success', v_error_count = 0,
    'processed', v_success_count,
    'errors', v_error_count,
    'account_id', v_account_id,
    'user_id', p_user_id,
    'results', to_jsonb(v_results)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION process_topstepx_csv_batch(UUID, JSONB, UUID) TO authenticated;

-------------------------------------------------------
-- PART 3: CREATE CLIENT-SIDE HELPER RPC FUNCTION
-------------------------------------------------------

-- Create a function to validate trades have proper account IDs
CREATE OR REPLACE FUNCTION validate_trade_accounts()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_account_id UUID;
  v_null_account_count INTEGER;
  v_fixed_count INTEGER := 0;
  v_error TEXT;
BEGIN
  -- Get the current user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Not authenticated',
      'fixed_count', 0
    );
  END IF;
  
  -- Count trades with NULL account_id for this user
  SELECT COUNT(*) INTO v_null_account_count
  FROM trades
  WHERE user_id = v_user_id AND account_id IS NULL;
  
  -- If no NULL account_id trades, return success
  IF v_null_account_count = 0 THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'message', 'All trades have valid account IDs',
      'fixed_count', 0
    );
  END IF;
  
  -- Try to find an existing trading account for this user
  SELECT id INTO v_account_id
  FROM trading_accounts
  WHERE user_id = v_user_id
  LIMIT 1;
  
  -- If no trading account exists, create one
  IF v_account_id IS NULL THEN
    v_account_id := gen_random_uuid();
    
    BEGIN
      INSERT INTO trading_accounts (id, user_id, name, created_at)
      VALUES (v_account_id, v_user_id, 'Default Trading Account', NOW());
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
      
      RETURN jsonb_build_object(
        'success', FALSE,
        'error', v_error,
        'fixed_count', 0
      );
    END;
  END IF;
  
  -- Update trades with NULL account_id for this user
  BEGIN
    UPDATE trades
    SET account_id = v_account_id,
        updated_at = NOW()
    WHERE user_id = v_user_id AND account_id IS NULL;
    
    GET DIAGNOSTICS v_fixed_count = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', v_error,
      'fixed_count', 0
    );
  END;
  
  -- Return success result
  RETURN jsonb_build_object(
    'success', TRUE,
    'message', 'Fixed trades with NULL account_id',
    'fixed_count', v_fixed_count,
    'account_id', v_account_id
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION validate_trade_accounts() TO authenticated; 