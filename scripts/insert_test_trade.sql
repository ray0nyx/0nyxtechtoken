-- Insert a test trade manually to check if the issue is with CSV processing or display
-- Run this to create a test trade that should definitely show up

DO $$
DECLARE
  user_id UUID;
  trade_id UUID;
  test_pnl NUMERIC;
  test_commission NUMERIC;
BEGIN
  -- Get current user
  SELECT auth.uid() INTO user_id;
  
  IF user_id IS NULL THEN
    RAISE NOTICE 'ERROR: No authenticated user found. Please log in first.';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Current user ID: %', user_id;
  
  -- Calculate PnL using our functions
  test_pnl := calculate_futures_pnl('NQ', 'long', 24970.75, 24971.25, 10, 0);
  test_commission := calculate_contract_commission('NQ', 10);
  
  RAISE NOTICE 'Calculated PnL: $%', test_pnl;
  RAISE NOTICE 'Calculated Commission: $%', test_commission;
  
  -- Insert test trade
  trade_id := gen_random_uuid();
  
  INSERT INTO trades (
    id, user_id, account_id, symbol, side, quantity, entry_price, exit_price,
    entry_date, exit_date, net_pnl, fees, platform, position, size,
    trade_date, created_at, updated_at, extended_data, analytics,
    buyFillId, sellFillId, buyPrice, sellPrice, boughtTimestamp, soldTimestamp, duration
  ) VALUES (
    trade_id,
    user_id,
    NULL, -- account_id
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
    '{"test": true, "manual_insert": true}'::JSONB,
    jsonb_build_object(
      'gross_pnl', test_pnl + test_commission,
      'net_pnl', test_pnl,
      'fees', test_commission,
      'calculation_method', 'tick_based',
      'test_trade', true
    ),
    'test_buy_fill',
    'test_sell_fill',
    24970.75,
    24971.25,
    '2025-10-15 17:51:39'::TIMESTAMP,
    '2025-10-15 17:51:56'::TIMESTAMP,
    17 -- duration in seconds
  );
  
  RAISE NOTICE 'Test trade inserted successfully!';
  RAISE NOTICE 'Trade ID: %', trade_id;
  RAISE NOTICE 'Symbol: NQ';
  RAISE NOTICE 'PnL: $%', test_pnl;
  RAISE NOTICE 'Fees: $%', test_commission;
  RAISE NOTICE 'Platform: Tradovate';
  RAISE NOTICE 'Created: %', NOW();
  
  -- Verify the trade was inserted
  IF EXISTS (SELECT 1 FROM trades WHERE id = trade_id) THEN
    RAISE NOTICE '✅ Trade verification: SUCCESS - Trade exists in database';
  ELSE
    RAISE NOTICE '❌ Trade verification: FAILED - Trade not found in database';
  END IF;
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ERROR inserting test trade: %', SQLERRM;
END $$;
