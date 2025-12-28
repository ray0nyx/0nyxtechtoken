-- Debug script to check trade insertion and display
-- Run this to see what's happening with your trades

-- Check if the functions exist
DO $$
DECLARE
  func_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO func_count 
  FROM pg_proc 
  WHERE proname = 'process_tradovate_csv_batch';
  
  RAISE NOTICE 'process_tradovate_csv_batch functions found: %', func_count;
  
  IF func_count = 0 THEN
    RAISE NOTICE 'ERROR: No process_tradovate_csv_batch function found!';
  ELSE
    RAISE NOTICE 'process_tradovate_csv_batch function exists';
  END IF;
END $$;

-- Check if the tick calculation functions exist
DO $$
DECLARE
  func_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO func_count 
  FROM pg_proc 
  WHERE proname = 'calculate_futures_pnl';
  
  RAISE NOTICE 'calculate_futures_pnl functions found: %', func_count;
  
  IF func_count = 0 THEN
    RAISE NOTICE 'ERROR: No calculate_futures_pnl function found!';
  ELSE
    RAISE NOTICE 'calculate_futures_pnl function exists';
  END IF;
END $$;

-- Test the tick calculation with your exact trade
DO $$
DECLARE
  test_pnl NUMERIC;
  test_commission NUMERIC;
BEGIN
  test_pnl := calculate_futures_pnl('NQ', 'long', 24970.75, 24971.25, 10, 0);
  test_commission := calculate_contract_commission('NQ', 10);
  
  RAISE NOTICE '=== Tick Calculation Test ===';
  RAISE NOTICE 'NQ Trade: Entry=24970.75, Exit=24971.25, Qty=10';
  RAISE NOTICE 'Calculated PnL: $%', test_pnl;
  RAISE NOTICE 'Calculated Commission: $%', test_commission;
  RAISE NOTICE 'Expected: PnL=$70.00, Commission=$30.00';
END $$;

-- Check recent trades in the database
DO $$
DECLARE
  trade_count INTEGER;
  recent_trade RECORD;
BEGIN
  SELECT COUNT(*) INTO trade_count FROM trades WHERE created_at > NOW() - INTERVAL '1 hour';
  RAISE NOTICE 'Trades created in last hour: %', trade_count;
  
  IF trade_count > 0 THEN
    SELECT * INTO recent_trade 
    FROM trades 
    WHERE created_at > NOW() - INTERVAL '1 hour' 
    ORDER BY created_at DESC 
    LIMIT 1;
    
    RAISE NOTICE 'Most recent trade:';
    RAISE NOTICE '  Symbol: %', recent_trade.symbol;
    RAISE NOTICE '  PnL: $%', recent_trade.net_pnl;
    RAISE NOTICE '  Fees: $%', recent_trade.fees;
    RAISE NOTICE '  Created: %', recent_trade.created_at;
  ELSE
    RAISE NOTICE 'No recent trades found';
  END IF;
END $$;

-- Check if there are any trades at all
DO $$
DECLARE
  total_trades INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_trades FROM trades;
  RAISE NOTICE 'Total trades in database: %', total_trades;
END $$;

-- Test the CSV processing function with sample data
DO $$
DECLARE
  test_data JSONB;
  result JSONB;
BEGIN
  -- Create sample trade data matching your NQ trade
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
  
  -- Test the function
  BEGIN
    result := process_tradovate_csv_batch(auth.uid(), test_data, NULL);
    RAISE NOTICE '=== CSV Processing Test ===';
    RAISE NOTICE 'Function call successful: %', result->>'success';
    RAISE NOTICE 'Processed trades: %', result->>'processed';
    RAISE NOTICE 'Errors: %', result->>'errors';
    
    IF (result->>'processed')::INTEGER > 0 THEN
      RAISE NOTICE 'Trade processing successful!';
    ELSE
      RAISE NOTICE 'No trades were processed';
      RAISE NOTICE 'Detailed errors: %', result->'detailed_errors';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ERROR calling process_tradovate_csv_batch: %', SQLERRM;
  END;
END $$;
