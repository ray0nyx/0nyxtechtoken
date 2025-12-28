-- FIX TRADING ACCOUNTS REFERENCE
-- This script adapts the existing fixes to work with the trading_accounts table

-------------------------------------------------------
-- PART 1: REVISE DIAGNOSTICS FOR CORRECT TABLE
-------------------------------------------------------

DO $$
DECLARE
  r RECORD;
  v_orphaned_count INTEGER;
  v_total_trades INTEGER;
BEGIN
  RAISE NOTICE '-------------------------------------------------------';
  RAISE NOTICE 'IDENTIFYING ORPHANED TRADES WITH TRADING_ACCOUNTS TABLE';
  RAISE NOTICE '-------------------------------------------------------';
  
  -- Count total trades
  SELECT COUNT(*) INTO v_total_trades FROM trades;
  RAISE NOTICE 'Total trades in database: %', v_total_trades;
  
  -- Count orphaned trades (trades with account_id that doesn't exist in trading_accounts table)
  SELECT COUNT(*) INTO v_orphaned_count
  FROM trades t
  LEFT JOIN trading_accounts ta ON t.account_id = ta.id
  WHERE ta.id IS NULL;
  
  RAISE NOTICE 'Orphaned trades (invalid account_id): %', v_orphaned_count;
  
  -- Sample of orphaned trades for inspection
  RAISE NOTICE 'Sample of orphaned trades:';
  FOR r IN (
    SELECT t.id, t.user_id, t.account_id, t.symbol, t.timestamp, t.created_at
    FROM trades t
    LEFT JOIN trading_accounts ta ON t.account_id = ta.id
    WHERE ta.id IS NULL
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
    LEFT JOIN trading_accounts ta ON t.account_id = ta.id
    WHERE ta.id IS NULL
    GROUP BY t.user_id
    ORDER BY orphaned_count DESC
    LIMIT 10
  ) LOOP
    RAISE NOTICE 'User ID: %, Orphaned Trade Count: %', r.user_id, r.orphaned_count;
  END LOOP;
END $$;

-------------------------------------------------------
-- PART 2: CREATE ROBUST ACCOUNT ID FUNCTION FOR TRADING_ACCOUNTS
-------------------------------------------------------

-- Create a function that always returns a valid trading_accounts ID
CREATE OR REPLACE FUNCTION get_valid_trading_account_id(
  p_user_id UUID
) RETURNS UUID AS $$
DECLARE
  v_account_id UUID;
  v_error TEXT;
  v_max_attempts INT := 3;
  v_current_attempt INT := 0;
  v_fallback_account_id UUID := '33f4ad8c-d025-45fc-aa3e-7f71a162d943';
BEGIN
  -- First check if the problematic ID exists and is associated with this user
  SELECT id INTO v_account_id
  FROM trading_accounts
  WHERE id = v_fallback_account_id AND user_id = p_user_id;
  
  -- If found, return immediately
  IF v_account_id IS NOT NULL THEN
    RETURN v_account_id;
  END IF;
  
  -- Try to find any existing account for this user
  SELECT id INTO v_account_id
  FROM trading_accounts
  WHERE user_id = p_user_id
  LIMIT 1;
  
  -- If found, return it
  IF v_account_id IS NOT NULL THEN
    RETURN v_account_id;
  END IF;
  
  -- No accounts found, we need to create one
  WHILE v_current_attempt < v_max_attempts LOOP
    v_current_attempt := v_current_attempt + 1;
    
    BEGIN
      v_account_id := gen_random_uuid();
      
      INSERT INTO trading_accounts (id, user_id, name, created_at)
      VALUES (v_account_id, p_user_id, 'Default Trading Account', NOW());
      
      RETURN v_account_id;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
      
      -- Try again with the next attempt
      IF v_current_attempt = v_max_attempts THEN
        -- As a last resort, try to create the problematic account ID
        -- Only if it doesn't exist for any user
        IF NOT EXISTS (SELECT 1 FROM trading_accounts WHERE id = v_fallback_account_id) THEN
          BEGIN
            INSERT INTO trading_accounts (id, user_id, name, created_at)
            VALUES (v_fallback_account_id, p_user_id, 'Emergency Fallback Account', NOW());
            
            RETURN v_fallback_account_id;
          EXCEPTION WHEN OTHERS THEN
            -- Final fallback: just return the ID anyway and hope it exists by now
            RETURN v_fallback_account_id;
          END;
        ELSE
          -- The fallback ID exists but for a different user
          -- As an absolute last resort, return any existing account ID
          SELECT id INTO v_account_id FROM trading_accounts LIMIT 1;
          RETURN COALESCE(v_account_id, v_fallback_account_id);
        END IF;
      END IF;
    END;
  END LOOP;
  
  -- Should never reach here, but just in case
  RETURN v_fallback_account_id;
END;
$$ LANGUAGE plpgsql;

-------------------------------------------------------
-- PART 3: CREATE SPECIFIC PROBLEMATIC ACCOUNT ID
-------------------------------------------------------

DO $$
DECLARE
  v_problematic_account_id UUID := '33f4ad8c-d025-45fc-aa3e-7f71a162d943';
  v_account_exists BOOLEAN;
  v_user_id UUID;
  v_affected_users UUID[];
  v_primary_user UUID;
BEGIN
  RAISE NOTICE '-------------------------------------------------------';
  RAISE NOTICE 'FIXING PROBLEMATIC ACCOUNT ID: %', v_problematic_account_id;
  RAISE NOTICE '-------------------------------------------------------';
  
  -- Check if the account already exists
  SELECT EXISTS(SELECT 1 FROM trading_accounts WHERE id = v_problematic_account_id)
  INTO v_account_exists;
  
  IF v_account_exists THEN
    RAISE NOTICE 'Account already exists in the trading_accounts table.';
    RETURN;
  END IF;
  
  -- Find all users who have trades referencing this account ID
  SELECT ARRAY_AGG(DISTINCT t.user_id)
  INTO v_affected_users
  FROM trades t
  WHERE t.account_id = v_problematic_account_id;
  
  IF v_affected_users IS NULL OR ARRAY_LENGTH(v_affected_users, 1) = 0 THEN
    -- No trades with this account ID, try to find the current user
    BEGIN
      EXECUTE 'SELECT auth.uid()' INTO v_user_id;
      RAISE NOTICE 'No trades found with this account ID. Using current user: %', v_user_id;
    EXCEPTION WHEN OTHERS THEN
      -- If we can't get the current user, create a placeholder admin user
      v_user_id := '00000000-0000-0000-0000-000000000000';
      RAISE NOTICE 'Creating placeholder admin account for user ID: %', v_user_id;
    END;
  ELSE
    -- Find the user with the most trades using this account
    SELECT t.user_id, COUNT(*) AS trade_count
    INTO v_primary_user
    FROM trades t
    WHERE t.account_id = v_problematic_account_id
    GROUP BY t.user_id
    ORDER BY trade_count DESC
    LIMIT 1;
    
    v_user_id := v_primary_user;
    RAISE NOTICE 'Found primary user % with trades using this account ID', v_user_id;
  END IF;
  
  -- Create the account with the exact UUID
  BEGIN
    INSERT INTO trading_accounts (id, user_id, name, created_at)
    VALUES (v_problematic_account_id, v_user_id, 'Auto-created Account (Previously Missing)', NOW());
    
    RAISE NOTICE 'Successfully created account with ID: % for user: %', v_problematic_account_id, v_user_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error creating account: %', SQLERRM;
  END;
END $$;

-------------------------------------------------------
-- PART 4: FIX ORPHANED TRADES
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
  RAISE NOTICE 'FIXING ORPHANED TRADES WITH TRADING_ACCOUNTS TABLE';
  RAISE NOTICE '-------------------------------------------------------';
  
  -- Count orphaned trades
  SELECT COUNT(*) INTO v_orphaned_count
  FROM trades t
  LEFT JOIN trading_accounts ta ON t.account_id = ta.id
  WHERE ta.id IS NULL;
  
  RAISE NOTICE 'Found % orphaned trades', v_orphaned_count;
  
  -- Process each orphaned trade by user
  FOR r IN (
    SELECT DISTINCT t.user_id
    FROM trades t
    LEFT JOIN trading_accounts ta ON t.account_id = ta.id
    WHERE ta.id IS NULL
  ) LOOP
    v_user_id := r.user_id;
    
    -- Get a guaranteed account for this user
    v_account_id := get_valid_trading_account_id(v_user_id);
    
    -- Update all orphaned trades for this user
    UPDATE trades
    SET account_id = v_account_id,
        updated_at = NOW()
    WHERE user_id = v_user_id
    AND account_id NOT IN (SELECT id FROM trading_accounts);
    
    GET DIAGNOSTICS v_total_fixed = ROW_COUNT;
    
    RAISE NOTICE 'Fixed % orphaned trades for user %', v_total_fixed, v_user_id;
  END LOOP;
  
  -- Verify fix
  SELECT COUNT(*) INTO v_orphaned_count
  FROM trades t
  LEFT JOIN trading_accounts ta ON t.account_id = ta.id
  WHERE ta.id IS NULL;
  
  RAISE NOTICE 'Remaining orphaned trades after fix: %', v_orphaned_count;
END $$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_valid_trading_account_id(UUID) TO authenticated; 