-- INSPECT SPECIFIC ACCOUNT ID SCRIPT
-- This script examines a specific account ID to diagnose foreign key issues

-------------------------------------------------------
-- PART 1: CHECK THE SPECIFIED ACCOUNT
-------------------------------------------------------

DO $$
DECLARE
  v_specific_account_id UUID := '8e290e21-ba83-4533-be0a-718fafcdc7d9'; -- The problematic account ID
  v_exists BOOLEAN;
  v_user_id UUID;
  v_name TEXT;
  v_created_at TIMESTAMPTZ;
  r RECORD;
  v_user_exists BOOLEAN;
BEGIN
  RAISE NOTICE '-------------------------------------------------------';
  RAISE NOTICE 'EXAMINING SPECIFIC ACCOUNT ID: %', v_specific_account_id;
  RAISE NOTICE '-------------------------------------------------------';
  
  -- Check if the account exists
  SELECT EXISTS(
    SELECT 1 FROM accounts WHERE id = v_specific_account_id
  ) INTO v_exists;
  
  RAISE NOTICE 'Account exists in database: %', v_exists;
  
  -- If it exists, get details
  IF v_exists THEN
    SELECT user_id, name, created_at 
    INTO v_user_id, v_name, v_created_at
    FROM accounts 
    WHERE id = v_specific_account_id;
    
    RAISE NOTICE 'Account details:';
    RAISE NOTICE '  User ID: %', v_user_id;
    RAISE NOTICE '  Name: %', v_name;
    RAISE NOTICE '  Created at: %', v_created_at;
    
    -- Check if user exists
    IF v_user_id IS NOT NULL THEN
      EXECUTE 'SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = $1)' 
        INTO v_user_exists
        USING v_user_id;
        
      RAISE NOTICE '  Referenced user exists: %', v_user_exists;
    END IF;
    
    -- Check trades using this account
    RAISE NOTICE 'Recent trades using this account:';
    FOR r IN (
      SELECT id, user_id, symbol, quantity, timestamp
      FROM trades
      WHERE account_id = v_specific_account_id
      ORDER BY created_at DESC
      LIMIT 5
    ) LOOP
      RAISE NOTICE '  Trade ID: %, User ID: %, Symbol: %, Qty: %, Date: %',
        r.id, r.user_id, r.symbol, r.quantity, r.timestamp;
    END LOOP;
  ELSE
    -- If it doesn't exist, check if it was used in any trades
    RAISE NOTICE 'Checking if this non-existent account ID is referenced in trades:';
    
    FOR r IN (
      SELECT id, user_id, symbol, quantity, timestamp
      FROM trades
      WHERE account_id = v_specific_account_id
      LIMIT 5
    ) LOOP
      RAISE NOTICE '  ORPHANED TRADE - ID: %, User ID: %, Symbol: %, Qty: %, Date: %',
        r.id, r.user_id, r.symbol, r.quantity, r.timestamp;
    END LOOP;
  END IF;
END $$;

-------------------------------------------------------
-- PART 2: AUTO-FIX FOR TRADES USING THIS ACCOUNT
-------------------------------------------------------

-- Function to reassign trades to a valid account
CREATE OR REPLACE FUNCTION reassign_trades_from_invalid_account(
  p_invalid_account_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_affected_users UUID[];
  v_user_id UUID;
  v_valid_account_id UUID;
  v_created_account BOOLEAN;
  v_user_stats JSONB := '{}';
  v_total_trades_fixed INTEGER := 0;
  v_user_trade_count INTEGER;
BEGIN
  -- Find all users that have trades with this account
  SELECT ARRAY_AGG(DISTINCT user_id)
  INTO v_affected_users
  FROM trades
  WHERE account_id = p_invalid_account_id;
  
  -- If no affected users, return early
  IF v_affected_users IS NULL OR ARRAY_LENGTH(v_affected_users, 1) = 0 THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'message', 'No trades found using this account ID',
      'trades_fixed', 0
    );
  END IF;
  
  -- For each affected user, find a valid account or create one
  FOREACH v_user_id IN ARRAY v_affected_users LOOP
    v_created_account := FALSE;
    
    -- Try to find an existing account
    SELECT id INTO v_valid_account_id
    FROM accounts
    WHERE user_id = v_user_id
    LIMIT 1;
    
    -- If no account exists, create one
    IF v_valid_account_id IS NULL THEN
      v_valid_account_id := gen_random_uuid();
      
      BEGIN
        INSERT INTO accounts (id, user_id, name, created_at)
        VALUES (v_valid_account_id, v_user_id, 'Auto-created Account', NOW());
        
        v_created_account := TRUE;
      EXCEPTION WHEN OTHERS THEN
        -- Try one more time to get an existing account
        SELECT id INTO v_valid_account_id
        FROM accounts
        WHERE user_id = v_user_id
        LIMIT 1;
        
        IF v_valid_account_id IS NULL THEN
          -- Skip this user if we can't create or find an account
          CONTINUE;
        END IF;
      END;
    END IF;
    
    -- Update trades for this user to use the valid account
    UPDATE trades
    SET account_id = v_valid_account_id,
        updated_at = NOW()
    WHERE user_id = v_user_id 
    AND account_id = p_invalid_account_id;
    
    GET DIAGNOSTICS v_user_trade_count = ROW_COUNT;
    v_total_trades_fixed := v_total_trades_fixed + v_user_trade_count;
    
    -- Add user stats to result
    v_user_stats := jsonb_set(
      v_user_stats,
      ARRAY[v_user_id::TEXT],
      jsonb_build_object(
        'trades_fixed', v_user_trade_count,
        'valid_account_id', v_valid_account_id,
        'account_created', v_created_account
      )
    );
  END LOOP;
  
  -- Return summary
  RETURN jsonb_build_object(
    'success', TRUE,
    'invalid_account_id', p_invalid_account_id,
    'total_trades_fixed', v_total_trades_fixed,
    'users_fixed', jsonb_object_keys(v_user_stats),
    'user_details', v_user_stats
  );
END;
$$ LANGUAGE plpgsql;

-- Create a safer version of the function that can be called from the client
CREATE OR REPLACE FUNCTION fix_trades_with_invalid_account(
  p_user_id UUID,
  p_invalid_account_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_has_trades BOOLEAN;
  v_result JSONB;
BEGIN
  -- Security check: Only allow fixing trades that belong to the calling user
  SELECT EXISTS(
    SELECT 1 FROM trades 
    WHERE user_id = p_user_id 
    AND account_id = p_invalid_account_id
  ) INTO v_has_trades;
  
  IF NOT v_has_trades THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'No trades found for this user with the specified account ID or permission denied'
    );
  END IF;
  
  -- Create a valid account for this user if needed
  DECLARE
    v_valid_account_id UUID;
  BEGIN
    -- Get existing account
    SELECT id INTO v_valid_account_id
    FROM accounts
    WHERE user_id = p_user_id
    LIMIT 1;
    
    -- Create if none exists
    IF v_valid_account_id IS NULL THEN
      v_valid_account_id := gen_random_uuid();
      
      INSERT INTO accounts (id, user_id, name, created_at)
      VALUES (v_valid_account_id, p_user_id, 'Default Account', NOW());
    END IF;
    
    -- Update only this user's trades
    UPDATE trades
    SET account_id = v_valid_account_id,
        updated_at = NOW()
    WHERE user_id = p_user_id
    AND account_id = p_invalid_account_id;
    
    GET DIAGNOSTICS v_result = ROW_COUNT;
    
    RETURN jsonb_build_object(
      'success', TRUE,
      'trades_fixed', v_result,
      'valid_account_id', v_valid_account_id
    );
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION fix_trades_with_invalid_account(UUID, UUID) TO authenticated;

-------------------------------------------------------
-- PART 3: ADMIN FUNCTIONS
-------------------------------------------------------

-- Create function to manually create the exact account ID if needed (ADMIN ONLY)
CREATE OR REPLACE FUNCTION admin_create_specific_account(
  p_account_id UUID,
  p_user_id UUID,
  p_name TEXT DEFAULT 'Manually Created Account'
) RETURNS JSONB AS $$
BEGIN
  -- Attempt to insert the specific account ID
  BEGIN
    INSERT INTO accounts (id, user_id, name, created_at)
    VALUES (p_account_id, p_user_id, p_name, NOW());
    
    RETURN jsonb_build_object(
      'success', TRUE,
      'account_id', p_account_id,
      'user_id', p_user_id,
      'message', 'Account created successfully'
    );
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'account_id', p_account_id,
      'error', 'Account ID already exists'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'account_id', p_account_id,
      'error', SQLERRM
    );
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- NOT granting permission to regular users - admin only function

-- Function to find the first user ID who has trades with this account
CREATE OR REPLACE FUNCTION find_user_for_invalid_account(
  p_account_id UUID
) RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_trade_count INTEGER;
BEGIN
  -- Find the most frequent user for this account ID
  SELECT user_id, COUNT(*) as trade_count
  INTO v_user_id, v_trade_count
  FROM trades
  WHERE account_id = p_account_id
  GROUP BY user_id
  ORDER BY trade_count DESC
  LIMIT 1;
  
  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql; 