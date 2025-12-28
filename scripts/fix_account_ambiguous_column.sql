-- FIX ORPHANED TRADES SCRIPT (FIXED VERSION)
-- This script fixes the ambiguous column reference error in the original script

-------------------------------------------------------
-- PART 1: IDENTIFY ORPHANED TRADES
-------------------------------------------------------

DO $$
DECLARE
  r RECORD;
  v_orphaned_count INTEGER;
  v_total_trades INTEGER;
BEGIN
  RAISE NOTICE '-------------------------------------------------------';
  RAISE NOTICE 'IDENTIFYING ORPHANED TRADES';
  RAISE NOTICE '-------------------------------------------------------';
  
  -- Count total trades
  SELECT COUNT(*) INTO v_total_trades FROM trades;
  RAISE NOTICE 'Total trades in database: %', v_total_trades;
  
  -- Count orphaned trades (trades with account_id that doesn't exist in accounts table)
  SELECT COUNT(*) INTO v_orphaned_count
  FROM trades t
  LEFT JOIN accounts a ON t.account_id = a.id
  WHERE a.id IS NULL;
  
  RAISE NOTICE 'Orphaned trades (invalid account_id): %', v_orphaned_count;
  
  -- Sample of orphaned trades for inspection
  RAISE NOTICE 'Sample of orphaned trades:';
  FOR r IN (
    SELECT t.id, t.user_id, t.account_id, t.symbol, t.timestamp, t.created_at
    FROM trades t
    LEFT JOIN accounts a ON t.account_id = a.id
    WHERE a.id IS NULL
    LIMIT 5
  ) LOOP
    RAISE NOTICE 'Trade ID: %, User ID: %, Invalid Account ID: %, Symbol: %, Date: %',
      r.id, r.user_id, r.account_id, r.symbol, r.timestamp;
  END LOOP;
  
  -- Count trades by user_id for users with orphaned trades
  RAISE NOTICE 'Users with orphaned trades:';
  FOR r IN (
    SELECT t.user_id, COUNT(*) as orphaned_count
    FROM trades t
    LEFT JOIN accounts a ON t.account_id = a.id
    WHERE a.id IS NULL
    GROUP BY t.user_id
    ORDER BY orphaned_count DESC
    LIMIT 10
  ) LOOP
    RAISE NOTICE 'User ID: %, Orphaned Trade Count: %', r.user_id, r.orphaned_count;
  END LOOP;
END $$;

-------------------------------------------------------
-- PART 2: FIXED VERSION OF FIX ORPHANED TRADES
-------------------------------------------------------

DO $$
DECLARE
  v_orphaned_count INTEGER;
  v_total_fixed INTEGER := 0;
  r RECORD;
  v_user_id UUID;
  v_account_id UUID;
BEGIN
  RAISE NOTICE '-------------------------------------------------------';
  RAISE NOTICE 'FIXING ORPHANED TRADES';
  RAISE NOTICE '-------------------------------------------------------';
  
  -- Count orphaned trades
  SELECT COUNT(*) INTO v_orphaned_count
  FROM trades t
  LEFT JOIN accounts a ON t.account_id = a.id
  WHERE a.id IS NULL;
  
  RAISE NOTICE 'Found % orphaned trades', v_orphaned_count;
  
  -- Process each orphaned trade by user
  -- FIXED: Explicitly reference t.user_id to avoid ambiguity
  FOR r IN (
    SELECT DISTINCT t.user_id
    FROM trades t
    LEFT JOIN accounts a ON t.account_id = a.id
    WHERE a.id IS NULL
  ) LOOP
    v_user_id := r.user_id;
    
    -- Try to find an existing account for this user
    SELECT id INTO v_account_id
    FROM accounts
    WHERE user_id = v_user_id
    LIMIT 1;
    
    -- If no account exists, create one
    IF v_account_id IS NULL THEN
      v_account_id := gen_random_uuid();
      
      BEGIN
        INSERT INTO accounts (id, user_id, name, created_at)
        VALUES (v_account_id, v_user_id, 'Default Account (Auto-created)', NOW());
        
        RAISE NOTICE 'Created new account ID % for user %', v_account_id, v_user_id;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error creating account for user %: %', v_user_id, SQLERRM;
        
        -- Try one more time to find an account (in case another process created it)
        SELECT id INTO v_account_id
        FROM accounts
        WHERE user_id = v_user_id
        LIMIT 1;
        
        IF v_account_id IS NULL THEN
          RAISE NOTICE 'Could not create or find account for user %, skipping', v_user_id;
          CONTINUE;
        END IF;
      END;
    END IF;
    
    -- Update all orphaned trades for this user
    UPDATE trades
    SET account_id = v_account_id,
        updated_at = NOW()
    WHERE user_id = v_user_id
    AND account_id NOT IN (SELECT id FROM accounts);
    
    GET DIAGNOSTICS v_total_fixed = ROW_COUNT;
    
    RAISE NOTICE 'Fixed % orphaned trades for user %', v_total_fixed, v_user_id;
  END LOOP;
  
  -- Verify fix
  SELECT COUNT(*) INTO v_orphaned_count
  FROM trades t
  LEFT JOIN accounts a ON t.account_id = a.id
  WHERE a.id IS NULL;
  
  RAISE NOTICE 'Remaining orphaned trades after fix: %', v_orphaned_count;
END $$;

-------------------------------------------------------
-- PART 3: FIXED VERSION OF FINAL ACCOUNT ID FIX
-------------------------------------------------------

-- This is a fixed version of the script that processes orphaned trades
DO $$
DECLARE
  v_orphaned_count INTEGER;
  v_total_fixed INTEGER := 0;
  r RECORD;
  v_user_id UUID;
  v_account_id UUID;
BEGIN
  RAISE NOTICE '-------------------------------------------------------';
  RAISE NOTICE 'FIXED VERSION OF ORPHANED TRADES FIX';
  RAISE NOTICE '-------------------------------------------------------';
  
  -- Count orphaned trades
  SELECT COUNT(*) INTO v_orphaned_count
  FROM trades t
  LEFT JOIN accounts a ON t.account_id = a.id
  WHERE a.id IS NULL;
  
  RAISE NOTICE 'Found % orphaned trades', v_orphaned_count;
  
  -- Examine the trades and accounts table structure
  RAISE NOTICE 'Trades table columns:';
  FOR r IN (
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'trades'
    ORDER BY ordinal_position
  ) LOOP
    RAISE NOTICE '  Column: %, Type: %', r.column_name, r.data_type;
  END LOOP;
  
  RAISE NOTICE 'Accounts table columns:';
  FOR r IN (
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'accounts'
    ORDER BY ordinal_position
  ) LOOP
    RAISE NOTICE '  Column: %, Type: %', r.column_name, r.data_type;
  END LOOP;
  
  -- Process each user with orphaned trades
  RAISE NOTICE 'Processing users with orphaned trades:';
  FOR r IN (
    SELECT DISTINCT t.user_id
    FROM trades t
    WHERE t.account_id NOT IN (SELECT id FROM accounts)
    OR t.account_id IS NULL
  ) LOOP
    v_user_id := r.user_id;
    
    -- Try to find an existing account for this user
    SELECT id INTO v_account_id
    FROM accounts
    WHERE user_id = v_user_id
    LIMIT 1;
    
    -- If no account exists, create one
    IF v_account_id IS NULL THEN
      v_account_id := gen_random_uuid();
      
      BEGIN
        INSERT INTO accounts (id, user_id, name, created_at)
        VALUES (v_account_id, v_user_id, 'Default Account (Auto-created)', NOW());
        
        RAISE NOTICE '  Created new account ID % for user %', v_account_id, v_user_id;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '  Error creating account for user %: %', v_user_id, SQLERRM;
        
        -- Try one more time to find an account (in case another process created it)
        SELECT id INTO v_account_id
        FROM accounts
        WHERE user_id = v_user_id
        LIMIT 1;
        
        IF v_account_id IS NULL THEN
          RAISE NOTICE '  Could not create or find account for user %, skipping', v_user_id;
          CONTINUE;
        END IF;
      END;
    ELSE
      RAISE NOTICE '  Using existing account ID % for user %', v_account_id, v_user_id;
    END IF;
    
    -- Update all orphaned trades for this user
    UPDATE trades
    SET account_id = v_account_id,
        updated_at = NOW()
    WHERE user_id = v_user_id
    AND (account_id NOT IN (SELECT id FROM accounts) OR account_id IS NULL);
    
    GET DIAGNOSTICS v_total_fixed = ROW_COUNT;
    
    RAISE NOTICE '  Fixed % orphaned trades for user %', v_total_fixed, v_user_id;
  END LOOP;
  
  -- Verify fix
  SELECT COUNT(*) INTO v_orphaned_count
  FROM trades t
  LEFT JOIN accounts a ON t.account_id = a.id
  WHERE a.id IS NULL;
  
  RAISE NOTICE 'Remaining orphaned trades after fix: %', v_orphaned_count;
  
  IF v_orphaned_count = 0 THEN
    RAISE NOTICE 'SUCCESS: All orphaned trades have been fixed!';
  ELSE
    RAISE NOTICE 'WARNING: There are still % orphaned trades', v_orphaned_count;
  END IF;
END $$;

-------------------------------------------------------
-- PART 4: FORCE CREATE SPECIFIC ACCOUNT ID
-------------------------------------------------------

-- Create the problematic account ID for the current user
DO $$
DECLARE
  v_force_account_id UUID := '8e290e21-ba83-4533-be0a-718fafcdc7d9';
  v_current_user_id UUID;
  v_account_exists BOOLEAN;
BEGIN
  RAISE NOTICE '-------------------------------------------------------';
  RAISE NOTICE 'FORCE CREATING PROBLEMATIC ACCOUNT ID';
  RAISE NOTICE '-------------------------------------------------------';
  
  -- Try to get current user ID
  BEGIN
    EXECUTE 'SELECT auth.uid()' INTO v_current_user_id;
    
    IF v_current_user_id IS NULL THEN
      RAISE NOTICE 'Could not determine current user ID. Using default.';
      v_current_user_id := '00000000-0000-0000-0000-000000000000';
    END IF;
    
    RAISE NOTICE 'Using user ID: %', v_current_user_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error getting current user ID: %', SQLERRM;
    v_current_user_id := '00000000-0000-0000-0000-000000000000';
  END;
  
  -- Check if account already exists
  SELECT EXISTS(SELECT 1 FROM accounts WHERE id = v_force_account_id)
  INTO v_account_exists;
  
  IF v_account_exists THEN
    RAISE NOTICE 'Account already exists in the database.';
  ELSE
    -- Create the account
    BEGIN
      INSERT INTO accounts (id, user_id, name, created_at)
      VALUES (v_force_account_id, v_current_user_id, 'Forced Problem Account', NOW());
      
      RAISE NOTICE 'Successfully created account with ID %.', v_force_account_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error creating account: %', SQLERRM;
    END;
  END IF;
END $$; 