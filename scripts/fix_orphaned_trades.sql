-- FIX ORPHANED TRADES SCRIPT
-- This script identifies trades with invalid account_id references
-- and fixes them by associating them with valid accounts

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
-- PART 2: FIX ORPHANED TRADES
-------------------------------------------------------

-- Function to get or create an account for a user
CREATE OR REPLACE FUNCTION get_or_create_default_account_for_orphans(
  p_user_id UUID
) RETURNS UUID AS $$
DECLARE
  v_account_id UUID;
BEGIN
  -- First try to find an existing account
  SELECT id INTO v_account_id
  FROM accounts
  WHERE user_id = p_user_id
  LIMIT 1;
  
  -- If account found, return it
  IF v_account_id IS NOT NULL THEN
    RETURN v_account_id;
  END IF;
  
  -- No account found, create a new one
  v_account_id := gen_random_uuid();
  
  BEGIN
    INSERT INTO accounts (id, user_id, name, created_at)
    VALUES (v_account_id, p_user_id, 'Default Account (Auto-created)', NOW());
    
    RAISE NOTICE 'Created new account ID % for user %', v_account_id, p_user_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error creating account for user %: %', p_user_id, SQLERRM;
    
    -- Try one more time to find an account (in case another process created it)
    SELECT id INTO v_account_id
    FROM accounts
    WHERE user_id = p_user_id
    LIMIT 1;
    
    IF v_account_id IS NULL THEN
      RAISE EXCEPTION 'Could not create or find account for user %', p_user_id;
    END IF;
  END;
  
  RETURN v_account_id;
END;
$$ LANGUAGE plpgsql;

-- Fix all orphaned trades
DO $$
DECLARE
  r RECORD;
  v_user_account_map JSONB := '{}';
  v_account_id UUID;
  v_updated_count INTEGER := 0;
  v_skipped_count INTEGER := 0;
  v_error_count INTEGER := 0;
BEGIN
  RAISE NOTICE '-------------------------------------------------------';
  RAISE NOTICE 'FIXING ORPHANED TRADES';
  RAISE NOTICE '-------------------------------------------------------';
  
  -- Process each orphaned trade
  FOR r IN (
    SELECT t.id, t.user_id, t.account_id
    FROM trades t
    LEFT JOIN accounts a ON t.account_id = a.id
    WHERE a.id IS NULL
  ) LOOP
    BEGIN
      -- Get account ID from our map or create a new one
      v_account_id := v_user_account_map->>r.user_id::TEXT;
      
      IF v_account_id IS NULL THEN
        -- Not in our map yet, get or create it
        v_account_id := get_or_create_default_account_for_orphans(r.user_id);
        
        -- Store in our map for reuse
        v_user_account_map := jsonb_set(
          v_user_account_map,
          ARRAY[r.user_id::TEXT],
          to_jsonb(v_account_id::TEXT)
        );
      ELSE
        -- Convert from JSON text back to UUID
        v_account_id := v_account_id::UUID;
      END IF;
      
      -- Update the trade with the valid account_id
      UPDATE trades
      SET account_id = v_account_id,
          updated_at = NOW()
      WHERE id = r.id;
      
      v_updated_count := v_updated_count + 1;
      
      -- Log progress periodically
      IF v_updated_count % 100 = 0 THEN
        RAISE NOTICE 'Updated % trades so far...', v_updated_count;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error updating trade %: %', r.id, SQLERRM;
      v_error_count := v_error_count + 1;
    END;
  END LOOP;
  
  RAISE NOTICE 'Orphaned trade fix complete. Updated: %, Errors: %', 
    v_updated_count, v_error_count;
END $$;

-------------------------------------------------------
-- PART 3: VERIFY THE FIX
-------------------------------------------------------

DO $$
DECLARE
  v_remaining_orphans INTEGER;
BEGIN
  RAISE NOTICE '-------------------------------------------------------';
  RAISE NOTICE 'VERIFYING FIX';
  RAISE NOTICE '-------------------------------------------------------';
  
  -- Count any remaining orphans
  SELECT COUNT(*) INTO v_remaining_orphans
  FROM trades t
  LEFT JOIN accounts a ON t.account_id = a.id
  WHERE a.id IS NULL;
  
  RAISE NOTICE 'Remaining orphaned trades: %', v_remaining_orphans;
  
  IF v_remaining_orphans > 0 THEN
    RAISE NOTICE 'WARNING: Not all orphaned trades were fixed!';
  ELSE
    RAISE NOTICE 'SUCCESS: All orphaned trades have been fixed!';
  END IF;
END $$;

-- Direct function to reset account IDs for trades if needed later
CREATE OR REPLACE FUNCTION reset_accounts_for_user_trades(
  p_user_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_account_id UUID;
  v_update_count INTEGER;
BEGIN
  -- Get a valid account for this user
  SELECT id INTO v_account_id
  FROM accounts
  WHERE user_id = p_user_id
  LIMIT 1;
  
  -- If no account exists, create one
  IF v_account_id IS NULL THEN
    v_account_id := get_or_create_default_account_for_orphans(p_user_id);
  END IF;
  
  -- Update all trades for this user to use this account
  UPDATE trades
  SET account_id = v_account_id,
      updated_at = NOW()
  WHERE user_id = p_user_id;
  
  GET DIAGNOSTICS v_update_count = ROW_COUNT;
  
  RETURN v_update_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION reset_accounts_for_user_trades(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_default_account_for_orphans(UUID) TO authenticated; 