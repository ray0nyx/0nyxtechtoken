-- DIRECT FORCE CREATE ACCOUNT SCRIPT
-- This script creates the problematic account with ID '8e290e21-ba83-4533-be0a-718fafcdc7d9'
-- for the current user, with careful handling of cases where it already exists

DO $$
DECLARE
  v_force_account_id UUID := '8e290e21-ba83-4533-be0a-718fafcdc7d9';
  v_current_user_id UUID;
  v_account_exists BOOLEAN;
  v_owned_by_current_user BOOLEAN;
  v_account_owner UUID;
BEGIN
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'FORCE CREATE SPECIFIC ACCOUNT ID';
  RAISE NOTICE '=================================================';
  
  -- Get current user ID
  BEGIN
    SELECT auth.uid() INTO v_current_user_id;
    
    IF v_current_user_id IS NULL THEN
      RAISE NOTICE 'Error: Cannot determine current user ID.';
      RETURN;
    END IF;
    
    RAISE NOTICE 'Current user ID: %', v_current_user_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error getting current user ID: %', SQLERRM;
    RETURN;
  END;
  
  -- Check if account already exists
  SELECT 
    EXISTS(SELECT 1 FROM accounts WHERE id = v_force_account_id) INTO v_account_exists;
  
  IF v_account_exists THEN
    -- Check who owns this account
    SELECT user_id INTO v_account_owner FROM accounts WHERE id = v_force_account_id;
    
    v_owned_by_current_user := (v_account_owner = v_current_user_id);
    
    IF v_owned_by_current_user THEN
      RAISE NOTICE 'Account with ID % already exists and is owned by the current user.', v_force_account_id;
      RETURN;
    ELSE
      RAISE NOTICE 'Account with ID % already exists but is owned by a different user (%).', 
        v_force_account_id, v_account_owner;
      
      -- Two options here, we can either:
      -- 1. Change ownership (dangerous)
      -- 2. Do nothing (safer)
      RAISE NOTICE 'For safety reasons, we will not change ownership of this account.';
      RAISE NOTICE 'The account with ID % will remain associated with user %.', 
        v_force_account_id, v_account_owner;
      
      RETURN;
    END IF;
  END IF;
  
  -- Account doesn't exist, create it
  RAISE NOTICE 'Creating new account with ID % for current user %...', 
    v_force_account_id, v_current_user_id;
  
  BEGIN
    INSERT INTO accounts (id, user_id, name, created_at)
    VALUES (
      v_force_account_id, 
      v_current_user_id, 
      'Forced Account (Specifically Created)', 
      NOW()
    );
    
    RAISE NOTICE 'SUCCESS: Account with ID % has been created for user %.', 
      v_force_account_id, v_current_user_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ERROR: Failed to create account: %', SQLERRM;
  END;
  
  -- Verify creation
  SELECT 
    EXISTS(SELECT 1 FROM accounts WHERE id = v_force_account_id) INTO v_account_exists;
  
  IF v_account_exists THEN
    RAISE NOTICE 'Verification: Account with ID % now exists in the database.', v_force_account_id;
  ELSE
    RAISE NOTICE 'CRITICAL ERROR: Account with ID % was not created successfully.', v_force_account_id;
  END IF;
END $$;

-- Function to get accounts for current user
CREATE OR REPLACE FUNCTION get_current_user_accounts()
RETURNS TABLE(id UUID, name TEXT, created_at TIMESTAMPTZ) AS $$
DECLARE
  v_current_user_id UUID;
BEGIN
  -- Get current user ID
  BEGIN
    SELECT auth.uid() INTO v_current_user_id;
    
    IF v_current_user_id IS NULL THEN
      RAISE NOTICE 'Error: Cannot determine current user ID.';
      RETURN;
    END IF;
    
    RAISE NOTICE 'Getting accounts for user ID: %', v_current_user_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error getting current user ID: %', SQLERRM;
    RETURN;
  END;
  
  -- Return all accounts for this user
  RETURN QUERY
  SELECT a.id, a.name, a.created_at
  FROM accounts a
  WHERE a.user_id = v_current_user_id
  ORDER BY a.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_current_user_accounts() TO authenticated;

-- Call it to show accounts after creation
DO $$
BEGIN
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'CURRENT USER ACCOUNTS:';
  RAISE NOTICE '=================================================';
END $$;

SELECT * FROM get_current_user_accounts(); 