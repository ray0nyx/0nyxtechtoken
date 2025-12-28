-- Detailed debug script with more verbose output
-- This will help us see exactly what's happening

-- 1. Check if we're authenticated
DO $$
DECLARE
  user_id UUID;
BEGIN
  SELECT auth.uid() INTO user_id;
  
  IF user_id IS NULL THEN
    RAISE NOTICE '❌ ERROR: No authenticated user found. Please log in first.';
  ELSE
    RAISE NOTICE '✅ User authenticated: %', user_id;
  END IF;
END $$;

-- 2. Check if functions exist with more detail
DO $$
DECLARE
  func_record RECORD;
BEGIN
  RAISE NOTICE '=== CHECKING FUNCTIONS ===';
  
  FOR func_record IN 
    SELECT proname, oidvectortypes(proargtypes) as argtypes
    FROM pg_proc 
    WHERE proname IN ('get_contract_multiplier', 'calculate_contract_commission', 'calculate_futures_pnl', 'process_tradovate_csv_batch')
    ORDER BY proname
  LOOP
    RAISE NOTICE 'Function: % (%)', func_record.proname, func_record.argtypes;
  END LOOP;
END $$;

-- 3. Test tick calculation step by step
DO $$
DECLARE
  multiplier NUMERIC;
  tick_size NUMERIC;
  price_diff NUMERIC;
  ticks NUMERIC;
  gross_pnl NUMERIC;
  commission NUMERIC;
  net_pnl NUMERIC;
BEGIN
  RAISE NOTICE '=== TICK CALCULATION STEP BY STEP ===';
  
  -- Get multiplier
  multiplier := get_contract_multiplier('NQ');
  RAISE NOTICE 'NQ multiplier: $% per tick', multiplier;
  
  -- Get tick size
  tick_size := 0.25;
  RAISE NOTICE 'NQ tick size: % points per tick', tick_size;
  
  -- Calculate price difference
  price_diff := 24971.25 - 24970.75;
  RAISE NOTICE 'Price difference: % points', price_diff;
  
  -- Calculate ticks
  ticks := price_diff / tick_size;
  RAISE NOTICE 'Number of ticks: %', ticks;
  
  -- Calculate gross PnL
  gross_pnl := ticks * 10 * multiplier;
  RAISE NOTICE 'Gross PnL: % ticks * 10 contracts * $% = $%', ticks, multiplier, gross_pnl;
  
  -- Calculate commission
  commission := calculate_contract_commission('NQ', 10);
  RAISE NOTICE 'Commission: $%', commission;
  
  -- Calculate net PnL
  net_pnl := gross_pnl - commission;
  RAISE NOTICE 'Net PnL: $% - $% = $%', gross_pnl, commission, net_pnl;
  
  IF net_pnl = 70.00 THEN
    RAISE NOTICE '✅ Calculation is CORRECT!';
  ELSE
    RAISE NOTICE '❌ Calculation is WRONG! Expected $70.00';
  END IF;
END $$;

-- 4. Check trades table structure
DO $$
DECLARE
  col_record RECORD;
BEGIN
  RAISE NOTICE '=== TRADES TABLE STRUCTURE ===';
  
  FOR col_record IN 
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'trades' AND table_schema = 'public'
    ORDER BY ordinal_position
  LOOP
    RAISE NOTICE 'Column: % (%%) - Nullable: %', col_record.column_name, col_record.data_type, col_record.is_nullable;
  END LOOP;
END $$;

-- 5. Check all trades in database
DO $$
DECLARE
  trade_record RECORD;
  total_count INTEGER;
BEGIN
  RAISE NOTICE '=== ALL TRADES IN DATABASE ===';
  
  SELECT COUNT(*) INTO total_count FROM trades;
  RAISE NOTICE 'Total trades: %', total_count;
  
  IF total_count > 0 THEN
    FOR trade_record IN 
      SELECT id, symbol, net_pnl, fees, platform, created_at, user_id
      FROM trades 
      ORDER BY created_at DESC
      LIMIT 10
    LOOP
      RAISE NOTICE 'Trade: ID=%, Symbol=%, PnL=$%, Fees=$%, Platform=%, User=%, Created=%', 
        trade_record.id, trade_record.symbol, trade_record.net_pnl, 
        trade_record.fees, trade_record.platform, trade_record.user_id, trade_record.created_at;
    END LOOP;
  ELSE
    RAISE NOTICE 'No trades found in database';
  END IF;
END $$;

-- 6. Test CSV processing with detailed output
DO $$
DECLARE
  test_data JSONB;
  result JSONB;
  user_id UUID;
  recent_count INTEGER;
BEGIN
  RAISE NOTICE '=== TESTING CSV PROCESSING ===';
  
  SELECT auth.uid() INTO user_id;
  
  IF user_id IS NULL THEN
    RAISE NOTICE '❌ No user authenticated, skipping CSV test';
    RETURN;
  END IF;
  
  -- Create test data
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
      "Buy Fill ID": "test_buy_123",
      "Sell Fill ID": "test_sell_123"
    }
  ]'::JSONB;
  
  RAISE NOTICE 'Test data created: %', test_data;
  
  -- Count trades before
  SELECT COUNT(*) INTO recent_count FROM trades WHERE user_id = user_id;
  RAISE NOTICE 'Trades before CSV processing: %', recent_count;
  
  -- Process CSV
  BEGIN
    result := process_tradovate_csv_batch(user_id, test_data, NULL);
    
    RAISE NOTICE 'CSV processing result: %', result;
    
    -- Count trades after
    SELECT COUNT(*) INTO recent_count FROM trades WHERE user_id = user_id;
    RAISE NOTICE 'Trades after CSV processing: %', recent_count;
    
    IF (result->>'processed')::INTEGER > 0 THEN
      RAISE NOTICE '✅ CSV processing successful!';
    ELSE
      RAISE NOTICE '❌ CSV processing failed!';
      RAISE NOTICE 'Errors: %', result->'detailed_errors';
    END IF;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ ERROR in CSV processing: %', SQLERRM;
  END;
END $$;

-- 7. Check RLS policies
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  RAISE NOTICE '=== ROW LEVEL SECURITY POLICIES ===';
  
  FOR policy_record IN 
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
    FROM pg_policies 
    WHERE tablename = 'trades'
  LOOP
    RAISE NOTICE 'Policy: % on %.% for % - %', 
      policy_record.policyname, policy_record.schemaname, policy_record.tablename, 
      policy_record.roles, policy_record.cmd;
  END LOOP;
END $$;

-- 8. Final summary
DO $$
BEGIN
  RAISE NOTICE '=== DEBUG SUMMARY ===';
  RAISE NOTICE 'If you see any ❌ errors above, those need to be fixed.';
  RAISE NOTICE 'If all checks show ✅ but trades still don''t display:';
  RAISE NOTICE '1. Try hard refresh in browser (Ctrl+F5)';
  RAISE NOTICE '2. Check browser console for JavaScript errors';
  RAISE NOTICE '3. Check if you''re logged in as the same user';
  RAISE NOTICE '4. Try logging out and back in';
END $$;
