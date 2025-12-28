-- CREATE RPC FUNCTION TO FIX ORPHANED TRADES
-- This function can be called from client-side to fix trades that lack valid trading_accounts

-- Create the function
CREATE OR REPLACE FUNCTION fix_orphaned_trades()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_orphaned_count INTEGER;
  v_fixed_count INTEGER := 0;
  v_account_id UUID;
  v_error TEXT;
  v_result JSONB;
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
  
  -- Count orphaned trades for this user
  SELECT COUNT(*)
  INTO v_orphaned_count
  FROM trades t
  LEFT JOIN trading_accounts ta ON t.account_id = ta.id
  WHERE t.user_id = v_user_id AND ta.id IS NULL;
  
  -- If no orphaned trades, return success
  IF v_orphaned_count = 0 THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'message', 'No orphaned trades found',
      'fixed_count', 0
    );
  END IF;
  
  -- Find or create a valid trading account for this user
  BEGIN
    -- Try to find an existing account
    SELECT id INTO v_account_id
    FROM trading_accounts
    WHERE user_id = v_user_id
    LIMIT 1;
    
    -- If no account exists, create one
    IF v_account_id IS NULL THEN
      v_account_id := gen_random_uuid();
      
      INSERT INTO trading_accounts (id, user_id, name, created_at)
      VALUES (v_account_id, v_user_id, 'Default Trading Account', NOW());
    END IF;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', v_error,
      'fixed_count', 0
    );
  END;
  
  -- Fix orphaned trades for this user
  BEGIN
    UPDATE trades
    SET account_id = v_account_id,
        updated_at = NOW()
    WHERE user_id = v_user_id
    AND NOT EXISTS (
      SELECT 1
      FROM trading_accounts ta
      WHERE ta.id = trades.account_id
    );
    
    GET DIAGNOSTICS v_fixed_count = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', v_error,
      'fixed_count', 0
    );
  END;
  
  -- Return result
  RETURN jsonb_build_object(
    'success', TRUE,
    'message', 'Successfully fixed orphaned trades',
    'fixed_count', v_fixed_count,
    'account_id', v_account_id
  );
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION fix_orphaned_trades() TO authenticated;

-- Create specific function to fix specific problematic account ID
CREATE OR REPLACE FUNCTION fix_specific_account_id(p_account_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_account_exists BOOLEAN;
  v_error TEXT;
  v_affected_count INTEGER;
BEGIN
  -- Get the current user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Not authenticated'
    );
  END IF;
  
  -- Check if account already exists
  SELECT EXISTS(SELECT 1 FROM trading_accounts WHERE id = p_account_id)
  INTO v_account_exists;
  
  -- If account exists, return success
  IF v_account_exists THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'message', 'Account already exists',
      'account_id', p_account_id
    );
  END IF;
  
  -- Create the account with the specific ID
  BEGIN
    INSERT INTO trading_accounts (id, user_id, name, created_at)
    VALUES (p_account_id, v_user_id, 'Fixed Specific Account', NOW());
    
    -- Count trades using this account ID
    SELECT COUNT(*)
    INTO v_affected_count
    FROM trades
    WHERE account_id = p_account_id;
    
    RETURN jsonb_build_object(
      'success', TRUE,
      'message', 'Successfully created account with specific ID',
      'account_id', p_account_id,
      'affected_trades', v_affected_count
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', v_error
    );
  END;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION fix_specific_account_id(UUID) TO authenticated; 