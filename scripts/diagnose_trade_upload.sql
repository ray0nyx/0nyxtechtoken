-- Diagnostic script to help identify trade upload issues

-- 1. Check if the functions exist with correct parameters
DO $$
DECLARE
  v_function_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'process_tradovate_csv_batch'
    AND n.nspname = 'public'
  ) INTO v_function_exists;
  
  IF v_function_exists THEN
    RAISE NOTICE 'process_tradovate_csv_batch function exists';
    
    -- Check the parameter names
    RAISE NOTICE 'Parameter details:';
    FOR r IN (
      SELECT p.proname, pg_get_function_arguments(p.oid) as args
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE p.proname = 'process_tradovate_csv_batch'
      AND n.nspname = 'public'
    ) LOOP
      RAISE NOTICE 'Function: %, Arguments: %', r.proname, r.args;
    END LOOP;
  ELSE
    RAISE NOTICE 'process_tradovate_csv_batch function does NOT exist';
  END IF;
END $$;

-- 2. Check the trades table structure
DO $$
BEGIN
  RAISE NOTICE 'Trades table structure:';
  FOR r IN (
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'trades'
    AND table_schema = 'public'
    ORDER BY ordinal_position
  ) LOOP
    RAISE NOTICE 'Column: %, Type: %, Nullable: %', r.column_name, r.data_type, r.is_nullable;
  END LOOP;
END $$;

-- 3. Check if accounts exist for the user
DO $$
DECLARE
  v_user_count INTEGER;
  v_account_count INTEGER;
BEGIN
  -- Count users
  SELECT COUNT(*) INTO v_user_count FROM auth.users;
  RAISE NOTICE 'Total users: %', v_user_count;
  
  -- Count accounts
  SELECT COUNT(*) INTO v_account_count FROM accounts;
  RAISE NOTICE 'Total accounts: %', v_account_count;
  
  -- Show accounts per user
  RAISE NOTICE 'Accounts per user:';
  FOR r IN (
    SELECT u.id as user_id, COUNT(a.id) as account_count
    FROM auth.users u
    LEFT JOIN accounts a ON u.id = a.user_id
    GROUP BY u.id
  ) LOOP
    RAISE NOTICE 'User: %, Account count: %', r.user_id, r.account_count;
  END LOOP;
END $$;

-- 4. Test inserting a sample trade directly
DO $$
DECLARE
  v_user_id UUID;
  v_account_id UUID;
  v_trade_id UUID;
BEGIN
  -- Get the first user
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No users found in the database';
    RETURN;
  END IF;
  
  -- Get or create an account for this user
  SELECT id INTO v_account_id FROM accounts WHERE user_id = v_user_id AND platform = 'tradovate' LIMIT 1;
  
  IF v_account_id IS NULL THEN
    INSERT INTO accounts (
      id,
      user_id,
      name,
      platform,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      'Tradovate Test Account',
      'tradovate',
      NOW(),
      NOW()
    )
    RETURNING id INTO v_account_id;
    
    RAISE NOTICE 'Created new test account % for user %', v_account_id, v_user_id;
  END IF;
  
  -- Try to insert a test trade
  BEGIN
    INSERT INTO trades (
      id,
      user_id,
      account_id,
      symbol,
      side,
      quantity,
      price,
      pnl,
      date,
      timestamp,
      broker,
      notes,
      created_at,
      updated_at,
      entry_price,
      entry_date,
      exit_date,
      exit_price,
      position
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      v_account_id,
      'ES',
      'long',
      1,
      4500.00,
      25.00,
      CURRENT_DATE,
      NOW(),
      'Tradovate',
      'Test trade',
      NOW(),
      NOW(),
      4500.00,
      NOW(),
      NOW() + interval '1 hour',
      4525.00,
      'long'
    )
    RETURNING id INTO v_trade_id;
    
    RAISE NOTICE 'Successfully inserted test trade with ID: %', v_trade_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error inserting test trade: %', SQLERRM;
    
    -- Check for NOT NULL constraints
    RAISE NOTICE 'Checking for NOT NULL constraints:';
    FOR r IN (
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'trades'
      AND table_schema = 'public'
      AND is_nullable = 'NO'
      AND column_default IS NULL
      AND column_name NOT IN ('id', 'created_at', 'updated_at')
    ) LOOP
      RAISE NOTICE 'Required column: %', r.column_name;
    END LOOP;
  END;
END $$;

-- 5. Test the process_tradovate_csv_batch function with a single trade
DO $$
DECLARE
  v_user_id UUID;
  v_account_id UUID;
  v_result JSONB;
  v_test_trade JSONB;
BEGIN
  -- Get the first user
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No users found in the database';
    RETURN;
  END IF;
  
  -- Get or create an account for this user
  SELECT id INTO v_account_id FROM accounts WHERE user_id = v_user_id AND platform = 'tradovate' LIMIT 1;
  
  IF v_account_id IS NULL THEN
    INSERT INTO accounts (
      id,
      user_id,
      name,
      platform,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      'Tradovate Test Account',
      'tradovate',
      NOW(),
      NOW()
    )
    RETURNING id INTO v_account_id;
    
    RAISE NOTICE 'Created new test account % for user %', v_account_id, v_user_id;
  END IF;
  
  -- Create a test trade
  v_test_trade := jsonb_build_array(
    jsonb_build_object(
      'symbol', 'ES',
      'date', CURRENT_DATE,
      'qty', 1,
      'entry_price', 4500.00,
      'exit_price', 4525.00,
      'pnl', 25.00
    )
  );
  
  -- Call the function
  BEGIN
    v_result := process_tradovate_csv_batch(v_user_id, v_test_trade, v_account_id);
    RAISE NOTICE 'Function result: %', v_result;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error calling process_tradovate_csv_batch: %', SQLERRM;
  END;
END $$;

-- 6. Check for any existing trades
DO $$
BEGIN
  RAISE NOTICE 'Existing trades:';
  FOR r IN (
    SELECT COUNT(*) as trade_count, user_id
    FROM trades
    GROUP BY user_id
  ) LOOP
    RAISE NOTICE 'User: %, Trade count: %', r.user_id, r.trade_count;
  END LOOP;
  
  -- Check for trades without user_id
  DECLARE
    v_null_user_count INTEGER;
  BEGIN
    SELECT COUNT(*) INTO v_null_user_count FROM trades WHERE user_id IS NULL;
    RAISE NOTICE 'Trades with NULL user_id: %', v_null_user_count;
  END;
END $$; 