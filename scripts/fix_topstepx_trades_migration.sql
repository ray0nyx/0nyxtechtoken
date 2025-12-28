-- SQL MIGRATION SCRIPT: FIX TOPSTEPX TRADES
-- This script fixes trades with NULL account_id values by assigning them to valid trading accounts

-------------------------------------------------------
-- PART 1: DIAGNOSE THE ISSUE
-------------------------------------------------------

DO $$
DECLARE
  v_null_account_count INTEGER;
  v_total_trades INTEGER;
  v_account_id UUID;
  r RECORD;
BEGIN
  RAISE NOTICE '-------------------------------------------------------';
  RAISE NOTICE 'DIAGNOSING TRADE ACCOUNT ISSUES';
  RAISE NOTICE '-------------------------------------------------------';
  
  -- Count total trades and trades with NULL account_id
  SELECT COUNT(*) INTO v_total_trades FROM trades;
  SELECT COUNT(*) INTO v_null_account_count FROM trades WHERE account_id IS NULL;
  
  RAISE NOTICE 'Total trades: %', v_total_trades;
  RAISE NOTICE 'Trades with NULL account_id: %', v_null_account_count;
  
  -- Display distinct user_ids with NULL account_id trades
  RAISE NOTICE 'Users with NULL account_id trades:';
  FOR r IN (
    SELECT DISTINCT user_id, COUNT(*) as trade_count
    FROM trades
    WHERE account_id IS NULL
    GROUP BY user_id
  ) LOOP
    RAISE NOTICE '  User ID: %, Trade Count: %', r.user_id, r.trade_count;
  END LOOP;
  
  -- Check if trading_accounts table exists and has records
  SELECT COUNT(*) INTO r FROM trading_accounts;
  RAISE NOTICE 'Trading accounts count: %', r;
END $$;

-------------------------------------------------------
-- PART 2: FIX NULL ACCOUNT_ID VALUES IN TRADES
-------------------------------------------------------

DO $$
DECLARE
  v_user_id UUID;
  v_account_id UUID;
  v_fixed_count INTEGER := 0;
  r RECORD;
BEGIN
  RAISE NOTICE '-------------------------------------------------------';
  RAISE NOTICE 'FIXING NULL ACCOUNT_ID TRADES';
  RAISE NOTICE '-------------------------------------------------------';
  
  -- Process each user with NULL account_id trades
  FOR r IN (
    SELECT DISTINCT user_id
    FROM trades
    WHERE account_id IS NULL AND user_id IS NOT NULL
  ) LOOP
    v_user_id := r.user_id;
    
    -- Try to find an existing trading account for this user
    SELECT id INTO v_account_id
    FROM trading_accounts
    WHERE user_id = v_user_id
    LIMIT 1;
    
    -- If no trading account exists, create one
    IF v_account_id IS NULL THEN
      v_account_id := gen_random_uuid();
      
      -- Create a default trading account for this user
      BEGIN
        INSERT INTO trading_accounts (id, user_id, name, created_at)
        VALUES (v_account_id, v_user_id, 'Default Account', NOW());
        
        RAISE NOTICE 'Created new trading account ID % for user %', v_account_id, v_user_id;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error creating trading account for user %: %', v_user_id, SQLERRM;
        CONTINUE;
      END;
    ELSE
      RAISE NOTICE 'Found existing trading account ID % for user %', v_account_id, v_user_id;
    END IF;
    
    -- Update trades for this user to use the valid trading account
    UPDATE trades
    SET account_id = v_account_id,
        updated_at = NOW()
    WHERE user_id = v_user_id AND account_id IS NULL;
    
    GET DIAGNOSTICS v_fixed_count = ROW_COUNT;
    RAISE NOTICE 'Fixed % trades for user %', v_fixed_count, v_user_id;
  END LOOP;
  
  -- Handle trades with NULL user_id (if any)
  SELECT COUNT(*) INTO v_fixed_count FROM trades WHERE account_id IS NULL AND user_id IS NULL;
  
  IF v_fixed_count > 0 THEN
    RAISE NOTICE 'Found % trades with NULL user_id and NULL account_id', v_fixed_count;
    
    -- Create a special account for orphaned trades
    v_account_id := gen_random_uuid();
    
    BEGIN
      -- Use a system user or create one if needed
      SELECT id INTO v_user_id FROM auth.users LIMIT 1;
      
      IF v_user_id IS NULL THEN
        v_user_id := '00000000-0000-0000-0000-000000000000'::UUID;
      END IF;
      
      -- Create an orphaned trades account
      INSERT INTO trading_accounts (id, user_id, name, created_at)
      VALUES (v_account_id, v_user_id, 'Orphaned Trades Account', NOW());
      
      -- Update orphaned trades
      UPDATE trades
      SET account_id = v_account_id,
          user_id = v_user_id,
          updated_at = NOW()
      WHERE account_id IS NULL AND user_id IS NULL;
      
      GET DIAGNOSTICS v_fixed_count = ROW_COUNT;
      RAISE NOTICE 'Fixed % orphaned trades', v_fixed_count;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error fixing orphaned trades: %', SQLERRM;
    END;
  END IF;
END $$;

-------------------------------------------------------
-- PART 3: VALIDATE THE FIX
-------------------------------------------------------

DO $$
DECLARE
  v_null_account_count INTEGER;
  v_orphaned_count INTEGER;
BEGIN
  RAISE NOTICE '-------------------------------------------------------';
  RAISE NOTICE 'VALIDATING FIXES';
  RAISE NOTICE '-------------------------------------------------------';
  
  -- Count remaining trades with NULL account_id
  SELECT COUNT(*) INTO v_null_account_count FROM trades WHERE account_id IS NULL;
  RAISE NOTICE 'Remaining trades with NULL account_id: %', v_null_account_count;
  
  -- Count orphaned trades (invalid account references)
  SELECT COUNT(*) INTO v_orphaned_count
  FROM trades t
  LEFT JOIN trading_accounts ta ON t.account_id = ta.id
  WHERE ta.id IS NULL;
  
  RAISE NOTICE 'Remaining orphaned trades (invalid account references): %', v_orphaned_count;
  
  IF v_null_account_count = 0 AND v_orphaned_count = 0 THEN
    RAISE NOTICE 'SUCCESS: All trades now have valid account_id references!';
  ELSE
    RAISE NOTICE 'WARNING: Some trades still have issues. Manual intervention may be required.';
  END IF;
END $$;

-------------------------------------------------------
-- PART 4: CREATE RPC FOR CLIENT-SIDE FIXES
-------------------------------------------------------

-- Create a function to fix trades with NULL account_id values
CREATE OR REPLACE FUNCTION fix_null_account_trades()
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
      'message', 'No trades with NULL account_id found',
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
    'message', 'Successfully fixed trades with NULL account_id',
    'fixed_count', v_fixed_count,
    'account_id', v_account_id
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION fix_null_account_trades() TO authenticated; 