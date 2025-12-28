-- Debug script using SELECT statements to show results
-- This will display results in a table format

-- 1. Check authentication
SELECT 
  CASE 
    WHEN auth.uid() IS NULL THEN 'ERROR: No authenticated user found'
    ELSE 'SUCCESS: User authenticated - ' || auth.uid()::text
  END as auth_status;

-- 2. Check if functions exist
SELECT 
  proname as function_name,
  oidvectortypes(proargtypes) as parameters
FROM pg_proc 
WHERE proname IN ('get_contract_multiplier', 'calculate_contract_commission', 'calculate_futures_pnl', 'process_tradovate_csv_batch')
ORDER BY proname;

-- 3. Test tick calculation step by step
WITH calc AS (
  SELECT 
    get_contract_multiplier('NQ') as multiplier,
    0.25 as tick_size,
    24971.25 - 24970.75 as price_diff,
    (24971.25 - 24970.75) / 0.25 as ticks,
    ((24971.25 - 24970.75) / 0.25) * 10 * get_contract_multiplier('NQ') as gross_pnl,
    calculate_contract_commission('NQ', 10) as commission
)
SELECT 
  'NQ multiplier' as step, multiplier::text as value, '$5 per tick' as expected
FROM calc
UNION ALL
SELECT 
  'Tick size' as step, tick_size::text as value, '0.25 points per tick' as expected
FROM calc
UNION ALL
SELECT 
  'Price difference' as step, price_diff::text as value, '0.5 points' as expected
FROM calc
UNION ALL
SELECT 
  'Number of ticks' as step, ticks::text as value, '2 ticks' as expected
FROM calc
UNION ALL
SELECT 
  'Gross PnL' as step, gross_pnl::text as value, '$100.00' as expected
FROM calc
UNION ALL
SELECT 
  'Commission' as step, commission::text as value, '$30.00' as expected
FROM calc
UNION ALL
SELECT 
  'Net PnL' as step, (gross_pnl - commission)::text as value, '$70.00' as expected
FROM calc;

-- 4. Check trades table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'trades' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 5. Check all trades in database
SELECT 
  id,
  symbol,
  net_pnl,
  fees,
  platform,
  created_at,
  user_id
FROM trades 
ORDER BY created_at DESC
LIMIT 10;

-- 6. Count trades by user
SELECT 
  user_id,
  COUNT(*) as trade_count,
  MAX(created_at) as latest_trade
FROM trades 
GROUP BY user_id
ORDER BY latest_trade DESC;

-- 7. Insert a test trade and return the result
WITH test_trade AS (
  INSERT INTO trades (
    id, user_id, account_id, symbol, side, quantity, entry_price, exit_price,
    entry_date, exit_date, net_pnl, fees, platform, position, size,
    trade_date, created_at, updated_at, extended_data, analytics,
    buyFillId, sellFillId, buyPrice, sellPrice, boughtTimestamp, soldTimestamp, duration
  ) VALUES (
    gen_random_uuid(),
    auth.uid(),
    NULL,
    'NQ',
    'long',
    10,
    24970.75,
    24971.25,
    '2025-10-15 17:51:39'::TIMESTAMP,
    '2025-10-15 17:51:56'::TIMESTAMP,
    calculate_futures_pnl('NQ', 'long', 24970.75, 24971.25, 10, 0),
    calculate_contract_commission('NQ', 10),
    'Tradovate',
    'long',
    10,
    '2025-10-15'::DATE,
    NOW(),
    NOW(),
    '{"test": true, "manual_insert": true, "debug": true}'::JSONB,
    jsonb_build_object(
      'gross_pnl', calculate_futures_pnl('NQ', 'long', 24970.75, 24971.25, 10, 0) + calculate_contract_commission('NQ', 10),
      'net_pnl', calculate_futures_pnl('NQ', 'long', 24970.75, 24971.25, 10, 0),
      'fees', calculate_contract_commission('NQ', 10),
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
  )
  RETURNING id, symbol, net_pnl, fees, platform, created_at, user_id
)
SELECT 
  'Test trade inserted' as status,
  id,
  symbol,
  net_pnl,
  fees,
  platform,
  created_at,
  user_id
FROM test_trade;

-- 8. Verify the test trade exists
SELECT 
  'Test trade verification' as status,
  id,
  symbol,
  net_pnl,
  fees,
  platform,
  created_at,
  user_id
FROM trades 
WHERE user_id = auth.uid()
  AND extended_data->>'test' = 'true'
ORDER BY created_at DESC
LIMIT 1;

-- 9. Show all trades for current user
SELECT 
  'All user trades' as status,
  id,
  symbol,
  net_pnl,
  fees,
  platform,
  created_at
FROM trades 
WHERE user_id = auth.uid()
ORDER BY created_at DESC;




