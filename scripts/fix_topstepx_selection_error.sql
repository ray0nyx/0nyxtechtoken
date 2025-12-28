-- DIRECT FIX FOR "PLEASE SELECT AN ACCOUNT" ERROR IN TOPSTEPX UPLOADS
-- Run this script directly in the Supabase SQL Editor to fix the issue

-- PART 1: Drop all existing versions of the function
DO $$
BEGIN
  -- Try to drop all possible versions of the function with different parameter orders
  BEGIN
    DROP FUNCTION IF EXISTS process_topstepx_csv_batch(jsonb);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_topstepx_csv_batch(jsonb): %', SQLERRM;
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS process_topstepx_csv_batch(uuid, jsonb);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_topstepx_csv_batch(uuid, jsonb): %', SQLERRM;
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS process_topstepx_csv_batch(uuid, jsonb, uuid);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_topstepx_csv_batch(uuid, jsonb, uuid): %', SQLERRM;
  END;
END $$;

-- PART 2: Create a helper function to find or create an account
CREATE OR REPLACE FUNCTION ensure_account_exists(
  p_user_id UUID,
  p_account_name TEXT DEFAULT 'TopstepX Account'
) RETURNS UUID AS $$
DECLARE
  v_account_id UUID;
BEGIN
  -- Check if user already has an account
  SELECT id INTO v_account_id
  FROM accounts
  WHERE user_id = p_user_id
  AND (name LIKE '%TopstepX%' OR platform = 'topstepx')
  LIMIT 1;
  
  -- If no account found, create one
  IF v_account_id IS NULL THEN
    INSERT INTO accounts (
      user_id,
      name,
      platform,
      balance,
      created_at,
      updated_at
    ) VALUES (
      p_user_id,
      p_account_name,
      'topstepx',
      0,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_account_id;
    
    RAISE NOTICE 'Created new TopstepX account % for user %', v_account_id, p_user_id;
  END IF;
  
  RETURN v_account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PART 3: Create the fixed process_topstepx_csv_batch function
CREATE OR REPLACE FUNCTION process_topstepx_csv_batch(
  p_user_id UUID,
  p_rows JSONB,
  p_account_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_row JSONB;
  v_success_count INTEGER := 0;
  v_error_count INTEGER := 0;
  v_results JSONB[] := '{}';
  v_account_id UUID := p_account_id;
  v_account_exists BOOLEAN;
  v_user_exists BOOLEAN;
  v_trade_id UUID;
  v_error TEXT;
  v_debug TEXT;
  
  -- Fields for each trade
  v_symbol TEXT;
  v_side TEXT;
  v_quantity NUMERIC;
  v_entry_price NUMERIC;
  v_exit_price NUMERIC;
  v_pnl NUMERIC;
  v_entry_date TIMESTAMP;
  v_exit_date TIMESTAMP;
  v_fees NUMERIC;
  v_date DATE;
BEGIN
  -- Check if user exists
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) INTO v_user_exists;
  
  IF NOT v_user_exists THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'processed', 0,
      'errors', 1,
      'message', 'User does not exist'
    );
  END IF;
  
  -- Debug info for account_id
  v_debug := 'Initial account_id: ' || COALESCE(v_account_id::TEXT, 'NULL');
  RAISE NOTICE '%', v_debug;
  
  -- IMPORTANT: Find or create account if none provided
  IF v_account_id IS NULL THEN
    SELECT ensure_account_exists(p_user_id, 'TopstepX Account') INTO v_account_id;
    
    -- Debug info after account creation
    v_debug := 'Created/Found account: ' || COALESCE(v_account_id::TEXT, 'NULL');
    RAISE NOTICE '%', v_debug;
  ELSE
    -- Verify that the account actually exists and belongs to this user
    SELECT EXISTS(
      SELECT 1 FROM accounts 
      WHERE id = v_account_id 
      AND user_id = p_user_id
    ) INTO v_account_exists;
    
    IF NOT v_account_exists THEN
      -- Don't use the provided account ID if it doesn't exist or belong to the user
      SELECT ensure_account_exists(p_user_id, 'TopstepX Account') INTO v_account_id;
      
      -- Debug info after account verification
      v_debug := 'Replaced invalid account with: ' || COALESCE(v_account_id::TEXT, 'NULL');
      RAISE NOTICE '%', v_debug;
    END IF;
  END IF;
  
  -- Verify we have a valid account at this point
  IF v_account_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'processed', 0,
      'errors', 1,
      'message', 'Failed to create or find a valid account'
    );
  END IF;
  
  -- Process each row in the batch
  FOR i IN 0..jsonb_array_length(p_rows) - 1 LOOP
    BEGIN
      -- Extract the current row
      v_row := p_rows->i;
      
      -- Extract trade data with proper error handling
      BEGIN
        -- Validate required fields
        IF v_row->>'contract_name' IS NULL THEN
          RAISE EXCEPTION 'Missing contract_name field';
        END IF;
        
        IF v_row->>'entry_price' IS NULL THEN
          RAISE EXCEPTION 'Missing entry_price field';
        END IF;
        
        IF v_row->>'exit_price' IS NULL THEN
          RAISE EXCEPTION 'Missing exit_price field';
        END IF;
        
        -- Extract and convert fields
        v_symbol := v_row->>'contract_name';
        v_side := COALESCE(v_row->>'type', 'long');
        v_quantity := COALESCE((v_row->>'size')::NUMERIC, 1);
        v_entry_price := (v_row->>'entry_price')::NUMERIC;
        v_exit_price := (v_row->>'exit_price')::NUMERIC;
        v_pnl := COALESCE((v_row->>'pnl')::NUMERIC, 0);
        v_entry_date := (v_row->>'entered_at')::TIMESTAMP;
        v_exit_date := (v_row->>'exited_at')::TIMESTAMP;
        v_fees := COALESCE((v_row->>'fees')::NUMERIC, 2.50);
        
        -- Set the trade date
        v_date := COALESCE((v_row->>'trade_day')::DATE, v_entry_date::DATE);
        
        -- Normalize the side value
        IF v_side ILIKE '%long%' OR v_side ILIKE '%buy%' THEN
          v_side := 'long';
        ELSIF v_side ILIKE '%short%' OR v_side ILIKE '%sell%' THEN
          v_side := 'short';
        ELSE
          v_side := 'long'; -- Default to long if unspecified
        END IF;
        
        -- Insert the trade with the found/created account
        INSERT INTO trades (
          user_id,
          account_id,
          symbol,
          side,
          quantity,
          entry_price,
          exit_price,
          pnl,
          entry_time,
          exit_time,
          fees,
          trade_date,
          created_at,
          updated_at,
          platform,
          original_data
        ) VALUES (
          p_user_id,
          v_account_id, -- Using the account ID we found or created
          v_symbol,
          v_side,
          v_quantity,
          v_entry_price,
          v_exit_price,
          v_pnl,
          v_entry_date,
          v_exit_date,
          v_fees,
          v_date,
          NOW(),
          NOW(),
          'topstepx',
          v_row
        ) RETURNING id INTO v_trade_id;
        
        -- Increment success counter
        v_success_count := v_success_count + 1;
        
        -- Add to results
        v_results := array_append(v_results, jsonb_build_object(
          'id', v_trade_id,
          'symbol', v_symbol,
          'success', TRUE
        ));
      EXCEPTION WHEN OTHERS THEN
        -- Handle errors for this row
        v_error := SQLERRM;
        v_error_count := v_error_count + 1;
        
        -- Add error to results
        v_results := array_append(v_results, jsonb_build_object(
          'row', i + 1,
          'error', v_error,
          'success', FALSE
        ));
      END;
    EXCEPTION WHEN OTHERS THEN
      -- Handle any unexpected errors
      v_error_count := v_error_count + 1;
      v_results := array_append(v_results, jsonb_build_object(
        'row', i + 1,
        'error', 'Unexpected error: ' || SQLERRM,
        'success', FALSE
      ));
    END;
  END LOOP;
  
  -- Try to refresh analytics if trades were processed successfully
  IF v_success_count > 0 THEN
    BEGIN
      -- Call the refresh_user_analytics function
      PERFORM refresh_user_analytics(p_user_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to refresh analytics: %', SQLERRM;
    END;
  END IF;
  
  -- Return the results
  RETURN jsonb_build_object(
    'success', v_error_count = 0,
    'processed', v_success_count,
    'errors', v_error_count,
    'results', to_jsonb(v_results),
    'account_id', v_account_id, -- Return the account ID that was used
    'message', CASE 
      WHEN v_error_count = 0 THEN 'All trades processed successfully'
      ELSE 'Some trades had errors during processing'
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PART 4: Alternative function for backwards compatibility (older API)
CREATE OR REPLACE FUNCTION process_topstepx_csv_batch(
  p_rows JSONB
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_account_id UUID;
BEGIN
  -- Extract user ID and account ID from the first trade
  IF jsonb_array_length(p_rows) > 0 THEN
    v_user_id := (p_rows->0->>'user_id')::UUID;
    v_account_id := (p_rows->0->>'account_id')::UUID;
  ELSE
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'No trades provided',
      'processed', 0
    );
  END IF;
  
  -- Call the main function with the extracted parameters
  RETURN process_topstepx_csv_batch(v_user_id, p_rows, v_account_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', FALSE,
    'message', 'Error in process_topstepx_csv_batch wrapper: ' || SQLERRM,
    'processed', 0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PART 5: Grant necessary permissions
GRANT EXECUTE ON FUNCTION process_topstepx_csv_batch(UUID, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION process_topstepx_csv_batch(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_account_exists(UUID, TEXT) TO authenticated;

-- PART 6: Create a diagnostic function to help diagnose issues
CREATE OR REPLACE FUNCTION debug_topstepx_upload(p_user_id UUID) 
RETURNS JSONB AS $$
DECLARE
  v_accounts_count INTEGER;
  v_trades_count INTEGER;
  v_accounts JSONB;
BEGIN
  -- Count accounts
  SELECT COUNT(*) INTO v_accounts_count
  FROM accounts
  WHERE user_id = p_user_id;
  
  -- Get account details
  SELECT COALESCE(jsonb_agg(a), '[]'::jsonb) INTO v_accounts
  FROM (
    SELECT id, name, platform, created_at
    FROM accounts
    WHERE user_id = p_user_id
  ) a;
  
  -- Count trades
  SELECT COUNT(*) INTO v_trades_count
  FROM trades
  WHERE user_id = p_user_id;
  
  -- Return diagnostic info
  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'accounts_count', v_accounts_count,
    'accounts', v_accounts,
    'trades_count', v_trades_count,
    'functions', jsonb_build_object(
      'process_topstepx_csv_batch', EXISTS(
        SELECT 1 FROM pg_proc 
        WHERE proname = 'process_topstepx_csv_batch'
      ),
      'ensure_account_exists', EXISTS(
        SELECT 1 FROM pg_proc 
        WHERE proname = 'ensure_account_exists'
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION debug_topstepx_upload(UUID) TO authenticated; 