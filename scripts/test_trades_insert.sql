-- Test script to verify trades are being inserted correctly
-- Run this after applying the fix to check if trades are visible

-- First, check if any trades exist
SELECT 
  id,
  user_id,
  symbol,
  side,
  quantity,
  price,
  entry_price,
  exit_price,
  pnl,
  entry_date,
  exit_date,
  created_at,
  broker,
  notes
FROM trades 
ORDER BY created_at DESC 
LIMIT 10;

-- Check the count of trades
SELECT COUNT(*) as total_trades FROM trades;

-- Check if there are any trades with PnL > 0 (indicating proper calculation)
SELECT 
  symbol,
  entry_price,
  exit_price,
  pnl,
  created_at
FROM trades 
WHERE pnl > 0
ORDER BY created_at DESC;

-- Test the contract multiplier function
SELECT 
  'NQ' as symbol,
  get_contract_multiplier('NQ') as multiplier;

-- Test the PnL calculation function
SELECT 
  calculate_futures_pnl('NQ', 'long', 15000, 15005, 1, 2.58) as test_pnl;
