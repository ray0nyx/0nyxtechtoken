-- Fix for the ensure_account_exists function ambiguity
-- This script resolves the issue where multiple versions of ensure_account_exists exist
-- with similar signatures, causing PostgreSQL to be unable to determine which to use

-- First, drop all existing versions of the function
DO $$
BEGIN
  -- Drop single parameter version
  BEGIN
    DROP FUNCTION IF EXISTS ensure_account_exists(UUID);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop ensure_account_exists(UUID): %', SQLERRM;
  END;
  
  -- Drop two parameter version
  BEGIN
    DROP FUNCTION IF EXISTS ensure_account_exists(UUID, TEXT);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop ensure_account_exists(UUID, TEXT): %', SQLERRM;
  END;
END $$;

-- Now create a consolidated version with a default parameter
-- that works for all existing call signatures
CREATE OR REPLACE FUNCTION ensure_account_exists(
  p_user_id UUID,
  p_account_name TEXT DEFAULT 'Default Account'
) RETURNS UUID AS $$
DECLARE
  v_account_id UUID;
  v_platform TEXT := 'topstepx';
BEGIN
  -- Log the function call for debugging
  RAISE NOTICE 'ensure_account_exists called with user_id: %, account_name: %', p_user_id, p_account_name;

  -- Check if user already has an account for the platform
  SELECT id INTO v_account_id
  FROM accounts
  WHERE user_id = p_user_id
  AND (
    -- Match by platform first (most reliable)
    platform = v_platform
    -- Or by name patterns as fallback
    OR name LIKE '%' || v_platform || '%'
    OR name LIKE '%TopstepX%'
  )
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
      v_platform,
      0,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_account_id;
    
    RAISE NOTICE 'Created new account % for user % with name %', v_account_id, p_user_id, p_account_name;
  ELSE
    RAISE NOTICE 'Using existing account % for user %', v_account_id, p_user_id;
  END IF;
  
  RETURN v_account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions to the authenticated role
GRANT EXECUTE ON FUNCTION ensure_account_exists(UUID, TEXT) TO authenticated;

-- Create a compatibility function to verify which functions exist
-- Fixed syntax errors in the check_function_exists function
CREATE OR REPLACE FUNCTION check_function_exists() RETURNS TABLE (
  function_name TEXT,
  parameter_list TEXT,
  function_exists BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'ensure_account_exists'::TEXT,
    'UUID'::TEXT,
    EXISTS(
      SELECT 1 FROM pg_proc 
      JOIN pg_type ON pg_type.oid = pg_proc.proargtypes[0]
      WHERE proname = 'ensure_account_exists' 
      AND pronargs = 1
      AND pg_type.typname = 'uuid'
    )
  UNION ALL
  SELECT 
    'ensure_account_exists'::TEXT,
    'UUID, TEXT'::TEXT,
    EXISTS(
      SELECT 1 FROM pg_proc 
      WHERE proname = 'ensure_account_exists' 
      AND pronargs = 2
      AND EXISTS (
        SELECT 1 FROM pg_type
        WHERE pg_type.oid = pg_proc.proargtypes[0]
        AND pg_type.typname = 'uuid'
      )
      AND EXISTS (
        SELECT 1 FROM pg_type
        WHERE pg_type.oid = pg_proc.proargtypes[1]
        AND pg_type.typname = 'text'
      )
    );
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_function_exists() TO authenticated;

COMMENT ON FUNCTION ensure_account_exists(UUID, TEXT) IS
$comment$
Consolidated helper function to find or create an account for a user.

Parameters:
- p_user_id: The user's UUID
- p_account_name: Optional name for the account (defaults to 'Default Account')

Usage examples:
1. With just user_id:
   SELECT ensure_account_exists('1234-5678-90ab-cdef');

2. With user_id and account name:
   SELECT ensure_account_exists('1234-5678-90ab-cdef', 'TopstepX Account');

This version replaces all previous versions of the function to avoid ambiguity.
$comment$; 