-- Insert a test trade and immediately verify it exists
-- This will help us determine if the issue is with insertion or display

DO $$
DECLARE
  user_id UUID;
  trade_id UUID;
  test_pnl NUMERIC;
  test_commission NUMERIC;
  inserted_trade RECORD;
BEGIN
  RAISE NOTICE '=== INSERTING AND VERIFYING TEST TRADE ===';
  
  -- Get current user
  SELECT auth.uid() INTO user_id;
  
  IF user_id IS NULL THEN
    RAISE NOTICE ' ERROR: No authenticated user found. Please log in first.';
    RETURN;
  END IF;
  
  RAISE NOTICE ' User authenticated: %', user_id;
  
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
    
    RAISE NOTICE '✅ Trade inserted successfully!';
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ERROR inserting trade: %', SQLERRM;
    RETURN;
  END;
  
  -- Immediately verify the trade exists
  BEGIN
    SELECT * INTO inserted_trade 
    FROM trades 
    WHERE id = trade_id;
    
    IF inserted_trade.id IS NOT NULL THEN
      RAISE NOTICE 'Trade verification SUCCESSFUL!';
      RAISE NOTICE '  Trade ID: %', inserted_trade.id;
      RAISE NOTICE '  Symbol: %', inserted_trade.symbol;
      RAISE NOTICE '  PnL: $%', inserted_trade.net_pnl;
      RAISE NOTICE '  Fees: $%', inserted_trade.fees;
      RAISE NOTICE '  Platform: %', inserted_trade.platform;
      RAISE NOTICE '  User ID: %', inserted_trade.user_id;
      RAISE NOTICE '  Created: %', inserted_trade.created_at;
    ELSE
      RAISE NOTICE ' Trade verification FAILED - Trade not found!';
    END IF;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE ' ERROR verifying trade: %', SQLERRM;
  END;
  
  -- Check how many trades this user has total
  DECLARE
    user_trade_count INTEGER;
  BEGIN
    SELECT COUNT(*) INTO user_trade_count 
    FROM trades 
    WHERE user_id = user_id;
    
    RAISE NOTICE 'Total trades for this user: %', user_trade_count;
  END;
  
  -- List all trades for this user
  RAISE NOTICE '=== ALL TRADES FOR THIS USER ===';
  FOR inserted_trade IN 
    SELECT id, symbol, net_pnl, fees, platform, created_at
    FROM trades 
    WHERE user_id = user_id
    ORDER BY created_at DESC
  LOOP
    RAISE NOTICE 'Trade: % | % | PnL: $% | Fees: $% | % | %', 
      inserted_trade.id, inserted_trade.symbol, inserted_trade.net_pnl, 
      inserted_trade.fees, inserted_trade.platform, inserted_trade.created_at;
  END LOOP;
  
END $$;
