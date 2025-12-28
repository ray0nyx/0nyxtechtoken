-- Simple debug script without emojis to avoid syntax issues
-- This will help us see exactly what's happening

-- 1. Check if we're authenticated
DO $$
DECLARE
  user_id UUID;
BEGIN
  SELECT auth.uid() INTO user_id;
  
  IF user_id IS NULL THEN
    RAISE NOTICE 'ERROR: No authenticated user found. Please log in first.';
  ELSE
    RAISE NOTICE 'SUCCESS: User authenticated: %', user_id;
  END IF;
END $$;

-- 2. Check if functions exist
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

-- 3. Test tick calculation
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
  RAISE NOTICE '=== TICK CALCULATION TEST ===';
  
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
    RAISE NOTICE 'SUCCESS: Calculation is CORRECT!';
  ELSE
    RAISE NOTICE 'ERROR: Calculation is WRONG! Expected $70.00';
  END IF;
END $$;

-- 4. Check trades table
DO $$
DECLARE
  trade_record RECORD;
  total_count INTEGER;
BEGIN
  RAISE NOTICE '=== TRADES IN DATABASE ===';
  
  SELECT COUNT(*) INTO total_count FROM trades;
  RAISE NOTICE 'Total trades: %', total_count;
  
  IF total_count > 0 THEN
    FOR trade_record IN 
      SELECT id, symbol, net_pnl, fees, platform, created_at, user_id
      FROM trades 
      ORDER BY created_at DESC
      LIMIT 5
    LOOP
      RAISE NOTICE 'Trade: ID=%, Symbol=%, PnL=$%, Fees=$%, Platform=%, User=%, Created=%', 
        trade_record.id, trade_record.symbol, trade_record.net_pnl, 
        trade_record.fees, trade_record.platform, trade_record.user_id, trade_record.created_at;
    END LOOP;
  ELSE
    RAISE NOTICE 'No trades found in database';
  END IF;
END $$;

-- 5. Test CSV processing
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
    RAISE NOTICE 'ERROR: No user authenticated, skipping CSV test';
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
  
  RAISE NOTICE 'Test data created successfully';
  
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
      RAISE NOTICE 'SUCCESS: CSV processing successful!';
    ELSE
      RAISE NOTICE 'ERROR: CSV processing failed!';
      RAISE NOTICE 'Errors: %', result->'detailed_errors';
    END IF;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ERROR in CSV processing: %', SQLERRM;
  END;
END $$;

-- 6. Insert test trade
DO $$
DECLARE
  user_id UUID;
  trade_id UUID;
  test_pnl NUMERIC;
  test_commission NUMERIC;
  inserted_trade RECORD;
BEGIN
  RAISE NOTICE '=== INSERTING TEST TRADE ===';
  
  SELECT auth.uid() INTO user_id;
  
  IF user_id IS NULL THEN
    RAISE NOTICE 'ERROR: No authenticated user found. Please log in first.';
    RETURN;
  END IF;
  
  RAISE NOTICE 'User authenticated: %', user_id;
  
  -- Calculate PnL
  test_pnl := calculate_futures_pnl('NQ', 'long', 24970.75, 24971.25, 10, 0);
  test_commission := calculate_contract_commission('NQ', 10);
  
  RAISE NOTICE 'Calculated PnL: $%', test_pnl;
  RAISE NOTICE 'Calculated Commission: $%', test_commission;
  
  -- Generate trade ID
  trade_id := gen_random_uuid();
  RAISE NOTICE 'Generated trade ID: %', trade_id;
  
  -- Insert the trade
  BEGIN
    INSERT INTO trades (
      id, user_id, account_id, symbol, side, quantity, entry_price, exit_price,
      entry_date, exit_date, net_pnl, fees, platform, position, size,
      trade_date, created_at, updated_at, extended_data, analytics,
      buyFillId, sellFillId, buyPrice, sellPrice, boughtTimestamp, soldTimestamp, duration
    ) VALUES (
      trade_id,
      user_id,
      NULL,
      'NQ',
      'long',
      10,
      24970.75,
      24971.25,
      '2025-10-15 17:51:39'::TIMESTAMP,
      '2025-10-15 17:51:56'::TIMESTAMP,
      test_pnl,
      test_commission,
      'Tradovate',
      'long',
      10,
      '2025-10-15'::DATE,
      NOW(),
      NOW(),
      '{"test": true, "manual_insert": true, "debug": true}'::JSONB,
      jsonb_build_object(
        'gross_pnl', test_pnl + test_commission,
        'net_pnl', test_pnl,
        'fees', test_commission,
        'calculation_method', 'tick_based',
        'test_trade', true,
        'debug_timestamp', NOW()
      ),
      'debug_buy_fill_' || extract(epoch from now()),
      'debug_sell_fill_' || extract(epoch from now()),
      24970.75,
      24971.25,
      '2025-10-15 17:51:39'::TIMESTAMP,
      '2025-10-15 17:51:56'::TIMESTAMP,
      17
    );
    
    RAISE NOTICE 'SUCCESS: Trade inserted successfully!';
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ERROR inserting trade: %', SQLERRM;
    RETURN;
  END;
  
  -- Verify the trade exists
  BEGIN
    SELECT * INTO inserted_trade 
    FROM trades 
    WHERE id = trade_id;
    
    IF inserted_trade.id IS NOT NULL THEN
      RAISE NOTICE 'SUCCESS: Trade verification successful!';
      RAISE NOTICE 'Trade ID: %', inserted_trade.id;
      RAISE NOTICE 'Symbol: %', inserted_trade.symbol;
      RAISE NOTICE 'PnL: $%', inserted_trade.net_pnl;
      RAISE NOTICE 'Fees: $%', inserted_trade.fees;
      RAISE NOTICE 'Platform: %', inserted_trade.platform;
      RAISE NOTICE 'User ID: %', inserted_trade.user_id;
      RAISE NOTICE 'Created: %', inserted_trade.created_at;
    ELSE
      RAISE NOTICE 'ERROR: Trade verification failed - Trade not found!';
    END IF;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ERROR verifying trade: %', SQLERRM;
  END;
  
  -- Check total trades for this user
  DECLARE
    user_trade_count INTEGER;
  BEGIN
    SELECT COUNT(*) INTO user_trade_count 
    FROM trades 
    WHERE user_id = user_id;
    
    RAISE NOTICE 'Total trades for this user: %', user_trade_count;
  END;
  
END $$;

-- 7. Final summary
DO $$
BEGIN
  RAISE NOTICE '=== DEBUG SUMMARY ===';
  RAISE NOTICE 'If you see any ERROR messages above, those need to be fixed first.';
  RAISE NOTICE 'If all checks show SUCCESS but trades still do not display:';
  RAISE NOTICE '1. Try hard refresh in browser (Ctrl+F5)';
  RAISE NOTICE '2. Check browser console for JavaScript errors';
  RAISE NOTICE '3. Check if you are logged in as the same user';
  RAISE NOTICE '4. Try logging out and back in';
END $$;
