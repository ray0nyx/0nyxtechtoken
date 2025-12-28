-- Complete debug script to identify why trades aren't displaying
-- Run this to get a full picture of what's happening

-- 1. Check if all required functions exist
DO $$
DECLARE
  func_count INTEGER;
  func_name TEXT;
BEGIN
  RAISE NOTICE '=== FUNCTION EXISTENCE CHECK ===';
  
  FOR func_name IN VALUES 
    ('get_contract_multiplier'),
    ('calculate_contract_commission'), 
    ('calculate_futures_pnl'),
    ('process_tradovate_csv_batch')
  LOOP
    SELECT COUNT(*) INTO func_count 
    FROM pg_proc 
    WHERE proname = func_name;
    
    IF func_count = 0 THEN
      RAISE NOTICE 'ERROR: % function NOT found', func_name;
    ELSE
      RAISE NOTICE 'OK: % function exists', func_name;
    END IF;
  END LOOP;
END $$;

-- 2. Test tick calculation functions
DO $$
DECLARE
  test_pnl NUMERIC;
  test_commission NUMERIC;
BEGIN
  RAISE NOTICE '=== TICK CALCULATION TEST ===';
  
  BEGIN
    test_pnl := calculate_futures_pnl('NQ', 'long', 24970.75, 24971.25, 10, 0);
    test_commission := calculate_contract_commission('NQ', 10);
    
    RAISE NOTICE 'NQ Trade Test:';
    RAISE NOTICE '  Entry: 24970.75, Exit: 24971.25, Qty: 10';
    RAISE NOTICE '  Calculated PnL: $%', test_pnl;
    RAISE NOTICE '  Calculated Commission: $%', test_commission;
    RAISE NOTICE '  Expected: PnL=$70.00, Commission=$30.00';
    
    IF test_pnl = 70.00 AND test_commission = 30.00 THEN
      RAISE NOTICE '  ✅ Tick calculation is CORRECT';
    ELSE
      RAISE NOTICE '  ❌ Tick calculation is WRONG';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ERROR in tick calculation: %', SQLERRM;
  END;
END $$;

-- 3. Check database schema
DO $$
DECLARE
  col_count INTEGER;
  col_name TEXT;
BEGIN
  RAISE NOTICE '=== DATABASE SCHEMA CHECK ===';
  
  -- Check if trades table has required columns
  SELECT COUNT(*) INTO col_count 
  FROM information_schema.columns 
  WHERE table_name = 'trades' AND table_schema = 'public';
  
  RAISE NOTICE 'Trades table columns: %', col_count;
  
  -- Check for key columns
  FOR col_name IN VALUES 
    ('id'), ('user_id'), ('symbol'), ('net_pnl'), ('fees'), ('created_at')
  LOOP
    SELECT COUNT(*) INTO col_count 
    FROM information_schema.columns 
    WHERE table_name = 'trades' 
      AND column_name = col_name 
      AND table_schema = 'public';
    
    IF col_count = 0 THEN
      RAISE NOTICE 'ERROR: Column % missing from trades table', col_name;
    ELSE
      RAISE NOTICE 'OK: Column % exists', col_name;
    END IF;
  END LOOP;
END $$;

-- 4. Check recent trades
DO $$
DECLARE
  total_trades INTEGER;
  recent_trades INTEGER;
  trade_record RECORD;
BEGIN
  RAISE NOTICE '=== TRADES DATA CHECK ===';
  
  SELECT COUNT(*) INTO total_trades FROM trades;
  RAISE NOTICE 'Total trades in database: %', total_trades;
  
  SELECT COUNT(*) INTO recent_trades 
  FROM trades 
  WHERE created_at > NOW() - INTERVAL '1 hour';
  RAISE NOTICE 'Trades created in last hour: %', recent_trades;
  
  IF recent_trades > 0 THEN
    RAISE NOTICE 'Recent trades:';
    FOR trade_record IN 
      SELECT id, symbol, net_pnl, fees, created_at, platform
      FROM trades 
      WHERE created_at > NOW() - INTERVAL '1 hour'
      ORDER BY created_at DESC
      LIMIT 5
    LOOP
      RAISE NOTICE '  ID: %, Symbol: %, PnL: $%, Fees: $%, Platform: %, Created: %', 
        trade_record.id, trade_record.symbol, trade_record.net_pnl, 
        trade_record.fees, trade_record.platform, trade_record.created_at;
    END LOOP;
  ELSE
    RAISE NOTICE 'No recent trades found';
  END IF;
END $$;

-- 5. Test CSV processing with sample data
DO $$
DECLARE
  test_data JSONB;
  result JSONB;
  user_id UUID;
  recent_trades INTEGER;
BEGIN
  RAISE NOTICE '=== CSV PROCESSING TEST ===';
  
  -- Get current user ID
  SELECT auth.uid() INTO user_id;
  RAISE NOTICE 'Current user ID: %', user_id;
  
  IF user_id IS NULL THEN
    RAISE NOTICE 'ERROR: No authenticated user found';
    RETURN;
  END IF;
  
  -- Create sample trade data
  test_data := '[
    {
      "Product": "NQ",
      "Contract": "NQZ5",
      "Bought": 10,
      "Sold": 10,
      "Paired Qty": 10,
      "Avg. Buy": 24970.75,
      "Avg. Sell": 24971.25,
      "Bought Timestamp": "2025-10-15 17:51:39",
      "Sold Timestamp": "2025-10-15 17:51:56",
      "Timestamp": "2025-10-15 17:51:56",
      "Buy Fill ID": "262713002084",
      "Sell Fill ID": "262713002091"
    }
  ]'::JSONB;
  
  RAISE NOTICE 'Testing CSV processing...';
  
  BEGIN
    result := process_tradovate_csv_batch(user_id, test_data, NULL);
    
    RAISE NOTICE 'CSV Processing Result:';
    RAISE NOTICE '  Success: %', result->>'success';
    RAISE NOTICE '  Processed: %', result->>'processed';
    RAISE NOTICE '  Errors: %', result->>'errors';
    RAISE NOTICE '  Total Rows: %', result->>'total_rows';
    
    IF (result->>'processed')::INTEGER > 0 THEN
      RAISE NOTICE '  ✅ CSV processing successful!';
      
      -- Check if the trade was actually inserted
      SELECT COUNT(*) INTO recent_trades 
      FROM trades 
      WHERE user_id = user_id 
        AND created_at > NOW() - INTERVAL '1 minute';
      
      RAISE NOTICE '  Trades inserted in last minute: %', recent_trades;
    ELSE
      RAISE NOTICE '  ❌ No trades were processed';
      RAISE NOTICE '  Detailed errors: %', result->'detailed_errors';
    END IF;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ERROR in CSV processing: %', SQLERRM;
  END;
END $$;

-- 6. Check for any error logs or issues
DO $$
DECLARE
  error_count INTEGER;
BEGIN
  RAISE NOTICE '=== ERROR CHECK ===';
  
  -- Check for any trades with NULL values that might cause display issues
  SELECT COUNT(*) INTO error_count 
  FROM trades 
  WHERE net_pnl IS NULL OR symbol IS NULL OR user_id IS NULL;
  
  RAISE NOTICE 'Trades with NULL critical values: %', error_count;
  
  IF error_count > 0 THEN
    RAISE NOTICE 'WARNING: Found trades with NULL values that might not display correctly';
  END IF;
END $$;

-- 7. Final summary
DO $$
BEGIN
  RAISE NOTICE '=== DEBUG SUMMARY ===';
  RAISE NOTICE 'If you see any ERROR messages above, those need to be fixed first.';
  RAISE NOTICE 'If all checks pass but trades still don''t display, the issue might be:';
  RAISE NOTICE '1. Frontend caching - try hard refresh (Ctrl+F5)';
  RAISE NOTICE '2. User authentication - check if you''re logged in';
  RAISE NOTICE '3. Database permissions - check RLS policies';
  RAISE NOTICE '4. Network issues - check browser console for errors';
END $$;
