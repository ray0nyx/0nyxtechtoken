-- Improve TopstepX Function to Handle Uploads Without Account ID
-- This script updates the process_topstepx_csv_batch function to properly handle null account IDs

-- First, try to drop existing functions
DO $$
BEGIN
  -- Try to drop all versions of the function
  BEGIN
    DROP FUNCTION IF EXISTS process_topstepx_csv_batch(uuid, jsonb, uuid);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_topstepx_csv_batch(uuid, jsonb, uuid): %', SQLERRM;
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS process_topstepx_csv_batch(uuid, jsonb);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_topstepx_csv_batch(uuid, jsonb): %', SQLERRM;
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS process_topstepx_csv_batch(jsonb);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_topstepx_csv_batch(jsonb): %', SQLERRM;
  END;
END $$;

-- Create helper function to find or create account
CREATE OR REPLACE FUNCTION ensure_account_exists(
  p_user_id UUID,
  p_account_name TEXT DEFAULT 'TopstepX Account'
) RETURNS UUID AS $$
DECLARE
  v_account_id UUID;
BEGIN
  -- Check if user already has a TopstepX account
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

-- Create the updated function with three parameters (user_id, rows, account_id)
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
  
  -- If account_id is not provided, use the ensure_account_exists function to find or create one
  IF v_account_id IS NULL THEN
    v_account_id := ensure_account_exists(p_user_id, 'TopstepX Account');
  ELSE
    -- Verify that the account actually exists and belongs to this user
    SELECT EXISTS(
      SELECT 1 FROM accounts 
      WHERE id = v_account_id 
      AND user_id = p_user_id
    ) INTO v_account_exists;
    
    IF NOT v_account_exists THEN
      RAISE NOTICE 'Account ID % does not exist or does not belong to user %. Creating new account.', v_account_id, p_user_id;
      v_account_id := ensure_account_exists(p_user_id, 'TopstepX Account');
    END IF;
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
        
        -- Insert the trade
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
          v_account_id,
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
    'account_id', v_account_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION process_topstepx_csv_batch(UUID, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_account_exists(UUID, TEXT) TO authenticated; 